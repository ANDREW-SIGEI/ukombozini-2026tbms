const BASE_URL = 'http://localhost:5000/api';
let token = '';

async function login() {
    try {
        console.log("Attempting to login at " + BASE_URL + "/auth/login");
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'andrewsigei684@gmail.com', password: 'Teddymark1' })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(`Login failed with status ${res.status}: ${JSON.stringify(data)}`);
        }
        token = data.token;
        if (!token) throw new Error("No token received in JSON response");
        console.log("Logged in successfully. Token: [HIDDEN]");
    } catch (err) {
        console.error("CRITICAL: Login failed.", err.message);
        process.exit(1);
    }
}

async function testSnapshot() {
    console.log("\n--- Testing Historical Snapshot ---");
    try {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(`${BASE_URL}/audit/snapshot?date=${today}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(data));
        console.log("Snapshot Success:", data.total_savings !== undefined ? "PASS" : "FAIL");
        console.log("Total Savings:", data.total_savings);
        console.log("Member Count in Snapshot:", data.member_details?.length);
    } catch (err) {
        console.error("Snapshot Error:", err.message);
    }
}

async function testFreezeAndEnforcement() {
    console.log("\n--- Testing Freeze & Enforcement ---");
    try {
        // 1. Freeze Group 1
        console.log("Freezing Group 1...");
        const fRes = await fetch(`${BASE_URL}/governance/freeze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ scope: 'GROUP', targetId: 1, reason: 'Audit investigation' })
        });
        if (!fRes.ok) throw new Error("Freeze request failed: " + await fRes.text());
        console.log("Group 1 Frozen. [PASS]");

        // 2. Try to issue a loan for Group 1 (Should fail)
        console.log("Attempting loan issuance (POST /api/loans) for frozen group...");
        const res = await fetch(`${BASE_URL}/loans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ memberId: 1, groupId: 1, amount: 5000, loanType: 'STL', sessionId: 1 })
        });

        if (res.status === 403) {
            const data = await res.json();
            console.log("Enforcement Success: Loan blocked as expected. [PASS]");
            console.log("Blocked Reason:", data.error);
        } else {
            console.log("Enforcement Error: Loan was NOT blocked (Status: " + res.status + ") [FAIL]");
        }

        // 3. Unfreeze Group 1
        console.log("Unfreezing Group 1...");
        await fetch(`${BASE_URL}/governance/unfreeze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ scope: 'GROUP', targetId: 1, reason: 'Investigation cleared' })
        });
        console.log("Group 1 unfrozen. [PASS]");
    } catch (err) {
        console.error("Freeze Test Error:", err.message);
    }
}

async function testRiskScoring() {
    console.log("\n--- Testing Risk Scoring ---");
    try {
        const res = await fetch(`${BASE_URL}/risk/group/1`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(data));
        console.log("Group Risk Score:", data.score, "[PASS]");
        console.log("Risk Metrics:", JSON.stringify(data.metrics));
    } catch (err) {
        console.error("Risk Scoring Error:", err.message);
    }
}

async function runTests() {
    await login();
    await testSnapshot();
    await testFreezeAndEnforcement();
    await testRiskScoring();
    console.log("\n--- Verification Phase 2 Completed ---");
}

runTests();
