const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/logger');
const { runMTELogic } = require('../services/MTEEngine');

/**
 * 🔄 Institutional Reversal Management API (MTE v2)
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

// POST /api/reversals/approve - Institutional MTE Reversal
router.post('/approve', authenticateToken, isAdmin, async (req, res) => {
    const { request_id } = req.body;
    const approver_id = req.user.id;
    const convertSql = (s) => { let c = 0; return s.replace(/\?/g, () => `$${++c}`); };

    let client = null;
    try {
        if (!db.beginTransaction) return res.status(501).json({ error: "MTE v2 requires PostgreSQL." });

        // 1. Get Request & Transaction Details
        const requestQuery = `
            SELECT rr.*, t.transaction_type, t.memberId, t.sessionId, 
            t.savings_amount, t.withdrawals, t.stl_repayment, t.ltl_repayment
            FROM reversal_requests rr
            JOIN transactions t ON rr.transaction_id = t.id
            WHERE rr.id = ?
        `;

        // Use db.queryStandalone for initial lookup
        const rResult = await db.queryStandalone(convertSql(requestQuery), [request_id]);
        const request = rResult.rows[0];

        if (!request) return res.status(404).json({ error: "Reversal request not found." });
        if (request.status !== 'PENDING') return res.status(400).json({ error: "Request already processed." });
        if (request.requester_id === approver_id) throw new Error("SECURITY ALERT: Cannot approve own request.");

        client = await db.beginTransaction();

        // 2. Mark Original as REVERSED
        await client.query(convertSql("UPDATE transactions SET status = 'REVERSED' WHERE id = ?"), [request.transaction_id]);

        // 3. Determine Reversal Type & Amount
        let mteType = '';
        let mteAmount = 0;

        if (request.savings_amount > 0) {
            mteType = 'SAVINGS_REVERSAL';
            mteAmount = request.savings_amount;
        } else if (request.withdrawals > 0) {
            mteType = 'WITHDRAWAL_REVERSAL';
            mteAmount = request.withdrawals;
        } else if (request.stl_repayment > 0 || request.ltl_repayment > 0) {
            mteType = 'LOAN_REPAYMENT_REVERSAL';
            mteAmount = (request.stl_repayment || 0) + (request.ltl_repayment || 0);
        } else {
            // Fallback to type mapping if exact amounts aren't in those legacy fields
            const typeKey = request.transaction_type.toUpperCase();
            if (typeKey === 'SAVINGS') mteType = 'SAVINGS_REVERSAL';
            else if (typeKey === 'WITHDRAWAL') mteType = 'WITHDRAWAL_REVERSAL';
            else if (typeKey === 'LOAN_REPAYMENT') mteType = 'LOAN_REPAYMENT_REVERSAL';
            else throw new Error(`Unsupported transaction type for MTE reversal: ${request.transaction_type}`);

            // In MTE v2, we should probably look up the amount from ledger_entries if needed, 
            // but here we assume the legacy transaction table has it.
        }

        const txRef = `REV-${request.transaction_id}-${Date.now()}`;

        // 4. Execute MTE Reversal
        await runMTELogic(client, {
            memberId: request.memberId,
            sessionId: request.sessionId || null,
            transaction_type: mteType,
            amount: mteAmount || 0,
            description: `Auto-Reversal: ${request.reason}`,
            txRef
        }, approver_id);

        // 5. Update Request Status
        await client.query(convertSql("UPDATE reversal_requests SET status = 'APPROVED', approver_id = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?"), [approver_id, request_id]);

        await db.commit(client);

        logAudit(`Reversal Approved: TXN ${request.transaction_id}`, 'security', { request_id, approver_id });
        res.json({ success: true, message: "✅ Institutional Reversal Successful. Ledger and Member balances adjusted." });

    } catch (error) {
        if (client) await db.rollback(client);
        console.error('[REVERSAL ERROR]:', error);
        res.status(500).json({ error: error.message });
    }
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
                res.json({ success: true, message: "Session Unlocked." });
            }
        );
    });
});

module.exports = router;
