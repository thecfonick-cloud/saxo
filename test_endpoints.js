const http = require('http');

async function request(method, path, data, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: `/api${path}`,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

(async () => {
    try {
        console.log('Registering user...');
        const regRes = await request('POST', '/auth/register', {
            fullName: "Real Estate Test User",
            email: `re_test_${Date.now()}@example.com`,
            password: "password123"
        });
        if (regRes.status !== 201) {
            console.error('Registration failed:', regRes.data);
            process.exit(1);
        }
        const token = regRes.data.token;
        console.log('User registered, token received.');

        const endpoints = [
            { method: 'GET', path: '/portfolio/summary' },
            { method: 'GET', path: '/properties' },
            { method: 'GET', path: '/rental/history' },
            { method: 'GET', path: '/transactions/recent' },
            { method: 'GET', path: '/properties/marketplace' }
        ];

        for (const ep of endpoints) {
            console.log(`Calling ${ep.method} ${ep.path}...`);
            const res = await request(ep.method, ep.path, null, token);
            console.log(`Response status: ${res.status}`);
            if (res.status !== 200 && res.status !== 201) {
                console.error(`Error on ${ep.path}:`, res.data);
            } else {
                console.log(`Success on ${ep.path}. Data size/keys:`, Object.keys(res.data));
            }
        }

    } catch (err) {
        console.error('Test execution failed:', err);
    }
})();
