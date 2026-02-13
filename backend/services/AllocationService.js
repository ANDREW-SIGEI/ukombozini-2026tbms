const db = require('../db');

/**
 * UKOMBOZINI Allocation Service
 * Manages the "Table Banking" share distribution logic.
 */
const AllocationService = {

    /**
     * Get Allocation Rules for a Group
     */
    async getGroupRules(groupId) {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM group_allocation_rules WHERE group_id = ?", [groupId], (err, row) => {
                if (err) return reject(err);
                if (!row) {
                    // Default Matrix
                    return resolve({
                        group_id: groupId,
                        stl_pct: 0.25,
                        ltl_pct: 0.35,
                        dividend_pct: 0.15,
                        refund_reserve_pct: 0.10,
                        edu_project_pct: 0.075,
                        agri_project_pct: 0.075
                    });
                }
                resolve(row);
            });
        });
    },

    /**
     * Update Allocation Rules for a Group
     */
    async updateGroupRules(groupId, rules) {
        return new Promise((resolve, reject) => {
            const { stl_pct, ltl_pct, dividend_pct, refund_reserve_pct, edu_project_pct, agri_project_pct } = rules;
            db.run(`
                INSERT INTO group_allocation_rules (
                    group_id, stl_pct, ltl_pct, dividend_pct, refund_reserve_pct, edu_project_pct, agri_project_pct
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(group_id) DO UPDATE SET
                    stl_pct = excluded.stl_pct,
                    ltl_pct = excluded.ltl_pct,
                    dividend_pct = excluded.dividend_pct,
                    refund_reserve_pct = excluded.refund_reserve_pct,
                    edu_project_pct = excluded.edu_project_pct,
                    agri_project_pct = excluded.agri_project_pct,
                    updated_at = CURRENT_TIMESTAMP
            `, [groupId, stl_pct, ltl_pct, dividend_pct, refund_reserve_pct, edu_project_pct, agri_project_pct], function (err) {
                if (err) return reject(err);
                resolve({ success: true });
            });
        });
    },

    /**
     * Calculate Surplus for a Meeting Session
     * Formula: Cash In - Cash Out
     */
    async calculateSessionSurplus(sessionId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE 0 END) as cash_in,
                    SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE 0 END) as cash_out
                FROM ledger_entries 
                WHERE session_id = ? AND account_name LIKE '%CASH%'
            `;
            db.get(sql, [sessionId], (err, row) => {
                if (err) return reject(err);
                const cashIn = row.cash_in || 0;
                const cashOut = row.cash_out || 0;

                // SURPLUS = Total Cash In - Total Cash Out
                const surplus = cashIn - cashOut;

                resolve({ cashIn, cashOut, surplus });
            });
        });
    },

    /**
     * Generate Allocation Preview
     */
    async previewAllocation(sessionId) {
        const { cashIn, cashOut, surplus } = await this.calculateSessionSurplus(sessionId);

        // Get Group ID from Session
        const session = await new Promise((resolve, reject) => {
            db.get("SELECT group_id FROM meeting_sessions WHERE id = ?", [sessionId], (err, r) => {
                if (err) return reject(err);
                resolve(r);
            });
        });

        if (!session) throw new Error("Session not found");

        const rules = await this.getGroupRules(session.group_id);

        const allocations = {
            stl: surplus * rules.stl_pct,
            ltl: surplus * rules.ltl_pct,
            dividend: surplus * rules.dividend_pct,
            refund: surplus * rules.refund_reserve_pct,
            edu: surplus * rules.edu_project_pct,
            agri: surplus * rules.agri_project_pct
        };

        return {
            sessionId,
            groupId: session.group_id, // Fix consistency: group_id instead of groupId
            cashIn,
            cashOut,
            surplus,
            allocations,
            rules
        };
    },

    /**
     * Commit Allocation to Table
     */
    async commitAllocation(sessionId) {
        const preview = await this.previewAllocation(sessionId);

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO group_share_snapshots (
                    session_id, group_id, total_cash_in, total_cash_out, net_surplus, status
                ) VALUES (?, ?, ?, ?, ?, 'COMMITTED')
                ON CONFLICT(session_id) DO UPDATE SET 
                    total_cash_in = excluded.total_cash_in,
                    total_cash_out = excluded.total_cash_out,
                    net_surplus = excluded.net_surplus,
                    status = 'COMMITTED'
            `, [sessionId, preview.groupId, preview.cashIn, preview.cashOut, preview.surplus], function (err) {
                if (err) return reject(err);
                resolve({ success: true, id: this.lastID });
            });
        });
    },

    /**
     * Get Allocation History
     */
    async getAllocationHistory(limit = 50) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    s.*, 
                    g.name as group_name,
                    m.date as session_date
                FROM group_share_snapshots s
                JOIN groups g ON s.group_id = g.id
                JOIN meeting_sessions m ON s.session_id = m.id
                ORDER BY s.created_at DESC
                LIMIT ?
            `;
            db.all(sql, [limit], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }
};

module.exports = AllocationService;
