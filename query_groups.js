const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Querying for groups matching KAPKORES...');
db.all("SELECT * FROM groups WHERE name LIKE '%KAPKORES%'", [], (err, rows) => {
    if (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
    console.log('Results:', JSON.stringify(rows, null, 2));
    db.close();
});
