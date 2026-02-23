const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

async function listMembersOfGroupsWithoutOfficials() {
    db.all(`
        SELECT g.id as groupId, g.name as groupName, m.id as memberId, m.name as memberName
        FROM groups g
        LEFT JOIN members m ON g.id = m.group_id
        WHERE g.id NOT IN (SELECT DISTINCT group_id FROM group_officials)
        ORDER BY g.id, m.id
    `, [], (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }

        let currentGroupId = null;
        rows.forEach(row => {
            if (row.groupId !== currentGroupId) {
                console.log(`\nGroup: ${row.groupName} (ID: ${row.groupId})`);
                currentGroupId = row.groupId;
            }
            if (row.memberId) {
                console.log(`  - Member: ${row.memberName} (ID: ${row.memberId})`);
            } else {
                console.log(`  - NO MEMBERS`);
            }
        });
        db.close();
    });
}

listMembersOfGroupsWithoutOfficials();
