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

const { runMTELogic } = require('../services/MTEEngine');

/**
 * 🏢 Company Partnership API (MTE v2)
 */

// POST /api/partnership/top-up - Institutional Cash Injection
router.post('/top-up', authenticateToken, isAdmin, checkFreeze('GROUP'), async (req, res) => {
    const { groupId, amount, notes } = req.body;
    if (!groupId || !amount) return res.status(400).json({ error: "Group ID and Amount are required" });

    let client = null;
    try {
        if (!db.beginTransaction) return res.status(501).json({ error: 'MTE v2 requires PostgreSQL.' });

        // Lock group for cash movement
        const lockKey = `mte:group:${groupId}`;
        if (db.acquireLock) await db.acquireLock(lockKey);

        client = await db.beginTransaction();
        const txRef = `TOP-${groupId}-${Date.now()}`;

        // Company Top-Up logic via MTE
        // Note: For Top-Ups, we use a systemic member/surrogate if needed, 
        // but here we map it as a Group Cash Debit and Partner Investment Credit.
        await runMTELogic(client, {
            memberId: 0, // Systemic/Company surrogate
            sessionId: null,
            transaction_type: 'PARTNER_TOPUP',
            amount,
            description: notes || 'Strategic Company Top-Up',
            txRef
        }, req.user.id);

        await client.query(`INSERT INTO company_investments (group_id, amount, notes, type) VALUES ($1, $2, $3, 'TOPUP')`, [groupId, amount, notes]);

        await db.commit(client);
        if (db.releaseLock) await db.releaseLock(lockKey);

        logAudit(`Company Top-Up: ${amount}`, 'FINANCIAL', { groupId, amount }, req.user.id, req.user.name, req);
        res.json({ success: true, message: "✅ Top-up injected and ledger balanced." });

    } catch (error) {
        if (client) await db.rollback(client);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/partnership/commitment-deposit - Secure Group Escrow
router.post('/commitment-deposit', authenticateToken, isAdmin, checkFreeze('GROUP'), async (req, res) => {
    const { groupId, amount, notes } = req.body;
    if (!groupId || !amount) return res.status(400).json({ error: "Group ID and Amount are required" });

    let client = null;
    try {
        if (!db.beginTransaction) return res.status(501).json({ error: 'MTE v2 requires PostgreSQL.' });

        client = await db.beginTransaction();
        const txRef = `COM-${groupId}-${Date.now()}`;

        await runMTELogic(client, {
            memberId: 0,
            sessionId: null,
            transaction_type: 'COMMITMENT_DEPOSIT',
            amount,
            description: notes || 'Group Commitment Deposit',
            txRef
        }, req.user.id);

        await client.query(`INSERT INTO group_commitments (group_id, amount, notes) VALUES ($1, $2, $3)`, [groupId, amount, notes]);

        await db.commit(client);
        res.json({ success: true, message: "✅ Commitment deposit recorded in Escrow." });

    } catch (error) {
        if (client) await db.rollback(client);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/partnership/issue-product - Asset Financing
router.post('/issue-product', authenticateToken, isAdmin, checkFreeze('GROUP'), async (req, res) => {
    const { memberId, productName, totalValue, commitmentPaid, monthlyInstallment } = req.body;
    if (!memberId || !productName || !totalValue) return res.status(400).json({ error: "Missing required fields" });

    let client = null;
    try {
        if (!db.beginTransaction) return res.status(501).json({ error: 'MTE v2 requires PostgreSQL.' });

        client = await db.beginTransaction();
        const txRef = `PRD-${memberId}-${Date.now()}`;

        // Product issuance: Member Asset Balance Debit vs System Inventory Credit
        await runMTELogic(client, {
            memberId,
            sessionId: null,
            transaction_type: 'PRODUCTFINANCING',
            amount: totalValue,
            description: `Financed Product: ${productName}`,
            txRef
        }, req.user.id);

        await client.query(`INSERT INTO financed_products (member_id, product_name, total_value, commitment_paid, monthly_installment) VALUES ($1, $2, $3, $4, $5)`,
            [memberId, productName, totalValue, commitmentPaid, monthlyInstallment]);

        await db.commit(client);
        res.json({ success: true, message: "✅ Product financed and asset ledger updated." });

    } catch (error) {
        if (client) await db.rollback(client);
        res.status(500).json({ error: error.message });
    }
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

// POST /api/partnership/apply-offset - Institutional Debt Clearing
router.post('/apply-offset', authenticateToken, isAdmin, checkFreeze('GROUP'), async (req, res) => {
    const { memberId, amount, notes } = req.body;
    if (!memberId || !amount) return res.status(400).json({ error: "Member ID and Amount are required" });

    let client = null;
    try {
        if (!db.beginTransaction) return res.status(501).json({ error: 'MTE v2 requires PostgreSQL.' });

        // Get member context
        const mRes = await db.queryStandalone(`SELECT group_id, active_loan_balance FROM members WHERE id = $1`, [memberId]);
        const member = mRes.rows[0];
        if (!member) return res.status(404).json({ error: "Member not found" });

        const groupId = member.group_id;

        // Verify escrow balance
        const bRes = await db.queryStandalone(`SELECT COALESCE(SUM(amount), 0) as balance FROM group_commitments WHERE group_id = $1`, [groupId]);
        if (bRes.rows[0].balance < amount) return res.status(400).json({ error: "Insufficient group commitment (Escrow) balance" });

        client = await db.beginTransaction();
        const txRef = `OFF-${memberId}-${Date.now()}`;

        // Partnership Offset: Member Loan Balance Credit vs System Escrow Debit
        await runMTELogic(client, {
            memberId,
            sessionId: null,
            transaction_type: 'PARTNER_OFFSET',
            amount,
            description: `Escrow Offset: ${notes || 'Debt Clearance'}`,
            txRef
        }, req.user.id);

        await client.query(`INSERT INTO group_commitments (group_id, amount, notes, status) VALUES ($1, $2, $3, 'OFFSET')`,
            [groupId, -amount, `OFFSET: Clear debt for Member #${memberId}. ${notes || ''}`]);

        await db.commit(client);
        logAudit(`Debt Offset: ${amount}`, 'FINANCIAL', { memberId, groupId, amount }, req.user.id, req.user.name, req);
        res.json({ success: true, message: "✅ Debt offset successfully applied via Escrow." });

    } catch (error) {
        if (client) await db.rollback(client);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/partnership/stats - Institutional Capital Metrics
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const stats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    (SELECT COALESCE(SUM(amount), 0) FROM company_investments WHERE status = 'ACTIVE') as totalInjected,
                    (SELECT COALESCE(SUM(amount), 0) FROM group_commitments WHERE status = 'LOCKED') as activeCommitments,
                    (SELECT COALESCE(SUM(total_value), 0) FROM financed_products WHERE status = 'ACTIVE') as productFinanceVolume,
                    (SELECT COALESCE(SUM(active_loan_balance), 0) FROM members) as pendingRepayments
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
