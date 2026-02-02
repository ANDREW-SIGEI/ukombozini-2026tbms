/**
 * Mock Email Service - No real email configuration required
 * This stub allows the server to start without email credentials.
 */

const sendEmail = async ({ to, subject, html, text }) => {
    console.log(`[EMAIL MOCK] Would send to: ${to}, Subject: ${subject}`);
    return { success: true, messageId: `mock-${Date.now()}` };
};

module.exports = { sendEmail };
