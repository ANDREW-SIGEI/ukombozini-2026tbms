const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/logger');
const RiskService = require('../services/RiskService');
const AuditService = require('../services/AuditService');
const MTEEngine = require('../services/MTEEngine');

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
    const limit = parseInt(req.query.limit) || 50;
    db.all(`
        SELECT * FROM audit_logs 
        ORDER BY created_at DESC LIMIT ?
    `, [limit], (err, logs) => {
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

// GET /api/audit/trail/:memberId (Historical Transaction Trail)
router.get('/trail/:memberId', authenticateToken, isAdmin, async (req, res) => {
    const { memberId } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date parameter is required (YYYY-MM-DD)" });

    try {
        const trail = await AuditService.getMemberTransactionTrail(memberId, date);
        res.json(trail);
    } catch (err) {
        console.error("Audit Trail Error:", err);
        res.status(500).json({ error: "Failed to retrieve transaction trail" });
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
router.get('/overview', authenticateToken, isAdmin, async (req, res) => {
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
router.get('/dashboard', authenticateToken, isAdmin, async (req, res) => {
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
        if (heatmap.length === 0) {
            const fallbackStats = await RiskService.getGlobalRiskStats();
            Object.assign(stats, fallbackStats);
        } else {
            heatmap.forEach(h => {
                const metrics = JSON.parse(h.metrics_snapshot || '{}').stats || {};
                stats.total_savings += (metrics.total_savings || 0);
                stats.total_loans += (metrics.total_debt || 0);
                if (h.score >= 70) stats.system_at_risk++;
            });
            stats.total_liquidity = stats.total_savings - stats.total_loans;
        }

        res.json({ scores, alerts, heatmap, stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/risk/recalculate-all
router.post('/recalculate-all', authenticateToken, isAdmin, async (req, res) => {
    try {
        const groups = await new Promise((resolve) => {
            db.all("SELECT id FROM groups", (err, rows) => resolve(rows || []));
        });

        for (const group of groups) {
            await RiskService.evaluateGroupRisk(group.id);
        }

        logAudit("Global Risk Recalculation", "SECURITY", { count: groups.length }, req.user.id, req.user.name, req);
        res.json({ success: true, message: `Recalculated risk for ${groups.length} groups` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/system-settings (Mirrored for compatibility)
router.get('/system-settings', authenticateToken, isAdmin, (req, res) => {
    db.all("SELECT * FROM system_settings", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/admin/settings
router.post('/settings', authenticateToken, isAdmin, (req, res) => {
    const { key, value, description } = req.body;
    db.run("INSERT OR REPLACE INTO system_settings (key, value, description) VALUES (?, ?, ?)",
        [key, value, description], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(`Update Setting: ${key}`, 'ADMIN', { value, description }, req.user.id, req.user.name, req);
            res.json({ success: true, key, value });
        });
});

// GET /api/admin/officers
router.get('/officers', authenticateToken, isAdmin, (req, res) => {
    db.all("SELECT id, name, email, phone, role, status FROM officers", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/admin/officers (Create/Update)
router.post('/officers', authenticateToken, isAdmin, async (req, res) => {
    const { id, name, email, phone, role, status, password } = req.body;

    if (id) {
        // Update
        const query = `UPDATE officers SET name=?, email=?, phone=?, role=?, status=? WHERE id=?`;
        db.run(query, [name, email, phone, role, status, id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(`Update Officer: ${name}`, 'admin', { id, role });
            res.json({ success: true });
        });
    } else {
        // Create
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password || 'Ukombozi2026!', 10);
        const query = `INSERT INTO officers (name, email, phone, role, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)`;
        db.run(query, [name, email, phone, role, status || 'active', hashedPassword], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(`Create Officer: ${name}`, 'admin', { id: this.lastID, role });
            res.json({ success: true, id: this.lastID });
        });
    }
});

// DELETE /api/admin/officers/:id
router.delete('/officers/:id', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM officers WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(`Delete Officer: ${id}`, 'admin', { id });
        res.json({ success: true });
    });
});

// GET /api/admin/treasury-status
router.get('/treasury-status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const stats = await RiskService.getGlobalRiskStats();
        // Add more detailed bank balance logic if needed from transactions
        res.json([
            { label: 'Total Savings', value: stats.total_savings, status: 'Healthy' },
            { label: 'Active Loan Portfolio', value: stats.total_loans, status: 'Active' },
            { label: 'Available Liquidity', value: stats.total_liquidity, status: stats.total_liquidity > 0 ? 'Normal' : 'Critical' }
        ]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/institutional-stats
router.get('/institutional-stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const stats = await RiskService.getGlobalRiskStats();
        const groupsCount = await new Promise((resolve) => db.get("SELECT COUNT(*) as count FROM groups", (err, row) => resolve(row.count)));
        const membersCount = await new Promise((resolve) => db.get("SELECT COUNT(*) as count FROM members", (err, row) => resolve(row.count)));

        res.json({
            totalSavings: stats.total_savings,
            activeLoans: stats.total_loans,
            totalMembers: membersCount,
            totalGroups: groupsCount,
            complianceRate: 85, // Placeholder for actual calculation
            historical: []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/board-report
router.get('/board-report', authenticateToken, isAdmin, (req, res) => {
    const query = `
        SELECT 
            g.name,
            (SELECT COUNT(*) FROM members WHERE group_id = g.id) as member_count,
            SUM(m.current_savings) as total_savings,
            SUM(m.active_loan_balance) as loan_portfolio,
            g.risk_score,
            'ACTIVE' as session_status
        FROM groups g
        LEFT JOIN members m ON g.id = m.group_id
        GROUP BY g.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET /api/governance/officials - Officials Directory List
router.get('/officials', authenticateToken, async (req, res) => {
    const query = `
        SELECT 
            go.role,
            m.name as member_name,
            m.phone as member_phone,
            g.name as group_name,
            g.id as group_id,
            go.term_start,
            go.status,
            m.id as member_id,
            'OFF-' || go.id as id
        FROM group_officials go
        JOIN members m ON go.member_id = m.id
        JOIN groups g ON go.group_id = g.id
        WHERE go.status = 'active'
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/governance/sessions/:id/attendance - Record attendance and auto-trigger penalties
router.post('/sessions/:id/attendance', authenticateToken, async (req, res) => {
    const sessionId = req.params.id;
    const { memberId, status } = req.body; // status: 'PRESENT', 'ABSENT', 'LATE'
    const officerId = req.user.id;

    if (!memberId || !status) {
        return res.status(400).json({ error: "Member ID and status are required" });
    }

    try {
        const client = await db.beginTransaction();

        try {
            // 1. Upsert attendance record
            await client.query(`
                INSERT INTO attendance (session_id, member_id, status)
                VALUES (?, ?, ?)
                ON CONFLICT(session_id, member_id) DO UPDATE SET 
                    status = excluded.status,
                    recorded_at = CURRENT_TIMESTAMP
            `, [sessionId, memberId, status]);

            let penaltyId = null;
            let message = `Attendance recorded as ${status}`;

            // 2. Trigger automated penalty if ABSENT or LATE
            if (status === 'ABSENT' || status === 'LATE') {
                // Fetch penalty amounts from settings or use defaults
                const penaltySettingKey = status === 'ABSENT' ? 'PENALTY_ABSENCE' : 'PENALTY_LATE';
                const settingsRow = await client.query(`SELECT value FROM system_settings WHERE key = ?`, [penaltySettingKey]);
                const penaltyAmount = settingsRow.rows[0] ? parseFloat(settingsRow.rows[0].value) : (status === 'ABSENT' ? 200 : 50);

                if (penaltyAmount > 0) {
                    const txRef = `AUTO-PEN-${sessionId}-${memberId}-${Date.now()}`;
                    await MTEEngine.runMTELogic(client, {
                        memberId,
                        sessionId,
                        transaction_type: 'PENALTY',
                        amount: penaltyAmount,
                        description: `Automated Penalty: ${status} at Session #${sessionId}`,
                        txRef
                    }, officerId);

                    message += `. Automated penalty of KES ${penaltyAmount} applied.`;
                }
            }

            await db.commit(client);
            res.json({ success: true, message });

        } catch (innerErr) {
            await db.rollback(client);
            throw innerErr;
        }
    } catch (err) {
        console.error("Attendance Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/governance/sessions/:id/attendance - Get attendance for a session
router.get('/sessions/:id/attendance', authenticateToken, (req, res) => {
    const sessionId = req.params.id;
    db.all(`SELECT * FROM attendance WHERE session_id = ?`, [sessionId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/**
 * 📊 Loan & Interest Intelligence
 */

// GET /api/governance/loans/due-summary/:groupId
router.get('/loans/due-summary/:groupId', authenticateToken, (req, res) => {
    const { groupId } = req.params;

    // This logic calculates expected interest and principal due for all active loans in a group
    // based on the repayment_schedule table for the current month/period.
    db.all(`
        SELECT 
            m.id as member_id,
            m.name as member_name,
            l.id as loan_id,
            rs.expected_installment,
            rs.expected_interest,
            rs.expected_principal,
            rs.status as schedule_status
        FROM members m
        JOIN loans l ON m.id = l.member_id
        JOIN repayment_schedule rs ON l.id = rs.loan_id
        WHERE m.group_id = ? 
        AND l.status = 'active'
        AND rs.status = 'pending'
        AND rs.due_date <= date('now', '+30 days') -- Look ahead 30 days
        ORDER BY rs.due_date ASC
    `, [groupId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/**
 * 🛰️ Supervisor Approval Workflow
 */

// POST /api/governance/approvals/request - Submit a session for supervisor review
router.post('/approvals/request', authenticateToken, (req, res) => {
    const { sessionId, reason } = req.body;
    const requesterId = req.user.id;

    if (!sessionId || !reason) {
        return res.status(400).json({ error: "Session ID and reason are required" });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run(`INSERT INTO session_approval_requests (session_id, requester_id, reason) VALUES (?, ?, ?)`,
            [sessionId, requesterId, reason], function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: "Approval request already exists for this session" });
                    }
                    return res.status(500).json({ error: err.message });
                }

                const requestId = this.lastID;

                db.run(`UPDATE meeting_sessions SET status = 'PENDING_APPROVAL' WHERE id = ?`, [sessionId], (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }

                    db.run("COMMIT");
                    logAudit("APPROVAL_REQUESTED", "SECURITY", { sessionId, reason }, requesterId, req.user.name, req);
                    res.json({ success: true, requestId });
                });
            });
    });
});

// GET /api/governance/approvals/pending - List all sessions awaiting review
router.get('/approvals/pending', authenticateToken, isAdmin, (req, res) => {
    const query = `
        SELECT 
            sar.*, 
            ms.date, 
            g.name as group_name,
            o.name as requester_name
        FROM session_approval_requests sar
        JOIN meeting_sessions ms ON sar.session_id = ms.id
        JOIN groups g ON ms.groupId = g.id
        JOIN officers o ON sar.requester_id = o.id
        WHERE sar.status = 'PENDING'
        ORDER BY sar.created_at DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/governance/approvals/review - Approve or Reject a request
router.post('/approvals/review', authenticateToken, isAdmin, (req, res) => {
    const { requestId, status, comments } = req.body; // status: 'APPROVED', 'REJECTED'
    const approverId = req.user.id;

    if (!requestId || !['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ error: "Invalid request data" });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        db.get("SELECT session_id FROM session_approval_requests WHERE id = ?", [requestId], (err, request) => {
            if (err || !request) {
                db.run("ROLLBACK");
                return res.status(404).json({ error: "Approval request not found" });
            }

            const sessionId = request.session_id;

            db.run(`UPDATE session_approval_requests SET status = ?, approver_id = ?, comments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [status, approverId, comments, requestId], function (err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }

                    if (status === 'APPROVED') {
                        // Mark session as ACTIVE (Released for posting)
                        db.run("UPDATE meeting_sessions SET status = 'ACTIVE' WHERE id = ?", [sessionId], (err) => {
                            if (err) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ error: err.message });
                            }
                            db.run("COMMIT");
                            logAudit("SESSION_RELEASED", "SECURITY", { requestId, status, sessionId }, approverId, req.user.name, req);
                            res.json({ success: true });
                        });
                    } else if (status === 'REJECTED') {
                        // Reset session to ACTIVE so officer can correct it
                        db.run("UPDATE meeting_sessions SET status = 'ACTIVE' WHERE id = ?", [sessionId], (err) => {
                            if (err) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ error: err.message });
                            }
                            db.run("COMMIT");
                            logAudit("SESSION_REJECTED", "SECURITY", { requestId, status, sessionId }, approverId, req.user.name, req);
                            res.json({ success: true });
                        });
                    }
                });
        });
    });
});

// GET /api/governance/exposure/:groupId
router.get('/exposure/:groupId', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const complianceMetrics = await RiskService.getGroupComplianceStatus(groupId);
        const riskAnalysis = await RiskService.evaluateGroupRisk(groupId);

        res.json({
            complianceMetrics,
            score: riskAnalysis.score,
            alerts: riskAnalysis.alerts,
            enforcement: riskAnalysis.enforcement
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/governance/officials - Consolidated Officials Directory
router.get('/officials', authenticateToken, (req, res) => {
    const query = `
        SELECT 
            go.id,
            go.role,
            go.term_start,
            go.term_end,
            go.status as status,
            m.name as member_name,
            m.phone as member_phone,
            m.id as member_id,
            g.name as group_name,
            g.id as group_id
        FROM group_officials go
        JOIN members m ON go.member_id = m.id
        JOIN groups g ON go.group_id = g.id
        WHERE go.status = 'active'
        ORDER BY g.name ASC, go.role ASC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;

