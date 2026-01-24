const http = require('http');

const data = JSON.stringify({
    name: "New Test Officer",
    role: "Field Officer",
    phone: "0799999999",
    email: "new.test.officer@tbms.com",
    password: "TestPassword123"
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/officers',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Response: ${responseBody}`);
    });
});

req.on('error', (error) => {
    console.error(`Error:`, error);
});

req.write(data);
req.end();
