const db = require('../backend/db');

function setup() {
    console.log('🔧 Fixing Project Intelligence Schema...');

    const tables = [
        `CREATE TABLE IF NOT EXISTS project_registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER,
            group_id INTEGER,
            project_type TEXT CHECK(project_type IN ('EDUCATION', 'AGRICULTURE')),
            total_saved REAL DEFAULT 0,
            status TEXT DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(member_id) REFERENCES members(id),
            FOREIGN KEY(group_id) REFERENCES groups(id)
        )`,
        `CREATE TABLE IF NOT EXISTS project_savings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            registration_id INTEGER,
            amount REAL NOT NULL,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(registration_id) REFERENCES project_registrations(id)
        )`
    ];

    tables.forEach(sql => db.run(sql));
    console.log('✅ Tables ensured.');

    // Attempt to add columns if they are missing (Migration)
    const migrations = [
        "ALTER TABLE project_registrations ADD COLUMN group_id INTEGER",
        "ALTER TABLE project_registrations ADD COLUMN project_type TEXT CHECK(project_type IN ('EDUCATION', 'AGRICULTURE'))",
        "ALTER TABLE project_registrations ADD COLUMN total_saved REAL DEFAULT 0",
        "ALTER TABLE project_registrations ADD COLUMN status TEXT DEFAULT 'ACTIVE'"
    ];

    let migrationsRun = 0;

    // We run migrations sequentially with a slight delay or callback hell, but for a script, simple execution is okay.
    // Errors like "duplicate column name" are expected and ignored.

    function runMigration(index) {
        if (index >= migrations.length) {
            seedData();
            return;
        }
        db.run(migrations[index], (err) => {
            if (!err) console.log(`✅ Applied migration: ${migrations[index]}`);
            else if (err.message.includes('duplicate column')) console.log(`ℹ️ Column exists: ${migrations[index]}`);
            else console.log(`⚠️ Migration warning: ${err.message}`);

            runMigration(index + 1);
        });
    }

    runMigration(0);
}

function seedData() {
    console.log('🌱 Seeding Data...');

    db.get("SELECT id FROM groups LIMIT 1", (err, group) => {
        if (!group) return console.log('⚠️ No groups found.');
        const groupId = group.id;

        db.all("SELECT id FROM members WHERE group_id = ? LIMIT 5", [groupId], (err, members) => {
            if (!members || members.length === 0) return console.log('⚠️ No members found.');

            // Check if we already have data
            db.get("SELECT count(*) as count FROM project_registrations", (err, row) => {
                if (row && row.count > 0) {
                    console.log(`ℹ️ Data already exists (${row.count} records). Skipping seed.`);
                    return;
                }

                console.log(`Found group ${groupId} and ${members.length} members. Seeding...`);
                const stmt = db.prepare(`
                    INSERT INTO project_registrations (member_id, group_id, project_type, total_saved, status)
                    VALUES (?, ?, ?, ?, 'ACTIVE')
                `);

                members.forEach((m, i) => {
                    const type = i % 2 === 0 ? 'EDUCATION' : 'AGRICULTURE';
                    const saved = (i + 1) * 2000; // 2000, 4000...

                    stmt.run(m.id, groupId, type, saved, (err) => {
                        if (!err) {
                            // Add savings transaction
                            db.run(`INSERT INTO project_savings (registration_id, amount, date) 
                                     VALUES ((SELECT last_insert_rowid()), ?, datetime('now'))`, [saved]);
                        }
                    });
                });
                stmt.finalize();
                console.log('✨ All Done! Refresh Dashboard.');
            });
        });
    });
}

setup();
