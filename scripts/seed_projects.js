const db = require('../backend/db');

function seed() {
    console.log('🌱 Seeding Project Intelligence Data...');

    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='project_registrations'", (err, row) => {
        if (err) {
            console.error('❌ Error checking table:', err);
            return;
        }
        if (!row) {
            console.error('❌ Table project_registrations DOES NOT EXIST. Restart backend first!');
            return;
        }
        console.log('✅ Table project_registrations exists.');

        // Get a group and some members
        db.get("SELECT id FROM groups LIMIT 1", (err, group) => {
            if (!group) {
                console.log('⚠️ No groups found. Cannot seed.');
                return;
            }
            const groupId = group.id;

            db.all("SELECT id FROM members WHERE group_id = ? LIMIT 5", [groupId], (err, members) => {
                if (!members || members.length === 0) {
                    console.log('⚠️ No members found. Cannot seed.');
                    return;
                }

                console.log(`Found group ${groupId} and ${members.length} members.`);

                const stmt = db.prepare(`
                    INSERT INTO project_registrations (member_id, group_id, project_type, total_saved, status)
                    VALUES (?, ?, ?, ?, 'ACTIVE')
                `);

                members.forEach((m, i) => {
                    const type = i % 2 === 0 ? 'EDUCATION' : 'AGRICULTURE';
                    const saved = (i + 1) * 500; // 500, 1000, 1500...

                    stmt.run(m.id, groupId, type, saved, (err) => {
                        if (err) console.error(`Failed to seed member ${m.id}:`, err.message);
                        else console.log(`✅ Seeded Member ${m.id}: ${type} - KES ${saved}`);
                    });

                    // Also add a savings record
                    db.run(`INSERT INTO project_savings (registration_id, amount, date) VALUES ((SELECT seq FROM sqlite_sequence WHERE name='project_registrations'), ?, datetime('now'))`, [saved]);
                });

                stmt.finalize();
                console.log('✨ Seeding Check Complete.');
            });
        });
    });
}

seed();
