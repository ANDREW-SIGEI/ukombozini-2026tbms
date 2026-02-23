const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ukombozini.sqlite');

db.all("PRAGMA table_info(members);", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log("Members Table Schema:");
    console.table(rows);
    db.close();
});
