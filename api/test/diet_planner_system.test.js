import test from 'node:test';
import assert from 'node:assert/strict';
import { nutritionRoutes } from '../nutrition/routes.js';
import { parseDietPlanText, parseFoodItemString, matchFoodInDataset } from '../nutrition/pdf_importer.js';
import {
  calculateNutritionTargets,
  calculateMealPlanComparison,
  calculateCheatMealImpact,
  AFFORDABLE_NUTRITION_STAPLES
} from '../nutrition/planner.js';
import {
  getDb,
  clearAllNutritionDataForUser,
  getSavedDietPlans,
  getSavedDietPlanById,
  saveSavedDietPlan,
  getDailyMealPlan,
  saveDailyMealPlan,
  getUserNutritionGoals,
  saveUserNutritionGoals,
  getUserAvailableFoods,
  saveUserAvailableFoods,
  getCheatMealLogs,
  addCheatMealLog
} from '../nutrition/db.js';

test('IRONX — Advanced Personalized Nutrition Planner & PDF Diet Import System Test Suite', async (t) => {
  const mockUser = {
    id: 'test_planner_user_' + Date.now(),
    username: 'planner_tester',
    email: 'tester@ironx.fit'
  };

  let currentUser = mockUser;
  let reqBody = {};

  function makeReq(url, method = 'GET', body = {}) {
    return {
      url,
      method,
      headers: { host: 'localhost' }
    };
  }

  function mockHelpers() {
    return {
      json: (res, code, data) => {
        res.statusCode = code;
        res.data = data;
        return res;
      },
      readBody: async () => reqBody,
      readSession: () => currentUser
    };
  }

  // Pre-cleanup
  clearAllNutritionDataForUser(mockUser.id);

  // ==========================================
  // MODULE 1: PDF DIET PLAN IMPORTER & OCR PARSER
  // ==========================================
  await t.test('1. Module 1: Deterministic PDF Text Extraction, Recipe Breakdown & Food Matching', async () => {
    const sampleDietPlan = [
      'Breakfast:',
      '- 2 Chapathi',
      '- 3 Eggs',
      '',
      'Lunch:',
      '- 150 g Rice',
      '- 150 g Chicken',
      '- Vegetables',
      '',
      'Dinner:',
      '- 2 Chapathi',
      '- Egg Curry'
    ].join('\n');

    const parsed = parseDietPlanText(sampleDietPlan);
    assert.equal(parsed.ok, true);

    // Breakfast: 2 Chapathi (70g) & 3 Eggs (150g)
    const bf = parsed.meals.breakfast;
    assert.equal(bf.length, 2);
    assert.ok(bf[0].food_name.includes('Roti') || bf[0].food_name.includes('Chapati'));
    assert.equal(bf[0].serving_quantity, 2);
    assert.equal(bf[0].serving_grams, 70); // 35g * 2
    assert.equal(bf[0].energy_kcal, 207.9);
    assert.equal(bf[0].protein_g, 6.3);

    assert.ok(bf[1].food_name.includes('Egg'));
    assert.equal(bf[1].serving_quantity, 3);
    assert.equal(bf[1].serving_grams, 150); // 50g * 3
    assert.equal(bf[1].energy_kcal, 214.5);
    assert.equal(bf[1].protein_g, 18.9);

    // Lunch: 150g Rice, 150g Chicken, Vegetables
    const lunch = parsed.meals.lunch;
    assert.equal(lunch.length, 3);
    assert.equal(lunch[0].serving_grams, 150);
    assert.equal(lunch[0].energy_kcal, 195);
    assert.equal(lunch[1].serving_grams, 150);
    assert.equal(lunch[1].energy_kcal, 247.5);

    // Dinner: 2 Chapathi, Egg Curry
    const dinner = parsed.meals.dinner;
    assert.equal(dinner.length, 2);
    const eggCurry = dinner[1];
    assert.equal(eggCurry.food_name, 'Egg Curry');
    assert.equal(eggCurry.is_recipe, true);
    assert.ok(eggCurry.ingredients.length >= 4, 'Egg curry includes ingredient breakdown');

    // Verify ingredients: Eggs, Tomato, Onion, Ginger, Cooking oil
    const ingNames = eggCurry.ingredients.map(i => i.food_name.toLowerCase());
    assert.ok(ingNames.some(n => n.includes('egg')), 'Ingredients include egg');
    assert.ok(ingNames.some(n => n.includes('tomato')), 'Ingredients include tomato');
    assert.ok(ingNames.some(n => n.includes('onion')), 'Ingredients include onion');
    assert.ok(ingNames.some(n => n.includes('oil')), 'Ingredients include cooking oil');

    // Verify unmatched food handling
    const unmatched = matchFoodInDataset({ foodName: 'CompletelyFakeAlienGrass', quantity: 100, unit: 'g' });
    assert.equal(unmatched.matched, false);
    assert.equal(unmatched.message, 'Food not found in nutrition database');
    assert.equal(unmatched.energy_kcal, null, 'Never silently assigns zero calories');
    assert.equal(unmatched.requires_confirmation, true);

    // HTTP Endpoint verification: POST /api/nutrition/pdf/parse
    const routes = nutritionRoutes(mockHelpers());
    reqBody = { text: sampleDietPlan };
    const resParse = {};
    await routes['POST /api/nutrition/pdf/parse'](makeReq('/api/nutrition/pdf/parse', 'POST', reqBody), resParse);
    assert.equal(resParse.statusCode, 200);
    assert.equal(resParse.data.ok, true);
    assert.ok(resParse.data.meals.breakfast.length === 2);
  });

  // ==========================================
  // MODULE 2: SAVED DIET PLAN & TEMPLATE MANAGEMENT
  // ==========================================
  await t.test('2. Module 2: Reusable Diet Plans (Save, Active, Duplicate, Delete without losing meal history)', async () => {
    const routes = nutritionRoutes(mockHelpers());

    const planData = {
      name: 'My Regular Diet',
      is_active: true,
      meals: {
        breakfast: [
          { id: 'i1', food_id: 'STAPLE:roti', food_name: 'Wheat Roti / Chapati', serving_quantity: 2, serving_unit: 'piece', serving_grams: 70, energy_kcal: 208, protein_g: 6.3 },
          { id: 'i2', food_id: 'STAPLE:egg_boiled', food_name: 'Boiled Egg', serving_quantity: 3, serving_unit: 'piece', serving_grams: 150, energy_kcal: 215, protein_g: 18.9 }
        ],
        lunch: [
          { id: 'i3', food_id: 'STAPLE:cooked_rice', food_name: 'White Rice', serving_quantity: 150, serving_unit: 'g', serving_grams: 150, energy_kcal: 195, protein_g: 4.1 },
          { id: 'i4', food_id: 'STAPLE:chicken_cooked', food_name: 'Chicken Breast', serving_quantity: 150, serving_unit: 'g', serving_grams: 150, energy_kcal: 248, protein_g: 46.5 }
        ],
        snacks: [
          { id: 'i5', food_id: 'STAPLE:banana', food_name: 'Banana', serving_quantity: 1, serving_unit: 'piece', serving_grams: 100, energy_kcal: 89, protein_g: 1.1 }
        ],
        dinner: [
          { id: 'i6', food_id: 'STAPLE:roti', food_name: 'Wheat Roti', serving_quantity: 2, serving_unit: 'piece', serving_grams: 70, energy_kcal: 208, protein_g: 6.3 },
          { id: 'i7', food_id: 'COMPOSITE:egg_curry', food_name: 'Egg Curry', serving_quantity: 1, serving_unit: 'serving', serving_grams: 215, energy_kcal: 227, protein_g: 14.1 }
        ]
      }
    };

    // Save Diet Plan
    reqBody = planData;
    const resSave = {};
    await routes['POST /api/nutrition/plans/save'](makeReq('/api/nutrition/plans/save', 'POST', reqBody), resSave);
    assert.equal(resSave.statusCode, 200);
    assert.equal(resSave.data.ok, true);
    assert.ok(resSave.data.plan.id);
    const planId = resSave.data.plan.id;

    // List Plans
    const resList = {};
    await routes['GET /api/nutrition/plans'](makeReq('/api/nutrition/plans'), resList);
    assert.equal(resList.statusCode, 200);
    assert.ok(resList.data.plans.length >= 1);
    assert.equal(resList.data.plans[0].is_active, true);

    // Duplicate Plan
    reqBody = { id: planId };
    const resDup = {};
    await routes['POST /api/nutrition/plans/duplicate'](makeReq('/api/nutrition/plans/duplicate', 'POST', reqBody), resDup);
    assert.equal(resDup.statusCode, 200);
    assert.equal(resDup.data.ok, true);
    assert.ok(resDup.data.plan.name.includes('(Copy)'));
    const copyId = resDup.data.plan.id;

    // Delete Duplicate Plan
    reqBody = { id: copyId };
    const resDel = {};
    await routes['POST /api/nutrition/plans/delete'](makeReq('/api/nutrition/plans/delete', 'POST', reqBody), resDel);
    assert.equal(resDel.statusCode, 200);
    assert.equal(resDel.data.ok, true);
  });

  // ==========================================
  // MODULE 2 & 3: TODAY'S PLAN & REMOVE INDIVIDUAL FOODS
  // ==========================================
  await t.test('3. Module 2 & 3: Remove Eggs from today only — Saved template remains unchanged!', async () => {
    const routes = nutritionRoutes(mockHelpers());
    const today = new Date().toISOString().slice(0, 10);

    // 1. Get existing saved plan
    const plans = getSavedDietPlans(mockUser.id);
    assert.ok(plans.length >= 1);
    const activePlan = plans[0];

    // 2. Apply saved plan to today
    reqBody = { date: today, plan_id: activePlan.id };
    const resApply = {};
    await routes['POST /api/nutrition/daily-plan/apply'](makeReq('/api/nutrition/daily-plan/apply', 'POST', reqBody), resApply);
    assert.equal(resApply.statusCode, 200);
    assert.equal(resApply.data.ok, true);

    // 3. User eats breakfast: removes eggs for today only (e.g. today they only ate chapathi)
    reqBody = {
      date: today,
      meal_type: 'breakfast',
      item_id: 'i2', // Boiled Egg
      updates: { remove: true }
    };
    const resUpdateItem = {};
    await routes['POST /api/nutrition/daily-plan/update-item'](makeReq('/api/nutrition/daily-plan/update-item', 'POST', reqBody), resUpdateItem);
    assert.equal(resUpdateItem.statusCode, 200);
    assert.equal(resUpdateItem.data.ok, true);

    // Verify today's breakfast marked egg as removed
    const todayPlan = resUpdateItem.data.dailyPlan;
    const todayEgg = todayPlan.meals.breakfast.find(i => i.id === 'i2');
    assert.equal(todayEgg.removed, true, 'Egg is removed for today');

    // 4. CRITICAL REQUIREMENT: Verify saved template in saved_diet_plans is STILL INTACT with Eggs!
    const templateCheck = getSavedDietPlanById(activePlan.id, mockUser.id);
    const templateEgg = templateCheck.meals.breakfast.find(i => i.id === 'i2');
    assert.ok(templateEgg, 'Eggs still exist in saved template');
    assert.equal(templateEgg.removed, undefined, 'Saved template remains untouched!');
  });

  // ==========================================
  // MODULE 3: MARK MEAL AS DONE & CONSUMED SEPARATION
  // ==========================================
  await t.test('4. Module 3: Mark Breakfast as Done — counts only remaining foods into actual consumption', async () => {
    const routes = nutritionRoutes(mockHelpers());
    const today = new Date().toISOString().slice(0, 10);

    // Mark Breakfast as Completed
    reqBody = { date: today, meal_type: 'breakfast', status: 'completed' };
    const resStatus = {};
    await routes['POST /api/nutrition/daily-plan/toggle-status'](makeReq('/api/nutrition/daily-plan/toggle-status', 'POST', reqBody), resStatus);
    assert.equal(resStatus.statusCode, 200);
    assert.equal(resStatus.data.dailyPlan.status.breakfast, 'completed');

    // Check health log: only Chapathi (208 kcal) should be logged into actual consumption! Not the removed egg!
    const resHealth = {};
    await routes['GET /api/nutrition/health-log'](makeReq(`/api/nutrition/health-log?date=${today}`), resHealth);
    assert.equal(resHealth.statusCode, 200);
    assert.equal(resHealth.data.totals.calories_consumed, 208, 'Only chapathi counted (208 kcal)');
    assert.equal(resHealth.data.totals.protein_g, 6.3);

    // Mark Lunch as Completed
    reqBody = { date: today, meal_type: 'lunch', status: 'completed' };
    await routes['POST /api/nutrition/daily-plan/toggle-status'](makeReq('/api/nutrition/daily-plan/toggle-status', 'POST', reqBody), {});

    // Check daily plan retrieval: planned vs actual tracked separately
    const resDaily = {};
    await routes['GET /api/nutrition/daily-plan'](makeReq(`/api/nutrition/daily-plan?date=${today}`), resDaily);
    assert.equal(resDaily.statusCode, 200);
    assert.ok(resDaily.data.comparison);
    assert.equal(resDaily.data.comparison.consumed.calories, 208 + 195 + 248); // Breakfast (208) + Rice (195) + Chicken (248) = 651 kcal
  });

  // ==========================================
  // MODULE 4: PERSONALIZED BODY & CALORIE CALCULATOR
  // ==========================================
  await t.test('5. Module 4: Deterministic Mifflin-St Jeor BMR, TDEE & Goal Targets', async () => {
    // 76kg, 178cm, 28yo Male, Moderately Active, Muscle Gain (+300)
    const profileMale = {
      age: 28,
      sex: 'male',
      height_cm: 178,
      weight_kg: 76,
      target_weight_kg: 80,
      fitness_goal: 'muscle_gain',
      activity_level: 'moderately_active',
      workout_experience: 'intermediate'
    };

    const targetsM = calculateNutritionTargets(profileMale);
    assert.equal(targetsM.bmi, 24);
    assert.equal(targetsM.bmr, 1738); // 10*76 + 6.25*178 - 5*28 + 5 = 760 + 1112.5 - 140 + 5 = 1737.5 -> 1738
    assert.equal(targetsM.tdee, 2694); // 1738 * 1.55 = 2693.9 -> 2694
    assert.equal(targetsM.calorie_target, 2994); // 2694 + 300
    assert.equal(targetsM.protein_target, 152); // 76 * 2.0 = 152g

    // 60kg, 165cm, 30yo Female, Lightly Active, Fat Loss (-450)
    const profileFemale = {
      age: 30,
      sex: 'female',
      height_cm: 165,
      weight_kg: 60,
      target_weight_kg: 55,
      fitness_goal: 'fat_loss',
      activity_level: 'lightly_active',
      workout_experience: 'beginner'
    };

    const targetsF = calculateNutritionTargets(profileFemale);
    assert.equal(targetsF.bmr, 1320); // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25 -> 1320
    assert.ok(targetsF.calorie_target < targetsF.tdee, 'Deficit applied for fat loss');
    assert.equal(targetsF.protein_target, 119, 'Protein capped at 35% of total calories');

    // HTTP Endpoint: POST /api/nutrition/goals/save
    const routes = nutritionRoutes(mockHelpers());
    reqBody = { profile: profileMale };
    const resSaveGoals = {};
    await routes['POST /api/nutrition/goals/save'](makeReq('/api/nutrition/goals/save', 'POST', reqBody), resSaveGoals);
    assert.equal(resSaveGoals.statusCode, 200);
    assert.equal(resSaveGoals.data.ok, true);
    assert.equal(resSaveGoals.data.goals.calculated_targets.calorie_target, 2994);

    // Goal Revision History
    const resGetGoals = {};
    await routes['GET /api/nutrition/goals'](makeReq('/api/nutrition/goals'), resGetGoals);
    assert.equal(resGetGoals.statusCode, 200);
    assert.ok(resGetGoals.data.goals.history);
  });

  // ==========================================
  // MODULE 5: MEAL PLAN VS GOAL MATCHING & AVAILABLE FOODS
  // ==========================================
  await t.test('6. Module 5: Recommendation Engine & Pantry Available Foods Prioritization', async () => {
    const routes = nutritionRoutes(mockHelpers());
    const today = new Date().toISOString().slice(0, 10);

    // 1. Save user available foods: user has bananas and curd at home
    reqBody = { items: ['banana', 'curd', 'milk'] };
    const resPantry = {};
    await routes['POST /api/nutrition/available-foods'](makeReq('/api/nutrition/available-foods', 'POST', reqBody), resPantry);
    assert.equal(resPantry.statusCode, 200);
    assert.equal(resPantry.data.ok, true);
    assert.deepEqual(resPantry.data.items, ['banana', 'curd', 'milk']);

    // 2. Fetch recommendations for today
    const resRec = {};
    await routes['GET /api/nutrition/recommendations'](makeReq(`/api/nutrition/recommendations?date=${today}`), resRec);
    assert.equal(resRec.statusCode, 200);
    assert.equal(resRec.data.ok, true);

    const rec = resRec.data.recommendation;
    assert.ok(rec.status);
    assert.ok(rec.message);

    // When insufficient, verify suggestions prioritize available pantry foods!
    if (!rec.is_sufficient) {
      assert.ok(rec.suggestions.length > 0);
      const topSuggestion = rec.suggestions[0];
      assert.equal(topSuggestion.is_in_user_pantry, true, 'Top recommendation is an ingredient the user has in pantry');
    }
  });

  // ==========================================
  // MODULE 6: CHEAT MEAL TRACKER & SUPPORTIVE MESSAGING
  // ==========================================
  await t.test('7. Module 6: Cheat Meal Logging, Daily Summation & Non-judgmental Guidance', async () => {
    const routes = nutritionRoutes(mockHelpers());
    const today = new Date().toISOString().slice(0, 10);

    // Test exceeding target calculation directly
    const aboveImpact = calculateCheatMealImpact(
      { food_name: 'Big Feast', energy_kcal: 800 },
      { calories_consumed: 2300 },
      2000
    );
    assert.equal(aboveImpact.is_above_target, true);
    assert.ok(aboveImpact.supportive_message.includes("One higher-calorie meal does not ruin your progress"));
    assert.ok(aboveImpact.transparent_activity_reference.brisk_walking_min > 0);
    assert.ok(!aboveImpact.supportive_message.toLowerCase().includes('fasting'));
    assert.ok(!aboveImpact.supportive_message.toLowerCase().includes('punishment'));

    // Test API route logging
    reqBody = {
      date: today,
      food_name: 'Hyderabadi Chicken Biryani',
      serving_quantity: 1,
      serving_unit: 'plate',
      serving_grams: 350,
      energy_kcal: 650,
      protein_g: 28,
      notes: 'Weekend dinner with friends'
    };

    const resCheat = {};
    await routes['POST /api/nutrition/cheat-meals/save'](makeReq('/api/nutrition/cheat-meals/save', 'POST', reqBody), resCheat);
    assert.equal(resCheat.statusCode, 201);
    assert.equal(resCheat.data.ok, true);
    assert.ok(resCheat.data.impact);

    // Verify it was added to actual consumption
    const resHealth = {};
    await routes['GET /api/nutrition/health-log'](makeReq(`/api/nutrition/health-log?date=${today}`), resHealth);
    assert.ok(resHealth.data.totals.calories_consumed >= 650);

    // Delete cheat meal
    reqBody = { id: resCheat.data.cheatMeal.id };
    const resDelCheat = {};
    await routes['POST /api/nutrition/cheat-meals/delete'](makeReq('/api/nutrition/cheat-meals/delete', 'POST', reqBody), resDelCheat);
    assert.equal(resDelCheat.statusCode, 200);
  });

  // ==========================================
  // MODULE 7: NUTRITION NOTIFICATIONS
  // ==========================================
  await t.test('8. Module 7: Notification Preferences & Live Daily Activity Triggers', async () => {
    const routes = nutritionRoutes(mockHelpers());
    const today = new Date().toISOString().slice(0, 10);

    // Save preferences
    reqBody = {
      preferences: {
        remind_breakfast: true,
        remind_lunch: true,
        alert_calorie_goal: true,
        alert_protein_target: true
      }
    };
    const resPref = {};
    await routes['POST /api/nutrition/notifications/config'](makeReq('/api/nutrition/notifications/config', 'POST', reqBody), resPref);
    assert.equal(resPref.statusCode, 200);
    assert.equal(resPref.data.preferences.remind_breakfast, true);

    // Check notifications for today
    const resCheck = {};
    await routes['GET /api/nutrition/notifications/check'](makeReq(`/api/nutrition/notifications/check?date=${today}`), resCheck);
    assert.equal(resCheck.statusCode, 200);
    assert.ok(Array.isArray(resCheck.data.notifications));
  });

  // ==========================================
  // MODULE 9: DATA PRIVACY & ACCESS CONTROL
  // ==========================================
  await t.test('9. Module 9: User Isolation & 401 Rejection for Unauthenticated Requests', async () => {
    const routes = nutritionRoutes(mockHelpers());

    // Switch to unauthenticated request
    currentUser = null;
    const resAuth = {};
    await routes['GET /api/nutrition/plans'](makeReq('/api/nutrition/plans'), resAuth);
    assert.equal(resAuth.statusCode, 401);
    assert.equal(resAuth.data.error, 'not signed in');

    const resAuthGoals = {};
    await routes['GET /api/nutrition/goals'](makeReq('/api/nutrition/goals'), resAuthGoals);
    assert.equal(resAuthGoals.statusCode, 401);

    const resAuthDaily = {};
    await routes['GET /api/nutrition/daily-plan'](makeReq('/api/nutrition/daily-plan'), resAuthDaily);
    assert.equal(resAuthDaily.statusCode, 401);
  });
});
