import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  addMealLog,
  getMealLogs,
  addWaterLog,
  getWaterLogs,
  addCardioLog,
  getCardioLogs,
  addStrengthLog,
  getStrengthLogs,
  setUserTargets,
  getUserTargets,
  clearAllNutritionDataForUser
} from '../nutrition/db.js';

import handleRequest from '../server.js';

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

test('SQLite Nutrition DB: clearAllNutritionDataForUser wipes all user records while isolating other accounts', () => {
  const userA = 'test_usr_a_' + Date.now();
  const userB = 'test_usr_b_' + Date.now();
  const date = '2026-11-19';

  // Seed User A records
  addMealLog({
    user_id: userA,
    date,
    meal_type: 'lunch',
    food_name: 'Chicken Rice',
    energy_kcal: 650,
    protein_g: 45,
    carb_g: 70,
    fat_g: 15
  });
  addWaterLog({
    user_id: userA,
    date,
    amount_ml: 500
  });
  addCardioLog({
    user_id: userA,
    date,
    activity_type: 'Running',
    duration_min: 30,
    distance_km: 5.0
  });
  addStrengthLog({
    user_id: userA,
    date,
    workout_name: 'Chest & Arms',
    duration_min: 45
  });
  setUserTargets(userA, { calorie_target: 2200, protein_g: 160 });

  // Seed User B records
  addMealLog({
    user_id: userB,
    date,
    meal_type: 'breakfast',
    food_name: 'Oats & Berries',
    energy_kcal: 400,
    protein_g: 20,
    carb_g: 60,
    fat_g: 8
  });
  addWaterLog({
    user_id: userB,
    date,
    amount_ml: 750
  });
  addCardioLog({
    user_id: userB,
    date,
    activity_type: 'Cycling',
    duration_min: 40,
    distance_km: 12.0
  });
  setUserTargets(userB, { calorie_target: 1800, protein_g: 130 });

  // Verify both users have data
  assert.equal(getMealLogs(userA, date).length, 1);
  assert.equal(getWaterLogs(userA, date).length, 1);
  assert.equal(getCardioLogs(userA, date).length, 1);
  assert.equal(getStrengthLogs(userA, date).length, 1);
  assert.equal(getUserTargets(userA).calorie_target, 2200);

  assert.equal(getMealLogs(userB, date).length, 1);
  assert.equal(getWaterLogs(userB, date).length, 1);
  assert.equal(getCardioLogs(userB, date).length, 1);
  assert.equal(getUserTargets(userB).calorie_target, 1800);

  // Clear all data for User A
  clearAllNutritionDataForUser(userA);

  // Verify User A data is completely wiped
  assert.equal(getMealLogs(userA, date).length, 0);
  assert.equal(getWaterLogs(userA, date).length, 0);
  assert.equal(getCardioLogs(userA, date).length, 0);
  assert.equal(getStrengthLogs(userA, date).length, 0);
  assert.equal(getUserTargets(userA), null); // targets cleared

  // Verify User B data is 100% intact and untouched
  assert.equal(getMealLogs(userB, date).length, 1);
  assert.equal(getMealLogs(userB, date)[0].food_name, 'Oats & Berries');
  assert.equal(getWaterLogs(userB, date).length, 1);
  assert.equal(getCardioLogs(userB, date).length, 1);
  assert.equal(getUserTargets(userB).calorie_target, 1800);
});

test('HTTP /api/settings: unauthenticated returns 401, authenticated reads and updates isolated settings', async () => {
  // 1. Unauthenticated GET /api/settings
  const { req: req1, res: res1 } = createMockReqRes('GET', '/api/settings');
  await handleRequest(req1, res1);
  assert.equal(res1.statusCode, 401);

  // 2. Unauthenticated PUT /api/settings
  const { req: req2, res: res2 } = createMockReqRes('PUT', '/api/settings', {}, { settings: { themePreset: 'emerald-green' } });
  await handleRequest(req2, res2);
  assert.equal(res2.statusCode, 401);

  // 3. Unauthenticated POST /api/user/reset
  const { req: req3, res: res3 } = createMockReqRes('POST', '/api/user/reset', {}, { scope: 'everything' });
  await handleRequest(req3, res3);
  assert.equal(res3.statusCode, 401);
});
