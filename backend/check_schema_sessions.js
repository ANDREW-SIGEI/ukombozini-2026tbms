const db = require('./db');
db.all("PRAGMA table_info(meeting_sessions)", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.table(rows);
    }
    process.exit(0);
});
