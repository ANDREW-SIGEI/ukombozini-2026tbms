const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozi.sqlite');

const GROUP_NAME = "KAPKORES UNITY";

db.serialize(() => {
    // 1. Get Group ID
    db.get("SELECT id, name FROM groups WHERE name LIKE ?", [`%${GROUP_NAME}%`], (err, group) => {
        if (err) { console.error(err); return; }
        if (!group) { console.log(`Group '${GROUP_NAME}' not found.`); return; }

        console.log("FOUND_GROUP_JSON:" + JSON.stringify(group));
        const groupId = group.id;

        // 2. Count Members
        db.get("SELECT COUNT(*) as count, SUM(current_savings) as total_savings FROM members WHERE group_id = ?", [groupId], (err, row) => {
            console.log("MEMBERS_STATS_JSON:" + JSON.stringify(row));
        });

        // 3. Check Project Registrations
        db.all("SELECT * FROM project_registrations WHERE group_id = ? LIMIT 5", [groupId], (err, rows) => {
            console.log("PROJECT_REGISTRATIONS_JSON:" + JSON.stringify(rows));
        });

        // 4. Check Project Savings Linked to Group
        db.get(`
            SELECT SUM(ps.amount) as total_pool 
            FROM project_savings ps
            JOIN project_registrations pr ON ps.registration_id = pr.id
            WHERE pr.group_id = ?
        `, [groupId], (err, row) => {
            console.log("PROJECT_POOL_JSON:" + JSON.stringify(row));
        });

        // 5. List a few members to check their group_id directly
        db.all("SELECT id, name, group_id, current_savings FROM members WHERE group_id = ? LIMIT 3", [groupId], (err, members) => {
            console.log("SAMPLE_MEMBERS_JSON:" + JSON.stringify(members));
        });
    });
});
