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
                    console.log(`[DEBUG] Group Stats for ID: ${groupId} | Total Members: ${countRow?.total} (Defaulted to ${totalMembers})`);
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
    const REGISTRATION_FEE = 200;

    db.serialize(() => {
        // 1. Check if Member has enough savings for the fee
        db.get(`SELECT current_savings FROM members WHERE id = ?`, [memberId], (err, member) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!member) return res.status(404).json({ error: 'Member not found' });

            if (member.current_savings < REGISTRATION_FEE) {
                return res.status(400).json({ error: `Insufficient savings for KES ${REGISTRATION_FEE} registration fee.` });
            }

            // 2. Deduct Fee & Register
            db.run("BEGIN TRANSACTION");

            // Deduct Fee
            db.run(`UPDATE members SET current_savings = current_savings - ? WHERE id = ?`, [REGISTRATION_FEE, memberId]);

            // Register
            db.run(`
                INSERT INTO project_registrations (member_id, group_id, project_type, total_saved, status)
                VALUES (?, ?, ?, 0, 'ACTIVE')
            `, [memberId, groupId, projectType], function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: err.message });
                }

                // Log Transaction
                const regId = this.lastID;
                const txRef = `REG-${regId}-${Date.now()}`;

                db.run(`
                    INSERT INTO transactions (transaction_type, amount, member_id, description, reference)
                    VALUES ('PROJECT_REGISTRATION_FEE', ?, ?, ?, ?)
                `, [REGISTRATION_FEE, memberId, `Registration for ${projectType}`, txRef], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }

                    db.run("COMMIT");
                    res.json({ success: true, message: `Registered successfully. KES ${REGISTRATION_FEE} fee deducted.` });
                });
            });
        });
    });
});

// POST /api/projects/save
router.post('/save', authenticateToken, (req, res) => {
    const { registrationId, amount, date, groupId } = req.body;
    const saveAmount = parseFloat(amount);

    if (isNaN(saveAmount) || saveAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    db.get(`
        SELECT pr.id, pr.total_saved, m.current_savings, m.id as member_id 
        FROM project_registrations pr
        JOIN members m ON pr.member_id = m.id
        WHERE pr.id = ?
    `, [registrationId], (err, record) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!record) return res.status(404).json({ error: 'Registration record not found' });

        // RULE: Project Savings cannot exceed Normal Savings
        // We compare (Current Project Savings + New Amount) vs (Current Normal Savings)
        // Note: Some rules strictly say "Daily Project <= Daily Savings". 
        // Based on "matrix savings not save more than savings", we assume Cumulative Cap for safety.
        // IF the user meant "Daily", this logic might need adjustment, but Cumulative is the standard safe banking rule.

        // Let's check TOTAL project savings across ALL projects for this member first?
        // Or just this specific project? Usually it's Total Risk Exposure.
        // Let's do a stricter check: Sum of ALL active project savings for this member.

        db.get(`SELECT SUM(total_saved) as all_projects FROM project_registrations WHERE member_id = ?`, [record.member_id], (err, row) => {
            const currentTotalProject = row?.all_projects || 0;
            const newTotalProject = currentTotalProject + saveAmount;

            if (newTotalProject > record.current_savings) {
                return res.status(400).json({
                    error: `Limit Exceeded. Total project savings (KES ${newTotalProject}) cannot exceed Normal Savings (KES ${record.current_savings}).`
                });
            }

            // Proceed to Save
            db.run(`
                INSERT INTO project_savings (registration_id, amount, date)
                VALUES (?, ?, ?)
            `, [registrationId, saveAmount, date], function (err) {
                if (err) return res.status(500).json({ error: err.message });

                // Update Total
                db.run(`UPDATE project_registrations SET total_saved = total_saved + ? WHERE id = ?`, [saveAmount, registrationId]);

                res.json({ success: true, message: 'Savings recorded successfully' });
            });
        });
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

// POST /api/projects/withdraw
router.post('/withdraw', authenticateToken, (req, res) => {
    const { registrationId, amount, date, reason } = req.body;
    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
        return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }

    db.get(`
        SELECT pr.id, pr.total_saved, pr.project_type, m.id as member_id, m.name as member_name
        FROM project_registrations pr
        JOIN members m ON pr.member_id = m.id
        WHERE pr.id = ?
    `, [registrationId], (err, record) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!record) return res.status(404).json({ error: 'Project registration not found' });

        if (record.total_saved < withdrawAmount) {
            return res.status(400).json({ error: `Insufficient project funds. Available: KES ${record.total_saved.toLocaleString()}` });
        }

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // 1. Update Project Balance
            db.run(`UPDATE project_registrations SET total_saved = total_saved - ? WHERE id = ?`, [withdrawAmount, registrationId], (err) => {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }

                // 2. Log withdrawal in project_savings (as negative or specialized record)
                // Note: project_savings table usually stores increments. We can store negative for audit.
                db.run(`INSERT INTO project_savings (registration_id, amount, date) VALUES (?, ?, ?)`,
                    [registrationId, -withdrawAmount, date || new Date().toISOString()]);

                // 3. Log in Main Ledger (MTE Integration)
                const txRef = `PRJ-WTH-${record.id}-${Date.now()}`;
                db.run(`
                    INSERT INTO transactions (
                        transaction_type, amount, member_id, description, reference, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?)
                `, [
                    `PROJECT_WITHDRAWAL_${record.project_type}`,
                    withdrawAmount,
                    record.member_id,
                    `Withdrawal from ${record.project_type}: ${reason || 'Personal Use'}`,
                    txRef,
                    date || new Date().toISOString()
                ], (err) => {
                    if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }

                    db.run("COMMIT");
                    res.json({
                        success: true,
                        message: `Withdrew KES ${withdrawAmount.toLocaleString()} from ${record.project_type} successfully.`,
                        reference: txRef
                    });
                });
            });
        });
    });
});

module.exports = router;
