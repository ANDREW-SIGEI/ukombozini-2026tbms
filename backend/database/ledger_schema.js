/**
 * UKOMBOZI TBMS - Central Ledger Schema
 * The immutable source of truth for all money movements.
 */

const initLedgerSchema = (db) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 1. Unified Institutional Ledger (Triple-Entry Standard)
            db.run(`CREATE TABLE IF NOT EXISTS ledger_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tx_ref TEXT NOT NULL,
                account_name TEXT NOT NULL,
                entity_type TEXT CHECK(entity_type IN ('MEMBER', 'GROUP', 'SYSTEM')),
                entity_id INTEGER,
                direction TEXT CHECK(direction IN ('CREDIT', 'DEBIT')),
                amount REAL NOT NULL,
                session_id INTEGER,
                officer_id INTEGER,
                notes TEXT,
                status TEXT DEFAULT 'POSTED',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES meeting_sessions(id)
            )`, (err) => {
                if (err) return reject(err);

                // 2. Performance Indexes
                db.run(`CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_name)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger_entries(tx_ref)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_ledger_session ON ledger_entries(session_id)`);

                // 3. Account Balances Table (Real-time snapshots)
                db.run(`CREATE TABLE IF NOT EXISTS account_balances (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_name TEXT UNIQUE NOT NULL,
                    account_category TEXT NOT NULL, -- 'MEMBER', 'GROUP', 'SYSTEM'
                    balance REAL DEFAULT 0,
                    last_updated TEXT DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) return reject(err);
                    console.log("[SCHEMA] MTE v2 Ledger & Balances Ready.");
                    resolve();
                });
            });
        });
    });
};

module.exports = { initLedgerSchema };
