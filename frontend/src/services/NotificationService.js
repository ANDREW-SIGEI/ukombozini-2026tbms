const NotificationService = {
    sendMemberSMS: async (memberId, message, metadata = {}) => {
        console.log(`[MOCK SMS] MemberId: ${memberId}, Msg: ${message}`);
        return { success: true };
    },
    sendSMS: async (recipient, message, metadata = {}) => {
        console.log(`[MOCK SMS] Recipient: ${recipient}, Msg: ${message}`);
        return { success: true };
    },
    sendEmail: async (recipient, subject, body, metadata = {}) => {
        console.log(`[MOCK EMAIL] Recipient: ${recipient}, Subject: ${subject}`);
        return { success: true };
    },
    getLogs: async (limit = 50) => {
        return [];
    }
};

export default NotificationService;
