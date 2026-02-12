const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/ukombozini.sqlite');

async function syncOfficials() {
    return new Promise((resolve, reject) => {
        db.all("SELECT id, chairperson_id, secretary_id, treasurer_id, chairperson, secretary, treasurer FROM groups", [], async (err, groups) => {
            if (err) return reject(err);

            console.log(`Processing ${groups.length} groups...`);

            for (const group of groups) {
                const officials = [
                    { id: group.chairperson_id, name: group.chairperson, role: 'Chairman' },
                    { id: group.secretary_id, name: group.secretary, role: 'Secretary' },
                    { id: group.treasurer_id, name: group.treasurer, role: 'Treasurer' }
                ];

                for (const official of officials) {
                    if (official.id) {
                        await new Promise((res, rej) => {
                            // Check if already exists
                            db.get("SELECT id FROM group_officials WHERE group_id = ? AND role = ? AND member_id = ?", [group.id, official.role, official.id], (err, row) => {
                                if (err) return rej(err);
                                if (!row) {
                                    console.log(`Syncing ${official.role} (${official.name}) for Group ${group.id}...`);
                                    db.run(
                                        "INSERT INTO group_officials (group_id, member_id, role, term_start, status) VALUES (?, ?, ?, ?, 'active')",
                                        [group.id, official.id, official.role, new Date().toISOString().split('T')[0]],
                                        (err) => err ? rej(err) : res()
                                    );
                                } else {
                                    res();
                                }
                            });
                        });
                    }
                }
            }
            console.log("Sync complete.");
            db.close();
            resolve();
        });
    });
}

syncOfficials().catch(err => console.error(err));
