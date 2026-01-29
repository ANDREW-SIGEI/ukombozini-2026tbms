const db = require('../db');

/**
 * RiskService calculates health and fraud risk scores for groups and officers.
 * 0-40: High Risk (Red)
 * 41-70: Medium Risk (Orange)
 * 71-100: Healthy (Green)
 */
class RiskService {
    /**
     * Calculate risk score for a specific group.
     */
    static async calculateGroupScore(groupId) {
        return new Promise((resolve, reject) => {
            const queries = {
                memberBalances: "SELECT current_savings, active_loan_balance FROM members WHERE group_id = ?",
                lateLoans: "SELECT COUNT(*) as count FROM loans WHERE group_id = ? AND status = 'active' AND due_date < date('now')",
                unbalancedSessions: "SELECT COUNT(*) as count FROM meeting_sessions WHERE groupId = ? AND status = 'UNBALANCED'" // Assuming we add this status
            };

            db.all(queries.memberBalances, [groupId], (err, members) => {
                if (err) return reject(err);

                let score = 100;
                const metrics = {
                    negativeBalances: 0,
                    highLeverageMembers: 0,
                    lateLoans: 0
                };

                members.forEach(m => {
                    if (m.current_savings < 0) {
                        metrics.negativeBalances++;
                        score -= 10;
                    }
                    if (m.active_loan_balance > m.current_savings * 3) {
                        metrics.highLeverageMembers++;
                        score -= 5;
                    }
                });

                db.get(queries.lateLoans, [groupId], (err, row) => {
                    if (!err) {
                        metrics.lateLoans = row.count;
                        score -= (row.count * 15);
                    }

                    // Cap score at 0-100
                    score = Math.max(0, Math.min(100, score));

                    // Save to DB
                    db.run(`INSERT INTO risk_scores (scope, target_id, score, metrics_snapshot) VALUES ('GROUP', ?, ?, ?)`,
                        [groupId, score, JSON.stringify(metrics)], (err) => {
                            if (err) console.error("Risk Score Log Error:", err);
                        });

                    resolve({ score, metrics });
                });
            });
        });
    }

    /**
     * Calculate risk score for an officer.
     */
    static async calculateOfficerScore(officerId) {
        return new Promise((resolve, reject) => {
            // Metrics: Shortages in reports, frequency of reversals
            const query = `
                SELECT 
                    COUNT(*) as total_sessions,
                    COUNT(CASE WHEN notes LIKE '%Shortage%' THEN 1 END) as shortages
                FROM meeting_sessions 
                WHERE officerId = ?
            `;

            db.get(query, [officerId], (err, row) => {
                if (err) return reject(err);

                let score = 100;
                if (row.total_sessions > 0) {
                    const shortageRate = row.shortages / row.total_sessions;
                    score -= (shortageRate * 100);
                }

                score = Math.max(0, Math.min(100, score));

                db.run(`INSERT INTO risk_scores (scope, target_id, score, metrics_snapshot) VALUES ('OFFICER', ?, ?, ?)`,
                    [officerId, score, JSON.stringify(row)], (err) => {
                        if (err) console.error("Officer Risk Score Log Error:", err);
                    });

                resolve({ score, metrics: row });
            });
        });
    }
}

module.exports = RiskService;
