const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Fetching all data for Member 31...');

db.get("SELECT * FROM members WHERE id = 31", [], (err, row) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log(JSON.stringify(row, null, 2));
    db.close();
});
