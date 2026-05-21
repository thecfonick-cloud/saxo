const fetch = globalThis.fetch || require('node-fetch');
const JSON_BLOB_URL = 'https://jsonblob.com/api/jsonBlob/019e44dd-cdd6-76e5-b720-cefcc458309e';

const cleanDb = {
    users: [{
        _id: '507f1f0873e7900000000001',
        fullName: 'SaxoLeaf Admin',
        email: 'admin@saxoleaf.com',
        password: 'hashed_password',
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

async function reset() {
    console.log('Resetting database...');
    await fetch(JSON_BLOB_URL, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(cleanDb)
    });
    console.log('Database reset complete.');
}

reset().catch(console.error);
