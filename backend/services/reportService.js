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
                        const doc = new PDFDocument({ margin: 30, size: 'A4' });
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
                        const totals = session.totals ? JSON.parse(session.totals) : {
                            savings: 0, stl_repayment: 0, ltl_repayment: 0, loan_interest: 0, welfare: 0, fines: 0, loans_issued: 0
                        };

                        const summaryTable = {
                            title: "Financial Summary",
                            headers: ["Category", "Total (KES)"],
                            rows: [
                                ["Total Savings", totals.savings.toLocaleString()],
                                ["STL Repayments", totals.stl_repayment.toLocaleString()],
                                ["LTL Repayments", totals.ltl_repayment.toLocaleString()],
                                ["Loan Interest", totals.loan_interest.toLocaleString()],
                                ["Welfare Contribution", totals.welfare.toLocaleString()],
                                ["Fines & Penalties", totals.fines.toLocaleString()],
                                ["New Loans Issued", totals.loans_issued.toLocaleString()],
                            ]
                        };
                        await doc.table(summaryTable, { width: 300 });

                        doc.addPage();

                        // --- DETAILED TRANSACTIONS ---
                        const txRows = transactions.map(t => [
                            t.memberName,
                            t.attended ? "Yes" : "No",
                            t.savings_amount.toLocaleString(),
                            t.stl_repayment.toLocaleString(),
                            t.ltl_repayment.toLocaleString(),
                            t.loans_issued.toLocaleString()
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
                            info: {
                                Title: `Member Statement - ${member.name}`,
                                Author: 'UKOMBOZI TBMS',
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

                        doc.fillColor('#666666').fontSize(8).font('Helvetica-Bold').text('INSTITUTIONAL FINANCIAL SERVICES | UKOMBOZI TBMS', 40, 85);
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
                        workbook.creator = 'UKOMBOZI TBMS';

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
                        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
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
                SELECT m.name, 
                       g.minMonthlySaving as expected,
                       COALESCE(SUM(t.savings_amount), 0) as amount,
                       CASE 
                           WHEN COALESCE(SUM(t.savings_amount), 0) >= g.minMonthlySaving THEN 'Paid'
                           WHEN COALESCE(SUM(t.savings_amount), 0) > 0 THEN 'Partial'
                           ELSE 'Skipped'
                       END as status
                FROM members m
                JOIN groups g ON m.group_id = g.id
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
                    const doc = new PDFDocument({ margin: 30, size: 'A4' });
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

                    const rows = data.map(d => [d.name, d.status, d.amount.toLocaleString(), d.expected.toLocaleString()]);
                    const table = {
                        title: `Compliance Status (${data.length} Members)`,
                        headers: ["Member", "Status", "Paid (KES)", "Expected (KES)"],
                        rows: rows
                    };
                    doc.table(table, {
                        prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
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
                    const doc = new PDFDocument({ margin: 30, size: 'A4' });
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
     * Generate Partnership Statement (Group vs Company)
     */
    generatePartnershipStatement: async (groupId) => {
        return new Promise((resolve, reject) => {
            // 1. Fetch Group & Financials
            db.get("SELECT name FROM groups WHERE id = ?", [groupId], (err, group) => {
                if (err || !group) return reject("Group not found");

                // 2. Fetch Aggregates
                const queries = {
                    savings: "SELECT SUM(current_savings) as val FROM members WHERE group_id = ?",
                    commitments: "SELECT SUM(amount) as val FROM group_commitments WHERE group_id = ? AND status = 'LOCKED'",
                    topups: "SELECT SUM(amount) as val FROM company_investments WHERE group_id = ? AND status = 'ACTIVE'",
                    products: "SELECT SUM(financed_amount) as val FROM product_financing pf JOIN members m ON pf.member_id = m.id WHERE m.group_id = ? AND pf.status = 'ACTIVE'"
                };

                // Run parallel queries (manual promise style for sqlite3)
                const runQ = (q) => new Promise((res, rej) => db.get(q, [groupId], (e, r) => e ? rej(e) : res(r?.val || 0)));

                Promise.all([
                    runQ(queries.savings),
                    runQ(queries.commitments),
                    runQ(queries.topups),
                    runQ(queries.products)
                ]).then(([savings, commitments, topups, products]) => {
                    const doc = new PDFDocument({ margin: 40, size: 'A4' });
                    let buffers = [];
                    doc.on('data', buffers.push.bind(buffers));
                    doc.on('end', () => resolve(Buffer.concat(buffers)));

                    // BRANDING
                    const logoPath = path.join(__dirname, '../assets/logo.png');
                    if (fs.existsSync(logoPath)) {
                        doc.image(logoPath, 40, 30, { width: 160 });
                    }
                    doc.fontSize(10).fillColor('#666666').font('Helvetica-Bold').text('PARTNERSHIP POSITIONING STATEMENT', 40, 75, { align: 'right', letterSpacing: 1 });
                    doc.moveDown(3);

                    // Watermark setup
                    const pages = doc.bufferedPageRange();

                    // INFO
                    doc.fontSize(12).font('Helvetica-Bold').text(`Partner Group: ${group.name}`);
                    doc.font('Helvetica').text(`Date: ${new Date().toLocaleDateString()}`);
                    doc.moveDown();

                    // 2-COLUMN LAYOUT
                    const mid = doc.page.width / 2;
                    const yStart = doc.y;

                    // LEFT: GROUP POSITION
                    doc.rect(40, yStart, mid - 50, 200).fillOpacity(0.05).fill('#008524').stroke('#008524').fillOpacity(1);
                    doc.fillColor('#006400').fontSize(14).font('Helvetica-Bold').text('GROUP FUNDS', 50, yStart + 20);
                    doc.fontSize(10).font('Helvetica').text('Member Savings:', 50, yStart + 50);
                    doc.font('Helvetica-Bold').text(`KES ${savings.toLocaleString()}`, 150, yStart + 50);

                    doc.font('Helvetica').text('Commitment Deposit:', 50, yStart + 80);
                    doc.font('Helvetica-Bold').text(`KES ${commitments.toLocaleString()}`, 150, yStart + 80);

                    doc.moveTo(50, yStart + 110).lineTo(mid - 20, yStart + 110).stroke();
                    doc.fontSize(12).text('TOTAL SECURITY', 50, yStart + 120);
                    doc.fontSize(14).text(`KES ${(savings + commitments).toLocaleString()}`, 50, yStart + 135);


                    // RIGHT: COMPANY POSITION
                    doc.rect(mid + 10, yStart, mid - 50, 200).fillOpacity(0.05).fill('#00008B').stroke('#00008B').fillOpacity(1);
                    doc.fillColor('#00008B').fontSize(14).font('Helvetica-Bold').text('COMPANY FUNDS', mid + 20, yStart + 20);

                    doc.fontSize(10).font('Helvetica').text('Capital Top-Ups:', mid + 20, yStart + 50);
                    doc.font('Helvetica-Bold').text(`KES ${topups.toLocaleString()}`, mid + 120, yStart + 50);

                    doc.font('Helvetica').text('Product Financing:', mid + 20, yStart + 80);
                    doc.font('Helvetica-Bold').text(`KES ${products.toLocaleString()}`, mid + 120, yStart + 80);

                    doc.moveTo(mid + 20, yStart + 110).lineTo(doc.page.width - 40, yStart + 110).stroke();
                    doc.fontSize(12).text('TOTAL EXPOSURE', mid + 20, yStart + 120);
                    doc.fontSize(14).text(`KES ${(topups + products).toLocaleString()}`, mid + 20, yStart + 135);

                    // NET POSITION
                    doc.moveDown(8);
                    const net = (topups + products) - (savings + commitments);
                    const msg = net > 0 ? "Net Company Risk (Uncovered)" : "Fully Secured (Surplus)";
                    const color = net > 0 ? 'red' : 'green';

                    doc.fontSize(16).fillColor(color).text(`${msg}: KES ${Math.abs(net).toLocaleString()}`, { align: 'center' });

                    // Footer
                    doc.fontSize(8).fillColor('gray').text('This statement confirms the mutual partnership standing. UKOMBOZINI INVESTMENT FINANCIAL SERVICES.', 40, 750, { align: 'center' });

                    // Watermark loop
                    let pc = doc.bufferedPageRange();
                    for (let i = 0; pc && i < pc.count; i++) {
                        doc.switchToPage(i);
                        doc.save();
                        doc.opacity(0.05);
                        if (fs.existsSync(logoPath)) doc.image(logoPath, (doc.page.width - 300) / 2, (doc.page.height - 100) / 2, { width: 300 });
                        doc.restore();
                    }

                    doc.end();

                }).catch(reject);
            });
        });
    }
};

module.exports = reportService;
