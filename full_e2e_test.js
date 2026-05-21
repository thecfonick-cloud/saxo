const BASE_URL = 'http://localhost:5000/api';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
    console.log('=== FULL END-TO-END TEST ===\n');
    const userEmail = 'fulltest' + Date.now() + '@example.com';
    const userPass = 'Pass123!';
    let userToken, adminToken, userId;

    console.log('1. Register User...');
    let res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Full Test User', email: userEmail, password: userPass })
    });
    let data = await res.json();
    console.log(`Status: ${res.status}`);
    userToken = data.token;
    userId = data.user.id;

    if (!userToken) { console.error('Failed to get token'); return; }

    console.log('\n2. Admin Login...');
    res = await fetch(`${BASE_URL}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@saxoleaf.com', password: 'saxoleafinvestment' })
    });
    data = await res.json();
    console.log(`Status: ${res.status}`);
    adminToken = data.token;

    console.log('\n3. Submit Deposit...');
    res = await fetch(`${BASE_URL}/user/deposit-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ amount: 10000, method: 'bank_transfer', referenceId: 'DEP-' + Date.now() })
    });
    data = await res.json();
    console.log(`Status: ${res.status}`);
    let depositId = data.depositRequest?.id || data.depositProof?._id || data.deposit?._id || data.transaction?._id;
    // Wait for mock db processing
    await sleep(1000);

    console.log('\n4. Admin Fetch Pending Deposits...');
    res = await fetch(`${BASE_URL}/admin/deposits?status=pending&limit=100`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    data = await res.json();
    console.log(`Status: ${res.status}, Deposits found: ${data.deposits?.length}`);
    const pendingDeposit = data.deposits?.find(d => d.userId?._id === userId || d.userId === userId || d.user === userId || d.userId?.email === userEmail);
    if (!pendingDeposit) { console.error('Deposit not found in pending list'); return; }

    console.log('\n5. Admin Verify Deposit...');
    res = await fetch(`${BASE_URL}/admin/deposits/${pendingDeposit._id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ adminNotes: 'E2E Approved' })
    });
    data = await res.json();
    console.log(`Status: ${res.status}`);
    await sleep(1000);

    console.log('\n6. Verify User Balance (Should be 10000)...');
    res = await fetch(`${BASE_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${userToken}` } });
    data = await res.json();
    console.log(`Status: ${res.status}, Balance: ${data.buyingPower}`);
    if (data.buyingPower !== 10000) { console.error('BALANCE FAILED'); return; }

    console.log('\n7. Open a Trade (Buy 1 BTC at $500, using $500 buying power)...');
    res = await fetch(`${BASE_URL}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ symbol: 'BTC', assetName: 'Bitcoin', type: 'buy', amountUSD: 500 })
    });
    data = await res.json();
    console.log(`Status: ${res.status}, Message: ${data.message || data.error || JSON.stringify(data)}`);
    await sleep(1000);

    console.log('\n8. Verify User Balance After Trade (Should be 9500)...');
    res = await fetch(`${BASE_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${userToken}` } });
    data = await res.json();
    console.log(`Status: ${res.status}, Balance: ${data.buyingPower}`);

    console.log('\n9. Request Withdrawal ($1000)...');
    res = await fetch(`${BASE_URL}/user/withdraw-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ amount: 1000, method: 'bank', methodName: 'Bank Transfer', withdrawalDetails: { accountName: 'Test', accountNumber: '123' } })
    });
    data = await res.json();
    console.log(`Status: ${res.status}, Message: ${data.message || data.error}`);
    await sleep(1000);
    
    // Admin approve withdrawal
    console.log('\n10. Admin Approve Withdrawal ($1000)...');
    res = await fetch(`${BASE_URL}/user/admin/withdrawal-requests`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    data = await res.json();
    const withdrawTx = data.withdrawals?.find(w => w.userId === userId || w.user === userId || w.userId?._id === userId);
    if (!withdrawTx) {
        console.error('Withdrawal not found in admin queue');
    } else {
        res = await fetch(`${BASE_URL}/user/admin/withdraw-request/${withdrawTx._id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
        });
        data = await res.json();
        console.log(`Status: ${res.status}, Message: ${data.message}`);
    }
    
    await sleep(1000);

    console.log('\n11. Verify Balance After Withdrawal Request (Should be 8500)...');
    res = await fetch(`${BASE_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${userToken}` } });
    data = await res.json();
    console.log(`Status: ${res.status}, Balance: ${data.buyingPower}`);

    console.log('\n=== END OF TEST ===');
}

test().catch(console.error);
