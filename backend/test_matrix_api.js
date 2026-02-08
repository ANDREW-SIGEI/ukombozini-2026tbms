const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
// We need a token. This test script assumes no auth or we need to login First.
// Since backend is running, I'll try to login as admin first.

async function testInternal() {
    try {
        // 1. Login
        console.log("Logging in...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'andrewsigei684@gmail.com',
            password: 'Teddymark1'
        });
        const token = loginRes.data.token;
        console.log("Logged in. Token acquired.");

        // 2. Get Groups to find Evergreen ID
        console.log("Fetching Groups...");
        const groupsRes = await axios.get(`${API_URL}/groups`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Groups Found:", groupsRes.data.map(g => `${g.id}: ${g.name}`));
        const evergreen = groupsRes.data.find(g => g.name.trim().includes("EVERGREEN"));

        if (!evergreen) {
            console.error("EVERGREEN Group not found!");
            return;
        }
        console.log(`Found EVERGREEN Group: ID ${evergreen.id}`);

        // 3. Test Group Matrix
        console.log(`Testing /api/projects/group-matrix/${evergreen.id}...`);
        const matrixRes = await axios.get(`${API_URL}/projects/group-matrix/${evergreen.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("Matrix Response Data:", JSON.stringify(matrixRes.data, null, 2));

    } catch (error) {
        console.error("Test Failed:", error.response ? error.response.data : error.message);
    }
}

testInternal();
