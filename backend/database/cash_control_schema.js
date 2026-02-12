const db = require('../db');

/**
 * Initializes the Bank-Grade Cash Control tables.
 * Using UUIDs (as strings in SQLite) and strict status controls.
 */
async function initCashControl() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 1. cash_sessions (One per group per meeting)
            db.run(`CREATE TABLE IF NOT EXISTS cash_sessions (
                id TEXT PRIMARY KEY, -- UUID
                group_id INTEGER NOT NULL,
                meeting_id INTEGER,
                meeting_date DATE NOT NULL,
                opening_balance DECIMAL(12,2) DEFAULT 0,
                expected_closing_balance DECIMAL(12,2) DEFAULT 0,
                physical_cash_count DECIMAL(12,2) DEFAULT 0,
                variance DECIMAL(12,2) DEFAULT 0,
                variance_explanation TEXT,
                status TEXT CHECK(status IN ('OPEN','VERIFIED','LOCKED')) DEFAULT 'OPEN',
                reported_by INTEGER NOT NULL,
                verified_by INTEGER,
                opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                locked_at TIMESTAMP,
                audit_hash TEXT,
                FOREIGN KEY(group_id) REFERENCES groups(id),
                FOREIGN KEY(reported_by) REFERENCES officers(id),
                FOREIGN KEY(verified_by) REFERENCES officers(id)
            )`, (err) => { if (err) reject(err); });

            // 2. cash_transactions (AUTO-GENERATED ONLY)
            db.run(`CREATE TABLE IF NOT EXISTS cash_transactions (
                id TEXT PRIMARY KEY, -- UUID
                cash_session_id TEXT NOT NULL,
                source TEXT, -- MTE transaction_type or manual source
                reference_id TEXT,
                direction TEXT CHECK(direction IN ('IN','OUT')),
                amount DECIMAL(12,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER,
                FOREIGN KEY(cash_session_id) REFERENCES cash_sessions(id)
            )`, (err) => { if (err) reject(err); });

            // 3. monthly_cash_reports (DERIVED SNAPSHOTS)
            db.run(`CREATE TABLE IF NOT EXISTS monthly_cash_reports (
                id TEXT PRIMARY KEY, -- UUID
                group_id INTEGER NOT NULL,
                month INTEGER NOT NULL, -- 1 to 12
                year INTEGER NOT NULL,
                opening_balance DECIMAL(12,2) DEFAULT 0,
                total_cash_in DECIMAL(12,2) DEFAULT 0,
                total_cash_out DECIMAL(12,2) DEFAULT 0,
                closing_balance DECIMAL(12,2) DEFAULT 0,
                report_status TEXT CHECK(report_status IN ('OPEN', 'CLOSED', 'AUDITED')) DEFAULT 'OPEN',
                generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(group_id) REFERENCES groups(id),
                UNIQUE(group_id, month, year)
            )`, (err) => {
                if (err) reject(err);
                else {
                    console.log("Institutional Layer: Cash Control tables extended with Monthly Intelligence.");
                    resolve();
                }
            });
        });
    });
}

module.exports = { initCashControl };
