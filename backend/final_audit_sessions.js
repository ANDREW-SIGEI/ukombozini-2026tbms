const db = require('./db');
db.all("SELECT id, groupId FROM meeting_sessions", [], (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows));
    process.exit(0);
});
