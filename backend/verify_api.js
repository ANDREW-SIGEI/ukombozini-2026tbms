const axios = require('axios');

async function verify() {
    try {
        console.log("Logging in as Admin...");
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'andrewsigei684@gmail.com', // Match seeded data
            password: 'Teddymark1' // Match seeded data
        });
        const token = loginRes.data.token;
        console.log("Login successful.");

        const headers = { Authorization: `Bearer ${token}` };

        console.log("\n--- GET /api/groups ---");
        const groupsRes = await axios.get('http://localhost:5000/api/groups', { headers });
        console.log(`Found ${groupsRes.data.length} groups.`);

        console.log("\n--- GET /api/loan-products ---");
        const productsRes = await axios.get('http://localhost:5000/api/loan-products', { headers });
        console.log(`Found ${productsRes.data.length} loan products.`);

    } catch (err) {
        console.error("Verification failed:", err.response ? err.response.data : err.message);
    }
}

verify();
