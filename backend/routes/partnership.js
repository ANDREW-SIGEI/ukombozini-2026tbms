const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { checkFreeze } = require('../middleware/guards');
const { logAudit } = require('../utils/logger');
const RiskService = require('../services/RiskService');

/**
 * 🏢 Company Partnership API
 */

// POST /api/partnership/top-up
router.post('/top-up', authenticateToken, isAdmin, checkFreeze('GROUP'), (req, res) => {
    const { groupId, amount, notes } = req.body;
    if (!groupId || !amount) return res.status(400).json({ error: "Group ID and Amount are required" });

    db.run(`INSERT INTO company_investments (group_id, amount, notes, type) VALUES (?, ?, ?, 'TOPUP')`,
        [groupId, amount, notes], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            logAudit(`Company Top-Up: ${amount}`, 'FINANCIAL', { groupId, amount, notes }, req.user.id, req.user.name, req);
            res.json({ success: true, id: this.lastID, message: "Top-up injected successfully" });
        }
    );
});

// POST /api/partnership/commitment-deposit
router.post('/commitment-deposit', authenticateToken, isAdmin, checkFreeze('GROUP'), (req, res) => {
    const { groupId, amount, notes } = req.body;
    if (!groupId || !amount) return res.status(400).json({ error: "Group ID and Amount are required" });

    db.run(`INSERT INTO group_commitments (group_id, amount, notes) VALUES (?, ?, ?)`,
        [groupId, amount, notes], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            logAudit(`Commitment Deposit: ${amount}`, 'FINANCIAL', { groupId, amount, notes }, req.user.id, req.user.name, req);
            res.json({ success: true, id: this.lastID, message: "Commitment deposit recorded" });
        }
    );
});

// POST /api/partnership/issue-product
router.post('/issue-product', authenticateToken, isAdmin, checkFreeze('GROUP'), (req, res) => {
    const { memberId, productName, totalValue, commitmentPaid, monthlyInstallment } = req.body;
    if (!memberId || !productName || !totalValue) return res.status(400).json({ error: "Missing required fields" });

    db.run(`INSERT INTO financed_products (member_id, product_name, total_value, commitment_paid, monthly_installment) VALUES (?, ?, ?, ?, ?)`,
        [memberId, productName, totalValue, commitmentPaid, monthlyInstallment], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            logAudit(`Product Issued: ${productName}`, 'FINANCIAL', { memberId, totalValue }, req.user.id, req.user.name, req);
            res.json({ success: true, id: this.lastID, message: "Product financed successfully" });
        }
    );
});

// GET /api/partnership/exposure/:groupId
router.get('/exposure/:groupId', authenticateToken, (req, res) => {
    const { groupId } = req.params;

    const query = `
        SELECT 
            (SELECT COALESCE(SUM(amount), 0) FROM company_investments WHERE group_id = ? AND status = 'ACTIVE') as totalTopUp,
            (SELECT COALESCE(SUM(amount), 0) FROM group_commitments WHERE group_id = ? AND status = 'LOCKED') as totalCommitment,
            (SELECT COUNT(*) FROM members WHERE group_id = ?) as memberCount
    `;

    db.get(query, [groupId, groupId, groupId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const netExposure = row.totalTopUp - row.totalCommitment;

        db.all(`SELECT * FROM company_investments WHERE group_id = ? ORDER BY created_at DESC LIMIT 5`, [groupId], (err, investments) => {
            res.json({
                portfolio: {
                    totalTopUp: row.totalTopUp,
                    investments: investments
                },
                security: {
                    totalCommitment: row.totalCommitment
                },
                netExposure: netExposure,
                memberCount: row.memberCount
            });
        });
    });
});

// GET /api/partnership/score/:groupId
router.get('/score/:groupId', authenticateToken, async (req, res) => {
    const { groupId } = req.params;

    try {
        const riskData = await RiskService.evaluateGroupRisk(groupId);
        const score = 100 - riskData.score;

        let label = 'STANDARD';
        if (score >= 80) label = 'EXCELLENT';
        if (score <= 40) label = 'RISKY';

        const reasons = riskData.alerts.map(a => a.msg);
        if (score >= 80) reasons.push("Consistent repayment history detected.");
        if (score >= 90) reasons.push("Strong liquidity vs commitment ratio.");

        res.json({ score, label, reasons });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/partnership/apply-offset
router.post('/apply-offset', authenticateToken, isAdmin, checkFreeze('GROUP'), (req, res) => {
    const { memberId, amount, notes } = req.body;
    if (!memberId || !amount) return res.status(400).json({ error: "Member ID and Amount are required" });

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        db.get("SELECT group_id FROM members WHERE id = ?", [memberId], (err, member) => {
            if (err || !member) {
                db.run("ROLLBACK");
                return res.status(404).json({ error: "Member not found" });
            }

            const groupId = member.group_id;

            db.get("SELECT COALESCE(SUM(amount), 0) as balance FROM group_commitments WHERE group_id = ? AND status = 'LOCKED'", [groupId], (err, row) => {
                if (row.balance < amount) {
                    db.run("ROLLBACK");
                    return res.status(400).json({ error: "Insufficient group commitment balance" });
                }

                db.run(`INSERT INTO group_commitments (group_id, amount, notes, status) VALUES (?, ?, ?, 'OFFSET')`,
                    [groupId, -amount, `OFFSET: Clear debt for Member #${memberId}. ${notes || ''}`], (err) => {
                        if (err) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: err.message });
                        }

                        db.run("UPDATE members SET active_loan_balance = active_loan_balance - ? WHERE id = ?", [amount, memberId], (err) => {
                            if (err) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ error: err.message });
                            }

                            db.run("COMMIT");
                            logAudit(`Debt Offset: ${amount}`, 'FINANCIAL', { memberId, groupId, amount }, req.user.id, req.user.name, req);
                            res.json({ success: true, message: "Debt offset successfully applied" });
                        });
                    }
                );
            });
        });
    });
});

module.exports = router;
