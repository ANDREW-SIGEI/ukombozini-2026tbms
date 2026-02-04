const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const axios = require('axios');

// SMS Gateway Config (Africa's Talking)
const SMS_CONFIG = {
    username: process.env.AT_USERNAME || 'sandbox',
    apiKey: process.env.AT_API_KEY || '',
    from: process.env.AT_SENDER_ID || 'UKOMBOZI',
    baseUrl: 'https://api.africastalking.com/version1'
};

/**
 * 📱 SMS Automation Router
 */

// POST /api/sms/broadcast - Dynamic Broadcast to Targets
router.post('/broadcast', authenticateToken, isAdmin, async (req, res) => {
    const { target, targetIds, message, method } = req.body;

    if (!target || !targetIds || !message) {
        return res.status(400).json({ error: "Target, targetIds and message are required." });
    }

    try {
        let recipients = [];

        if (target === 'ROLES') {
            // targetIds: ['Chairman', 'Secretary', 'Treasurer']
            // Map 'Chairman' to 'chairperson_id' etc.
            const roleMap = { 'Chairman': 'chairperson_id', 'Secretary': 'secretary_id', 'Treasurer': 'treasurer_id' };
            const columns = targetIds.map(r => roleMap[r]).filter(Boolean);

            if (columns.length > 0) {
                const subQuery = columns.map(col => `SELECT ${col} as member_id FROM groups`).join(' UNION ');
                const query = `
                    SELECT DISTINCT m.id as memberId, m.phone, m.name 
                    FROM members m
                    WHERE m.id IN (${subQuery}) AND m.phone IS NOT NULL
                `;
                recipients = await new Promise((resolve, reject) => {
                    db.all(query, (err, rows) => err ? reject(err) : resolve(rows));
                });
            }
        } else if (target === 'OFFICERS') {
            // targetIds: ['Field Officer', 'Director', 'Admin']
            const query = `SELECT id as memberId, phone, name FROM officers WHERE role IN (${targetIds.map(() => '?').join(',')}) AND phone IS NOT NULL`;
            recipients = await new Promise((resolve, reject) => {
                db.all(query, targetIds, (err, rows) => err ? reject(err) : resolve(rows));
            });
        } else if (target === 'GROUPS') {
            // targetIds: [id1, id2...]
            const query = `SELECT id as memberId, phone, name FROM members WHERE group_id IN (${targetIds.map(() => '?').join(',')}) AND phone IS NOT NULL`;
            recipients = await new Promise((resolve, reject) => {
                db.all(query, targetIds, (err, rows) => err ? reject(err) : resolve(rows));
            });
        } else if (target === 'MEMBERS') {
            // targetIds: [m1, m2...]
            const query = `SELECT id as memberId, phone, name FROM members WHERE id IN (${targetIds.map(() => '?').join(',')}) AND phone IS NOT NULL`;
            recipients = await new Promise((resolve, reject) => {
                db.all(query, targetIds, (err, rows) => err ? reject(err) : resolve(rows));
            });
        } else if (target === 'CUSTOM') {
            // req.body.recipients: [{phone, message}]
            recipients = req.body.recipients || [];
        }

        if (recipients.length === 0) {
            return res.json({ sent: 0, failed: 0, message: "No recipients found for this target." });
        }

        // Reuse the sending logic (Batch Sending)
        const results = { sent: 0, failed: 0, logs: [] };

        for (const r of recipients) {
            try {
                let logStatus = 'SENT';
                let cost = 0.8;

                if (SMS_CONFIG.username !== 'sandbox' && SMS_CONFIG.apiKey) {
                    const response = await axios.post(`${SMS_CONFIG.baseUrl}/messaging`,
                        new URLSearchParams({ username: SMS_CONFIG.username, to: r.phone, message: message, from: SMS_CONFIG.from }),
                        { headers: { 'apiKey': SMS_CONFIG.apiKey, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' } }
                    );
                    const recipientData = response.data.SMSMessageData?.Recipients?.[0];
                    if (recipientData && recipientData.status === 'Success') {
                        logStatus = 'SENT';
                        cost = parseFloat(recipientData.cost.split(' ')[1]) || 0.8;
                    } else { logStatus = 'FAILED'; }
                } else {
                    console.log(`[SMS BROADCAST MOCK] To: ${r.phone} | Msg: ${message}`);
                }

                await new Promise((resolve, reject) => {
                    db.run(`INSERT INTO sms_logs (member_id, phone, message, type, status, cost) VALUES (?, ?, ?, ?, ?, ?)`,
                        [r.memberId, r.phone, message, `BROADCAST_${target}`, logStatus, cost], (err) => err ? reject(err) : resolve());
                });

                if (logStatus === 'SENT') results.sent++;
                else results.failed++;
            } catch (err) {
                results.failed++;
                db.run(`INSERT INTO sms_logs (member_id, phone, message, type, status, error_message) VALUES (?, ?, ?, ?, 'FAILED', ?)`,
                    [r.memberId, r.phone, message, `BROADCAST_${target}`, err.message]);
            }
        }

        res.json({ ...results, success: true, message: `Broadcast transmission complete. Sent: ${results.sent}, Failed: ${results.failed}` });

    } catch (err) {
        console.error("Broadcast Error:", err);
        res.status(500).json({ error: "Failed to process broadcast transmission" });
    }
});

// POST /api/sms/reminders - Trigger Bulk Reminders (List based)
router.post('/reminders', authenticateToken, async (req, res) => {
    const { type, recipients } = req.body;

    if (!type || !recipients || !Array.isArray(recipients)) {
        return res.status(400).json({ error: "Invalid request. Type and recipients array required." });
    }

    const results = { sent: 0, failed: 0, logs: [] };

    for (const item of recipients) {
        const { phone, message, memberId } = item;
        try {
            let logStatus = 'SENT';
            let cost = 0.8;

            if (SMS_CONFIG.username !== 'sandbox' && SMS_CONFIG.apiKey) {
                const response = await axios.post(`${SMS_CONFIG.baseUrl}/messaging`,
                    new URLSearchParams({ username: SMS_CONFIG.username, to: phone, message: message, from: SMS_CONFIG.from }),
                    { headers: { 'apiKey': SMS_CONFIG.apiKey, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' } }
                );
                const recipientData = response.data.SMSMessageData?.Recipients?.[0];
                if (recipientData && recipientData.status === 'Success') {
                    logStatus = 'SENT';
                    cost = parseFloat(recipientData.cost.split(' ')[1]) || 0.8;
                } else { logStatus = 'FAILED'; }
            } else {
                console.log(`[SMS MOCK] To: ${phone} | Msg: ${message}`);
            }

            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO sms_logs (member_id, phone, message, type, status, cost) VALUES (?, ?, ?, ?, ?, ?)`,
                    [memberId, phone, message, type, logStatus, cost], (err) => err ? reject(err) : resolve());
            });

            if (logStatus === 'SENT') results.sent++;
            else results.failed++;
        } catch (error) {
            results.failed++;
            db.run(`INSERT INTO sms_logs (member_id, phone, message, type, status, error_message) VALUES (?, ?, ?, ?, 'FAILED', ?)`,
                [memberId, phone, message, type, error.message]);
        }
    }
    res.json(results);
});

// GET /api/sms/balance - Check AT Wallet Balance
router.get('/balance', authenticateToken, isAdmin, async (req, res) => {
    if (SMS_CONFIG.username === 'sandbox') {
        return res.json({ balance: 'UNLIMITED (Sandbox Mode)' });
    }

    try {
        const response = await axios.get(`${SMS_CONFIG.baseUrl}/user`, {
            params: { username: SMS_CONFIG.username },
            headers: { 'apiKey': SMS_CONFIG.apiKey }
        });
        res.json({ balance: response.data?.UserData?.balance || 'Unknown' });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch SMS balance" });
    }
});

// GET /api/sms/logs - Fetch Recent SMS Activity
router.get('/logs', authenticateToken, isAdmin, (req, res) => {
    db.all(`
        SELECT l.*, m.name as member_name 
        FROM sms_logs l
        LEFT JOIN members m ON l.member_id = m.id
        ORDER BY l.created_at DESC LIMIT 100
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
