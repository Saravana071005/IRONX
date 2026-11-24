/**
 * IRONX AI — Conversational Intelligence & Multi-Turn Dialog Engine
 * Local-first conversational onboarding, interactive diet plan generation,
 * daily food log coaching, and fitness Q&A.
 * Zero external AI API dependency.
 */

import {
  calculatePersonalizedTargets,
  generateDietPlan,
  modifyDietPlan,
  findFitnessKnowledgeAnswer,
  VERIFIED_FOOD_CATALOG
} from './knowledge.js';
import {
  getUserDietPlan,
  saveUserDietPlan,
  getUserConversation,
  saveUserConversation,
  clearUserConversation,
  getMealLogs,
  getUserTargets,
  setUserTargets,
  syncHealthLogsFromMongo
} from './db.js';

/**
 * Extracts fitness and demographic entities from natural language text.
 */
export function parseEntitiesFromText(text) {
  const t = String(text || '').trim();
  const tLower = t.toLowerCase();
  const entities = {};

  // 1. Fitness Goal
  if (tLower.includes('fat loss') || tLower.includes('lose fat') || tLower.includes('weight loss') || tLower.includes('cutting') || tLower.includes('cut')) {
    entities.fitness_goal = 'fat_loss';
  } else if (tLower.includes('muscle gain') || tLower.includes('build muscle') || tLower.includes('hypertrophy') || tLower.includes('bulking') || tLower.includes('bulk')) {
    entities.fitness_goal = 'muscle_gain';
  } else if (tLower.includes('recomp') || tLower.includes('recomposition')) {
    entities.fitness_goal = 'recomp';
  } else if (tLower.includes('maintain') || tLower.includes('maintenance')) {
    entities.fitness_goal = 'maintenance';
  }

  // 2. Sex
  if (/\b(male|man|boy)\b/i.test(t)) {
    entities.sex = 'male';
  } else if (/\b(female|woman|girl)\b/i.test(t)) {
    entities.sex = 'female';
  }

  // 3. Age
  const ageMatch = t.match(/\b(?:age\s*(?:is|:)?\s*)?(\d{2})\s*(?:years?|yrs?|y\/o)?\b/i);
  if (ageMatch) {
    const a = parseInt(ageMatch[1], 10);
    if (a >= 13 && a <= 100) entities.age = a;
  }

  // 4. Height (cm or feet/inches)
  const cmMatch = t.match(/(\d{3})\s*(?:cms?|centimeters?)\b/i);
  if (cmMatch) {
    const h = parseInt(cmMatch[1], 10);
    if (h >= 100 && h <= 250) entities.height_cm = h;
  } else {
    const ftInMatch = t.match(/(\d)\s*(?:ft|feet|'|foot)\s*(\d{1,2})?\s*(?:in|inches|")?/i);
    if (ftInMatch) {
      const feet = parseInt(ftInMatch[1], 10);
      const inches = parseInt(ftInMatch[2] || '0', 10);
      const cm = Math.round((feet * 30.48) + (inches * 2.54));
      if (cm >= 100 && cm <= 250) entities.height_cm = cm;
    }
  }

  // 5. Weight (kg)
  const kgMatch = t.match(/(\d{2,3}(?:\.\d+)?)\s*(?:kgs?|kilos?|kilograms?)\b/i);
  if (kgMatch) {
    const w = parseFloat(kgMatch[1]);
    if (w >= 30 && w <= 300) entities.weight_kg = w;
  }

  // 6. Goal Weight
  const goalWeightMatch = t.match(/(?:target|goal|reach)\s*(?:weight\s*(?:is|to|of)?\s*)?(\d{2,3}(?:\.\d+)?)\s*(?:kgs?|kilos?)?/i);
  if (goalWeightMatch) {
    const gw = parseFloat(goalWeightMatch[1]);
    if (gw >= 30 && gw <= 300) entities.target_weight_kg = gw;
  }

  // 7. Diet Preference
  if (tLower.includes('vegan')) {
    entities.diet_preference = 'vegan';
  } else if (tLower.includes('eggetarian') || tLower.includes('egg veg')) {
    entities.diet_preference = 'eggetarian';
  } else if (tLower.includes('vegetarian') || tLower.includes('pure veg') || tLower.includes('veg only') || tLower.includes('veg diet')) {
    entities.diet_preference = 'veg';
  } else if (tLower.includes('non-veg') || tLower.includes('non veg') || tLower.includes('chicken') || tLower.includes('meat') || tLower.includes('fish')) {
    entities.diet_preference = 'non_veg';
  }

  // 8. Workout Frequency
  if (tLower.includes('5-6') || tLower.includes('5 to 6') || tLower.includes('6 days') || tLower.includes('5 days')) {
    entities.workout_frequency = '5-6 days/week';
    entities.activity_level = 'very_active';
  } else if (tLower.includes('3-4') || tLower.includes('3 to 4') || tLower.includes('4 days') || tLower.includes('3 days')) {
    entities.workout_frequency = '3-4 days/week';
    entities.activity_level = 'moderate';
  } else if (tLower.includes('1-2') || tLower.includes('1 to 2') || tLower.includes('2 days') || tLower.includes('1 day')) {
    entities.workout_frequency = '1-2 days/week';
    entities.activity_level = 'light';
  } else if (tLower.includes('daily') || tLower.includes('everyday') || tLower.includes('7 days') || tLower.includes('athlete')) {
    entities.workout_frequency = 'daily';
    entities.activity_level = 'extreme';
  } else if (tLower.includes('no regular') || tLower.includes('no exercise') || tLower.includes('sedentary')) {
    entities.workout_frequency = 'none';
    entities.activity_level = 'sedentary';
  }

  // 9. Meal Count
  const mealCountMatch = t.match(/(\d)\s*(?:meals?|times?)\b/i);
  if (mealCountMatch) {
    const mc = parseInt(mealCountMatch[1], 10);
    if (mc >= 3 && mc <= 6) entities.meal_count = mc;
  }

  // 10. Rate of Change
  if (tLower.includes('conservative') || tLower.includes('slow') || tLower.includes('steady')) {
    entities.target_rate = 'conservative';
  } else if (tLower.includes('aggressive') || tLower.includes('fast') || tLower.includes('quick')) {
    entities.target_rate = 'aggressive';
  } else if (tLower.includes('moderate')) {
    entities.target_rate = 'moderate';
  }

  return entities;
}

/**
 * Main conversational dispatch turn for IRONX AI.
 */
export async function handleConversationalTurn({ user, message, date = null }) {
  const text = String(message || '').trim();
  const tLower = text.toLowerCase();
  const todayStr = date || new Date().toISOString().slice(0, 10);

  // Load user conversation state
  let conv = getUserConversation(user.id);
  if (!conv) {
    conv = {
      conversation_state: 'idle',
      history: [],
      profile_draft: {}
    };
  }

  // Pre-seed known profile fields from user account if not already in draft
  const userProf = user.profile || {};
  const draft = { ...conv.profile_draft };
  if (!draft.age && userProf.age) draft.age = userProf.age;
  if (!draft.sex && (userProf.sex || userProf.gender)) draft.sex = userProf.sex || userProf.gender;
  if (!draft.height_cm && (userProf.heightCm || userProf.height)) draft.height_cm = Number(userProf.heightCm || userProf.height);
  if (!draft.weight_kg && (userProf.currentWeightKg || userProf.weight)) draft.weight_kg = Number(userProf.currentWeightKg || userProf.weight);
  if (!draft.fitness_goal && userProf.fitnessGoal) draft.fitness_goal = userProf.fitnessGoal;
  if (!draft.activity_level && userProf.activityLevel) draft.activity_level = userProf.activityLevel;
  if (!draft.workout_frequency && (userProf.workoutFrequency || userProf.preferredWorkoutDays)) {
    draft.workout_frequency = userProf.workoutFrequency || '3-4 days/week';
  }
  if (!draft.diet_preference && userProf.dietPreferences) draft.diet_preference = userProf.dietPreferences;

  // Extract any new entities from user input
  const extracted = parseEntitiesFromText(text);
  Object.assign(draft, extracted);

  // Check special commands or intents
  // 1. Reset / Start Over
  if (tLower === 'start over' || tLower === 'restart' || tLower === 'reset conversation' || tLower === 'new diet plan') {
    clearUserConversation(user.id);
    const reply = "Hi! I'm **IRONX AI**, your personal fitness and nutrition assistant. Let's create your personalized diet plan!\n\nWhat is your primary fitness goal? (e.g. **Fat Loss**, **Muscle Gain**, **Body Recomposition**, or **Weight Maintenance**)";
    saveUserConversation(user.id, 'collecting_profile', [{ role: 'user', text }, { role: 'assistant', text: reply }], {});
    return {
      reply,
      state: 'collecting_profile',
      action: 'prompt_goal'
    };
  }

  // 2. Direct Request for PDF Diet Plan
  if (tLower.includes('pdf') || tLower.includes('download plan') || tLower.includes('diet plan pdf')) {
    const existingPlan = getUserDietPlan(user.id);
    if (existingPlan) {
      const reply = `I've prepared your personalized **${existingPlan.plan_name}** PDF! You can download it directly below. It includes your complete profile, BMR/TDEE calculations, meal-by-meal table, macros, and South Indian food substitution guide.`;
      return {
        reply,
        state: 'plan_active',
        diet_plan: existingPlan,
        pdf_ready: true,
        download_url: `/api/nutrition/ai/diet-plan/pdf?t=${Date.now()}`
      };
    } else {
      // Need a plan first
      const reply = "You don't have an active diet plan generated yet. Let's create one now! What is your primary fitness goal? (e.g. **Fat Loss**, **Muscle Gain**, or **Body Recomposition**)";
      return { reply, state: 'collecting_profile' };
    }
  }

  // 3. Interactive Diet Plan Refinement Intent
  const existingPlan = getUserDietPlan(user.id);
  if (
    existingPlan &&
    (tLower.includes('replace') ||
      tLower.includes('swap') ||
      tLower.includes('instead of') ||
      tLower.includes('increase protein') ||
      tLower.includes('make it vegetarian') ||
      tLower.includes('make dinner lighter') ||
      tLower.includes('remove chicken') ||
      tLower.includes('add fish'))
  ) {
    const modified = modifyDietPlan(existingPlan, text);
    saveUserDietPlan(user.id, modified);
    setUserTargets(user.id, {
      calorie_target: modified.daily_totals.calories,
      protein_target_g: modified.daily_totals.protein_g,
      carb_target_g: modified.daily_totals.carb_g,
      fat_target_g: modified.daily_totals.fat_g,
      fibre_target_g: modified.daily_totals.fibre_g
    });

    const reply = `**Diet Plan Updated!** ${modified.last_modification_note || ''}\n\n**New Daily Totals:**\n• **Calories**: ${modified.daily_totals.calories} kcal\n• **Protein**: ${modified.daily_totals.protein_g}g\n• **Carbs**: ${modified.daily_totals.carb_g}g\n• **Fat**: ${modified.daily_totals.fat_g}g\n• **Fibre**: ${modified.daily_totals.fibre_g}g\n\nYou can view the updated meal breakdown below or say **"Download PDF"** for your revised plan!`;

    return {
      reply,
      state: 'plan_active',
      diet_plan: modified,
      action: 'plan_modified'
    };
  }

  // 4. Daily Food Coaching Intent (Remaining Calories / Protein / Food Inquiries)
  if (
    tLower.includes('protein remaining') ||
    tLower.includes('how much protein') ||
    tLower.includes('remaining calories') ||
    tLower.includes('did i hit') ||
    tLower.includes('reach my goal') ||
    tLower.includes('breakfast') ||
    tLower.includes('what should i eat for lunch') ||
    tLower.includes('what should i eat for dinner') ||
    tLower.includes('suggest lunch') ||
    tLower.includes('can i eat dosa') ||
    tLower.includes('dosa') ||
    tLower.includes('chapati') ||
    tLower.includes('chappathi') ||
    tLower.includes('roti') ||
    tLower.includes('pre-workout') ||
    tLower.includes('post-workout')
  ) {
    await syncHealthLogsFromMongo(user.id, todayStr);
    const foods = getMealLogs(user.id, todayStr);
    const targets = getUserTargets(user.id) || { calorie_target: 1900, protein_target_g: 140, carb_target_g: 220, fat_target_g: 65 };

    const targetKcal = Number(targets.calorie_target || 1900);
    const targetP = Number(targets.protein_target_g || 140);
    const targetC = Number(targets.carb_target_g || 220);
    const targetF = Number(targets.fat_target_g || 65);

    let consumedKcal = 0;
    let consumedP = 0;
    let consumedC = 0;
    let consumedF = 0;

    for (const f of foods) {
      consumedKcal += Number(f.energy_kcal || f.calories || 0);
      consumedP += Number(f.protein_g || f.protein || 0);
      consumedC += Number(f.carb_g || f.carbs || 0);
      consumedF += Number(f.fat_g || f.fat || 0);
    }
    consumedKcal = Math.round(consumedKcal);
    consumedP = Math.round(consumedP * 10) / 10;
    consumedC = Math.round(consumedC * 10) / 10;
    consumedF = Math.round(consumedF * 10) / 10;

    const remainingKcal = Math.max(0, targetKcal - consumedKcal);
    const remainingP = Math.max(0, Math.round((targetP - consumedP) * 10) / 10);

    let reply = '';
    if (tLower.includes('protein') || tLower.includes('reach') || tLower.includes('hit')) {
      if (remainingP <= 0) {
        reply = `Awesome work! You've already met your protein target today with **${consumedP}g** consumed (Target: ${targetP}g). You have **${remainingKcal} kcal** remaining.`;
      } else {
        reply = `You have **${remainingP}g protein** remaining today (${consumedP}g / ${targetP}g logged, ${remainingKcal} kcal left).
\n**Top South Indian High-Protein Picks to hit target:**
• **3 Boiled Eggs (முட்டை)**: ~19g protein, 210 kcal
• **100g Grilled / Air-fried Chicken Breast**: ~31g protein, 165 kcal
• **1 Cup Green Gram Sundal (பாசிப்பயறு சுண்டல்)**: ~14g protein, 220 kcal
• **50g Soya Chunks Curry**: ~26g protein, 175 kcal
• **1 Bowl Thick Dal / Sambar**: ~8g protein, 130 kcal`;
      }
    } else if (tLower.includes('breakfast') || tLower.includes('morning')) {
      reply = `For breakfast, here are balanced South Indian combinations fitting your targets:
• **Option A**: 3 Idlis (இட்லி) + 1 bowl Sambar + 2 Boiled Eggs (~330 kcal, 18g protein)
• **Option B**: 2 Wheat Chapatis (சப்பாத்தி) + 2-Egg Bhurji (~350 kcal, 19g protein)
• **Option C**: 2 Plain Dosas (தோசை) + Sambar + 1 cup Curd (~340 kcal, 12g protein)

Tip: Adding boiled eggs or egg bhurji ensures you start your morning with optimal protein synthesis.`;
    } else if (tLower.includes('dosa') || tLower.includes('தோசை')) {
      reply = `**Yes!** 1 medium plain dosa (~80g) is ~**133 kcal, 3.3g protein, 22g carbs, and 3.7g fat**. 2 plain dosas with sambar fit comfortably into your remaining **${remainingKcal} kcal**! Pair with 2 boiled eggs to hit your protein.`;
    } else if (tLower.includes('chapati') || tLower.includes('chappathi') || tLower.includes('roti') || tLower.includes('சப்பாத்தி')) {
      const calsPerRoti = 104;
      const fits = Math.max(1, Math.min(6, Math.floor(remainingKcal / calsPerRoti)));
      reply = `1 cooked wheat chapathi / roti (35g) has **104 kcal, 3.1g protein, 20g carbs, and 1.2g fat** (ICMR-NIN verified).

With **${remainingKcal} kcal remaining**, up to **${fits} chapatis** comfortably fit your daily target. For a complete meal, pair 2-3 chapatis with egg gravy, dal, or air-fried chicken!`;
    } else if (tLower.includes('lunch')) {
      reply = `For lunch with your remaining **${remainingKcal} kcal**, try:
• **150g Cooked Rice (சாதம்)**: 195 kcal, 4g protein, 42g carbs
• **100g Chicken Breast / Fish Curry**: 165 kcal, 28g protein
• **1 Bowl Vegetable Sambar / Dal**: 95 kcal, 4g protein
• **100g Fresh Curd (தயிர்)**: 62 kcal, 3.5g protein
\n**Total**: ~517 kcal · 39.5g Protein · 50g Carbs. Fits your budget cleanly!`;
    } else if (tLower.includes('dinner') || tLower.includes('night')) {
      reply = `For a light, muscle-preserving dinner:
• **2 Wheat Chapatis (சப்பாத்தி)**: 208 kcal, 6g protein, 40g carbs
• **Onion-Tomato Egg Gravy (2 eggs)**: 200 kcal, 13g protein
• **Cucumber & Onion Salad**: 30 kcal, 1g protein

**Total**: ~438 kcal · 20g Protein · 45g Carbs · 12g Fat. Perfect for overnight recovery without causing indigestion.`;
    } else {
      reply = `Today's status (**${todayStr}**):\n• **Calories**: ${consumedKcal} / ${targetKcal} kcal (${remainingKcal} kcal left)\n• **Protein**: ${consumedP}g / ${targetP}g (${remainingP}g needed)\n• **Carbs**: ${consumedC}g / ${targetC}g | **Fat**: ${consumedF}g / ${targetF}g\n\nFocus on a protein-rich meal (eggs, chicken, fish, or sundal) to round out your daily target!`;
    }

    return {
      reply,
      state: conv.conversation_state || 'idle',
      stats: { targetKcal, consumedKcal, remainingKcal, targetP, consumedP, remainingP }
    };
  }

  // 5. Confirmation of Profile -> Generate Plan
  if (conv.conversation_state === 'awaiting_confirmation') {
    if (tLower.includes('yes') || tLower.includes('confirm') || tLower.includes('looks good') || tLower.includes('proceed') || tLower.includes('ok') || tLower.includes('generate')) {
      const targets = calculatePersonalizedTargets(draft);
      const dietPlan = generateDietPlan(draft, targets);
      saveUserDietPlan(user.id, dietPlan);
      setUserTargets(user.id, {
        calorie_target: targets.target_calories,
        protein_target_g: targets.protein_target_g,
        carb_target_g: targets.carb_target_g,
        fat_target_g: targets.fat_target_g,
        fibre_target_g: targets.fibre_target_g,
        diet_preference: draft.diet_preference || 'non_veg'
      });

      conv.conversation_state = 'plan_active';
      conv.profile_draft = draft;
      saveUserConversation(user.id, 'plan_active', conv.history, draft);

      const reply = `**Your Personalized Diet Plan is Ready!** 🎉\n\n**Calculated Daily Targets:**\n• **BMR**: ${targets.bmr} kcal | **Estimated TDEE**: ${targets.tdee} kcal\n• **Recommended Calories**: **${targets.target_calories} kcal** (${targets.explanation})\n• **Protein Target**: **${targets.protein_target_g}g** (~2.0g/kg)\n• **Carb Target**: **${targets.carb_target_g}g** | **Fat**: **${targets.fat_target_g}g** | **Fibre**: **${targets.fibre_target_g}g**\n\nI have crafted a complete ${dietPlan.meal_count}-meal South Indian plan below using verified lab nutrition. You can ask me to swap any food (e.g. *"Replace Idli with Dosa"*), make dinner lighter, or say **"Download PDF"** to save your diet plan!`;

      return {
        reply,
        state: 'plan_active',
        targets,
        diet_plan: dietPlan,
        action: 'plan_generated'
      };
    } else {
      // User wants adjustments to draft
      conv.conversation_state = 'collecting_profile';
    }
  }

  // 6. Check General Fitness Q&A
  const qaAnswer = findFitnessKnowledgeAnswer(text);
  if (qaAnswer && !tLower.includes('diet plan') && !tLower.includes('my profile')) {
    return {
      reply: qaAnswer,
      state: conv.conversation_state || 'idle',
      action: 'faq_answered'
    };
  }

  // 7. Onboarding Profile Collection Step-by-Step
  const requiredFields = [
    { key: 'fitness_goal', question: "What is your primary fitness goal? (e.g. **Fat Loss**, **Muscle Gain**, **Body Recomposition**, or **Weight Maintenance**)" },
    { key: 'age', question: "What is your age in years?" },
    { key: 'sex', question: "What is your biological sex? (**Male** or **Female**)" },
    { key: 'height_cm', question: "What is your height in centimetres (or feet/inches)?" },
    { key: 'weight_kg', question: "What is your current body weight in kilograms?" },
    { key: 'workout_frequency', question: "How many days per week do you workout or lift weights? (e.g. **3-4 days/week**, **5-6 days/week**, or **No regular exercise**)" },
    { key: 'diet_preference', question: "What is your dietary preference? (**South Indian Non-Veg**, **Eggetarian**, **Vegetarian**, or **Vegan**)" },
    { key: 'meal_count', question: "How many meals do you prefer to eat per day? (**3 meals**, **4 meals**, or **5 meals**)" }
  ];

  // Find the first missing field
  let nextMissing = null;
  for (const f of requiredFields) {
    if (!draft[f.key]) {
      nextMissing = f;
      break;
    }
  }

  if (nextMissing) {
    conv.conversation_state = 'collecting_profile';
    conv.profile_draft = draft;
    saveUserConversation(user.id, 'collecting_profile', conv.history, draft);

    return {
      reply: nextMissing.question,
      state: 'collecting_profile',
      missing_field: nextMissing.key,
      collected_draft: draft
    };
  }

  // All fields collected! Present Profile Summary & Request Confirmation
  conv.conversation_state = 'awaiting_confirmation';
  conv.profile_draft = draft;
  saveUserConversation(user.id, 'awaiting_confirmation', conv.history, draft);

  const goalDisplay = String(draft.fitness_goal || 'fat_loss').replace(/_/g, ' ').toUpperCase();
  const summaryReply = `**Profile Complete! Here is your summary:**\n• **Goal**: ${goalDisplay}\n• **Age**: ${draft.age} years | **Sex**: ${String(draft.sex).toUpperCase()}\n• **Height**: ${draft.height_cm} cm | **Current Weight**: ${draft.weight_kg} kg\n• **Workout Frequency**: ${draft.workout_frequency}\n• **Dietary Style**: ${String(draft.diet_preference).toUpperCase()}\n• **Preferred Meals**: ${draft.meal_count || 4} meals/day\n\nDoes this look accurate? Say **Confirm** to generate your personalized South Indian diet plan!`;

  return {
    reply: summaryReply,
    state: 'awaiting_confirmation',
    profile_summary: draft,
    action: 'awaiting_confirmation'
  };
}
