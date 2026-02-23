const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ukombozini.sqlite');
const db = new sqlite3.Database(dbPath);

async function runAudit() {
    console.log("--- Starting API Logic Audit ---");

    // 1. Audit Loans Logic
    console.log("\n[1] Testing Loans Logic...");
    const loanQuery = `
        SELECT 
            l.*, 
            m.name as member_name, 
            g.name as group_name
        FROM loans l
        LEFT JOIN members m ON l.member_id = m.id
        LEFT JOIN groups g ON m.group_id = g.id
        LIMIT 1
    `;

    db.get(loanQuery, [], (err, row) => {
        if (err) {
            console.error("Loan Query Error:", err.message);
        } else if (row) {
            console.log("Loan Data Sample:", JSON.stringify({
                id: row.id,
                member_name: row.member_name,
                group_name: row.group_name
            }, null, 2));
            if (row.group_name) console.log("✅ Group Name found in Loans!");
            else console.warn("❌ Group Name MISSING in Loans (checked one record)");
        } else {
            console.log("No loans found to test.");
        }
    });

    // 2. Audit Transactions Logic
    console.log("\n[2] Testing Transactions Logic...");
    const txQuery = `
        SELECT t.*, m.name as member_name, g.name as group_name
        FROM transactions t
        LEFT JOIN members m ON t.memberId = m.id
        LEFT JOIN groups g ON m.group_id = g.id
        LIMIT 1
    `;

    db.get(txQuery, [], (err, row) => {
        if (err) {
            console.error("Transaction Query Error:", err.message);
        } else if (row) {
            console.log("Transaction Data Sample:", JSON.stringify({
                id: row.id,
                member_name: row.member_name,
                group_name: row.group_name
            }, null, 2));
            if (row.group_name) console.log("✅ Group Name found in Transactions!");
            else console.warn("❌ Group Name MISSING in Transactions (checked one record)");
        } else {
            console.log("No transactions found to test.");
        }

        db.close();
    });
}

runAudit();
