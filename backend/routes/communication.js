const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { logAndSendSMS, logAudit } = require('../utils/logger');
const { calculateNextMeeting, getSeasonalGreeting } = require('../utils/dates');
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
            sql = `
                SELECT m.phone, m.name, m.id, m.current_savings, 
                       (m.education_savings + m.agriculture_savings) as project_balance, 
                       m.active_loan_balance, g.meetingDay, g.name as group_name
                FROM members m
                JOIN groups g ON m.group_id = g.id
                WHERE m.group_id IN (${targetIds.map(() => '?').join(',')}) AND m.phone IS NOT NULL`;
            params = targetIds;
        } else if (target === 'MEMBERS') {
            sql = `
                SELECT m.phone, m.name, m.id, m.current_savings, 
                       (m.education_savings + m.agriculture_savings) as project_balance, 
                       m.active_loan_balance, g.meetingDay, g.name as group_name
                FROM members m
                JOIN groups g ON m.group_id = g.id
                WHERE m.id IN (${targetIds.map(() => '?').join(',')}) AND m.phone IS NOT NULL`;
            params = targetIds;
        } else if (target === 'ROLES') {
            sql = `
                SELECT DISTINCT phone, name, id, current_savings, project_balance, active_loan_balance, meetingDay, group_name FROM (
                    SELECT m.phone, m.name, m.id, m.current_savings, 
                           (m.education_savings + m.agriculture_savings) as project_balance, 
                           m.active_loan_balance, g.meetingDay, g.name as group_name
                    FROM members m
                    JOIN group_officials go ON m.id = go.member_id
                    JOIN groups g ON m.group_id = g.id
                    WHERE go.role IN (${targetIds.map(() => '?').join(',')}) 
                      AND go.status = 'active'
                    UNION
                    SELECT m.phone, m.name, m.id, m.current_savings, 
                           (m.education_savings + m.agriculture_savings) as project_balance, 
                           m.active_loan_balance, g.meetingDay, g.name as group_name
                    FROM members m
                    JOIN groups g ON (m.id = g.chairperson_id OR m.id = g.secretary_id OR m.id = g.treasurer_id)
                    WHERE m.phone IS NOT NULL
                )
            `;
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

            let finalMessage = message;
            if (req.body.variables) {
                const nextMeeting = calculateNextMeeting(person.meetingDay);
                finalMessage = message
                    .replace(/\[NAME\]/g, person.name || 'Member')
                    .replace(/\[PHONE\]/g, person.phone || '')
                    .replace(/\[GROUP\]/g, person.group_name || 'Your Group')
                    .replace(/\[SAVINGS\]/g, person.current_savings ? (person.current_savings).toLocaleString() : '0')
                    .replace(/\[PROJECT_BAL\]/g, person.project_balance ? (person.project_balance).toLocaleString() : '0')
                    .replace(/\[LOAN_BAL\]/g, person.active_loan_balance ? (person.active_loan_balance).toLocaleString() : '0')
                    .replace(/\[NEXT_MEETING\]/g, nextMeeting);
            }

            finalMessage += getSeasonalGreeting();

            try {
                const type = `BROADCAST_${target}`;
                const success = await logAndSendSMS(person.id || 0, finalMessage, type, null, target === 'OFFICERS' ? 'officers' : 'members');
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

// POST /api/communication/resend-receipt - Manual receipt trigger
router.post('/resend-receipt', authenticateToken, async (req, res) => {
    const { memberId, txRef, message } = req.body;

    if (!memberId || !txRef || !message) {
        return res.status(400).json({ error: "Member ID, Transaction Ref, and Message are required." });
    }

    try {
        const success = await logAndSendSMS(memberId, message, 'RECEIPT_RESEND', txRef, 'members');
        if (success) {
            res.json({ success: true, message: "Receipt SMS re-sent successfully." });
        } else {
            res.status(500).json({ error: "Failed to send SMS. Check logs." });
        }
    } catch (err) {
        console.error("Resend Receipt Error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

module.exports = router;
