const axios = require('axios');

async function testLogin() {
    try {
        console.log("Testing Login for Field Officer...");
        const response = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'field@ukombozi.com',
            password: 'password123'
        });

        console.log("✅ Login Successful");
        console.log("User Role:", response.data.user.role);
        console.log("Token Received:", !!response.data.token);

        if (response.data.user.role.toLowerCase() === 'field officer') {
            console.log("✅ Role verified correctly.");
        } else {
            console.warn("⚠️ Role mismatch or formatting issue:", response.data.user.role);
        }

    } catch (error) {
        console.error("❌ Login Failed");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

testLogin();
