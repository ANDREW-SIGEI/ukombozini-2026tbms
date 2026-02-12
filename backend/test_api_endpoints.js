const http = require('http');
const fs = require('fs');

const TOKEN_FILE = 'admin_token.json';
let token = '';

try {
    const data = fs.readFileSync(TOKEN_FILE, 'utf8');
    const json = JSON.parse(data);
    token = json.token;
    console.log("Loaded token from file.");
} catch (e) {
    console.warn("Could not load token file:", e.message);
}

function makeRequest(path, method = 'GET') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port: 5000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.end();
    });
}

async function runTests() {
    console.log("Testing /api/status...");
    try {
        const statusRes = await makeRequest('/api/status');
        console.log(`Status: ${statusRes.statusCode}`);
        console.log(`Body: ${statusRes.data}`);
    } catch (e) {
        console.error("Failed to connect to /api/status:", e.message);
        return;
    }

    console.log("\nTesting /api/governance/officials...");
    try {
        const officialsRes = await makeRequest('/api/governance/officials');
        console.log(`Status: ${officialsRes.statusCode}`);
        console.log(`Body Sample: ${officialsRes.data.substring(0, 500)}`);
    } catch (e) {
        console.error("Failed to connect to /api/governance/officials:", e.message);
    }
}

runTests();
