const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozini.sqlite');

db.serialize(() => {
    db.all("PRAGMA table_info(loans)", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("SCHEMA_START");
        console.log(JSON.stringify(rows));
        console.log("SCHEMA_END");
    });
});
