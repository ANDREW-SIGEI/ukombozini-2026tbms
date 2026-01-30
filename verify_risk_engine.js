const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'backend', 'ukombozi.sqlite');
const RiskService = require('./backend/services/RiskService');

async function verifyRiskLogic() {
    console.log("🚀 Starting Risk Engine Verification...");
    const db = new sqlite3.Database(dbPath);

    try {
        // 1. Setup Test Data: Create a group with a known ID if it doesn't exist
        const group = await new Promise((r, j) => db.get("SELECT id FROM groups LIMIT 1", (err, row) => err ? j(err) : r(row)));
        if (!group) {
            console.error("❌ No groups found in database to test.");
            return;
        }
        const groupId = group.id;
        console.log(`- Testing Group ID: ${groupId}`);

        // 2. Clear existing alerts for this group to have a clean slate
        await new Promise(r => db.run("DELETE FROM risk_alerts WHERE target_id = ?", [groupId], r));

        // 3. Simulate Negative Balance
        // We do this by updating a member's savings to a very negative value
        console.log("- Simulating Negative Balance (Critical Risk)...");
        await new Promise(r => db.run("UPDATE members SET current_savings = -10000 WHERE group_id = ? LIMIT 1", [groupId], r));

        // 4. Run Risk Evaluation
        console.log("- Running Risk Evaluation...");
        const result = await RiskService.evaluateGroupRisk(groupId);
        console.log("- Evaluation Result:", JSON.stringify(result, null, 2));

        // 5. Verify Database Side Effects
        const frozen = await new Promise(r => db.get("SELECT is_frozen FROM groups WHERE id = ?", [groupId], (err, row) => r(row?.is_frozen)));
        const alert = await new Promise(r => db.get("SELECT * FROM risk_alerts WHERE target_id = ? AND alert_type = 'NEGATIVE_BALANCE'", [groupId], (err, row) => r(row)));

        if (frozen === 1) {
            console.log("✅ Group AUTO-FROZEN successfully.");
        } else {
            console.error("❌ Group failed to auto-freeze.");
        }

        if (alert) {
            console.log("✅ Risk Alert generated: ", alert.message);
        } else {
            console.error("❌ Risk Alert not found in database.");
        }

        // 6. Cleanup (Restore savings)
        await new Promise(r => db.run("UPDATE members SET current_savings = 5000 WHERE group_id = ?", [groupId], r));
        await new Promise(r => db.run("UPDATE groups SET is_frozen = 0 WHERE id = ?", [groupId], r));
        console.log("- Test Cleanup Complete.");

    } catch (err) {
        console.error("❌ Verification Failed:", err);
    } finally {
        db.close();
        process.exit();
    }
}

verifyRiskLogic();
