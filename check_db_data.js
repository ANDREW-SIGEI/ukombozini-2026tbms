const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/ukombozi.sqlite');

db.all("SELECT id, name, status FROM groups", [], (err, groups) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log("GROUPS:");
    console.table(groups);

    db.all("SELECT id, name, group_id, current_savings FROM members LIMIT 10", [], (err, members) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("MEMBERS (First 10):");
        console.table(members);
        db.close();
    });
});
