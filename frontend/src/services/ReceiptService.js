import { api } from './api';
import { toast } from 'react-toastify';

/**
 * UKOMBOZINI Receipt Service
 * Generates professional PDF receipts for transactions.
 */
const ReceiptService = {

    /**
     * Generate Transaction Receipt
     * @param {Object} member - Member details
     * @param {Object} tx - Transaction details { id, amount, type, date, officer, notes }
     */
    async generateReceipt(member, tx) {
        if (!tx || !tx.id) {
            console.error("Receipt generation failed: Missing transaction ID");
            return;
        }

        // Trigger backend premium receipt download
        try {
            await api.downloadReceiptPDF(tx.id);
        } catch (error) {
            console.error("Failed to download receipt:", error);
        }
    },

    async resendSMSReceipt(member, tx) {
        if (!tx || !tx.id) return;
        try {
            const amountStr = Math.abs(tx.amount).toLocaleString();
            const message = `UKOMBOZINI: Receipt Re-sent. Confirmed KES ${amountStr} for ${tx.type}. Ref: ${tx.id}.`;
            await api.resendSMSReceipt({
                memberId: member.id,
                txRef: tx.id,
                message
            });
            toast.success("Receipt SMS Queued");
        } catch (error) {
            toast.error("Failed to re-send SMS");
        }
    }
};

export default ReceiptService;
