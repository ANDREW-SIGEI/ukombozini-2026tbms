import { axiosInstance } from './api';

class SMSService {
    /**
     * Send SMS through Central Backend API
     * @param {string} to - Phone number
     * @param {string} message - Message content
     * @param {string} type - Category (Contribution, Loan, etc.)
     * @param {number} memberId - Optional member ID for logging
     * @returns {Promise<Object>} - API response
     */
    static async sendSMS(to, message, type = 'General', memberId = null) {
        try {
            const response = await axiosInstance.post('/sms/reminders', {
                type,
                recipients: [{ phone: to, message, memberId }]
            });

            return {
                success: response.data.sent > 0,
                status: response.data.sent > 0 ? 'Success' : 'Failed',
                raw: response.data
            };
        } catch (error) {
            console.error('❌ SMS Backend Error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send contribution confirmation SMS
     */
    static async sendContributionSMS(member, amount, newBalance, meetingNumber, groupName) {
        const message = `UKOMBOZI: KES ${amount.toLocaleString()} savings received on ${new Date().toLocaleDateString('en-GB')}. Balance: KES ${newBalance.toLocaleString()}. Meeting #${meetingNumber} - ${groupName}.`;

        return await this.sendSMS(member.phone, message);
    }

    /**
     * Send loan repayment confirmation SMS
     */
    static async sendLoanRepaymentSMS(member, amount, remainingBalance, meetingNumber) {
        const message = `UKOMBOZI: KES ${amount.toLocaleString()} loan repayment received. Loan Balance: KES ${remainingBalance.toLocaleString()}. Meeting #${meetingNumber}. Thank you.`;

        return await this.sendSMS(member.phone, message);
    }

    /**
     * Send loan disbursement SMS
     */
    static async sendLoanDisbursementSMS(member, loanAmount, installment, months, totalRepayable) {
        const message = `UKOMBOZI: Loan of KES ${loanAmount.toLocaleString()} disbursed. Installment: KES ${installment.toLocaleString()} for ${months} months. Total repayable: KES ${totalRepayable.toLocaleString()}. Thank you.`;

        return await this.sendSMS(member.phone, message);
    }

    /**
     * Send loan approval SMS
     */
    static async sendLoanApprovalSMS(member, amount, applicationNumber) {
        const message = `UKOMBOZI: Your loan application for KES ${amount.toLocaleString()} has been APPROVED. Visit your group meeting for disbursement. App #${applicationNumber}.`;

        return await this.sendSMS(member.phone, message);
    }

    /**
     * Send loan rejection SMS
     */
    static async sendLoanRejectionSMS(member, amount, applicationNumber) {
        const message = `UKOMBOZI: Your loan application #${applicationNumber} for KES ${amount.toLocaleString()} was not approved. Contact your group admin for details.`;

        return await this.sendSMS(member.phone, message);
    }

    /**
     * Send arrears alert SMS
     */
    static async sendArrearsAlertSMS(member, arrearsAmount, officerPhone) {
        const message = `UKOMBOZI: You have arrears of KES ${arrearsAmount.toLocaleString()}. Please clear in next meeting to avoid penalties. Contact: ${officerPhone}.`;

        return await this.sendSMS(member.phone, message);
    }

    /**
     * Send meeting reminder SMS
     */
    static async sendMeetingReminderSMS(member, groupName, meetingDate, time, venue, expectedAmount) {
        const message = `UKOMBOZI: ${groupName} meeting on ${meetingDate} at ${time}. Venue: ${venue}. Expected contribution: KES ${expectedAmount.toLocaleString()}. See you there!`;

        return await this.sendSMS(member.phone, message);
    }

    /**
     * Send dividend posted SMS
     */
    static async sendDividendSMS(member, amount, newBalance) {
        const message = `UKOMBOZI: Annual dividend of KES ${amount.toLocaleString()} posted to your account. New balance: KES ${newBalance.toLocaleString()}. Thank you for your membership.`;

        return await this.sendSMS(member.phone, message);
    }

    /**
     * Validate Kenya phone number format
     * @param {string} phone - Phone number
     * @returns {string|null} - Formatted phone number or null if invalid
     */
    static validateKenyanPhone(phone) {
        // Remove spaces and special characters
        phone = phone.replace(/[\s\-()]/g, '');

        // Kenya formats: 0712345678, 712345678, +254712345678, 254712345678
        const patterns = [
            /^(\+254|254)?([71]\d{8})$/,  // Safaricom/Airtel
            /^0([71]\d{8})$/               // Local format
        ];

        for (const pattern of patterns) {
            const match = phone.match(pattern);
            if (match) {
                const number = match[2] || match[1];
                return `+254${number}`;
            }
        }

        return null;
    }

    /**
     * Calculate SMS cost (Kenya rates)
     * @param {string} message - Message content
     * @returns {number} - Estimated cost in KES
     */
    static calculateCost(message) {
        const smsCount = Math.ceil(message.length / 160);
        const costPerSMS = 0.80; // KES per SMS (typical bulk rate)
        return smsCount * costPerSMS;
    }

    /**
     * Check SMS balance through Central Backend API
     */
    static async checkBalance() {
        try {
            const response = await axiosInstance.get('/sms/balance');
            return response.data;
        } catch (error) {
            console.error('❌ Balance check error:', error.message);
            return { balance: 'Error', error: error.message };
        }
    }

    /**
     * Send bulk SMS through Central Backend API
     */
    static async sendBulk(type, recipients) {
        try {
            const response = await axiosInstance.post('/sms/reminders', {
                type,
                recipients
            });
            return response.data;
        } catch (error) {
            console.error('❌ Bulk SMS Backend Error:', error.message);
            throw error;
        }
    }
}

export default SMSService;

// =====================================================
// USAGE EXAMPLES:
//
// import SMSService from './services/SMSService';
//
// // Send contribution SMS
// const result = await SMSService.sendContributionSMS(
//     member,
//     2000,
//     95000,
//     'MTG-202501-001',
//     'Ukombozi Group A'
// );
//
// // Check if sent successfully
// if (result.success) {
//     console.log('SMS sent! ID:', result.messageId);
// }
// =====================================================
