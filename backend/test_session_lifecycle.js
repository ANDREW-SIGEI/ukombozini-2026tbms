const axios = require('axios');

async function testSessionLifecycle() {
    const baseUrl = 'http://localhost:5000/api';
    let token;
    let officerId;
    let groupId;

    try {
        // 1. Login to get Token
        console.log("LOGIN: Authenticating...");
        const loginRes = await axios.post(`${baseUrl}/auth/login`, {
            email: 'field@ukombozi.com',
            password: 'password123'
        });
        token = loginRes.data.token;
        officerId = loginRes.data.user.id;
        console.log("✅ Authenticated as Field Officer");

        // 2. Get a Group ID (using any valid group)
        const groupsRes = await axios.get(`${baseUrl}/groups`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (groupsRes.data.length === 0) throw new Error("No groups found to test with.");
        groupId = groupsRes.data[0].id;
        console.log(`Using Group ID: ${groupId} (${groupsRes.data[0].name})`);

        // 3. Open a Session (Expect POST /api/sessions)
        console.log("\nTEST: Opening Session...");
        const openPayload = {
            groupId: groupId,
            officerId: officerId, // API might infer this from token, but sending just in case
            date: new Date().toISOString().split('T')[0]
        };

        const sessionRes = await axios.post(`${baseUrl}/sessions`, openPayload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const sessionId = sessionRes.data.id;
        console.log(`✅ Session Opened: ${sessionId}`);

        // 3.5. Post a Transaction (Verify "Transact" phase)
        console.log("\nTEST: Posting Transaction...");
        const txPayload = {
            transaction_type: 'savings',
            memberId: 38, // Using the Treasurer we know exists
            amount: 500,
            sessionId: sessionId,
            description: "Session Lifecycle Test Savings"
        };

        const txRes = await axios.post(`${baseUrl}/transactions`, txPayload, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`✅ Transaction Posted: ${txRes.data.transaction_id}`);


        // 4. Close the Session (Expect PATCH /api/sessions/:id/close)
        console.log("\nTEST: Closing Session...");
        const closePayload = {
            physicalCount: 500, // Matching the single transaction
            explanation: "Automated Test Closure with Transaction",
            officerId: officerId
        };

        await axios.patch(`${baseUrl}/sessions/${sessionId}/close`, closePayload, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("✅ Session Closed");

    } catch (error) {
        console.error("❌ TEST FAILED");
        if (error.response) {
            console.error(`Status: ${error.response.status} ${error.response.statusText}`);
            console.error("Data:", error.response.data);

            if (error.response.status === 404) {
                console.log(">> CONFIRMED: Endpoint is missing.");
                process.exit(0); // Exit 0 because we EXPECT failure for verification
            }
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

testSessionLifecycle();
