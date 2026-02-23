const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- 🔎 PENDING TRANSACTIONS AUDIT ---');

db.all("SELECT * FROM transactions WHERE status = 'PENDING' OR uploaded = 0", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }

    console.log(`Total pending/unuploaded rows: ${rows.length}`);
    rows.forEach(row => {
        console.log(`ID: ${row.id} | Member: ${row.member_id} | Type: ${row.transaction_type} | Status: ${row.status} | Uploaded: ${row.uploaded}`);
    });
    db.close();
});
