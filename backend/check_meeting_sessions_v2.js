const db = require('./db');
db.all("PRAGMA table_info(meeting_sessions)", [], (err, rows) => {
    if (err) console.error(err);
    else {
        console.log("COLUMNS IN meeting_sessions:");
        rows.forEach(r => console.log(`- ${r.name} (${r.type})`));
    }
    process.exit();
});
