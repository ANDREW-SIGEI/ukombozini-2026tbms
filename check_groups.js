const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ukombozi.sqlite');

db.all("SELECT * FROM groups ORDER BY id DESC LIMIT 10", (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(JSON.stringify(rows, null, 2));
    db.close();
});
