import test from 'node:test';
import assert from 'node:assert/strict';
import { nutritionRoutes } from '../nutrition/routes.js';
import { clearAllNutritionDataForUser } from '../nutrition/db.js';

test('IRONX Smart Nutrition & AI Coach: Comprehensive Backend Verification', async (t) => {
  const userA = { id: 'test_user_a_' + Date.now(), email: 'usera@example.com' };
  const userB = { id: 'test_user_b_' + Date.now(), email: 'userb@example.com' };
  let currentUser = userA;
  let requestBody = {};

  const mockJson = (res, status, data) => {
    res.statusCode = status;
    res.data = data;
    return res;
  };

  const getRoutes = () => nutritionRoutes({
    json: mockJson,
    readBody: async () => requestBody,
    readSession: () => currentUser
  });

  t.after(() => {
    clearAllNutritionDataForUser(userA.id);
    clearAllNutritionDataForUser(userB.id);
  });

  // 1. PART 1: Search food and 0 kcal fix
  await t.test('Food Search returns Wheat Roti / Chapati with non-zero verified calories and macros', async () => {
    const routes = getRoutes();
    const req = { url: 'http://localhost/api/nutrition/search?q=chapathi' };
    const res = {};
    await routes['GET /api/nutrition/search'](req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.data.ok);
    assert.ok(res.data.foods.length > 0);
    const roti = res.data.foods.find(f => f.name.toLowerCase().includes('roti') || f.name.toLowerCase().includes('chapati'));
    assert.ok(roti, 'Found Wheat Roti');
    assert.equal(roti.calories, 297, '100g roti has 297 kcal (not 0 kcal)');
    assert.equal(roti.protein, 9);
    assert.equal(roti.carbs, 58);
    assert.equal(roti.fat, 3.5);
    assert.equal(roti.category, 'Cereals and Millets');
  });

  await t.test('Tamil Food Search: "சப்பாத்தி" finds Wheat Roti', async () => {
    const routes = getRoutes();
    const req = { url: 'http://localhost/api/nutrition/search?q=' + encodeURIComponent('சப்பாத்தி') };
    const res = {};
    await routes['GET /api/nutrition/search'](req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.data.foods.length > 0);
    const roti = res.data.foods.find(f => f.name.toLowerCase().includes('roti') || f.name.toLowerCase().includes('chapati'));
    assert.ok(roti, 'Tamil search சப்பாத்தி matched Wheat Roti');
  });

  // 2. PART 2: Food CRUD and permanent deletion
  let savedFoodId = null;
  await t.test('Permanent Food Add & Edit in MongoDB/SQLite scoped to user', async () => {
    const routes = getRoutes();
    requestBody = {
      meal_type: 'breakfast',
      food_name: 'Wheat Roti / Chapati (Cooked)',
      serving_quantity: 2,
      serving_unit: 'piece',
      serving_grams: 70,
      energy_kcal: 208,
      protein_g: 6.2,
      carb_g: 40.6,
      fat_g: 2.4,
      date: '2026-11-23'
    };
    const resAdd = {};
    await routes['POST /api/nutrition/food/save']({}, resAdd);
    assert.equal(resAdd.statusCode, 201);
    assert.ok(resAdd.data.ok);
    savedFoodId = resAdd.data.entry.id;
    assert.ok(savedFoodId);

    // Edit quantity to 3 pieces
    requestBody = {
      id: savedFoodId,
      meal_type: 'breakfast',
      food_name: 'Wheat Roti / Chapati (Cooked)',
      serving_quantity: 3,
      serving_unit: 'piece',
      serving_grams: 105,
      energy_kcal: 312,
      protein_g: 9.3,
      carb_g: 60.9,
      fat_g: 3.6,
      date: '2026-11-23'
    };
    const resEdit = {};
    await routes['POST /api/nutrition/food/save']({}, resEdit);
    assert.ok(resEdit.statusCode === 200 || resEdit.statusCode === 201);
    assert.equal(resEdit.data.entry.serving_quantity, 3);
    assert.equal(resEdit.data.entry.energy_kcal, 312);
  });

  await t.test('Permanent Food Deletion: deleted item never reappears and cannot be deleted by other users', async () => {
    // Attempt deletion by User B (unauthorized cross-account deletion)
    currentUser = userB;
    let routes = getRoutes();
    requestBody = { id: savedFoodId };
    const resHack = {};
    await routes['POST /api/nutrition/food/delete']({}, resHack);
    assert.equal(resHack.statusCode, 200);
    assert.equal(resHack.data.ok, false, 'User B cannot delete User A food');

    // Authorized deletion by User A
    currentUser = userA;
    routes = getRoutes();
    const resDel = {};
    await routes['POST /api/nutrition/food/delete']({}, resDel);
    assert.equal(resDel.statusCode, 200);
    assert.equal(resDel.data.ok, true, 'User A deleted food');

    // Confirm it is absent from health-log
    const resLog = {};
    await routes['GET /api/nutrition/health-log']({ url: 'http://localhost/api/nutrition/health-log?date=2026-11-23' }, resLog);
    assert.equal(resLog.statusCode, 200);
    const found = (resLog.data.foods || []).find(f => f.id === savedFoodId);
    assert.equal(found, undefined, 'Deleted food entry is permanently removed');
  });

  // 3. PART 4 & 5: Meal Templates & Repeat Previous Meals
  await t.test('Meal Templates & Repeat Meals: Save, list, and delete custom meal templates', async () => {
    currentUser = userA;
    const routes = getRoutes();

    // First save 2 foods to create previous meal history
    requestBody = {
      entries: [
        { meal_type: 'breakfast', food_name: 'Idli', serving_quantity: 3, serving_unit: 'piece', energy_kcal: 150, protein_g: 6, carb_g: 30, fat_g: 1 },
        { meal_type: 'breakfast', food_name: 'Sambar', serving_quantity: 1, serving_unit: 'bowl', energy_kcal: 90, protein_g: 3, carb_g: 15, fat_g: 2 }
      ],
      date: '2026-11-22'
    };
    await routes['POST /api/nutrition/food/save-batch']({}, {});

    // Check repeat previous meals
    const resPrev = {};
    await routes['GET /api/nutrition/previous-meals']({}, resPrev);
    assert.equal(resPrev.statusCode, 200);
    assert.ok(resPrev.data.breakfast.length > 0, 'Previous breakfast found');
    assert.equal(resPrev.data.breakfast[0].items.length, 2);

    // Save as Custom Meal Template
    requestBody = {
      name: 'South Indian Idli + Sambar Breakfast',
      meal_type: 'breakfast',
      items: [
        { food_name: 'Idli', serving_quantity: 3, serving_unit: 'piece', energy_kcal: 150, protein_g: 6, carb_g: 30, fat_g: 1 },
        { food_name: 'Sambar', serving_quantity: 1, serving_unit: 'bowl', energy_kcal: 90, protein_g: 3, carb_g: 15, fat_g: 2 }
      ],
      notes: 'Classic breakfast'
    };
    const resTpl = {};
    await routes['POST /api/nutrition/templates']({}, resTpl);
    assert.equal(resTpl.statusCode, 200);
    assert.ok(resTpl.data.template.id);
    assert.equal(resTpl.data.template.total_calories, 240);

    // List templates
    const resList = {};
    await routes['GET /api/nutrition/templates']({}, resList);
    assert.equal(resList.statusCode, 200);
    assert.ok(resList.data.templates.length > 0);
    const tplId = resTpl.data.template.id;

    // Delete template
    requestBody = { id: tplId };
    const resDelTpl = {};
    await routes['POST /api/nutrition/templates/delete']({}, resDelTpl);
    assert.equal(resDelTpl.statusCode, 200);
    assert.equal(resDelTpl.data.ok, true);
  });

  // 4. PART 6: Raw Ingredient Recipe Builder
  await t.test('Raw Ingredient Recipe Builder with Cooking Oil & Yield Calculations', async () => {
    currentUser = userA;
    const routes = getRoutes();

    requestBody = {
      name: 'Onion Tomato Egg Gravy',
      ingredients: [
        { name: 'Eggs (Raw)', grams: 150, energy_kcal: 214, protein_g: 18.9, carb_g: 1.1, fat_g: 14.8 },
        { name: 'Onion (Raw)', grams: 100, energy_kcal: 40, protein_g: 1.1, carb_g: 9.3, fat_g: 0.1 },
        { name: 'Tomato (Raw)', grams: 100, energy_kcal: 18, protein_g: 0.9, carb_g: 3.9, fat_g: 0.2 }
      ],
      oil_grams: 15, // 15g oil = ~133 kcal, 15g fat
      total_raw_weight_g: 365,
      cooked_weight_g: 300,
      servings: 2,
      notes: 'Delicious high-protein egg curry'
    };

    const resRcp = {};
    await routes['POST /api/nutrition/recipes']({}, resRcp);
    assert.equal(resRcp.statusCode, 200);
    assert.ok(resRcp.data.ok);
    const rcp = resRcp.data.recipe;
    assert.ok(rcp.total_calories > 350, 'Includes cooking oil in total calories');
    assert.ok(rcp.per_serving_calories > 150);
    assert.ok(rcp.per_100g_calories > 100);

    // List recipes
    const resListRcp = {};
    await routes['GET /api/nutrition/recipes']({}, resListRcp);
    assert.equal(resListRcp.statusCode, 200);
    assert.ok(resListRcp.data.recipes.length > 0);

    // Delete recipe
    requestBody = { id: rcp.id };
    const resDelRcp = {};
    await routes['POST /api/nutrition/recipes/delete']({}, resDelRcp);
    assert.equal(resDelRcp.statusCode, 200);
    assert.equal(resDelRcp.data.ok, true);
  });

  // 5. PART 7 & 8: Nutrition Targets Calculator
  await t.test('Calculates personalized BMR/TDEE targets deterministically', async () => {
    currentUser = userA;
    const routes = getRoutes();

    // Calculate targets
    requestBody = {
      age: 26,
      sex: 'male',
      height_cm: 178,
      weight_kg: 76,
      activity_level: 'moderate',
      fitness_goal: 'fat_loss',
      target_rate: 'moderate',
      diet_preference: 'non_veg'
    };
    const resTargets = {};
    await routes['POST /api/nutrition/coach/targets']({}, resTargets);
    assert.equal(resTargets.statusCode, 200);
    assert.ok(resTargets.data.ok);
    const calc = resTargets.data.calculation;
    assert.ok(calc.bmr > 1600 && calc.bmr < 1850, `BMR is realistic: ${calc.bmr}`);
    assert.ok(calc.tdee > 2500 && calc.tdee < 2900, `TDEE is realistic: ${calc.tdee}`);
    assert.ok(calc.target_calories < calc.tdee, 'Target calories reflects calorie deficit');
    assert.ok(calc.protein_g >= 140, 'Adequate protein for fat loss');
    // Internal consistency check
    const diff = Math.abs(calc.target_calories - calc.macro_kcal_sum);
    assert.ok(diff <= 15, `Calorie contribution from macros (${calc.macro_kcal_sum}) matches target (${calc.target_calories}) within rounding`);
  });
});
