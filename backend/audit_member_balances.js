const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ukombozini.sqlite');

console.log("🔍 Starting Member Balance Audit...");

const query = `
    SELECT 
        m.id, m.name, m.current_savings, m.active_loan_balance, g.name as group_name
    FROM members m
    LEFT JOIN groups g ON m.group_id = g.id
    WHERE m.current_savings < 0 OR m.active_loan_balance < 0
`;

db.all(query, [], (err, rows) => {
    if (err) {
        console.error("❌ Audit Failed:", err.message);
        return;
    }

    if (rows.length === 0) {
        console.log("✅ No negative balances detected. System is clean!");
    } else {
        console.log(`⚠️ Detected ${rows.length} members with negative balances:`);
        console.table(rows);
    }

    // Check for extreme values (potential data entry errors)
    db.all("SELECT id, name, current_savings FROM members WHERE ABS(current_savings) > 500000", [], (err, extremeRows) => {
        if (extremeRows && extremeRows.length > 0) {
            console.log("🚩 Extreme savings detected (> 500k):");
            console.table(extremeRows);
        }
        db.close();
    });
});
