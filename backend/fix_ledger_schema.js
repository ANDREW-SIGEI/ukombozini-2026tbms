const db = require('./db');

console.log("--- 🕵️ Inspecting Schema ---");

db.serialize(() => {

    // Check account_balances table exists for MTE
    db.run(`CREATE TABLE IF NOT EXISTS account_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_name TEXT UNIQUE NOT NULL,
        account_category TEXT,
        balance REAL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.all("PRAGMA table_info(ledger_entries)", [], (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Current Columns in ledger_entries:");
        rows.forEach(r => console.log(` - ${r.name} (${r.type})`));

        // List of all required columns for MTE v2
        const requiredColumns = [
            { name: 'account_name', type: 'TEXT' },
            { name: 'entity_type', type: 'TEXT' },
            { name: 'entity_id', type: 'INTEGER' },
            { name: 'direction', type: 'TEXT' },
            { name: 'amount', type: 'REAL' },
            { name: 'session_id', type: 'TEXT' },
            { name: 'officer_id', type: 'INTEGER' },
            { name: 'notes', type: 'TEXT' }
        ];

        requiredColumns.forEach(col => {
            const hasCol = rows.some(r => r.name === col.name);
            if (!hasCol) {
                console.log(`\n⚠️ Missing '${col.name}'. Adding column...`);
                db.run(`ALTER TABLE ledger_entries ADD COLUMN ${col.name} ${col.type}`, (err) => {
                    if (err) console.error(`Migration Failed for ${col.name}:`, err);
                    else console.log(`✅ Column '${col.name}' added successfully.`);
                });
            }
        });

        console.log("\n✅ Schema Sync Attempt Complete.");
    });
});
