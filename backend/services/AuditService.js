const db = require('../db');

/**
 * AuditService provides logic to calculate system state at any point in time.
 */
class AuditService {
    /**
     * Calculates a snapshot of balances and metrics for a specific date.
     * @param {string} auditDate - The date in YYYY-MM-DD format.
     * @param {number} groupId - Optional group filter.
     */
    static async getSnapshot(auditDate, groupId = null) {
        return new Promise((resolve, reject) => {
            // Logic: Base Snapshot = Opening Balances + Sum of Transactions up to auditDate

            let memberQuery = `
                SELECT 
                    m.id, m.name, m.group_id, g.name as group_name,
                    m.opening_balance_savings, m.opening_balance_ltl, m.opening_balance_stl
                FROM members m
                JOIN groups g ON m.group_id = g.id
            `;
            let params = [];
            if (groupId) {
                memberQuery += " WHERE m.group_id = ?";
                params.push(groupId);
            }

            db.all(memberQuery, params, async (err, members) => {
                if (err) return reject(err);

                // Fetch transactions and project savings up to the audit date in parallel
                const txQuery = `
                    SELECT * FROM (
                        SELECT 
                            t.*, COALESCE(s.date, date(t.created_at)) as tx_date
                        FROM transactions t
                        LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    ) WHERE tx_date <= ?
                `;

                const projectQuery = `
                    SELECT ps.amount, pr.member_id, date(ps.date) as tx_date
                    FROM project_savings ps
                    JOIN project_registrations pr ON ps.registration_id = pr.id
                    WHERE date(ps.date) <= ?
                `;

                db.all(txQuery, [auditDate], (err, txs) => {
                    if (err) return reject(err);

                    db.all(projectQuery, [auditDate], (err, projects) => {
                        if (err) return reject(err);

                        // Group transactions by member
                        const txMap = {};
                        txs.forEach(t => {
                            if (!txMap[t.memberId]) txMap[t.memberId] = [];
                            txMap[t.memberId].push(t);
                        });

                        // Group project savings by member
                        const projectMap = {};
                        projects.forEach(p => {
                            if (!projectMap[p.member_id]) projectMap[p.member_id] = 0;
                            projectMap[p.member_id] += (p.amount || 0);
                        });

                        const memberSnapshots = members.map(m => {
                            const mtxs = txMap[m.id] || [];

                            let savings = m.opening_balance_savings || 0;
                            let welfare = 0;
                            let loans = (m.opening_balance_ltl || 0) + (m.opening_balance_stl || 0);
                            let project = projectMap[m.id] || 0;

                            mtxs.forEach(t => {
                                savings += (t.savings_amount || 0) - (t.withdrawals || 0);
                                welfare += (t.welfare || 0);
                                loans += (t.loans_issued || 0) - (t.stl_repayment || 0) - (t.ltl_repayment || 0);
                            });

                            return {
                                id: m.id,
                                name: m.name,
                                group_name: m.group_name,
                                historical_savings: savings,
                                historical_project: project,
                                historical_welfare: welfare,
                                historical_loan_balance: loans
                            };
                        });

                        resolve(memberSnapshots);
                    });
                });
            });
        });
    }
}

module.exports = AuditService;
