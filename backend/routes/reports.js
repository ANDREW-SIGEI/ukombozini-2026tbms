const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const reportService = require('../services/reportService');

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
 * 📄 Loan Repayment PDF Report (Institutional Grade)
 * GET /api/reports/loan-repayment-pdf?month=2026-01&groupId=all&type=all
 */
router.get('/loan-repayment-pdf', authenticateToken, async (req, res) => {
    try {
        const { month, groupId, type } = req.query;
        const pdfBuffer = await reportService.generateLoanRepaymentReport(month, groupId, type);

        res.setHeader('Content-Disposition', `attachment; filename=loan_repayment_report_${month}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate institutional report' });
    }
});

module.exports = router;
