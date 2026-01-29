const BASE_URL = 'http://localhost:5000/api';
let adminToken = '';
let directorToken = '';

async function login(email, password) {
    try {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`Login failed for ${email}`);
        return data.token;
    } catch (err) {
        console.error(err.message);
        return null;
    }
}

async function testGovernanceChecks() {
    console.log("\n--- Testing Governance (Treasurer & Terms) ---");
    try {
        console.log("Attempting loan for Group 1 (Verify Governance)...");
        const res = await fetch(`${BASE_URL}/loans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ memberId: 1, groupId: 1, amount: 5000, loanType: 'STL', sessionId: 1, interestRate: 10 })
        });
        const data = await res.json();
        console.log("Status:", res.status);
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Governance Test Error:", err.message);
    }
}

async function testReversalWorkflow() {
    console.log("\n--- Testing Reversal Workflow ---");
    try {
        console.log("Requesting Reversal for Transaction 1...");
        const reqRes = await fetch(`${BASE_URL}/reversals/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ transaction_id: 1, reason: "Correction needed" })
        });
        const reqData = await reqRes.json();
        console.log("Request Status:", reqRes.status);
        console.log("Request Response:", JSON.stringify(reqData, null, 2));

        if (reqRes.ok) {
            const requestId = reqData.request_id;
            console.log("Attempting Self-Approval...");
            const selfRes = await fetch(`${BASE_URL}/reversals/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                body: JSON.stringify({ request_id: requestId })
            });
            console.log("Self-Approval Status:", selfRes.status);
            console.log("Self-Approval Response:", await selfRes.json());

            console.log("Approving with Director...");
            const appRes = await fetch(`${BASE_URL}/reversals/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${directorToken}` },
                body: JSON.stringify({ request_id: requestId })
            });
            console.log("Director Approval Status:", appRes.status);
            console.log("Director Approval Response:", await appRes.json());
        }
    } catch (err) {
        console.error("Reversal Test Error:", err.message);
    }
}

async function testProjectWindow() {
    console.log("\n--- Testing Project Windows ---");
    try {
        console.log("Attempting Project Registration (Jan-Mar)...");
        const res = await fetch(`${BASE_URL}/projects/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ member_id: 1, project_type: 'Agriculture' })
        });
        const data = await res.json();
        console.log("Registration Status:", res.status);
        console.log("Registration Response:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Project Test Error:", err.message);
    }
}

async function runTests() {
    adminToken = await login('andrewsigei684@gmail.com', 'Teddymark1');
    directorToken = await login('andrewsigei6@gmail.com', 'Teddymark11$');

    if (!adminToken || !directorToken) {
        console.error("Authentication failed.");
        return;
    }

    await testGovernanceChecks();
    await testReversalWorkflow();
    await testProjectWindow();
}

runTests();
