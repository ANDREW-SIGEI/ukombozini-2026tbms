/**
 * UKOMBOZI TBMS - Central Ledger Schema
 * The immutable source of truth for all money movements.
 */

const initLedgerSchema = (db) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 1. Central Ledger Table (Atomic entries)
            db.run(`CREATE TABLE IF NOT EXISTS ledger_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tx_ref TEXT UNIQUE,              -- UUID or Reference
                member_id INTEGER,
                group_id INTEGER,
                product_code TEXT,               -- SAVINGS, WELFARE, STL, LTL, PROJECT_EDU, etc.
                direction TEXT,                  -- CREDIT / DEBIT
                amount REAL NOT NULL,
                running_balance REAL,            -- Cached balance at this point
                session_id INTEGER,
                officer_id INTEGER,
                status TEXT DEFAULT 'POSTED',    -- PENDING / POSTED / REVERSED
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (member_id) REFERENCES members(id),
                FOREIGN KEY (group_id) REFERENCES groups(id),
                FOREIGN KEY (session_id) REFERENCES meeting_sessions(id)
            )`, (err) => {
                if (err) return reject(err);

                // 2. Performance Indexes
                db.run(`CREATE INDEX IF NOT EXISTS idx_ledger_member ON ledger_entries(member_id)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_ledger_product ON ledger_entries(product_code)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger_entries(tx_ref)`);

                console.log("[SCHEMA] Central Ledger Table Ready.");
                resolve();
            });
        });
    });
};

module.exports = { initLedgerSchema };
