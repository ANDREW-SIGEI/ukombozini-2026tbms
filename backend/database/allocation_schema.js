/**
 * UKOMBOZI TBMS - Allocation Schema
 * Tracks the distribution of "Net Surplus" from meeting sessions.
 */

const initAllocationSchema = (db) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 1. Group Allocation Matrix (Per Group Rules)
            db.run(`CREATE TABLE IF NOT EXISTS group_allocation_rules (
                group_id INTEGER PRIMARY KEY,
                stl_pct REAL DEFAULT 0.25,
                ltl_pct REAL DEFAULT 0.35,
                dividend_pct REAL DEFAULT 0.15,
                refund_reserve_pct REAL DEFAULT 0.10,
                edu_project_pct REAL DEFAULT 0.075,
                agri_project_pct REAL DEFAULT 0.075,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups(id)
            )`, (err) => {
                if (err) return reject(err);

                // 2. Meeting Share Snapshots (The "Table" results)
                db.run(`CREATE TABLE IF NOT EXISTS group_share_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER UNIQUE,
                    group_id INTEGER,
                    total_cash_in REAL DEFAULT 0,
                    total_cash_out REAL DEFAULT 0,
                    net_surplus REAL DEFAULT 0,
                    status TEXT DEFAULT 'PENDING', -- PENDING / COMMITTED
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES meeting_sessions(id),
                    FOREIGN KEY (group_id) REFERENCES groups(id)
                )`, (err) => {
                    if (err) return reject(err);

                    console.log("[SCHEMA] Allocation Matrix Tables Ready.");
                    resolve();
                });
            });
        });
    });
};

module.exports = { initAllocationSchema };
