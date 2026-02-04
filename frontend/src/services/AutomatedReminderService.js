/**
 * UKOMBOZI Automated SMS Reminder Service
 * Institutional-Grade SMS Automation
 * 
 * Features:
 * - Scheduled reminders for contributions
 * - Automated loan repayment reminders
 * - Overdue payment alerts
 * - Meeting notifications
 * - Batch SMS sending
 */

import SMSService from './SMSService';

class AutomatedReminderService {
    constructor() {
        this.smsService = new SMSService();
    }

    // ========================================
    // CONTRIBUTION REMINDERS
    // ========================================

    /**
     * Send contribution reminder to all members who haven't paid
     * Should be run at start of each month
     */
    async sendMonthlyContributionReminders(members, currentMonth) {
        const unpaidMembers = members.filter(m => !m.paidThisMonth);
        const recipients = unpaidMembers.map(member => ({
            phone: member.phone,
            message: this.generateContributionReminderMessage(member, currentMonth),
            memberId: member.id
        }));

        if (recipients.length === 0) {
            return { totalSent: 0, totalFailed: 0, details: [] };
        }

        try {
            const result = await SMSService.sendBulk('Contribution Reminder', recipients);
            return {
                totalSent: result.sent,
                totalFailed: result.failed,
                details: result.logs
            };
        } catch (error) {
            return { totalSent: 0, totalFailed: recipients.length, error: error.message };
        }
    }

    /**
     * Generate contribution reminder message
     */
    generateContributionReminderMessage(member, month) {
        const expectedAmount = 2000; // Could be dynamic based on member tier
        const groupName = member.groupName || 'UKOMBOZI';

        return `Dear ${member.name},\n\n` +
            `🔔 REMINDER: Your ${month} contribution of KES ${expectedAmount.toLocaleString()} is due.\n\n` +
            `Group: ${groupName}\n` +
            `Current Savings: KES ${(member.savings || 0).toLocaleString()}\n\n` +
            `Pay at the next meeting or mobile money.\n\n` +
            `UKOMBOZI Table Banking`;
    }

    // ========================================
    // LOAN REPAYMENT REMINDERS
    // ========================================

    /**
     * Send loan repayment reminders 3 days before due date
     */
    async sendLoanRepaymentReminders(loans, daysBefore = 3) {
        const reminders = [];
        const upcomingLoans = this.getUpcomingLoanRepayments(loans, daysBefore);

        for (const loan of upcomingLoans) {
            const message = this.generateLoanReminderMessage(loan, daysBefore);

            try {
                await this.smsService.sendSMS(loan.memberPhone, message);
                reminders.push({
                    loanId: loan.id,
                    memberId: loan.memberId,
                    memberName: loan.memberName,
                    type: 'Loan Repayment Reminder',
                    amount: loan.monthlyRepayment,
                    status: 'Sent',
                    sentAt: new Date().toISOString()
                });
            } catch (error) {
                reminders.push({
                    loanId: loan.id,
                    memberId: loan.memberId,
                    memberName: loan.memberName,
                    type: 'Loan Repayment Reminder',
                    status: 'Failed',
                    error: error.message
                });
            }

            await this.delay(1000);
        }

        return {
            totalSent: reminders.filter(r => r.status === 'Sent').length,
            totalFailed: reminders.filter(r => r.status === 'Failed').length,
            details: reminders
        };
    }

    /**
     * Generate loan repayment reminder message
     */
    generateLoanReminderMessage(loan, daysBefore) {
        const dueDate = new Date(loan.dueDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        return `Dear ${loan.memberName},\n\n` +
            `⏰ LOAN PAYMENT DUE IN ${daysBefore} DAYS\n\n` +
            `Loan ID: ${loan.id}\n` +
            `Amount Due: KES ${loan.monthlyRepayment.toLocaleString()}\n` +
            `Due Date: ${dueDate}\n` +
            `Remaining Balance: KES ${loan.remainingBalance.toLocaleString()}\n\n` +
            `Please ensure payment is made on time to avoid penalties.\n\n` +
            `UKOMBOZI Table Banking`;
    }

    // ========================================
    // OVERDUE ALERTS
    // ========================================

    /**
     * Send urgent alerts for overdue payments
     */
    async sendOverdueAlerts(overdueLoans) {
        const alerts = [];

        for (const loan of overdueLoans) {
            const message = this.generateOverdueAlertMessage(loan);

            try {
                // Send to member
                await this.smsService.sendSMS(loan.memberPhone, message);

                // Also notify guarantors if LTL loan
                if (loan.loanType === 'LTL' && loan.guarantor1Phone) {
                    await this.sendGuarantorAlert(loan, loan.guarantor1Phone);
                }
                if (loan.loanType === 'LTL' && loan.guarantor2Phone) {
                    await this.sendGuarantorAlert(loan, loan.guarantor2Phone);
                }

                alerts.push({
                    loanId: loan.id,
                    memberId: loan.memberId,
                    memberName: loan.memberName,
                    type: 'Overdue Alert',
                    arrears: loan.arrears,
                    status: 'Sent',
                    sentAt: new Date().toISOString()
                });
            } catch (error) {
                alerts.push({
                    loanId: loan.id,
                    memberId: loan.memberId,
                    memberName: loan.memberName,
                    type: 'Overdue Alert',
                    status: 'Failed',
                    error: error.message
                });
            }

            await this.delay(1000);
        }

        return {
            totalSent: alerts.filter(a => a.status === 'Sent').length,
            totalFailed: alerts.filter(a => a.status === 'Failed').length,
            details: alerts
        };
    }

    /**
     * Generate overdue alert message
     */
    generateOverdueAlertMessage(loan) {
        const daysPastDue = Math.floor(
            (new Date() - new Date(loan.dueDate)) / (1000 * 60 * 60 * 24)
        );

        return `🚨 URGENT: OVERDUE PAYMENT\n\n` +
            `Dear ${loan.memberName},\n\n` +
            `Your loan payment is ${daysPastDue} day(s) OVERDUE.\n\n` +
            `Loan ID: ${loan.id}\n` +
            `Arrears: KES ${loan.arrears.toLocaleString()}\n` +
            `Total Outstanding: KES ${loan.remainingBalance.toLocaleString()}\n\n` +
            `⚠️ IMMEDIATE ACTION REQUIRED\n` +
            `Contact your group officer or make payment immediately to avoid further penalties.\n\n` +
            `UKOMBOZI Table Banking`;
    }

    /**
     * Send alert to guarantor
     */
    async sendGuarantorAlert(loan, guarantorPhone) {
        const message = `🔔 GUARANTOR ALERT\n\n` +
            `Member: ${loan.memberName}\n` +
            `Loan ID: ${loan.id}\n` +
            `Status: OVERDUE\n` +
            `Arrears: KES ${loan.arrears.toLocaleString()}\n\n` +
            `As a guarantor, please contact the member to ensure payment.\n\n` +
            `UKOMBOZI Table Banking`;

        await this.smsService.sendSMS(guarantorPhone, message);
    }

    // ========================================
    // MEETING NOTIFICATIONS
    // ========================================

    /**
     * Send meeting notification to all group members
     */
    async sendMeetingNotification(members, meetingDetails) {
        const notifications = [];

        for (const member of members) {
            const message = this.generateMeetingNotificationMessage(member, meetingDetails);

            try {
                await this.smsService.sendSMS(member.phone, message);
                notifications.push({
                    memberId: member.id,
                    memberName: member.name,
                    type: 'Meeting Notification',
                    status: 'Sent',
                    sentAt: new Date().toISOString()
                });
            } catch (error) {
                notifications.push({
                    memberId: member.id,
                    memberName: member.name,
                    type: 'Meeting Notification',
                    status: 'Failed',
                    error: error.message
                });
            }

            await this.delay(1000);
        }

        return {
            totalSent: notifications.filter(n => n.status === 'Sent').length,
            totalFailed: notifications.filter(n => n.status === 'Failed').length,
            details: notifications
        };
    }

    /**
     * Generate meeting notification message
     */
    generateMeetingNotificationMessage(member, meetingDetails) {
        const meetingDate = new Date(meetingDetails.date).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        return `📅 MEETING REMINDER\n\n` +
            `Dear ${member.name},\n\n` +
            `Group: ${meetingDetails.groupName}\n` +
            `Meeting #${meetingDetails.sessionNumber}\n` +
            `Date: ${meetingDate}\n` +
            `Time: ${meetingDetails.time || '2:00 PM'}\n` +
            `Venue: ${meetingDetails.venue || 'Usual location'}\n\n` +
            `Please bring:\n` +
            `✓ Monthly contribution (KES 2,000)\n` +
            `✓ Loan repayments (if applicable)\n` +
            `✓ Member ID\n\n` +
            `UKOMBOZI Table Banking`;
    }

    // ========================================
    // BATCH PROCESSING
    // ========================================

    /**
     * Send bulk SMS to selected members
     */
    async sendBulkSMS(members, message, category = 'General') {
        const results = [];

        for (const member of members) {
            // Personalize message with member name
            const personalizedMessage = message.replace('{{name}}', member.name);

            try {
                await this.smsService.sendSMS(member.phone, personalizedMessage);
                results.push({
                    memberId: member.id,
                    memberName: member.name,
                    phone: member.phone,
                    category: category,
                    status: 'Sent',
                    sentAt: new Date().toISOString()
                });
            } catch (error) {
                results.push({
                    memberId: member.id,
                    memberName: member.name,
                    phone: member.phone,
                    category: category,
                    status: 'Failed',
                    error: error.message
                });
            }

            await this.delay(1000);
        }

        return {
            totalSent: results.filter(r => r.status === 'Sent').length,
            totalFailed: results.filter(r => r.status === 'Failed').length,
            details: results
        };
    }

    // ========================================
    // SCHEDULED TASKS
    // ========================================

    /**
     * Get loans with upcoming repayments
     */
    getUpcomingLoanRepayments(loans, daysBefore) {
        const today = new Date();
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + daysBefore);

        return loans.filter(loan => {
            const dueDate = new Date(loan.dueDate);
            return dueDate.toDateString() === targetDate.toDateString() &&
                loan.status === 'Active';
        });
    }

    /**
     * Delay helper for rate limiting
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========================================
    // SCHEDULER CONFIGURATIONS
    // ========================================

    /**
     * Example cron jobs configuration (for backend implementation)
     */
    static getSchedulerConfig() {
        return {
            monthlyContributionReminder: {
                schedule: '0 9 1 * *', // 9 AM on 1st of each month
                description: 'Send monthly contribution reminders'
            },
            loanRepaymentReminder: {
                schedule: '0 9 * * *', // 9 AM daily
                description: 'Send loan repayment reminders (3 days before due)'
            },
            overdueAlerts: {
                schedule: '0 10 * * *', // 10 AM daily
                description: 'Send overdue payment alerts'
            },
            weeklyMeetingReminder: {
                schedule: '0 18 * * 5', // 6 PM every Friday
                description: 'Send meeting reminder for next week'
            }
        };
    }
}

// ========================================
// MESSAGE TEMPLATES
// ========================================

export const SMS_TEMPLATES = {
    CONTRIBUTION_REMINDER: {
        name: 'Monthly Contribution Reminder',
        message: `Dear {{name}},\n\n🔔 Your {{month}} contribution of KES {{amount}} is due.\n\nPay at the next meeting.\n\nUKOMBOZI`
    },
    LOAN_REMINDER: {
        name: 'Loan Repayment Reminder',
        message: `Dear {{name}},\n\n⏰ Loan payment of KES {{amount}} due on {{date}}.\n\nUKOMBOZI`
    },
    OVERDUE_ALERT: {
        name: 'Overdue Payment Alert',
        message: `🚨 URGENT: Your payment of KES {{amount}} is {{days}} days overdue.\n\nContact us immediately.\n\nUKOMBOZI`
    },
    MEETING_NOTIFICATION: {
        name: 'Meeting Notification',
        message: `📅 MEETING: {{date}} at {{time}}\n\nBring contribution & loan payments.\n\nUKOMBOZI`
    },
    WELCOME_MEMBER: {
        name: 'Welcome New Member',
        message: `Welcome to UKOMBOZI, {{name}}!\n\nYour membership is confirmed.\n\nExpected monthly contribution: KES {{amount}}\n\nUKOMBOZI`
    },
    LOAN_APPROVED: {
        name: 'Loan Approval Notification',
        message: `✅ APPROVED: Your loan of KES {{amount}} has been approved.\n\nDisbursement: {{date}}\n\nUKOMBOZI`
    },
    LOAN_REJECTED: {
        name: 'Loan Rejection Notification',
        message: `❌ DECLINED: Your loan application has been declined.\n\nReason: {{reason}}\n\nContact us for details.\n\nUKOMBOZI`
    },
    CONTRIBUTION_CONFIRMED: {
        name: 'Contribution Confirmation',
        message: `✅ RECEIVED: KES {{amount}} contribution.\n\nNew Balance: KES {{newBalance}}\n\nThank you!\n\nUKOMBOZI`
    }
};

export default AutomatedReminderService;
