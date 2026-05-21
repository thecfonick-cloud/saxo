const fs = require('fs');

(async () => {
  const BASE = 'http://localhost:5000/api';
  const ts = Date.now();
  const email = `temp_${ts}@example.com`;
  const password = 'TestPass123!';

  try {
    console.log('Registering user...');
    let res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Temp User', email, password })
    });
    let data = await res.json();
    if (res.status !== 201) {
      console.error('Registration failed:', data);
      return;
    }
    const token = data.token;
    console.log('User registered. Token:', token);

    // Create a dummy file to upload
    fs.writeFileSync('dummy_proof.jpg', 'dummy image content');

    // Create form data
    const formData = new FormData();
    formData.append('amount', '1000');
    formData.append('method', 'Crypto');
    formData.append('referenceId', 'DEP-TEST-' + ts);
    formData.append('transactionId', 'TXN-TEST-' + ts);
    formData.append('notes', 'notes here');

    // In node-fetch or native fetch in node 18+, we can pass a File object or blob.
    // Let's create a Blob from the file content
    const fileBlob = new Blob([fs.readFileSync('dummy_proof.jpg')], { type: 'image/jpeg' });
    formData.append('proofImage', fileBlob, 'dummy_proof.jpg');

    console.log('Submitting deposit proof with multipart file...');
    res = await fetch(`${BASE}/user/deposit-proof`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    data = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Data:', data);

    // Cleanup
    fs.unlinkSync('dummy_proof.jpg');
  } catch (err) {
    console.error('Error in test script:', err);
  }
})();
