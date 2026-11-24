import test from 'node:test';
import assert from 'node:assert/strict';
import { nutritionRoutes } from '../nutrition/routes.js';
import {
  calculateBmr,
  calculateTdee,
  calculatePersonalizedTargets,
  generateDietPlan,
  modifyDietPlan,
  findFitnessKnowledgeAnswer,
  VERIFIED_FOOD_CATALOG
} from '../nutrition/knowledge.js';
import { parseEntitiesFromText, handleConversationalTurn } from '../nutrition/conversation.js';
import { generateDietPlanPdf } from '../nutrition/pdf_generator.js';
import {
  clearAllNutritionDataForUser,
  saveUserDietPlan,
  getUserDietPlan,
  clearUserConversation,
  addMealLog
} from '../nutrition/db.js';

test('IRONX AI — Advanced Personalized Fitness & Nutrition Intelligence Test Suite', async (t) => {
  const mockUser = {
    id: 'test_user_ironx_ai_' + Date.now(),
    username: 'ironx_tester',
    profile: {
      fullName: 'Iron Tester',
      age: 26,
      sex: 'male',
      heightCm: 175,
      currentWeightKg: 75,
      fitnessGoal: 'fat_loss',
      activityLevel: 'moderate',
      workoutFrequency: '4-5 days/week',
      dietPreferences: 'non_veg'
    }
  };

  // Helper harness for routes
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
  clearUserConversation(mockUser.id);

  // Scenario 1: Entity Extraction from Natural Language
  await t.test('Scenario 1: NLP Entity Extraction parses goals, demographics, diet, and frequency', () => {
    const text1 = 'I want aggressive fat loss, 26 years old, male, 175 cms, 75 kgs, 5-6 days/week, non-veg, 4 meals';
    const e1 = parseEntitiesFromText(text1);
    assert.equal(e1.fitness_goal, 'fat_loss');
    assert.equal(e1.target_rate, 'aggressive');
    assert.equal(e1.age, 26);
    assert.equal(e1.sex, 'male');
    assert.equal(e1.height_cm, 175);
    assert.equal(e1.weight_kg, 75);
    assert.equal(e1.workout_frequency, '5-6 days/week');
    assert.equal(e1.diet_preference, 'non_veg');
    assert.equal(e1.meal_count, 4);

    const text2 = 'build muscle, female, 5ft 4in, 60kg, vegetarian, 3 meals';
    const e2 = parseEntitiesFromText(text2);
    assert.equal(e2.fitness_goal, 'muscle_gain');
    assert.equal(e2.sex, 'female');
    assert.equal(e2.weight_kg, 60);
    assert.equal(e2.height_cm, 163); // 5ft 4in ≈ 162.56 -> 163cm
    assert.equal(e2.diet_preference, 'veg');
    assert.equal(e2.meal_count, 3);
  });

  // Scenario 2: Deterministic BMR & TDEE (Mifflin-St Jeor)
  await t.test('Scenario 2: Validated Mifflin-St Jeor BMR & PAL TDEE calculations', () => {
    // Male: 75kg, 175cm, 26yo
    // BMR = 10(75) + 6.25(175) - 5(26) + 5 = 750 + 1093.75 - 130 + 5 = 1718.75 -> 1719 kcal
    const bmrMale = calculateBmr(75, 175, 26, 'male');
    assert.equal(bmrMale, 1719);

    // Female: 60kg, 163cm, 24yo
    // BMR = 10(60) + 6.25(163) - 5(24) - 161 = 600 + 1018.75 - 120 - 161 = 1337.75 -> 1338 kcal
    const bmrFemale = calculateBmr(60, 163, 24, 'female');
    assert.equal(bmrFemale, 1338);

    // TDEE with moderate activity (1.55)
    const tdeeMale = calculateTdee(bmrMale, 'moderate', '3-4');
    assert.equal(tdeeMale, Math.round(1719 * 1.55)); // 2664 kcal
  });

  // Scenario 3: Calorie Safety Floor Enforcement
  await t.test('Scenario 3: Physiological Calorie Safety Floor Enforced (1200 kcal female, 1500 kcal male)', () => {
    const tinyFemale = {
      age: 45,
      sex: 'female',
      height_cm: 148,
      weight_kg: 42,
      fitness_goal: 'fat_loss',
      target_rate: 'aggressive',
      activity_level: 'sedentary',
      workout_frequency: 'none'
    };
    const targetsF = calculatePersonalizedTargets(tinyFemale);
    assert.ok(targetsF.target_calories >= 1200, `Female target (${targetsF.target_calories}) respects 1200 kcal floor`);

    const tinyMale = {
      age: 50,
      sex: 'male',
      height_cm: 155,
      weight_kg: 50,
      fitness_goal: 'fat_loss',
      target_rate: 'aggressive',
      activity_level: 'sedentary',
      workout_frequency: 'none'
    };
    const targetsM = calculatePersonalizedTargets(tinyMale);
    assert.ok(targetsM.target_calories >= 1500, `Male target (${targetsM.target_calories}) respects 1500 kcal floor`);
  });

  // Scenario 4: Atwater Macro Balance (4P / 4C / 9F)
  await t.test('Scenario 4: Macro calories match target calories within rounding threshold', () => {
    const profile = {
      age: 26,
      sex: 'male',
      height_cm: 175,
      weight_kg: 75,
      fitness_goal: 'fat_loss',
      target_rate: 'moderate',
      activity_level: 'moderate',
      workout_frequency: '3-4 days/week'
    };
    const targets = calculatePersonalizedTargets(profile);
    const macroKcal = (targets.protein_target_g * 4) + (targets.carb_target_g * 4) + (targets.fat_target_g * 9);
    const diff = Math.abs(targets.target_calories - macroKcal);
    assert.ok(diff <= 10, `Macro sum (${macroKcal}) matches total calories (${targets.target_calories}) within 10 kcal`);
    assert.ok(targets.protein_target_g >= 140, 'High protein target maintained');
    assert.ok(targets.fibre_target_g >= 25, 'Adequate fibre prescribed');
  });

  // Scenario 5: Complete 4-Meal South Indian Diet Plan Generation
  await t.test('Scenario 5: Generates authentic South Indian plan with exact portions, states & macros', () => {
    const profile = {
      age: 26,
      sex: 'male',
      height_cm: 175,
      weight_kg: 75,
      fitness_goal: 'fat_loss',
      diet_preference: 'non_veg',
      meal_count: 4
    };
    const targets = calculatePersonalizedTargets(profile);
    const plan = generateDietPlan(profile, targets);

    assert.equal(plan.meal_count, 4);
    assert.equal(plan.meals.length, 4);
    assert.ok(plan.plan_name.toLowerCase().includes('fat loss'));

    // Check breakfast contains South Indian staples
    const breakfast = plan.meals[0];
    assert.ok(breakfast.meal_name.toLowerCase().includes('breakfast'));
    assert.ok(breakfast.items.length >= 2);
    for (const it of breakfast.items) {
      assert.ok((it.serving_grams || it.portion_grams) > 0);
      assert.ok((it.energy_kcal || it.calories) > 0);
      assert.ok(it.prep_state || it.state, 'Food state specified (cooked, raw, boiled)');
    }

    // Daily totals must align with targets
    assert.ok(Math.abs(plan.daily_totals.calories - targets.target_calories) < 200);
    assert.ok(Math.abs(plan.daily_totals.protein_g - targets.protein_target_g) < 25);
  });

  // Scenario 6: 3-Meal and 5-Meal Variant Plan Generation
  await t.test('Scenario 6: Generates valid 3-meal and 5-meal plan structures', () => {
    const profile3 = { age: 28, sex: 'male', height_cm: 170, weight_kg: 70, fitness_goal: 'maintenance', meal_count: 3 };
    const targets3 = calculatePersonalizedTargets(profile3);
    const plan3 = generateDietPlan(profile3, targets3);
    assert.equal(plan3.meals.length, 3);

    const profile5 = { age: 24, sex: 'male', height_cm: 180, weight_kg: 80, fitness_goal: 'muscle_gain', meal_count: 5 };
    const targets5 = calculatePersonalizedTargets(profile5);
    const plan5 = generateDietPlan(profile5, targets5);
    assert.equal(plan5.meals.length, 5);
  });

  // Scenario 7: Interactive Diet Plan Modification ("Replace Idli with Dosa")
  await t.test('Scenario 7: Interactive food substitution recalculates meal and daily totals', () => {
    const profile = { age: 26, sex: 'male', height_cm: 175, weight_kg: 75, fitness_goal: 'fat_loss', diet_preference: 'non_veg', meal_count: 4 };
    const targets = calculatePersonalizedTargets(profile);
    const initialPlan = generateDietPlan(profile, targets);

    const modifiedPlan = modifyDietPlan(initialPlan, 'Replace idli with dosa');
    assert.ok(modifiedPlan.last_modification_note.toLowerCase().includes('dosa'));

    // Verify breakfast now contains Dosa
    const breakfast = modifiedPlan.meals[0];
    const hasDosa = breakfast.items.some(it => (it.food_name || it.name).toLowerCase().includes('dosa'));
    assert.ok(hasDosa, 'Breakfast now contains Dosa');

    // Verify recalculated daily totals are positive and mathematically consistent
    assert.ok(modifiedPlan.daily_totals.calories > 1000);
    assert.ok(modifiedPlan.daily_totals.protein_g > 80);
  });

  // Scenario 8: Interactive Diet Plan Modification ("Make dinner lighter")
  await t.test('Scenario 8: Light dinner modification reduces dinner calories and recalibrates daily totals', () => {
    const profile = { age: 26, sex: 'male', height_cm: 175, weight_kg: 75, fitness_goal: 'fat_loss', diet_preference: 'non_veg', meal_count: 4 };
    const targets = calculatePersonalizedTargets(profile);
    const initialPlan = generateDietPlan(profile, targets);

    const modifiedPlan = modifyDietPlan(initialPlan, 'Make dinner lighter');
    assert.ok(modifiedPlan.last_modification_note.toLowerCase().includes('dinner'));

    const dinner = modifiedPlan.meals.find(m => m.meal_name.toLowerCase().includes('dinner'));
    assert.ok(dinner);
    const dinnerCals = dinner.total_calories || dinner.totals?.calories || 0;
    assert.ok(dinnerCals <= 450, `Dinner calories reduced: ${dinnerCals}`);
  });

  // Scenario 9: Conversational State Machine: Start Over, Step-by-Step, and Confirmation Flow
  await t.test('Scenario 9: Multi-turn conversation onboarding and plan generation', async () => {
    clearUserConversation(mockUser.id);

    // 1. Reset / Start Over
    const turn1 = await handleConversationalTurn({ user: mockUser, message: 'start over' });
    assert.equal(turn1.state, 'collecting_profile');
    assert.ok(turn1.reply.includes('IRONX AI'));

    // 2. Supply goal
    const turn2 = await handleConversationalTurn({ user: mockUser, message: 'I want fat loss' });
    assert.equal(turn2.state, 'collecting_profile');
    assert.ok(turn2.reply.includes('meals') || turn2.missing_field === 'meal_count');

    // 3. Supply meal count -> complete profile triggers summary
    const turn3 = await handleConversationalTurn({ user: mockUser, message: '4 meals' });
    assert.equal(turn3.state, 'awaiting_confirmation');
    assert.ok(turn3.reply.includes('Profile Complete'));

    // 4. Confirm profile -> generates plan
    const turnConfirm = await handleConversationalTurn({ user: mockUser, message: 'yes confirm and generate' });
    assert.equal(turnConfirm.state, 'plan_active');
    assert.ok(turnConfirm.diet_plan);
    assert.equal(turnConfirm.diet_plan.meal_count, 4);
    assert.ok(turnConfirm.reply.includes('Calculated Daily Targets'));

    // Verify persisted in DB
    const savedPlan = getUserDietPlan(mockUser.id);
    assert.ok(savedPlan);
    assert.equal(savedPlan.fitness_goal, 'fat_loss');
  });

  // Scenario 10: Conversational Plan Modification Turn
  await t.test('Scenario 10: Multi-turn modification "Replace idli with dosa"', async () => {
    const turnMod = await handleConversationalTurn({ user: mockUser, message: 'Replace idli with dosa' });
    assert.equal(turnMod.state, 'plan_active');
    assert.equal(turnMod.action, 'plan_modified');
    assert.ok(turnMod.reply.includes('Diet Plan Updated'));
    assert.ok(turnMod.diet_plan.meals[0].items.some(i => (i.food_name || i.name).toLowerCase().includes('dosa')));
  });

  // Scenario 11: Conversational PDF Download Request
  await t.test('Scenario 11: Multi-turn PDF request returns direct download link', async () => {
    const turnPdf = await handleConversationalTurn({ user: mockUser, message: 'Please download my diet plan PDF' });
    assert.equal(turnPdf.state, 'plan_active');
    assert.equal(turnPdf.pdf_ready, true);
    assert.ok(turnPdf.download_url.includes('/api/nutrition/ai/diet-plan/pdf'));
  });

  // Scenario 12: Daily Nutrition Log Coaching Intent
  await t.test('Scenario 12: Daily food coaching queries real logged meals and computes remaining protein', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Add 2 boiled eggs to today's log
    addMealLog({
      user_id: mockUser.id,
      date: today,
      meal_type: 'breakfast',
      food_id: 'INX_STAPLE_EGG_BOILED',
      food_name: 'Boiled Egg (Whole)',
      serving_quantity: 2,
      serving_unit: 'piece',
      energy_kcal: 156,
      protein_g: 12.6,
      carb_g: 1.1,
      fat_g: 10.6
    });

    const turnRemaining = await handleConversationalTurn({ user: mockUser, message: 'How much protein do I still need today?', date: today });
    assert.ok(turnRemaining.reply.includes('remaining today') && turnRemaining.reply.includes('protein'));
    assert.ok(turnRemaining.stats.remainingP > 0);
    assert.ok(turnRemaining.stats.consumedP >= 12);
  });

  // Scenario 13: General Fitness & Nutrition Q&A (Zero external AI dependency)
  await t.test('Scenario 13: Scientific Fitness Q&A returns factual answers for protein, water, eggs, creatine, night carbs', () => {
    const qProtein = findFitnessKnowledgeAnswer('How much protein do I need per day?');
    assert.ok(qProtein.includes('1.6 to 2.2g'));

    const qWater = findFitnessKnowledgeAnswer('How much water should I drink?');
    assert.ok(qWater.includes('35-40 ml'));

    const qEggs = findFitnessKnowledgeAnswer('Is it safe to eat egg yolks every day?');
    assert.ok(qEggs.includes('cholesterol') && qEggs.includes('choline'));

    const qCreatine = findFitnessKnowledgeAnswer('What does creatine do?');
    assert.ok(qCreatine.includes('phosphocreatine') && qCreatine.includes('ATP'));

    const qNightCarbs = findFitnessKnowledgeAnswer('Can I eat carbs at night?');
    assert.ok(qNightCarbs.includes('24-hour'));
  });

  // Scenario 14: PDF Diet Plan Generator
  await t.test('Scenario 14: generateDietPlanPdf produces publication-quality PDF bytes', () => {
    const plan = getUserDietPlan(mockUser.id);
    assert.ok(plan);
    const arrayBuffer = generateDietPlanPdf(plan);
    const pdfBuf = Buffer.from(arrayBuffer);
    assert.ok(Buffer.isBuffer(pdfBuf));
    assert.ok(pdfBuf.length > 10000, `PDF size is valid (${pdfBuf.length} bytes)`);
    // Check PDF magic bytes '%PDF'
    assert.equal(pdfBuf.subarray(0, 4).toString(), '%PDF');
  });

  // Scenario 15: HTTP Endpoints: GET /api/nutrition/ai/diet-plan/current & /pdf
  await t.test('Scenario 15: HTTP Endpoints return active diet plan and stream PDF', async () => {
    const routes = nutritionRoutes(mockHelpers());

    // 1. GET Current Plan
    const resPlan = {};
    await routes['GET /api/nutrition/ai/diet-plan/current'](makeReq('/api/nutrition/ai/diet-plan/current'), resPlan);
    assert.equal(resPlan.statusCode, 200);
    assert.equal(resPlan.data.ok, true);
    assert.ok(resPlan.data.plan);

    // 2. GET PDF Stream
    let headersSent = {};
    let writtenBuf = null;
    const mockResPdf = {
      writeHead: (status, headers) => {
        mockResPdf.statusCode = status;
        headersSent = headers;
      },
      end: (buf) => {
        writtenBuf = buf;
      }
    };
    await routes['GET /api/nutrition/ai/diet-plan/pdf'](makeReq('/api/nutrition/ai/diet-plan/pdf'), mockResPdf);
    assert.equal(mockResPdf.statusCode, 200);
    assert.equal(headersSent['Content-Type'], 'application/pdf');
    assert.ok(Buffer.isBuffer(writtenBuf));
    assert.ok(writtenBuf.length > 10000);
  });

  // Scenario 16: 1-Click Log Plan Meals to Today's Health Log
  await t.test('Scenario 16: POST /api/nutrition/ai/diet-plan/log-to-today logs all plan items into user daily log', async () => {
    const routes = nutritionRoutes(mockHelpers());
    const today = new Date().toISOString().slice(0, 10);
    reqBody = { date: today };

    const resLog = {};
    await routes['POST /api/nutrition/ai/diet-plan/log-to-today'](makeReq('/api/nutrition/ai/diet-plan/log-to-today', 'POST', reqBody), resLog);
    assert.equal(resLog.statusCode, 200);
    assert.equal(resLog.data.ok, true);
    assert.ok(resLog.data.logged_items_count >= 4, `Logged ${resLog.data.logged_items_count} items into today's log`);
  });
});
