import { api } from './api';

const NotificationService = {
    /**
     * Legacy support or single member SMS
     * Routes through backend broadcaster
     */
    sendMemberSMS: async (memberId, message) => {
        return api.sendBulkNotification({
            target: 'MEMBERS', // Note: backend broadcast should support MEMBERS target or just use reminders
            targetIds: [memberId],
            message,
            method: 'SMS'
        });
    },

    /**
     * Generic SMS target (non-member)
     * Backend handles resolution
     */
    sendSMS: async (recipient, message) => {
        // For general one-off SMS, we can use the reminders endpoint
        return api.sendBulkNotification({
            target: 'CUSTOM',
            recipients: [{ phone: recipient, message }]
        });
    },

    getLogs: async (limit = 100) => {
        return api.getNotificationLogs(limit);
    },

    sendBulk: async (data) => {
        // data: { target, targetIds, message, method }
        return api.sendBulkNotification(data);
    }
};

export default NotificationService;
