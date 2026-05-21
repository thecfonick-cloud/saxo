// Live E2E Test Script for VIREXONCAPITAL on Netlify
const BASE = 'https://virexoncapital-v2.netlify.app/api';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function test() {
    const results = [];
    let userToken = null;
    let adminToken = null;
    let depositId = null;

    function log(step, status, detail) {
        const icon = status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} [${step}] ${detail}`);
        results.push({ step, status, detail });
    }

    // 1. Register a new user
    try {
        const res = await fetch(`${BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: 'Live E2E User',
                email: `live_e2e_${Date.now()}@test.com`,
                password: 'password123'
            })
        });
        const data = await res.json();
        if (res.status === 201 && data.token) {
            userToken = data.token;
            log('Register (Live)', 'PASS', `User registered on Netlify!`);
        } else {
            log('Register (Live)', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log('Register (Live)', 'FAIL', e.message);
    }

    if (!userToken) {
        console.log('\n🛑 Cannot continue without user token');
        return;
    }

    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
    };

    // 2. Get user profile
    try {
        const res = await fetch(`${BASE}/user/profile`, { headers: authHeaders });
        const data = await res.json();
        if (res.ok && data.fullName) {
            log('Profile (Live)', 'PASS', `Name: ${data.fullName}, Buying Power: $${data.buyingPower}`);
        } else {
            log('Profile (Live)', 'FAIL', JSON.stringify(data));
        }
    } catch (e) {
        log('Profile (Live)', 'FAIL', e.message);
    }

    // 3. Submit deposit proof
    try {
        const formData = new FormData();
        formData.append('amount', '8500');
        formData.append('method', 'Crypto');
        formData.append('referenceId', 'DEP-LIVE-' + Date.now());
        formData.append('transactionId', 'TXN-LIVE-123');
        formData.append('notes', 'Live E2E test deposit');

        const res = await fetch(`${BASE}/user/deposit-proof`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}` },
            body: formData
        });
        const data = await res.json();
        if (res.ok || res.status === 201) {
            depositId = data.depositRequest?.id || data.deposit?._id || data.depositId;
            log('Deposit Proof (Live)', 'PASS', `Deposit submitted. ID: ${depositId}`);
        } else {
            log('Deposit Proof (Live)', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log('Deposit Proof (Live)', 'FAIL', e.message);
    }

    // Wait 3 seconds for mock JsonBlob DB write and CDN propagation
    console.log("⏳ Waiting 3 seconds for write propagation to JsonBlob...");
    await delay(3000);

    // 4. Admin login
    try {
        const res = await fetch(`${BASE}/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@virexoncapital.com', password: 'virexoncapitalinvestment' })
        });
        const data = await res.json();
        if (res.ok && data.token) {
            adminToken = data.token;
            log('Admin Login (Live)', 'PASS', `Admin authenticated on Netlify`);
        } else {
            log('Admin Login (Live)', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log('Admin Login (Live)', 'FAIL', e.message);
    }

    if (!adminToken) {
        console.log('\n🛑 Cannot continue admin tests without admin token');
        return;
    }

    const adminHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
    };

    // 5. Admin: Verify deposit
    if (depositId) {
        try {
            const res = await fetch(`${BASE}/admin/deposits/${depositId}/verify`, {
                method: 'POST',
                headers: adminHeaders,
                body: JSON.stringify({ adminNotes: 'Verified via Live E2E test' })
            });
            const data = await res.json();
            if (res.ok) {
                log('Admin Verify Deposit (Live)', 'PASS', `Deposit verified!`);
            } else {
                log('Admin Verify Deposit (Live)', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
            }
        } catch (e) {
            log('Admin Verify Deposit (Live)', 'FAIL', e.message);
        }

        // Wait 3 seconds for mock JsonBlob DB write and CDN propagation
        console.log("⏳ Waiting 3 seconds for write propagation to JsonBlob...");
        await delay(3000);

        // 6. Verify user balance increased after deposit approval
        try {
            const res = await fetch(`${BASE}/user/profile`, { headers: authHeaders });
            const data = await res.json();
            if (res.ok && data.buyingPower === 8500) {
                log('Balance After Deposit (Live)', 'PASS', `Buying Power is exactly $${data.buyingPower}`);
            } else {
                log('Balance After Deposit (Live)', 'FAIL', `Expected $8500, got: ${JSON.stringify(data)}`);
            }
        } catch (e) {
            log('Balance After Deposit (Live)', 'FAIL', e.message);
        }
    }

    // 7. Max deposit guard test
    try {
        const formData = new FormData();
        formData.append('amount', '150000');
        formData.append('method', 'Crypto');
        formData.append('referenceId', 'DEP-OVERLIMIT-' + Date.now());
        
        const res = await fetch(`${BASE}/user/deposit-proof`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok && data.message === 'Deposit amount exceeds the maximum limit of $100,000') {
            log('Max Deposit Guard (Live)', 'PASS', `Correctly blocked $150k deposit on live Netlify environment`);
        } else {
            log('Max Deposit Guard (Live)', 'FAIL', `Expected limit error, got ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log('Max Deposit Guard (Live)', 'FAIL', e.message);
    }

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('  LIVE NETLIFY E2E TEST SUMMARY');
    console.log('════════════════════════════════════════════════════════════');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`  Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('════════════════════════════════════════════════════════════\n');
}

test().catch(e => console.error('Fatal error:', e));
