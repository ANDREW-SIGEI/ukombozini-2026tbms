const db = require('../db');
const axios = require('axios');

// SMS Gateway Config (Africa's Talking)
const SMS_CONFIG = {
    username: process.env.AT_USERNAME || 'sandbox',
    apiKey: process.env.AT_API_KEY || '',
    from: process.env.AT_SENDER_ID || 'UKOMBOZI',
    baseUrl: 'https://api.africastalking.com/version1'
};

/**
 * 📝 Audit Logging Utility
 */
const logAudit = (action, category, details, officerId = 1, officerName = 'Admin', req = null) => {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';

    db.run(`INSERT INTO audit_logs (action, category, details, officer_id, officer_name, ip_address) VALUES (?, ?, ?, ?, ?, ?)`,
        [action, category, typeof details === 'object' ? JSON.stringify(details) : String(details), officerId, officerName, ip],
        (err) => {
            if (err) console.error("Audit Log Error:", err);
        }
    );
};

const logAndSendSMS = async (targetId, message, type, transactionId = null, targetTable = 'members') => {
    return new Promise(async (resolve, reject) => {
        const table = targetTable === 'officers' ? 'officers' : 'members';

        db.get(`SELECT phone, name FROM ${table} WHERE id = ?`, [targetId], async (err, row) => {
            if (err || !row || !row.phone) {
                console.warn(`SMS Failed: No phone for ID ${targetId} in ${table}`);
                return resolve(false);
            }
            const phone = row.phone;
            const memberId = targetTable === 'members' ? targetId : null;

            let logStatus = 'SENT';
            let cost = 0.8;
            let errorMessage = null;

            try {
                if (SMS_CONFIG.username !== 'sandbox' && SMS_CONFIG.apiKey) {
                    const response = await axios.post(`${SMS_CONFIG.baseUrl}/messaging`,
                        new URLSearchParams({ username: SMS_CONFIG.username, to: phone, message: message, from: SMS_CONFIG.from }),
                        { headers: { 'apiKey': SMS_CONFIG.apiKey, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' } }
                    );
                    const recipientData = response.data.SMSMessageData?.Recipients?.[0];
                    if (recipientData && recipientData.status === 'Success') {
                        logStatus = 'SENT';
                        cost = parseFloat(recipientData.cost.split(' ')[1]) || 0.8;
                    } else {
                        logStatus = 'FAILED';
                        errorMessage = recipientData ? recipientData.status : 'Unknown AT Error';
                    }
                } else {
                    console.log(`[SMS MOCK] To: ${phone} (${row.name}) | Msg: ${message}`);
                }
            } catch (smsErr) {
                console.error("AT SMS Error:", smsErr.message);
                logStatus = 'FAILED';
                errorMessage = smsErr.message;
            }

            db.run(`INSERT INTO sms_logs (member_id, phone, message, type, status, transaction_id, cost, error_message) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [memberId, phone, message, type, logStatus, transactionId, cost, errorMessage], function (logErr) {
                    if (logErr) {
                        console.error("SMS Log Error:", logErr);
                        return resolve(false);
                    }

                    if (transactionId && logStatus === 'SENT') {
                        db.run("UPDATE transactions SET status = 'COMPLETED' WHERE id = ?", [transactionId], (updateErr) => {
                            if (updateErr) console.error("Transaction status update error:", updateErr);
                            resolve(true);
                        });
                    } else {
                        resolve(logStatus === 'SENT');
                    }
                }
            );
        });
    });
};

module.exports = { logAudit, logAndSendSMS };
