const db = require('./db');

console.log("--- 🔄 Migrating ledger_entries: Removing UNIQUE tx_ref ---");

db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // 1. Rename existing table
    db.run("ALTER TABLE ledger_entries RENAME TO ledger_entries_backup", (err) => {
        if (err && !err.message.includes('no such table')) {
            console.error("Rename failed:", err);
            return;
        }
    });

    // 2. Create new table without UNIQUE constraint on tx_ref
    // We include all columns identified in previous steps
    const createSql = `
        CREATE TABLE ledger_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tx_ref TEXT,
            account_name TEXT,
            entity_type TEXT,
            entity_id INTEGER,
            direction TEXT,
            amount REAL,
            session_id TEXT,
            officer_id INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            member_id INTEGER,
            group_id INTEGER,
            product_code TEXT,
            running_balance REAL,
            status TEXT
        )
    `;

    db.run(createSql, (err) => {
        if (err) {
            console.error("Create Table Failed:", err);
            db.run("ROLLBACK");
            return;
        }
    });

    // 3. Copy Data
    const copySql = `
        INSERT INTO ledger_entries (
            id, tx_ref, member_id, group_id, product_code, direction, amount, 
            running_balance, session_id, officer_id, status, notes, created_at, 
            account_name, entity_type, entity_id
        )
        SELECT 
            id, tx_ref, member_id, group_id, product_code, direction, amount, 
            running_balance, session_id, officer_id, status, notes, created_at, 
            account_name, entity_type, entity_id
        FROM ledger_entries_backup
    `;

    db.run(copySql, (err) => {
        if (err) {
            console.error("Data Copy Failed:", err);
            db.run("ROLLBACK");
        } else {
            console.log("✅ Data copied successfully.");
            // 4. Drop backup
            db.run("DROP TABLE ledger_entries_backup", (err) => {
                if (err) {
                    console.error("Drop Backup Failed (Ignorable):", err);
                }
                db.run("COMMIT", () => {
                    console.log("✅ Migration Complete. UNIQUE constraint removed.");
                });
            });
        }
    });
});
