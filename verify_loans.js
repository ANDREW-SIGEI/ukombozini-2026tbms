const http = require('http');

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

async function testLoanEnforcement() {
    // 1. Login
    const loginRes = await request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        email: 'test@admin.com',
        password: 'testadmin'
    });

    const token = loginRes.data.token;
    console.log('✅ Logged in');

    // 2. Try to issue loan of 1000 to Judy (Member ID 29, Savings 0, Multiplier 3)
    console.log('Submitting loan of 1000 (Limit should be 0)...');
    const loanRes = await request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/loans',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    }, {
        memberId: 29,
        groupId: 4,
        loanType: 'STL',
        amount: 1000,
        interestRate: 10,
        duration: 3,
        officerId: 1
    });

    if (loanRes.status === 400 && loanRes.data.error.includes('limit exceeded')) {
        console.log('✅ Loan enforcement success: Rejection as expected.');
        console.log('Message:', loanRes.data.error);
    } else {
        console.error('❌ Loan enforcement FAILED:', loanRes.status, loanRes.data);
    }
}

testLoanEnforcement();
