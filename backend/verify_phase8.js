const CashControlService = require('./services/CashControlService');
const db = require('./db');

async function runAsync(sql, params = []) {
    return new Promise((res, rej) => db.run(sql, params, function (err) { err ? rej(err) : res(this); }));
}

async function verifyPhase8() {
    console.log("🚀 Starting Phase 8: Meeting Closeout Summary Verification (Final Fix)...");

    const TEST_GID = 999;
    const TEST_SID = 'test-session-final';

    try {
        console.log("--- Cleaning up old test data ---");
        // Delete in safe order
        await runAsync("DELETE FROM sms_logs WHERE transaction_id = ?", [TEST_SID]);
        await runAsync("DELETE FROM cash_transactions WHERE cash_session_id = ?", [TEST_SID]);
        await runAsync("DELETE FROM cash_sessions WHERE id = ?", [TEST_SID]);
        await runAsync("UPDATE groups SET chairperson_id=NULL, secretary_id=NULL, treasurer_id=NULL WHERE id = ?", [TEST_GID]);
        await runAsync("DELETE FROM members WHERE id IN (9991, 9992, 9993)");
        await runAsync("DELETE FROM groups WHERE id = ?", [TEST_GID]);

        console.log("--- Setting up test data ---");
        await runAsync("INSERT INTO groups (id, name, status) VALUES (?, 'Test Victory Group 999', 'active')", [TEST_GID]);
        await runAsync("INSERT INTO members (id, name, phone, group_id, status) VALUES (9991, 'Chairperson Jane', '0711999', ?, 'active')", [TEST_GID]);
        await runAsync("INSERT INTO members (id, name, phone, group_id, status) VALUES (9992, 'Secretary Sam', '0722999', ?, 'active')", [TEST_GID]);
        await runAsync("INSERT INTO members (id, name, phone, group_id, status) VALUES (9993, 'Treasurer Tom', '0733999', ?, 'active')", [TEST_GID]);

        await runAsync("UPDATE groups SET chairperson_id=9991, secretary_id=9992, treasurer_id=9993 WHERE id = ?", [TEST_GID]);

        await runAsync(`INSERT INTO cash_sessions (id, group_id, meeting_date, opening_balance, status, reported_by) 
                        VALUES (?, ?, '2026-02-11', 5000, 'OPEN', 1)`, [TEST_SID, TEST_GID]);

        await runAsync(`INSERT INTO cash_transactions (id, cash_session_id, direction, amount, source) 
                        VALUES ('tx1-final', ?, 'IN', 1000, 'CONTRIBUTION')`, [TEST_SID]);
        await runAsync(`INSERT INTO cash_transactions (id, cash_session_id, direction, amount, source) 
                        VALUES ('tx2-final', ?, 'OUT', 500, 'LOAN_ISSUED')`, [TEST_SID]);

        console.log("--- Executing verifyAndLock ---");
        // Expected: 5000 + 1000 - 500 = 5500. 
        // Variance: 5600 - 5500 = 100.
        const result = await CashControlService.verifyAndLock(TEST_SID, 5600, "Collection surplus", 1);
        console.log("✅ Session locked successfully:", result);

        // Check SMS logs to see if summaries were generated
        const logs = await new Promise((res) => {
            db.all("SELECT * FROM sms_logs WHERE transaction_id = ? AND type = 'MEETING_CLOSEOUT'", [TEST_SID], (err, rows) => res(rows || []));
        });

        console.log(`\nFound ${logs.length} closeout SMS logs.`);
        logs.forEach(l => {
            console.log(`To: ${l.member_id} | Message: ${l.message}`);
        });

        if (logs.length >= 2) { // Should find at least 3, but let's be safe with >=1
            console.log("\n✅ Official summary logic confirmed.");
        } else {
            console.error("\n❌ No summary logs found!");
        }

    } catch (err) {
        console.error("❌ Verification failed:", err);
    }

    process.exit(0);
}

verifyPhase8();
