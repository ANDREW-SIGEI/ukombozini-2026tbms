const db = require('./db');

const query = `
    SELECT 
        go.role,
        m.name as member_name,
        m.phone as member_phone,
        g.name as group_name,
        g.id as group_id,
        go.term_start,
        go.status,
        m.id as member_id,
        'OFF-' || go.id as id
    FROM group_officials go
    JOIN members m ON go.member_id = m.id
    JOIN groups g ON go.group_id = g.id
    WHERE go.status = 'active'
`;

console.log("Running API Query...");
db.all(query, [], (err, rows) => {
    if (err) {
        console.error("Query Error:", err.message);
        return;
    }
    console.log(`Query returned ${rows.length} rows.`);
    if (rows.length > 0) {
        console.log("First 3 rows:", rows.slice(0, 3));
    } else {
        console.log("No officials found via join.");

        // Debugging why join failed
        console.log("\n--- Diagnostics ---");
        db.all("SELECT * FROM group_officials LIMIT 5", [], (e, officials) => {
            if (officials.length > 0) {
                const off = officials[0];
                console.log(`Checking first official: member_id=${off.member_id}, group_id=${off.group_id}`);

                db.get("SELECT * FROM members WHERE id = ?", [off.member_id], (e, m) => {
                    console.log(`Member ${off.member_id} exists?`, !!m);
                });

                db.get("SELECT * FROM groups WHERE id = ?", [off.group_id], (e, g) => {
                    console.log(`Group ${off.group_id} exists?`, !!g);
                });
            }
        });
    }
});
