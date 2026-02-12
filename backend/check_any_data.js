const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozini.sqlite');

db.serialize(() => {
    // Check for ANY member with savings
    db.get("SELECT m.id, m.name, m.current_savings, g.name as group_name FROM members m JOIN groups g ON m.group_id = g.id WHERE m.current_savings > 0 LIMIT 1", [], (err, row) => {
        if (err) console.error(err);
        if (row) {
            console.log("\n--- MEMBER FOUND ---");
            console.log("ID: " + row.id);
            console.log("NAME: " + row.name);
            console.log("CURRENT_SAVINGS: " + row.current_savings);
            console.log("GROUP_NAME: " + row.group_name);
            console.log("--------------------");
        } else {
            console.log("\nNO_DATA_FOUND: No members with savings > 0 found.");
        }
    });

    // Check for ANY project savings
    db.get("SELECT COUNT(*) as count FROM project_savings", [], (err, row) => {
        console.log("\nTOTAL_PROJECT_SAVINGS_ROWS:" + row.count);
    });
});
