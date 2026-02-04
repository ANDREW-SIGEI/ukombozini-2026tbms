const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/projects/group-stats/:groupId
router.get('/group-stats/:groupId', authenticateToken, (req, res) => {
    const groupId = req.params.groupId;

    // 1. Get Project Pools (Education/Agriculture)
    db.all(`
        SELECT 
            pr.project_type, 
            COALESCE(SUM(ps.amount), 0) as total_pool
        FROM project_savings ps
        JOIN project_registrations pr ON ps.registration_id = pr.id
        WHERE pr.group_id = ?
        GROUP BY pr.project_type
    `, [groupId], (err, pools) => {
        if (err) return res.status(500).json({ error: err.message });

        const eduPool = pools.find(p => p.project_type === 'EDUCATION')?.total_pool || 0;
        const agriPool = pools.find(p => p.project_type === 'AGRICULTURE')?.total_pool || 0;
        const totalProjectPool = eduPool + agriPool;

        // 2. Get Normal Table Savings
        db.get(`
            SELECT COALESCE(SUM(current_savings), 0) as total_savings
            FROM members
            WHERE group_id = ?
        `, [groupId], (err, savingsRow) => {
            if (err) return res.status(500).json({ error: err.message });
            const totalNormalSavings = savingsRow?.total_savings || 0;

            // 3. Get Active Loans (Exposure)
            db.get(`
                SELECT COALESCE(SUM(active_loan_balance), 0) as active_loans
                FROM members
                WHERE group_id = ?
            `, [groupId], (err, loansRow) => {
                const totalActiveLoans = loansRow?.active_loans || 0;

                // 4. Calculate Liquidity & Health
                const totalCash = totalNormalSavings + totalProjectPool;
                const availableCash = totalCash - totalActiveLoans;
                const utilization = totalCash > 0 ? (totalActiveLoans / totalCash) * 100 : 0;

                // Payout Obligation (Project Savings * 1.5)
                const payoutObligation = totalProjectPool * 1.5;

                // Liquidity Alert Logic
                let liquidityAlert = 'SAFE';
                if (availableCash < payoutObligation) liquidityAlert = 'WARNING';
                if (availableCash < (payoutObligation * 0.5)) liquidityAlert = 'CRITICAL';

                // Participation Rate
                db.get(`SELECT COUNT(*) as total FROM members WHERE group_id = ?`, [groupId], (err, countRow) => {
                    const totalMembers = countRow?.total || 1;
                    db.get(`SELECT COUNT(DISTINCT member_id) as active FROM project_registrations WHERE group_id = ?`, [groupId], (err, activeRow) => {
                        const activeMembers = activeRow?.active || 0;
                        const participationRate = (activeMembers / totalMembers) * 100;

                        res.json({
                            education_pool: eduPool,
                            agriculture_pool: agriPool,
                            total_project_pool: totalProjectPool,
                            total_table_savings: totalNormalSavings,
                            total_active_loans: totalActiveLoans,
                            payout_obligation: payoutObligation,
                            available_cash: availableCash,
                            liquidity_alert: liquidityAlert,
                            participation_rate: participationRate,
                            loan_utilization: utilization
                        });
                    });
                });
            });
        });
    });
});

// GET /api/projects/member-status/:memberId
router.get('/member-status/:memberId', authenticateToken, (req, res) => {
    const memberId = req.params.memberId;
    db.all(`
        SELECT * FROM project_registrations WHERE member_id = ?
    `, [memberId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET /api/projects/member-day-limit/:memberId/:date
router.get('/member-day-limit/:memberId/:date', authenticateToken, (req, res) => {
    const { memberId, date } = req.params;

    // 1. Get Today's Normal Savings for Member
    const month = new Date(date).getMonth() + 1; // 1-12
    const year = new Date(date).getFullYear();

    // Ideally, we sum transactions for the specific date. 
    // Assuming 'created_at' stores ISO string
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    db.get(`
        SELECT COALESCE(SUM(savings_amount), 0) as daily_savings
        FROM transactions
        WHERE memberId = ? 
        AND created_at BETWEEN ? AND ?
    `, [memberId, startOfDay, endOfDay], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const dailyLimit = row?.daily_savings || 0;

        // 2. Get Already Saved in Projects Today
        db.get(`
            SELECT COALESCE(SUM(ps.amount), 0) as project_saved
            FROM project_savings ps
            JOIN project_registrations pr ON ps.registration_id = pr.id
            WHERE pr.member_id = ?
            AND ps.date = ?
        `, [memberId, date], (err, projRow) => {
            const alreadySaved = projRow?.project_saved || 0;
            const remaining = Math.max(0, dailyLimit - alreadySaved);

            res.json({
                daily_limit: dailyLimit,
                already_saved: alreadySaved,
                remaining_limit: remaining
            });
        });
    });
});

// POST /api/projects/register
router.post('/register', authenticateToken, (req, res) => {
    const { memberId, projectType, groupId } = req.body;
    db.run(`
        INSERT INTO project_registrations (member_id, group_id, project_type, total_saved, status)
        VALUES (?, ?, ?, 0, 'ACTIVE')
    `, [memberId, groupId, projectType], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Registration Successful' });
    });
});

// POST /api/projects/save
router.post('/save', authenticateToken, (req, res) => {
    const { registrationId, amount, date, groupId } = req.body;

    db.run(`
        INSERT INTO project_savings (registration_id, amount, date)
        VALUES (?, ?, ?)
    `, [registrationId, amount, date], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Update Total
        db.run(`UPDATE project_registrations SET total_saved = total_saved + ? WHERE id = ?`, [amount, registrationId]);

        // Update Group Cash
        // (Assuming you have a cash_control table update logic here or similar)

        res.json({ success: true });
    });
});

// GET /api/projects/group-matrix/:groupId
router.get('/group-matrix/:groupId', authenticateToken, (req, res) => {
    const groupId = req.params.groupId;
    db.all(`
        SELECT 
            m.id, m.name, m.phone, m.current_savings as normal_savings,
            (SELECT COALESCE(SUM(total_saved), 0) FROM project_registrations WHERE member_id = m.id AND project_type = 'EDUCATION') as edu_saved,
            (SELECT COALESCE(SUM(total_saved), 0) FROM project_registrations WHERE member_id = m.id AND project_type = 'AGRICULTURE') as agri_saved
        FROM members m
        WHERE m.group_id = ?
    `, [groupId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
