const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Auditing transactions for Member 31...');

db.all("SELECT count(*) as cnt, transaction_type, sum(amount) as total FROM transactions WHERE member_id = 31 GROUP BY transaction_type", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('Transaction Summary:');
    rows.forEach(row => {
        console.log(`${row.transaction_type}: ${row.cnt} rows | Total: ${row.total}`);
    });
    db.close();
});
