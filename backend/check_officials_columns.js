const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(group_officials)", [], (err, columns) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Columns in group_officials:');
    columns.forEach(c => console.log(`- ${c.name} (${c.type})`));
    db.close();
});
