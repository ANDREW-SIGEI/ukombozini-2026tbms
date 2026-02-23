const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Checking account_balances for Member 31...');

db.all("SELECT * FROM account_balances WHERE account_name LIKE 'MEMBER_31_%'", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log(`Found ${rows.length} rows:`);
    rows.forEach((row) => {
        console.log(`${row.account_name} | Balance: ${row.balance}`);
    });
    db.close();
});
