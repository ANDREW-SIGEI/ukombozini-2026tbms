const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('backend/ukombozini.sqlite');

db.get("SELECT email FROM officers WHERE role='Admin' LIMIT 1", (err, row) => {
    if (err) {
        console.error(err);
    } else {
        console.log(JSON.stringify(row));
    }
    db.close();
});
