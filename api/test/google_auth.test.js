import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAge,
  validateProfileData,
  signOAuthState,
  verifyOAuthState,
  getGoogleAuthUrl,
  verifyGoogleIdToken,
  mergeGuestState
} from '../auth/google.js';

test('calculateAge correctly calculates age from YYYY-MM-DD without storing stale age', () => {
  const today = new Date();
  const birthYear = today.getFullYear() - 25;
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dobExact = `${birthYear}-${month}-${day}`;
  
  assert.equal(calculateAge(dobExact), 25);
  assert.equal(calculateAge('invalid-date'), null);
  assert.equal(calculateAge(''), null);
  assert.equal(calculateAge(null), null);
});

test('validateProfileData accepts valid profile and rejects missing required fields', () => {
  const validData = {
    fullName: 'Jane Doe',
    dateOfBirth: '1998-05-12',
    sex: 'female',
    heightCm: 168,
    currentWeightKg: 62.5,
    targetWeightKg: 60.0,
    fitnessGoal: 'strength',
    activityLevel: 'very_active',
    fitnessExperience: 'intermediate',
    preferredWorkoutDays: [1, 2, 3, 4, 5],
    preferences: 'Kettlebells and barbells only'
  };

  const res = validateProfileData(validData);
  assert.equal(res.valid, true);
  assert.equal(res.profile.fullName, 'Jane Doe');
  assert.equal(res.profile.sex, 'female');
  assert.equal(res.profile.heightCm, 168);
  assert.equal(res.profile.currentWeightKg, 62.5);
  assert.equal(res.profile.targetWeightKg, 60.0);
  assert.equal(typeof res.calculatedAge, 'number');

  // Test missing full name
  const invalidName = validateProfileData({ ...validData, fullName: '' });
  assert.equal(invalidName.valid, false);
  assert.match(invalidName.error, /Full name is required/);

  // Test invalid date of birth
  const invalidDob = validateProfileData({ ...validData, dateOfBirth: '2025-01-01' });
  assert.equal(invalidDob.valid, false);
  assert.match(invalidDob.error, /Valid date of birth required/);

  // Test invalid sex
  const invalidSex = validateProfileData({ ...validData, sex: 'alien' });
  assert.equal(invalidSex.valid, false);
  assert.match(invalidSex.error, /Sex must be male, female, or other/);

  // Test out-of-range weight
  const invalidWeight = validateProfileData({ ...validData, currentWeightKg: 5 });
  assert.equal(invalidWeight.valid, false);
  assert.match(invalidWeight.error, /Current weight must be between 20 and 400 kg/);
});

test('OAuth state signing and verification prevents CSRF and detects tampering', () => {
  const secret = 'super-secret-test-key-12345';
  const payload = { intent: 'login', returnUrl: '/home' };
  
  const token = signOAuthState(payload, secret);
  assert.equal(typeof token, 'string');
  assert.ok(token.includes('.'));

  // Valid verification
  const verified = verifyOAuthState(token, secret);
  assert.ok(verified);
  assert.equal(verified.intent, 'login');
  assert.equal(verified.returnUrl, '/home');

  // Tampered payload
  const [b64, mac] = token.split('.');
  const tamperedB64 = Buffer.from(JSON.stringify({ intent: 'hacked' })).toString('base64url');
  assert.equal(verifyOAuthState(`${tamperedB64}.${mac}`, secret), null);

  // Wrong secret
  assert.equal(verifyOAuthState(token, 'wrong-secret'), null);

  // Malformed token
  assert.equal(verifyOAuthState('malformed-token-without-dot', secret), null);
});

test('getGoogleAuthUrl generates valid Google authorization URL', () => {
  const url = getGoogleAuthUrl({
    clientId: 'test-google-client-id.apps.googleusercontent.com',
    callbackUrl: 'https://opengym-backend-ikdi.onrender.com/api/auth/google/callback',
    state: 'test-state-token'
  });

  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://accounts.google.com');
  assert.equal(parsed.pathname, '/o/oauth2/v2/auth');
  assert.equal(parsed.searchParams.get('client_id'), 'test-google-client-id.apps.googleusercontent.com');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'https://opengym-backend-ikdi.onrender.com/api/auth/google/callback');
  assert.equal(parsed.searchParams.get('response_type'), 'code');
  assert.equal(parsed.searchParams.get('scope'), 'openid email profile');
  assert.equal(parsed.searchParams.get('state'), 'test-state-token');
});

test('verifyGoogleIdToken validates claims and enforces verified email', async () => {
  const clientId = 'google-client-id-123';
  
  // Mock fetchFn simulating Google tokeninfo
  const mockFetchValid = async (url) => {
    return {
      ok: true,
      json: async () => ({
        aud: clientId,
        iss: 'https://accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        sub: 'google-sub-998877',
        email: 'Lifter@Example.com',
        email_verified: 'true',
        name: 'Alex Lifter',
        picture: 'https://lh3.googleusercontent.com/avatar'
      })
    };
  };

  const identity = await verifyGoogleIdToken({
    idToken: 'valid-mock-token',
    clientId,
    fetchFn: mockFetchValid
  });

  assert.equal(identity.sub, 'google-sub-998877');
  assert.equal(identity.email, 'lifter@example.com');
  assert.equal(identity.emailVerified, true);
  assert.equal(identity.name, 'Alex Lifter');
  assert.equal(identity.picture, 'https://lh3.googleusercontent.com/avatar');

  // Test unverified email rejection
  const mockFetchUnverified = async () => ({
    ok: true,
    json: async () => ({
      aud: clientId,
      iss: 'accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'google-sub-000',
      email: 'unverified@example.com',
      email_verified: false
    })
  });

  await assert.rejects(
    () => verifyGoogleIdToken({ idToken: 'unverified-token', clientId, fetchFn: mockFetchUnverified }),
    /email is not verified/
  );

  // Test audience mismatch rejection
  const mockFetchWrongAud = async () => ({
    ok: true,
    json: async () => ({
      aud: 'different-client-id',
      iss: 'accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'google-sub-111',
      email: 'user@example.com',
      email_verified: true
    })
  });

  await assert.rejects(
    () => verifyGoogleIdToken({ idToken: 'wrong-aud-token', clientId, fetchFn: mockFetchWrongAud }),
    /audience mismatch/
  );
});

test('mergeGuestState safely imports guest workouts, routines, and meals without duplicating', () => {
  const cloudState = {
    workouts: [
      { id: 'w1', d: '2026-11-10', name: 'Leg Day' },
      { id: 'w2', d: '2026-11-12', name: 'Upper Body' }
    ],
    routines: [
      { id: 'r1', name: 'Push' }
    ],
    meals: [
      { id: 'm1', t: 1000, name: 'Eggs & Toast' }
    ]
  };

  const guestState = {
    workouts: [
      { id: 'w2', d: '2026-11-12', name: 'Upper Body (Duplicate)' },
      { id: 'w3', d: '2026-11-13', name: 'Cardio' }
    ],
    routines: [
      { id: 'r1', name: 'Push (Duplicate)' },
      { id: 'r2', name: 'Pull' }
    ],
    meals: [
      { id: 'm1', t: 1000, name: 'Eggs & Toast (Duplicate)' },
      { id: 'm2', t: 2000, name: 'Protein Shake' }
    ]
  };

  const { mergedState, counts } = mergeGuestState(cloudState, guestState);
  assert.equal(mergedState.workouts.length, 3);
  assert.equal(counts.workouts, 1); // Only w3 was imported
  assert.equal(mergedState.routines.length, 2);
  assert.equal(counts.routines, 1); // Only r2 was imported
  assert.equal(mergedState.meals.length, 2);
  assert.equal(counts.meals, 1); // Only m2 was imported
});

test('validateProfileData accepts all 7 primary fitness goals and handles dietPreferences & workoutType', () => {
  const baseProfile = {
    fullName: 'Jordan Apex',
    dateOfBirth: '1995-04-20',
    sex: 'male',
    heightCm: 180,
    currentWeightKg: 82.5,
    targetWeightKg: 80.0,
    activityLevel: 'moderately_active',
    fitnessExperience: 'intermediate',
    preferredWorkoutDays: [1, 3, 5],
    workoutType: 'strength',
    dietPreferences: {
      breakfast: ['Oatmeal & Whey', 'Whole Eggs & Toast'],
      lunch: ['Chicken Breast & White Rice'],
      dinner: ['Salmon & Sweet Potato']
    },
    onboardingCompleted: true
  };

  const allGoals = [
    'fat_loss',
    'weight_loss',
    'muscle_gain',
    'weight_gain',
    'recomposition',
    'general_fitness',
    'maintenance'
  ];

  for (const goal of allGoals) {
    const res = validateProfileData({ ...baseProfile, fitnessGoal: goal });
    assert.equal(res.valid, true, `Goal ${goal} should be valid`);
    assert.equal(res.profile.fitnessGoal, goal);
    assert.equal(res.profile.workoutType, 'strength');
    assert.equal(res.profile.onboardingCompleted, true);
    assert.deepEqual(res.profile.dietPreferences.breakfast, ['Oatmeal & Whey', 'Whole Eggs & Toast']);
  }

  // Verify skipped diet preferences (null) is valid
  const resSkipped = validateProfileData({ ...baseProfile, fitnessGoal: 'fat_loss', dietPreferences: null });
  assert.equal(resSkipped.valid, true);
  assert.equal(resSkipped.profile.dietPreferences, null);
});

test('mergeGuestState safely imports guest workoutTemplates, cardioLogs, and weeklySchedule', () => {
  const cloudState = {
    workouts: [{ id: 'w1' }],
    routines: [{ id: 'r1' }],
    meals: [{ id: 'm1' }],
    workoutTemplates: [
      { id: 'tpl_1', name: 'Chest & Triceps', exercises: [] }
    ],
    cardioLogs: [
      { id: 'c1', type: 'running', durationMin: 30 }
    ],
    weeklySchedule: null
  };

  const guestState = {
    workouts: [{ id: 'w1' }, { id: 'w2' }],
    routines: [{ id: 'r1' }],
    meals: [{ id: 'm1' }],
    workoutTemplates: [
      { id: 'tpl_1', name: 'Chest & Triceps (Dup)', exercises: [] },
      { id: 'tpl_2', name: 'Leg Blitz', exercises: [] }
    ],
    cardioLogs: [
      { id: 'c1', type: 'running (dup)', durationMin: 30 },
      { id: 'c2', type: 'cycling', durationMin: 45 }
    ],
    weeklySchedule: {
      days: { 1: 'tpl_1', 3: 'tpl_2' }
    }
  };

  const { mergedState, counts } = mergeGuestState(cloudState, guestState);
  assert.equal(mergedState.workoutTemplates.length, 2);
  assert.equal(counts.workoutTemplates, 1); // Only tpl_2 imported
  assert.equal(mergedState.workoutTemplates[0].id, 'tpl_1');
  assert.equal(mergedState.workoutTemplates[1].id, 'tpl_2');

  assert.equal(mergedState.cardioLogs.length, 2);
  assert.equal(counts.cardioLogs, 1); // Only c2 imported

  assert.ok(mergedState.weeklySchedule);
  assert.equal(counts.weeklySchedule, 1);
  assert.equal(mergedState.weeklySchedule.days[1], 'tpl_1');
});

test('HTTP endpoint GET /api/auth/google returns authorization URL or config error', async () => {
  const { default: handleRequest } = await import('../server.js');
  const http = await import('node:http');

  function mockReqRes(method, url) {
    const req = new http.IncomingMessage(null);
    req.method = method;
    req.url = url;
    req.headers = { host: 'opengym-backend-ikdi.onrender.com', accept: 'application/json' };
    req.push(null);
    let statusCode = 200;
    let headers = {};
    let body = '';
    const res = {
      writeHead(code, h) { statusCode = code; headers = { ...headers, ...(h || {}) }; },
      setHeader(k, v) { headers[k] = v; },
      getHeader(k) { return headers[k]; },
      end(d) { if (d) body += d; },
      get statusCode() { return statusCode; },
      get body() { return body; },
      get headers() { return headers; }
    };
    return { req, res };
  }

  const { req, res } = mockReqRes('GET', '/api/auth/google');
  await handleRequest(req, res);
  // Either 200 with URL if credentials exist in env, or 500 explaining missing config
  assert.ok(res.statusCode === 200 || res.statusCode === 500);
  const data = JSON.parse(res.body);
  if (res.statusCode === 200) {
    assert.ok(data.url);
  } else {
    assert.equal(data.error, 'google_not_configured');
  }
});

test('HTTP endpoint GET /api/me requires authentication', async () => {
  const { default: handleRequest } = await import('../server.js');
  const http = await import('node:http');

  const req = new http.IncomingMessage(null);
  req.method = 'GET';
  req.url = '/api/me';
  req.headers = { host: 'opengym-backend-ikdi.onrender.com' };
  req.push(null);
  let statusCode = 200;
  let body = '';
  const res = {
    writeHead(code) { statusCode = code; },
    setHeader() {},
    getHeader() {},
    end(d) { if (d) body += d; },
    get statusCode() { return statusCode; },
    get body() { return body; }
  };

  await handleRequest(req, res);
  assert.equal(res.statusCode, 401);
  const data = JSON.parse(res.body);
  assert.equal(data.error, 'not signed in');
});
