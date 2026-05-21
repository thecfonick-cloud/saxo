// Live verification test for LEAF balance sync
const BASE = 'https://saxoinvestment-v2.netlify.app/api';

async function verify() {
    console.log('=== LEAF Balance Sync — Live Verification ===\n');

    // Step 1: Login
    console.log('1. Logging in as test user...');
    let res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'testdeposit@example.com', password: 'TestPass123' })
    });
    let data = await res.json();
    if (!data.token) {
        // Register if needed
        console.log('   Registering test user...');
        res = await fetch(`${BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName: 'Test User', email: 'testdeposit@example.com', password: 'TestPass123' })
        });
        data = await res.json();
    }
    const token = data.token;
    console.log(`   Token: ${token ? '✅ obtained' : '❌ FAILED'}`);
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Step 2: Check /api/auth/me — what LEAF polls every 5s
    console.log('\n2. GET /api/auth/me (what LEAF getMe() calls every 5s)...');
    res = await fetch(`${BASE}/auth/me`, { headers });
    data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   buyingPower: ${data.buyingPower ?? '❌ MISSING'}`);
    console.log(`   fullName: ${data.fullName ?? '❌ MISSING'}`);
    console.log(`   memberTier: ${data.memberTier ?? '❌ MISSING'}`);
    const authMeHasBuyingPower = typeof data.buyingPower === 'number';

    // Step 3: Check /api/user/profile — what the new sync script calls
    console.log('\n3. GET /api/user/profile (what new sync script calls)...');
    res = await fetch(`${BASE}/user/profile`, { headers });
    data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   buyingPower: ${data.buyingPower ?? '❌ MISSING'}`);
    const profileHasBuyingPower = typeof data.buyingPower === 'number';

    // Step 4: Check /api/portfolio/holdings — for positions sync
    console.log('\n4. GET /api/portfolio/holdings (for position count sync)...');
    res = await fetch(`${BASE}/portfolio/holdings`, { headers });
    const holdings = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Holdings count: ${Array.isArray(holdings) ? holdings.length : '❌ NOT ARRAY'}`);
    const holdingsOk = Array.isArray(holdings);

    // Step 5: Check /api/portfolio/summary
    console.log('\n5. GET /api/portfolio/summary...');
    res = await fetch(`${BASE}/portfolio/summary`, { headers });
    data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   totalValue: ${data.totalValue ?? '❌ MISSING'}`);
    console.log(`   buyingPower: ${data.buyingPower ?? '❌ MISSING'}`);

    // Step 6: Verify leaf/index.html has the sync script injected
    console.log('\n6. GET /leaf/index.html (checking sync script injection)...');
    res = await fetch('https://saxoinvestment-v2.netlify.app/leaf/index.html');
    const html = await res.text();
    const hasSyncScript = html.includes('window.__setBalance') && html.includes('window.__setPositions');
    const hasInterval = html.includes('SYNC_INTERVAL_MS');
    console.log(`   __setBalance global exposed: ${hasSyncScript ? '✅' : '❌'}`);
    console.log(`   SYNC_INTERVAL_MS defined: ${hasInterval ? '✅' : '❌'}`);

    // Final verdict
    console.log('\n=== FINAL VERDICT ===');
    const allPassed = authMeHasBuyingPower && profileHasBuyingPower && holdingsOk && hasSyncScript;
    console.log(`   /api/auth/me has buyingPower:     ${authMeHasBuyingPower ? '✅' : '❌'}`);
    console.log(`   /api/user/profile has buyingPower: ${profileHasBuyingPower ? '✅' : '❌'}`);
    console.log(`   /api/portfolio/holdings works:     ${holdingsOk ? '✅' : '❌'}`);
    console.log(`   LEAF sync script injected:         ${hasSyncScript ? '✅' : '❌'}`);
    console.log(`\n   ${allPassed ? '🟢 ALL CHECKS PASSED — LEAF balance auto-sync is LIVE' : '🔴 SOME CHECKS FAILED'}`);
}

verify().catch(e => console.error('Verification error:', e));
