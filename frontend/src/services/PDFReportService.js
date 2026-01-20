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
