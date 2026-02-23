const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('backend/ukombozini.sqlite');

const memberId = 1;

db.get(`
    SELECT m.id as m_id, m.current_savings, g.id as g_id, g.loan_multiplier, g.is_frozen
    FROM members m
    JOIN groups g ON m.group_id = g.id
    WHERE m.id = ?
`, [memberId], (err, row) => {
    if (err) {
        console.error('❌ Query Error:', err.message);
    } else if (!row) {
        console.log('❌ No row found for memberId', memberId);
        // Check member separately
        db.get('SELECT * FROM members WHERE id=?', [memberId], (mErr, mRow) => {
            console.log('Member check:', mRow ? 'Exists' : 'NOT found', mRow);
            if (mRow) {
                db.get('SELECT * FROM groups WHERE id=?', [mRow.group_id], (gErr, gRow) => {
                    console.log('Group check (ID ' + mRow.group_id + '):', gRow ? 'Exists' : 'NOT found', gRow);
                });
            }
        });
    } else {
        console.log('✅ Row found:', JSON.stringify(row));
    }
});
