const https = require('https');

const initialDb = {
    users: [{
        _id: '507f1f0873e7900000000001',
        fullName: 'VirexonCapital Admin',
        email: 'admin@virexoncapital.com',
        password: 'adminpassword123',
        buyingPower: 50000,
        totalPortfolioValue: 50000,
        memberTier: 'Elite',
        isAdmin: true
    }],
    holdings: [],
    transactions: [],
    watchlist: [],
    upgradeRequests: [],
    depositProofs: [],
    properties: [],
    rentalIncome: []
};

const data = JSON.stringify(initialDb);

const options = {
    hostname: 'jsonblob.com',
    port: 443,
    path: '/api/jsonBlob',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Location Header:', res.headers.location);
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Response Body:', body);
    });
});

req.on('error', (e) => {
    console.error(e);
});

req.write(data);
req.end();
