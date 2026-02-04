const axios = require('axios');

async function testLoanProducts() {
    try {
        console.log("Testing GET /api/loan-products...");

        try {
            // Expecting 401/403 if auth is on, which confirms endpoints existence
            const res = await axios.get('http://localhost:5001/api/loan-products');
            console.log("✅ Endpoint Responded (200 OK)");
            console.log("Data:", res.data);
        } catch (err) {
            if (err.response) {
                console.log(`Response Status: ${err.response.status} ${err.response.statusText}`);
                if (err.response.status === 404) {
                    console.error("❌ Endpoint NOT_FOUND (404)");
                } else if (err.response.data) {
                    console.error("❌ Error Data:", err.response.data);
                }
            } else {
                console.error("❌ Connection Failed:", err.message);
            }
            process.exit(1);
        }
    } catch (error) {
        console.error("Unexpected Error", error);
        process.exit(1);
    }
}

testLoanProducts();
