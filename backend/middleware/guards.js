const db = require('../db');

/**
 * ❄️ Freeze Guard Middleware
 * checks if systems, officers, or groups are frozen before mutations.
 */
const checkFreeze = (scope) => {
    return (req, res, next) => {
        // 1. GLOBAL SYSTEM LOCKDOWN
        db.get("SELECT value FROM system_settings WHERE key = 'SYSTEM_LOCKDOWN'", (err, row) => {
            if (row && row.value === 'true') {
                if (req.user && (req.user.role === 'director' || req.user.role === 'admin')) {
                    // Director Bypass
                } else {
                    return res.status(503).json({ error: 'SYSTEM FROZEN: Emergency Lockdown Active' });
                }
            }

            // 2. OFFICER FREEZE
            if (req.user && req.user.role !== 'director') {
                db.get("SELECT status FROM officers WHERE id = ?", [req.user.id], (err, officer) => {
                    if (officer && officer.status !== 'active') {
                        return res.status(403).json({ error: 'ACCOUNT FROZEN: Contact Director' });
                    }
                    proceedToGroupCheck();
                });
            } else {
                proceedToGroupCheck();
            }
        });

        const proceedToGroupCheck = async () => {
            if (scope !== 'GROUP') return next();

            let groupId = req.body.groupId || req.body.group_id || req.params.groupId;
            const sessionId = req.body.sessionId || req.body.session_id;
            const registrationId = req.body.registration_id;

            if (!groupId) {
                if (sessionId) {
                    const session = await new Promise(r => db.get("SELECT groupId FROM meeting_sessions WHERE id = ?", [sessionId], (err, row) => r(row)));
                    groupId = session?.groupId;
                } else if (registrationId) {
                    const reg = await new Promise(r => db.get("SELECT m.group_id FROM project_registrations pr JOIN members m ON pr.member_id = m.id WHERE pr.id = ?", [registrationId], (err, row) => r(row)));
                    groupId = reg?.group_id;
                }
            }

            if (!groupId) return next();

            // 3. GROUP GOVERNANCE & FREEZE
            const govQuery = `
                SELECT 
                    is_frozen,
                    (SELECT COUNT(*) FROM group_officials WHERE group_id = ? AND role = 'Treasurer' AND status = 'active' AND date('now') <= date(term_end)) as has_treasurer,
                    (SELECT COUNT(*) FROM group_officials WHERE group_id = ? AND status = 'active' AND date('now') > date(term_end)) as expired_officials
                FROM groups WHERE id = ?
            `;

            db.get(govQuery, [groupId, groupId, groupId], (err, group) => {
                // Administrative Bypass for Governance Rules during Setup
                const isStaff = req.user && (req.user.role === 'director' || req.user.role === 'admin');

                if (group) {
                    if (group.is_frozen === 1 && !isStaff) {
                        return res.status(403).json({ error: 'GROUP FROZEN: No financial actions allowed' });
                    }
                    if (group.has_treasurer === 0 && !isStaff) {
                        return res.status(403).json({ error: "GOVERNANCE ERROR: Group lacks an active/valid Treasurer." });
                    }
                    if (group.expired_officials > 0 && !isStaff) {
                        return res.status(403).json({ error: "GOVERNANCE ERROR: Leadership terms have expired." });
                    }
                }
                next();
            });
        };
    };
};

module.exports = { checkFreeze };
