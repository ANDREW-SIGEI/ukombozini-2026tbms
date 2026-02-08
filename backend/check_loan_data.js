const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozi.sqlite');

db.serialize(() => {
    db.get("SELECT * FROM loans LIMIT 1", (err, row) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("DATA_START");
        console.log(JSON.stringify(row));
        console.log("DATA_END");
    });
});
