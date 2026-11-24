/**
 * IRONX AI — Structured Fitness & Nutrition Knowledge Engine
 * Deterministic BMR/TDEE calculations, validated Atwater macro distribution,
 * South Indian food composition intelligence, and diet plan generator.
 * Zero external AI API dependency.
 */

// 1. Validated BMR (Mifflin-St Jeor) and TDEE Calculators
export function calculateBmr(weightKg, heightCm, age, sex = 'male') {
  const w = Number(weightKg);
  const h = Number(heightCm);
  const a = Number(age);
  if (!w || !h || !a) return 1600;

  let bmr = (10 * w) + (6.25 * h) - (5 * a);
  if (String(sex).toLowerCase() === 'female') {
    bmr -= 161;
  } else {
    bmr += 5;
  }
  return Math.round(bmr);
}

export function calculateTdee(bmr, activityLevel = 'moderate', workoutFrequency = '3-4') {
  const act = String(activityLevel).toLowerCase();
  const freq = String(workoutFrequency).toLowerCase();

  let multiplier = 1.45;
  if (act.includes('sedentary') || freq.includes('no regular') || freq === '0') {
    multiplier = 1.2;
  } else if (act.includes('light') || freq.includes('1-2')) {
    multiplier = 1.375;
  } else if (act.includes('moderate') || freq.includes('3-4')) {
    multiplier = 1.55;
  } else if (act.includes('very') || freq.includes('5-6')) {
    multiplier = 1.725;
  } else if (act.includes('extreme') || act.includes('athlete') || freq.includes('daily')) {
    multiplier = 1.9;
  }

  return Math.round(bmr * multiplier);
}

export function calculatePersonalizedTargets(profile) {
  const age = Number(profile.age || 26);
  const sex = String(profile.sex || 'male').toLowerCase();
  const heightCm = Number(profile.height_cm || profile.height || 175);
  const weightKg = Number(profile.weight_kg || profile.weight || 75);
  const goal = String(profile.fitness_goal || profile.goal || 'fat_loss').toLowerCase();
  const rate = String(profile.target_rate || profile.rate || 'moderate').toLowerCase();
  const activity = String(profile.activity_level || 'moderate').toLowerCase();
  const workoutFreq = String(profile.workout_frequency || '3-4 days/week');
  const diet = String(profile.diet_preference || profile.diet || 'non_veg').toLowerCase();

  const bmr = calculateBmr(weightKg, heightCm, age, sex);
  const tdee = calculateTdee(bmr, activity, workoutFreq);

  let delta = 0;
  let explanation = '';
  let safetyNotes = '';
  let expectedWeeklyChangeKg = 0;

  if (goal.includes('fat') || goal.includes('cut') || goal.includes('loss')) {
    if (rate.includes('conservative')) {
      delta = -Math.round(tdee * 0.12);
      expectedWeeklyChangeKg = 0.3;
      explanation = 'Conservative fat-loss deficit (~12% deficit). Preserves maximum strength, hormone balance, and training energy.';
    } else if (rate.includes('aggressive')) {
      delta = -Math.round(tdee * 0.25);
      expectedWeeklyChangeKg = 0.7;
      explanation = 'Aggressive fat-loss deficit (~25% deficit). Recommended only for short durations with high protein intake.';
    } else {
      delta = -Math.round(tdee * 0.20);
      expectedWeeklyChangeKg = 0.5;
      explanation = 'Moderate fat-loss deficit (~20% deficit). Evidence-based golden standard for steady fat loss and muscle preservation.';
    }
  } else if (goal.includes('muscle') || goal.includes('bulk') || goal.includes('gain')) {
    if (rate.includes('conservative')) {
      delta = Math.round(tdee * 0.08);
      expectedWeeklyChangeKg = 0.2;
      explanation = 'Conservative hypertrophy surplus (+8% surplus). Minimal fat accrual while fueling progressive overload.';
    } else {
      delta = Math.round(tdee * 0.15);
      expectedWeeklyChangeKg = 0.35;
      explanation = 'Moderate lean hypertrophy surplus (+15% surplus). Optimizes muscle protein synthesis and recovery.';
    }
  } else if (goal.includes('recomp')) {
    delta = -Math.round(tdee * 0.05);
    expectedWeeklyChangeKg = 0.1;
    explanation = 'Body recomposition (simultaneous fat loss & muscle gain). Mild 5% deficit with prioritized protein density.';
  } else {
    delta = 0;
    expectedWeeklyChangeKg = 0.0;
    explanation = 'Maintenance energy balance. Stabilizes weight while supporting fitness performance.';
  }

  // Safe physiological floors
  const minFloor = sex === 'female' ? 1200 : 1500;
  let targetCalories = tdee + delta;
  if (targetCalories < minFloor) {
    targetCalories = minFloor;
    delta = minFloor - tdee;
    safetyNotes = `Target adjusted to safe physiological baseline of ${minFloor} kcal to prevent metabolic slowdown.`;
  }

  // Protein targets: 1.6 to 2.2 g/kg depending on goal
  let proteinMultiplier = 1.8;
  if (goal.includes('fat') || goal.includes('recomp')) proteinMultiplier = 2.0;
  else if (goal.includes('muscle')) proteinMultiplier = 1.8;
  else proteinMultiplier = 1.6;

  const proteinG = Math.round(weightKg * proteinMultiplier);
  const proteinKcal = proteinG * 4;

  // Fat: 25% of total calories (or at least 0.7 g/kg)
  let fatG = Math.max(Math.round(weightKg * 0.7), Math.round((targetCalories * 0.25) / 9));
  let fatKcal = fatG * 9;

  // Carbs: Remaining calories
  let carbKcal = Math.max(0, targetCalories - proteinKcal - fatKcal);
  let carbG = Math.round(carbKcal / 4);

  // Fibre: 14g per 1000 kcal
  const fibreG = Math.max(28, Math.round((targetCalories / 1000) * 14));

  return {
    bmr,
    tdee,
    target_calories: targetCalories,
    deficit_or_surplus_kcal: delta,
    expected_weekly_change_kg: expectedWeeklyChangeKg,
    protein_target_g: proteinG,
    carb_target_g: carbG,
    fat_target_g: fatG,
    fibre_target_g: fibreG,
    macro_kcal_sum: (proteinG * 4) + (carbG * 4) + (fatG * 9),
    explanation,
    safety_notes: safetyNotes || null
  };
}

// 2. Verified South Indian & Indian Food Ingredients Catalog
export const VERIFIED_FOOD_CATALOG = {
  // Breakfast Items
  idli: {
    id: 'INX_STAPLE_IDLI_COOKED',
    name: 'Steamed Idli (Cooked)',
    name_tamil: 'இட்லி',
    unit: 'piece',
    unit_g: 50,
    kcal_per_100g: 116,
    protein_per_100g: 4.0,
    carb_per_100g: 24.0,
    fat_per_100g: 0.4,
    fibre_per_100g: 1.8,
    prep_state: 'steamed',
    source: 'ICMR-NIN 2017'
  },
  dosa: {
    id: 'INX_STAPLE_DOSA_COOKED',
    name: 'Plain Dosa (Cooked)',
    name_tamil: 'தோசை',
    unit: 'piece',
    unit_g: 80,
    kcal_per_100g: 166,
    protein_per_100g: 4.1,
    carb_per_100g: 27.5,
    fat_per_100g: 4.6,
    fibre_per_100g: 1.9,
    prep_state: 'cooked',
    source: 'ICMR-NIN 2017'
  },
  chapati: {
    id: 'INX_STAPLE_ROTI_COOKED',
    name: 'Wheat Roti / Chapati (Cooked)',
    name_tamil: 'சப்பாத்தி',
    unit: 'piece',
    unit_g: 35,
    kcal_per_100g: 297,
    protein_per_100g: 9.0,
    carb_per_100g: 58.0,
    fat_per_100g: 3.4,
    fibre_per_100g: 8.0,
    prep_state: 'cooked',
    source: 'ICMR-NIN 2017'
  },
  boiled_egg: {
    id: 'INX_STAPLE_EGG_BOILED',
    name: 'Boiled Egg (Whole)',
    name_tamil: 'வேகவைத்த முட்டை',
    unit: 'piece',
    unit_g: 50,
    kcal_per_100g: 140,
    protein_per_100g: 12.6,
    carb_per_100g: 0.8,
    fat_per_100g: 9.6,
    fibre_per_100g: 0.0,
    prep_state: 'boiled',
    source: 'USDA FoodData Central'
  },
  egg_white: {
    id: 'INX_FOOD_USDA_1124',
    name: 'Egg White (Boiled)',
    name_tamil: 'முட்டை வெள்ளைக்கரு',
    unit: 'piece',
    unit_g: 33,
    kcal_per_100g: 52,
    protein_per_100g: 10.9,
    carb_per_100g: 0.7,
    fat_per_100g: 0.2,
    fibre_per_100g: 0.0,
    prep_state: 'boiled',
    source: 'USDA FoodData Central'
  },
  egg_bhurji: {
    id: 'STAPLE:egg_bhurji',
    name: 'Egg Bhurji (2 Eggs + Onion-Tomato)',
    name_tamil: 'முட்டை பொரியல்',
    unit: 'serving',
    unit_g: 120,
    kcal_per_100g: 150,
    protein_per_100g: 10.8,
    carb_per_100g: 3.3,
    fat_per_100g: 10.0,
    fibre_per_100g: 0.8,
    prep_state: 'cooked',
    source: 'INDB Recipe Verified'
  },
  sambar: {
    id: 'INX_RECIPE_OSR001',
    name: 'Mixed Vegetable Sambar',
    name_tamil: 'சாம்பார்',
    unit: 'katori / cup',
    unit_g: 150,
    kcal_per_100g: 63,
    protein_per_100g: 2.5,
    carb_per_100g: 9.5,
    fat_per_100g: 1.6,
    fibre_per_100g: 2.1,
    prep_state: 'cooked',
    source: 'ICMR-NIN & INDB'
  },
  sundal: {
    id: 'INX_FOOD_INDB_C005',
    name: 'Green Gram Sundal (Cooked)',
    name_tamil: 'பாசிப்பயறு சுண்டல்',
    unit: 'cup',
    unit_g: 100,
    kcal_per_100g: 145,
    protein_per_100g: 9.5,
    carb_per_100g: 22.0,
    fat_per_100g: 2.0,
    fibre_per_100g: 5.5,
    prep_state: 'boiled',
    source: 'ICMR-NIN 2017'
  },

  // Lunch Items
  cooked_rice: {
    id: 'INX_STAPLE_RICE_COOKED',
    name: 'Cooked Rice (Steamed)',
    name_tamil: 'சாதம்',
    unit: 'g',
    unit_g: 150,
    kcal_per_100g: 130,
    protein_per_100g: 2.7,
    carb_per_100g: 28.2,
    fat_per_100g: 0.3,
    fibre_per_100g: 0.4,
    prep_state: 'cooked',
    source: 'ICMR-NIN 2017'
  },
  chicken_breast: {
    id: 'INX_STAPLE_CHICKEN_COOKED',
    name: 'Chicken Breast (Cooked / Grilled)',
    name_tamil: 'கோழி இறைச்சி',
    unit: 'g',
    unit_g: 100,
    kcal_per_100g: 165,
    protein_per_100g: 31.0,
    carb_per_100g: 0.0,
    fat_per_100g: 3.6,
    fibre_per_100g: 0.0,
    prep_state: 'cooked',
    source: 'USDA FoodData Central'
  },
  chicken_gravy: {
    id: 'STAPLE:chicken_gravy',
    name: 'South Indian Chicken Curry / Gravy',
    name_tamil: 'சிக்கன் குழம்பு',
    unit: 'g',
    unit_g: 150,
    kcal_per_100g: 125,
    protein_per_100g: 14.0,
    carb_per_100g: 4.5,
    fat_per_100g: 6.0,
    fibre_per_100g: 1.2,
    prep_state: 'cooked',
    source: 'INDB Recipe Verified'
  },
  fish_curry: {
    id: 'STAPLE:fish_curry',
    name: 'South Indian Meen Curry / Fish Curry',
    name_tamil: 'மீன் குழம்பு',
    unit: 'g',
    unit_g: 150,
    kcal_per_100g: 115,
    protein_per_100g: 14.5,
    carb_per_100g: 2.8,
    fat_per_100g: 5.0,
    fibre_per_100g: 0.8,
    prep_state: 'cooked',
    source: 'INDB Recipe Verified'
  },
  toor_dal: {
    id: 'INX_FOOD_INDB_B002',
    name: 'Cooked Dal (Toor Dal Tadka)',
    name_tamil: 'பருப்பு',
    unit: 'katori / cup',
    unit_g: 150,
    kcal_per_100g: 97,
    protein_per_100g: 5.5,
    carb_per_100g: 14.0,
    fat_per_100g: 2.1,
    fibre_per_100g: 3.0,
    prep_state: 'cooked',
    source: 'ICMR-NIN 2017'
  },
  soya_curry: {
    id: 'STAPLE:soya_curry',
    name: 'Soya Chunks Curry',
    name_tamil: 'சோயா குழம்பு',
    unit: 'g',
    unit_g: 120,
    kcal_per_100g: 133,
    protein_per_100g: 15.4,
    carb_per_100g: 9.2,
    fat_per_100g: 3.8,
    fibre_per_100g: 4.2,
    prep_state: 'cooked',
    source: 'ICMR-NIN & INDB'
  },
  paneer_curry: {
    id: 'STAPLE:paneer_curry',
    name: 'Paneer Bhurji / Curry',
    name_tamil: 'பன்னீர் கிரேவி',
    unit: 'g',
    unit_g: 120,
    kcal_per_100g: 200,
    protein_per_100g: 11.7,
    carb_per_100g: 4.2,
    fat_per_100g: 15.0,
    fibre_per_100g: 1.2,
    prep_state: 'cooked',
    source: 'ICMR-NIN 2017'
  },
  curd: {
    id: 'INX_FOOD_INDB_L001',
    name: 'Fresh Cow Milk Curd / Dahi',
    name_tamil: 'தயிர்',
    unit: 'g',
    unit_g: 100,
    kcal_per_100g: 62,
    protein_per_100g: 3.5,
    carb_per_100g: 4.5,
    fat_per_100g: 3.2,
    fibre_per_100g: 0.0,
    prep_state: 'fresh',
    source: 'ICMR-NIN 2017'
  },
  poriyal: {
    id: 'STAPLE:poriyal',
    name: 'Mixed Vegetable Poriyal (Cabbage/Beans/Carrot)',
    name_tamil: 'காய்கறி பொரியல்',
    unit: 'cup',
    unit_g: 100,
    kcal_per_100g: 75,
    protein_per_100g: 2.2,
    carb_per_100g: 8.5,
    fat_per_100g: 3.5,
    fibre_per_100g: 3.8,
    prep_state: 'cooked',
    source: 'ICMR-NIN 2017'
  },

  // Snacks & Hydration
  banana: {
    id: 'INX_FOOD_INDB_E005',
    name: 'Banana (Robusta / Fresh)',
    name_tamil: 'வாழைப்பழம்',
    unit: 'piece',
    unit_g: 100,
    kcal_per_100g: 89,
    protein_per_100g: 1.1,
    carb_per_100g: 22.8,
    fat_per_100g: 0.3,
    fibre_per_100g: 2.6,
    prep_state: 'raw',
    source: 'ICMR-NIN 2017'
  },
  roasted_peanuts: {
    id: 'STAPLE:peanuts_roasted',
    name: 'Roasted Peanuts (Verkadalai)',
    name_tamil: 'வறுத்த வேர்க்கடலை',
    unit: 'handful',
    unit_g: 30,
    kcal_per_100g: 585,
    protein_per_100g: 24.5,
    carb_per_100g: 21.0,
    fat_per_100g: 49.7,
    fibre_per_100g: 8.0,
    prep_state: 'roasted',
    source: 'ICMR-NIN 2017'
  },
  buttermilk: {
    id: 'STAPLE:buttermilk',
    name: 'Spiced Buttermilk (Neer Mor)',
    name_tamil: 'நீர் மோர்',
    unit: 'glass',
    unit_g: 200,
    kcal_per_100g: 20,
    protein_per_100g: 1.25,
    carb_per_100g: 1.75,
    fat_per_100g: 0.75,
    fibre_per_100g: 0.25,
    prep_state: 'liquid',
    source: 'ICMR-NIN 2017'
  }
};

// Helper to compute nutrient item contribution
function createMealItem(catalogKey, quantity, customUnit = null) {
  const food = VERIFIED_FOOD_CATALOG[catalogKey];
  if (!food) return null;

  const qty = Number(quantity) || 1;
  const unitName = customUnit || food.unit;
  const grams = Math.round(qty * food.unit_g);
  const ratio = grams / 100.0;

  return {
    food_id: food.id,
    food_name: food.name,
    food_name_tamil: food.name_tamil,
    serving_quantity: qty,
    serving_unit: unitName,
    serving_grams: grams,
    prep_state: food.prep_state,
    energy_kcal: Math.round(food.kcal_per_100g * ratio),
    protein_g: Math.round(food.protein_per_100g * ratio * 10) / 10,
    carb_g: Math.round(food.carb_per_100g * ratio * 10) / 10,
    fat_g: Math.round(food.fat_per_100g * ratio * 10) / 10,
    fibre_g: Math.round(food.fibre_per_100g * ratio * 10) / 10,
    source_name: food.source
  };
}

// 3. Complete Diet Plan Generator
export function generateDietPlan(profile, targets = null) {
  const calc = targets || calculatePersonalizedTargets(profile);
  const dietPref = String(profile.diet_preference || profile.diet || 'non_veg').toLowerCase();
  const mealCount = Number(profile.meal_count || profile.preferred_meal_count || 4);
  const targetKcal = calc.target_calories;
  const isVeg = dietPref.includes('veg') && !dietPref.includes('non');
  const isEggetarian = dietPref.includes('egg');

  // Calorie and macro scaling factor (baseline 1,650 kcal)
  const scale = Math.max(0.75, Math.min(1.8, targetKcal / 1650));
  const idliCount = Math.max(2, Math.round(3 * scale));
  const eggCount = scale >= 1.25 ? 3 : 2;
  const riceQty = Math.round(scale * 10) / 10;
  const chapatiCount = Math.max(2, Math.round(2 * scale));
  const chickenQty = Math.round(scale * 10) / 10;

  const meals = [];

  // ===================== 4-MEAL DEFAULT ARCHITECTURE =====================
  if (mealCount === 3) {
    // 3 MEALS: Breakfast (30%), Lunch (40%), Dinner (30%)
    // Breakfast
    const bfItems = [
      createMealItem('idli', idliCount),
      createMealItem('sambar', 1),
      isVeg && !isEggetarian ? createMealItem('sundal', Math.max(1, Math.round(scale * 10) / 10)) : createMealItem('boiled_egg', eggCount)
    ].filter(Boolean);

    // Lunch
    const lunchItems = [
      createMealItem('cooked_rice', Math.round(1.2 * scale * 10) / 10, `portion (${Math.round(180 * scale)}g)`),
      !isVeg ? createMealItem('chicken_gravy', chickenQty) : (isEggetarian ? createMealItem('egg_bhurji', chickenQty) : createMealItem('soya_curry', chickenQty)),
      createMealItem('poriyal', 1),
      createMealItem('curd', 1)
    ].filter(Boolean);

    // Dinner
    const dinnerItems = [
      createMealItem('chapati', Math.max(2, Math.round(3 * scale))),
      !isVeg ? createMealItem('chicken_breast', chickenQty) : (isEggetarian ? createMealItem('boiled_egg', eggCount) : createMealItem('toor_dal', Math.round(1.2 * scale * 10) / 10)),
      createMealItem('poriyal', 1)
    ].filter(Boolean);

    meals.push(
      formatMealBlock('Breakfast', 'காலை உணவு', '8:30 AM', bfItems, 'Steam idlis fresh. Enjoy with protein-rich boiled eggs and vegetable sambar.'),
      formatMealBlock('Lunch', 'மதிய உணவு', '1:30 PM', lunchItems, 'Portion rice accurately using a kitchen scale. Savor with protein gravy and fresh curd.'),
      formatMealBlock('Dinner', 'இரவு உணவு', '8:00 PM', dinnerItems, 'Light, digestible dinner cooked with minimal oil. Ideal 2.5 hours before sleep.')
    );
  } else if (mealCount === 5) {
    // 5 MEALS: Breakfast, Mid-Morning, Lunch, Pre-Workout Snack, Dinner
    const bfItems = [
      createMealItem('idli', idliCount),
      createMealItem('sambar', 1),
      isVeg && !isEggetarian ? createMealItem('sundal', Math.round(0.8 * scale * 10) / 10) : createMealItem('boiled_egg', eggCount)
    ].filter(Boolean);

    const midItems = [
      createMealItem('banana', 1),
      createMealItem('buttermilk', 1)
    ].filter(Boolean);

    const lunchItems = [
      createMealItem('cooked_rice', riceQty, `portion (${Math.round(150 * scale)}g)`),
      !isVeg ? createMealItem('chicken_gravy', chickenQty) : (isEggetarian ? createMealItem('egg_bhurji', chickenQty) : createMealItem('soya_curry', chickenQty)),
      createMealItem('toor_dal', 0.8),
      createMealItem('curd', 1)
    ].filter(Boolean);

    const snackItems = [
      createMealItem('sundal', Math.round(scale * 10) / 10),
      scale >= 1.2 ? createMealItem('roasted_peanuts', 1) : createMealItem('roasted_peanuts', 0.8)
    ].filter(Boolean);

    const dinnerItems = [
      createMealItem('chapati', chapatiCount),
      !isVeg ? createMealItem('chicken_breast', chickenQty) : (isEggetarian ? createMealItem('boiled_egg', eggCount) : createMealItem('paneer_curry', chickenQty)),
      createMealItem('poriyal', 1)
    ].filter(Boolean);

    meals.push(
      formatMealBlock('Breakfast', 'காலை உணவு', '8:00 AM', bfItems, 'Start your morning with complex carbs and protein.'),
      formatMealBlock('Mid-Morning Snack', 'முற்பகல் சிற்றுண்டி', '11:00 AM', midItems, 'Electrolytes and steady potassium from fresh fruit and spiced neer mor.'),
      formatMealBlock('Lunch', 'மதிய உணவு', '1:30 PM', lunchItems, 'Balanced staple South Indian plate.'),
      formatMealBlock('Pre-Workout Snack', 'உடற்பயிற்சிக்கு முன்', '5:30 PM', snackItems, 'Slow-burning legume complex carbs for workout stamina.'),
      formatMealBlock('Dinner', 'இரவு உணவு', '8:30 PM', dinnerItems, 'High protein, low fat dinner facilitating overnight recovery.')
    );
  } else {
    // 4 MEALS (Standard Recommended): Breakfast (25%), Lunch (35%), Evening Snack (15%), Dinner (25%)
    const bfItems = [
      createMealItem('idli', idliCount),
      createMealItem('sambar', 1),
      isVeg && !isEggetarian ? createMealItem('sundal', Math.round(scale * 10) / 10) : createMealItem('boiled_egg', eggCount)
    ].filter(Boolean);

    const lunchItems = [
      createMealItem('cooked_rice', riceQty, `portion (${Math.round(150 * scale)}g)`),
      !isVeg ? createMealItem('chicken_gravy', chickenQty) : (isEggetarian ? createMealItem('egg_bhurji', chickenQty) : createMealItem('soya_curry', chickenQty)),
      createMealItem('poriyal', 1),
      createMealItem('curd', 1)
    ].filter(Boolean);

    const snackItems = [
      createMealItem('sundal', Math.round(scale * 10) / 10),
      createMealItem('banana', 1),
      ...(scale >= 1.2 ? [createMealItem('roasted_peanuts', 0.8)] : [])
    ].filter(Boolean);

    const dinnerItems = [
      createMealItem('chapati', chapatiCount),
      !isVeg ? createMealItem('chicken_breast', chickenQty) : (isEggetarian ? createMealItem('boiled_egg', eggCount) : createMealItem('toor_dal', 1)),
      createMealItem('poriyal', 1)
    ].filter(Boolean);

    meals.push(
      formatMealBlock('Breakfast', 'காலை உணவு', '8:30 AM', bfItems, 'Fresh steamed idlis paired with eggs/sundal and hot vegetable sambar.'),
      formatMealBlock('Lunch', 'மதிய உணவு', '1:30 PM', lunchItems, 'South Indian balanced meal with lean protein, vegetables, and gut-friendly curd.'),
      formatMealBlock('Evening Snack / Pre-Workout', 'மாலை சிற்றுண்டி', '5:30 PM', snackItems, 'Nutrient-dense green gram sundal and banana for training energy.'),
      formatMealBlock('Dinner', 'இரவு உணவு', '8:30 PM', dinnerItems, 'Fiber-rich wheat chapatis with protein gravy for muscular recovery.')
    );
  }

  // Calculate Daily Totals
  const dailyTotals = {
    calories: Math.round(meals.reduce((sum, m) => sum + m.total_calories, 0)),
    protein_g: Math.round(meals.reduce((sum, m) => sum + m.total_protein_g, 0) * 10) / 10,
    carb_g: Math.round(meals.reduce((sum, m) => sum + m.total_carb_g, 0) * 10) / 10,
    fat_g: Math.round(meals.reduce((sum, m) => sum + m.total_fat_g, 0) * 10) / 10,
    fibre_g: Math.round(meals.reduce((sum, m) => sum + m.total_fibre_g, 0) * 10) / 10
  };

  const diff = {
    calories: dailyTotals.calories - calc.target_calories,
    protein_g: Math.round((dailyTotals.protein_g - calc.protein_target_g) * 10) / 10,
    carb_g: Math.round((dailyTotals.carb_g - calc.carb_target_g) * 10) / 10,
    fat_g: Math.round((dailyTotals.fat_g - calc.fat_target_g) * 10) / 10
  };

  return {
    plan_name: `IRONX AI Personalized ${profile.fitness_goal ? String(profile.fitness_goal).replace(/_/g, ' ').toUpperCase() : 'FITNESS'} Plan`,
    user_profile: {
      age: profile.age,
      sex: profile.sex,
      height_cm: profile.height_cm || profile.height,
      weight_kg: profile.weight_kg || profile.weight,
      fitness_goal: profile.fitness_goal || profile.goal,
      activity_level: profile.activity_level,
      workout_frequency: profile.workout_frequency,
      diet_preference: dietPref,
      meal_count: mealCount
    },
    calculation: calc,
    meal_count: mealCount,
    meals,
    daily_totals: dailyTotals,
    difference_from_targets: diff,
    hydration_guideline: 'Drink 2.5 to 3.5 liters of clean water daily. Add spiced buttermilk (neer mor) on heavy training days.',
    substitution_guide: [
      'Idli (3 pcs) ↔ Dosa (2 pcs) ↔ Wheat Chapatis (2 pcs) ↔ Cooked Oats (40g dry).',
      'Chicken (100g) ↔ South Indian Fish Curry (150g) ↔ 3 Boiled Eggs ↔ 50g Soya Chunks ↔ 100g Paneer.',
      'White Rice (150g) ↔ Brown / Red Rice (150g) ↔ 2 Chapatis ↔ 1 Cup Cooked Quinoa.'
    ],
    safety_disclaimer: 'Calculated using validated Mifflin-St Jeor and ICMR-NIN 2017 scientific baselines. Adjust portions based on weekly weigh-in trends.'
  };
}

function formatMealBlock(name, nameTamil, time, items, prepNote) {
  const totKcal = Math.round(items.reduce((s, it) => s + it.energy_kcal, 0));
  const totP = Math.round(items.reduce((s, it) => s + it.protein_g, 0) * 10) / 10;
  const totC = Math.round(items.reduce((s, it) => s + it.carb_g, 0) * 10) / 10;
  const totF = Math.round(items.reduce((s, it) => s + it.fat_g, 0) * 10) / 10;
  const totFib = Math.round(items.reduce((s, it) => s + it.fibre_g, 0) * 10) / 10;

  return {
    meal_name: name,
    meal_name_tamil: nameTamil,
    recommended_time: time,
    preparation_note: prepNote,
    items,
    total_calories: totKcal,
    total_protein_g: totP,
    total_carb_g: totC,
    total_fat_g: totF,
    total_fibre_g: totFib
  };
}

// 4. Interactive Diet Plan Modification Engine
export function modifyDietPlan(currentPlan, requestText) {
  if (!currentPlan || !currentPlan.meals) return currentPlan;

  const tLower = String(requestText || '').toLowerCase();
  const updatedMeals = JSON.parse(JSON.stringify(currentPlan.meals));
  let changeNote = '';

  // 1. Swap Idli with Dosa
  if ((tLower.includes('dosa') || tLower.includes('தோசை')) && (tLower.includes('replace') || tLower.includes('swap') || tLower.includes('instead of idli'))) {
    for (const m of updatedMeals) {
      const idx = m.items.findIndex(it => it.food_name.toLowerCase().includes('idli'));
      if (idx !== -1) {
        m.items[idx] = createMealItem('dosa', 2);
        changeNote = 'Replaced 3 Idlis with 2 Plain Dosas in Breakfast.';
      }
    }
  }
  // 2. Swap Dosa with Chapati
  else if (tLower.includes('chapati') && (tLower.includes('replace') || tLower.includes('instead of dosa'))) {
    for (const m of updatedMeals) {
      const idx = m.items.findIndex(it => it.food_name.toLowerCase().includes('dosa'));
      if (idx !== -1) {
        m.items[idx] = createMealItem('chapati', 2);
        changeNote = 'Replaced 2 Dosas with 2 Wheat Chapatis in Breakfast.';
      }
    }
  }
  // 3. Make Vegetarian (Remove Chicken, add Soya / Paneer)
  else if (tLower.includes('vegetarian') || tLower.includes('remove chicken') || tLower.includes('veg only')) {
    for (const m of updatedMeals) {
      for (let i = 0; i < m.items.length; i++) {
        if (m.items[i].food_name.toLowerCase().includes('chicken')) {
          m.items[i] = createMealItem('soya_curry', 1);
          changeNote = 'Converted to Vegetarian: Replaced chicken with protein-rich Soya Chunks Curry.';
        }
      }
    }
  }
  // 4. Add Fish / Swap Chicken with Fish
  else if (tLower.includes('fish') || tLower.includes('மீன்')) {
    for (const m of updatedMeals) {
      for (let i = 0; i < m.items.length; i++) {
        if (m.items[i].food_name.toLowerCase().includes('chicken')) {
          m.items[i] = createMealItem('fish_curry', 1);
          changeNote = 'Replaced chicken with South Indian Meen (Fish) Curry.';
        }
      }
    }
  }
  // 5. Increase Protein
  else if (tLower.includes('increase protein') || tLower.includes('more protein')) {
    for (const m of updatedMeals) {
      if (m.meal_name.toLowerCase().includes('breakfast')) {
        m.items.push(createMealItem('boiled_egg', 1));
      } else if (m.meal_name.toLowerCase().includes('dinner')) {
        m.items.push(createMealItem('egg_white', 2));
      }
    }
    changeNote = 'Boosted daily protein: Added 1 whole boiled egg to Breakfast and 2 egg whites to Dinner (+18g protein).';
  }
  // 6. Make Dinner Lighter
  else if (tLower.includes('lighter') || tLower.includes('light dinner')) {
    for (const m of updatedMeals) {
      if (m.meal_name.toLowerCase().includes('dinner')) {
        const chapatiItem = m.items.find(it => it.food_name.toLowerCase().includes('chapati'));
        if (chapatiItem && chapatiItem.serving_quantity > 1) {
          chapatiItem.serving_quantity = 1;
          chapatiItem.serving_grams = 35;
          chapatiItem.energy_kcal = 104;
          chapatiItem.protein_g = 3.1;
          chapatiItem.carb_g = 20.3;
          chapatiItem.fat_g = 1.2;
        }
      }
    }
    changeNote = 'Lightened Dinner: Reduced to 1 Chapati with lean protein for easier overnight digestion.';
  } else {
    changeNote = 'Recalculated diet plan with updated portion adjustments.';
  }

  // Recalculate each meal block
  for (const m of updatedMeals) {
    m.total_calories = Math.round(m.items.reduce((s, it) => s + it.energy_kcal, 0));
    m.total_protein_g = Math.round(m.items.reduce((s, it) => s + it.protein_g, 0) * 10) / 10;
    m.total_carb_g = Math.round(m.items.reduce((s, it) => s + it.carb_g, 0) * 10) / 10;
    m.total_fat_g = Math.round(m.items.reduce((s, it) => s + it.fat_g, 0) * 10) / 10;
    m.total_fibre_g = Math.round(m.items.reduce((s, it) => s + it.fibre_g, 0) * 10) / 10;
  }

  // Recalculate daily totals
  const dailyTotals = {
    calories: Math.round(updatedMeals.reduce((sum, m) => sum + m.total_calories, 0)),
    protein_g: Math.round(updatedMeals.reduce((sum, m) => sum + m.total_protein_g, 0) * 10) / 10,
    carb_g: Math.round(updatedMeals.reduce((sum, m) => sum + m.total_carb_g, 0) * 10) / 10,
    fat_g: Math.round(updatedMeals.reduce((sum, m) => sum + m.total_fat_g, 0) * 10) / 10,
    fibre_g: Math.round(updatedMeals.reduce((sum, m) => sum + m.total_fibre_g, 0) * 10) / 10
  };

  const diff = {
    calories: dailyTotals.calories - currentPlan.calculation.target_calories,
    protein_g: Math.round((dailyTotals.protein_g - currentPlan.calculation.protein_target_g) * 10) / 10,
    carb_g: Math.round((dailyTotals.carb_g - currentPlan.calculation.carb_target_g) * 10) / 10,
    fat_g: Math.round((dailyTotals.fat_g - currentPlan.calculation.fat_target_g) * 10) / 10
  };

  return {
    ...currentPlan,
    meals: updatedMeals,
    daily_totals: dailyTotals,
    difference_from_targets: diff,
    last_modification_note: changeNote,
    updated_at: new Date().toISOString()
  };
}

// 5. Structured Fitness & Nutrition Q&A Knowledge Base
export const FITNESS_QA_KNOWLEDGE = [
  {
    keywords: ['protein', 'how much protein', 'why protein'],
    question: 'How much protein do I actually need and why is it important?',
    answer: 'For active lifters and fat loss, evidence supports **1.6 to 2.2g of protein per kg of body weight** daily. Protein supplies essential amino acids to stimulate Muscle Protein Synthesis (MPS), preserves lean contractile muscle tissue during a calorie deficit, and has the highest Thermic Effect of Food (TEF ~20-30%), meaning your body burns more calories simply digesting it.'
  },
  {
    keywords: ['rice at night', 'eating rice', 'carbs at night', 'chawal'],
    question: 'Will eating white rice or carbs at night make me fat?',
    answer: '**No.** Fat gain is determined by your net 24-hour calorie balance (Calories In vs. Calories Out), not the time of day. 150g of cooked rice is ~195 kcal whether eaten at 1:00 PM or 9:00 PM. In fact, carbohydrates in the evening support serotonin and melatonin production, improving sleep quality which aids recovery.'
  },
  {
    keywords: ['egg yolk', 'cholesterol', 'how many eggs', 'yolks bad'],
    question: 'Are whole eggs or egg yolks bad for cholesterol?',
    answer: 'For the vast majority of healthy adults, dietary cholesterol from whole eggs has a minimal effect on blood LDL cholesterol. Whole eggs contain essential choline, vitamin D, lutein, and healthy fats that enhance nutrient absorption. Eating 2-3 whole eggs daily is safe, nutritious, and cost-effective.'
  },
  {
    keywords: ['water', 'hydration', 'how much water'],
    question: 'How much water should I drink every day?',
    answer: 'Target **2.5 to 3.5 liters per day** (or ~35-40 ml per kg of bodyweight), plus an additional 500ml for every hour of vigorous resistance training. Staying hydrated maintains cellular muscle volume, transports nutrients, prevents muscle cramps, and reduces water retention.'
  },
  {
    keywords: ['recomp', 'build muscle lose fat', 'both at once'],
    question: 'Can I build muscle and lose fat at the same time?',
    answer: '**Yes**, this is called body recomposition. It is most effective for beginners, individuals returning after a layoff, or those with moderate to high body fat. It requires: 1) Progressive overload in strength training, 2) High protein (2.0g/kg), and 3) A mild calorie deficit (5-10%) or maintenance calories.'
  },
  {
    keywords: ['pre-workout', 'pre workout', 'what to eat before'],
    question: 'What should I eat before my workout?',
    answer: '45-60 minutes prior, consume easily digestible carbohydrates with moderate protein: a medium banana with 1 glass buttermilk, or 1 cup curd with fruit, or 2 idlis with sambar. Avoid high fat meals right before training as fat slows gastric emptying.'
  },
  {
    keywords: ['creatine', 'creatine safe'],
    question: 'Is creatine safe, and how should I take it?',
    answer: '**Creatine monohydrate is the most extensively researched and safest sports supplement in history.** Take **3 to 5 grams daily** at any consistent time with water. It saturates intramuscular phosphocreatine stores, increasing ATP regeneration for improved strength and power output.'
  },
  {
    keywords: ['vegetarian protein', 'veg protein', 'plant protein'],
    question: 'Can I build muscle on an Indian vegetarian diet?',
    answer: '**Absolutely.** Combine diverse protein sources to achieve a complete amino acid profile: Soya chunks (52% protein by dry weight), Paneer, Cow milk curd / Greek yogurt, Toor / Moong / Chana dal, Sundal, and Roasted peanuts. Aim to hit 1.6-1.8g/kg.'
  }
];

export function findFitnessKnowledgeAnswer(query) {
  const qLower = String(query || '').toLowerCase();
  for (const item of FITNESS_QA_KNOWLEDGE) {
    if (item.keywords.some(k => qLower.includes(k))) {
      return item.answer;
    }
  }
  return null;
}
