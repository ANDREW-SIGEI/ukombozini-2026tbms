const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Analyzing withdrawal timestamps for Member 31...');

db.all("SELECT created_at, count(*) as cnt FROM transactions WHERE member_id = 31 AND transaction_type = 'WITHDRAWAL' GROUP BY created_at", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    rows.forEach((row) => {
        console.log(`${row.created_at}: ${row.cnt} transactions`);
    });
    db.close();
});
