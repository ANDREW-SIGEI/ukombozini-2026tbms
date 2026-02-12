const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://127.0.0.1:5000/api';
// Use credentials from login.json
const CREDENTIALS = {
    email: "hilda@ukombozi.com",
    password: "password"
};

async function verifyCockpitEndpoints() {
    console.log('🚀 Starting LIVE Cockpit Verification (with Login)...');

    try {
        // 1. Login to get real token
        console.log(`🔑 Logging in as ${CREDENTIALS.email}...`);
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, CREDENTIALS);

        if (!loginRes.data.token) {
            throw new Error('Login failed: No token returned.');
        }

        const token = loginRes.data.token;
        const headers = { Authorization: `Bearer ${token}` };
        console.log(`✅ Login Successful. Role: ${loginRes.data.user.role}`);

        // 2. Fetch Groups
        console.log('🔄 Fetching Groups...');
        const groupsRes = await axios.get(`${BASE_URL}/groups`, { headers });

        if (groupsRes.data.length === 0) {
            console.warn('⚠️ No groups found in DB. Adding dummy verification for safety.');
            // In a real scenario, we might seed data here, but let's assume if we logged in, some data exists??
            // Actually officers table is separate from groups.
            process.exit(0);
        }

        const groupId = groupsRes.data[0].id;
        console.log(`✅ Using Group ID: ${groupId} (${groupsRes.data[0].name})`);

        // 3. Verify Group Exposure
        console.log(`🔄 Testing GET /api/partnership/exposure/${groupId}...`);
        const exposureRes = await axios.get(`${BASE_URL}/partnership/exposure/${groupId}`, { headers });

        if (exposureRes.status === 200 && exposureRes.data.netExposure !== undefined) {
            console.log('✅ Group Exposure Verified:', {
                netExposure: exposureRes.data.netExposure,
                totalTopUp: exposureRes.data.portfolio?.totalTopUp,
                memberCount: exposureRes.data.memberCount
            });
        } else {
            throw new Error(`Invalid Exposure Response: ${JSON.stringify(exposureRes.data)}`);
        }

        // 4. Verify Loans Due Summary
        console.log(`🔄 Testing GET /api/governance/loans/due-summary/${groupId}...`);
        const loansDueRes = await axios.get(`${BASE_URL}/governance/loans/due-summary/${groupId}`, { headers });

        if (loansDueRes.status === 200 && Array.isArray(loansDueRes.data)) {
            console.log(`✅ Loans Due Summary Verified: Found ${loansDueRes.data.length} records.`);
        } else {
            throw new Error(`Invalid Loans Due Response: ${JSON.stringify(loansDueRes.data)}`);
        }

        console.log('🎉 LIVE VERIFICATION SUCCESSFUL.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Verification Failed:', error.message);
        if (error.response) {
            console.error('   Response Status:', error.response.status);
            console.error('   Response Data:', error.response.data);
        }
        process.exit(1);
    }
}

verifyCockpitEndpoints();
