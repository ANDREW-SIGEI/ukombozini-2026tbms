const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const reportService = require('../services/reportService');
const MatrixService = require('../services/MatrixService');

/**
 * 📊 Loan Repayment Tracking Report (Live JSON)
 * GET /api/reports/loan-tracking?month=2026-01
 */
router.get('/loan-tracking', authenticateToken, (req, res) => {
    const { month } = req.query; // Format: YYYY-MM

    if (!month) return res.status(400).json({ error: "Month is required (YYYY-MM)" });

    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    // 1. Get Active Loans
    db.all(`
        SELECT l.*, m.name as member_name, m.phone as member_phone 
        FROM loans l 
        JOIN members m ON l.member_id = m.id 
        WHERE l.status != 'REJECTED'
    `, [], async (err, loans) => {
        if (err) return res.status(500).json({ error: err.message });

        const reportData = [];

        for (const loan of loans) {
            // 2. Calculate Repayments for this month using standardize created_at
            const repayments = await new Promise((resolve) => {
                db.all(`
                    SELECT SUM(amount) as total 
                    FROM transactions 
                    WHERE member_id = ? 
                    AND transaction_type = 'LoanRepayment' 
                    AND date(created_at) BETWEEN date(?) AND date(?)
                `, [loan.member_id, startDate, endDate], (err, rows) => {
                    resolve(rows && rows[0] ? rows[0].total : 0);
                });
            });

            // 3. Determine Expected vs Paid
            const principal = loan.principal_amount || loan.amount || 0;
            const interest = loan.interest_rate || 0;
            const duration = loan.duration_months || 1;
            const calculatedInstallment = (principal * (1 + interest / 100)) / duration;

            const monthlyRepayment = loan.monthly_installment || calculatedInstallment;
            const paidThisMonth = Math.abs(repayments || 0);

            const arrears = Math.max(0, monthlyRepayment - paidThisMonth);

            let status = 'Overdue';
            if (paidThisMonth >= monthlyRepayment) status = 'Paid';
            else if (paidThisMonth > 0) status = 'Partial';

            const totalDue = principal * (1 + interest / 100);

            const totalPaid = await new Promise((resolve) => {
                db.all(`SELECT SUM(amount) as total FROM transactions WHERE member_id = ? AND transaction_type = 'LoanRepayment'`, [loan.member_id], (err, rows) => {
                    resolve(rows && rows[0] ? Math.abs(rows[0].total) : 0);
                });
            });

            const remainingBalance = Math.max(0, totalDue - totalPaid);

            reportData.push({
                id: loan.id,
                memberName: loan.member_name,
                memberPhone: loan.member_phone,
                loanType: loan.loan_type,
                monthlyRepayment,
                paidThisMonth,
                arrears,
                remainingBalance,
                dueDate: loan.next_payment_date || new Date().toISOString(),
                status
            });
        }

        res.json(reportData);
    });
});

/**
 * 📊 Institutional-Grade Contribution Compliance (JSON)
 * GET /api/reports/contribution-compliance?month=2026-01&groupId=all
 */
router.get('/contribution-compliance', authenticateToken, (req, res) => {
    const { month, groupId } = req.query;
    if (!month) return res.status(400).json({ error: "Month is required (YYYY-MM)" });

    let [year, monthNum] = month.split('-');
    const mStr = monthNum.padStart(2, '0');

    // Complex query to fetch member status + relationships + institutional exposure
    const query = `
        SELECT 
            m.id, 
            m.name, 
            m.phone, 
            m.status as memberStatus,
            g.name as groupName,
            g.minMonthlySaving as expectedAmount,
            COALESCE(SUM(t.savings_amount), 0) as contributionAmount,
            CASE 
                WHEN COALESCE(SUM(t.savings_amount), 0) >= g.minMonthlySaving THEN 'Paid'
                WHEN COALESCE(SUM(t.savings_amount), 0) > 0 THEN 'Partial'
                ELSE 'Skipped'
            END as contributionStatus,
            MAX(0, g.minMonthlySaving - COALESCE(SUM(t.savings_amount), 0)) as shortfall,
            
            -- Next of Kin Mapping
            m.next_of_kin_name as nokName,
            m.next_of_kin_phone as nokPhone,
            m.next_of_kin_relationship as nokRelation,
            
            -- Loan Exposure
            m.active_loan_balance as activeLoanBalance,
            
            -- Guarantor Mapping (From Active Loan)
            (SELECT m_g1.name FROM members m_g1 WHERE m_g1.id = l.guarantor1_id) as g1Name,
            (SELECT m_g1.phone FROM members m_g1 WHERE m_g1.id = l.guarantor1_id) as g1Phone,
            (SELECT m_g2.name FROM members m_g2 WHERE m_g2.id = l.guarantor2_id) as g2Name,
            (SELECT m_g2.phone FROM members m_g2 WHERE m_g2.id = l.guarantor2_id) as g2Phone,
            
            -- Risk Propagation: Sum of loans this member is guaranteeing
            (SELECT COALESCE(SUM(principal_amount), 0) FROM loans WHERE (guarantor1_id = m.id OR guarantor2_id = m.id) AND status = 'active') as guaranteedExposure,
            
            -- Aging Logic Simple (Did they pay in the last 2 months?)
            (SELECT COUNT(*) FROM transactions t2 
             WHERE t2.memberId = m.id 
             AND t2.savings_amount > 0 
             AND strftime('%Y-%m', t2.created_at) < ? 
             ORDER BY t2.created_at DESC LIMIT 2) as recentActivityCount

        FROM members m
        JOIN groups g ON m.group_id = g.id
        LEFT JOIN loans l ON m.id = l.member_id AND l.status = 'active'
        LEFT JOIN transactions t ON m.id = t.memberId 
            AND strftime('%m', t.created_at) = ? 
            AND strftime('%Y', t.created_at) = ?
        WHERE (? = 'all' OR g.id = ?)
        GROUP BY m.id
        ORDER BY m.name ASC
    `;

    db.all(query, [month, mStr, year, groupId, groupId], async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Final mapping for UI consumption
        const processed = rows.map(row => ({
            ...row,
            aging: {
                isDelinquent: row.contributionStatus === 'Skipped' && row.recentActivityCount < 2,
                riskLevel: row.activeLoanBalance > 0 && row.contributionStatus === 'Skipped' ? 'CRITICAL' :
                    row.contributionStatus === 'Skipped' ? 'HIGH' :
                        row.contributionStatus === 'Partial' ? 'MEDIUM' : 'LOW'
            }
        }));

        // 🛡️ INSTITUTIONAL GOVERNANCE: Trigger Matrix Penalty Engine
        if (groupId && groupId !== 'all') {
            try {
                await MatrixService.syncCompliancePenalty(groupId, month);
            } catch (pErr) {
                console.error('Matrix Penalty Engine Error:', pErr);
            }
        }

        res.json(processed);
    });
});

/**
 * 📄 Contribution Compliance PDF Report
 * GET /api/reports/contribution-compliance-pdf?month=2026-01&groupId=all
 */
router.get('/contribution-compliance-pdf', authenticateToken, async (req, res) => {
    try {
        const { month, groupId } = req.query;
        const pdfBuffer = await reportService.generateContributionComplianceReport(month, groupId);

        res.setHeader('Content-Disposition', `attachment; filename=contribution_compliance_${month}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate compliance report' });
    }
});

module.exports = router;
