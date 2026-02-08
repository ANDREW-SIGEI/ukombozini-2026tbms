const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend', 'ukombozi.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM partnership_tiers", [], (err, rows) => {
    if (err) {
        console.error("Error:", err.message);
    } else {
        console.log("--- Partnership Tiers ---");
        console.table(rows);
    }
    db.close();
});
