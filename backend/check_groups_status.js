const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozi.sqlite');

db.serialize(() => {
    db.all("SELECT id, name, status FROM groups", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Groups Data:", rows);
    });
});
