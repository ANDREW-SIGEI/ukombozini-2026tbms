const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='group_officials'", [], (err, indexes) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Indexes on group_officials:');
    indexes.forEach(idx => console.log(`- ${idx.name} (Unique: ${idx.sql.includes('UNIQUE')})`));
    db.close();
});
