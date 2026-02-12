const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { logAudit } = require('../utils/logger');

/**
 * 🧾 Digital Receipting Engine - Premium Refinement
 */

router.get('/:transactionId', authenticateToken, async (req, res) => {
    const { transactionId } = req.params;

    const query = `
        SELECT t.*, m.name as member_name, m.national_id, g.name as group_name, o.name as officer_name
        FROM transactions t
        JOIN members m ON t.memberId = m.id
        JOIN groups g ON m.groupId = g.id
        LEFT JOIN meeting_sessions s ON t.sessionId = s.id
        LEFT JOIN officers o ON s.officerId = o.id
        WHERE t.id = ?
    `;

    db.get(query, [transactionId], async (err, trans) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!trans) return res.status(404).json({ error: "Transaction record not found." });

        try {
            const doc = new PDFDocument({ margin: 40, size: 'A5' });
            const filename = `Receipt_${transactionId}.pdf`;

            res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-type', 'application/pdf');

            doc.pipe(res);

            // --- PREMIUM BRANDING HEADER ---
            doc.rect(0, 0, doc.page.width, 100).fill('#76BC21'); // Safaricom Green
            doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('UKOMBOZINI TBMS', 40, 30);
            doc.fontSize(10).font('Helvetica').text('INSTITUTIONAL FINANCIAL SERVICES', 40, 58);
            doc.rect(40, 75, 120, 1.5).fill('#ffffff');

            doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold').text('OFFICIAL DIGITAL RECEIPT', 40, 82, { align: 'left' });

            // --- RECEIPT META (Top Right) ---
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('REF NO:', 280, 40);
            doc.font('Helvetica').text(trans.txRef || trans.id.toString(), 340, 40);
            doc.font('Helvetica-Bold').text('DATE:', 280, 55);
            doc.font('Helvetica').text(new Date(trans.created_at || Date.now()).toLocaleDateString(), 340, 55);
            doc.font('Helvetica-Bold').text('TIME:', 280, 70);
            doc.font('Helvetica').text(new Date(trans.created_at || Date.now()).toLocaleTimeString(), 340, 70);

            // --- MEMBER INFORMATION ---
            doc.moveDown(5);
            doc.fillColor('#76BC21').fontSize(11).font('Helvetica-Bold').text('MEMBER IDENTIFICATION', 40, 120);
            doc.rect(40, 135, 340, 1).fill('#f0f0f0');

            doc.fillColor('#666666').fontSize(9).font('Helvetica-Bold').text('NAME:', 40, 145);
            doc.fillColor('#1a1a1a').font('Helvetica').text(trans.member_name.toUpperCase(), 110, 145);

            doc.fillColor('#666666').font('Helvetica-Bold').text('GROUP:', 40, 160);
            doc.fillColor('#1a1a1a').font('Helvetica').text(trans.group_name || 'N/A', 110, 160);

            doc.fillColor('#666666').font('Helvetica-Bold').text('ID NO:', 40, 175);
            doc.fillColor('#1a1a1a').font('Helvetica').text(trans.national_id || 'N/A', 110, 175);

            // --- TRANSACTION SUMMARY ---
            doc.fillColor('#76BC21').fontSize(11).font('Helvetica-Bold').text('TRANSACTION SUMMARY', 40, 205);
            doc.rect(40, 220, 340, 1).fill('#f0f0f0');

            doc.rect(40, 230, 335, 85).fill('#f9fafb').stroke('#f3f4f6');

            doc.fillColor('#4b5563').fontSize(9).font('Helvetica-Bold').text('TYPE:', 55, 245);
            doc.fillColor('#111827').font('Helvetica-Bold').text(trans.transaction_type.replace(/_/g, ' '), 130, 245);

            doc.fillColor('#4b5563').font('Helvetica-Bold').text('DESCRIPTION:', 55, 265);
            doc.fillColor('#111827').font('Helvetica').text(trans.description || 'Standard Transaction', 130, 265, { width: 230 });

            // --- AMOUNT HIGHLIGHT ---
            const finalAmount = trans.amount || trans.savings_amount || trans.loans_issued || trans.stl_repayment || trans.ltl_repayment || trans.withdrawals || 0;

            doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text('TOTAL AMOUNT:', 55, 290);
            doc.fillColor('#76BC21').fontSize(16).text(`KSH ${Math.abs(finalAmount).toLocaleString()}.00`, 180, 290);

            // --- OFFICER & VERIFICATION ---
            doc.fillColor('#9ca3af').fontSize(8).font('Helvetica').text('SERVED BY:', 40, 335);
            doc.fillColor('#4b5563').font('Helvetica-Bold').text(trans.officer_name || 'SYSTEM AUTOMATION', 40, 345);

            // --- QR CODE VERIFICATION ---
            const qrData = `UKOMBOZI-VERIFY|${trans.id}|${trans.txRef}|${finalAmount}`;
            const qrCodeUrl = await QRCode.toDataURL(qrData);
            doc.image(qrCodeUrl, 310, 330, { width: 70 });
            doc.fillColor('#9ca3af').fontSize(6).text('SCAN TO VERIFY', 315, 405);

            // --- FOOTER ---
            doc.rect(40, 420, 340, 1).fill('#eeeeee');
            doc.fillColor('#9ca3af').fontSize(7).font('Helvetica-Bold').text('UKOMBOZINI INVESTMENT FINANCIAL CONTROL', 0, 435, { align: 'center' });
            doc.font('Helvetica').text('Secure Digital Transaction Record. No Signature Required.', { align: 'center' });
            doc.text(`Timestamp: ${new Date().toISOString()}`, { align: 'center' });

            // Watermark (Light Transparency)
            doc.save();
            doc.opacity(0.03);
            doc.fontSize(50).font('Helvetica-Bold').fillColor('#76BC21').text('VERIFIED', 60, 250, { rotation: 45 });
            doc.restore();

            doc.end();
            logAudit(`Premium Receipt Downloaded: ${transactionId}`, 'financial', { transactionId, member: trans.member_name }, req.user.id, req.user.name, req);

        } catch (err) {
            console.error("Receipt PDF Error:", err);
            res.status(500).json({ error: "Failed to generate premium receipt." });
        }
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
        doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('UKOMBOZINI TBMS', 50, 30);
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
