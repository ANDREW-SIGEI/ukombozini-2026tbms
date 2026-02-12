const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozini.sqlite');

const GROUP_NAME = "KAPKORES UNITY";

db.serialize(() => {
    // 1. Get Group ID
    db.get("SELECT id FROM groups WHERE name LIKE ?", [`%${GROUP_NAME}%`], (err, group) => {
        if (err || !group) { console.log("Group not found"); return; }
        const groupId = group.id;

        // 2. Get Members of this group
        db.all("SELECT id, name FROM members WHERE group_id = ?", [groupId], (err, members) => {
            if (err) { console.error(err); return; }

            const memberIds = members.map(m => m.id);
            console.log(`Checking transactions for ${members.length} members: ${memberIds.join(', ')}`);

            if (memberIds.length > 0) {
                // 3. Check Transactions for these members
                const placeholders = memberIds.map(() => '?').join(',');
                db.all(`SELECT * FROM transactions WHERE memberId IN (${placeholders}) LIMIT 5`, memberIds, (err, txs) => {
                    console.log("TRANSACTIONS_JSON:" + JSON.stringify(txs));
                });

                // 4. Check Member Rows again
                db.all(`SELECT * FROM members WHERE id IN (${placeholders})`, memberIds, (err, rows) => {
                    console.log("FULL_MEMBER_ROWS_JSON:" + JSON.stringify(rows));
                });
            }
        });
    });
});
