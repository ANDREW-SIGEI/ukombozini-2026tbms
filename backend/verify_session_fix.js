const axios = require('axios');

async function verifyFix() {
    const baseUrl = 'http://localhost:5000/api';
    let token;

    try {
        // 1. Login
        console.log("Logging in...");
        const loginRes = await axios.post(`${baseUrl}/auth/login`, {
            email: 'field@ukombozi.com',
            password: 'password123'
        }).catch(err => {
            // Fallback to sarah@tbms.com if field@ukombozi.com doesn't exist
            return axios.post(`${baseUrl}/auth/login`, {
                email: 'sarah@tbms.com',
                password: '123456'
            });
        });
        token = loginRes.data.token;
        console.log("Logged in successfully.");

        // 2. Try creating a session for KAPKORES UNITY (assuming ID 4 based on earlier findings)
        // Let's check groups first to be sure
        const groupsRes = await axios.get(`${baseUrl}/groups`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const kapkores = groupsRes.data.find(g => g.name.includes('KAPKORES'));

        if (!kapkores) {
            console.error("KAPKORES group not found!");
            return;
        }
        console.log(`Found KAPKORES group with ID: ${kapkores.id}`);

        console.log("Attempting to create a meeting session...");
        const sessionRes = await axios.post(`${baseUrl}/sessions`, {
            groupId: kapkores.id,
            officerId: loginRes.data.user.id,
            date: new Date().toISOString().split('T')[0],
            startTime: new Date().toISOString(),
            venue: 'Test Venue',
            agenda: 'Testing session creation fix',
            meeting_type: 'Routine',
            expected_attendance: 10
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("Session created successfully:", sessionRes.data);
        console.log("FIX VERIFIED!");

    } catch (error) {
        console.error("Verification failed:", error.response?.data || error.message);
    }
}

verifyFix();
