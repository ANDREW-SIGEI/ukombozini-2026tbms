const db = require('./db');

console.log('--- Checking for group KAPKORES ---');
db.all("SELECT * FROM groups WHERE UPPER(name) LIKE '%KAPKORES%'", [], (err, groups) => {
    if (err) {
        console.error('Error fetching groups:', err);
        return;
    }
    console.log('Groups found:', groups);

    if (groups.length === 0) {
        console.log('No group found with name KAPKORES');
        return;
    }

    const groupIds = groups.map(g => g.id);
    console.log('--- Checking for sessions linked to these groups ---');
    db.all(`SELECT s.*, g.name as group_name 
            FROM meeting_sessions s 
            JOIN groups g ON s.groupId = g.id 
            WHERE s.groupId IN (${groupIds.join(',')})`, [], (err, sessions) => {
        if (err) {
            console.error('Error fetching sessions:', err);
            return;
        }
        console.log('Sessions found:', sessions);
    });
});
