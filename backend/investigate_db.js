const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozi.sqlite');

db.all("SELECT id, name, group_id FROM members WHERE id = 38", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log("Member 38 info:", rows);
    }
    db.close();
});
