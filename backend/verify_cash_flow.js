const CashControlService = require('./services/CashControlService');

async function verifyFlow() {
    const groupId = 1;
    const officerId = 1;
    const date = new Date().toISOString().split('T')[0];

    try {
        console.log("--- 1. Opening Session ---");
        const session = await CashControlService.openSession(groupId, officerId, date);
        console.log("Session Opened:", session.id);

        console.log("\n--- 2. Simulating Transaction ---");
        await CashControlService.logRecord({
            sessionId: session.id,
            source: 'CONTRIBUTION',
            amount: 5000,
            direction: 'IN',
            referenceId: 'REF-12345',
            createdBy: officerId
        });
        console.log("Transaction Logged.");

        console.log("\n--- 3. Verifying & Locking (10 KES Variance) ---");
        const lockRes = await CashControlService.verifyAndLock(session.id, 5010, "Small change difference", officerId);
        console.log("Lock Result:", lockRes);

        console.log("\n--- FLOW VERIFIED ---");
        process.exit(0);
    } catch (err) {
        console.error("FLOW FAILED:", err.message);
        process.exit(1);
    }
}

verifyFlow();
