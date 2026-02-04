const db = require('./db');
const { runMTELogic } = require('./services/MTEEngine');

async function testMTEBridge() {
    console.log("--- 🧪 Testing MTE SQLite Bridge ---");

    let client = null;
    try {
        // 1. Test queryStandalone
        console.log("Testing queryStandalone...");
        const res = await db.queryStandalone("SELECT count(*) as count FROM members");
        console.log("Member count:", res.rows[0].count);

        // 2. Test Transaction
        console.log("Testing beginTransaction...");
        client = await db.beginTransaction();

        const txRef = `TEST-${Date.now()}`;
        console.log(`Running MTE logic for txRef: ${txRef}`);

        // Try a simple Savings Deposit for Member ID 1
        await runMTELogic(client, {
            memberId: 1,
            sessionId: null,
            transaction_type: 'SAVINGS',
            amount: 100,
            description: 'MTE Bridge Verification',
            txRef
        }, 1);

        console.log("MTE logic executed. Committing...");
        await db.commit(client);
        console.log("✅ Transaction COMMITTED successfully.");

    } catch (error) {
        console.error("❌ Test Failed:", error);
        if (client) {
            console.log("Attempting ROLLBACK...");
            await db.rollback(client).catch(e => console.error("Rollback failed:", e));
        }
    } finally {
        process.exit(0);
    }
}

testMTEBridge();
