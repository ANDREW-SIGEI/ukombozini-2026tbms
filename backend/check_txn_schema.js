const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log("Checking transactions table schema...");
db.all("PRAGMA table_info(transactions)", (err, rows) => {
    if (err) {
        console.error("Error:", err);
    } else {
        console.log("Columns:", rows.map(r => r.name).join(', '));
    }
});
