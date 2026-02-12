const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozini.sqlite');

const seedOfficials = [
    { group_id: 1, member_id: 1, role: 'Chairman', term_start: '2025-01-01' },
    { group_id: 1, member_id: 2, role: 'Secretary', term_start: '2025-01-01' },
    { group_id: 2, member_id: 1, role: 'Treasurer', term_start: '2026-01-01' }
];

db.serialize(() => {
    seedOfficials.forEach(off => {
        db.run(`INSERT INTO group_officials (group_id, member_id, role, term_start, status) VALUES (?, ?, ?, ?, 'active')`,
            [off.group_id, off.member_id, off.role, off.term_start]);
    });
    console.log("Seeded officials for testing.");
    db.close();
});
