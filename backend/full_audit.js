const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- 🔎 MEMBER 31 FULL TRANSACTION AUDIT ---');

db.all("SELECT id, transaction_type, type, amount, created_at FROM transactions WHERE member_id = 31", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }

    console.log(`Total rows: ${rows.length}`);
    rows.forEach(row => {
        console.log(`ID: ${row.id} | TX_TYPE: ${row.transaction_type} | TYPE: ${row.type} | AMT: ${row.amount} | DATE: ${row.created_at}`);
    });
    db.close();
});
