const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Searching for members with negative savings...');

db.all("SELECT id, name, current_savings FROM members WHERE current_savings < 0", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log(`Found ${rows.length} members with negative savings:`);
    rows.forEach((row) => {
        console.log(`ID: ${row.id} | Name: ${row.name} | Savings: ${row.current_savings}`);
    });
    db.close();
});
