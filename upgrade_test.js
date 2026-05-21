// upgrade_test.js
const BASE = 'http://localhost:5000/api';
const pass = 'Pass123!';
(async () => {
  try {
    // register user
    const email = 'upgrader' + Date.now() + '@example.com';
    let res = await fetch(`${BASE}/auth/register`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fullName:'Upgrade User',email,password:pass})});
    let data = await res.json();
    const token = data.token;
    console.log('Register',res.status);
    // admin login
    res = await fetch(`${BASE}/auth/admin/login`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@virexoncapital.com',password:'virexoncapitalinvestment'})});
    const adminData = await res.json();
    const adminToken = adminData.token;
    // request upgrade from Standard to Pro (cost 49)
    // first need to add buying power
    // simulate adding buying power via deposit
    await fetch(`${BASE}/user/deposit-proof`, {method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({amount:100,method:'bank_transfer',referenceId:'UPDEP'+Date.now()})});
    // admin verify deposit
    let pending = await fetch(`${BASE}/admin/deposits?status=pending&limit=100`, {headers:{'Authorization':`Bearer ${adminToken}`} });
    let pendingData = await pending.json();
    const dep = pendingData.deposits.find(d=>d.userId && (d.userId._id===data.user.id||d.userId===data.user.id));
    if(dep){await fetch(`${BASE}/admin/deposits/${dep._id}/verify`, {method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${adminToken}`},body:JSON.stringify({adminNotes:'verify upgrade fund'})});}
    // request upgrade
    res = await fetch(`${BASE}/user/upgrade-request`, {method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({requestedTier:'Pro',currentTier:'Standard',reason:'test upgrade'})});
    data = await res.json();
    console.log('Upgrade request',res.status,data);
    // admin fetch upgrade requests
    let upRes = await fetch(`${BASE}/admin/upgrade-requests`, {headers:{'Authorization':`Bearer ${adminToken}`} });
    let upData = await upRes.json();
    const upReq = upData.requests.find(r=>r.userId===data.user?.id||r.userId===data.user?._id);
    if(upReq){
        await fetch(`${BASE}/admin/upgrade-requests/${upReq._id}/approve`, {method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${adminToken}`},body:JSON.stringify({notes:'approved'})});
        console.log('Upgrade approved');
    }
    // check user tier
    res = await fetch(`${BASE}/auth/me`, {headers:{'Authorization':`Bearer ${token}`} });
    data = await res.json();
    console.log('User tier after upgrade', data.memberTier);
  } catch(e){console.error(e);}
})();
