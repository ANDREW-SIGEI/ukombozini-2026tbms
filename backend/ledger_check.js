const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Counting ledger entries for Member 31...');

db.get("SELECT count(*) as cnt FROM ledger_entries WHERE account_name LIKE 'MEMBER_31_%'", [], (err, row) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log(`Total ledger entries: ${row.cnt}`);
});

db.all("SELECT * FROM ledger_entries WHERE account_name LIKE 'MEMBER_31_%' ORDER BY id ASC LIMIT 10", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('First 10 ledger entries:');
    rows.forEach((row) => {
        console.log(`[${row.id}] ${row.created_at} | ${row.account_name} | ${row.direction} | ${row.amount}`);
    });
    db.close();
});
