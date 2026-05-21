const fetch = globalThis.fetch || require('node-fetch');
const JSON_BLOB_URL = 'https://jsonblob.com/api/jsonBlob/019e4a48-c718-7873-aae0-2c44b822fb8b';

const cleanDb = {
    users: [{
        _id: '507f1f0873e7900000000001',
        fullName: 'VirexonLeaf Admin',
        email: 'admin@virexonleaf.com',
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
