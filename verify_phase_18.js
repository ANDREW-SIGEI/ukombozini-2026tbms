const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozini.sqlite');
const MTEEngine = require('./backend/services/MTEEngine');
const CashControlService = require('./backend/services/CashControlService');

// Mock db for MTEEngine
db.query = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve({ rows });
        });
    });
};

// Add queryStandalone to db for MTEEngine compatibility
db.queryStandalone = db.query;

async function verify() {
    console.log("🚀 Starting Phase 18 Verification: Reconciliation Hardening");

    const groupId = 1; // Assuming group 1 exists
    const officerId = 1;
    const sessionId = 9999; // Mock session
    const date = new Date().toISOString().split('T')[0];

    try {
        // 1. Clean up old test data
        await new Promise(r => db.run("DELETE FROM cash_sessions WHERE meeting_id = ?", [sessionId], r));
        await new Promise(r => db.run("DELETE FROM ledger_entries WHERE session_id = ?", [sessionId], r));

        console.log("1️⃣ Opening Cash Session linked to Meeting ID 9999...");
        const sessionResult = await CashControlService.openSession(groupId, officerId, date, sessionId);
        const cashSessionId = sessionResult.id;
        console.log(`✅ Cash Session opened: ${cashSessionId}`);

        console.log("2️⃣ Running MTE Logic for GROUP_LOAN_REPAYMENT (500 KES)...");
        const txParams = {
            memberId: 0,
            sessionId: sessionId,
            transaction_type: 'GROUP_LOAN_REPAYMENT',
            amount: 500,
            description: 'Phase 18 Test Repayment',
            txRef: `TEST-P18-${Date.now()}`,
            groupId: groupId
        };

        const mteClient = { query: (sql, params) => db.query(sql, params) };
        await MTEEngine.runMTELogic(mteClient, txParams, officerId);
        console.log("✅ MTE Logic execution completed.");

        console.log("3️⃣ Verifying Mirroring in cash_transactions...");
        const cashTx = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM cash_transactions WHERE cash_session_id = ? AND source = 'GROUP_LOAN_REPAYMENT'", [cashSessionId], (err, row) => {
                err ? reject(err) : resolve(row);
            });
        });

        if (cashTx) {
            console.log("✅ SUCCESS: Transaction mirrored in cash_transactions!");
            console.log(`   - Amount: ${cashTx.amount}`);
            console.log(`   - Direction: ${cashTx.direction} (Expected OUT for Repayment)`);
            if (cashTx.amount === 500 && cashTx.direction === 'OUT') {
                console.log("✅ Data integrity confirmed.");
            } else {
                console.error("❌ FAILURE: Data mismatch in mirrored transaction.");
            }
        } else {
            console.error("❌ FAILURE: Transaction NOT found in cash_transactions.");
        }

        console.log("4️⃣ Verifying Ledger Consistency...");
        const ledgerTx = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM ledger_entries WHERE session_id = ? AND notes LIKE '%Phase 18 Test%'", [sessionId], (err, row) => {
                err ? reject(err) : resolve(row);
            });
        });

        if (ledgerTx) {
            console.log("✅ SUCCESS: Primary ledger entry found.");
        } else {
            console.error("❌ FAILURE: Primary ledger entry missing.");
        }

    } catch (err) {
        console.error("💥 Verification Failed:", err);
    } finally {
        db.close();
    }
}

verify();
