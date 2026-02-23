const axios = require('axios');
const API_URL = 'http://127.0.0.1:5000/api';

async function verifyComplianceMetrics() {
    console.log("🚀 Verifying Compliance Metrics Integration...");

    try {
        // 1. Login
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'andrewsigei684@gmail.com',
            password: 'password123'
        });
        const token = loginRes.data.token;
        const authHeader = { Authorization: `Bearer ${token}` };

        // 2. Get a group
        const groupsRes = await axios.get(`${API_URL}/groups`, { headers: authHeader });
        if (groupsRes.data.length === 0) {
            console.error("❌ No groups found.");
            return;
        }
        const groupId = groupsRes.data[0].id;
        console.log(`Checking exposure for Group ID: ${groupId} (${groupsRes.data[0].name})`);

        // 3. Fetch Exposure
        const exposureRes = await axios.get(`${API_URL}/partnership/exposure/${groupId}`, { headers: authHeader });

        console.log("Exposure Response Keys:", Object.keys(exposureRes.data));

        if (exposureRes.data.complianceMetrics) {
            console.log("✅ SUCCESS: complianceMetrics found in response!");
            const sampleMemberId = Object.keys(exposureRes.data.complianceMetrics)[0];
            console.log(`Sample Member (${sampleMemberId}) status:`, exposureRes.data.complianceMetrics[sampleMemberId]);
        } else {
            console.log("❌ FAILURE: complianceMetrics NOT found in response.");
        }

    } catch (error) {
        console.error("❌ verification failed:", error.response?.data || error.message);
    }
}

verifyComplianceMetrics();
