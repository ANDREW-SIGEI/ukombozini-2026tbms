const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

async function findGroupsWithoutOfficials() {
    db.all(`
        SELECT g.id, g.name 
        FROM groups g
        LEFT JOIN group_officials o ON g.id = o.group_id
        GROUP BY g.id
        HAVING COUNT(o.id) = 0
    `, [], (err, groups) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(`Groups without officials (${groups.length}):`);
        groups.forEach(g => console.log(`- ${g.name} (ID: ${g.id})`));
        db.close();
    });
}

findGroupsWithoutOfficials();
