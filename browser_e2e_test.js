// ============================================================
// FULL END-TO-END TEST - Simulates everything a user does in the browser
// ============================================================
const BASE = 'http://localhost:5000/api';

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

function pass(msg) { console.log(`${COLORS.green}✅ PASS${COLORS.reset} ${msg}`); }
function fail(msg) { console.log(`${COLORS.red}❌ FAIL${COLORS.reset} ${msg}`); }
function info(msg) { console.log(`${COLORS.cyan}ℹ️  ${msg}${COLORS.reset}`); }
function header(msg) { console.log(`\n${COLORS.bold}${COLORS.yellow}══════════════════════════════════════${COLORS.reset}`); console.log(`${COLORS.bold}${COLORS.yellow}  ${msg}${COLORS.reset}`); console.log(`${COLORS.bold}${COLORS.yellow}══════════════════════════════════════${COLORS.reset}`); }

let passed = 0, failed = 0;
function assert(condition, msg) {
  if (condition) { pass(msg); passed++; } 
  else { fail(msg); failed++; }
}

(async () => {
  const ts = Date.now();
  const userEmail = `testuser_${ts}@example.com`;
  const user2Email = `testuser2_${ts}@example.com`;
  const password = 'TestPass123!';
  let userToken, user2Token, adminToken, userId, user2Id;

  try {
    // ============================================================
    // TEST 1: USER REGISTRATION
    // ============================================================
    header('TEST 1: USER REGISTRATION');
    
    let res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Test User One', email: userEmail, password })
    });
    let data = await res.json();
    assert(res.status === 201, `Register User 1 → Status ${res.status}`);
    assert(data.token, `User 1 received JWT token`);
    userToken = data.token;
    userId = data.user?.id || data.user?._id;
    info(`User 1 ID: ${userId}`);
    info(`User 1 Email: ${userEmail}`);

    // Register second user for money transfer test
    res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Test User Two', email: user2Email, password })
    });
    data = await res.json();
    assert(res.status === 201, `Register User 2 → Status ${res.status}`);
    user2Token = data.token;
    user2Id = data.user?.id || data.user?._id;
    info(`User 2 ID: ${user2Id}`);

    // ============================================================
    // TEST 2: INVALID EMAIL VALIDATION
    // ============================================================
    header('TEST 2: INPUT VALIDATION');
    
    res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Bad Email', email: 'not-an-email', password })
    });
    assert(res.status >= 400, `Invalid email rejected → Status ${res.status}`);

    // ============================================================
    // TEST 3: ADMIN LOGIN
    // ============================================================
    header('TEST 3: ADMIN LOGIN');
    
    res = await fetch(`${BASE}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@virexonleaf.com', password: 'virexonleafinvestment' })
    });
    data = await res.json();
    assert(res.status === 200, `Admin login → Status ${res.status}`);
    assert(data.token, `Admin received JWT token`);
    adminToken = data.token;

    // ============================================================
    // TEST 4: USER PROFILE / DASHBOARD
    // ============================================================
    header('TEST 4: USER DASHBOARD (GET /auth/me)');
    
    res = await fetch(`${BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    data = await res.json();
    assert(res.status === 200, `Fetch profile → Status ${res.status}`);
    assert(data.buyingPower === 0, `Initial buying power is $0 (got: $${data.buyingPower})`);
    assert(data.memberTier === 'Standard', `Initial tier is Standard (got: ${data.memberTier})`);
    info(`Dashboard: buyingPower=$${data.buyingPower}, portfolio=$${data.totalPortfolioValue}, tier=${data.memberTier}`);

    // ============================================================
    // TEST 5: DEPOSIT PROOF SUBMISSION
    // ============================================================
    header('TEST 5: DEPOSIT PROOF SUBMISSION');
    
    const depositRef = 'DEP' + ts;
    res = await fetch(`${BASE}/user/deposit-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
      body: JSON.stringify({ amount: 5000, method: 'bank_transfer', referenceId: depositRef })
    });
    data = await res.json();
    assert(res.status === 200 || res.status === 201, `Deposit proof submitted → Status ${res.status}`);
    info(`Deposit reference: ${depositRef}`);

    // ============================================================
    // TEST 6: ADMIN VERIFIES DEPOSIT
    // ============================================================
    header('TEST 6: ADMIN VERIFIES DEPOSIT');
    
    res = await fetch(`${BASE}/admin/deposits?status=pending&limit=100`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    data = await res.json();
    assert(res.status === 200, `Fetch pending deposits → Status ${res.status}`);
    
    const deposit = data.deposits?.find(d => {
      const dUserId = d.userId?._id || d.userId;
      return dUserId === userId;
    });
    assert(!!deposit, `Found our deposit in pending list (ID: ${deposit?._id})`);

    if (deposit) {
      res = await fetch(`${BASE}/admin/deposits/${deposit._id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ adminNotes: 'E2E test verification' })
      });
      data = await res.json();
      assert(res.status === 200, `Admin verified deposit → Status ${res.status}`);
      info(`New balance after deposit: $${data.deposit?.newBalance}`);
    }

    // ============================================================
    // TEST 7: CHECK BALANCE AFTER DEPOSIT
    // ============================================================
    header('TEST 7: BALANCE CHECK AFTER DEPOSIT');
    
    res = await fetch(`${BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    data = await res.json();
    assert(data.buyingPower === 5000, `Buying power is $5000 after deposit (got: $${data.buyingPower})`);
    assert(data.totalPortfolioValue === 5000, `Portfolio value is $5000 (got: $${data.totalPortfolioValue})`);

    // ============================================================
    // TEST 8: SEND MONEY TO USER 2
    // ============================================================
    header('TEST 8: SEND MONEY (User 1 → User 2)');
    
    res = await fetch(`${BASE}/user/send-money`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
      body: JSON.stringify({ recipientEmail: user2Email, amount: 1500, note: 'E2E test transfer' })
    });
    data = await res.json();
    assert(res.status === 200, `Send $1500 to User 2 → Status ${res.status}`);
    assert(data.newBalance === 3500, `Sender balance after transfer: $3500 (got: $${data.newBalance})`);
    info(`Transfer message: ${data.message}`);

    // ============================================================
    // TEST 9: VERIFY RECIPIENT RECEIVED MONEY
    // ============================================================
    header('TEST 9: VERIFY RECIPIENT BALANCE');
    
    res = await fetch(`${BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    data = await res.json();
    assert(data.buyingPower === 1500, `User 2 buying power is $1500 (got: $${data.buyingPower})`);
    assert(data.totalPortfolioValue === 1500, `User 2 portfolio is $1500 (got: $${data.totalPortfolioValue})`);

    // ============================================================
    // TEST 10: SEND MONEY - INSUFFICIENT FUNDS
    // ============================================================
    header('TEST 10: SEND MONEY - INSUFFICIENT FUNDS');
    
    res = await fetch(`${BASE}/user/send-money`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
      body: JSON.stringify({ recipientEmail: user2Email, amount: 99999, note: 'should fail' })
    });
    assert(res.status === 400, `Insufficient funds rejected → Status ${res.status}`);

    // ============================================================
    // TEST 11: UPGRADE REQUEST (Standard → Pro)
    // ============================================================
    header('TEST 11: UPGRADE REQUEST (Standard → Pro)');
    
    res = await fetch(`${BASE}/user/upgrade-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
      body: JSON.stringify({ requestedTier: 'Pro', currentTier: 'Standard', reason: 'E2E test upgrade' })
    });
    data = await res.json();
    assert(res.status === 200, `Upgrade request submitted → Status ${res.status}`);
    assert(data.upgradeCost > 0, `Upgrade cost is $${data.upgradeCost}`);
    const upgradeRequestId = data.requestId;
    info(`Upgrade request ID: ${upgradeRequestId}`);

    // ============================================================
    // TEST 12: ADMIN APPROVES UPGRADE
    // ============================================================
    header('TEST 12: ADMIN APPROVES UPGRADE');
    
    // Fetch pending upgrade requests
    res = await fetch(`${BASE}/admin/upgrade-requests`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    data = await res.json();
    assert(res.status === 200, `Fetch upgrade requests → Status ${res.status}`);
    
    const upgradeReqs = data.requests || [];
    const ourUpgrade = upgradeReqs.find(r => {
      const rUserId = r.userId?._id || r.userId;
      return rUserId === userId;
    });
    
    if (ourUpgrade) {
      res = await fetch(`${BASE}/admin/upgrade-requests/${ourUpgrade._id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ notes: 'E2E approved' })
      });
      data = await res.json();
      assert(res.status === 200, `Admin approved upgrade → Status ${res.status}`);
      info(`Upgrade result: ${data.message}`);
    } else {
      fail('Could not find upgrade request in admin list');
      failed++;
    }

    // ============================================================
    // TEST 13: VERIFY TIER & BALANCE AFTER UPGRADE
    // ============================================================
    header('TEST 13: VERIFY TIER & BALANCE AFTER UPGRADE');
    
    res = await fetch(`${BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    data = await res.json();
    assert(data.memberTier === 'Pro', `User tier is now Pro (got: ${data.memberTier})`);
    // Balance should be 3500 - 49 (upgrade cost) = 3451
    const expectedBalance = 3500 - 49;
    assert(data.buyingPower === expectedBalance, `Balance after upgrade: $${expectedBalance} (got: $${data.buyingPower})`);
    info(`Final state: tier=${data.memberTier}, buyingPower=$${data.buyingPower}, portfolio=$${data.totalPortfolioValue}`);

    // ============================================================
    // TEST 14: TRANSACTION HISTORY
    // ============================================================
    header('TEST 14: TRANSACTION HISTORY');
    
    res = await fetch(`${BASE}/user/transactions`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    data = await res.json();
    assert(res.status === 200, `Fetch transactions → Status ${res.status}`);
    const txns = data.transactions || data || [];
    assert(txns.length >= 2, `User has ${txns.length} transactions (expected ≥ 2)`);
    info(`Transactions: ${txns.map(t => `${t.type}:$${t.amountUSD}`).join(', ')}`);

    // ============================================================
    // TEST 15: NON-ADMIN CANNOT ACCESS ADMIN ROUTES (RBAC)
    // ============================================================
    header('TEST 15: RBAC - NON-ADMIN BLOCKED FROM ADMIN ROUTES');
    
    res = await fetch(`${BASE}/admin/deposits?status=pending`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    assert(res.status === 403, `Regular user blocked from admin deposits → Status ${res.status}`);

    res = await fetch(`${BASE}/admin/upgrade-requests`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    assert(res.status === 403, `Regular user blocked from admin upgrades → Status ${res.status}`);

    // ============================================================
    // RESULTS SUMMARY
    // ============================================================
    header('FINAL RESULTS');
    console.log(`\n${COLORS.bold}Total: ${passed + failed} tests${COLORS.reset}`);
    console.log(`${COLORS.green}Passed: ${passed}${COLORS.reset}`);
    console.log(`${COLORS.red}Failed: ${failed}${COLORS.reset}`);
    
    if (failed === 0) {
      console.log(`\n${COLORS.bold}${COLORS.green}🎉🎉🎉 ALL TESTS PASSED! SYSTEM IS READY FOR DEPLOYMENT! 🎉🎉🎉${COLORS.reset}\n`);
    } else {
      console.log(`\n${COLORS.bold}${COLORS.red}⚠️ ${failed} test(s) failed. Review above for details.${COLORS.reset}\n`);
    }

  } catch (err) {
    console.error(`\n${COLORS.red}FATAL ERROR:${COLORS.reset}`, err);
  }
})();
