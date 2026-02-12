const http = require('http');
const fs = require('fs');

const LOGIN_PAYLOAD = JSON.stringify({
    email: 'andrewsigei684@gmail.com',
    password: 'Teddymark1'
});

const options = {
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': LOGIN_PAYLOAD.length
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log("Login Successful!");
            const json = JSON.parse(data);
            fs.writeFileSync('admin_token.json', JSON.stringify(json, null, 2));
            console.log("Token saved to admin_token.json");
        } else {
            console.error(`Login Failed: ${res.statusCode}`);
            console.error(data);
        }
    });
});

req.on('error', e => console.error("Request Error:", e));
req.write(LOGIN_PAYLOAD);
req.end();
