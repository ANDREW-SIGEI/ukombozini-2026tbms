const db = require('./db');
db.all(`SELECT g.name, COUNT(s.id) as session_count 
        FROM groups g 
        LEFT JOIN meeting_sessions s ON g.id = s.groupId 
        GROUP BY g.name`, [], (err, rows) => {
    if (err) console.error(err);
    else console.table(rows);
    process.exit(0);
});
