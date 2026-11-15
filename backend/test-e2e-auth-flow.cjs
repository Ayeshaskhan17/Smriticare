const mariadb = require('mariadb');

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('===============================================================');
  console.log('       SMRITICARE PATIENT & CAREGIVER END-TO-END AUTH TEST     ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  const patientEmail = `patient_${Date.now()}@testcare.org`;
  const patientPassword = 'StrongPassword123!';
  let patientToken = '';
  let patientId = '';

  const caregiverEmail = `caregiver_${Date.now()}@testcare.org`;
  const caregiverPassword = 'CaregiverPass123!';
  let caregiverToken = '';
  let caregiverId = '';

  // TEST 1: Register a new patient with valid details
  await test('1. Register a new patient with valid details', async () => {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Devi Shrestha',
        email: patientEmail,
        password: patientPassword,
        age: 74,
        language: 'Hindi',
        role: 'PATIENT'
      })
    });
    const data = await res.json();
    if (res.status !== 201 || !data.token || data.user.role !== 'PATIENT') {
      throw new Error(`Registration failed: ${JSON.stringify(data)}`);
    }
    patientToken = data.token;
    patientId = data.user.id;
  });

  // TEST 2: Confirm patient record is saved in MySQL database
  await test('2. Confirm patient record is persisted in MySQL database', async () => {
    const conn = await mariadb.createConnection({
      host: '127.0.0.1',
      port: 3307,
      user: 'root',
      password: '',
      database: 'smriticare',
      allowPublicKeyRetrieval: true
    });
    const rows = await conn.query('SELECT id, fullName, email, role, age, language FROM User WHERE email = ?', [patientEmail]);
    await conn.end();
    if (!rows || rows.length === 0) {
      throw new Error('Patient record not found in database table User');
    }
    const dbUser = rows[0];
    if (dbUser.fullName !== 'Devi Shrestha' || dbUser.role !== 'PATIENT' || dbUser.age !== 74) {
      throw new Error(`Data mismatch in database: ${JSON.stringify(dbUser)}`);
    }
  });

  // TEST 3: Sign in using the newly registered credentials
  await test('3. Sign in using the newly registered credentials', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: patientEmail,
        password: patientPassword,
        role: 'PATIENT'
      })
    });
    const data = await res.json();
    if (res.status !== 200 || !data.token || data.user.email !== patientEmail) {
      throw new Error(`Sign in failed: ${JSON.stringify(data)}`);
    }
    patientToken = data.token;
  });

  // TEST 4: Confirm the patient reaches the dashboard and profile data is valid
  await test('4. Access authenticated patient profile /api/auth/me', async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    const data = await res.json();
    if (res.status !== 200 || !data.success || data.user.id !== patientId) {
      throw new Error(`Dashboard/Profile fetch failed: ${JSON.stringify(data)}`);
    }
  });

  // TEST 5: Session verification simulating app refresh/restore
  await test('5. Session token restore behavior (/api/auth/me token check)', async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    const data = await res.json();
    if (res.status !== 200 || data.user.role !== 'PATIENT') {
      throw new Error('Session could not be restored from Bearer token');
    }
  });

  // TEST 6: Sign out / invalid token verification - protected pages inaccessible
  await test('6. Sign out / protected endpoint denies invalid or absent token', async () => {
    const resNoToken = await fetch(`${API_BASE}/auth/me`);
    if (resNoToken.status !== 401) {
      throw new Error(`Expected 401 without token, got: ${resNoToken.status}`);
    }

    const resBadToken = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: 'Bearer invalid.bogus.jwt' }
    });
    if (resBadToken.status !== 401) {
      throw new Error(`Expected 401 with bad token, got: ${resBadToken.status}`);
    }
  });

  // TEST 7: Sign in again with same credentials
  await test('7. Sign in again with the same credentials', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: patientEmail,
        password: patientPassword,
        role: 'PATIENT'
      })
    });
    const data = await res.json();
    if (res.status !== 200 || !data.token) {
      throw new Error(`Re-login failed: ${JSON.stringify(data)}`);
    }
  });

  // TEST 8: Try registering the same email again and verify a useful error appears
  await test('8. Duplicate registration rejected with clear error', async () => {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Devi Shrestha Clone',
        email: patientEmail,
        password: 'AnotherPassword456!',
        role: 'PATIENT'
      })
    });
    const data = await res.json();
    if (res.status !== 400 || !data.message.includes('already exists')) {
      throw new Error(`Expected duplicate email error, got: status=${res.status}, body=${JSON.stringify(data)}`);
    }
  });

  // TEST 9: Try incorrect password and verify sign-in is rejected
  await test('9. Incorrect password rejected with 401 status', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: patientEmail,
        password: 'WrongPassword999!',
        role: 'PATIENT'
      })
    });
    const data = await res.json();
    if (res.status !== 401 || !data.message.includes('Invalid email or password')) {
      throw new Error(`Expected invalid password error, got: status=${res.status}, body=${JSON.stringify(data)}`);
    }
  });

  // TEST 10: Caregiver account creation, login, and access rules
  await test('10. Caregiver account creation, login, and role separation rules', async () => {
    // A. Register caregiver
    const regRes = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Nurse Anita Roy',
        email: caregiverEmail,
        password: caregiverPassword,
        role: 'CAREGIVER'
      })
    });
    const regData = await regRes.json();
    if (regRes.status !== 201 || regData.user.role !== 'CAREGIVER') {
      throw new Error(`Caregiver registration failed: ${JSON.stringify(regData)}`);
    }
    caregiverToken = regData.token;
    caregiverId = regData.user.id;

    // B. Login as caregiver
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: caregiverEmail,
        password: caregiverPassword,
        role: 'CAREGIVER'
      })
    });
    const loginData = await loginRes.json();
    if (loginRes.status !== 200 || loginData.user.role !== 'CAREGIVER') {
      throw new Error(`Caregiver login failed: ${JSON.stringify(loginData)}`);
    }

    // C. Caregiver cannot log in under PATIENT role
    const wrongRoleRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: caregiverEmail,
        password: caregiverPassword,
        role: 'PATIENT'
      })
    });
    const wrongRoleData = await wrongRoleRes.json();
    if (wrongRoleRes.status !== 401 || !wrongRoleData.message.includes('not registered as a patient')) {
      throw new Error(`Expected role rejection, got: ${JSON.stringify(wrongRoleData)}`);
    }

    // D. Patient cannot log in under CAREGIVER role
    const patientWrongRoleRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: patientEmail,
        password: patientPassword,
        role: 'CAREGIVER'
      })
    });
    const patientWrongRoleData = await patientWrongRoleRes.json();
    if (patientWrongRoleRes.status !== 401 || !patientWrongRoleData.message.includes('not registered as a caregiver')) {
      throw new Error(`Expected caregiver role rejection, got: ${JSON.stringify(patientWrongRoleData)}`);
    }
  });

  console.log('\n===============================================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED out of 10 tests`);
  console.log('===============================================================');
}

runTests();

