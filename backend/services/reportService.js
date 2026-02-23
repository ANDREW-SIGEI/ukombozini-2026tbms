const PDFDocument = require('pdfkit-table');
const ExcelJS = require('exceljs');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const reportService = {
    /**
     * Generate Meeting Minutes PDF
     */
    generateMeetingMinutes: async (sessionId) => {
        return new Promise((resolve, reject) => {
            // 1. Fetch Session Data
            db.get(`
                SELECT s.*, g.name as groupName 
                FROM meeting_sessions s
                JOIN groups g ON s.groupId = g.id
                WHERE s.id = ?
            `, [sessionId], (err, session) => {
                if (err || !session) return reject(err || new Error('Session not found'));

                // 2. Fetch Transactions for this session
                db.all(`
                    SELECT t.*, m.name as memberName 
                    FROM transactions t
                    JOIN members m ON t.memberId = m.id
                    WHERE t.sessionId = ?
                `, [sessionId], async (err, transactions) => {
                    if (err) return reject(err);

                    try {
                        const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
                        let buffers = [];
                        doc.on('data', buffers.push.bind(buffers));
                        doc.on('end', () => {
                            let pdfData = Buffer.concat(buffers);
                            resolve(pdfData);
                        });

                        // --- HEADER ---
                        const logoPath = path.join(__dirname, '../assets/logo.png');
                        if (fs.existsSync(logoPath)) {
                            doc.image(logoPath, 30, 25, { width: 140 });
                        }
                        doc.fillColor('#666666').fontSize(10).font('Helvetica-Bold').text('OFFICIAL MEETING MINUTES', 30, 65, { align: 'right' });
                        doc.moveDown(2);
                        doc.strokeColor('#eeeeee').moveTo(30, doc.y).lineTo(565, doc.y).stroke();
                        doc.moveDown();

                        // --- MEETING INFO ---
                        doc.fontSize(10).font('Helvetica-Bold').text('Group: ', { continued: true }).font('Helvetica').text(session.groupName);
                        doc.font('Helvetica-Bold').text('Date: ', { continued: true }).font('Helvetica').text(new Date(session.date).toLocaleDateString());
                        doc.font('Helvetica-Bold').text('Status: ', { continued: true }).font('Helvetica').text(session.status);
                        doc.moveDown();

                        // --- TOTALS SUMMARY ---
                        let totals = session.totals ? JSON.parse(session.totals) : null;
                        if (!totals) {
                            totals = { savings: 0, stl_repayment: 0, ltl_repayment: 0, loan_interest: 0, welfare: 0, fines: 0, loans_issued: 0 };
                        }

                        const summaryTable = {
                            title: "Financial Summary",
                            headers: ["Category", "Total (KES)"],
                            rows: [
                                ["Total Savings", (totals.savings || 0).toLocaleString()],
                                ["STL Repayments", (totals.stl_repayment || 0).toLocaleString()],
                                ["LTL Repayments", (totals.ltl_repayment || 0).toLocaleString()],
                                ["Loan Interest", (totals.loan_interest || 0).toLocaleString()],
                                ["Welfare Contribution", (totals.welfare || 0).toLocaleString()],
                                ["Fines & Penalties", (totals.fines || 0).toLocaleString()],
                                ["New Loans Issued", (totals.loans_issued || 0).toLocaleString()],
                            ]
                        };
                        await doc.table(summaryTable, { width: 300 });

                        doc.addPage();

                        // --- DETAILED TRANSACTIONS ---
                        const txRows = transactions.map(t => [
                            t.memberName || "Unknown Member",
                            t.attended ? "Yes" : "No",
                            (t.savings_amount || 0).toLocaleString(),
                            (t.stl_repayment || 0).toLocaleString(),
                            (t.ltl_repayment || 0).toLocaleString(),
                            (t.loans_issued || 0).toLocaleString()
                        ]);

                        const detailTable = {
                            title: "Detailed Member Transactions",
                            headers: ["Member", "Attended", "Savings", "STL Repay", "LTL Repay", "Loan Issued"],
                            rows: txRows
                        };
                        await doc.table(detailTable, {
                            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8),
                            prepareRow: () => doc.font("Helvetica").fontSize(8)
                        });

                        // --- FOOTER & WATERMARK ---
                        let pages = doc.bufferedPageRange();
                        for (let i = 0; i < pages.count; i++) {
                            doc.switchToPage(i);
                            doc.save();
                            doc.opacity(0.05);
                            if (fs.existsSync(logoPath)) {
                                doc.image(logoPath, (doc.page.width - 250) / 2, (doc.page.height - 80) / 2, { width: 250 });
                            }
                            doc.restore();
                        }

                        doc.moveDown();
                        doc.fontSize(8).fillColor('#999999').text('UKOMBOZINI INVESTMENT FINANCIAL CONTROL | SYSTEM GENERATED', { align: 'center', oblique: true });
                        doc.text(`Timestamp: ${new Date().toLocaleString()}`, { align: 'center' });

                        doc.end();
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        });
    },

    /**
     * Generate Member Statement PDF (Institutional Design)
     */
    generateMemberStatement: async (memberId, startDate, endDate) => {
        return new Promise((resolve, reject) => {
            // 1. Fetch Member Details with Full Logic (Project Savings, Welfare, Assets, Loans)
            const queryDetails = `
                SELECT m.*, g.name as groupName,
                (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id WHERE pr.member_id = m.id AND pr.project_type = 'EDUCATION') as education_savings,
                (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id WHERE pr.member_id = m.id AND pr.project_type = 'AGRICULTURE') as agriculture_savings,
                (SELECT COALESCE(SUM(welfare), 0) FROM transactions WHERE memberId = m.id AND transaction_type = 'Welfare') as welfare_balance,
                (SELECT COALESCE(SUM(financed_amount), 0) FROM product_financing WHERE member_id = m.id AND status = 'ACTIVE') as active_asset_balance,
                (SELECT COALESCE(SUM(fines), 0) - (SELECT COALESCE(SUM(fines), 0) FROM transactions WHERE memberId = m.id AND transaction_type = 'LoanRepayment') FROM transactions WHERE memberId = m.id AND transaction_type IN ('Fine', 'penalty')) as penalties
                FROM members m
                JOIN groups g ON m.group_id = g.id
                WHERE m.id = ?
            `;

            db.get(queryDetails, [memberId], (err, member) => {
                if (err || !member) return reject(err || new Error('Member not found'));

                // 2. Fetch history from member_ledger_view
                let queryLedger = `SELECT * FROM member_ledger_view WHERE memberId = ?`;
                const params = [memberId];

                if (startDate) {
                    queryLedger += ` AND trans_date >= ?`;
                    params.push(startDate);
                }
                if (endDate) {
                    queryLedger += ` AND trans_date <= ?`;
                    params.push(endDate);
                }

                queryLedger += ` ORDER BY trans_date ASC, created_at ASC`;

                db.all(queryLedger, params, async (err, history) => {
                    if (err) return reject(err);

                    try {
                        const doc = new PDFDocument({
                            margin: 40,
                            size: 'A4',
                            bufferPages: true,
                            info: {
                                Title: `Member Statement - ${member.name}`,
                                Author: 'UKOMBOZINI TBMS',
                            }
                        });
                        let buffers = [];
                        doc.on('data', buffers.push.bind(buffers));
                        doc.on('end', () => {
                            let pdfData = Buffer.concat(buffers);
                            resolve(pdfData);
                        });

                        // --- BRANDING & HEADER ---
                        const logoPath = path.join(__dirname, '../assets/logo.png');
                        if (fs.existsSync(logoPath)) {
                            doc.image(logoPath, 40, 35, { width: 180 });
                        }

                        doc.fillColor('#666666').fontSize(8).font('Helvetica-Bold').text('INSTITUTIONAL FINANCIAL SERVICES | UKOMBOZINI TBMS', 40, 85);
                        doc.moveDown(3);

                        // --- STATEMENT INFO ---
                        doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text('MEMBER FINANCIAL STATEMENT', { align: 'right' });
                        doc.fontSize(8).font('Helvetica').text(`Period: ${startDate || 'All Time'} to ${endDate || 'Present'}`, { align: 'right' });
                        doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
                        doc.moveDown(2);

                        // --- MEMBER PROFILE BOX ---
                        doc.rect(40, doc.y, 515, 60).fill('#f9fafb').stroke('#e5e7eb');
                        let currentY = doc.y + 10;
                        doc.fillColor('#4b5563').fontSize(8).font('Helvetica-Bold').text('MEMBER NAME:', 55, currentY);
                        doc.fillColor('#111827').text(member.name, 130, currentY);

                        doc.fillColor('#4b5563').text('MEMBER ID:', 300, currentY);
                        doc.fillColor('#111827').text(`UK-MEM-${member.id.toString().padStart(4, '0')}`, 370, currentY);

                        currentY += 15;
                        doc.fillColor('#4b5563').text('PHONE:', 55, currentY);
                        doc.fillColor('#111827').text(member.phone, 130, currentY);

                        doc.fillColor('#4b5563').text('GROUP:', 300, currentY);
                        doc.fillColor('#111827').text(member.groupName, 370, currentY);

                        currentY += 15;
                        doc.fillColor('#4b5563').text('NATIONAL ID:', 55, currentY);
                        doc.fillColor('#111827').text(member.national_id || 'N/A', 130, currentY);

                        doc.moveDown(4);

                        // --- BALANCES SUMMARY (5 Financial Domains) ---
                        const netPosition = (
                            member.current_savings +
                            (member.education_savings || 0) +
                            (member.agriculture_savings || 0)
                        ) - (
                                member.active_loan_balance +
                                (member.active_asset_balance || 0) +
                                (member.penalties || 0)
                            );

                        const summaryData = {
                            headers: [
                                { label: "FINANCIAL CATEGORY / DOMAIN", property: 'type', width: 250, align: 'left', headerColor: '#76bc21', headerOpacity: 1 },
                                { label: "VALUE (KSH)", property: 'amount', width: 265, align: 'right', headerColor: '#76bc21', headerOpacity: 1 }
                            ],
                            rows: [
                                ["General Table Savings", `KSh ${member.current_savings.toLocaleString()}`],
                                ["Welfare Fund contributions", `KSh ${(member.welfare_balance || 0).toLocaleString()}`],
                                ["Education Project Pool", `KSh ${(member.education_savings || 0).toLocaleString()}`],
                                ["Agriculture Project Pool", `KSh ${(member.agriculture_savings || 0).toLocaleString()}`],
                                ["Product Financing (Assets)", `KSh ${(member.active_asset_balance || 0).toLocaleString()}`],
                                ["Active Cash Loans (Principal)", `KSh ${member.active_loan_balance.toLocaleString()}`],
                                ["Outstanding Penalties", `KSh ${(member.penalties || 0).toLocaleString()}`],
                                ["-", "-"],
                                ["NET LIQUIDITY POSITION", `KSh ${netPosition.toLocaleString()}`],
                                ["INSTITUTIONAL RISK SCORE", `${member.risk_score}%`]
                            ]
                        };
                        await doc.table(summaryData, {
                            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(9).fillColor('#ffffff'),
                            prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                                doc.font("Helvetica-Bold").fontSize(10).fillColor('#111827');
                                if (row[0].includes("NET") || row[0].includes("RISK")) {
                                    doc.fillColor('#e31e24'); // Highlight final metrics
                                }
                            },
                            padding: 5
                        });

                        doc.moveDown(2);

                        // --- TRANSACTION LEDGER ---
                        let runningBalance = 0;
                        const ledgerRows = history.map(h => {
                            runningBalance += (h.credit - h.debit);
                            return [
                                new Date(h.trans_date).toLocaleDateString(),
                                h.type,
                                h.description,
                                h.debit > 0 ? h.debit.toLocaleString() : '-',
                                h.credit > 0 ? h.credit.toLocaleString() : '-',
                                runningBalance.toLocaleString()
                            ];
                        });

                        const ledgerTable = {
                            title: "Transaction History",
                            headers: ["Date", "Type", "Description", "Debit", "Credit", "Balance"],
                            rows: ledgerRows
                        };
                        await doc.table(ledgerTable, {
                            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8).fillColor('#374151'),
                            prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                                doc.font("Helvetica").fontSize(8).fillColor('#4b5563');
                                if (indexColumn === 5) doc.font("Helvetica-Bold"); // Bold Balance
                            },
                            width: 515
                        });

                        // --- QR CODE & FOOTER ---
                        const qrData = `StatementID: UK-${member.id}-${Date.now()}\nMember: ${member.name}\nBalance: ${member.current_savings}`;
                        const qrCodeUrl = await QRCode.toDataURL(qrData);

                        doc.addPage(); // Optional or just at the bottom
                        doc.image(qrCodeUrl, 450, doc.page.height - 120, { width: 80 });
                        doc.fontSize(7).fillColor('#9ca3af').text('Scan to verify statement authenticity', 440, doc.page.height - 40);

                        doc.fontSize(8).fillColor('#6b7280').text('This is an electronically generated statement. No signature required.', 40, doc.page.height - 60, { align: 'left' });
                        doc.text(`Ref: UK/STM/${member.id}/${new Date().getTime()}`, 40, doc.page.height - 50);

                        // Watermark on all pages (Logo Watermark)
                        let pages = doc.bufferedPageRange();
                        for (let i = 0; i < pages.count; i++) {
                            doc.switchToPage(i);
                            doc.save();
                            doc.opacity(0.1); // Very light
                            if (fs.existsSync(logoPath)) {
                                // Center logo watermark
                                doc.image(logoPath, (doc.page.width - 300) / 2, (doc.page.height - 100) / 2, { width: 300 });
                            } else {
                                doc.fontSize(60).fillColor('#76bc21').text('OFFICIAL RECORD', 50, doc.page.height / 2, { rotation: 45 });
                            }
                            doc.restore();
                        }

                        doc.end();
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        });
    },

    /**
     * Generate Member Statement Excel (Analysis Design)
     */
    generateMemberExcel: async (memberId, startDate, endDate) => {
        return new Promise((resolve, reject) => {
            const queryDetails = `
                SELECT m.*, g.name as groupName,
                (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id WHERE pr.member_id = m.id AND pr.project_type = 'EDUCATION') as education_savings,
                (SELECT COALESCE(SUM(ps.amount), 0) FROM project_savings ps JOIN project_registrations pr ON ps.registration_id = pr.id WHERE pr.member_id = m.id AND pr.project_type = 'AGRICULTURE') as agriculture_savings,
                (SELECT COALESCE(SUM(welfare), 0) FROM transactions WHERE memberId = m.id AND transaction_type = 'Welfare') as welfare_balance,
                (SELECT COALESCE(SUM(financed_amount), 0) FROM product_financing WHERE member_id = m.id AND status = 'ACTIVE') as active_asset_balance,
                (SELECT COALESCE(SUM(fines), 0) - (SELECT COALESCE(SUM(fines), 0) FROM transactions WHERE memberId = m.id AND transaction_type = 'LoanRepayment') FROM transactions WHERE memberId = m.id AND transaction_type IN ('Fine', 'penalty')) as penalties
                FROM members m
                JOIN groups g ON m.group_id = g.id
                WHERE m.id = ?
            `;

            db.get(queryDetails, [memberId], (err, member) => {
                if (err || !member) return reject(err || new Error('Member not found'));

                let queryLedger = `SELECT * FROM member_ledger_view WHERE memberId = ?`;
                const params = [memberId];
                if (startDate) { queryLedger += ` AND trans_date >= ?`; params.push(startDate); }
                if (endDate) { queryLedger += ` AND trans_date <= ?`; params.push(endDate); }
                queryLedger += ` ORDER BY trans_date ASC, created_at ASC`;

                db.all(queryLedger, params, async (err, history) => {
                    if (err) return reject(err);

                    try {
                        const workbook = new ExcelJS.Workbook();
                        workbook.creator = 'UKOMBOZINI TBMS';

                        // --- SHEET 1: TRANSACTIONS ---
                        const txSheet = workbook.addWorksheet('Transactions History');
                        txSheet.columns = [
                            { header: 'Date', key: 'date', width: 15 },
                            { header: 'Type', key: 'type', width: 25 },
                            { header: 'Description', key: 'desc', width: 45 },
                            { header: 'Debit (OUT)', key: 'debit', width: 15 },
                            { header: 'Credit (IN)', key: 'credit', width: 15 },
                            { header: 'Running Balance', key: 'balance', width: 20 }
                        ];

                        // Header Styling
                        txSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        txSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF76BC21' } };

                        let runningBalance = 0;
                        history.forEach(h => {
                            runningBalance += (h.credit - h.debit);
                            txSheet.addRow({
                                date: h.trans_date,
                                type: h.type,
                                desc: h.description,
                                debit: h.debit || 0,
                                credit: h.credit || 0,
                                balance: runningBalance
                            });
                        });

                        // Formatting columns
                        txSheet.getColumn('debit').numFmt = '#,##0.00';
                        txSheet.getColumn('credit').numFmt = '#,##0.00';
                        txSheet.getColumn('balance').numFmt = '#,##0.00';

                        // --- SHEET 2: SUMMARY ---
                        const summarySheet = workbook.addWorksheet('Institutional Summary');
                        summarySheet.addRow(['UKOMBOZINI INVESTMENT | MEMBER POSITION STATEMENT']);
                        summarySheet.getRow(1).font = { bold: true, size: 14 };
                        summarySheet.addRow([]);
                        summarySheet.addRow(['Member Name', member.name]);
                        summarySheet.addRow(['Official Tracking ID', `UK-MEM-${member.id.toString().padStart(4, '0')}`]);
                        summarySheet.addRow(['Associated Group', member.groupName]);
                        summarySheet.addRow(['Statement Window', `${startDate || 'Full History'} to ${endDate || 'Current'}`]);
                        summarySheet.addRow(['Generation Timestamp', new Date().toLocaleString()]);
                        summarySheet.addRow([]);
                        summarySheet.addRow(['FINANCIAL DOMAIN', 'CURRENT VALUE (KSH)']);
                        summarySheet.getRow(9).font = { bold: true };
                        summarySheet.addRow(['General Table Savings', member.current_savings]);
                        summarySheet.addRow(['Welfare Fund Balance', member.welfare_balance || 0]);
                        summarySheet.addRow(['Education Project Savings', member.education_savings || 0]);
                        summarySheet.addRow(['Agriculture Project Savings', member.agriculture_savings || 0]);
                        summarySheet.addRow(['Active Asset Financing', member.active_asset_balance || 0]);
                        summarySheet.addRow(['Active Cash Loan Principal', member.active_loan_balance]);
                        summarySheet.addRow(['Outstanding Penalties', member.penalties || 0]);

                        const netPosition = (
                            member.current_savings +
                            (member.education_savings || 0) +
                            (member.agriculture_savings || 0)
                        ) - (
                                member.active_loan_balance +
                                (member.active_asset_balance || 0) +
                                (member.penalties || 0)
                            );
                        summarySheet.addRow(['NET LIQUIDITY POSITION', netPosition]);
                        summarySheet.addRow(['INSTITUTIONAL RISK SCORE (%)', parseFloat(member.risk_score || 0)]);

                        summarySheet.getColumn(2).numFmt = '#,##0.00';
                        summarySheet.getColumn(1).width = 25;
                        summarySheet.getColumn(2).width = 20;

                        const buffer = await workbook.xlsx.writeBuffer();
                        resolve(buffer);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        });
    },

    /**
     * Generate Dividend Report PDF
     */
    generateDividendReport: async (runId) => {
        return new Promise((resolve, reject) => {
            // 1. Fetch Run Data
            db.get(`
                SELECT r.*, g.name as groupName 
                FROM dividend_runs r
                JOIN groups g ON r.group_id = g.id
                WHERE r.id = ?
            `, [runId], (err, run) => {
                if (err || !run) return reject(err || new Error('Dividend run not found'));

                // 2. Fetch Allocations from Database
                db.all(`
                    SELECT a.*, m.name as member_name 
                    FROM dividend_allocations a
                    JOIN members m ON a.member_id = m.id
                    WHERE a.dividend_run_id = ?
                `, [runId], (err, allocations) => {
                    if (err) return reject(err);

                    try {
                        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape', bufferPages: true });
                        let buffers = [];
                        doc.on('data', buffers.push.bind(buffers));
                        doc.on('end', () => {
                            let pdfData = Buffer.concat(buffers);
                            resolve(pdfData);
                        });

                        // --- HEADER ---
                        const logoPath = path.join(__dirname, '../assets/logo.png');
                        if (fs.existsSync(logoPath)) {
                            doc.image(logoPath, 30, 25, { width: 180 });
                        }

                        doc.fillColor('#666666').fontSize(12).font('Helvetica-Bold').text(`DIVIDEND DISTRIBUTION REPORT - FY ${run.financial_year}`, 30, 65, { align: 'right' });
                        doc.fontSize(10).text(run.groupName, { align: 'right' });
                        doc.moveDown(2);
                        doc.strokeColor('#eeeeee').moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
                        doc.moveDown();

                        // --- FINANCIAL SUMMARY ---
                        const summaryTable = {
                            title: "Executive Summary",
                            headers: ["Metric", "Value (KES)"],
                            rows: [
                                ["Allocable Profit", run.allocable_profit.toLocaleString()],
                                ["Distribution Rate", `${(run.profit_share_percentage)}%`],
                                ["Dividend Rate", `${(run.dividend_rate * 100).toFixed(2)}%`]
                            ]
                        };
                        doc.table(summaryTable, { width: 400 });

                        doc.addPage();

                        // --- ALLOCATIONS ---
                        const allocRows = allocations.map(a => [
                            a.member_name,
                            a.average_shares.toLocaleString(),
                            a.gross_dividend.toLocaleString(),
                            "0", // Arrears placeholder
                            a.net_dividend.toLocaleString()
                        ]);

                        const detailTable = {
                            title: "Member Dividend Allocations",
                            headers: ["Member", "Avg Shares", "Gross Div", "Arrears Offset", "Net Payout"],
                            rows: allocRows
                        };
                        doc.table(detailTable, {
                            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
                            prepareRow: () => doc.font("Helvetica").fontSize(9)
                        });

                        // --- FOOTER & WATERMARK ---
                        let pages = doc.bufferedPageRange();
                        for (let i = 0; i < pages.count; i++) {
                            doc.switchToPage(i);
                            doc.save();
                            doc.opacity(0.05);
                            if (fs.existsSync(logoPath)) {
                                doc.image(logoPath, (doc.page.width - 350) / 2, (doc.page.height - 120) / 2, { width: 350 });
                            }
                            doc.restore();
                        }

                        doc.moveDown();
                        doc.fontSize(10).text('Approved for Distribution by Group Committee', { align: 'center' });
                        doc.text(`Generated: ${new Date().toLocaleString()} | UKOMBOZINI INVESTMENT`, { align: 'center', oblique: true });

                        doc.end();
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        });
    },

    /**
     * Generate Contribution Compliance Report PDF
     */
    generateContributionComplianceReport: async (month, groupId) => {
        return new Promise((resolve, reject) => {
            // month is expected as 'MM' or 'YYYY-MM' or 'MonthName'
            // For simplicity, let's assume we can parse it
            let monthNum = month;
            let year = new Date().getFullYear();
            if (month.includes('-')) {
                [year, monthNum] = month.split('-');
            }

            const query = `
                SELECT 
                    m.name, 
                    g.minMonthlySaving as expected,
                    COALESCE(SUM(t.savings_amount), 0) as amount,
                    CASE 
                        WHEN COALESCE(SUM(t.savings_amount), 0) >= g.minMonthlySaving THEN 'Paid'
                        WHEN COALESCE(SUM(t.savings_amount), 0) > 0 THEN 'Partial'
                        ELSE 'Skipped'
                    END as status,
                    (SELECT m1.name FROM members m1 WHERE m1.id = l.guarantor1_id) as g1,
                    (SELECT m2.name FROM members m2 WHERE m2.id = l.guarantor2_id) as g2,
                    COALESCE(m.active_loan_balance, 0) as loanBalance
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

            db.all(query, [monthNum.toString().padStart(2, '0'), year.toString(), groupId, groupId], (err, data) => {
                if (err) return reject(err);

                try {
                    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
                    let buffers = [];
                    doc.on('data', buffers.push.bind(buffers));
                    doc.on('end', () => resolve(Buffer.concat(buffers)));

                    const logoPath = path.join(__dirname, '../assets/logo.png');
                    if (fs.existsSync(logoPath)) {
                        doc.image(logoPath, 30, 25, { width: 140 });
                    }
                    doc.fillColor('#666666').fontSize(10).font('Helvetica-Bold').text(`COMPLIANCE REPORT - ${month}`, 30, 60, { align: 'right' });
                    doc.moveDown(3);

                    // Watermark setup
                    const pages = doc.bufferedPageRange();

                    const rows = data.map(d => {
                        const guarantors = [d.g1, d.g2].filter(Boolean).join(', ') || 'N/A';
                        return [
                            d.name,
                            d.status,
                            d.amount.toLocaleString(),
                            d.expected.toLocaleString(),
                            guarantors,
                            d.loanBalance.toLocaleString()
                        ];
                    });

                    const table = {
                        title: `Governance Performance Registry (${data.length} Entities)`,
                        headers: ["Entity", "Status", "Paid", "Target", "Guarantors", "Exposure"],
                        rows: rows
                    };
                    doc.table(table, {
                        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(8),
                        prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                            doc.font('Helvetica').fontSize(7);
                            if (row[1] === 'Skipped') doc.fillColor('red');
                            else if (row[1] === 'Partial') doc.fillColor('orange');
                            else doc.fillColor('black');
                        }
                    });

                    // Watermark loop
                    let pcComp = doc.bufferedPageRange();
                    for (let i = 0; pcComp && i < pcComp.count; i++) {
                        doc.switchToPage(i);
                        doc.save();
                        doc.opacity(0.05);
                        if (fs.existsSync(logoPath)) doc.image(logoPath, (doc.page.width - 250) / 2, (doc.page.height - 80) / 2, { width: 250 });
                        doc.restore();
                    }

                    doc.end();
                } catch (e) {
                    reject(e);
                }
            });
        });
    },

    /**
     * Generate Loan Repayment Report PDF
     */
    generateLoanRepaymentReport: async (month, groupId, type) => {
        return new Promise((resolve, reject) => {
            let monthNum = month;
            let year = new Date().getFullYear();
            if (month.includes('-')) {
                [year, monthNum] = month.split('-');
            }

            const query = `
                SELECT m.name, 
                       l.loan_type as loanType, 
                       COALESCE(rs.expected_installment, 0) as expected,
                       COALESCE(SUM(t.stl_repayment + t.ltl_repayment + t.loan_interest), 0) as paid,
                       (l.principal_amount - COALESCE((SELECT SUM(stl_repayment + ltl_repayment) FROM transactions WHERE memberId = m.id), 0)) as balance
                FROM loans l
                JOIN members m ON l.member_id = m.id
                LEFT JOIN repayment_schedule rs ON l.id = rs.loan_id 
                    AND strftime('%m', rs.due_date) = ? 
                    AND strftime('%Y', rs.due_date) = ?
                LEFT JOIN transactions t ON m.id = t.memberId 
                    AND strftime('%m', t.created_at) = ? 
                    AND strftime('%Y', t.created_at) = ?
                WHERE l.status = 'active'
                  AND (? = 'all' OR l.group_id = ?)
                  AND (? = 'all' OR l.loan_type = ?)
                GROUP BY l.id
                ORDER BY m.name ASC
            `;

            const mStr = monthNum.toString().padStart(2, '0');
            const yStr = year.toString();

            db.all(query, [mStr, yStr, mStr, yStr, groupId, groupId, type || 'all', type || 'all'], (err, data) => {
                if (err) return reject(err);

                try {
                    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
                    let buffers = [];
                    doc.on('data', buffers.push.bind(buffers));
                    doc.on('end', () => resolve(Buffer.concat(buffers)));

                    const logoPath = path.join(__dirname, '../assets/logo.png');
                    if (fs.existsSync(logoPath)) {
                        doc.image(logoPath, 30, 25, { width: 140 });
                    }
                    doc.fillColor('#666666').fontSize(10).font('Helvetica-Bold').text(`LOAN REPAYMENT STATUS - ${month}`, 30, 60, { align: 'right' });
                    doc.moveDown(3);

                    const rows = data.map(d => [
                        d.name,
                        d.loanType,
                        d.paid.toLocaleString(),
                        d.expected.toLocaleString(),
                        d.balance.toLocaleString()
                    ]);

                    const table = {
                        title: `Repayment Details (${data.length} Active Loans)`,
                        headers: ["Member", "Type", "Paid (KES)", "Expected (KES)", "Outstanding (KES)"],
                        rows: rows
                    };
                    doc.table(table, {
                        prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                            const paid = parseFloat(row[2].replace(/,/g, ''));
                            const expected = parseFloat(row[3].replace(/,/g, ''));
                            if (paid < expected) doc.fillColor('red');
                            else doc.fillColor('black');
                        }
                    });

                    // Watermark loop
                    let pcLoan = doc.bufferedPageRange();
                    for (let i = 0; pcLoan && i < pcLoan.count; i++) {
                        doc.switchToPage(i);
                        doc.save();
                        doc.opacity(0.05);
                        if (fs.existsSync(logoPath)) doc.image(logoPath, (doc.page.width - 250) / 2, (doc.page.height - 80) / 2, { width: 250 });
                        doc.restore();
                    }

                    doc.end();
                } catch (e) {
                    reject(e);
                }
            });
        });
    },

    /**
     * Generate Loan Advisory Report PDF
     */
    generateLoanAdvisory: async (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                const {
                    memberName,
                    memberId,
                    groupName,
                    loanType,
                    amount,
                    interestRate,
                    duration,
                    schedule,
                    totalRepayment,
                    monthlyInstallment,
                    guarantors = [],
                    gap = 0
                } = data;

                const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
                let buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                // --- HEADER & LOGO ---
                const logoPath = path.join(__dirname, '../assets/logo.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 40, 30, { width: 160 });
                }

                doc.fillColor('#666666').fontSize(10).font('Helvetica-Bold').text('LOAN REPAYMENT ADVISORY', 40, 75, { align: 'right' });
                doc.moveDown(3);

                // --- MEMBER & LOAN INFO ---
                doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text(`PROPOSAL FOR: ${memberName.toUpperCase()}`);
                doc.fontSize(10).font('Helvetica').text(`Member ID: UK-MEM-${memberId.toString().padStart(4, '0')}`);
                doc.text(`Group: ${groupName}`);
                doc.moveDown();

                doc.rect(40, doc.y, 515, 80).fill('#f3f4f6').stroke('#e5e7eb');
                const boxY = doc.y + 10;
                doc.fillColor('#4b5563').fontSize(9).font('Helvetica-Bold').text('LOAN TYPE:', 60, boxY);
                doc.fillColor('#111827').text(loanType === 'STL' ? 'Short Term Loan' : 'Long Term Loan', 150, boxY);

                doc.fillColor('#4b5563').text('PRINCIPAL:', 300, boxY);
                doc.fillColor('#111827').text(`KES ${amount.toLocaleString()}`, 400, boxY);

                doc.fillColor('#4b5563').text('DURATION:', 60, boxY + 20);
                doc.fillColor('#111827').text(`${duration} Months`, 150, boxY + 20);

                doc.fillColor('#4b5563').text('INTEREST RATE:', 300, boxY + 20);
                doc.fillColor('#111827').text(`${interestRate}% ${loanType === 'STL' ? 'per month (Reducing)' : 'Standard'}`, 400, boxY + 20);

                doc.fillColor('#4b5563').text('TOTAL REPAYABLE:', 60, boxY + 45);
                doc.fillColor('#76bc21').fontSize(12).text(`KES ${totalRepayment.toLocaleString()}`, 150, boxY + 45);

                doc.moveDown(6);

                // --- GUARANTOR REQUIREMENTS ---
                if (gap > 0 || guarantors.length > 0) {
                    doc.fillColor('#b91c1c').fontSize(10).font('Helvetica-Bold').text('GUARANTOR REQUIREMENTS');
                    doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text(`This loan requires coverage for the gap of KES ${gap.toLocaleString()}.`);
                    if (guarantors.length > 0) {
                        doc.text(`Identified Guarantors: ${guarantors.join(', ')}`);
                    }
                    doc.moveDown();
                }

                // --- REPAYMENT SCHEDULE ---
                const tableRows = schedule.map(row => [
                    `Month ${row.month}`,
                    `KES ${row.balanceStart.toLocaleString()}`,
                    `KES ${row.principal.toLocaleString()}`,
                    `KES ${row.interest.toLocaleString()}`,
                    `KES ${row.totalPayment.toLocaleString()}`
                ]);

                const advisoryTable = {
                    title: "Repayment Schedule Breakdown",
                    headers: ["Period", "Balance B/F", "Principal", "Interest", "Total Due"],
                    rows: tableRows
                };

                await doc.table(advisoryTable, {
                    prepareHeader: () => doc.font("Helvetica-Bold").fontSize(9).fillColor('#374151'),
                    prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                        doc.font("Helvetica").fontSize(9).fillColor('#4b5563');
                        if (indexColumn === 4) doc.font("Helvetica-Bold").fillColor('#76bc21');
                    }
                });

                // --- FOOTER ---
                const pages = doc.bufferedPageRange();
                for (let i = 0; i < pages.count; i++) {
                    doc.switchToPage(i);
                    doc.save();
                    doc.opacity(0.05);
                    if (fs.existsSync(logoPath)) doc.image(logoPath, (doc.page.width - 250) / 2, (doc.page.height - 80) / 2, { width: 250 });
                    doc.restore();
                }

                doc.moveDown(2);
                doc.fontSize(8).fillColor('#9ca3af').text('UKOMBOZINI INVESTMENT FINANCIAL CONTROL | LOAN CONSULTATION DOCUMENT', { align: 'center' });
                doc.text('This is an advisory document and does not constitute a loan agreement. Terms are subject to committee approval.', { align: 'center' });
                doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

                doc.end();
            } catch (e) {
                reject(e);
            }
        });
    },

    /**
     * Generate Partnership Statement PDF (Institutional Grade)
     */
    generatePartnershipStatement: async (groupId) => {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Fetch Group & Financial Context
                const groupRes = await new Promise((res, rej) => {
                    db.get(`
                        SELECT g.name, g.id,
                        (SELECT COALESCE(SUM(amount), 0) FROM company_investments WHERE group_id = g.id AND status = 'ACTIVE') as totalTopUp,
                        (SELECT COALESCE(SUM(amount), 0) FROM group_commitments WHERE group_id = g.id AND status = 'LOCKED') as totalCommitment,
                        (SELECT COALESCE(SUM(total_value), 0) FROM financed_products fp JOIN members m ON fp.member_id = m.id WHERE m.group_id = g.id AND fp.status = 'ACTIVE') as totalProductFinance
                        FROM groups g WHERE g.id = ?
                    `, [groupId], (err, row) => err ? rej(err) : res(row));
                });

                if (!groupRes) return reject(new Error('Group not found'));

                // 2. Fetch History
                const investments = await new Promise((res, rej) => {
                    db.all(`SELECT * FROM company_investments WHERE group_id = ? ORDER BY created_at DESC`, [groupId], (err, rows) => err ? rej(err) : res(rows));
                });

                const commitments = await new Promise((res, rej) => {
                    db.all(`SELECT * FROM group_commitments WHERE group_id = ? ORDER BY created_at DESC`, [groupId], (err, rows) => err ? rej(err) : res(rows));
                });

                const products = await new Promise((res, rej) => {
                    db.all(`
                        SELECT fp.*, m.name as member_name 
                        FROM financed_products fp
                        JOIN members m ON fp.member_id = m.id
                        WHERE m.group_id = ? 
                        ORDER BY fp.created_at DESC
                    `, [groupId], (err, rows) => err ? rej(err) : res(rows));
                });

                const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
                let buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                // --- HEADER ---
                const logoPath = path.join(__dirname, '../assets/logo.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 40, 35, { width: 180 });
                }
                doc.fillColor('#666666').fontSize(10).font('Helvetica-Bold').text('PARTNERSHIP FINANCIAL STATEMENT', 40, 85, { align: 'right' });
                doc.moveDown(3);

                // --- GROUP INFO ---
                doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text(`GROUP: ${groupRes.name.toUpperCase()}`);
                doc.fontSize(10).font('Helvetica').text(`Group ID: UK-GRP-${groupRes.id.toString().padStart(3, '0')}`);
                doc.text(`Run Date: ${new Date().toLocaleString()}`);
                doc.moveDown(2);

                // --- EXECUTIVE SUMMARY ---
                const netExposure = (groupRes.totalTopUp + groupRes.totalProductFinance) - groupRes.totalCommitment;

                const summaryTable = {
                    title: "Institutional Portfolio Summary",
                    headers: ["Financial Category", "Value (KES)"],
                    rows: [
                        ["Total Company Injections (Top-Ups)", groupRes.totalTopUp.toLocaleString()],
                        ["Asset Financing Volume", groupRes.totalProductFinance.toLocaleString()],
                        ["Group Security Pool (Escrow)", groupRes.totalCommitment.toLocaleString()],
                        ["NET INSTITUTIONAL EXPOSURE", netExposure.toLocaleString()]
                    ]
                };
                await doc.table(summaryTable, {
                    prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10).fillColor('#374151'),
                    prepareRow: (row, i) => {
                        doc.font("Helvetica").fontSize(10).fillColor('#4b5563');
                        if (row[0].includes("NET")) doc.font("Helvetica-Bold").fillColor(netExposure > 0 ? '#b91c1c' : '#059669');
                    }
                });

                doc.moveDown(2);

                // --- TRANSACTION HISTORIES (TABULAR) ---

                // 1. Deposits
                if (commitments.length > 0) {
                    const depositRows = commitments.map(c => [
                        new Date(c.created_at).toLocaleDateString(),
                        `KES ${c.amount.toLocaleString()}`,
                        c.status,
                        c.notes || '-'
                    ]);
                    const depositTable = {
                        title: "Security Deposit History (Escrow)",
                        headers: ["Date", "Amount", "Status", "Notes"],
                        rows: depositRows
                    };
                    await doc.table(depositTable, { width: 515 });
                    doc.moveDown();
                }

                // 2. Portfolio Issues
                if (products.length > 0) {
                    const productRows = products.map(p => [
                        p.member_name,
                        p.product_name,
                        `KES ${p.total_value.toLocaleString()}`,
                        p.status
                    ]);
                    const productTable = {
                        title: "Asset Financing Dispatch History",
                        headers: ["Member", "Product", "Value", "Status"],
                        rows: productRows
                    };
                    await doc.table(productTable, { width: 515 });
                }

                // --- FOOTER ---
                doc.fontSize(8).fillColor('#999999').text('UKOMBOZINI INSTITUTIONAL PARTNERSHIP | SYSTEM GENERATED RECORD', 40, doc.page.height - 50, { align: 'center' });

                doc.end();
            } catch (e) {
                reject(e);
            }
        });
    }
};

/**
 * Institutional Monthly Cash Report PDF
 */
reportService.generateMonthlyCashReportPDF = async (reportId) => {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT m.*, g.name as groupName 
            FROM monthly_cash_reports m
            JOIN groups g ON m.group_id = g.id
            WHERE m.id = ?
        `, [reportId], (err, report) => {
            if (err || !report) return reject(err || new Error('Monthly report not found'));

            const dailyQuery = `
                SELECT meeting_date, opening_balance, expected_closing_balance, physical_cash_count, variance, status
                FROM cash_sessions
                WHERE group_id = ? 
                AND strftime('%m', meeting_date) = ? 
                AND strftime('%Y', meeting_date) = ?
                AND status = 'LOCKED'
                ORDER BY meeting_date ASC
            `;
            const monthStr = report.month.toString().padStart(2, '0');

            db.all(dailyQuery, [report.group_id, monthStr, report.year.toString()], async (err, sessions) => {
                if (err) return reject(err);

                try {
                    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
                    let buffers = [];
                    doc.on('data', buffers.push.bind(buffers));
                    doc.on('end', () => resolve(Buffer.concat(buffers)));

                    // --- HEADER ---
                    const logoPath = path.join(__dirname, '../assets/logo.png');
                    if (fs.existsSync(logoPath)) {
                        doc.image(logoPath, 40, 35, { width: 140 });
                    }
                    doc.fillColor('#666666').fontSize(10).font('Helvetica-Bold').text('MONTHLY INSTITUTIONAL CASH AUDIT', 40, 65, { align: 'right' });
                    doc.moveDown(2);

                    // --- SUMMARY ---
                    doc.rect(40, doc.y, 515, 60).fill('#f9fafb').stroke('#e5e7eb');
                    doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text(report.groupName, 55, doc.y - 50);
                    doc.fontSize(10).font('Helvetica').text(`Period: ${monthStr}/${report.year}`, 55, doc.y + 15);
                    doc.moveDown(3);

                    const summaryTable = {
                        title: "Institutional Rollup Summary",
                        headers: ["Category", "Value (KES)"],
                        rows: [
                            ["Monthly Opening Pool", report.opening_balance.toLocaleString()],
                            ["Session Cash Inflows", report.total_cash_in.toLocaleString()],
                            ["Session Cash Outflows", report.total_cash_out.toLocaleString()],
                            ["Institutional Closing Pool", report.closing_balance.toLocaleString()]
                        ]
                    };
                    await doc.table(summaryTable, { width: 300 });
                    doc.moveDown(2);

                    // --- DAILY AUDIT TRAIL ---
                    const sessionRows = sessions.map(s => [
                        new Date(s.meeting_date).toLocaleDateString(),
                        s.opening_balance.toLocaleString(),
                        s.physical_cash_count.toLocaleString(),
                        (s.variance || 0).toLocaleString(),
                        s.status
                    ]);

                    const sessionTable = {
                        title: "Daily Verification Audit Trail",
                        headers: ["Date", "Opening", "Physical Count", "Variance", "Status"],
                        rows: sessionRows
                    };
                    await doc.table(sessionTable, {
                        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(8),
                        prepareRow: () => doc.font('Helvetica').fontSize(8)
                    });

                    // --- FOOTER ---
                    doc.fontSize(8).fillColor('#9ca3af').text(`UKOMBOZINI AUDIT REFERENCE: ${report.id}`, 40, doc.page.height - 40, { align: 'center' });
                    doc.end();
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
};

/**
 * Institutional Monthly Cash Report Excel
 */
reportService.generateMonthlyCashReportExcel = async (reportId) => {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT m.*, g.name as groupName 
            FROM monthly_cash_reports m
            JOIN groups g ON m.group_id = g.id
            WHERE m.id = ?
        `, [reportId], (err, report) => {
            if (err || !report) return reject(err || new Error('Monthly report not found'));

            const dailyQuery = `
                SELECT meeting_date, opening_balance, expected_closing_balance, physical_cash_count, variance, status, variance_explanation
                FROM cash_sessions
                WHERE group_id = ? 
                AND strftime('%m', meeting_date) = ? 
                AND strftime('%Y', meeting_date) = ?
                AND status = 'LOCKED'
                ORDER BY meeting_date ASC
            `;
            const monthStr = report.month.toString().padStart(2, '0');

            db.all(dailyQuery, [report.group_id, monthStr, report.year.toString()], async (err, sessions) => {
                if (err) return reject(err);

                try {
                    const workbook = new ExcelJS.Workbook();
                    const sheet = workbook.addWorksheet('Monthly Cash Audit');

                    sheet.addRow(['UKOMBOZINI MONTHLY CASH AUDIT']);
                    sheet.addRow(['Group', report.groupName]);
                    sheet.addRow(['Period', `${monthStr}/${report.year}`]);
                    sheet.addRow([]);

                    sheet.addRow(['Rollup Summary']);
                    sheet.addRow(['Monthly Opening Pool', report.opening_balance]);
                    sheet.addRow(['Session Inflows', report.total_cash_in]);
                    sheet.addRow(['Session Outflows', report.total_cash_out]);
                    sheet.addRow(['Institutional Closing', report.closing_balance]);
                    sheet.addRow([]);

                    sheet.addRow(['Daily Audit Trail']);
                    const headerRow = sheet.addRow(['Date', 'Opening', 'Physical Count', 'Variance', 'Status', 'Explanation']);
                    headerRow.font = { bold: true };

                    sessions.forEach(s => {
                        sheet.addRow([
                            s.meeting_date,
                            s.opening_balance,
                            s.physical_cash_count,
                            s.variance,
                            s.status,
                            s.variance_explanation || ''
                        ]);
                    });

                    const buffer = await workbook.xlsx.writeBuffer();
                    resolve(buffer);
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
};

/**
 * Generate Group Statement PDF (Institutional Grade)
 */
reportService.generateGroupStatement = async (groupId, startDate, endDate) => {
    return new Promise((resolve, reject) => {
        // 1. Fetch Group Details
        db.get(`SELECT * FROM groups WHERE id = ?`, [groupId], (err, group) => {
            if (err || !group) return reject(err || new Error('Group not found'));

            // 2. Fetch all member transactions linked to this group
            // Note: This is an institutional overview.
            let query = `
                    SELECT t.*, m.name as memberName, m. national_id
                    FROM transactions t
                    JOIN members m ON t.memberId = m.id
                    JOIN groups g ON m.groupId = g.id
                    WHERE g.id = ?
                `;
            const params = [groupId];

            if (startDate) {
                query += ` AND t.created_at >= ?`;
                params.push(startDate);
            }
            if (endDate) {
                query += ` AND t.created_at <= ?`;
                params.push(endDate);
            }

            query += ` ORDER BY t.created_at DESC`;

            db.all(query, params, async (err, transactions) => {
                if (err) return reject(err);

                try {
                    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
                    let buffers = [];
                    doc.on('data', buffers.push.bind(buffers));
                    doc.on('end', () => resolve(Buffer.concat(buffers)));

                    // --- HEADER ---
                    const logoPath = path.join(__dirname, '../assets/logo.png');
                    if (fs.existsSync(logoPath)) {
                        doc.image(logoPath, 30, 25, { width: 140 });
                    }
                    doc.fillColor('#666666').fontSize(10).font('Helvetica-Bold').text('GROUP CONSOLIDATED STATEMENT', 30, 65, { align: 'right' });
                    doc.moveDown(2);

                    // --- SUMMARY ---
                    doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text(`GROUP: ${group.name.toUpperCase()}`);
                    doc.fontSize(10).font('Helvetica').text(`Group ID: UK-GRP-${group.id.toString().padStart(3, '0')}`);
                    doc.text(`Period: ${startDate || 'All Time'} to ${endDate || 'Present'}`);
                    doc.moveDown();

                    // --- TRANSACTION TABLE ---
                    const txRows = transactions.map(t => [
                        new Date(t.created_at).toLocaleDateString(),
                        t.memberName || "Unknown",
                        t.transaction_type,
                        (t.amount || 0).toLocaleString(),
                        t.description || "-"
                    ]);

                    const table = {
                        title: "Recent Active Transactions",
                        headers: ["Date", "Member", "Type", "Amount (KES)", "Description"],
                        rows: txRows
                    };

                    await doc.table(table, {
                        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8),
                        prepareRow: () => doc.font("Helvetica").fontSize(7)
                    });

                    // Watermark & Footer
                    const pages = doc.bufferedPageRange();
                    for (let i = 0; i < pages.count; i++) {
                        doc.switchToPage(i);
                        doc.save();
                        doc.opacity(0.05);
                        if (fs.existsSync(logoPath)) doc.image(logoPath, (doc.page.width - 250) / 2, (doc.page.height - 80) / 2, { width: 250 });
                        doc.restore();
                    }

                    doc.end();
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
}



module.exports = reportService;

