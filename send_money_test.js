// Use native fetch (available in Node >=18)
const BASE = 'http://localhost:5000/api';
const pass = 'Pass123!';
(async () => {
  try {
    // Register sender
    const senderEmail = 'sender' + Date.now() + '@example.com';
    let res = await fetch(`${BASE}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: 'Sender User', email: senderEmail, password: pass }) });
    let data = await res.json();
    const senderToken = data.token;
    console.log('Sender registered, status', res.status);
    // Register recipient
    const recipientEmail = 'recipient' + Date.now() + '@example.com';
    res = await fetch(`${BASE}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: 'Recipient User', email: recipientEmail, password: pass }) });
    data = await res.json();
    const recipientToken = data.token;
    console.log('Recipient registered, status', res.status);
    // Deposit for sender
    res = await fetch(`${BASE}/user/deposit-proof`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${senderToken}` }, body: JSON.stringify({ amount: 2000, method: 'bank_transfer', referenceId: 'DEP' + Date.now() }) });
    data = await res.json();
    console.log('Deposit request status', res.status);
    // Admin login
    res = await fetch(`${BASE}/auth/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@virexonleaf.com', password: 'virexonleafinvestment' }) });
    const adminData = await res.json();
    const adminToken = adminData.token;
    // Admin verify deposit
    let pendingRes = await fetch(`${BASE}/admin/deposits?status=pending&limit=100`, { headers: { 'Authorization': `Bearer ${adminToken}` } });
    const pending = await pendingRes.json();
    const pendingDep = pending.deposits.find(d => d.userId && (d.userId._id === data.user?.id || d.userId === data.user?.id || d.userId === data.user?.email));
    if (pendingDep) {
      await fetch(`${BASE}/admin/deposits/${pendingDep._id}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ adminNotes: 'test verify' }) });
      console.log('Deposit verified');
    } else {
      console.log('No pending deposit found');
    }
    // Send money from sender to recipient
    res = await fetch(`${BASE}/user/send-money`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${senderToken}` }, body: JSON.stringify({ recipientEmail, amount: 500, note: 'test transfer' }) });
    const sendData = await res.json();
    console.log('Send money status', res.status, sendData);
    // Check balances
    const meRes = await fetch(`${BASE}/auth/me`, { headers: { 'Authorization': `Bearer ${senderToken}` } });
    const me = await meRes.json();
    console.log('Sender balance after', me.buyingPower);
    const recMeRes = await fetch(`${BASE}/auth/me`, { headers: { 'Authorization': `Bearer ${recipientToken}` } });
    const recMe = await recMeRes.json();
    console.log('Recipient balance after', recMe.buyingPower);
  } catch (e) { console.error('Error in script', e); }
})();
