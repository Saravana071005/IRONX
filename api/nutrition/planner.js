/**
 * IRONX Personalized Nutrition Planner & Recommendation Engine
 * Deterministic BMR (Mifflin-St Jeor), TDEE, Calorie/Macro Targets,
 * Plan vs Goal matching, and Affordable Food Recommendations.
 * Completely free of external AI / LLM dependencies.
 */

import { searchFoods } from './db.js';

// Standard Activity Multipliers (Physical Activity Level - PAL)
export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,        // Little or no exercise, desk job
  lightly_active: 1.375, // Light exercise 1-3 days/week
  moderately_active: 1.55,// Moderate exercise 3-5 days/week
  very_active: 1.725,    // Hard exercise 6-7 days/week
  extra_active: 1.9      // Very hard exercise, physical job or 2x training
};

// Calorie adjustment based on primary fitness goal
export const GOAL_CALORIE_ADJUSTMENTS = {
  fat_loss: -450,       // Sustainable 400-500 kcal deficit
  muscle_gain: 300,      // Controlled 250-350 kcal surplus
  recomposition: -100,   // Slight deficit or near-maintenance
  maintenance: 0        // True maintenance
};

// Affordable & nutrient-dense staple recommendations catalog
export const AFFORDABLE_NUTRITION_STAPLES = [
  {
    name: 'Boiled Eggs (Whole)',
    category: 'Eggs & Poultry',
    diet_type: 'non_veg',
    is_eggetarian: true,
    is_vegetarian: false,
    is_vegan: false,
    default_serving: '2 units (100g)',
    quantity: 2,
    unit: 'piece',
    grams: 100,
    calories: 143,
    protein: 12.6,
    carbs: 0.7,
    fat: 9.5,
    fiber: 0,
    cost_tier: 'Low / Budget-Friendly',
    prep_time: '10 min boiling',
    explanation: 'High bioavailability complete protein source with essential healthy fats and zero sugar.'
  },
  {
    name: 'Egg Whites (Boiled)',
    category: 'Eggs & Poultry',
    diet_type: 'non_veg',
    is_eggetarian: true,
    is_vegetarian: false,
    is_vegan: false,
    default_serving: '3 units (100g)',
    quantity: 3,
    unit: 'piece',
    grams: 100,
    calories: 52,
    protein: 11.0,
    carbs: 0.7,
    fat: 0.2,
    fiber: 0,
    cost_tier: 'Low / Budget-Friendly',
    prep_time: '10 min',
    explanation: 'Virtually pure protein with near-zero fat and carbohydrates, ideal for lean protein targets.'
  },
  {
    name: 'Fresh Curd / Plain Dahi',
    category: 'Dairy Products',
    diet_type: 'vegetarian',
    is_eggetarian: true,
    is_vegetarian: true,
    is_vegan: false,
    default_serving: '1 katori (150g)',
    quantity: 150,
    unit: 'g',
    grams: 150,
    calories: 90,
    protein: 4.5,
    carbs: 6.0,
    fat: 5.5,
    fiber: 0,
    cost_tier: 'Very Low / Everyday Staple',
    prep_time: 'Ready to eat',
    explanation: 'Gut-friendly probiotic food supporting digestion with quality dairy casein protein.'
  },
  {
    name: 'Green Gram Sundal (Boiled Moong)',
    category: 'Legumes & Pulses',
    diet_type: 'vegetarian',
    is_eggetarian: true,
    is_vegetarian: true,
    is_vegan: true,
    default_serving: '1 cup (100g)',
    quantity: 100,
    unit: 'g',
    grams: 100,
    calories: 140,
    protein: 8.5,
    carbs: 22.0,
    fat: 1.5,
    fiber: 5.0,
    cost_tier: 'Very Low',
    prep_time: '15 min boiling',
    explanation: 'Traditional plant protein packed with prebiotic dietary fiber for sustained satiety.'
  },
  {
    name: 'Soya Chunks (Cooked / Boiled)',
    category: 'Plant Protein',
    diet_type: 'vegetarian',
    is_eggetarian: true,
    is_vegetarian: true,
    is_vegan: true,
    default_serving: '40g dry (yields 120g cooked)',
    quantity: 40,
    unit: 'g',
    grams: 40,
    calories: 138,
    protein: 20.8,
    carbs: 13.2,
    fat: 0.2,
    fiber: 5.2,
    cost_tier: 'Extremely Low / Most Economical Protein',
    prep_time: '5 min boiling',
    explanation: 'Highest protein density per rupee in India (over 52% protein by dry weight).'
  },
  {
    name: 'Roasted Bengal Gram (Chana / Pottukadalai)',
    category: 'Snacks & Legumes',
    diet_type: 'vegetarian',
    is_eggetarian: true,
    is_vegetarian: true,
    is_vegan: true,
    default_serving: 'Handful (40g)',
    quantity: 40,
    unit: 'g',
    grams: 40,
    calories: 147,
    protein: 8.8,
    carbs: 23.2,
    fat: 2.2,
    fiber: 4.8,
    cost_tier: 'Very Low',
    prep_time: 'Ready to eat',
    explanation: 'Crunchy snack with slow-digesting complex carbs and zero preparation needed.'
  },
  {
    name: 'Banana (Medium)',
    category: 'Fruits',
    diet_type: 'vegetarian',
    is_eggetarian: true,
    is_vegetarian: true,
    is_vegan: true,
    default_serving: '1 medium (100g)',
    quantity: 1,
    unit: 'piece',
    grams: 100,
    calories: 89,
    protein: 1.1,
    carbs: 23.0,
    fat: 0.3,
    fiber: 2.6,
    cost_tier: 'Very Low',
    prep_time: 'Ready to eat',
    explanation: 'Natural potassium-rich energy boost, excellent pre- or post-workout quick carbohydrate.'
  },
  {
    name: 'Cow Milk (Toned)',
    category: 'Dairy Products',
    diet_type: 'vegetarian',
    is_eggetarian: true,
    is_vegetarian: true,
    is_vegan: false,
    default_serving: '1 glass (200ml)',
    quantity: 200,
    unit: 'ml',
    grams: 200,
    calories: 116,
    protein: 6.4,
    carbs: 9.6,
    fat: 6.0,
    fiber: 0,
    cost_tier: 'Low',
    prep_time: '2 min warming',
    explanation: 'Calcium, vitamin D, and balanced whey/casein protein combo before bedtime.'
  },
  {
    name: 'Fresh Paneer (Low-Fat or Regular)',
    category: 'Dairy Products',
    diet_type: 'vegetarian',
    is_eggetarian: true,
    is_vegetarian: true,
    is_vegan: false,
    default_serving: '50g block',
    quantity: 50,
    unit: 'g',
    grams: 50,
    calories: 132,
    protein: 9.1,
    carbs: 0.6,
    fat: 10.4,
    fiber: 0,
    cost_tier: 'Moderate',
    prep_time: 'Ready or pan-seared',
    explanation: 'Dense slow-digesting protein that prevents muscle catabolism.'
  }
];

/**
 * Calculate Personalized Body Metrics & Nutrition Targets
 * Deterministically uses Mifflin-St Jeor formula and scientific macro distributions.
 * @param {Object} profile User physical attributes and goals
 * @returns {Object} Calculated targets and rationale
 */
export function calculateNutritionTargets(profile) {
  const age = Number(profile.age) || 25;
  const sex = String(profile.sex || 'male').toLowerCase();
  const heightCm = Number(profile.height_cm || profile.height) || 175;
  const weightKg = Number(profile.weight_kg || profile.weight) || 70;
  const targetWeightKg = Number(profile.target_weight_kg) || weightKg;
  const goal = String(profile.fitness_goal || profile.goal || 'maintenance').toLowerCase();
  const activityLevel = String(profile.activity_level || 'moderately_active').toLowerCase();
  const experience = String(profile.workout_experience || 'intermediate').toLowerCase();
  const workoutDays = Number(profile.workout_days_per_week) || 4;
  const strengthDurMin = Number(profile.strength_duration_min) || 45;
  const cardioFreq = Number(profile.cardio_frequency_per_week) || 2;
  const cardioDurMin = Number(profile.cardio_duration_min) || 20;

  // 1. BMI Calculation
  const heightM = heightCm / 100;
  const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;

  // 2. BMR via Mifflin-St Jeor Formula
  // Male: 10*W + 6.25*H - 5*A + 5
  // Female: 10*W + 6.25*H - 5*A - 161
  let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  if (sex === 'female') {
    bmr -= 161;
  } else {
    bmr += 5;
  }
  bmr = Math.round(bmr);

  // 3. TDEE Estimation without double-counting activity
  const baseMultiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.moderately_active;
  let tdee = Math.round(bmr * baseMultiplier);

  // Moderate adjustment for specific workout sessions if activity was reported as sedentary
  if (activityLevel === 'sedentary' && (workoutDays > 0 || cardioFreq > 0)) {
    const weeklyExtraCalories = (workoutDays * strengthDurMin * 5.5) + (cardioFreq * cardioDurMin * 7.0);
    const dailyExtraCalories = Math.round(weeklyExtraCalories / 7);
    tdee += Math.min(dailyExtraCalories, 350); // capped to prevent inflation
  }

  // 4. Caloric Target based on Fitness Goal
  const calorieAdjustment = GOAL_CALORIE_ADJUSTMENTS[goal] !== undefined
    ? GOAL_CALORIE_ADJUSTMENTS[goal]
    : 0;

  let calorieTarget = tdee + calorieAdjustment;

  // Safety floor: Never recommend below essential metabolic baseline (1,200 for women, 1,500 for men)
  const minimumCalorieFloor = sex === 'female' ? 1200 : 1500;
  if (calorieTarget < minimumCalorieFloor) {
    calorieTarget = minimumCalorieFloor;
  }

  // 5. Macro Distribution
  // Protein: 1.6 to 2.2 g per kg bodyweight
  let proteinPerKg = 1.8;
  if (goal === 'muscle_gain') proteinPerKg = 2.0;
  if (goal === 'fat_loss') proteinPerKg = 2.0; // Higher protein preserves lean mass in deficit
  if (goal === 'recomposition') proteinPerKg = 2.2;
  if (goal === 'maintenance') proteinPerKg = 1.6;

  let proteinG = Math.round(weightKg * proteinPerKg);
  // Cap protein between 15% and 35% of total calories
  const proteinMaxKcal = calorieTarget * 0.35;
  if (proteinG * 4 > proteinMaxKcal) {
    proteinG = Math.round(proteinMaxKcal / 4);
  }

  // Fat: 0.8 to 1.0 g per kg bodyweight (approx 20-25% of calories)
  let fatPerKg = 0.85;
  if (goal === 'fat_loss') fatPerKg = 0.8;
  let fatG = Math.round(weightKg * fatPerKg);
  const fatCalories = fatG * 9;
  const fatPct = fatCalories / calorieTarget;
  if (fatPct < 0.20) fatG = Math.round((calorieTarget * 0.20) / 9);
  if (fatPct > 0.30) fatG = Math.round((calorieTarget * 0.25) / 9);

  // Carbohydrates: Remaining Calories / 4
  const remainingCalories = calorieTarget - (proteinG * 4) - (fatG * 9);
  let carbG = Math.round(Math.max(remainingCalories, 0) / 4);

  // Dietary Fiber: 14g per 1,000 kcal (scientific standard)
  let fibreG = Math.round((calorieTarget / 1000) * 14);
  fibreG = Math.max(25, Math.min(fibreG, 40)); // sensible bounds (25g - 40g)

  return {
    bmi,
    bmr,
    tdee,
    calorie_target: calorieTarget,
    protein_target: proteinG,
    carb_target: carbG,
    fat_target: fatG,
    fibre_target: fibreG,
    calculation_basis: {
      formula: 'Mifflin-St Jeor (1990) with PAL Activity Coefficients',
      goal_adjustment_kcal: calorieAdjustment,
      protein_per_kg: proteinPerKg,
      fat_per_kg: fatPerKg
    }
  };
}

/**
 * Compare Daily Meal Plan vs Personal Goals & Generate Smart Recommendations
 * @param {Object} params
 * @param {Object} params.plannedMeals Structured daily plan (breakfast, lunch, snacks, dinner)
 * @param {Array} params.consumedMeals Actually consumed food logs for today
 * @param {Object} params.goals User targets (calories, protein, carbs, fat, fiber)
 * @param {Array} params.availableFoods User pantry/fridge foods (optional)
 * @param {Array} params.dietaryRestrictions e.g. ['vegetarian', 'vegan']
 * @returns {Object} Comparison metrics and actionable recommendations
 */
export function calculateMealPlanComparison({
  plannedMeals = {},
  consumedMeals = [],
  goals = {},
  availableFoods = [],
  dietaryRestrictions = []
}) {
  const calorieTarget = Number(goals.calorie_target || goals.calories) || 2000;
  const proteinTarget = Number(goals.protein_target || goals.protein) || 140;
  const carbTarget = Number(goals.carb_target || goals.carbs) || 220;
  const fatTarget = Number(goals.fat_target || goals.fat) || 60;
  const fibreTarget = Number(goals.fibre_target || goals.fiber) || 28;

  // 1. Calculate Planned Totals
  const planned = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  ['breakfast', 'lunch', 'snacks', 'dinner'].forEach(mType => {
    const items = Array.isArray(plannedMeals[mType]) ? plannedMeals[mType] : [];
    items.forEach(item => {
      if (!item.removed) {
        planned.calories += Number(item.energy_kcal) || 0;
        planned.protein += Number(item.protein_g) || 0;
        planned.carbs += Number(item.carb_g) || 0;
        planned.fat += Number(item.fat_g) || 0;
        planned.fiber += Number(item.fibre_g) || 0;
      }
    });
  });

  // 2. Calculate Actual Consumed Totals
  const consumed = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  consumedMeals.forEach(c => {
    consumed.calories += Number(c.energy_kcal || c.calories) || 0;
    consumed.protein += Number(c.protein_g || c.protein) || 0;
    consumed.carbs += Number(c.carb_g || c.carb || c.carbs) || 0;
    consumed.fat += Number(c.fat_g || c.fat) || 0;
    consumed.fiber += Number(c.fibre_g || c.fibre) || 0;
  });

  // 3. Balance & Remaining Requirement
  const remaining = {
    calories: Math.round((calorieTarget - consumed.calories) * 10) / 10,
    protein: Math.round((proteinTarget - consumed.protein) * 10) / 10,
    carbs: Math.round((carbTarget - consumed.carbs) * 10) / 10,
    fat: Math.round((fatTarget - consumed.fat) * 10) / 10,
    fiber: Math.round((fibreTarget - consumed.fiber) * 10) / 10
  };

  // 4. Recommendation Logic
  // Check if upcoming planned meals are sufficient to meet remaining goals
  // Compare planned total vs goal target
  const plannedCalorieRatio = planned.calories / calorieTarget;
  const plannedProteinRatio = planned.protein / proteinTarget;

  const isSufficient = plannedCalorieRatio >= 0.90 && plannedProteinRatio >= 0.85;

  let recommendationStatus = 'sufficient';
  let recommendationMessage = 'Your current meal plan is sufficient. Continue with your planned meals.';
  const suggestions = [];

  if (!isSufficient) {
    recommendationStatus = 'insufficient';
    const calorieDeficit = Math.max(0, Math.round(calorieTarget - planned.calories));
    const proteinDeficit = Math.max(0, Math.round(proteinTarget - planned.protein));

    recommendationMessage = `Your planned meals fall short by approximately ${calorieDeficit} kcal and ${proteinDeficit}g protein. Here are affordable, high-nutrition additions:`;

    // Filter available staples by dietary restrictions
    const isVeg = dietaryRestrictions.includes('vegetarian');
    const isVegan = dietaryRestrictions.includes('vegan');
    const isEggetarian = dietaryRestrictions.includes('eggetarian');

    const normalizedAvailable = availableFoods.map(f => String(f).toLowerCase().trim());

    AFFORDABLE_NUTRITION_STAPLES.forEach(staple => {
      if (isVegan && !staple.is_vegan) return;
      if (isVeg && !staple.is_vegetarian && !staple.is_vegan) return;
      if (isEggetarian && !staple.is_eggetarian && !staple.is_vegetarian && !staple.is_vegan) return;

      // Check if user has this item at home (pantry priority)
      const hasItem = normalizedAvailable.some(af =>
        staple.name.toLowerCase().includes(af) || af.includes(staple.name.toLowerCase().split(' ')[0])
      );

      suggestions.push({
        ...staple,
        is_in_user_pantry: hasItem,
        priority: hasItem ? 'high' : 'medium'
      });
    });

    // Sort: user's available foods first, then by protein density
    suggestions.sort((a, b) => {
      if (a.is_in_user_pantry && !b.is_in_user_pantry) return -1;
      if (!a.is_in_user_pantry && b.is_in_user_pantry) return 1;
      return b.protein - a.protein;
    });
  }

  return {
    goals: {
      calories: calorieTarget,
      protein: proteinTarget,
      carbs: carbTarget,
      fat: fatTarget,
      fiber: fibreTarget
    },
    planned: {
      calories: Math.round(planned.calories * 10) / 10,
      protein: Math.round(planned.protein * 10) / 10,
      carbs: Math.round(planned.carbs * 10) / 10,
      fat: Math.round(planned.fat * 10) / 10,
      fiber: Math.round(planned.fiber * 10) / 10
    },
    consumed: {
      calories: Math.round(consumed.calories * 10) / 10,
      protein: Math.round(consumed.protein * 10) / 10,
      carbs: Math.round(consumed.carbs * 10) / 10,
      fat: Math.round(consumed.fat * 10) / 10,
      fiber: Math.round(consumed.fiber * 10) / 10
    },
    remaining,
    recommendation: {
      status: recommendationStatus,
      is_sufficient: isSufficient,
      message: recommendationMessage,
      suggestions: suggestions.slice(0, 5) // Top 5 relevant suggestions
    }
  };
}

/**
 * Calculate Cheat Meal impact & Non-judgmental Guidance
 * @param {Object} cheatMeal Entry logged by user
 * @param {Object} currentDailyTotals Existing consumed totals before cheat meal
 * @param {number} dailyCalorieTarget
 * @returns {Object} Updated totals and supportive messaging
 */
export function calculateCheatMealImpact(cheatMeal, currentDailyTotals = {}, dailyCalorieTarget = 2000) {
  const cheatCalories = Number(cheatMeal.energy_kcal || cheatMeal.calories) || 0;
  const cheatProtein = Number(cheatMeal.protein_g || cheatMeal.protein) || 0;
  const cheatCarbs = Number(cheatMeal.carb_g || cheatMeal.carbs) || 0;
  const cheatFat = Number(cheatMeal.fat_g || cheatMeal.fat) || 0;
  const cheatFiber = Number(cheatMeal.fibre_g || cheatMeal.fiber) || 0;

  const currentCalories = Number(currentDailyTotals.calories_consumed || currentDailyTotals.calories) || 0;
  const updatedCalories = currentCalories + cheatCalories;
  const difference = Math.round((updatedCalories - dailyCalorieTarget) * 10) / 10;

  // Transparent non-punitive physical activity estimates
  // e.g. Brisk walking at ~4.5 kcal/kg/hr or approx 5 kcal/min for an average 70kg adult
  const walkingMinutes = cheatCalories > 0 ? Math.round(cheatCalories / 5) : 0;
  const cyclingMinutes = cheatCalories > 0 ? Math.round(cheatCalories / 8) : 0;

  return {
    cheat_meal: {
      food_name: cheatMeal.food_name,
      calories: cheatCalories,
      protein: cheatProtein,
      carbs: cheatCarbs,
      fat: cheatFat,
      fiber: cheatFiber
    },
    daily_goal: dailyCalorieTarget,
    actual_intake: updatedCalories,
    difference_from_goal: difference,
    is_above_target: difference > 0,
    supportive_message: difference > 0
      ? "Your intake is above today's target. One higher-calorie meal does not ruin your progress. Return to your normal meal plan tomorrow."
      : "Meal recorded. You are still within your daily target.",
    transparent_activity_reference: {
      disclaimer: "These activity times are transparent reference estimates only. Do not perform punishment workouts or fast tomorrow.",
      brisk_walking_min: walkingMinutes,
      moderate_cycling_min: cyclingMinutes
    }
  };
}
