const db = require('../db');
const { randomUUID } = require('crypto');

class MonthlyReportService {
    /**
     * Recalculates the monthly report for a specific group/month/year.
     * This is the "Single Source of Truth" aggregation logic.
     */
    static async recalculate(groupId, month, year) {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Fetch all LOCKED daily sessions for this month
                const dailySessions = await this.getInternalAll(`
                    SELECT * FROM cash_sessions 
                    WHERE group_id = ? 
                    AND strftime('%m', meeting_date) = ? 
                    AND strftime('%Y', meeting_date) = ?
                    AND status = 'LOCKED'
                    ORDER BY meeting_date ASC
                `, [groupId, month.toString().padStart(2, '0'), year.toString()]);

                if (dailySessions.length === 0) {
                    // No locked reports yet, monthly remains draft or zeroed
                    return resolve(null);
                }

                // 2. Aggregate Totals
                let totalIn = 0;
                let totalOut = 0;

                // We need to sum actual transactions from the ledger for accuracy
                const sessionIds = dailySessions.map(s => s.id);
                const placeholders = sessionIds.map(() => '?').join(',');

                const totals = await this.getInternal(`
                    SELECT 
                        SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END) as total_in,
                        SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END) as total_out
                    FROM cash_transactions 
                    WHERE cash_session_id IN (${placeholders})
                `, sessionIds);

                totalIn = totals.total_in || 0;
                totalOut = totals.total_out || 0;

                // 3. Opening and Closing Balances
                const openingBalance = dailySessions[0].opening_balance;
                const closingBalance = dailySessions[dailySessions.length - 1].expected_closing_balance;

                // 4. Upsert Monthly Report
                const reportId = randomUUID();
                const sql = `
                    INSERT INTO monthly_cash_reports (
                        id, group_id, month, year, opening_balance, total_cash_in, total_cash_out, closing_balance
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(group_id, month, year) DO UPDATE SET
                        total_cash_in = excluded.total_cash_in,
                        total_cash_out = excluded.total_cash_out,
                        opening_balance = excluded.opening_balance,
                        closing_balance = excluded.closing_balance,
                        last_updated_at = CURRENT_TIMESTAMP
                `;

                db.run(sql, [reportId, groupId, month, year, openingBalance, totalIn, totalOut, closingBalance], (err) => {
                    if (err) reject(err);
                    else resolve({ groupId, month, year, closingBalance });
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    static getInternal(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
        });
    }

    static getInternalAll(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
        });
    }
}

module.exports = MonthlyReportService;
