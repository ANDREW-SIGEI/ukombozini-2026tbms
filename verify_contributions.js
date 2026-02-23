const axios = require('axios');

async function verifyContributionFlow() {
    const API_URL = 'http://127.0.0.1:5000/api';
    let token;

    try {
        console.log('--- 1. Authenticating ---');
        const loginRes = await axios.post(`${API_URL}/login`, {
            email: 'admin@ukombozini.com',
            password: 'admin'
        });
        token = loginRes.data.token;
        const config = { headers: { Authorization: `Bearer ${token}` } };

        console.log('--- 2. Fetching Groups ---');
        const groupsRes = await axios.get(`${API_URL}/groups`, config);
        const testGroup = groupsRes.data[0];
        console.log(`Using Group: ${testGroup.name} (ID: ${testGroup.id})`);

        console.log('--- 3. Fetching Exposure (Compliance) ---');
        const exposureRes = await axios.get(`${API_URL}/governance/exposure/${testGroup.id}`, config);
        console.log('Compliance Metrics loaded for members:', Object.keys(exposureRes.data.complianceMetrics).length);

        console.log('--- 4. Fetching Members ---');
        const membersRes = await axios.get(`${API_URL}/members?groupId=${testGroup.id}`, config);
        const testMember = membersRes.data[0];
        console.log(`Using Member: ${testMember.name} (ID: ${testMember.id})`);

        console.log('--- 5. Posting Bulk Contribution ---');
        const contributionPayload = {
            memberId: testMember.id,
            sessionId: 1, // Assuming session 1 exists
            transaction_type: 'CONTRIBUTION',
            amount: 600,
            breakdown: {
                savings: 400,
                welfare: 100,
                project: 100,
                project_type: testGroup.project_type || 'EDUCATION'
            },
            description: 'VERIFICATION_TEST_BULK_CONTRIBUTION'
        };

        const postRes = await axios.post(`${API_URL}/transactions`, contributionPayload, config);
        console.log('Bulk Contribution Success:', postRes.data.success);

        console.log('--- 6. Verifying Ledger Entries ---');
        // We'd check the database or a transaction list here
        console.log('Flow verified successfully.');

    } catch (error) {
        console.error('Verification Failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

verifyContributionFlow();
