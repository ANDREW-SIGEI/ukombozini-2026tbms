const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { checkFreeze } = require('../middleware/guards');
const { logAudit } = require('../utils/logger');
const RiskService = require('../services/RiskService');
const MatrixService = require('../services/MatrixService');

/**
 * 🏢 Company Partnership API
 */

const { runMTELogic } = require('../services/MTEEngine');

/**
 * 🏢 Company Partnership API (MTE v2)
 */

// POST /api/partnership/top-up - Institutional Cash Injection (Administrative Override)
router.post('/top-up', authenticateToken, isAdmin, checkFreeze('GROUP'), async (req, res) => {
    const { groupId, amount, notes } = req.body;
    if (!groupId || !amount) return res.status(400).json({ error: "Group ID and Amount are required" });

    let client = null;
    try {
        // --- MATRIX LIMIT CHECK ---
        const { limit, currentCommitment, tierName } = await MatrixService.getFundingLimit(groupId);
        const existingInvestmentRes = await db.queryStandalone(`SELECT COALESCE(SUM(amount), 0) as total FROM company_investments WHERE group_id = $1 AND status = 'ACTIVE'`, [groupId]);
        const currentInvestment = existingInvestmentRes.rows[0].total;

        if ((currentInvestment + parseFloat(amount)) > limit) {
            return res.status(403).json({
                error: `Matrix Limit Exceeded! Your current Tier (${tierName}) allows a max investment of KES ${limit.toLocaleString()} (based on KES ${currentCommitment.toLocaleString()} deposits).`,
                shortfall: (currentInvestment + parseFloat(amount)) - limit
            });
        }
        // -------------------------


        // Lock group for cash movement
        const lockKey = `mte:group:${groupId}`;
        if (db.acquireLock) await db.acquireLock(lockKey);

        client = await db.beginTransaction();
        const txRef = `TOP-OVR-${groupId}-${Date.now()}`;

        // Company Top-Up logic via MTE
        await runMTELogic(client, {
            memberId: 0,
            sessionId: null,
            transaction_type: 'PARTNER_TOPUP',
            amount,
            description: notes || 'Administrative Top-Up Override',
            txRef,
            groupId
        }, req.user.id);

        await client.query(`INSERT INTO company_investments (group_id, amount, notes, type, status) VALUES ($1, $2, $3, 'TOPUP', 'ACTIVE')`, [groupId, amount, notes]);

        await db.commit(client);
        if (db.releaseLock) await db.releaseLock(lockKey);

        logAudit(`Admin Top-Up Override: ${amount}`, 'FINANCIAL', { groupId, amount }, req.user.id, req.user.name, req);
        res.json({ success: true, message: "✅ Administrative top-up successfully injected." });

    } catch (error) {
        if (client) await db.rollback(client);
        res.status(500).json({ error: error.message });
    }
});

// -------------------------

// -------------------------

// GET /api/partnership/exposure/:groupId
router.get('/exposure/:groupId', authenticateToken, (req, res) => {
    const { groupId } = req.params;

    const query = `
        SELECT 
            (SELECT COALESCE(SUM(amount), 0) FROM company_investments WHERE group_id = ? AND status = 'ACTIVE') as totalTopUp,
            (SELECT COALESCE(SUM(amount), 0) FROM group_commitments WHERE group_id = ? AND status = 'LOCKED') as totalCommitment,
            (SELECT COALESCE(SUM(total_value), 0) FROM financed_products fp JOIN members m ON fp.member_id = m.id WHERE m.group_id = ? AND fp.status = 'ACTIVE') as totalProductFinance,
            (SELECT COUNT(*) FROM members WHERE group_id = ?) as memberCount
    `;

    db.get(query, [groupId, groupId, groupId, groupId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const netExposure = (row.totalTopUp + row.totalProductFinance) - row.totalCommitment;

        db.all(`SELECT * FROM company_investments WHERE group_id = ? ORDER BY created_at DESC LIMIT 5`, [groupId], (err, investments) => {
            res.json({
                portfolio: {
                    totalTopUp: row.totalTopUp,
                    totalProductFinance: row.totalProductFinance,
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
            txRef,
            groupId
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


// POST /api/partnership/request-topup - Submit Top-Up Request (Strict 5x)
router.post('/request-topup', authenticateToken, checkFreeze('GROUP'), async (req, res) => {
    console.log("[PARTNERSHIP] Received top-up request:", req.body);
    console.log("[PARTNERSHIP] User:", req.user);
    const { groupId, commitmentAmount, notes } = req.body;
    if (!groupId || !commitmentAmount) return res.status(400).json({ error: "Group ID and Commitment Amount are required" });

    try {
        const topupAmount = parseFloat(commitmentAmount) * 5; // STRICT 5x MULTIPLIER

        // Insert pending request
        await db.queryStandalone(`
            INSERT INTO topup_requests (group_id, commitment_amount, topup_amount, status, requested_by, notes)
            VALUES ($1, $2, $3, 'PENDING', $4, $5)
        `, [groupId, commitmentAmount, topupAmount, req.user.id, notes]);

        logAudit(`Top-Up Request Submitted: KES ${commitmentAmount} → ${topupAmount}`, 'PARTNERSHIP', { groupId, commitmentAmount, topupAmount }, req.user.id, req.user.name, req);

        res.json({
            success: true,
            message: `✅ Request submitted! Admin must approve KES ${topupAmount.toLocaleString()} top-up (5x your KES ${parseFloat(commitmentAmount).toLocaleString()} deposit).`
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/partnership/approve-topup/:requestId - Admin Approves & Credits TRF
router.post('/approve-topup/:requestId', authenticateToken, isAdmin, async (req, res) => {
    const { requestId } = req.params;

    let client = null;
    try {
        // Fetch request details
        const requestRes = await db.queryStandalone(`
            SELECT * FROM topup_requests WHERE id = $1 AND status = 'PENDING'
        `, [requestId]);

        if (!requestRes.rows || requestRes.rows.length === 0) {
            return res.status(404).json({ error: "Request not found or already processed" });
        }

        const request = requestRes.rows[0];


        client = await db.beginTransaction();
        const txRef = `TOP-APPROVED-${request.group_id}-${Date.now()}`;

        // Credit the group's TRF via MTE
        await runMTELogic(client, {
            memberId: 0, // Company/System
            sessionId: null,
            transaction_type: 'PARTNER_TOPUP',
            amount: request.topup_amount,
            description: `Approved Top-Up (5x KES ${request.commitment_amount})`,
            txRef,
            groupId: request.group_id
        }, req.user.id);

        // Record investment
        await client.query(`
            INSERT INTO company_investments (group_id, amount, notes, type, status) 
            VALUES ($1, $2, $3, 'TOPUP', 'ACTIVE')
        `, [request.group_id, request.topup_amount, `Approved from request #${requestId}`]);

        // Mark request as approved
        await client.query(`
            UPDATE topup_requests 
            SET status = 'APPROVED', approved_by = $1, approved_at = CURRENT_TIMESTAMP 
            WHERE id = $2
        `, [req.user.id, requestId]);

        await db.commit(client);

        logAudit(`Top-Up Approved & TRF Credited: KES ${request.topup_amount}`, 'PARTNERSHIP', { requestId, groupId: request.group_id }, req.user.id, req.user.name, req);

        res.json({ success: true, message: `✅ Top-up approved! KES ${request.topup_amount.toLocaleString()} added to Group TRF.` });

    } catch (error) {
        if (client) await db.rollback(client);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/partnership/reject-topup/:requestId - Admin Rejects Request
router.post('/reject-topup/:requestId', authenticateToken, isAdmin, async (req, res) => {
    const { requestId } = req.params;
    const { reason } = req.body;

    try {
        const result = await db.queryStandalone(`
            UPDATE topup_requests 
            SET status = 'REJECTED', approved_by = $1, approved_at = CURRENT_TIMESTAMP, notes = $2
            WHERE id = $3 AND status = 'PENDING'
        `, [req.user.id, reason || 'Rejected by admin', requestId]);

        if (result.rowsAffected === 0 && result.changes === 0) {
            return res.status(404).json({ error: "Request not found or already processed" });
        }

        logAudit(`Top-Up Request Rejected`, 'PARTNERSHIP', { requestId, reason }, req.user.id, req.user.name, req);

        res.json({ success: true, message: "❌ Top-up request rejected." });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/partnership/pending-requests - Admin views all pending requests
router.get('/pending-requests', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await db.queryStandalone(`
            SELECT r.*, g.name as group_name, u.name as requested_by_name
            FROM topup_requests r
            LEFT JOIN groups g ON r.group_id = g.id
            LEFT JOIN officers u ON r.requested_by = u.id
            WHERE r.status = 'PENDING'
            ORDER BY r.created_at DESC
        `, []);

        res.json(result.rows || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/partnership/matrix-status/:groupId
router.get('/matrix-status/:groupId', authenticateToken, async (req, res) => {
    try {
        const stats = await MatrixService.getGroupTier(req.params.groupId);
        const funding = await MatrixService.getFundingLimit(req.params.groupId);
        res.json({ ...stats, funding });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

// POST /api/partnership/commitment-deposit - Record Group Security Deposit
router.post('/commitment-deposit', authenticateToken, checkFreeze('GROUP'), async (req, res) => {
    const { groupId, amount, notes } = req.body;
    if (!groupId || !amount) return res.status(400).json({ error: "Group ID and Amount are required" });

    let client = null;
    try {

        client = await db.beginTransaction();
        const txRef = `DEP-${groupId}-${Date.now()}`;

        // Record Commitment via MTE (Group Cash Debit vs System Escrow Credit)
        await runMTELogic(client, {
            memberId: 0, // System/Escrow
            sessionId: null,
            transaction_type: 'COMMITMENT_DEPOSIT',
            amount,
            description: `Security Deposit: ${notes || 'Standard Commitment'}`,
            txRef,
            groupId
        }, req.user.id);

        // Record in group_commitments table
        await client.query(`
            INSERT INTO group_commitments (group_id, amount, notes, status) 
            VALUES ($1, $2, $3, 'LOCKED')
        `, [groupId, amount, notes]);

        await db.commit(client);

        logAudit(`Commitment Deposit: KES ${amount}`, 'PARTNERSHIP', { groupId, amount }, req.user.id, req.user.name, req);

        res.json({ success: true, message: `✅ Security deposit of KES ${parseFloat(amount).toLocaleString()} recorded successfully.` });

    } catch (error) {
        if (client) await db.rollback(client);
        res.status(500).json({ error: error.message });
    }
});

router.post('/issue-product', authenticateToken, checkFreeze('GROUP'), async (req, res) => {
    const { memberId, productName, totalValue, commitmentPaid, monthlyInstallment, notes } = req.body;
    if (!memberId || !productName || !totalValue) return res.status(400).json({ error: "Member, Product, and Value are required" });

    let client = null;
    try {
        // Fetch member context for groupId
        const mRes = await db.queryStandalone(`SELECT group_id FROM members WHERE id = ?`, [memberId]);
        if (!mRes.rows || mRes.rows.length === 0) return res.status(404).json({ error: "Member not found" });
        const groupId = mRes.rows[0].group_id;

        client = await db.beginTransaction();
        const txRef = `PRD-${memberId}-${Date.now()}`;

        // Record Product Financing via MTE
        await runMTELogic(client, {
            memberId,
            sessionId: null,
            transaction_type: 'PRODUCTFINANCING',
            amount: totalValue,
            description: `Financed: ${productName} (Deposit: ${commitmentPaid || 0})`,
            txRef,
            groupId
        }, req.user.id);

        // Record in financed_products table for tracking
        await client.query(`
            INSERT INTO financed_products (member_id, product_name, total_value, commitment_paid, monthly_installment, status)
            VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
        `, [memberId, productName, totalValue, commitmentPaid || 0, monthlyInstallment || 0]);

        await db.commit(client);
        logAudit(`Product Issued: ${productName}`, 'PARTNERSHIP', { memberId, productName, totalValue }, req.user.id, req.user.name, req);
        res.json({ success: true, message: `✅ ${productName} (KES ${parseFloat(totalValue).toLocaleString()}) issued successfully.` });

    } catch (error) {
        if (client) await db.rollback(client);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/partnership/commitments/:groupId - View Group Commitment History
router.get('/commitments/:groupId', authenticateToken, async (req, res) => {
    try {
        const result = await db.queryStandalone(`
            SELECT * FROM group_commitments 
            WHERE group_id = ? 
            ORDER BY created_at DESC
        `, [req.params.groupId]);

        res.json(result.rows || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/partnership/products/:groupId - View Group Product Financing History
router.get('/products/:groupId', authenticateToken, async (req, res) => {
    try {
        const result = await db.queryStandalone(`
            SELECT fp.*, m.name as member_name 
            FROM financed_products fp
            JOIN members m ON fp.member_id = m.id
            WHERE m.group_id = ? 
            ORDER BY fp.created_at DESC
        `, [req.params.groupId]);

        res.json(result.rows || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
