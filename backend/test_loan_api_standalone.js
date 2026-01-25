const http = require('http');

const payload = JSON.stringify({
    memberId: 1,
    groupId: 1,
    loanType: "STL",
    amount: 5000,
    duration: 3,
    purpose: "Inventory purchase",
    monthly_installment: 1700,
    principal_portion: 1666,
    interest_portion: 34,
    shares_contribution: 0,
    officerId: 1
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/loan-applications',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Submission Status Code:', res.statusCode);
        console.log('Submission Response:', data);

        if (res.statusCode === 200) {
            const appNumber = JSON.parse(data).application_number;
            console.log('\nFetching loan applications to verify...');

            http.get('http://localhost:5000/api/loan-applications', (res2) => {
                let data2 = '';
                res2.on('data', (chunk) => { data2 += chunk; });
                res2.on('end', () => {
                    const apps = JSON.parse(data2);
                    const testApp = apps.find(a => a.application_number === appNumber);
                    if (testApp) {
                        console.log('SUCCESS: Application found in list:', testApp.application_number);
                        console.log('Status:', testApp.status);
                        console.log('Member Name:', testApp.member.name);
                    } else {
                        console.log('FAILURE: Application not found in list.');
                    }
                });
            });
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(payload);
req.end();
