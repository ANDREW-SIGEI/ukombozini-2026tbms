const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozi.sqlite');
db.all("SELECT id, name, group_id FROM members;", (err, rows) => {
    if (err) console.error(err);
    else console.log("Members:", JSON.stringify(rows));
    db.close();
});
