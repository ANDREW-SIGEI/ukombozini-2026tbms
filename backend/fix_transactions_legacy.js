const db = require('./db');
console.log("--- 🛠️ Fixing Legacy Transactions Schema ---");

db.serialize(() => {
    // Check transactions schema
    db.all("PRAGMA table_info(transactions)", [], (err, rows) => {
        if (err) return console.error(err);

        console.log("Current Columns in transactions:");
        rows.forEach(r => console.log(` - ${r.name} (${r.type})`));

        // Required Legacy Columns
        const required = ['deposits', 'withdrawals', 'stl_repayment', 'fines', 'status', 'uploaded'];

        required.forEach(col => {
            if (!rows.some(r => r.name === col)) {
                console.log(`Adding missing legacy column: ${col}`);
                const type = col === 'uploaded' ? 'INTEGER DEFAULT 0' : (col === 'status' ? "TEXT DEFAULT 'COMPLETED'" : 'REAL DEFAULT 0');
                db.run(`ALTER TABLE transactions ADD COLUMN ${col} ${type}`, (err) => {
                    if (err) console.error(`Failed to add ${col}:`, err);
                    else console.log(`✅ Added ${col} successfully.`);
                });
            }
        });
    });
});
