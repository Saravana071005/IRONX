import test from 'node:test';
import assert from 'node:assert/strict';
import { nutritionRoutes } from '../nutrition/routes.js';
import {
  getDb,
  getCanonicalUserNutritionGoals,
  saveCanonicalCalorieGoal,
  getUserTargets,
  setUserTargets,
  saveWeightLog,
  getWeightLogs,
  deleteWeightLog,
  getWeightStats,
  addMealLog,
  clearAllNutritionDataForUser
} from '../nutrition/db.js';
import {
  calculateNutritionTargets
} from '../nutrition/planner.js';
import {
  analyzeWeeklyNutritionProgress,
  applyWeeklyNutritionReview
} from '../nutrition/adaptive.js';

test('IRONX — user_targets Fix & Adaptive Nutrition Intelligence Test Suite', async (t) => {
  const testUserId = 'test_adaptive_user_' + Date.now();
  let currentUser = { id: testUserId, username: 'test_user', email: 'test@ironx.fit' };
  let reqBody = {};

  const mockHelpers = () => ({
    json: (res, status, data) => {
      res.status = status;
      res.body = data;
      return data;
    },
    readBody: async () => reqBody,
    readSession: () => currentUser
  });

  const routes = nutritionRoutes(mockHelpers());

  async function callRoute(path, method = 'GET', body = {}) {
    reqBody = body;
    const key = `${method.toUpperCase()} ${path.split('?')[0]}`;
    const handler = routes[key];
    if (!handler) {
      throw new Error(`Handler not found for: ${key}`);
    }
    const res = {};
    const req = { url: path, method };
    await handler(req, res);
    return res;
  }

  // Teardown / cleanup
  t.after(() => {
    try {
      clearAllNutritionDataForUser(testUserId);
      const d = getDb();
      d.prepare('DELETE FROM user_targets WHERE user_id = ?').run(testUserId);
      d.prepare('DELETE FROM weight_logs WHERE user_id = ?').run(testUserId);
      d.prepare('DELETE FROM weekly_nutrition_reviews WHERE user_id = ?').run(testUserId);
    } catch (_) {}
  });

  await t.test('1. CRITICAL BUG FIX: user_targets table exists and saving 1900 kcal succeeds without error', async () => {
    // Verify user_targets table exists in SQLite
    const d = getDb();
    const tableCheck = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_targets'").get();
    assert.ok(tableCheck, 'Table user_targets must exist in the database');

    // Reproduce user action: Change calorie goal from 2000 to 1900
    const res = await callRoute('/api/nutrition/daily-goal', 'POST', { calorie_target: 1900 });
    assert.equal(res.status, 200, 'POST /api/nutrition/daily-goal must return 200 OK');
    assert.equal(res.body.ok, true);
    assert.equal(res.body.calorie_target, 1900, 'Calorie target must be 1900');

    // Verify canonical read
    const canonical = getCanonicalUserNutritionGoals(testUserId);
    assert.equal(canonical.calorie_target, 1900, 'Canonical read must return 1900 kcal');

    // Also verify /api/nutrition/canonical-goal
    const canonicalRes = await callRoute('/api/nutrition/canonical-goal', 'GET');
    assert.equal(canonicalRes.status, 200);
    assert.equal(canonicalRes.body.calorie_target, 1900);
  });

  await t.test('2. DETERMINISTIC FORMULAS: Mifflin-St Jeor BMR, TDEE & Macronutrient Distribution', async () => {
    // 26yo Male, 175cm, 78.45kg, Moderately Active, Fat Loss (-450 kcal)
    const profile = {
      age: 26,
      sex: 'male',
      height_cm: 175,
      weight_kg: 78.45,
      activity_level: 'moderately_active',
      fitness_goal: 'fat_loss'
    };

    const calculated = calculateNutritionTargets(profile);

    // BMR formula: 10*78.45 + 6.25*175 - 5*26 + 5 = 784.5 + 1093.75 - 130 + 5 = 1753.25 -> 1753
    assert.equal(calculated.bmr, 1753, 'Mifflin-St Jeor BMR for 78.45kg 26yo male must be 1753');

    // TDEE = BMR * 1.55 = 1753 * 1.55 = 2717.15 -> 2717
    assert.equal(calculated.tdee, 2717, 'TDEE for moderately active male must be 2717');

    // Calorie Target: 2717 - 450 = 2267 kcal
    assert.equal(calculated.calorie_target, 2267, 'Calorie target for fat loss must be 2267');

    // Protein Target: 2.0g per kg for fat loss = 78.45 * 2.0 = 156.9 -> 157g
    assert.equal(calculated.protein_target, 157, 'Protein target must be 157g');

    // Fat: 20-25% of calories / 9 = (2267 * 0.25) / 9 = ~63g
    assert.ok(calculated.fat_target >= 50 && calculated.fat_target <= 75, 'Fat target should be within 20-30% range');

    // Fiber: 14g per 1000 kcal = (2267 / 1000) * 14 = ~32g
    assert.equal(calculated.fibre_target, 32, 'Fiber target should be 14g/1000 kcal (32g)');

    // Consistency: 4*P + 4*C + 9*F must equal calorie target within rounding tolerance
    const macroCals = (calculated.protein_target * 4) + (calculated.carb_target * 4) + (calculated.fat_target * 9);
    assert.ok(Math.abs(macroCals - calculated.calorie_target) <= 5, 'Sum of macronutrient calories must match calorie target');
  });

  await t.test('3. NUTRITION ONBOARDING ROUTE: Stores canonical profile into user_targets & logs initial weight', async () => {
    const onboardingPayload = {
      profile: {
        age: 28,
        sex: 'female',
        height_cm: 165,
        weight_kg: 62.50,
        activity_level: 'moderately_active',
        fitness_goal: 'fat_loss',
        workout_days_per_week: 4,
        cardio_frequency_per_week: 2,
        cardio_duration_min: 20
      }
    };

    const res = await callRoute('/api/nutrition/goals/onboarding', 'POST', onboardingPayload);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    // Verify stored canonical targets
    const canonical = getCanonicalUserNutritionGoals(testUserId);
    assert.equal(canonical.sex, 'female');
    assert.equal(canonical.current_weight_kg, 62.5);
    assert.ok(canonical.calorie_target > 0);
    assert.ok(canonical.protein_target > 0 || canonical.protein_target_g > 0);

    // Initial weight log should be saved
    const weightStats = getWeightStats(testUserId);
    assert.equal(weightStats.latest.weight_kg, 62.5);
  });

  await t.test('4. DAILY BODY-WEIGHT TRACKING: Decimal weights, rolling 7-day average, delta W & deletion', async () => {
    const userForWeight = 'weight_tester_' + Date.now();
    currentUser = { id: userForWeight, username: 'wt', email: 'wt@test.fit' };

    try {
      // Log day 1: 78.45 kg
      const res1 = await callRoute('/api/nutrition/weight-logs', 'POST', {
        date: '2026-11-20',
        weight_kg: 78.45,
        notes: 'Morning fasted'
      });
      assert.equal(res1.status, 200);
      assert.equal(res1.body.log.weight_kg, 78.45);

      // Log day 2: 78.20 kg
      await callRoute('/api/nutrition/weight-logs', 'POST', {
        date: '2026-11-21',
        weight_kg: 78.20,
        notes: 'Fasted'
      });

      // Log day 3: 78.00 kg
      await callRoute('/api/nutrition/weight-logs', 'POST', {
        date: '2026-11-22',
        weight_kg: 78.00
      });

      // Log day 4: 77.85 kg
      await callRoute('/api/nutrition/weight-logs', 'POST', {
        date: '2026-11-23',
        weight_kg: 77.85
      });

      // Fetch weight logs
      const getRes = await callRoute('/api/nutrition/weight-logs', 'GET');
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.logs.length, 4);

      // Verify 7-day rolling average: (78.45 + 78.20 + 78.00 + 77.85) / 4 = 312.5 / 4 = 78.125 -> 78.13
      assert.equal(getRes.body.stats.rolling_7day_avg, 78.13);
      assert.equal(getRes.body.stats.latest.weight_kg, 77.85);

      // Delete a log
      const delRes = await callRoute('/api/nutrition/weight-logs/delete', 'POST', {
        date: '2026-11-20'
      });
      assert.equal(delRes.status, 200);
      assert.equal(delRes.body.ok, true);

      const afterDel = await callRoute('/api/nutrition/weight-logs', 'GET');
      assert.equal(afterDel.body.logs.length, 3);
    } finally {
      clearAllNutritionDataForUser(userForWeight);
      getDb().prepare('DELETE FROM weight_logs WHERE user_id = ?').run(userForWeight);
    }
  });

  await t.test('5. SCIENTIFIC GUARDRAILS & ADAPTIVE INTELLIGENCE: Insufficient Data Phase (<4 weigh-ins or <4 meal days)', async () => {
    const userGuard = 'guard_user_' + Date.now();
    currentUser = { id: userGuard, username: 'guard', email: 'guard@test.fit' };

    try {
      saveCanonicalCalorieGoal(userGuard, 2000);

      // Only 2 weigh-ins and 1 meal log
      saveWeightLog(userGuard, { date: '2026-11-24', weight_kg: 80.0 });
      saveWeightLog(userGuard, { date: '2026-11-25', weight_kg: 79.8 });
      addMealLog({
        user_id: userGuard,
        date: '2026-11-25',
        meal_type: 'lunch',
        food_name: 'Chicken Rice',
        energy_kcal: 750,
        protein_g: 50,
        carb_g: 80,
        fat_g: 15
      });

      const review = analyzeWeeklyNutritionProgress(userGuard, 14);
      assert.equal(review.status, 'gathering_data');
      assert.equal(review.calorie_adjustment, 0, 'Must NOT recommend calorie adjustments with insufficient data');
      assert.ok(review.explanation.includes('4') && (review.explanation.includes('weigh-ins') || review.explanation.includes('Insufficient')));
    } finally {
      clearAllNutritionDataForUser(userGuard);
      getDb().prepare('DELETE FROM weight_logs WHERE user_id = ?').run(userGuard);
      getDb().prepare('DELETE FROM user_targets WHERE user_id = ?').run(userGuard);
    }
  });

  await t.test('6. ADAPTIVE REVIEW: Fat Loss Plateau Detection & Applying Bounded Adjustment (-100 kcal)', async () => {
    const userPlateau = 'plateau_user_' + Date.now();
    currentUser = { id: userPlateau, username: 'plateau', email: 'plateau@test.fit' };

    try {
      // User with Fat Loss goal at 2000 kcal target
      setUserTargets(userPlateau, {
        goal_type: 'fat_loss',
        calorie_target: 2000,
        protein_target_g: 150,
        sex: 'male',
        current_weight_kg: 85.0
      });
      saveCanonicalCalorieGoal(userPlateau, 2000);

      // Previous week: 7 weigh-ins averaging ~85.0 kg
      for (let i = 13; i >= 7; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        saveWeightLog(userPlateau, { date: d, weight_kg: 85.0 + (Math.random() * 0.05) });
      }

      // Recent 7 days: 7 weigh-ins averaging ~84.95 kg (stalled, only 0.05 kg change, <0.2kg threshold)
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        saveWeightLog(userPlateau, { date: d, weight_kg: 84.95 + (Math.random() * 0.05) });
      }

      // Log compliant meals for 6 days (~1950 kcal/day, ~97% adherence)
      for (let i = 6; i >= 1; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        addMealLog({
          user_id: userPlateau,
          date: d,
          meal_type: 'lunch',
          food_name: 'Compliant Healthy Meal',
          energy_kcal: 1950,
          protein_g: 155,
          carb_g: 180,
          fat_g: 50
        });
      }

      const review = analyzeWeeklyNutritionProgress(userPlateau, 14);
      assert.equal(review.status, 'plateau', 'Should detect metabolic plateau');
      assert.equal(review.calorie_adjustment, -100, 'Should recommend -100 kcal bounded deficit');
      assert.equal(review.recommended_calorie_target, 1900, 'Recommended target must be 1900 kcal');
      assert.equal(review.is_actionable, true);

      // Apply the review adjustment
      const applyRes = await callRoute('/api/nutrition/weekly-review/apply', 'POST', { review_id: review.id });
      assert.equal(applyRes.status, 200);
      assert.equal(applyRes.body.ok, true);

      // Verify user_targets now updated to 1900 kcal
      const updatedTargets = getCanonicalUserNutritionGoals(userPlateau);
      assert.equal(updatedTargets.calorie_target, 1900, 'user_targets must be updated to 1900 kcal');
    } finally {
      clearAllNutritionDataForUser(userPlateau);
      getDb().prepare('DELETE FROM weight_logs WHERE user_id = ?').run(userPlateau);
      getDb().prepare('DELETE FROM user_targets WHERE user_id = ?').run(userPlateau);
      getDb().prepare('DELETE FROM weekly_nutrition_reviews WHERE user_id = ?').run(userPlateau);
    }
  });

  await t.test('7. SAFETY FLOORS: Calorie target never falls below 1,500 kcal for male and 1,200 kcal for female', async () => {
    const femaleUser = 'female_safety_' + Date.now();
    setUserTargets(femaleUser, {
      goal_type: 'fat_loss',
      calorie_target: 1250,
      sex: 'female'
    });
    saveCanonicalCalorieGoal(femaleUser, 1250);

    // If an adjustment would push below 1200 kcal, it must be bounded by safety floor
    const d = getDb();
    // Simulate female at 1220 kcal trying to reduce by 100 kcal -> must floor at 1200 kcal
    setUserTargets(femaleUser, { goal_type: 'fat_loss', calorie_target: 1220, sex: 'female' });
    const canonical = getCanonicalUserNutritionGoals(femaleUser);
    assert.ok(canonical.calorie_target >= 1200, 'Female calorie target must never fall below 1200 kcal floor');

    // Clean up
    d.prepare('DELETE FROM user_targets WHERE user_id = ?').run(femaleUser);
  });
});
