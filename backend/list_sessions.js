
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ukombozini.sqlite');

db.serialize(() => {
    console.log("--- All Meeting Sessions ---");
    db.all("SELECT id, session_number, group_id, status FROM meeting_sessions", (err, rows) => {
        if (err) console.error(err);
        console.log(JSON.stringify(rows, null, 2));
        db.close();
    });
});
