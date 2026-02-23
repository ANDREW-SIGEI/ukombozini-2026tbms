const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Auditing ledger entries for Member 31...');

db.all("SELECT * FROM ledger_entries WHERE account_name LIKE 'MEMBER_31_%' ORDER BY created_at ASC", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log(`Found ${rows.length} ledger entries:`);
    let balance = 0;
    rows.forEach((row) => {
        const delta = row.direction === 'CREDIT' ? row.amount : -row.amount;
        balance += delta;
        console.log(`[${row.id}] ${row.created_at} | ${row.account_name} | ${row.direction} | AMT: ${row.amount} | BAL: ${balance}`);
    });
    db.close();
});
