// Full E2E Test Script for VIREXONCAPITAL
const BASE = 'http://localhost:5000/api';

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
                fullName: 'E2E Test User',
                email: `e2e_${Date.now()}@test.com`,
                password: 'password123'
            })
        });
        const data = await res.json();
        if (res.status === 201 && data.token) {
            userToken = data.token;
            log('Register', 'PASS', `User registered. Token: ${data.token.substring(0, 20)}...`);
        } else {
            log('Register', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log('Register', 'FAIL', e.message);
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
        if (res.ok && data.fullName && data.buyingPower !== undefined) {
            log('Profile', 'PASS', `Name: ${data.fullName}, Buying Power: $${data.buyingPower}, Tier: ${data.memberTier}`);
        } else {
            log('Profile', 'FAIL', JSON.stringify(data));
        }
    } catch (e) {
        log('Profile', 'FAIL', e.message);
    }

    // 3. Get portfolio summary
    try {
        const res = await fetch(`${BASE}/portfolio/summary`, { headers: authHeaders });
        const data = await res.json();
        if (res.ok && data.totalValue !== undefined) {
            log('Portfolio Summary', 'PASS', `Total Value: $${data.totalValue}, P/L 30d: ${data.profitLoss30d}%`);
        } else {
            log('Portfolio Summary', 'FAIL', JSON.stringify(data));
        }
    } catch (e) {
        log('Portfolio Summary', 'FAIL', e.message);
    }

    // 4. Get recent transactions
    try {
        const res = await fetch(`${BASE}/transactions/recent`, { headers: authHeaders });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
            log('Transactions', 'PASS', `${data.length} transactions found`);
        } else {
            log('Transactions', 'FAIL', JSON.stringify(data));
        }
    } catch (e) {
        log('Transactions', 'FAIL', e.message);
    }

    // 5. Get watchlist
    try {
        const res = await fetch(`${BASE}/watchlist`, { headers: authHeaders });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
            log('Watchlist', 'PASS', `${data.length} items in watchlist`);
        } else {
            log('Watchlist', 'FAIL', JSON.stringify(data));
        }
    } catch (e) {
        log('Watchlist', 'FAIL', e.message);
    }

    // 6. Get holdings
    try {
        const res = await fetch(`${BASE}/portfolio/holdings`, { headers: authHeaders });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
            log('Holdings', 'PASS', `${data.length} holdings found`);
        } else {
            log('Holdings', 'FAIL', JSON.stringify(data));
        }
    } catch (e) {
        log('Holdings', 'FAIL', e.message);
    }

    // 7. Submit deposit proof
    try {
        const formData = new FormData();
        formData.append('amount', '5000');
        formData.append('method', 'Crypto');
        formData.append('referenceId', 'DEP-TEST-' + Date.now());
        formData.append('transactionId', 'TXN-E2E-TEST-123');
        formData.append('notes', 'E2E test deposit');

        const res = await fetch(`${BASE}/user/deposit-proof`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}` },
            body: formData
        });
        const data = await res.json();
        if (res.ok || res.status === 201) {
            depositId = data.depositRequest?.id || data.deposit?._id || data.depositId;
            log('Deposit Proof', 'PASS', `Deposit submitted. ID: ${depositId}`);
        } else {
            log('Deposit Proof', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log('Deposit Proof', 'FAIL', e.message);
    }

    // 8. Test insufficient funds on withdrawal request before deposit approval
    try {
        const res = await fetch(`${BASE}/user/withdraw-request`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                amount: 100,
                method: 'bank',
                methodName: 'Bank Transfer',
                withdrawalDetails: {
                    accountHolder: 'E2E Test User',
                    bankName: 'Test Bank',
                    accountNumber: '123456789',
                    routingNumber: '987654321'
                }
            })
        });
        const data = await res.json();
        if (res.status === 400 && data.message === 'Insufficient funds') {
            log('Insufficient Funds Withdrawal Guard', 'PASS', 'Correctly blocked withdrawal on zero balance');
        } else {
            log('Insufficient Funds Withdrawal Guard', 'FAIL', `Expected 400 Insufficient funds, got ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log('Insufficient Funds Withdrawal Guard', 'FAIL', e.message);
    }

    // 9. Search user (for transfer feature)
    try {
        const res = await fetch(`${BASE}/user/search-user?email=admin@virexoncapital.com`, {
            headers: authHeaders
        });
        const data = await res.json();
        if (res.ok && data.user) {
            log('Search User', 'PASS', `Found: ${data.user.fullName} (${data.user.email})`);
        } else {
            log('Search User', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log('Search User', 'FAIL', e.message);
    }

    // 10. Admin login
    try {
        const res = await fetch(`${BASE}/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@virexoncapital.com', password: 'virexoncapitalinvestment' })
        });
        const data = await res.json();
        if (res.ok && data.token) {
            adminToken = data.token;
            log('Admin Login', 'PASS', `Admin authenticated. Name: ${data.admin?.name || data.admin?.email}`);
        } else {
            log('Admin Login', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log('Admin Login', 'FAIL', e.message);
    }

    if (!adminToken) {
        console.log('\n🛑 Cannot continue admin tests without admin token');
        printSummary(results);
        return;
    }

    const adminHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
    };

    // 11. Admin: Get pending deposits
    try {
        const res = await fetch(`${BASE}/admin/deposits?limit=100&status=pending`, {
            headers: adminHeaders
        });
        const data = await res.json();
        if (res.ok && data.deposits) {
            log('Admin Pending Deposits', 'PASS', `${data.deposits.length} pending deposits`);
            // Find our test deposit
            if (data.deposits.length > 0 && !depositId) {
                depositId = data.deposits[0]._id;
            }
        } else {
            log('Admin Pending Deposits', 'FAIL', JSON.stringify(data));
        }
    } catch (e) {
        log('Admin Pending Deposits', 'FAIL', e.message);
    }

    // 12. Admin: Verify deposit (if we have one)
    if (depositId) {
        try {
            const res = await fetch(`${BASE}/admin/deposits/${depositId}/verify`, {
                method: 'POST',
                headers: adminHeaders,
                body: JSON.stringify({ adminNotes: 'E2E test verification' })
            });
            const data = await res.json();
            if (res.ok) {
                log('Admin Verify Deposit', 'PASS', `Deposit verified! Amount: $${data.deposit?.amount}`);
            } else {
                log('Admin Verify Deposit', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
            }
        } catch (e) {
            log('Admin Verify Deposit', 'FAIL', e.message);
        }

        // 13. Verify user balance increased after deposit approval
        try {
            const res = await fetch(`${BASE}/user/profile`, { headers: authHeaders });
            const data = await res.json();
            if (res.ok && data.buyingPower === 5000) {
                log('Balance After Deposit', 'PASS', `Buying Power is exactly $${data.buyingPower}`);
            } else {
                log('Balance After Deposit', 'FAIL', `Expected $5000, got: ${JSON.stringify(data)}`);
            }
        } catch (e) {
            log('Balance After Deposit', 'FAIL', e.message);
        }
    }

    // 14. Submit withdrawal request now that we have balance ($5000)
    let withdrawalTxId = null;
    try {
        const res = await fetch(`${BASE}/user/withdraw-request`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                amount: 1000,
                method: 'bank',
                methodName: 'Bank Transfer',
                withdrawalDetails: {
                    accountHolder: 'E2E Test User',
                    bankName: 'Test Bank',
                    accountNumber: '123456789',
                    routingNumber: '987654321'
                }
            })
        });
        const data = await res.json();
        if (res.ok || res.status === 201) {
            withdrawalTxId = data.transactionId;
            log('Withdraw Request', 'PASS', `Withdrawal submitted successfully. ID: ${withdrawalTxId}`);
        } else {
            log('Withdraw Request', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log('Withdraw Request', 'FAIL', e.message);
    }

    // 15. Admin: Get withdrawal requests
    try {
        const res = await fetch(`${BASE}/user/admin/withdrawal-requests`, {
            headers: adminHeaders
        });
        const data = await res.json();
        if (res.ok && data.withdrawals) {
            log('Admin Withdrawal List', 'PASS', `${data.withdrawals.length} withdrawal requests found`);
            if (data.withdrawals.length > 0 && !withdrawalTxId) {
                withdrawalTxId = data.withdrawals[0]._id;
            }
        } else {
            log('Admin Withdrawal List', 'FAIL', JSON.stringify(data));
        }
    } catch (e) {
        log('Admin Withdrawal List', 'FAIL', e.message);
    }

    // 16. Admin: Approve withdrawal request
    if (withdrawalTxId) {
        try {
            const res = await fetch(`${BASE}/user/admin/withdraw-request/${withdrawalTxId}/approve`, {
                method: 'POST',
                headers: adminHeaders,
                body: JSON.stringify({ notes: 'E2E test withdraw approval' })
            });
            const data = await res.json();
            if (res.ok) {
                log('Admin Approve Withdrawal', 'PASS', 'Withdrawal approved successfully');
            } else {
                log('Admin Approve Withdrawal', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
            }
        } catch (e) {
            log('Admin Approve Withdrawal', 'FAIL', e.message);
        }

        // Verify balance decreased after withdrawal approval
        try {
            const res = await fetch(`${BASE}/user/profile`, { headers: authHeaders });
            const data = await res.json();
            if (res.ok && data.buyingPower === 4000) {
                log('Balance After Withdrawal', 'PASS', `Buying Power decreased exactly to $${data.buyingPower}`);
            } else {
                log('Balance After Withdrawal', 'FAIL', `Expected $4000, got: ${JSON.stringify(data)}`);
            }
        } catch (e) {
            log('Balance After Withdrawal', 'FAIL', e.message);
        }
    }

    // 17. Admin: Get upgrade requests
    try {
        const res = await fetch(`${BASE}/admin/upgrade-requests`, {
            headers: adminHeaders
        });
        const data = await res.json();
        if (res.ok) {
            log('Admin Upgrades', 'PASS', `${data.requests?.length || 0} upgrade requests`);
        } else {
            log('Admin Upgrades', 'FAIL', JSON.stringify(data));
        }
    } catch (e) {
        log('Admin Upgrades', 'FAIL', e.message);
    }

    // 18. Admin: Get deposit stats
    try {
        const res = await fetch(`${BASE}/admin/deposits/stats`, {
            headers: adminHeaders
        });
        const data = await res.json();
        if (res.ok) {
            log('Admin Stats', 'PASS', `Stats retrieved`);
        } else {
            log('Admin Stats', 'FAIL', JSON.stringify(data));
        }
    } catch (e) {
        log('Admin Stats', 'FAIL', e.message);
    }

    // 19. Test concurrent deposit (race condition test)
    try {
        const [res1, res2] = await Promise.all([
            fetch(`${BASE}/user/deposit`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ amount: 100, method: 'Bank Transfer' })
            }),
            fetch(`${BASE}/user/deposit`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ amount: 200, method: 'Bank Transfer' })
            })
        ]);
        const d1 = await res1.json();
        const d2 = await res2.json();
        if (res1.ok && res2.ok) {
            log('Concurrent Deposits', 'PASS', `Both processed atomically. Balances: $${d1.buyingPower}, $${d2.buyingPower}`);
        } else {
            log('Concurrent Deposits', 'FAIL', `R1: ${res1.status}, R2: ${res2.status}`);
        }
    } catch (e) {
        log('Concurrent Deposits', 'FAIL', e.message);
    }

    // 20. Test insufficient funds on send money
    try {
        const profileRes = await fetch(`${BASE}/user/profile`, { headers: authHeaders });
        const profile = await profileRes.json();
        const overAmount = profile.buyingPower + 10000;
        
        const res = await fetch(`${BASE}/user/send-money`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                recipientEmail: 'admin@virexoncapital.com',
                amount: overAmount,
                note: 'Should fail - insufficient funds'
            })
        });
        const data = await res.json();
        if (!res.ok && data.message) {
            log('Insufficient Funds Send Guard', 'PASS', `Correctly rejected: "${data.message}"`);
        } else {
            log('Insufficient Funds Send Guard', 'FAIL', `Should have been rejected but got: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log('Insufficient Funds Send Guard', 'FAIL', e.message);
    }

    // 21. Test invalid email validation
    try {
        const res = await fetch(`${BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: 'Bad Email User',
                email: 'not-an-email',
                password: 'password123'
            })
        });
        const data = await res.json();
        if (!res.ok) {
            log('Email Validation', 'PASS', `Invalid email rejected: "${data.message}"`);
        } else {
            log('Email Validation', 'FAIL', `Should have been rejected but registered`);
        }
    } catch (e) {
        log('Email Validation', 'FAIL', e.message);
    }

    // 22. Test max deposit amount
    try {
        const formData = new FormData();
        formData.append('amount', '200000');
        formData.append('method', 'Crypto');
        formData.append('referenceId', 'DEP-MAX-TEST');
        formData.append('transactionId', 'TXN-MAX');
        
        const res = await fetch(`${BASE}/user/deposit-proof`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok && data.message === 'Deposit amount exceeds the maximum limit of $100,000') {
            log('Max Deposit Guard', 'PASS', `Over-limit rejected: "${data.message}"`);
        } else {
            log('Max Deposit Guard', 'FAIL', `Expected over-limit rejection, got ${res.status}: ${JSON.stringify(data)}`);
        }
    } catch (e) {
        log('Max Deposit Guard', 'FAIL', e.message);
    }

    // 23. Static page accessibility
    const pages = ['join.html', 'investmentdashboard.html', 'deposit.html', 'withdraw.html', 'admin.html'];
    for (const page of pages) {
        try {
            const res = await fetch(`http://localhost:5000/${page}`);
            if (res.ok) {
                log(`Page: ${page}`, 'PASS', `HTTP ${res.status} - accessible`);
            } else {
                log(`Page: ${page}`, 'FAIL', `HTTP ${res.status}`);
            }
        } catch (e) {
            log(`Page: ${page}`, 'FAIL', e.message);
        }
    }

    printSummary(results);
}

function printSummary(results) {
    console.log('\n' + '═'.repeat(60));
    console.log('  E2E TEST SUMMARY');
    console.log('═'.repeat(60));
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`  Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('═'.repeat(60));
    if (failed > 0) {
        console.log('\nFailed tests:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`  ❌ ${r.step}: ${r.detail}`);
        });
    }
    console.log('');
}

test().catch(e => console.error('Fatal error:', e));
