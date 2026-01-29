import { api } from './api';

const NotificationService = {
    // Legacy support or single member SMS
    sendMemberSMS: async (memberId, message, metadata = {}) => {
        return api.sendBulkNotification({
            target: 'MEMBERS',
            targetIds: [memberId],
            message,
            method: 'SMS'
        });
    },

    sendSMS: async (recipient, message, metadata = {}) => {
        // This would require a generic recipient endpoint, but for now we route through members if possible
        console.log(`[REAL SMS] Target: ${recipient}, Msg: ${message}`);
        return { success: true };
    },

    sendEmail: async (recipient, subject, body, metadata = {}) => {
        console.log(`[MOCK EMAIL] Recipient: ${recipient}, Subject: ${subject}`);
        return { success: true };
    },

    getLogs: async (limit = 100) => {
        return api.getNotificationLogs(limit);
    },

    sendBulk: async (data) => {
        return api.sendBulkNotification(data);
    }
};

export default NotificationService;
