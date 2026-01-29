const http = require('http');

const loginData = JSON.stringify({
    email: 'andrewsigei6@gmail.com',
    password: 'Teddymark11$'
});

const options = {
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
};

const req = http.request(options, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const parsedData = JSON.parse(rawData);
            console.log('Token:', parsedData.token);

            // Now get officials
            const offReq = http.request({
                hostname: 'localhost',
                port: 5000,
                path: '/api/officials',
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + parsedData.token
                }
            }, (offRes) => {
                let offData = '';
                offRes.on('data', (c) => offData += c);
                offRes.on('end', () => {
                    console.log('Officials:', offData);
                    process.exit(0);
                });
            });
            offReq.end();

        } catch (e) {
            console.error(rawData);
            process.exit(1);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
    process.exit(1);
});

req.write(loginData);
req.end();
