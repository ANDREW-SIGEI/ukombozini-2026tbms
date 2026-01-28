import jsPDF from 'jspdf';
import 'jspdf-autotable';

// BRAND COLORS
const SAFARICOM_GREEN = [67, 176, 42]; // #43B02A
const DARK_GREY = [60, 60, 60];
const LIGHT_GREY = [240, 240, 240];

const PdfService = {

    /**
     * Initialize Layout with Premium Header/Footer
     */
    initDoc(title, subtitle, orientation = 'portrait') {
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
    generateMemberStatement(member, transactions, dateRange) {
        const { doc, addFooter } = this.initDoc("Account Statement", `Member: ${member.name} (${member.id}) | Period: ${dateRange}`);

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
     * GENERATE DIVIDEND VOUCHER
     */
    generateDividendVoucher(run, allocation) {
        const { doc, addFooter, PageWidth } = this.initDoc("DIVIDEND VOUCHER", `FY: ${run.year} | Ref: DIV-${run.year}-${allocation.memberId}`, 'landscape');
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
    }
};

export default PdfService;
