import test from 'node:test';
import assert from 'node:assert/strict';
import { nutritionRoutes } from '../nutrition/routes.js';
import { searchFoods, getFoodById, searchVerifiedFoods, searchVerifiedRecipes, getVerifiedRecipeById } from '../nutrition/db.js';
import { clearAllNutritionDataForUser } from '../nutrition/db.js';

test('IRONX — Food Nutrition Dataset & Simple Lookup System Verification', async (t) => {
  const mockUser = {
    id: 'test_dataset_user_' + Date.now(),
    username: 'dataset_tester',
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

  // Cleanup before starting
  clearAllNutritionDataForUser(mockUser.id);

  // 1. Requirement 1 & 2: Search for Chapathi and retrieve its exact dataset values
  await t.test('1. Search for Chapathi and retrieve its exact verified dataset values', async () => {
    const routes = nutritionRoutes(mockHelpers());
    const res = {};
    await routes['GET /api/nutrition/search'](makeReq('/api/nutrition/search?q=chapathi'), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.data.ok, true);
    assert.ok(res.data.foods.length > 0, 'Found chapathi in dataset');

    const chapathi = res.data.foods[0];
    assert.ok(chapathi.name.toLowerCase().includes('roti') || chapathi.name.toLowerCase().includes('chapati'));
    assert.equal(chapathi.calories, 297, 'Exact dataset calories (297 kcal per 100g)');
    assert.equal(chapathi.protein, 9, 'Exact dataset protein (9g per 100g)');
    assert.equal(chapathi.carbs, 58, 'Exact dataset carbs (58g per 100g)');
    assert.equal(chapathi.fat, 3.5, 'Exact dataset fat (3.5g per 100g)');
    assert.equal(chapathi.fibre, 8, 'Exact dataset fiber (8g per 100g)');
    assert.equal(chapathi.category, 'Cereals and Millets');
    assert.equal(chapathi.prep_state, 'cooked');
    assert.equal(chapathi.serving_basis_g, 100);

    // Also check via searchVerifiedFoods
    const verifiedMatches = searchVerifiedFoods({ query: 'Chapathi', limit: 1 });
    assert.ok(verifiedMatches.length > 0);
    assert.equal(verifiedMatches[0].energy_kcal, 297);
    assert.equal(verifiedMatches[0].protein_g, 9);
    assert.equal(verifiedMatches[0].carb_g, 58);
    assert.equal(verifiedMatches[0].fat_g, 3.5);
    assert.equal(verifiedMatches[0].fibre_g, 8);
    assert.equal(verifiedMatches[0].food_state, 'cooked');
  });

  // 2. Requirement 2: Search for other existing foods and verify calories, protein, carbs, fat, fiber
  await t.test('2. Search other existing foods (Rice, Egg, Chicken, Dosa, Paneer, Apple) and verify dataset macros', async () => {
    const routes = nutritionRoutes(mockHelpers());

    // Rice
    const resRice = {};
    await routes['GET /api/nutrition/search'](makeReq('/api/nutrition/search?q=rice'), resRice);
    assert.ok(resRice.data.foods.length > 0);
    const rice = resRice.data.foods.find(f => f.name.toLowerCase().includes('steamed') || f.name.toLowerCase().includes('cooked'));
    assert.ok(rice, 'Found steamed rice');
    assert.equal(rice.calories, 130, 'Rice: 130 kcal per 100g');
    assert.equal(rice.protein, 2.7, 'Rice: 2.7g protein per 100g');
    assert.equal(rice.carbs, 28.2, 'Rice: 28.2g carbs per 100g');
    assert.equal(rice.fat, 0.3, 'Rice: 0.3g fat per 100g');
    assert.equal(rice.fibre, 0.4, 'Rice: 0.4g fiber per 100g');
    assert.equal(rice.prep_state, 'cooked');

    // Egg (Boiled Whole Egg)
    const resEgg = {};
    await routes['GET /api/nutrition/search'](makeReq('/api/nutrition/search?q=boiled+egg'), resEgg);
    assert.ok(resEgg.data.foods.length > 0);
    const egg = resEgg.data.foods[0];
    assert.equal(egg.calories, 143, 'Boiled egg: 143 kcal per 100g');
    assert.equal(egg.protein, 12.6, 'Boiled egg: 12.6g protein per 100g');
    assert.equal(egg.carbs, 0.7, 'Boiled egg: 0.7g carbs per 100g');
    assert.equal(egg.fat, 9.5, 'Boiled egg: 9.5g fat per 100g');
    assert.equal(egg.prep_state, 'boiled');

    // Chicken (Cooked Chicken Breast)
    const resChicken = {};
    await routes['GET /api/nutrition/search'](makeReq('/api/nutrition/search?q=chicken+breast'), resChicken);
    assert.ok(resChicken.data.foods.length > 0);
    const chicken = resChicken.data.foods[0];
    assert.equal(chicken.calories, 165, 'Chicken breast: 165 kcal per 100g');
    assert.equal(chicken.protein, 31, 'Chicken breast: 31g protein per 100g');
    assert.equal(chicken.carbs, 0, 'Chicken breast: 0g carbs per 100g');
    assert.equal(chicken.fat, 3.6, 'Chicken breast: 3.6g fat per 100g');
    assert.equal(chicken.prep_state, 'cooked');

    // Dosa (Plain Dosa)
    const resDosa = {};
    await routes['GET /api/nutrition/search'](makeReq('/api/nutrition/search?q=plain+dosa'), resDosa);
    assert.ok(resDosa.data.foods.length > 0);
    const dosa = resDosa.data.foods[0];
    assert.equal(dosa.calories, 168, 'Plain dosa: 168 kcal per 100g');
    assert.equal(dosa.protein, 4.2, 'Plain dosa: 4.2g protein per 100g');
    assert.equal(dosa.carbs, 28, 'Plain dosa: 28g carbs per 100g');
    assert.equal(dosa.fat, 4.5, 'Plain dosa: 4.5g fat per 100g');
    assert.equal(dosa.prep_state, 'cooked');

    // Paneer
    const resPaneer = {};
    await routes['GET /api/nutrition/search'](makeReq('/api/nutrition/search?q=paneer'), resPaneer);
    assert.ok(resPaneer.data.foods.length > 0);
    const paneer = resPaneer.data.foods[0];
    assert.equal(paneer.calories, 265, 'Paneer: 265 kcal per 100g');
    assert.equal(paneer.protein, 18.3, 'Paneer: 18.3g protein per 100g');
    assert.equal(paneer.carbs, 1.2, 'Paneer: 1.2g carbs per 100g');
    assert.equal(paneer.fat, 20.8, 'Paneer: 20.8g fat per 100g');
    assert.equal(paneer.prep_state, 'fresh');

    // Apple
    const resApple = {};
    await routes['GET /api/nutrition/search'](makeReq('/api/nutrition/search?q=apple'), resApple);
    assert.ok(resApple.data.foods.length > 0);
    const apple = resApple.data.foods[0];
    assert.equal(apple.calories, 52, 'Apple: 52 kcal per 100g');
    assert.equal(apple.protein, 0.3, 'Apple: 0.3g protein per 100g');
    assert.equal(apple.carbs, 13.8, 'Apple: 13.8g carbs per 100g');
    assert.equal(apple.fat, 0.2, 'Apple: 0.2g fat per 100g');
    assert.equal(apple.fibre, 2.4, 'Apple: 2.4g fiber per 100g');
    assert.equal(apple.prep_state, 'raw');
  });

  // 3. Requirement 3 & 4: Missing foods return a clear not-found message ("Food not found in dataset.")
  await t.test('3. Missing foods return clear "Food not found in dataset." message without fabricating numbers', async () => {
    const routes = nutritionRoutes(mockHelpers());

    // Search nonexistent food
    const resMissing = {};
    await routes['GET /api/nutrition/search'](makeReq('/api/nutrition/search?q=completelynonexistentitem9999'), resMissing);
    assert.equal(resMissing.statusCode, 200);
    assert.equal(resMissing.data.ok, true);
    assert.equal(resMissing.data.count, 0);
    assert.equal(resMissing.data.foods.length, 0);
    assert.equal(resMissing.data.message, 'Food not found in dataset.');

    // Direct food lookup by nonexistent id
    const resMissingId = {};
    await routes['GET /api/nutrition/food'](makeReq('/api/nutrition/food?id=nonexistent_id_404'), resMissingId);
    assert.equal(resMissingId.statusCode, 404);
    assert.equal(resMissingId.data.ok, false);
    assert.equal(resMissingId.data.error, 'Food not found in dataset.');

    // Verified foods lookup by nonexistent query
    const resMissingVerified = {};
    await routes['GET /api/nutrition/foods'](makeReq('/api/nutrition/foods?q=nonexistent_food_xyz'), resMissingVerified);
    assert.equal(resMissingVerified.statusCode, 200);
    assert.equal(resMissingVerified.data.count, 0);
    assert.equal(resMissingVerified.data.message, 'Food not found in dataset.');
  });

  // 4. Requirement 5: Meal logging continues to work reliably
  await t.test('4. Meal logging works: save meal, get health log, calculate totals, and delete', async () => {
    const routes = nutritionRoutes(mockHelpers());
    const today = new Date().toISOString().slice(0, 10);

    // Log Breakfast: 2 Chapatis (70g)
    reqBody = {
      date: today,
      meal_type: 'breakfast',
      food_id: 'STAPLE:roti',
      food_name: 'Wheat Roti / Chapati (Cooked)',
      serving_quantity: 2,
      serving_unit: 'piece',
      serving_grams: 70,
      energy_kcal: 208,
      protein_g: 6.3,
      carb_g: 40.6,
      fat_g: 2.5,
      fibre_g: 5.6
    };
    const resSave = {};
    await routes['POST /api/nutrition/food/save'](makeReq('/api/nutrition/food/save', 'POST', reqBody), resSave);
    assert.ok(resSave.statusCode === 200 || resSave.statusCode === 201);
    assert.equal(resSave.data.ok, true);
    assert.ok(resSave.data.entry?.id);
    const loggedFoodId = resSave.data.entry.id;

    // Log Water: 500 ml
    reqBody = {
      date: today,
      amount_ml: 500
    };
    const resWater = {};
    await routes['POST /api/nutrition/water/save'](makeReq('/api/nutrition/water/save', 'POST', reqBody), resWater);
    assert.ok(resWater.statusCode === 200 || resWater.statusCode === 201);
    assert.equal(resWater.data.ok, true);

    // Verify Health Log
    const resHealth = {};
    await routes['GET /api/nutrition/health-log'](makeReq(`/api/nutrition/health-log?date=${today}`), resHealth);
    assert.equal(resHealth.statusCode, 200);
    assert.equal(resHealth.data.ok, true);
    assert.equal(resHealth.data.foods.length, 1);
    assert.equal(resHealth.data.totals.calories_consumed, 208);
    assert.equal(resHealth.data.totals.protein_g, 6.3);
    assert.equal(resHealth.data.totals.water_ml, 500);

    // Delete Logged Food
    reqBody = { id: loggedFoodId };
    const resDel = {};
    await routes['POST /api/nutrition/food/delete'](makeReq('/api/nutrition/food/delete', 'POST', reqBody), resDel);
    assert.equal(resDel.statusCode, 200);
    assert.equal(resDel.data.ok, true);
  });

  // 5. Requirement 1 & 4: Verify Zero AI routes or LLM endpoints exist
  await t.test('5. Verify AI routes (coach/chat, ai-parse, ai/diet-plan, parse-nl) are completely removed', () => {
    const routes = nutritionRoutes(mockHelpers());

    assert.equal(routes['POST /api/nutrition/ai-parse'], undefined, 'POST /api/nutrition/ai-parse is deleted');
    assert.equal(routes['POST /api/nutrition/coach/chat'], undefined, 'POST /api/nutrition/coach/chat is deleted');
    assert.equal(routes['GET /api/nutrition/ai/diet-plan/current'], undefined, 'GET /api/nutrition/ai/diet-plan/current is deleted');
    assert.equal(routes['POST /api/nutrition/ai/diet-plan/generate'], undefined, 'POST /api/nutrition/ai/diet-plan/generate is deleted');
    assert.equal(routes['POST /api/nutrition/ai/diet-plan/modify'], undefined, 'POST /api/nutrition/ai/diet-plan/modify is deleted');
    assert.equal(routes['GET /api/nutrition/ai/diet-plan/pdf'], undefined, 'GET /api/nutrition/ai/diet-plan/pdf is deleted');
    assert.equal(routes['POST /api/nutrition/ai/diet-plan/log-to-today'], undefined, 'POST /api/nutrition/ai/diet-plan/log-to-today is deleted');
    assert.equal(routes['POST /api/nutrition/ai/conversation/reset'], undefined, 'POST /api/nutrition/ai/conversation/reset is deleted');
    assert.equal(routes['POST /api/nutrition/ai/parse-nl'], undefined, 'POST /api/nutrition/ai/parse-nl is deleted');
  });
});
