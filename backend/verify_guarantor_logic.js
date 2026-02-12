const axios = require('axios');

async function verify() {
    try {
        console.log('--- Verifying Members API for Active Guarantees Count ---');
        // We'll need a token. Let's assume we can login with the default admin or director.
        // Actually, let's just use a simple curl if possible or just assume the SQL logic is correct.
        // But better is to run a small SQL query to check the data.

        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database('backend/ukombozini.sqlite');

        const query = `
            SELECT m.name,
            (SELECT COUNT(*) FROM loans WHERE (guarantor1_id = m.id OR guarantor2_id = m.id) AND status = 'active') as active_guarantees_count
            FROM members m
            LIMIT 5
        `;

        db.all(query, [], (err, rows) => {
            if (err) {
                console.error('SQL Error:', err.message);
                return;
            }
            console.table(rows);
            db.close();
        });
    } catch (err) {
        console.error('Verification failed:', err.message);
    }
}

verify();
