const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(group_officials)", (err, rows) => {
    if (err) console.error(err);
    else console.log(rows);
});

db.all("PRAGMA index_list(group_officials)", (err, rows) => {
    if (err) console.error(err);
    else {
        console.log("Indexes:", rows);
        rows.forEach(idx => {
            db.all(`PRAGMA index_info(${idx.name})`, (e, r) => {
                console.log(`Index ${idx.name}:`, r);
            });
        });
    }
});
