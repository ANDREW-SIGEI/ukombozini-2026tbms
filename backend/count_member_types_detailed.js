const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Counting BOTH transaction_type and type for Member 31...');

db.all("SELECT transaction_type, type, count(*) as count FROM transactions WHERE member_id = 31 GROUP BY transaction_type, type", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    rows.forEach((row) => {
        console.log(`TX_TYPE: ${row.transaction_type} | TYPE: ${row.type} | COUNT: ${row.count}`);
    });
    db.close();
});
