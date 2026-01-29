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

                const snapshotResults = {
                    date: auditDate,
                    total_savings: 0,
                    total_loans: 0,
                    member_details: []
                };

                // Fetch transactions up to the audit date
                const txQuery = `
                    SELECT 
                        t.*, COALESCE(s.date, date(t.created_at)) as tx_date
                    FROM transactions t
                    LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    HAVING tx_date <= ?
                `;
                // Note: SQLite doesn't support HAVING like this easily if tx_date is an alias in some versions, 
                // but we can use a subquery or CTE.

                const txQueryFixed = `
                    SELECT * FROM (
                        SELECT 
                            t.*, COALESCE(s.date, date(t.created_at)) as tx_date
                        FROM transactions t
                        LEFT JOIN meeting_sessions s ON t.sessionId = s.id
                    ) WHERE tx_date <= ?
                `;

                db.all(txQueryFixed, [auditDate], (err, txs) => {
                    if (err) return reject(err);

                    // Group transactions by member
                    const txMap = {};
                    txs.forEach(t => {
                        if (!txMap[t.memberId]) txMap[t.memberId] = [];
                        txMap[t.memberId].push(t);
                    });

                    members.forEach(m => {
                        const mtxs = txMap[m.id] || [];

                        let savings = m.opening_balance_savings || 0;
                        let loans = (m.opening_balance_ltl || 0) + (m.opening_balance_stl || 0);

                        mtxs.forEach(t => {
                            savings += (t.savings_amount || 0) - (t.withdrawals || 0);
                            loans += (t.loans_issued || 0) - (t.stl_repayment || 0) - (t.ltl_repayment || 0);
                        });

                        const memberSnapshot = {
                            id: m.id,
                            name: m.name,
                            group_id: m.group_id,
                            group_name: m.group_name,
                            savings: savings,
                            loans: loans
                        };

                        snapshotResults.member_details.push(memberSnapshot);
                        snapshotResults.total_savings += savings;
                        snapshotResults.total_loans += loans;
                    });

                    resolve(snapshotResults);
                });
            });
        });
    }
}

module.exports = AuditService;
