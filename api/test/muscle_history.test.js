import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import handleRequest, { db, makeSession } from '../server.js';

function createMockReqRes(method, url, headers = {}, bodyPayload = null) {
  const req = new http.IncomingMessage(null);
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost:3000', ...headers };

  let statusCode = 200;
  let resHeaders = {};
  let body = '';

  const res = {
    writeHead(code, h) {
      statusCode = code;
      resHeaders = { ...resHeaders, ...(h || {}) };
    },
    setHeader(k, v) {
      resHeaders[k] = v;
    },
    end(data) {
      if (data) body += data;
    },
    get statusCode() { return statusCode; },
    get body() { return body; },
    get headers() { return resHeaders; }
  };

  if (bodyPayload) {
    req.push(typeof bodyPayload === 'string' ? bodyPayload : JSON.stringify(bodyPayload));
    req.push(null);
  } else {
    req.push(null);
  }

  return { req, res };
}

test('Muscle History: unauthenticated requests to /api/muscle-history return 401', async () => {
  const { req, res } = createMockReqRes('GET', '/api/muscle-history');
  await handleRequest(req, res);
  assert.equal(res.statusCode, 401);
});

test('Muscle History: persists completed workouts and isolates user muscle records', async () => {
  const userA = { id: 'user_muscle_a_' + Date.now(), name: 'User A', sessionVersion: 0 };
  const userB = { id: 'user_muscle_b_' + Date.now(), name: 'User B', sessionVersion: 0 };

  db.users.push(userA);
  db.users.push(userB);

  const tokenA = makeSession(userA);
  const tokenB = makeSession(userB);

  const authHeaderA = { authorization: `Bearer ${tokenA}` };
  const authHeaderB = { authorization: `Bearer ${tokenB}` };

  const today = '2026-11-20';
  const yesterday = '2026-11-19';

  // User A logs a Push Workout on today and Pull Workout on yesterday
  const stateA = {
    workouts: [
      {
        id: 'w_userA_today',
        name: 'Push Workout',
        d: today,
        date: today,
        entries: [
          {
            id: 'bench_press',
            name: 'Barbell Bench Press',
            primaryMuscles: ['chest'],
            secondaryMuscles: ['triceps', 'deltoids'],
            sets: [
              { done: true, w: 80, r: 8 },
              { done: true, w: 80, r: 8 }
            ]
          }
        ]
      },
      {
        id: 'w_userA_yesterday',
        name: 'Pull Workout',
        d: yesterday,
        date: yesterday,
        entries: [
          {
            id: 'lat_pulldown',
            name: 'Lat Pulldown',
            primaryMuscles: ['upper-back'],
            secondaryMuscles: ['biceps'],
            sets: [
              { done: true, w: 60, r: 10 }
            ]
          }
        ]
      }
    ]
  };

  // User B logs a Leg Workout on today
  const stateB = {
    workouts: [
      {
        id: 'w_userB_today',
        name: 'Legs Workout',
        d: today,
        date: today,
        entries: [
          {
            id: 'squat',
            name: 'Barbell Squat',
            primaryMuscles: ['quadriceps'],
            secondaryMuscles: ['gluteal'],
            sets: [
              { done: true, w: 100, r: 5 }
            ]
          }
        ]
      }
    ]
  };

  // 1. Save User A state via PUT /api/data
  const { req: putReqA, res: putResA } = createMockReqRes('PUT', '/api/data', authHeaderA, { state: stateA });
  await handleRequest(putReqA, putResA);
  assert.equal(putResA.statusCode, 200);

  // 2. Save User B state via PUT /api/data
  const { req: putReqB, res: putResB } = createMockReqRes('PUT', '/api/data', authHeaderB, { state: stateB });
  await handleRequest(putReqB, putResB);
  assert.equal(putResB.statusCode, 200);

  // 3. User A queries all muscle history
  const { req: getReqA, res: getResA } = createMockReqRes('GET', '/api/muscle-history', authHeaderA);
  await handleRequest(getReqA, getResA);
  assert.equal(getResA.statusCode, 200);
  const dataA = JSON.parse(getResA.body);
  assert.equal(dataA.ok, true);
  assert.ok(dataA.history.length >= 2);

  // Verify User A only sees their own exercises and muscles
  assert.ok(dataA.history.some(h => h.exerciseName === 'Barbell Bench Press' && h.muscleGroups.primary.includes('chest')));
  assert.ok(dataA.history.some(h => h.exerciseName === 'Lat Pulldown' && h.muscleGroups.primary.includes('upper-back')));
  assert.equal(dataA.history.some(h => h.exerciseName === 'Barbell Squat'), false, 'User A must not see User B squat workout');

  // 4. User A queries specifically by date (today)
  const { req: getDateReqA, res: getDateResA } = createMockReqRes('GET', `/api/muscle-history?date=${today}`, authHeaderA);
  await handleRequest(getDateReqA, getDateResA);
  assert.equal(getDateResA.statusCode, 200);
  const dateDataA = JSON.parse(getDateResA.body);
  assert.equal(dateDataA.history.length, 1);
  assert.equal(dateDataA.history[0].exerciseName, 'Barbell Bench Press');

  // 5. User B queries muscle history
  const { req: getReqB, res: getResB } = createMockReqRes('GET', '/api/muscle-history', authHeaderB);
  await handleRequest(getReqB, getResB);
  assert.equal(getResB.statusCode, 200);
  const dataB = JSON.parse(getResB.body);
  assert.equal(dataB.history.length, 1);
  assert.equal(dataB.history[0].exerciseName, 'Barbell Squat');
  assert.ok(dataB.history[0].muscleGroups.primary.includes('quadriceps'));
  assert.equal(dataB.history.some(h => h.exerciseName === 'Barbell Bench Press'), false, 'User B must not see User A bench press');

  // 6. Reset User A and verify muscle history is wiped
  const { req: resetReqA, res: resetResA } = createMockReqRes('POST', '/api/user/reset', authHeaderA, { scope: 'fitness_only' });
  await handleRequest(resetReqA, resetResA);
  assert.equal(resetResA.statusCode, 200);

  const { req: getAfterResetA, res: getAfterResetResA } = createMockReqRes('GET', '/api/muscle-history', authHeaderA);
  await handleRequest(getAfterResetA, getAfterResetResA);
  const postResetDataA = JSON.parse(getAfterResetResA.body);
  assert.equal(postResetDataA.history.length, 0);

  // User B's muscle history must remain intact after User A's reset
  const { req: getAfterResetB, res: getAfterResetResB } = createMockReqRes('GET', '/api/muscle-history', authHeaderB);
  await handleRequest(getAfterResetB, getAfterResetResB);
  const postResetDataB = JSON.parse(getAfterResetResB.body);
  assert.equal(postResetDataB.history.length, 1);
  assert.equal(postResetDataB.history[0].exerciseName, 'Barbell Squat');
});
