const API_URL = 'http://localhost:5000/api';

async function testCommunication() {
    try {
        // 1. Login to get token
        console.log(`🔑 Logging in to ${API_URL}/auth/login...`);
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'andrewsigei684@gmail.com',
                password: 'password123'
            })
        });

        if (!loginRes.ok) {
            const txt = await loginRes.text();
            throw new Error(`Login failed: ${loginRes.status} ${loginRes.statusText} - ${txt}`);
        }
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('✅ Login successful');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // 2. Check Balance
        console.log('\n💰 Checking SMS Balance...');
        const balanceRes = await fetch(`${API_URL}/communication/balance`, { headers });
        const balanceData = await balanceRes.json();
        console.log('✅ Balance:', balanceData);

        // 3. Get Logs
        console.log('\n📜 Fetching SMS Logs...');
        const logsRes = await fetch(`${API_URL}/communication/logs?limit=5`, { headers });
        const logsData = await logsRes.json();
        console.log(`✅ Logs retrieved: ${logsData.length}`);

    } catch (error) {
        console.error('❌ Test Failed:', error);
        if (error.cause) console.error('Cause:', error.cause);
    }
}

testCommunication();
