import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import handleRequest, { db, makeSession } from '../server.js';

describe('Profile API Performance, Routing & Timeout Verification', () => {
  let server;
  let port;
  let baseUrl;
  let testUser;
  let testSession;

  before(async () => {
    // Set up test user in in-memory db
    testUser = {
      id: 'usr_perf_test_999',
      name: 'Performance Athlete',
      email: 'athlete.perf@ironx.test',
      profile: {
        completed: true,
        fullName: 'Performance Athlete',
        dateOfBirth: '1995-04-10',
        sex: 'male',
        heightCm: 180,
        currentWeightKg: 80,
        targetWeightKg: 75,
        fitnessGoal: 'recomposition',
        activityLevel: 'very_active',
        fitnessExperience: 'intermediate',
        workoutType: 'strength',
        preferredWorkoutDays: [1, 2, 3, 4, 5, 6],
        dietPreferences: null
      }
    };
    db.users = db.users || [];
    const idx = db.users.findIndex(u => u.id === testUser.id);
    if (idx >= 0) db.users[idx] = testUser;
    else db.users.push(testUser);

    testSession = makeSession(testUser);

    server = http.createServer(handleRequest);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('rejects unauthenticated GET /api/profile with 401', async () => {
    const res = await fetch(`${baseUrl}/api/profile`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'not signed in');
  });

  it('rejects unauthenticated PUT /api/profile with 401', async () => {
    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Nobody' })
    });
    assert.equal(res.status, 401);
  });

  it('serves GET /api/profile in under 200ms with Server-Timing header', async () => {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/api/profile`, {
      headers: { 'Authorization': `Bearer ${testSession}` }
    });
    const duration = Date.now() - start;

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.user.id, testUser.id);
    assert.equal(data.user.profile.fullName, 'Performance Athlete');
    assert.ok(data.user.profile.age >= 25, 'Calculates age from dateOfBirth');
    assert.ok(duration < 200, `Profile read must be fast (took ${duration}ms)`);

    const serverTiming = res.headers.get('Server-Timing');
    assert.ok(serverTiming, 'Server-Timing header must be present');
    assert.match(serverTiming, /db;dur=\d+/);
  });

  it('supports POST /api/profile as an alias to PUT /api/profile', async () => {
    const payload = {
      fullName: 'Updated Athlete POST',
      dateOfBirth: '1996-08-20',
      sex: 'male',
      heightCm: 182,
      currentWeightKg: 81.5,
      targetWeightKg: 78.0,
      fitnessGoal: 'muscle_gain',
      activityLevel: 'moderately_active',
      fitnessExperience: 'advanced',
      workoutType: 'hypertrophy',
      preferredWorkoutDays: [1, 2, 4, 5],
      dietPreferences: { breakfast: ['Oatmeal'], lunch: ['Chicken'], dinner: ['Steak'] }
    };

    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testSession}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.user.name, 'Updated Athlete POST');
    assert.equal(data.user.profile.fitnessGoal, 'muscle_gain');
  });

  it('updates profile via PUT /api/profile and persists target weight swiftly', async () => {
    const payload = {
      fullName: 'John IronX Fast',
      dateOfBirth: '1998-05-15',
      sex: 'male',
      heightCm: 175,
      currentWeightKg: 80.0,
      targetWeightKg: 75.0,
      fitnessGoal: 'recomposition',
      activityLevel: 'very_active',
      fitnessExperience: 'intermediate',
      workoutType: 'strength',
      preferredWorkoutDays: [1, 2, 3, 4, 5, 6],
      dietPreferences: null
    };

    const start = Date.now();
    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${testSession}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const duration = Date.now() - start;

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.user.name, 'John IronX Fast');
    assert.equal(data.user.profile.currentWeightKg, 80.0);
    assert.equal(data.user.profile.targetWeightKg, 75.0);
    assert.ok(duration < 500, `Profile update must complete well before timeout (took ${duration}ms)`);

    const serverTiming = res.headers.get('Server-Timing');
    assert.ok(serverTiming, 'Server-Timing header must be present on PUT /api/profile');
  });

  it('validates profile input and rejects missing required fields with 400', async () => {
    const invalidPayload = {
      fullName: '',
      dateOfBirth: 'not-a-date'
    };

    const res = await fetch(`${baseUrl}/api/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${testSession}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invalidPayload)
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });
});
