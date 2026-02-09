const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozi.sqlite');

db.all("SELECT id, name, status FROM groups", [], (err, groups) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log("GROUPS_JSON:" + JSON.stringify(groups));

    db.all("SELECT id, name, group_id, current_savings FROM members LIMIT 20", [], (err, members) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("MEMBERS_JSON:" + JSON.stringify(members));
        db.close();
    });
});
