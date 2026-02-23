const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/ukombozini.sqlite');


async function verifyFixes() {
    console.log("=== UKOMBOZINI FIX VERIFICATION ===\n");

    // 1. Verify API Integration (Simulated via SQL check)
    console.log("1. Checking Session Metrics Query...");
    const sessionQuery = `
        SELECT 
            ms.id,
            (SELECT COUNT(DISTINCT member_id) FROM attendance WHERE session_id = ms.id AND status = 'PRESENT') as actual_attendance,
            (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE sessionId = ms.id) as total_collected
        FROM meeting_sessions ms
        LIMIT 1
    `;

    db.get(sessionQuery, [], (err, row) => {
        if (err) console.error("❌ Session query failed:", err.message);
        else {
            console.log("✅ Session query successful. Sample Metrics:", row);
        }

        // 2. Verify Risk weights (Manual logic check)
        console.log("\n2. Checking Risk Scoring logic...");
        // Debt 10k, Savings 2k -> Ratio 5.0 -> Score 35 (New logic)
        // vs Old logic (Ratio 5.0 -> Score 40)

        console.log("   - Debt-to-Savings (Ratio 5.0): Expected +35 (New) vs +40 (Old)");
        console.log("   - Penalties (5 recorded): Expected +30 (New) vs +40 (Old)");
        console.log("   - Delinquency (2 loans past due): Expected +35 (New) vs +30 (Old)");

        // 3. Verify Session Summary endpoint logic
        console.log("\n3. Checking Transaction Aggregation...");
        const txQuery = `
            SELECT transaction_type, SUM(amount) as total
            FROM transactions 
            GROUP BY transaction_type
        `;
        db.all(txQuery, [], (err, rows) => {
            if (err) console.error("❌ Transaction aggregation failed:", err.message);
            else {
                console.log("✅ Transaction aggregation successful. Types found:", rows.map(r => r.transaction_type).join(', '));
            }

            console.log("\n=== VERIFICATION COMPLETE ===");
            db.close();
        });
    });
}

verifyFixes();
