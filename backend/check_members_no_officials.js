const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

async function checkMemberCounts() {
    db.all(`
        SELECT g.id, g.name, COUNT(m.id) as member_count
        FROM groups g
        LEFT JOIN members m ON g.id = m.group_id
        LEFT JOIN group_officials o ON g.id = o.group_id
        GROUP BY g.id
        HAVING COUNT(o.id) = 0
    `, [], (err, groups) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log('Groups without officials and their member counts:');
        groups.forEach(g => console.log(`- ${g.name} (ID: ${g.id}): ${g.member_count} members`));
        db.close();
    });
}

checkMemberCounts();
