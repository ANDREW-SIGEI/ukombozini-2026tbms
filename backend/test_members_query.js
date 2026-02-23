const axios = require('axios');

async function testApi() {
    try {
        console.log('Hitting /api/members...');
        // We need a token because of authenticateToken middleware
        // But for testing, maybe we can just query the DB directly using the same SQL

        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database('ukombozini.sqlite');

        const query = `
            SELECT m.*, g.name as group_name
            FROM members m
            LEFT JOIN groups g ON m.group_id = g.id
            ORDER BY m.name ASC
        `;

        db.all(query, [], (err, rows) => {
            if (err) {
                console.error('SQL Error:', err);
                return;
            }

            console.log(`Found ${rows.length} members.`);
            if (rows.length > 0) {
                console.log('First member sample:');
                console.log(JSON.stringify(rows[0], null, 2));

                const withGroup = rows.filter(r => r.group_name);
                console.log(`Members with group_name: ${withGroup.length}`);

                const alice = rows.find(r => r.name === 'ALICE BIRIR');
                if (alice) {
                    console.log('Alice data:');
                    console.log(JSON.stringify(alice, null, 2));
                }
            }
            db.close();
        });
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testApi();
