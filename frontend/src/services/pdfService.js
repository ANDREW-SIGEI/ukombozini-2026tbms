// Dynamic imports used in methods instead
// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';

// BRAND COLORS
const SAFARICOM_GREEN = [67, 176, 42]; // #43B02A
const DARK_GREY = [60, 60, 60];



const PdfService = {

    /**
     * Initialize Layout with Premium Header/Footer
     */
    async initDoc(title, subtitle, orientation = 'portrait') {
        // Optimizing bundle size: Load libraries only when needed
        const { default: jsPDF } = await import('jspdf');
        await import('jspdf-autotable');

        const doc = new jsPDF(orientation);
        const PageWidth = doc.internal.pageSize.width;
        const PageHeight = doc.internal.pageSize.height;

        // --- HEADER ---
        // Green Brand Strip
        doc.setFillColor(...SAFARICOM_GREEN);
        doc.rect(0, 0, PageWidth, 25, 'F');

        // Logo / Brand Text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("UKOMBOZI", 15, 17);
        // doc.text("TBMS", 70, 17); // Optional suffix

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("Table Banking Management System", 150, 12, { align: 'right' });
        doc.text("Excellence | Integrity | Growth", 150, 18, { align: 'right' });

        // Document Title Block
        doc.setTextColor(...DARK_GREY);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), 15, 40);

        // Green Underline for Title
        doc.setDrawColor(...SAFARICOM_GREEN);
        doc.setLineWidth(1.5);
        doc.line(15, 43, 80, 43);

        if (subtitle) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text(subtitle, 15, 50);
        }

        // --- FOOTER FUNCTION ---
        const addFooter = () => {
            const pageCount = doc.internal.getNumberOfPages();
            const now = new Date().toLocaleString();

            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);

                // Thin Green Line at bottom
                doc.setDrawColor(...SAFARICOM_GREEN);
                doc.setLineWidth(0.5);
                doc.line(15, PageHeight - 15, PageWidth - 15, PageHeight - 15);

                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Generated: ${now}`, 15, PageHeight - 10);
                doc.text(`CONFIDENTIAL - INTERNAL USE ONLY`, PageWidth / 2, PageHeight - 10, { align: 'center' });
                doc.text(`Page ${i} of ${pageCount}`, PageWidth - 15, PageHeight - 10, { align: 'right' });
            }
        };

        return { doc, addFooter, PageWidth, PageHeight };
    },

    /**
     * GENERATE MEMBER STATEMENT
     */
    async generateMemberStatement(member, transactions, dateRange) {
        const { doc, addFooter } = await this.initDoc("Account Statement", `Member: ${member.name} (${member.id}) | Period: ${dateRange}`);

        // Summary Card
        // Box Calculation
        const startY = 60;
        doc.setFillColor(248, 250, 248); // Very light green bg
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(15, startY, 180, 25, 2, 2, 'FD');

        const labelX = 20;
        const valueX = 55;
        const labelX2 = 110;
        const valueX2 = 140;
        const row1 = startY + 8;
        const row2 = startY + 16;

        doc.setFontSize(10);
        doc.setTextColor(100);

        doc.text("Member Name:", labelX, row1);
        doc.text("Phone No:", labelX, row2);
        doc.text("Group:", labelX2, row1);
        doc.text("Current Savings:", labelX2, row2);

        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text(member.name, valueX, row1);
        doc.text(member.phone || "N/A", valueX, row2);
        doc.text(member.groupName || "General", valueX2, row1);

        doc.setTextColor(...SAFARICOM_GREEN);
        doc.text(`KES ${(member.current_savings || 0).toLocaleString()}`, valueX2, row2);

        // --- TABLE ---
        const headers = [["Date", "Ref", "Type", "Description", "Debit", "Credit", "Balance"]];

        // Data Processing
        let runningBalance = 0; // We assume transactions are ordered or we should sort them
        // Note: Ideally, we should fetch 'Opening Balance' or calculate it.
        // For 'All Time', opening is 0. 

        const sortedTx = [...transactions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const data = sortedTx.map(t => {
            const amount = t.amount || (t.savings_amount + t.loan_interest + t.fines + t.welfare) || 0;
            const isCredit = ['Savings', 'LoanRepayment', 'DividendPayout', 'Contribution'].includes(t.transaction_type);
            const isDebit = ['Withdrawal', 'LoanIssue'].includes(t.transaction_type);

            // Rough Running Balance (Visual Only - might act weird if types are complex)
            if (isCredit) runningBalance += amount;
            if (isDebit) runningBalance -= amount;

            return [
                new Date(t.created_at).toLocaleDateString(),
                `TX-${t.id}`,
                t.transaction_type,
                t.description,
                isDebit ? amount.toLocaleString() : "-",
                isCredit ? amount.toLocaleString() : "-",
                runningBalance.toLocaleString() // Show calculated balance
            ];
        });

        doc.autoTable({
            startY: startY + 35,
            head: headers,
            body: data,
            theme: 'grid',
            headStyles: {
                fillColor: SAFARICOM_GREEN,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 9,
                cellPadding: 3
            },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 20 },
                2: { cellWidth: 30 },
                3: { cellWidth: 'auto' },
                4: { cellWidth: 25, halign: 'right', textColor: [200, 0, 0] }, // Debit Red
                5: { cellWidth: 25, halign: 'right', textColor: [0, 100, 0] }, // Credit Green
                6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            }
        });

        addFooter();
        doc.save(`Statement_${member.name.replace(/\s+/g, '_')}.pdf`);
    },

    /**
     * GENERATE GROUP STATEMENT (Consolidated)
     */
    async generateGroupStatement(group, transactions, dateRange) {
        const { doc, addFooter } = await this.initDoc("Group Ledger", `Group: ${group.name} | Period: ${dateRange}`);

        // Summary Card
        const startY = 60;
        doc.setFillColor(248, 250, 248);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(15, startY, 180, 25, 2, 2, 'FD');

        const labelX = 20;
        const valueX = 55;
        const labelX2 = 110;
        const valueX2 = 140;
        const row1 = startY + 8;
        const row2 = startY + 16;

        doc.setFontSize(10);
        doc.setTextColor(100);

        doc.text("Group Name:", labelX, row1);
        doc.text("Total Members:", labelX, row2);
        doc.text("Total Transactions:", labelX2, row1);
        doc.text("Report Date:", labelX2, row2);

        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text(group.name, valueX, row1);
        doc.text(`${group.member_count || '-'} Members`, valueX, row2);
        doc.text(`${transactions.length}`, valueX2, row1);
        doc.text(new Date().toLocaleDateString(), valueX2, row2);

        // --- TABLE ---
        const headers = [["Date", "Member", "Ref", "Type", "Debit (Out)", "Credit (In)"]];

        // Data Processing - Sort by date descending (Newest first) or ascending? 
        // Ledgers usually ascending for balance calculation, but since there's no single balance, Descending is better for history.
        // Let's do Descending (Newest first) as requested by general utility
        const sortedTx = [...transactions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const data = sortedTx.map(t => {
            const amount = t.amount || (t.savings_amount + t.loan_interest + t.fines + t.welfare) || 0;
            const isCredit = ['Savings', 'LoanRepayment', 'DividendPayout', 'Contribution', 'SocialWelfare'].includes(t.transaction_type);
            // Note: DividendPayout is Money OUT from Group perspective if checking cash, but IN for member.
            // This is a "Member Activity Log" for the group. 
            // So Credits = Member Deposits. Debits = Member Withdrawals/Loans.

            const isDebit = ['Withdrawal', 'LoanIssue'].includes(t.transaction_type);

            return [
                new Date(t.created_at).toLocaleDateString(),
                t.memberName || 'Unknown',
                `TX-${t.id}`,
                t.transaction_type,
                isDebit ? amount.toLocaleString() : "-",
                isCredit ? amount.toLocaleString() : "-"
            ];
        });

        doc.autoTable({
            startY: startY + 35,
            head: headers,
            body: data,
            theme: 'grid',
            headStyles: {
                fillColor: SAFARICOM_GREEN,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 3
            },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 40, fontStyle: 'bold' },
                2: { cellWidth: 20 },
                3: { cellWidth: 35 },
                4: { cellWidth: 30, halign: 'right', textColor: [200, 0, 0] }, // Debit Red
                5: { cellWidth: 30, halign: 'right', textColor: [0, 100, 0] }  // Credit Green
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            }
        });

        addFooter();
        doc.save(`Group_Ledger_${group.name.replace(/\s+/g, '_')}.pdf`);
    },

    /**
     * GENERATE DIVIDEND VOUCHER
     */
    async generateDividendVoucher(run, allocation) {
        const { doc, addFooter, PageWidth } = await this.initDoc("DIVIDEND VOUCHER", `FY: ${run.year} | Ref: DIV-${run.year}-${allocation.memberId}`, 'landscape');
        // Landscape for voucher to look like a check/certificate

        // Fancy Border
        doc.setDrawColor(...SAFARICOM_GREEN);
        doc.setLineWidth(3);
        doc.rect(10, 10, PageWidth - 20, doc.internal.pageSize.height - 20);

        // Repositioning content for Landscape
        // Title handled by initDoc but might need adjustment for landscape center

        const centerX = PageWidth / 2;

        // Payout Amount Box
        doc.setFillColor(240, 255, 240);
        doc.roundedRect(centerX - 40, 70, 80, 25, 4, 4, 'F');
        doc.setTextColor(...SAFARICOM_GREEN);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(`KES ${allocation.netDividend.toLocaleString()}`, centerX, 88, { align: 'center' });
        doc.setFontSize(10);
        doc.text("NET PAYOUT AMOUNT", centerX, 68, { align: 'center' });

        // Details Grid
        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');

        const leftCol = 40;
        const rightCol = 180;
        const rowH = 12;
        let y = 110;

        doc.text(`Payee: ${allocation.name}`, leftCol, y);
        doc.text(`Member ID: ${allocation.memberId}`, rightCol, y);
        y += rowH;

        doc.text(`Average Shares: ${allocation.averageShares.toLocaleString()}`, leftCol, y);
        doc.text(`Dividend Rate: ${run.dividendRate.toFixed(4)}`, rightCol, y);
        y += rowH;

        doc.text(`Gross Dividend: KES ${allocation.grossDividend.toLocaleString()}`, leftCol, y);
        doc.text(`Status: PAID (Credited)`, rightCol, y);

        y += 20;
        doc.setDrawColor(200);
        doc.line(40, y, PageWidth - 40, y);

        y += 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text("This document serves as an official receipt of dividend payment credited to your savings account.", centerX, y, { align: 'center' });
        doc.text("Authorized by Ukombozi Board of Directors.", centerX, y + 6, { align: 'center' });

        addFooter();
        doc.save(`Dividend_Voucher_${allocation.name}.pdf`);
    },
    /**
     * GENERATE LOAN SCHEDULE
     */
    async generateLoanSchedule(loans, stats) {
        const { doc, addFooter } = await this.initDoc("Loan Portfolio Schedule", "Active & Defaulted Loans");

        // Summary Statistics
        doc.setFontSize(12);
        doc.setTextColor(...DARK_GREY);
        doc.text("Portfolio Summary", 15, 58);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Total Active Principal:`, 15, 65);
        doc.text(`Active Loans Count:`, 15, 71);
        doc.text(`Defaulted Count:`, 80, 71);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(`KES ${stats.totalPrincipal.toLocaleString()}`, 55, 65);
        doc.text(`${stats.countActive}`, 55, 71);
        doc.setTextColor(200, 0, 0);
        doc.text(`${stats.countDefaulted}`, 115, 71);

        const data = loans.map(l => [
            l.id,
            l.members?.full_name || 'Unknown',
            `KES ${l.principal_amount?.toLocaleString()}`,
            `KES ${l.total_repayable?.toLocaleString()}`,
            l.duration_months + ' M',
            l.status,
            new Date(l.created_at).toLocaleDateString()
        ]);

        doc.autoTable({
            startY: 80,
            head: [['ID', 'Member', 'Principal', 'Repayable', 'Term', 'Status', 'Issued']],
            body: data,
            theme: 'grid',
            headStyles: { fillColor: SAFARICOM_GREEN },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 'auto' },
                2: { halign: 'right', fontStyle: 'bold' },
                3: { halign: 'right' },
                4: { halign: 'center' },
                5: { fontStyle: 'bold', halign: 'center' },
                6: { halign: 'right' }
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 5) {
                    const status = data.cell.raw;
                    if (status === 'active' || status === 'Active') data.cell.styles.textColor = [0, 100, 0];
                    if (status === 'defaulted' || status === 'Defaulted') data.cell.styles.textColor = [200, 0, 0];
                }
            }
        });

        addFooter();
        doc.save(`Loan_Schedule_${new Date().toISOString().split('T')[0]}.pdf`);
    },
    /**
     * GENERATE PROJECT MATRIX
     */
    async generateProjectMatrix(groupMatrix, groupName) {
        const { doc, addFooter } = await this.initDoc("Project Savings Matrix", `Group: ${groupName}`);

        // Summary Statistics
        const totalSaved = groupMatrix.reduce((sum, m) => sum + (m.edu_saved || 0) + (m.agri_saved || 0), 0);
        const totalPayout = totalSaved * 1.5;

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("Group Performance:", 15, 60);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(`Total Project Pool: KES ${totalSaved.toLocaleString()}`, 15, 66);
        doc.setTextColor(...SAFARICOM_GREEN);
        doc.text(`Predicted Jan Payout: KES ${totalPayout.toLocaleString()}`, 15, 72);

        const data = groupMatrix.map(m => {
            const saved = (m.edu_saved || 0) + (m.agri_saved || 0);
            return [
                m.name,
                `KES ${(m.edu_saved || 0).toLocaleString()}`,
                `KES ${(m.agri_saved || 0).toLocaleString()}`,
                `KES ${saved.toLocaleString()}`,
                `KES ${(saved * 1.5).toLocaleString()}`,
                saved >= 2000 ? 'MAX CAP' : 'ACTIVE'
            ];
        });

        doc.autoTable({
            startY: 80,
            head: [['Member Name', 'Education', 'Agriculture', 'Total Invested', 'Jan Payout (150%)', 'Status']],
            body: data,
            theme: 'grid',
            headStyles: { fillColor: SAFARICOM_GREEN },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right', fontStyle: 'bold' },
                4: { halign: 'right', textColor: [0, 100, 0], fontStyle: 'bold' },
                5: { halign: 'center', fontStyle: 'bold' }
            }
        });

        addFooter();
        doc.save(`Project_Matrix_${groupName.replace(/\s+/g, '_')}.pdf`);
    },
    /**
     * GENERATE DAILY CASH CLOSING SLIP
     */
    async generateDailyClosingSlip(report, summary, user, groupName) {
        // Use A4 for detailed report
        const { doc, addFooter, PageWidth } = await this.initDoc("Daily Cash Closing Slip", `Group: ${groupName} | Date: ${report.date}`);

        let y = 60;

        // 1. OFFICER DETAILS
        doc.setFillColor(245, 245, 245);
        doc.rect(15, y, PageWidth - 30, 20, 'F');
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("Field Officer:", 20, y + 8);
        doc.text("Session ID:", 110, y + 8);
        doc.text("Status:", 20, y + 16);

        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text(user.name, 45, y + 8);
        doc.text(report.sys_ref || 'N/A', 135, y + 8);

        if (report.isBalanced) {
            doc.setTextColor(...SAFARICOM_GREEN);
            doc.text("BALANCED & VERIFIED", 45, y + 16);
        } else {
            doc.setTextColor(200, 0, 0);
            doc.text("DISCREPANCY FLAGGED", 45, y + 16);
        }

        y += 30;

        // 2. CASH FLOW SUMMARY (High Level)
        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.text("1. Cash Flow Summary", 15, y);
        doc.setDrawColor(...SAFARICOM_GREEN);
        doc.line(15, y + 2, 70, y + 2);
        y += 6;

        const summaryData = [
            ["Opening Balance (B/F)", `KES ${(report.morning_balance || 0).toLocaleString()}`],
            ["Total Cash Collected (In)", `KES ${summary.totalIn.toLocaleString()}`],
            ["Total Cash Disbursed (Out)", `(KES ${summary.totalOut.toLocaleString()})`],
            ["Net Cash at Hand", `KES ${summary.netCash.toLocaleString()}`],
            ["Banked Amount (Treasury)", `KES ${summary.banked.toLocaleString()}`]
        ];

        doc.autoTable({
            startY: y,
            head: [['Description', 'Amount']],
            body: summaryData,
            theme: 'grid',
            headStyles: { fillColor: DARK_GREY },
            bodyStyles: { fontSize: 10 },
            columnStyles: {
                0: { cellWidth: 100 },
                1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' }
            }
        });

        y = doc.lastAutoTable.finalY + 15;

        // 3. DETAILED BREAKDOWNS (Side by Side)
        const leftX = 15;
        const rightX = PageWidth / 2 + 5;
        const tableWidth = (PageWidth - 40) / 2;

        doc.text("2. Collection Details (Cash In)", leftX, y);
        doc.text("3. Disbursement Details (Cash Out)", rightX, y);
        y += 5;

        // Cash In Data
        // We assume 'summary' object has these details passed from frontend calculatedTotals
        // If not, we use placeholders or expect the caller (DailyCashReport.jsx) to pass a rich summary object.
        // Let's assume standard structure:
        const cashInData = [
            ["Savings Deposits", summary.totalSavings || 0],
            ["Loan Repayments (Principal)", summary.loanPrincipal || 0],
            ["Loan Interest", summary.loanInterest || 0],
            ["Insurance / STLs", summary.totalStl || 0], // Collapsed for brevity or specific field
            ["Welfare", summary.totalWelfare || 0],
            ["Project Fund", summary.totalProject || 0],
            ["Fines & Penalities", summary.totalFines || 0]
        ].map(r => [r[0], `KES ${r[1].toLocaleString()}`]);

        // Cash Out Data
        const cashOutData = [
            ["Loans Issued", summary.totalLoansIssued || 0],
            ["Member Withdrawals", summary.totalWithdrawals || 0],
            ["Expenses / Other", 0]
        ].map(r => [r[0], `KES ${r[1].toLocaleString()}`]);

        // Draw Side-by-Side Tables manually or using autoTable with specific margins
        doc.autoTable({
            startY: y,
            head: [['Type', 'Amount']],
            body: cashInData,
            theme: 'striped',
            margin: { left: leftX, right: PageWidth - (leftX + tableWidth) },
            tableWidth: tableWidth,
            headStyles: { fillColor: [40, 167, 69] }, // Green
            columnStyles: { 1: { halign: 'right' } }
        });

        const finalY1 = doc.lastAutoTable.finalY;

        doc.autoTable({
            startY: y,
            head: [['Type', 'Amount']],
            body: cashOutData,
            theme: 'striped',
            margin: { left: rightX, right: 15 },
            tableWidth: tableWidth,
            headStyles: { fillColor: [220, 53, 69] }, // Red
            columnStyles: { 1: { halign: 'right' } }
        });

        const finalY2 = doc.lastAutoTable.finalY;
        y = Math.max(finalY1, finalY2) + 15;

        // 4. MANUAL DENOMINATION SECTION (For physical verification)
        doc.text("4. Treasury Cash Count (Manual Entry)", 15, y);
        y += 5;

        const denoms = [
            ['1000', '', ''],
            ['500', '', ''],
            ['200', '', ''],
            ['100', '', ''],
            ['50', '', ''],
            ['Coins', '', '']
        ];

        doc.autoTable({
            startY: y,
            head: [['Note/Coin', 'Count', 'Total Value']],
            body: denoms,
            theme: 'grid',
            tableWidth: tableWidth, // Use half width
            headStyles: { fillColor: [100, 100, 100] },
            bodyStyles: { lineColor: [200, 200, 200], lineWidth: 0.1 }
        });

        // Add Disclaimer/Notes space on the right
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("Notes / Observations:", rightX, y + 10);
        doc.rect(rightX, y + 15, tableWidth, 40);

        y = doc.lastAutoTable.finalY + 20;

        // 5. SIGNATURES
        if (y + 40 > doc.internal.pageSize.height) {
            doc.addPage();
            y = 40;
        }

        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text("Authorized Signatures:", 15, y);
        y += 5;
        doc.setDrawColor(200);
        doc.line(15, y, PageWidth - 15, y);
        y += 15;

        // Signature Boxes
        const boxWidth = 50;
        const boxHeight = 25;

        doc.rect(20, y, boxWidth, boxHeight);
        doc.rect(80, y, boxWidth, boxHeight);
        doc.rect(140, y, boxWidth, boxHeight);

        y += boxHeight + 5;
        doc.setFontSize(8);
        doc.text("Treasurer", 45, y, { align: 'center' });
        doc.text("Secretary", 105, y, { align: 'center' });
        doc.text("Chairperson", 165, y, { align: 'center' });

        // Disclaimer
        y += 15;
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150);
        doc.text("* By signing, officials confirm the physical cash matches the Net Cash figure above.", PageWidth / 2, y, { align: 'center' });

        addFooter();
        doc.save(`Daily_Closing_Slip_${report.date}.pdf`);
    },

    /**
     * GENERATE CONTACT LIST (Officials)
     */
    async generateContactList(title, contacts) {
        const { doc, addFooter } = await this.initDoc("Contact Directory", title);

        const headers = [["Name", "Role", "Group", "Phone Number"]];
        const data = contacts.map(c => [
            c.name,
            c.role,
            c.groupName,
            c.phone
        ]);

        doc.autoTable({
            startY: 60,
            head: headers,
            body: data,
            theme: 'grid',
            headStyles: { fillColor: [67, 176, 42] }, // SAFARICOM_GREEN matches usage in file
            styles: { fontSize: 10, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 50, fontStyle: 'bold' },
                1: { cellWidth: 40 },
                2: { cellWidth: 50 },
                3: { cellWidth: 'auto', fontStyle: 'bold' }
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            }
        });

        addFooter();
        doc.save(`${title.replace(/\s+/g, '_')}_Contacts.pdf`);
    }
};

export default PdfService;
