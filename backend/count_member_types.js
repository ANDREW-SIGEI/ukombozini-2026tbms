const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Counting transaction types for Member 31...');

db.all("SELECT type, count(*) as count FROM transactions WHERE member_id = 31 GROUP BY type", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    rows.forEach((row) => {
        console.log(`${row.type}: ${row.count}`);
    });
    db.close();
});
