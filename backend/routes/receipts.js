const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const { logAudit } = require('../utils/logger');

/**
 * 🧾 Digital Receipting Engine
 */

router.get('/:transactionId', authenticateToken, (req, res) => {
    const { transactionId } = req.params;

    const query = `
        SELECT t.*, m.name as member_name, m.national_id, g.name as group_name, o.name as officer_name
        FROM transactions t
        JOIN members m ON t.memberId = m.id
        JOIN groups g ON m.groupId = g.id
        LEFT JOIN cash_sessions s ON t.sessionId = s.id
        LEFT JOIN officers o ON s.officer_id = o.id
        WHERE t.id = ?
    `;

    db.get(query, [transactionId], (err, trans) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!trans) return res.status(404).json({ error: "Transaction record not found." });

        const doc = new PDFDocument({ margin: 50, size: 'A5' }); // Professional compact size
        const filename = `Receipt_${transactionId}.pdf`;

        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // Header Branding
        doc.rect(0, 0, doc.page.width, 80).fill('#1a5f2a');
        doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('UKOMBOZI TBMS', 50, 25);
        doc.fontSize(10).font('Helvetica').text('Official Digital Transaction Receipt', 50, 48);
        doc.fontSize(8).text('PROMOTING FINANCIAL INCLUSION', 50, 60);

        // Receipt Meta
        doc.fillColor('#333333').fontSize(10).font('Helvetica-Bold').text('RECEIPT NO:', 300, 100);
        doc.font('Helvetica').text(trans.id.toString(), 370, 100);
        doc.font('Helvetica-Bold').text('DATE:', 300, 115);
        doc.font('Helvetica').text(new Date(trans.created_at || Date.now()).toLocaleString(), 370, 115);

        // Member Details
        doc.rect(50, 130, 395, 1).fill('#eeeeee');
        doc.fillColor('#1a5f2a').fontSize(12).font('Helvetica-Bold').text('MEMBER DETAILS', 50, 140);
        doc.fillColor('#333333').fontSize(10).font('Helvetica-Bold').text('Name:', 50, 160);
        doc.font('Helvetica').text(trans.member_name, 120, 160);
        doc.font('Helvetica-Bold').text('Group:', 50, 175);
        doc.font('Helvetica').text(trans.group_name || 'N/A', 120, 175);
        doc.font('Helvetica-Bold').text('ID No:', 50, 190);
        doc.font('Helvetica').text(trans.national_id || 'N/A', 120, 190);

        // Transaction Details
        doc.rect(50, 210, 395, 1).fill('#eeeeee');
        doc.fillColor('#1a5f2a').fontSize(12).font('Helvetica-Bold').text('TRANSACTION SUMMARY', 50, 220);

        doc.rect(50, 240, 395, 100).fill('#f9f9f9');
        doc.fillColor('#333333').fontSize(10).font('Helvetica-Bold').text('Type:', 65, 255);
        doc.font('Helvetica').text(trans.transaction_type, 140, 255);
        doc.font('Helvetica-Bold').text('Description:', 65, 275);
        doc.font('Helvetica').text(trans.description || '-', 140, 275);

        // Amount calculation logic
        const amount = trans.savings_amount || trans.loans_issued || trans.stl_repayment || trans.ltl_repayment || trans.withdrawals || 0;

        doc.fontSize(14).font('Helvetica-Bold').text('AMOUNT:', 65, 305);
        doc.fillColor('#1a5f2a').text(`KES ${Math.abs(amount).toLocaleString()}`, 140, 305);

        // Footer
        doc.rect(50, 360, 395, 1).fill('#eeeeee');
        doc.fillColor('#777777').fontSize(8).font('Helvetica').text('Processed by UKOMBOZI System | Secure Digital Ledger', 50, 375, { align: 'center' });
        doc.text('This is an electronically generated document. No physical signature is required.', 50, 388, { align: 'center' });

        // Watermark
        doc.opacity(0.1).fontSize(40).font('Helvetica-Bold').fillColor('#1a5f2a').text('VERIFIED', 100, 250, { rotation: 45 });

        doc.end();

        logAudit(`Receipt Downloaded: ${transactionId}`, 'financial', { transactionId, member: trans.member_name }, req.user.id, req.user.name, req);
    });
});

router.get('/loan-statement/:loanId', authenticateToken, (req, res) => {
    const { loanId } = req.params;

    const query = `
        SELECT l.*, m.name as member_name, m.national_id, g.name as group_name,
               (SELECT JSON_GROUP_ARRAY(JSON_OBJECT('date', date, 'amount', amount, 'type', transaction_type))
                FROM transactions 
                WHERE loan_id = l.id) as repayments
        FROM loans l
        JOIN members m ON l.member_id = m.id
        JOIN groups g ON m.groupId = g.id
        WHERE l.id = ?
    `;

    db.get(query, [loanId], (err, loan) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!loan) return res.status(404).json({ error: "Loan not found." });

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-disposition', `attachment; filename="Loan_Statement_${loanId}.pdf"`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        // Header
        doc.rect(0, 0, doc.page.width, 100).fill('#1a365d');
        doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('UKOMBOZI TBMS', 50, 30);
        doc.fontSize(12).font('Helvetica').text('Official Loan Statement', 50, 65);

        // Member Info
        doc.fillColor('#333333').fontSize(14).font('Helvetica-Bold').text('LOAN SUMMARY', 50, 130);
        doc.fontSize(10).font('Helvetica').text(`Member: ${loan.member_name}`, 50, 150);
        doc.text(`Loan ID: #${loan.id} (${loan.loan_type})`, 50, 165);
        doc.text(`Date Issued: ${new Date(loan.date_issued).toLocaleDateString()}`, 50, 180);

        // Financials
        doc.rect(350, 140, 200, 80).fill('#f7fafc');
        doc.fillColor('#2d3748').fontSize(10).font('Helvetica-Bold').text('Principal:', 360, 155);
        doc.text(`KES ${loan.principal_amount.toLocaleString()}`, 450, 155);
        doc.text('Interest:', 360, 175);
        doc.text(`${loan.interest_rate}%`, 450, 175);
        const totalDue = loan.principal_amount * (1 + loan.interest_rate / 100);
        doc.text('Total Due:', 360, 195);
        doc.text(`KES ${totalDue.toLocaleString()}`, 450, 195);

        // Repayment Table
        doc.fillColor('#333333').fontSize(14).font('Helvetica-Bold').text('REPAYMENT HISTORY', 50, 250);
        const repayments = JSON.parse(loan.repayments || '[]');

        let y = 280;
        doc.fontSize(10).font('Helvetica-Bold').text('Date', 50, y);
        doc.text('Type', 150, y);
        doc.text('Amount', 300, y);
        doc.text('Status', 450, y);
        doc.rect(50, y + 15, 500, 1).fill('#e2e8f0');

        y += 30;
        doc.font('Helvetica');
        let totalPaid = 0;
        repayments.forEach(r => {
            doc.text(new Date(r.date).toLocaleDateString(), 50, y);
            doc.text(r.type, 150, y);
            doc.text(`KES ${Math.abs(r.amount).toLocaleString()}`, 300, y);
            doc.text('VERIFIED', 450, y);
            totalPaid += Math.abs(r.amount);
            y += 20;
        });

        // Balance Section
        doc.rect(50, y + 20, 500, 40).fill('#edf2f7');
        doc.fillColor('#2d3748').fontSize(12).font('Helvetica-Bold').text('Current Outstanding Balance:', 70, y + 35);
        doc.text(`KES ${(totalDue - totalPaid).toLocaleString()}`, 350, y + 35);

        doc.end();
        logAudit(`Loan Statement Downloaded: ${loanId}`, 'financial', { loanId, member: loan.member_name }, req.user.id, req.user.name, req);
    });
});

module.exports = router;
