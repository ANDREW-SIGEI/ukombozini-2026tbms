const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Dumping ALL transactions for Member 31...');

db.all("SELECT * FROM transactions WHERE member_id = 31 ORDER BY created_at ASC", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    rows.forEach((row) => {
        console.log(JSON.stringify(row));
    });
    db.close();
});
