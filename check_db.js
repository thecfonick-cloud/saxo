const fetch = globalThis.fetch || require('node-fetch');
const JSON_BLOB_URL = 'https://jsonblob.com/api/jsonBlob/019e44dd-cdd6-76e5-b720-cefcc458309e';

async function run() {
    const response = await fetch(JSON_BLOB_URL);
    const db = await response.json();
    console.log("DB KEYS:", Object.keys(db));
    if (db.users) console.log("USERS:", db.users.map(u => ({ id: u._id, email: u.email, buyingPower: u.buyingPower })));
    if (db.depositProofs) console.log("DEPOSITS:", db.depositProofs.map(d => ({ id: d._id, userId: d.userId, amount: d.amount, status: d.status })));
    if (db.transactions) console.log("TRANSACTIONS:", db.transactions.map(t => ({ id: t._id, userId: t.userId, amountUSD: t.amountUSD, type: t.type, status: t.status })));
}

run().catch(console.error);
