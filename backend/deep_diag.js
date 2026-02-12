
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ukombozini.sqlite');

db.serialize(() => {
    console.log("--- ALL GROUPS ---");
    db.all("SELECT id, name, status FROM groups", (err, rows) => {
        if (err) console.error(err);
        console.log(JSON.stringify(rows, null, 2));

        console.log("\n--- ALL SESSIONS (Any Status) ---");
        db.all("SELECT * FROM meeting_sessions", (err, sessions) => {
            if (err) console.error(err);
            console.log(JSON.stringify(sessions, null, 2));

            console.log("\n--- SEARCHING FOR KAPKORES IN SESSIONS BY GROUP NAME ---");
            // This checks if there are sessions where we can join the group name
            db.all(`
                SELECT ms.*, g.name as group_name 
                FROM meeting_sessions ms 
                JOIN groups g ON (ms.groupId = g.id OR ms.group_id = g.id)
                WHERE g.name LIKE '%KAPKORES%'
            `, (err, joinRows) => {
                if (err) console.error("Join Error:", err);
                console.log(JSON.stringify(joinRows, null, 2));
                db.close();
            });
        });
    });
});
