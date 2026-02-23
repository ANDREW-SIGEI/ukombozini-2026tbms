const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Inspecting transactions table schema...');

db.all("PRAGMA table_info(transactions)", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    rows.forEach((row) => {
        console.log(`- ${row.name} (${row.type})`);
    });
    db.close();
});
