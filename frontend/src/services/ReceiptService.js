import { api } from './api';

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
        if (!tx || !tx.id) {
            console.error("Receipt generation failed: Missing transaction ID");
            return;
        }

        // Trigger backend premium receipt download
        try {
            await api.downloadReceiptPDF(tx.id);
        } catch (error) {
            console.error("Failed to download receipt:", error);
            // Fallback to minimal notification if needed
        }
    }
};

export default ReceiptService;
