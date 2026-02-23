const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ukombozini.sqlite');

db.all("SELECT email, password, role FROM officers LIMIT 5", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
});
