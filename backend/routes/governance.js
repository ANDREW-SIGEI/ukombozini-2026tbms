const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/logger');
const RiskService = require('../services/RiskService');
const AuditService = require('../services/AuditService');

/**
 * 🏛️ Governance & Risk API
 */

// GET /api/governance/status
router.get('/status', authenticateToken, (req, res) => {
    db.all("SELECT * FROM system_settings", (err, settings) => {
        if (err) return res.json({ system_lockdown: false });

        const lockdown = settings.find(s => s.key === 'SYSTEM_LOCKDOWN')?.value === 'true';
        res.json({
            system_lockdown: lockdown,
            server_time: new Date().toISOString()
        });
    });
});

// GET /api/governance/audit-logs
router.get('/audit-logs', authenticateToken, isAdmin, (req, res) => {
    db.all(`
        SELECT al.*, u.name as officer_name 
        FROM audit_logs al
        LEFT JOIN officers u ON al.performed_by = u.id
        ORDER BY al.timestamp DESC LIMIT 50
    `, (err, logs) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(logs);
    });
});

// GET /api/audit/snapshot (Historical Snapshot)
router.get('/snapshot', authenticateToken, isAdmin, async (req, res) => {
    const { date, groupId } = req.query;
    if (!date) return res.status(400).json({ error: "Date parameter is required (YYYY-MM-DD)" });

    try {
        const snapshot = await AuditService.getSnapshot(date, groupId);
        res.json(snapshot);
    } catch (err) {
        console.error("Snapshot Error:", err);
        res.status(500).json({ error: "Failed to calculate historical snapshot" });
    }
});

// POST /api/governance/freeze
router.post('/freeze', authenticateToken, isAdmin, (req, res) => {
    const { scope, targetId, reason } = req.body;
    const officerId = req.user.id;

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        let updateQuery = "";
        let params = [];

        if (scope === 'SYSTEM') {
            updateQuery = "UPDATE system_settings SET value = 'true' WHERE key = 'SYSTEM_LOCKDOWN'";
        } else if (scope === 'GROUP') {
            updateQuery = "UPDATE groups SET is_frozen = 1 WHERE id = ?";
            params = [targetId];
        } else if (scope === 'OFFICER') {
            updateQuery = "UPDATE officers SET status = 'frozen' WHERE id = ?";
            params = [targetId];
        } else {
            db.run("ROLLBACK");
            return res.status(400).json({ error: "Invalid freeze scope" });
        }

        db.run(updateQuery, params, function (err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }

            db.run(`INSERT INTO audit_logs (action, target_type, performed_by, details) VALUES (?, ?, ?, ?)`,
                [`FREEZE_${scope}`, 'SECURITY', officerId, JSON.stringify({ targetId, reason })], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }
                    db.run("COMMIT");
                    logAudit(`Freeze ${scope}: ${targetId || 'SYSTEM'}`, 'SECURITY', { scope, targetId, reason }, officerId, req.user.name, req);
                    res.json({ success: true, message: `${scope} frozen successfully` });
                });
        });
    });
});

// POST /api/governance/unfreeze
router.post('/unfreeze', authenticateToken, isAdmin, (req, res) => {
    const { scope, targetId, reason } = req.body;
    const officerId = req.user.id;

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        let updateQuery = "";
        let params = [];

        if (scope === 'SYSTEM') {
            updateQuery = "UPDATE system_settings SET value = 'false' WHERE key = 'SYSTEM_LOCKDOWN'";
        } else if (scope === 'GROUP') {
            updateQuery = "UPDATE groups SET is_frozen = 0 WHERE id = ?";
            params = [targetId];
        } else if (scope === 'OFFICER') {
            updateQuery = "UPDATE officers SET status = 'active' WHERE id = ?";
            params = [targetId];
        } else {
            db.run("ROLLBACK");
            return res.status(400).json({ error: "Invalid unfreeze scope" });
        }

        db.run(updateQuery, params, function (err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }

            db.run(`INSERT INTO audit_logs (action, target_type, performed_by, details) VALUES (?, ?, ?, ?)`,
                [`UNFREEZE_${scope}`, 'SECURITY', officerId, JSON.stringify({ targetId, reason })], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }
                    db.run("COMMIT");
                    logAudit(`Unfreeze ${scope}: ${targetId || 'SYSTEM'}`, 'SECURITY', { scope, targetId, reason }, officerId, req.user.name, req);
                    res.json({ success: true, message: `${scope} unfrozen successfully` });
                });
        });
    });
});

// GET /api/risk/overview (Group Health List)
router.get('/risk/overview', authenticateToken, isAdmin, async (req, res) => {
    try {
        const heatmap = await new Promise((resolve) => {
            db.all(`
                SELECT g.name, rs.score as riskScore, rs.metrics_snapshot, g.id, g.is_frozen
                FROM groups g
                LEFT JOIN risk_scores rs ON g.id = rs.target_id
                WHERE (rs.scope = 'GROUP' AND rs.id IN (SELECT MAX(id) FROM risk_scores GROUP BY target_id)) OR rs.id IS NULL
            `, (err, rows) => resolve(rows || []));
        });

        // Map data for frontend heatmap widget
        const data = heatmap.map(h => {
            const snapshot = JSON.parse(h.metrics_snapshot || '{}');
            return {
                id: h.id,
                name: h.name,
                riskScore: h.riskScore || 0,
                riskFactors: snapshot.alerts?.map(a => a.msg) || [],
                metrics: {
                    utilization: snapshot.stats?.utilization || 0,
                    repayment_rate: snapshot.stats?.repayment_rate || 100
                }
            };
        });

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/risk/dashboard (Analytics View)
router.get('/risk/dashboard', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [scores, alerts] = await Promise.all([
            new Promise((resolve) => {
                db.all("SELECT * FROM risk_scores ORDER BY calculated_at DESC LIMIT 50", (err, rows) => resolve(rows || []));
            }),
            new Promise((resolve) => {
                db.all("SELECT * FROM risk_alerts WHERE is_resolved = 0 ORDER BY created_at DESC LIMIT 50", (err, rows) => resolve(rows || []));
            })
        ]);

        const heatmap = await new Promise((resolve) => {
            db.all(`
                SELECT g.name as group_name, rs.score, rs.metrics_snapshot, g.id as group_id, g.is_frozen
                FROM groups g
                JOIN risk_scores rs ON g.id = rs.target_id
                WHERE rs.scope = 'GROUP' AND rs.id IN (SELECT MAX(id) FROM risk_scores GROUP BY target_id)
            `, (err, rows) => resolve(rows || []));
        });

        const stats = { total_savings: 0, total_loans: 0, total_liquidity: 0, system_at_risk: 0 };
        heatmap.forEach(h => {
            const metrics = JSON.parse(h.metrics_snapshot || '{}').stats || {};
            stats.total_savings += (metrics.total_savings || 0);
            stats.total_loans += (metrics.total_debt || 0);
            if (h.score >= 70) stats.system_at_risk++;
        });
        stats.total_liquidity = stats.total_savings - stats.total_loans;

        res.json({ scores, alerts, heatmap, stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/system-settings (Mirrored for compatibility)
router.get('/admin/system-settings', authenticateToken, isAdmin, (req, res) => {
    db.all("SELECT * FROM system_settings", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/admin/settings
router.post('/admin/settings', authenticateToken, isAdmin, (req, res) => {
    const { key, value, description } = req.body;
    db.run("INSERT OR REPLACE INTO system_settings (key, value, description) VALUES (?, ?, ?)",
        [key, value, description], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(`Update Setting: ${key}`, 'ADMIN', { value, description }, req.user.id, req.user.name, req);
            res.json({ success: true, key, value });
        });
});

module.exports = router;
