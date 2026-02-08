const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozi.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(transactions)", [], (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Transactions table columns:');
        rows.forEach(col => {
            console.log(`  - ${col.name} (${col.type})`);
        });
    }
    db.close();
});
