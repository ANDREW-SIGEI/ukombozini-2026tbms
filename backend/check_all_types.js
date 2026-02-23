const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Checking all unique values in the type column...');

db.all("SELECT DISTINCT type FROM transactions", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('Unique types:');
    rows.forEach((row) => {
        console.log(`- '${row.type}'`);
    });
    db.close();
});
