const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

const ROLES = ['CHAIRPERSON', 'SECRETARY', 'TREASURER'];

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function assignOfficials() {
    try {
        // 1. Find groups without officials
        const groups = await getQuery(`
            SELECT id, name FROM groups 
            WHERE id NOT IN (SELECT DISTINCT group_id FROM group_officials)
            AND id > 0 -- Skip system internal
        `);

        console.log(`Processing ${groups.length} groups...`);

        for (const group of groups) {
            console.log(`\nGroup: ${group.name} (ID: ${group.id})`);

            // 2. Find any members in this group
            // We exclude members who might already be officials (though the group has none, maybe they are officials in OTHER groups? Usually not allowed, but let's be safe).
            // Actually, let's just pick 3 members.
            const members = await getQuery(`
                SELECT id, name FROM members 
                WHERE group_id = ? 
                LIMIT 3
            `, [group.id]);

            if (members.length === 0) {
                console.log(`  - No members available to assign as officials. Skipping.`);
                continue;
            }

            console.log(`  - Found ${members.length} members. Assigning roles...`);

            for (let i = 0; i < members.length; i++) {
                const member = members[i];
                const role = ROLES[i];

                try {
                    await runQuery(`
                        INSERT OR IGNORE INTO group_officials (group_id, member_id, role, term_start, status)
                        VALUES (?, ?, ?, DATE('now'), 'ACTIVE')
                    `, [group.id, member.id, role]);
                    console.log(`  - Assigned ${member.name} as ${role}`);
                } catch (e) {
                    console.log(`  - Failed to assign ${member.name} as ${role}: ${e.message}`);
                }
            }
        }

        console.log('\n✅ Official assignment complete!');

    } catch (error) {
        console.error('❌ Error assigning officials:', error);
    } finally {
        db.close();
    }
}

assignOfficials();
