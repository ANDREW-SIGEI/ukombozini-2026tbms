const axios = require('axios');

async function verify() {
    try {
        console.log("Logging in as Director...");
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'andrewsigei6@gmail.com',
            password: 'Teddymark11$'
        });
        const token = loginRes.data.token;
        console.log("Login successful.");

        const headers = { Authorization: `Bearer ${token}` };

        console.log("\n--- GET /api/officials ---");
        const officialsRes = await axios.get('http://localhost:5000/api/officials', { headers });
        console.log(JSON.stringify(officialsRes.data, null, 2));

        console.log("\n--- POST /api/notifications/bulk (Testing Roles) ---");
        const bulkRes = await axios.post('http://localhost:5000/api/notifications/bulk', {
            target: 'ROLES',
            targetIds: ['Chairman', 'Secretary'],
            message: 'Verification broadcast for officials hub.',
            method: 'SMS'
        }, { headers });
        console.log(JSON.stringify(bulkRes.data, null, 2));

        console.log("\n--- GET /api/notifications/logs ---");
        const logsRes = await axios.get('http://localhost:5000/api/notifications/logs', { headers });
        console.log(JSON.stringify(logsRes.data, null, 2));

    } catch (err) {
        console.error("Verification failed:", err.response ? err.response.data : err.message);
    }
}

verify();
