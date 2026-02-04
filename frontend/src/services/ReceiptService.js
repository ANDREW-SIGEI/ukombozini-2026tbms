import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * UKOMBOZI Receipt Service
 * Generates professional PDF receipts for transactions.
 */
const ReceiptService = {

    /**
     * Generate Transaction Receipt
     * @param {Object} member - Member details
     * @param {Object} tx - Transaction details { id, amount, type, date, officer, notes }
     */
    async generateReceipt(member, tx) {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // 🟢 Branded Header
        doc.setFillColor(0, 142, 60); // Safaricom Green
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("UKOMBOZI TBMS", 20, 25);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("OFFICIAL TRANSACTION RECEIPT", 20, 32);

        // 🔵 Receipt Info Row
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        doc.text(`Receipt #: UKB-TX-${tx.id || 'N/A'}`, 20, 55);
        doc.text(`Date: ${new Date(tx.date || Date.now()).toLocaleString()}`, pageWidth - 20, 55, { align: 'right' });

        // 👤 Member Section
        doc.setFont("helvetica", "bold");
        doc.text("MEMBER DETAILS", 20, 70);
        doc.setLineWidth(0.5);
        doc.line(20, 72, 80, 72);

        doc.setFont("helvetica", "normal");
        doc.text(`Name: ${member.name}`, 20, 80);
        doc.text(`Member ID: ${member.id}`, 20, 85);
        doc.text(`Group: ${member.group_name || 'N/A'}`, 20, 90);

        // 💰 Transaction Details Table
        const tableData = [
            ['Description', tx.type?.replace(/_/g, ' ') || 'Deposit'],
            ['Gross Amount', `KES ${Number(tx.amount || 0).toLocaleString()}.00`],
            ['Status', 'SUCCESSFUL / POSTED'],
            ['Officer', tx.officer || 'Authorized System Staff']
        ];

        doc.autoTable({
            startY: 105,
            head: [['Field', 'Value']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59] }, // Slate 800
            styles: { fontSize: 11, cellPadding: 5 }
        });

        // 📝 Notes Section
        if (tx.notes) {
            const finalY = doc.lastAutoTable.finalY + 15;
            doc.setFont("helvetica", "bold");
            doc.text("REMARKS:", 20, finalY);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(10);
            doc.text(tx.notes, 20, finalY + 7, { maxWidth: pageWidth - 40 });
        }

        // 🔒 Verification Seal
        const footerY = doc.internal.pageSize.getHeight() - 30;
        doc.setLineWidth(0.1);
        doc.line(20, footerY, pageWidth - 20, footerY);

        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("This is a computer-generated receipt. No signature required.", pageWidth / 2, footerY + 10, { align: 'center' });
        doc.text("UKOMBOZINI 2026 TBMS • Digital Field Operations", pageWidth / 2, footerY + 15, { align: 'center' });

        // Save
        doc.save(`Receipt_${member.name.replace(/\s+/g, '_')}_${tx.id || Date.now()}.pdf`);
    }
};

export default ReceiptService;
