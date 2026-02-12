const db = require('./db');

console.log('--- Listing ALL Meeting Sessions ---');
db.all(`SELECT s.id, s.groupId, g.name as group_name, s.date, s.status 
        FROM meeting_sessions s 
        LEFT JOIN groups g ON s.groupId = g.id`, [], (err, sessions) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log('Total sessions count:', sessions.length);
    console.log(JSON.stringify(sessions, null, 2));
    process.exit(0);
});
