// =====================================================
// SMS SERVICE - AFRICA'S TALKING INTEGRATION
// Kenya's most reliable SMS gateway
// =====================================================

import axios from 'axios';

const SMS_CONFIG = {
    username: process.env.REACT_APP_AT_USERNAME || 'sandbox',
    apiKey: process.env.REACT_APP_AT_API_KEY || '',
    from: process.env.REACT_APP_AT_SENDER_ID || 'UKOMBOZI',
    baseUrl: 'https://api.africastalking.com/version1'
};

class SMSService {
    /**
     * Send SMS through Africa's Talking
     * @param {string} to - Phone number (format: +254712345678)
     * @param {string} message - Message content (max 160 chars for single SMS)
     * @returns {Promise<Object>} - Gateway response
     */
    static async sendSMS(to, message) {
        // Mock mode for development
        if (SMS_CONFIG.username === 'sandbox' || !SMS_CONFIG.apiKey) {
            console.log('📲 [SMS MOCK] Sending to:', to);
            console.log('📩 [SMS MOCK] Message:', message);

            return {
                success: true,
                mock: true,
                messageId: `MOCK-${Date.now()}`,
                cost: 'KES 0.80',
                status: 'Success'
            };
        }

        try {
            const response = await axios.post(
                `${SMS_CONFIG.baseUrl}/messaging`,
                new URLSearchParams({
                    username: SMS_CONFIG.username,
                    to: to,
                    message: message,
                    from: SMS_CONFIG.from
                }),
                {
                    headers: {
                        'apiKey': SMS_CONFIG.apiKey,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    }
                }
            );

            const data = response.data;

            if (data.SMSMessageData?.Recipients?.[0]) {
                const recipient = data.SMSMessageData.Recipients[0];

                return {
                    success: recipient.status === 'Success',
                    messageId: recipient.messageId,
                    cost: recipient.cost,
                    status: recipient.status,
                    statusCode: recipient.statusCode,
                    raw: data
                };
            }

            throw new Error('Invalid response from SMS gateway');
        } catch (error) {
            console.error('❌ SMS Error:', error.message);

            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status
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
        phone = phone.replace(/[\s\-\(\)]/g, '');

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
     * Check SMS balance (if supported by gateway)
     */
    static async checkBalance() {
        if (SMS_CONFIG.username === 'sandbox') {
            return { balance: 'UNLIMITED (Sandbox Mode)' };
        }

        try {
            const response = await axios.get(
                `${SMS_CONFIG.baseUrl}/user`,
                {
                    params: { username: SMS_CONFIG.username },
                    headers: { 'apiKey': SMS_CONFIG.apiKey }
                }
            );

            return {
                balance: response.data?.UserData?.balance || 'Unknown'
            };
        } catch (error) {
            console.error('❌ Balance check error:', error.message);
            return { balance: 'Error', error: error.message };
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
