const db = require('../db');

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

/**
 * 📱 SMS Logging Utility (Mock)
 */
const logAndSendSMS = (targetId, message, type, transactionId = null, targetTable = 'members') => {
    return new Promise((resolve, reject) => {
        const table = targetTable === 'officers' ? 'officers' : 'members';

        db.get(`SELECT phone FROM ${table} WHERE id = ?`, [targetId], (err, row) => {
            if (err || !row || !row.phone) {
                console.warn(`SMS Failed: No phone for ID ${targetId} in ${table}`);
                return resolve(false);
            }
            const phone = row.phone;
            const memberId = targetTable === 'members' ? targetId : null;

            db.run(`INSERT INTO sms_logs (member_id, phone, message, type, status, transaction_id, cost) 
                    VALUES (?, ?, ?, ?, 'SENT', ?, 1.50)`,
                [memberId, phone, message, type, transactionId], function (logErr) {
                    if (logErr) {
                        console.error("SMS Log Error:", logErr);
                        return resolve(false);
                    }

                    if (transactionId) {
                        db.run("UPDATE transactions SET status = 'COMPLETED' WHERE id = ?", [transactionId], (updateErr) => {
                            if (updateErr) console.error("Transaction status update error:", updateErr);
                            resolve(true);
                        });
                    } else {
                        resolve(true);
                    }
                }
            );
        });
    });
};

module.exports = { logAudit, logAndSendSMS };
