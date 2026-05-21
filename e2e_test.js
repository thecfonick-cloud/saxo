// End-to-end test: Register user -> Login -> Submit deposit -> Admin login -> Verify deposit -> Check balance
const BASE_URL = 'http://localhost:5000/api';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
    console.log('=== STEP 1: Register a test user ===');
    let res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Test Depositor', email: 'testdeposit@example.com', password: 'TestPass123' })
    });
    let data = await res.json();
    console.log('Register:', res.status, JSON.stringify(data, null, 2));
    
    let userToken = data.token;
    if (!userToken) {
        // User may already exist, try login
        console.log('--- Trying login instead ---');
        res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'testdeposit@example.com', password: 'TestPass123' })
        });
        data = await res.json();
        console.log('Login:', res.status, JSON.stringify(data, null, 2));
        userToken = data.token;
    }
    
    if (!userToken) {
        console.error('FAILED: No user token obtained');
        return;
    }

    await sleep(1000);
    
    console.log('\n=== STEP 2: Check user balance BEFORE deposit ===');
    res = await fetch(`${BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
    });
    data = await res.json();
    console.log('User before:', res.status, JSON.stringify(data, null, 2));
    const balanceBefore = data.buyingPower;
    
    await sleep(1000);
    
    console.log('\n=== STEP 3: Submit deposit proof (no image, just amount) ===');
    // Using method instead of paymentMethod
    res = await fetch(`${BASE_URL}/user/deposit-proof`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}` 
        },
        body: JSON.stringify({ 
            amount: 5000, 
            method: 'bank_transfer',
            referenceId: 'TEST-REF-' + Date.now()
        })
    });
    data = await res.json();
    console.log('Deposit proof:', res.status, JSON.stringify(data, null, 2));
    const depositId = data.depositRequest?.id || data.depositProof?._id || data.deposit?._id;
    
    if (!depositId) {
        console.error('FAILED: No deposit ID returned. Cannot proceed to admin verification.');
        return;
    }
    
    await sleep(2000);
    
    console.log('\n=== STEP 4: Admin login ===');
    res = await fetch(`${BASE_URL}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@virexoncapital.com', password: 'virexoncapitalinvestment' })
    });
    data = await res.json();
    console.log('Admin login:', res.status, JSON.stringify(data, null, 2));
    const adminToken = data.token;
    
    if (!adminToken) {
        console.error('FAILED: No admin token');
        return;
    }
    
    await sleep(2000);
    
    console.log('\n=== STEP 5: Fetch pending deposits ===');
    res = await fetch(`${BASE_URL}/admin/deposits?status=pending&limit=100`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    data = await res.json();
    console.log('Pending deposits:', res.status, JSON.stringify(data, null, 2));
    
    const pendingDeposit = data.deposits?.find(d => d._id === depositId);
    if (!pendingDeposit) {
        console.error('FAILED: Created deposit not found in pending deposits list');
        return;
    }
    
    console.log('Found pending deposit ID:', pendingDeposit._id, 'amount:', pendingDeposit.amount);
    console.log('User info on deposit:', pendingDeposit.userId?.fullName || 'N/A', pendingDeposit.userId?.email || 'N/A');
    
    await sleep(2000);
    
    console.log('\n=== STEP 6: Verify/Credit the deposit ===');
    res = await fetch(`${BASE_URL}/admin/deposits/${pendingDeposit._id}/verify`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}` 
        },
        body: JSON.stringify({ adminNotes: 'Test verification' })
    });
    data = await res.json();
    console.log('Verify result:', res.status, JSON.stringify(data, null, 2));
    
    await sleep(2000);
    
    console.log('\n=== STEP 7: Check user balance AFTER verification ===');
    res = await fetch(`${BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
    });
    data = await res.json();
    console.log('User after:', res.status, JSON.stringify(data, null, 2));
    const balanceAfter = data.buyingPower;
    
    console.log('\n=== RESULTS ===');
    console.log('Balance before:', balanceBefore);
    console.log('Balance after:', balanceAfter);
    console.log('Difference:', balanceAfter - balanceBefore);
    console.log('Expected difference: 5000');
    console.log(balanceAfter - balanceBefore === 5000 ? '✅ SUCCESS!' : '❌ BALANCE MISMATCH!');
    
    console.log('\n=== STEP 8: Check deposit stats ===');
    res = await fetch(`${BASE_URL}/admin/deposits/stats`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    data = await res.json();
    console.log('Stats:', res.status, JSON.stringify(data, null, 2));
}

test().catch(e => console.error('Test failed:', e));
