const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozi.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
        process.exit(1);
    }

    db.all("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err, rows) => {
        if (err) {
            console.error('Error querying schema:', err);
        } else {
            rows.forEach(row => {
                console.log('\n=== ' + row.name + ' ===');
                console.log(row.sql || '(no schema)');
            });
        }
        db.close();
    });
});
