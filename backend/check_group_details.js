const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/ukombozini.sqlite');

db.get("SELECT * FROM members WHERE id = 44", [], (err, row) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log("Member 44 details:");
    console.log(JSON.stringify(row, null, 2));
    db.close();
});
