const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/logger');
const MonthlyReportService = require('../services/MonthlyReportService');

/**
 * 🔄 Reversal Management API
 */

// POST /api/reversals/request
router.post('/request', authenticateToken, (req, res) => {
    const { transaction_id, reason } = req.body;
    const requester_id = req.user.id;

    if (!transaction_id || !reason) {
        return res.status(400).json({ error: "Transaction ID and reason are required." });
    }

    db.get("SELECT * FROM transactions WHERE id = ?", [transaction_id], (err, trans) => {
        if (err || !trans) return res.status(404).json({ error: "Transaction not found." });
        if (trans.status === 'REVERSED') return res.status(400).json({ error: "Transaction is already reversed." });

        const stmt = db.prepare("INSERT INTO reversal_requests (transaction_id, requester_id, reason) VALUES (?, ?, ?)");
        stmt.run(transaction_id, requester_id, reason, function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(`Reversal Requested: ${transaction_id}`, 'security', { transaction_id, reason }, requester_id, req.user.name, req);
            res.json({ success: true, request_id: this.lastID, message: "Reversal request submitted for approval." });
        });
        stmt.finalize();
    });
});

// POST /api/reversals/approve
router.post('/approve', authenticateToken, isAdmin, (req, res) => {
    const { request_id } = req.body;
    const approver_id = req.user.id;

    db.get("SELECT * FROM reversal_requests WHERE id = ?", [request_id], (err, request) => {
        if (err || !request) return res.status(404).json({ error: "Reversal request not found." });
        if (request.status !== 'PENDING') return res.status(400).json({ error: "Request already processed." });

        if (request.requester_id === approver_id) {
            return res.status(403).json({ error: "SECURITY ALERT: You cannot approve your own reversal request." });
        }

        db.get("SELECT * FROM transactions WHERE id = ?", [request.transaction_id], (err, trans) => {
            if (!trans) return res.status(404).json({ error: "Transaction no longer exists" });

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                db.run("UPDATE transactions SET status = 'REVERSED' WHERE id = ?", [request.transaction_id]);

                const stmt = db.prepare(`
                    INSERT INTO transactions (
                        sessionId, memberId, transaction_type, description, savings_amount, withdrawals, stl_repayment, ltl_repayment, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
                `);

                const invType = `REVERSAL of ${trans.transaction_type}`;
                const invSavings = trans.savings_amount ? -trans.savings_amount : 0;
                const invWithdrawals = trans.withdrawals ? -trans.withdrawals : 0;
                const invStl = trans.stl_repayment ? -trans.stl_repayment : 0;
                const invLtl = trans.ltl_repayment ? -trans.ltl_repayment : 0;

                stmt.run(trans.sessionId, trans.memberId, invType, `Approved Reversal: ${request.reason}`, invSavings, invWithdrawals, invStl, invLtl, function (err) {
                    if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }

                    db.run("UPDATE reversal_requests SET status = 'APPROVED', approver_id = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?",
                        [approver_id, request_id], (err) => {
                            if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }

                            if (trans.savings_amount) {
                                db.run("UPDATE members SET current_savings = current_savings - ? WHERE id = ?", [trans.savings_amount, trans.memberId]);
                            }
                            if (trans.withdrawals) {
                                db.run("UPDATE members SET current_savings = current_savings + ? WHERE id = ?", [trans.withdrawals, trans.memberId]);
                            }
                            if (trans.loans_issued) {
                                db.run("UPDATE members SET active_loan_balance = active_loan_balance - ? WHERE id = ?", [trans.loans_issued, trans.memberId]);
                            }
                            if (trans.stl_repayment || trans.ltl_repayment) {
                                db.run("UPDATE members SET active_loan_balance = active_loan_balance + ? WHERE id = ?", [(Number(trans.stl_repayment || 0) + Number(trans.ltl_repayment || 0)), trans.memberId]);
                            }

                            db.run("COMMIT", async (err) => {
                                if (err) return res.status(500).json({ error: err.message });

                                logAudit(`Reversal Approved: ${request.transaction_id}`, 'security', { request_id, approver_id }, approver_id, req.user.name, req);

                                // 🏛️ RE-TRIGGER MONTHLY ROLLUP
                                try {
                                    // We need group_id and date from the transaction/session
                                    db.get("SELECT s.group_id, s.meeting_date FROM cash_sessions s JOIN transactions t ON t.sessionId = s.id WHERE t.id = ?", [request.transaction_id], async (err, context) => {
                                        if (context) {
                                            const [y, m, d] = context.meeting_date.split('-');
                                            await MonthlyReportService.recalculate(context.group_id, parseInt(m), parseInt(y));
                                        }
                                    });
                                } catch (recalcErr) {
                                    console.error("Post-Reversal Rollup Failure:", recalcErr);
                                }

                                res.json({ success: true, message: "Transaction reversed, balances adjusted, and monthly report synced." });
                            });
                        });
                });
                stmt.finalize();
            });
        });
    });
});

// GET /api/reversals/requests
router.get('/requests', authenticateToken, isAdmin, (req, res) => {
    const query = `
        SELECT rr.*, t.transaction_type, t.description as trans_desc, t.memberId, m.name as member_name, o.name as requester_name
        FROM reversal_requests rr
        JOIN transactions t ON rr.transaction_id = t.id
        JOIN members m ON t.memberId = m.id
        JOIN officers o ON rr.requester_id = o.id
        ORDER BY rr.created_at DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/reversals/unlock-session
router.post('/unlock-session', authenticateToken, isAdmin, (req, res) => {
    const { sessionId, reason } = req.body;
    const adminId = req.user.id;

    if (!sessionId || !reason) {
        return res.status(400).json({ error: "Session ID and reason are mandatory for unlocking." });
    }

    db.get("SELECT * FROM cash_sessions WHERE id = ?", [sessionId], (err, session) => {
        if (err || !session) return res.status(404).json({ error: "Institutional session not found." });
        if (session.status !== 'LOCKED') return res.status(400).json({ error: "Only LOCKED sessions can be force-unlocked." });

        db.run(
            "UPDATE cash_sessions SET status = 'OPEN', locked_at = NULL, audit_hash = NULL WHERE id = ?",
            [sessionId],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });

                logAudit(`Session Force-Unlocked: ${sessionId}`, 'security', { sessionId, reason, adminId }, adminId, req.user.name, req);

                res.json({
                    success: true,
                    message: "Institutional Session Unlocked. Status reverted to OPEN.",
                    details: "Reconciliation and modifications are now permitted."
                });
            }
        );
    });
});

module.exports = router;
