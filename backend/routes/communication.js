const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { logAndSendSMS, logAudit } = require('../utils/logger');
const axios = require('axios');

// SMS Gateway Config (Africa's Talking) - Replicated for balance check
const SMS_CONFIG = {
    username: process.env.AT_USERNAME || 'sandbox',
    apiKey: process.env.AT_API_KEY || '',
    baseUrl: 'https://api.africastalking.com/version1'
};

/**
 * 📡 Communication & Bulk SMS Gateway (Consolidated)
 */

// GET /api/communication/balance - SMS Infrastructure Check
router.get('/balance', authenticateToken, async (req, res) => {
    if (SMS_CONFIG.username === 'sandbox') {
        return res.json({ balance: "UNLIMITED (Sandbox Mode)", provider: "UKOMBOZI-MOCK" });
    }

    try {
        const response = await axios.get(`${SMS_CONFIG.baseUrl}/user`, {
            params: { username: SMS_CONFIG.username },
            headers: { 'apiKey': SMS_CONFIG.apiKey }
        });
        res.json({
            balance: response.data?.UserData?.balance || 'Unknown',
            provider: "Africa's Talking"
        });
    } catch (error) {
        console.error("SMS Balance Error:", error.message);
        res.status(500).json({ error: "Failed to fetch SMS balance" });
    }
});

// POST /api/communication/bulk - Multi-threaded Broadcast
router.post('/bulk', authenticateToken, async (req, res) => {
    const { target, targetIds, message, recipients: customRecipients } = req.body;
    const authorId = req.user.id;

    if (!message || !target) {
        return res.status(400).json({ error: "Missing required broadcast parameters (target, message)." });
    }

    try {
        let sql = "";
        let params = [];
        let recipients = [];

        if (target === 'CUSTOM' && customRecipients) {
            recipients = customRecipients;
        } else if (target === 'GROUPS') {
            sql = `SELECT phone, name, id FROM members WHERE group_id IN (${targetIds.map(() => '?').join(',')}) AND phone IS NOT NULL`;
            params = targetIds;
        } else if (target === 'MEMBERS') {
            sql = `SELECT phone, name, id FROM members WHERE id IN (${targetIds.map(() => '?').join(',')}) AND phone IS NOT NULL`;
            params = targetIds;
        } else if (target === 'ROLES') {
            // targetIds: ['Chairman', 'Secretary', 'Treasurer']
            // Combine group_officials (new) and groups table legacy columns for maximum reach
            sql = `
                SELECT DISTINCT phone, name, id FROM (
                    SELECT m.phone, m.name, m.id 
                    FROM members m
                    JOIN group_officials go ON m.id = go.member_id
                    WHERE go.role IN (${targetIds.map(() => '?').join(',')}) 
                      AND go.status = 'active'
                    UNION
                    SELECT m.phone, m.name, m.id
                    FROM members m
                    JOIN groups g ON (m.id = g.chairperson_id OR m.id = g.secretary_id OR m.id = g.treasurer_id)
                    WHERE m.phone IS NOT NULL
                )
            `;
            // Repeat targetIds for both parts of the union if needed, but the second part handles all roles globally
            // Let's simplify the SQL to be more direct.
            params = targetIds;
        } else if (target === 'OFFICERS') {
            sql = `SELECT phone, name, id FROM officers WHERE role IN (${targetIds.map(() => '?').join(',')}) AND phone IS NOT NULL`;
            params = targetIds;
        }

        if (sql) {
            recipients = await new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
            });
        }

        if (recipients.length === 0) {
            return res.status(404).json({ error: "No recipients found for the selected audience." });
        }

        const stats = { sent: 0, failed: 0 };

        // Broadcaster Loop
        for (const person of recipients) {
            if (!person.phone) continue;

            try {
                const type = `BROADCAST_${target}`;
                // person.id might be missing for CUSTOM
                const success = await logAndSendSMS(person.id || 0, message, type, null, target === 'OFFICERS' ? 'officers' : 'members');
                if (success) stats.sent++;
                else stats.failed++;
            } catch (sendErr) {
                console.error(`Failed to send to ${person.name || person.phone}:`, sendErr);
                stats.failed++;
            }
        }

        logAudit(`Bulk Broadcast: ${target}`, 'communication', {
            target,
            count: recipients.length,
            sent: stats.sent
        }, authorId, req.user.name, req);

        res.json({
            success: true,
            message: `Broadcast complete: ${stats.sent} sent, ${stats.failed} failed.`,
            stats
        });

    } catch (err) {
        console.error("Bulk Communication Error:", err);
        res.status(500).json({ error: "Communication gateway failure." });
    }
});

// POST /api/communication/reminders - Bulk Reminders (List based)
router.post('/reminders', authenticateToken, async (req, res) => {
    const { type, recipients } = req.body;

    if (!type || !recipients || !Array.isArray(recipients)) {
        return res.status(400).json({ error: "Type and recipients array required." });
    }

    const stats = { sent: 0, failed: 0 };

    for (const item of recipients) {
        try {
            const success = await logAndSendSMS(item.memberId, item.message, type);
            if (success) stats.sent++;
            else stats.failed++;
        } catch (error) {
            console.error(`Reminder failure to ${item.phone}:`, error);
            stats.failed++;
        }
    }

    res.json({ success: true, stats });
});

// GET /api/communication/logs - Recent Delivery History
router.get('/logs', authenticateToken, (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    db.all(`
        SELECT s.*, m.name as recipient_name 
        FROM sms_logs s
        LEFT JOIN members m ON s.member_id = m.id
        ORDER BY s.created_at DESC 
        LIMIT ?
    `, [limit], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
