const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Searching for MERRY BETT...');

db.get("SELECT id, name, current_savings FROM members WHERE name LIKE '%MERRY%'", [], (err, row) => {
    if (err) {
        console.error(err.message);
        return;
    }
    if (row) {
        console.log(`Found: ID=${row.id} | Name=${row.name} | Savings=${row.current_savings}`);
    } else {
        console.log('Member not found.');
    }
    db.close();
});
