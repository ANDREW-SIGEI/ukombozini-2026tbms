const http = require('http');

const BASE_URL = 'http://localhost:5000/api';
let token = '';

function request(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function login() {
    try {
        const res = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            email: 'test@admin.com',
            password: 'testadmin'
        });

        if (res.status === 200) {
            token = res.data.token;
            console.log('✅ Logged in as Admin');
        } else {
            console.error('❌ Login failed:', res.status, res.data);
        }
    } catch (error) {
        console.error('❌ Login error:', error.message);
    }
}

async function testRoutes() {
    if (!token) return;

    const routes = [
        '/api/admin/officers',
        '/api/admin/treasury-status',
        '/api/admin/institutional-stats',
        '/api/admin/board-report',
        '/api/loan-products'
    ];

    for (const route of routes) {
        try {
            const res = await request({
                hostname: 'localhost',
                port: 5000,
                path: route,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 200) {
                console.log(`✅ ${route}: Success`);
            } else {
                console.error(`❌ ${route}: Failed (${res.status})`, res.data);
            }
        } catch (error) {
            console.error(`❌ ${route}: Error:`, error.message);
        }
    }
}

async function runTests() {
    await login();
    await testRoutes();
}

runTests();
