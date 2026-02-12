
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ukombozini.sqlite');

db.serialize(() => {
    console.log("--- Searching Groups ---");
    db.all("SELECT * FROM groups WHERE name LIKE '%KAPKORES%'", (err, rows) => {
        if (err) {
            console.error("Group Search Error:", err);
            db.close();
            return;
        }
        console.log("Groups found:", rows.length);
        console.log(JSON.stringify(rows, null, 2));

        if (rows && rows.length > 0) {
            const groupId = rows[0].id;
            console.log("\n--- Searching Active Sessions for Group ID " + groupId + " ---");
            db.all("SELECT * FROM meeting_sessions WHERE group_id = ?", [groupId], (err, sRows) => {
                if (err) {
                    console.error("Session Search Error:", err);
                } else {
                    console.log("Sessions found:", sRows.length);
                    console.log(JSON.stringify(sRows, null, 2));
                }
                db.close();
            });
        } else {
            console.log("\nNo KAPKORES group found.");
            db.close();
        }
    });
});
