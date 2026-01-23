/**
 * UKOMBOZI PDF Report Generation Service
 * Bank-Grade Report Generation
 * 
 * Features:
 * - Member statements
 * - Contribution compliance reports
 * - Loan repayment reports
 * - Meeting reports
 * - Financial summaries
 * - Custom branded PDFs
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';

class PDFReportService {
    constructor() {
        this.logo = null; // Can be set with base64 image
        this.brandColor = [0, 128, 0]; // Safaricom Green RGB
    }

    // ========================================
    // MEMBER STATEMENT
    // ========================================

    /**
     * Generate member statement PDF
     */
    generateMemberStatement(member, transactions, startDate, endDate) {
        const doc = new jsPDF();

        // Add header
        this.addHeader(doc, 'MEMBER STATEMENT');

        // Member details
        let yPos = 40;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Member: ${member.name}`, 14, yPos);
        yPos += 7;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Member ID: ${member.id}`, 14, yPos);
        doc.text(`Group: ${member.groupName}`, 100, yPos);
        yPos += 5;
        doc.text(`Phone: ${member.phone}`, 14, yPos);
        doc.text(`Period: ${startDate} to ${endDate}`, 100, yPos);

        // Financial summary box
        yPos += 10;
        this.addSummaryBox(doc, yPos, [
            { label: 'Current Savings', value: `KES ${member.savings.toLocaleString()}`, color: [0, 128, 0] },
            { label: 'Active Loans', value: `KES ${member.activeLoans.toLocaleString()}`, color: [255, 140, 0] },
            { label: 'Arrears', value: `KES ${member.arrears.toLocaleString()}`, color: member.arrears > 0 ? [255, 0, 0] : [0, 128, 0] }
        ]);

        // Transactions table
        yPos += 35;
        const tableData = transactions.map(t => [
            new Date(t.date).toLocaleDateString('en-GB'),
            t.type,
            t.description || '-',
            t.debit ? `(${t.debit.toLocaleString()})` : '-',
            t.credit ? t.credit.toLocaleString() : '-',
            t.balance.toLocaleString()
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Date', 'Type', 'Description', 'Debit', 'Credit', 'Balance']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: this.brandColor, fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 9 },
            columnStyles: {
                3: { halign: 'right', textColor: [255, 0, 0] },
                4: { halign: 'right', textColor: [0, 128, 0] },
                5: { halign: 'right', fontStyle: 'bold' }
            }
        });

        // Footer
        this.addFooter(doc);

        // Save
        doc.save(`UKOMBOZI_Statement_${member.name.replace(/ /g, '_')}_${new Date().getTime()}.pdf`);
    }

    // ========================================
    // CONTRIBUTION COMPLIANCE REPORT
    // ========================================

    /**
     * Generate contribution compliance report
     */
    generateContributionComplianceReport(month, stats, members) {
        const doc = new jsPDF();

        // Header
        this.addHeader(doc, 'CONTRIBUTION COMPLIANCE REPORT');

        // Period
        let yPos = 40;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Period: ${month}`, 14, yPos);
        yPos += 10;

        // Statistics summary
        this.addSummaryBox(doc, yPos, [
            { label: 'Total Members', value: stats.total.toString() },
            { label: 'Fully Paid', value: `${stats.paidOnTime} (${stats.complianceRate}%)`, color: [0, 128, 0] },
            { label: 'Partial Payment', value: stats.partial.toString(), color: [255, 140, 0] },
            { label: 'Skipped', value: stats.skipped.toString(), color: [255, 0, 0] }
        ]);

        yPos += 40;
        this.addSummaryBox(doc, yPos, [
            { label: 'Total Collected', value: `KES ${stats.totalCollected.toLocaleString()}`, color: [0, 128, 0] },
            { label: 'Expected Amount', value: `KES ${stats.expectedAmount.toLocaleString()}` },
            { label: 'Shortfall', value: `KES ${stats.shortfall.toLocaleString()}`, color: [255, 0, 0] }
        ]);

        // Member details table
        yPos += 45;
        const tableData = members.map(m => [
            m.name,
            m.groupName,
            m.expectedAmount.toLocaleString(),
            m.paidAmount.toLocaleString(),
            m.shortfall > 0 ? m.shortfall.toLocaleString() : '-',
            this.getStatusBadge(m.status)
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Member', 'Group', 'Expected', 'Paid', 'Shortfall', 'Status']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: this.brandColor, fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 9 },
            columnStyles: {
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right', textColor: [255, 0, 0] },
                5: { halign: 'center', fontStyle: 'bold' }
            }
        });

        // Footer
        this.addFooter(doc);

        // Save
        doc.save(`UKOMBOZI_Contribution_Compliance_${month.replace(/ /g, '_')}.pdf`);
    }

    // ========================================
    // LOAN REPAYMENT REPORT
    // ========================================

    /**
     * Generate loan repayment tracking report
     */
    generateLoanRepaymentReport(month, stats, loans) {
        const doc = new jsPDF();

        // Header
        this.addHeader(doc, 'LOAN REPAYMENT TRACKING REPORT');

        // Period
        let yPos = 40;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Period: ${month}`, 14, yPos);
        yPos += 10;

        // Statistics
        this.addSummaryBox(doc, yPos, [
            { label: 'Total Active Loans', value: stats.total.toString() },
            { label: 'Paid On Time', value: `${stats.paidOnTime} (${stats.complianceRate}%)`, color: [0, 128, 0] },
            { label: 'Partial Payment', value: stats.partial.toString(), color: [255, 140, 0] },
            { label: 'Overdue', value: stats.overdue.toString(), color: [255, 0, 0] }
        ]);

        yPos += 40;
        this.addSummaryBox(doc, yPos, [
            { label: 'Total Collected', value: `KES ${stats.totalCollected.toLocaleString()}`, color: [0, 128, 0] },
            { label: 'Expected Repayments', value: `KES ${stats.expectedAmount.toLocaleString()}` },
            { label: 'Total Arrears', value: `KES ${stats.totalArrears.toLocaleString()}`, color: [255, 0, 0] },
            { label: 'Outstanding Balance', value: `KES ${stats.totalOutstanding.toLocaleString()}`, color: [255, 140, 0] }
        ]);

        // Loan details table
        yPos += 45;
        const tableData = loans.map(l => [
            l.id,
            l.memberName,
            l.loanType,
            l.monthlyRepayment.toLocaleString(),
            l.paidThisMonth.toLocaleString(),
            l.arrears > 0 ? l.arrears.toLocaleString() : '-',
            l.remainingBalance.toLocaleString(),
            this.getStatusBadge(l.status)
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Loan ID', 'Member', 'Type', 'Expected', 'Paid', 'Arrears', 'Balance', 'Status']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: this.brandColor, fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right', textColor: [255, 0, 0] },
                6: { halign: 'right' },
                7: { halign: 'center', fontStyle: 'bold' }
            }
        });

        // Footer
        this.addFooter(doc);

        // Save
        doc.save(`UKOMBOZI_Loan_Repayment_${month.replace(/ /g, '_')}.pdf`);
    }

    // ========================================
    // MEETING REPORT
    // ========================================

    /**
     * Generate meeting report
     */
    generateMeetingReport(meeting, attendance, contributions, loans) {
        const doc = new jsPDF();

        // Header
        this.addHeader(doc, 'MEETING REPORT');

        // Meeting details
        let yPos = 40;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Meeting #${meeting.sessionNumber}`, 14, yPos);
        yPos += 7;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Group: ${meeting.groupName}`, 14, yPos);
        doc.text(`Date: ${new Date(meeting.date).toLocaleDateString('en-GB')}`, 100, yPos);
        yPos += 5;
        doc.text(`Officer: ${meeting.officerName || 'N/A'}`, 14, yPos);
        doc.text(`Status: ${meeting.status}`, 100, yPos);

        // Attendance summary
        yPos += 10;
        this.addSummaryBox(doc, yPos, [
            { label: 'Total Members', value: attendance.total.toString() },
            { label: 'Present', value: `${attendance.present} (${((attendance.present / attendance.total) * 100).toFixed(0)}%)`, color: [0, 128, 0] },
            { label: 'Absent', value: attendance.absent.toString(), color: [255, 0, 0] }
        ]);

        // Financial summary
        yPos += 35;
        this.addSummaryBox(doc, yPos, [
            { label: 'Total Contributions', value: `KES ${contributions.total.toLocaleString()}`, color: [0, 128, 0] },
            { label: 'Loans Disbursed', value: `KES ${loans.disbursed.toLocaleString()}`, color: [255, 140, 0] },
            { label: 'Loan Repayments', value: `KES ${loans.repayments.toLocaleString()}`, color: [0, 128, 0] },
            { label: 'Net Cash', value: `KES ${(contributions.total + loans.repayments - loans.disbursed).toLocaleString()}` }
        ]);

        // Transactions table
        yPos += 45;
        const transactions = [...contributions.details, ...loans.details];
        const tableData = transactions.map(t => [
            t.memberName,
            t.type,
            t.amount.toLocaleString(),
            t.method || '-',
            t.notes || '-'
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Member', 'Transaction', 'Amount (KES)', 'Method', 'Notes']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: this.brandColor, fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 9 },
            columnStyles: {
                2: { halign: 'right', fontStyle: 'bold' }
            }
        });

        // Footer
        this.addFooter(doc);

        // Save
        doc.save(`UKOMBOZI_Meeting_${meeting.sessionNumber}_${new Date().getTime()}.pdf`);
    }

    // ========================================
    // HELPER FUNCTIONS
    // ========================================

    /**
     * Add standard header with logo and title
     */
    addHeader(doc, title) {
        // Logo placeholder (if you have base64 image)
        // doc.addImage(this.logo, 'PNG', 14, 10, 30, 30);

        // Title
        doc.setFillColor(...this.brandColor);
        doc.rect(0, 0, 210, 30, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('UKOMBOZI TABLE BANKING', 105, 15, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(title, 105, 23, { align: 'center' });

        // Reset text color
        doc.setTextColor(0, 0, 0);
    }

    /**
     * Add footer with page number and generation date
     */
    addFooter(doc) {
        const pageCount = doc.internal.getNumberOfPages();
        const pageHeight = doc.internal.pageSize.height;

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128);

            // Page number
            doc.text(
                `Page ${i} of ${pageCount}`,
                105,
                pageHeight - 10,
                { align: 'center' }
            );

            // Generation date
            doc.text(
                `Generated: ${new Date().toLocaleString('en-GB')}`,
                14,
                pageHeight - 10
            );

            doc.text(
                'UKOMBOZI Table Banking System',
                195,
                pageHeight - 10,
                { align: 'right' }
            );
        }
    }

    /**
     * Add summary box with statistics
     */
    addSummaryBox(doc, yPos, items) {
        const boxWidth = 180;
        const boxHeight = 25;
        const itemWidth = boxWidth / items.length;

        // Draw box
        doc.setDrawColor(200);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(14, yPos, boxWidth, boxHeight, 3, 3, 'FD');

        // Add items
        items.forEach((item, index) => {
            const x = 14 + (index * itemWidth);
            const centerX = x + (itemWidth / 2);

            // Label
            doc.setFontSize(8);
            doc.setTextColor(128);
            doc.setFont(undefined, 'normal');
            doc.text(item.label, centerX, yPos + 8, { align: 'center' });

            // Value
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            if (item.color) {
                doc.setTextColor(...item.color);
            } else {
                doc.setTextColor(0);
            }
            doc.text(item.value, centerX, yPos + 18, { align: 'center' });
        });

        // Reset
        doc.setTextColor(0);
    }

    /**
     * Get status badge text
     */
    getStatusBadge(status) {
        const badges = {
            'Paid': '✓ PAID',
            'Partial': '⚠ PARTIAL',
            'Overdue': '✗ OVERDUE',
            'Skipped': '✗ SKIPPED'
        };
        return badges[status] || status;
    }

    /**
     * Add colored watermark to all pages
     */
    addWatermark(doc) {
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.saveGraphicsState();
            doc.setTextColor(0, 128, 0); // Safaricom Green
            doc.setFontSize(60);
            doc.setFont(undefined, 'bold');

            // Simulating transparency with light color if GState fails, 
            // but trying GState for true watermark feel
            try {
                // Set alpha/opacity (requires jspdf >= 2.0)
                doc.setGState(new doc.GState({ opacity: 0.1 }));
            } catch (e) {
                // Fallback to very light gray/green if GState not available
                doc.setTextColor(230, 240, 230);
            }

            doc.text("UKOMBOZI OFFICIAL", 105, 150, {
                align: 'center',
                angle: 45,
                renderingMode: 'fill'
            });
            doc.restoreGraphicsState();
        }
    }

    // ========================================
    // DIVIDEND REPORT - INSTITUTIONAL GRADE
    // ========================================

    /**
     * Generate comprehensive dividend distribution report
     * Includes: Formula breakdown, member allocations, TRF policy, audit trail
     */
    generateDividendReport(run, allocations) {
        const doc = new jsPDF('p', 'mm', 'a4');
        let yPos = 0;

        // ==========================================
        // PAGE 1: EXECUTIVE SUMMARY & CALCULATIONS
        // ==========================================

        // Header with Status Badge
        this.addHeader(doc, `DIVIDEND DISTRIBUTION REPORT ${run.financial_year}`);
        yPos = 38;

        // Run ID and Status Badge
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text(`Reference: ${run.run_number}`, 14, yPos);

        // Custom Group Name - Prominent Display
        if (run.manual_group_name || run.group_name) {
            const groupName = run.manual_group_name || run.group_name || 'All Groups';

            // Draw a subtle background for the group name
            doc.setFillColor(240, 255, 240); // Very light green
            doc.setDrawColor(0, 128, 0);
            doc.roundedRect(13, yPos + 2, 120, 12, 1, 1, 'FD');

            doc.setFontSize(16);
            doc.setTextColor(0, 128, 0); // Safaricom Green branding
            doc.setFont(undefined, 'bold');
            doc.text(groupName.toUpperCase(), 16, yPos + 10);
            yPos += 8; // Adjust subsequent spacing
        }

        // Status badge
        const statusColors = {
            'DRAFT': [128, 128, 128],
            'CALCULATED': [33, 150, 243],
            'APPROVED': [76, 175, 80],
            'POSTED': [0, 150, 136],
            'REJECTED': [244, 67, 54]
        };
        const statusColor = statusColors[run.status] || [128, 128, 128];
        doc.setFillColor(...statusColor);
        doc.roundedRect(150, yPos - 5, 45, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text(run.status, 172.5, yPos, { align: 'center' });
        doc.setTextColor(0, 0, 0);

        yPos += 8;
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`Report Date: ${new Date().toLocaleDateString('en-GB')}`, 14, yPos);
        doc.text(`Financial Year: ${run.financial_year}`, 150, yPos);

        // ============================================
        // SECTION 1: INCOME STATEMENT
        // ============================================
        yPos += 10;
        doc.setFillColor(240, 240, 240);
        doc.rect(14, yPos, 182, 7, 'F');
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('📊 INCOME STATEMENT', 16, yPos + 5);
        yPos += 10;

        const incomeStatementData = [
            ['Total Income', `KES ${run.total_income?.toLocaleString() || '0'}`],
            ['Total Expenses', `KES ${run.total_expenses?.toLocaleString() || '0'}`],
            ['Gross Profit', `KES ${run.gross_profit?.toLocaleString() || '0'}`, true],
            ['Administrative Costs', `KES ${run.admin_costs?.toLocaleString() || '0'}`]
        ];

        doc.autoTable({
            startY: yPos,
            body: incomeStatementData,
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 100 },
                1: { halign: 'right', cellWidth: 82 }
            },
            didParseCell: function (data) {
                if (data.row.raw[2]) { // Highlight gross profit
                    data.cell.styles.fillColor = [240, 255, 240];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        // ============================================
        // SECTION 2: TRF DEDUCTIONS (15% POLICY)
        // ============================================
        yPos = doc.lastAutoTable.finalY + 8;
        doc.setFillColor(255, 245, 230);
        doc.rect(14, yPos, 182, 7, 'F');
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 140, 0);
        doc.text('🛡️ TOTAL REGULATORY FUND (TRF) - 15% Policy', 16, yPos + 5);
        doc.setTextColor(0, 0, 0);
        yPos += 10;

        const trfData = [
            ['Mandatory Reserves (10%)', `KES ${run.mandatory_reserves?.toLocaleString() || '0'}`],
            ['Risk Buffer (5%)', `KES ${run.risk_buffer?.toLocaleString() || '0'}`],
            ['Reinvested Capital', `KES ${run.reinvested_capital?.toLocaleString() || '0'}`],
            ['Total TRF Deductions', `KES ${run.trf_deductions?.toLocaleString() || '0'}`, true]
        ];

        doc.autoTable({
            startY: yPos,
            body: trfData,
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 100 },
                1: { halign: 'right', cellWidth: 82, textColor: [255, 140, 0] }
            },
            didParseCell: function (data) {
                if (data.row.raw[2]) {
                    data.cell.styles.fillColor = [255, 245, 230];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        // ============================================
        // SECTION 3: DIVIDEND CALCULATION - SMART BOX
        // ============================================
        yPos = doc.lastAutoTable.finalY + 12;

        // Create a visual container for the most important numbers
        doc.setDrawColor(0, 128, 0);
        doc.setLineWidth(0.5);
        doc.setFillColor(248, 255, 248);
        doc.roundedRect(14, yPos, 182, 35, 3, 3, 'FD');

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 128, 0);
        doc.text('💰 NET DIVIDEND DETERMINATION', 140, yPos + 8, { align: 'right' });

        const netProfit = run.net_profit || 0;
        const shareOutPct = run.share_out_percentage || 70;
        const distributableAmount = (netProfit * shareOutPct) / 100;
        const dividendRate = ((run.dividend_rate || 0) * 100);

        // Left Side: Logic
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.setFont(undefined, 'normal');
        doc.text('Net Profit (After TRF):', 20, yPos + 10);
        doc.setFont(undefined, 'bold');
        doc.text(`KES ${netProfit.toLocaleString()}`, 80, yPos + 10, { align: 'right' });

        doc.setFont(undefined, 'normal');
        doc.text('Share-Out Policy:', 20, yPos + 16);
        doc.setFont(undefined, 'bold');
        doc.text(`${shareOutPct}%`, 80, yPos + 16, { align: 'right' });

        doc.setFont(undefined, 'normal');
        doc.text('Total Member Shares:', 20, yPos + 22);
        doc.setFont(undefined, 'bold');
        doc.text(`${(run.total_avg_shares || 0).toLocaleString()}`, 80, yPos + 22, { align: 'right' });

        // Right Side: The Result (Big & Bold)
        doc.setTextColor(0, 128, 0);
        doc.setFontSize(10);
        doc.text('FINAL DIVIDEND RATE', 140, yPos + 20, { align: 'center' });

        doc.setFontSize(22);
        doc.setFont(undefined, 'bold');
        doc.text(`${dividendRate.toFixed(2)}%`, 140, yPos + 30, { align: 'center' });

        yPos += 38;

        // ============================================
        // SECTION 4: PAYOUT SUMMARY
        // ============================================
        yPos = doc.lastAutoTable.finalY + 8;
        this.addSummaryBox(doc, yPos, [
            { label: 'Eligible Members', value: run.total_members?.toString() || '0' },
            { label: 'Gross Payout', value: `KES ${run.total_gross_payout?.toLocaleString() || '0'}`, color: [0, 128, 0] },
            { label: 'Arrears Offset', value: `KES ${run.total_arrears_offset?.toLocaleString() || '0'}`, color: [255, 140, 0] },
            { label: 'Net Payout', value: `KES ${run.total_net_payout?.toLocaleString() || '0'}`, color: [0, 150, 136] }
        ]);

        // ============================================
        // FORMULA BREAKDOWN BOX
        // ============================================
        // ============================================
        // FORMULA BREAKDOWN BOX - COMPACT & CLEAR
        // ============================================
        yPos = doc.lastAutoTable ? doc.lastAutoTable.finalY + 35 : yPos + 5; // Adjust start
        if (yPos > 240) { doc.addPage(); yPos = 20; }

        doc.setFillColor(242, 242, 247);
        doc.setDrawColor(200, 200, 200);
        doc.rect(14, yPos, 182, 35, 'FD');

        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(33, 150, 243);
        doc.text('📐 INSTITUTIONAL FORMULA BREAKDOWN', 16, yPos + 5);

        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('All calculations are SYSTEM-GENERATED and stored in database generated columns for audit compliance.', 16, yPos + 10);

        doc.setFont(undefined, 'bold');
        doc.text('1. TRF Deductions =', 16, yPos + 16);
        doc.setFont(undefined, 'normal');
        doc.text('Gross Profit × 15% (10% Mandatory + 5% Risk Buffer)', 60, yPos + 16);

        doc.setFont(undefined, 'bold');
        doc.text('2. Net Profit =', 16, yPos + 21);
        doc.setFont(undefined, 'normal');
        doc.text('Income - Expenses - Admin Costs - TRF Deductions', 60, yPos + 21);

        doc.setFont(undefined, 'bold');
        doc.text('3. Dividend Rate =', 16, yPos + 26);
        doc.setFont(undefined, 'normal');
        doc.text(`(Net Profit × ${shareOutPct}%) ÷ Total Average Shares`, 60, yPos + 26);

        doc.setFont(undefined, 'bold');
        doc.text('4. Member Dividend =', 16, yPos + 31);
        doc.setFont(undefined, 'normal');
        doc.text('(Average Shares × Dividend Rate) - Loan Arrears Offset', 60, yPos + 31);

        // ==========================================
        // PAGE 2: MEMBER ALLOCATIONS TABLE
        // ==========================================
        doc.addPage();
        yPos = 20;

        // Section header
        doc.setFillColor(...this.brandColor);
        doc.rect(0, 10, 210, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('MEMBER DIVIDEND ALLOCATIONS', 105, 17, { align: 'center' });
        doc.setTextColor(0, 0, 0);

        // Allocations table
        const tableData = (allocations || []).map((alloc, index) => [
            index + 1,
            alloc.member_name || `Member ${alloc.member_id}`,
            alloc.average_shares?.toLocaleString() || '0',
            alloc.gross_dividend?.toLocaleString() || '0',
            alloc.arrears_offset?.toLocaleString() || '0',
            alloc.net_dividend?.toLocaleString() || '0',
            alloc.posted_to_savings ? '✓' : '-'
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['#', 'Member Name', 'Avg Shares', 'Gross', 'Arrears', 'Net Payout', 'Posted']],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: this.brandColor,
                fontSize: 9,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { cellWidth: 55 },
                2: { halign: 'right', cellWidth: 25 },
                3: { halign: 'right', cellWidth: 25, textColor: [0, 128, 0] },
                4: { halign: 'right', cellWidth: 25, textColor: [255, 140, 0] },
                5: { halign: 'right', cellWidth: 30, fontStyle: 'bold', textColor: [0, 150, 136] },
                6: { halign: 'center', cellWidth: 15 }
            },
            didDrawPage: function (data) {
                // Add footer on each page
                if (data.pageNumber > 1) {
                    doc.setFontSize(8);
                    doc.setTextColor(128);
                    doc.text(
                        `Page ${data.pageNumber}`,
                        105,
                        doc.internal.pageSize.height - 10,
                        { align: 'center' }
                    );
                }
            }
        });

        // ==========================================
        // PAGE 3+ (if needed): AUDIT & SIGNATURES
        // ==========================================
        const finalY = doc.lastAutoTable.finalY;

        // Check if we need a new page
        if (finalY > doc.internal.pageSize.height - 80) {
            doc.addPage();
            yPos = 20;
        } else {
            yPos = finalY + 15;
        }

        // ============================================
        // AUDIT COMPLIANCE SECTION
        // ============================================
        doc.setFillColor(250, 245, 255);
        doc.setDrawColor(156, 39, 176);
        doc.rect(14, yPos, 182, 40, 'FD');

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(156, 39, 176);
        doc.text('🔒 AUDIT & COMPLIANCE', 16, yPos + 6);

        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);

        const auditInfo = [
            `✓ All calculations performed by system-generated database columns`,
            `✓ TRF policy (15%) enforced at database level - cannot be overridden`,
            `✓ Dividend rate calculated from actual profit and share-out policy`,
            `✓ Loan arrears automatically deducted - transparent and fair`,
            `✓ Run is immutable after POSTED status - no retroactive changes allowed`,
            `✓ Complete transaction log maintained in database audit trail`
        ];

        auditInfo.forEach((line, index) => {
            doc.text(line, 16, yPos + 13 + (index * 5));
        });

        // ============================================
        // APPROVAL WORKFLOW
        // ============================================
        yPos += 45;
        doc.setFillColor(240, 240, 240);
        doc.rect(14, yPos, 182, 7, 'F');
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('APPROVAL WORKFLOW', 16, yPos + 5);
        yPos += 10;

        const workflowData = [
            ['Calculated By', run.calculated_by || 'System', run.calculated_at ? new Date(run.calculated_at).toLocaleString('en-GB') : '-'],
            ['Approved By (Director)', run.approved_by || 'Pending', run.approved_at ? new Date(run.approved_at).toLocaleString('en-GB') : '-'],
            ['Posted By (Director)', run.posted_by || 'Pending', run.posted_at ? new Date(run.posted_at).toLocaleString('en-GB') : '-']
        ];

        doc.autoTable({
            startY: yPos,
            body: workflowData,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 60 },
                1: { cellWidth: 60 },
                2: { halign: 'right', cellWidth: 62 }
            }
        });

        // ============================================
        // SIGNATURE SECTION
        // ============================================
        yPos = doc.lastAutoTable.finalY + 15;

        const signatureBoxWidth = 80;
        const signatureBoxHeight = 30;

        // Director Signature
        doc.setDrawColor(200);
        doc.rect(14, yPos, signatureBoxWidth, signatureBoxHeight);
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text('DIRECTOR SIGNATURE:', 16, yPos + 6);
        doc.setFont(undefined, 'normal');
        doc.text('Name: _______________________', 16, yPos + 20);
        doc.text('Date: _______________________', 16, yPos + 26);

        // Treasurer Signature
        doc.rect(110, yPos, signatureBoxWidth, signatureBoxHeight);
        doc.setFont(undefined, 'bold');
        doc.text('TREASURER SIGNATURE:', 112, yPos + 6);
        doc.setFont(undefined, 'normal');
        doc.text('Name: _______________________', 112, yPos + 20);
        doc.text('Date: _______________________', 112, yPos + 26);

        // ============================================
        // OFFICIAL STAMP AREA
        // ============================================
        yPos += signatureBoxHeight + 10;
        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.circle(105, yPos + 15, 20, 'D');
        doc.setFontSize(7);
        doc.setTextColor(128);
        doc.text('OFFICIAL STAMP', 105, yPos + 16, { align: 'center' });

        // ============================================
        // WATERMARK & FOOTER
        // ============================================
        this.addWatermark(doc);
        this.addFooter(doc);

        // Save PDF
        const filename = `UKOMBOZI_Dividend_Report_${run.run_number}_${new Date().getTime()}.pdf`;
        doc.save(filename);

        return filename;
    }

    // ========================================
    // BATCH EXPORT
    // ========================================

    /**
     * Generate multiple reports in a batch
     */
    async generateBatchReports(reportTypes, data) {
        const results = [];

        for (const type of reportTypes) {
            try {
                switch (type) {
                    case 'member-statements':
                        data.members.forEach(member => {
                            this.generateMemberStatement(member, member.transactions, data.startDate, data.endDate);
                        });
                        results.push({ type, status: 'Success', count: data.members.length });
                        break;

                    case 'compliance':
                        this.generateContributionComplianceReport(data.month, data.stats, data.members);
                        results.push({ type, status: 'Success' });
                        break;

                    case 'loan-repayment':
                        this.generateLoanRepaymentReport(data.month, data.stats, data.loans);
                        results.push({ type, status: 'Success' });
                        break;

                    default:
                        results.push({ type, status: 'Unknown type' });
                }
            } catch (error) {
                results.push({ type, status: 'Failed', error: error.message });
            }
        }

        return results;
    }
}

export default PDFReportService;
