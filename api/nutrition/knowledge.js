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
