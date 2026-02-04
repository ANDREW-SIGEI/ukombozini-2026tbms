const axios = require('axios');

async function testLoansEndpoint() {
    try {
        console.log("Testing GET /api/loans...");
        // Assuming we have a way to authenticate or bypass for test, 
        // but for now let's just see if it's reachable. 
        // Since we enabled authentication middleware on the route, 
        // we might get 401 or 403, which is actually a GOOD sign (means route exists).
        // If it was 404, it would mean it's still missing.

        try {
            await axios.get('http://localhost:5001/api/loans');
        } catch (err) {
            if (err.response) {
                console.log(`Response Status: ${err.response.status} ${err.response.statusText}`);
                if (err.response.status === 404) {
                    console.error("❌ Endpoint NOT_FOUND (404)");
                    process.exit(1);
                } else if (err.response.status === 401 || err.response.status === 403) {
                    console.log("✅ Endpoint FOUND (Auth Challenge Received)");
                    process.exit(0);
                } else {
                    console.log("✅ Endpoint Responded");
                    process.exit(0);
                }
            } else {
                console.error("❌ Connection Failed:", err.message);
                process.exit(1);
            }
        }
    } catch (error) {
        console.error("Unexpected Error", error);
        process.exit(1);
    }
}

testLoansEndpoint();
