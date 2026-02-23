const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT sql FROM sqlite_master WHERE name='group_officials'", [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Table definition:');
    rows.forEach(r => console.log(r.sql));
    db.close();
});
