const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Checking transaction types for Member 31...');

db.all("SELECT DISTINCT transaction_type FROM transactions WHERE member_id = 31", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('Unique types:');
    rows.forEach((row) => {
        console.log(`- '${row.transaction_type}'`);
    });
    db.close();
});
