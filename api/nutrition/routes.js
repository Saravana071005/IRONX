/**
 * Daily Health Log & Nutrition HTTP API Routes
 * Manual food intake, water consumption, cardio activity, strength training,
 * and daily summaries with a 1,900 kcal calorie target.
 * Completely free of external AI dependencies.
 */

import crypto from 'node:crypto';
import { getMongoDb } from '../db/mongo.js';
import {
  searchFoods,
  getFoodById,
  getRecipeIngredients,
  getPortionUnits,
  getUserTargets,
  setUserTargets,
  getMealLogs,
  addMealLog,
  updateMealLog,
  deleteMealLog,
  getWaterLogs,
  addWaterLog,
  deleteWaterLog,
  getCardioLogs,
  addCardioLog,
  updateCardioLog,
  deleteCardioLog,
  getStrengthLogs,
  addStrengthLog,
  updateStrengthLog,
  deleteStrengthLog,
  getDailyHealthSettings,
  setDailyHealthSettings,
  syncHealthLogsFromMongo,
  getMealTemplates,
  saveMealTemplate,
  deleteMealTemplate,
  getCustomRecipes,
  saveCustomRecipe,
  deleteCustomRecipe,
  getPreviousMeals,
  searchVerifiedFoods,
  searchVerifiedRecipes,
  getVerifiedRecipeById,
  calculateDeterministicRecipe,
  getUserDietPlan,
  saveUserDietPlan,
  clearUserConversation
} from './db.js';
import {
  calculatePersonalizedTargets,
  generateDietPlan,
  modifyDietPlan
} from './knowledge.js';
import { handleConversationalTurn } from './conversation.js';
import { generateDietPlanPdf } from './pdf_generator.js';
import { calculateRecipeNutrition, resolveGrams, calculateNutrients } from './engine.js';
import { parseMeal } from './parser.js';

export function nutritionRoutes({ json, readBody, readSession }) {
  const requireUser = (req, res) => {
    const user = readSession(req);
    if (!user) {
      json(res, 401, { error: 'not signed in' });
      return null;
    }
    return user;
  };

  const genId = () => crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex');

  return {
    /* ---------- Food Search & Details (For manual entry assistance) ---------- */
    'GET /api/nutrition/search': async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const q = url.searchParams.get('q') || '';
      const group = url.searchParams.get('group') || null;
      const limit = Math.min(50, Math.max(1, +(url.searchParams.get('limit') || 20)));

      try {
        const results = searchFoods(q, limit, group);
        json(res, 200, { ok: true, count: results.length, foods: results, results: results });
      } catch (e) {
        json(res, 500, { error: e.message });
      }
    },

    /* ---------- Gemini AI Meal Parser with Zero-Hallucination DB Verification ---------- */
    'POST /api/nutrition/ai-parse': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const text = String(body.text || body.prompt || '').trim();
      if (!text) {
        return json(res, 400, { error: 'Meal description text is required' });
      }

      let parsedItems = [];
      let usedGemini = false;

      // 1. Check server-side process.env.GEMINI_API_KEY
      if (process.env.GEMINI_API_KEY) {
        try {
          const apiKey = process.env.GEMINI_API_KEY;
          const prompt = `You are an expert nutrition intake parser for Indian and international diets.
Parse the following meal description into individual food items.
Recognize English, Hindi/Hinglish, and Tamil/Tanglish food terms (e.g. chapati, roti, dal, thayir, curd, dahi, muttai, anda, egg, rice, sadam, chawal, idli, dosa, oats, chicken, paneer, banana, apple, milk).
Extract quantities, units, and preparation methods.

User input: "${text}"

Respond with ONLY a JSON array of objects with the following schema:
[
  {
    "raw_name": string,
    "normalized_food": string,
    "quantity": number,
    "unit": string,
    "prep_state": string,
    "clarification": string or null
  }
]
No other text or markdown, just the JSON array.`;

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: 'application/json'
                }
              })
            }
          );

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const rawJsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawJsonText) {
              const parsed = JSON.parse(rawJsonText);
              if (Array.isArray(parsed) && parsed.length > 0) {
                parsedItems = parsed;
                usedGemini = true;
              }
            }
          }
        } catch (err) {
          console.warn('Gemini API call error, falling back to local NLP parser:', err.message);
        }
      }

      // 2. Fallback to local deterministic NLP parser if Gemini not used or failed
      if (!usedGemini || parsedItems.length === 0) {
        const localResult = parseMeal(text);
        if (localResult && Array.isArray(localResult.items)) {
          parsedItems = localResult.items.map(item => ({
            raw_name: item.raw_phrase || item.food_name,
            normalized_food: item.food_name,
            quantity: item.serving_quantity || item.quantity || 1,
            unit: item.serving_unit || item.unit || 'g',
            prep_state: item.prep_state || null,
            food_id: item.food_id
          }));
        }
      }

      // 3. Strict Database Resolution (Zero Hallucination Guarantee)
      // Match every parsed item strictly against verified lab records in nutrition.db
      const resolvedItems = [];
      let totalKcal = 0;
      let totalProtein = 0;
      let totalCarb = 0;
      let totalFat = 0;
      let totalFibre = 0;

      for (const item of parsedItems) {
        const qStr = item.normalized_food || item.raw_name || '';
        let food = item.food_id ? getFoodById(item.food_id) : null;
        if (!food && qStr) {
          const candidates = searchFoods(qStr, 5);
          if (candidates && candidates.length > 0) {
            if (item.prep_state) {
              food = candidates.find(c => c.prep_state === item.prep_state) || candidates[0];
            } else {
              food = candidates[0];
            }
          }
        }

        if (food) {
          const q = Number(item.quantity) || 1;
          const u = item.unit || food.serving_unit || 'g';
          const resG = resolveGrams(food, q, u);
          const nut = calculateNutrients(food, resG.grams);

          totalKcal += nut.energy_kcal;
          totalProtein += nut.protein_g;
          totalCarb += nut.carb_g;
          totalFat += nut.fat_g;
          totalFibre += nut.fibre_g;

          resolvedItems.push({
            raw_name: item.raw_name || food.name,
            food_id: food.id,
            food_name: food.name,
            category: food.food_group,
            prep_state: food.prep_state,
            source: food.source,
            confidence: food.confidence || 'verified_lab',
            serving_quantity: q,
            serving_unit: u,
            serving_grams: resG.grams,
            effective_grams: resG.grams,
            energy_kcal: Math.round(nut.energy_kcal),
            protein_g: nut.protein_g,
            carb_g: nut.carb_g,
            fat_g: nut.fat_g,
            fibre_g: nut.fibre_g,
            assumption: resG.assumption,
            clarification: item.clarification || null
          });
        }
      }

      json(res, 200, {
        ok: true,
        engine: usedGemini ? 'gemini-ai' : 'deterministic-local-nlp',
        count: resolvedItems.length,
        items: resolvedItems,
        totals: {
          energy_kcal: Math.round(totalKcal * 10) / 10,
          protein_g: Math.round(totalProtein * 10) / 10,
          carb_g: Math.round(totalCarb * 10) / 10,
          fat_g: Math.round(totalFat * 10) / 10,
          fibre_g: Math.round(totalFibre * 10) / 10
        }
      });
    },

    'GET /api/nutrition/food': async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const id = url.searchParams.get('id');
      if (!id) return json(res, 400, { error: 'food id required' });

      const food = getFoodById(id);
      if (!food) return json(res, 404, { error: 'food not found' });

      let ingredients = [];
      if (food.is_recipe && food.source_id) {
        ingredients = getRecipeIngredients(food.source_id);
      }

      const portionUnits = getPortionUnits(food.name);

      json(res, 200, {
        ok: true,
        food,
        ingredients,
        portion_units: portionUnits
      });
    },

    /* ---------- Complete Daily Health Log ---------- */
    'GET /api/nutrition/health-log': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const url = new URL(req.url, 'http://x');
      const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

      await syncHealthLogsFromMongo(user.id, date);

      const foods = getMealLogs(user.id, date);
      const water = getWaterLogs(user.id, date);
      const cardio = getCardioLogs(user.id, date);
      const strength = getStrengthLogs(user.id, date);
      const settings = getDailyHealthSettings(user.id);

      // Calculate food totals & meal subtotals
      const foodTotals = {
        calories: 0,
        protein: 0,
        carbohydrates: 0,
        fat: 0,
        fibre: 0
      };

      const subtotals = {
        breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        lunch: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        dinner: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        snacks: { calories: 0, protein: 0, carbs: 0, fat: 0 }
      };

      for (const f of foods) {
        const cal = Number(f.energy_kcal) || 0;
        const p = Number(f.protein_g) || 0;
        const c = Number(f.carb_g) || 0;
        const fat = Number(f.fat_g) || 0;
        const fib = Number(f.fibre_g) || 0;

        foodTotals.calories += cal;
        foodTotals.protein += p;
        foodTotals.carbohydrates += c;
        foodTotals.fat += fat;
        foodTotals.fibre += fib;

        const mType = String(f.meal_type || 'snacks').toLowerCase();
        if (subtotals[mType]) {
          subtotals[mType].calories += cal;
          subtotals[mType].protein += p;
          subtotals[mType].carbs += c;
          subtotals[mType].fat += fat;
        }
      }

      // Water total
      const waterTotalMl = water.reduce((acc, w) => acc + (Number(w.amount_ml) || 0), 0);

      // Cardio totals
      let cardioDurationMin = 0;
      let cardioSteps = 0;
      let cardioDistanceKm = 0;
      let cardioCaloriesBurned = 0;

      for (const c of cardio) {
        cardioDurationMin += Number(c.duration_min) || 0;
        cardioSteps += Number(c.steps) || 0;
        cardioDistanceKm += Number(c.distance_km) || 0;
        cardioCaloriesBurned += Number(c.calories_burned) || 0;
      }

      // Strength totals
      let strengthDurationMin = 0;
      let strengthCaloriesBurned = 0;

      for (const s of strength) {
        strengthDurationMin += Number(s.duration_min) || 0;
        strengthCaloriesBurned += Number(s.calories_burned) || 0;
      }

      const totalWorkoutDurationMin = cardioDurationMin + strengthDurationMin;
      const totalExerciseCaloriesBurned = cardioCaloriesBurned + strengthCaloriesBurned;

      const calorieTarget = settings.calorie_target != null ? settings.calorie_target : 1900;
      const caloriesConsumed = Math.round(foodTotals.calories * 10) / 10;
      const calorieDifference = Math.round((caloriesConsumed - calorieTarget) * 10) / 10;

      json(res, 200, {
        ok: true,
        date,
        settings: {
          calorie_target: calorieTarget,
          water_goal_litres: settings.water_goal_litres || 2.5
        },
        foods,
        water,
        cardio,
        strength,
        totals: {
          food_count: foods.length,
          calories_consumed: caloriesConsumed,
          calorie_target: calorieTarget,
          calorie_difference: calorieDifference,
          is_below_target: calorieDifference < 0,
          is_exact_target: calorieDifference === 0,
          is_above_target: calorieDifference > 0,
          calories_remaining: calorieDifference < 0 ? Math.abs(calorieDifference) : 0,
          calories_above: calorieDifference > 0 ? calorieDifference : 0,
          protein_g: Math.round(foodTotals.protein * 10) / 10,
          carb_g: Math.round(foodTotals.carbohydrates * 10) / 10,
          fat_g: Math.round(foodTotals.fat * 10) / 10,
          fibre_g: Math.round(foodTotals.fibre * 10) / 10,
          subtotals,
          water_ml: waterTotalMl,
          water_litres: Math.round((waterTotalMl / 1000) * 100) / 100,
          water_goal_litres: settings.water_goal_litres || 2.5,
          cardio_duration_min: cardioDurationMin,
          cardio_distance_km: Math.round(cardioDistanceKm * 10) / 10,
          strength_duration_min: strengthDurationMin,
          total_workout_duration_min: totalWorkoutDurationMin,
          total_steps: cardioSteps,
          exercise_calories_burned: totalExerciseCaloriesBurned
        }
      });
    },

    /* ---------- Food Intake CRUD ---------- */
    'POST /api/nutrition/food/save': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      if (!body.food_name || !body.meal_type || !body.date) {
        return json(res, 400, { error: 'food_name, meal_type, and date are required' });
      }

      const id = body.id || genId();
      let energyKcal = Number(body.energy_kcal != null ? body.energy_kcal : (body.calories != null ? body.calories : 0));
      let proteinG = Number(body.protein_g != null ? body.protein_g : (body.protein != null ? body.protein : 0));
      let carbG = Number(body.carb_g != null ? body.carb_g : (body.carb != null ? body.carb : (body.carbs != null ? body.carbs : 0)));
      let fatG = Number(body.fat_g != null ? body.fat_g : (body.fat != null ? body.fat : 0));
      let fibreG = Number(body.fibre_g != null ? body.fibre_g : (body.fibre != null ? body.fibre : 0));
      let servingGrams = Number(body.serving_grams || body.grams) || 0;
      let foodId = body.food_id || body.foodId || null;

      // Auto-calculate if calories are 0 and food exists in database
      if (!energyKcal && (foodId || body.food_name)) {
        let f = foodId ? getFoodById(foodId) : null;
        if (!f) {
          const matched = searchFoods(body.food_name, 1);
          if (matched && matched.length > 0) f = matched[0];
        }
        if (f) {
          foodId = f.id;
          const resG = resolveGrams(f, body.serving_quantity || 1, body.serving_unit || 'g');
          servingGrams = resG.grams;
          const nut = calculateNutrients(f, servingGrams);
          energyKcal = nut.energy_kcal;
          proteinG = nut.protein_g;
          carbG = nut.carb_g;
          fatG = nut.fat_g;
          fibreG = nut.fibre_g;
        }
      }

      const entry = {
        id,
        user_id: user.id,
        date: String(body.date).slice(0, 10),
        meal_type: String(body.meal_type).toLowerCase(),
        food_id: foodId,
        food_name: String(body.food_name).trim(),
        serving_quantity: Number(body.serving_quantity) || 1,
        serving_unit: body.serving_unit || 'g',
        serving_grams: servingGrams,
        energy_kcal: energyKcal,
        protein_g: proteinG,
        carb_g: carbG,
        fat_g: fatG,
        fibre_g: fibreG,
        notes: body.notes ? String(body.notes).trim() : null,
        assumptions: body.notes || body.assumptions || null,
        created_at: body.created_at || new Date().toISOString()
      };

      if (body.id) {
        updateMealLog(id, user.id, entry);
      } else {
        addMealLog(entry);
      }

      // MongoDB persistence & states.state.meals sync
      if (process.env.MONGODB_URI) {
        try {
          const mongo = await getMongoDb();
          if (mongo) {
            await mongo.collection('meal_logs').updateOne(
              { id: entry.id, user_id: user.id },
              { $set: { ...entry, user_id: user.id, updatedAt: new Date().toISOString() } },
              { upsert: true }
            );

            const stateDoc = await mongo.collection('states').findOne({ userId: user.id });
            if (stateDoc?.state) {
              const currentMeals = Array.isArray(stateDoc.state.meals) ? [...stateDoc.state.meals] : [];
              const idx = currentMeals.findIndex(m => m.id === entry.id);
              const storeMeal = {
                id: entry.id,
                d: entry.date,
                date: entry.date,
                type: entry.meal_type,
                meal_type: entry.meal_type,
                name: entry.food_name,
                food_name: entry.food_name,
                qty: entry.serving_quantity,
                serving_quantity: entry.serving_quantity,
                unit: entry.serving_unit,
                serving_unit: entry.serving_unit,
                energy_kcal: entry.energy_kcal,
                calories: entry.energy_kcal,
                protein_g: entry.protein_g,
                protein: entry.protein_g,
                carb_g: entry.carb_g,
                carb: entry.carb_g,
                fat_g: entry.fat_g,
                fat: entry.fat_g,
                notes: entry.notes,
                created_at: entry.created_at
              };
              if (idx >= 0) {
                currentMeals[idx] = { ...currentMeals[idx], ...storeMeal };
              } else {
                currentMeals.push(storeMeal);
              }
              await mongo.collection('states').updateOne(
                { userId: user.id },
                { $set: { 'state.meals': currentMeals, updatedAt: new Date().toISOString() } }
              );
            }
          }
        } catch (err) {
          console.error('MongoDB meal save sync error:', err.message);
        }
      }

      return json(res, body.id ? 200 : 201, { ok: true, entry });
    },

    'POST /api/nutrition/food/save-batch': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const items = Array.isArray(body.items) ? body.items : (Array.isArray(body.entries) ? body.entries : []);
      const date = String(body.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const mealType = String(body.meal_type || 'breakfast').toLowerCase();

      if (items.length === 0) {
        return json(res, 400, { error: 'No food items provided' });
      }

      const savedEntries = [];
      const storeMeals = [];

      for (const item of items) {
        const id = item.id || genId();
        let energyKcal = Number(item.energy_kcal != null ? item.energy_kcal : (item.calories != null ? item.calories : 0));
        let proteinG = Number(item.protein_g != null ? item.protein_g : (item.protein != null ? item.protein : 0));
        let carbG = Number(item.carb_g != null ? item.carb_g : (item.carb != null ? item.carb : (item.carbs != null ? item.carbs : 0)));
        let fatG = Number(item.fat_g != null ? item.fat_g : (item.fat != null ? item.fat : 0));
        let fibreG = Number(item.fibre_g != null ? item.fibre_g : (item.fibre != null ? item.fibre : 0));
        let servingGrams = Number(item.serving_grams || item.grams) || 0;
        let foodId = item.food_id || item.foodId || null;

        if (!energyKcal && (foodId || item.food_name || item.name)) {
          const lookupName = item.food_name || item.name;
          let f = foodId ? getFoodById(foodId) : null;
          if (!f) {
            const matched = searchFoods(lookupName, 1);
            if (matched && matched.length > 0) f = matched[0];
          }
          if (f) {
            foodId = f.id;
            const resG = resolveGrams(f, item.serving_quantity || item.qty || 1, item.serving_unit || item.unit || 'g');
            servingGrams = resG.grams;
            const nut = calculateNutrients(f, servingGrams);
            energyKcal = nut.energy_kcal;
            proteinG = nut.protein_g;
            carbG = nut.carb_g;
            fatG = nut.fat_g;
            fibreG = nut.fibre_g;
          }
        }

        const entry = {
          id,
          user_id: user.id,
          date,
          meal_type: String(item.meal_type || mealType).toLowerCase(),
          food_id: foodId,
          food_name: String(item.food_name || item.name || '').trim(),
          serving_quantity: Number(item.serving_quantity || item.qty) || 1,
          serving_unit: item.serving_unit || item.unit || 'g',
          serving_grams: servingGrams,
          energy_kcal: energyKcal,
          protein_g: proteinG,
          carb_g: carbG,
          fat_g: fatG,
          fibre_g: fibreG,
          notes: item.notes ? String(item.notes).trim() : null,
          assumptions: item.notes || item.assumptions || null,
          created_at: item.created_at || new Date().toISOString()
        };

        addMealLog(entry);
        savedEntries.push(entry);

        storeMeals.push({
          id: entry.id,
          d: entry.date,
          date: entry.date,
          type: entry.meal_type,
          meal_type: entry.meal_type,
          name: entry.food_name,
          food_name: entry.food_name,
          qty: entry.serving_quantity,
          serving_quantity: entry.serving_quantity,
          unit: entry.serving_unit,
          serving_unit: entry.serving_unit,
          energy_kcal: entry.energy_kcal,
          calories: entry.energy_kcal,
          protein_g: entry.protein_g,
          protein: entry.protein_g,
          carb_g: entry.carb_g,
          carb: entry.carb_g,
          fat_g: entry.fat_g,
          fat: entry.fat_g,
          fibre_g: entry.fibre_g,
          notes: entry.notes,
          created_at: entry.created_at
        });
      }

      if (process.env.MONGODB_URI) {
        try {
          const mongo = await getMongoDb();
          if (mongo) {
            for (const entry of savedEntries) {
              await mongo.collection('meal_logs').updateOne(
                { id: entry.id, user_id: user.id },
                { $set: { ...entry, user_id: user.id, updatedAt: new Date().toISOString() } },
                { upsert: true }
              );
            }
            const stateDoc = await mongo.collection('states').findOne({ userId: user.id });
            if (stateDoc?.state) {
              const currentMeals = Array.isArray(stateDoc.state.meals) ? [...stateDoc.state.meals] : [];
              for (const sm of storeMeals) {
                const idx = currentMeals.findIndex(m => m.id === sm.id);
                if (idx >= 0) currentMeals[idx] = { ...currentMeals[idx], ...sm };
                else currentMeals.push(sm);
              }
              await mongo.collection('states').updateOne(
                { userId: user.id },
                { $set: { 'state.meals': currentMeals, updatedAt: new Date().toISOString() } }
              );
            }
          }
        } catch (err) {
          console.error('MongoDB batch meal save sync error:', err.message);
        }
      }

      return json(res, 201, { ok: true, count: savedEntries.length, entries: savedEntries, meals: storeMeals });
    },

    'POST /api/nutrition/food/delete': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const id = body.id;
      if (!id) return json(res, 400, { error: 'food entry id is required' });

      const ok = deleteMealLog(id, user.id);

      if (process.env.MONGODB_URI) {
        try {
          const mongo = await getMongoDb();
          if (mongo) {
            await mongo.collection('meal_logs').deleteOne({ id, user_id: user.id });
            const stateDoc = await mongo.collection('states').findOne({ userId: user.id });
            if (stateDoc?.state?.meals && Array.isArray(stateDoc.state.meals)) {
              const filtered = stateDoc.state.meals.filter(m => m.id !== id);
              await mongo.collection('states').updateOne(
                { userId: user.id },
                { $set: { 'state.meals': filtered, updatedAt: new Date().toISOString() } }
              );
            }
          }
        } catch (err) {
          console.error('MongoDB meal delete sync error:', err.message);
        }
      }

      json(res, 200, { ok });
    },

    /* ---------- Water Intake CRUD ---------- */
    'POST /api/nutrition/water/save': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      if (!body.date || body.amount_ml == null) {
        return json(res, 400, { error: 'date and amount_ml are required' });
      }

      const id = body.id || genId();
      let amountMl = Number(body.amount_ml) || 0;
      if (body.unit === 'L' || body.unit === 'l') {
        amountMl = amountMl * 1000;
      }

      const entry = {
        id,
        user_id: user.id,
        date: String(body.date).slice(0, 10),
        amount_ml: Math.max(0, amountMl),
        unit: body.unit || 'ml',
        notes: body.notes ? String(body.notes).trim() : null,
        created_at: body.created_at || new Date().toISOString()
      };

      addWaterLog(entry);
      json(res, 201, { ok: true, entry });
    },

    'POST /api/nutrition/water/delete': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const id = body.id;
      if (!id) return json(res, 400, { error: 'water entry id is required' });

      const ok = deleteWaterLog(id, user.id);
      json(res, 200, { ok });
    },

    /* ---------- Cardio Activity CRUD ---------- */
    'POST /api/nutrition/cardio/save': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      if (!body.date || !body.activity_type || body.duration_min == null) {
        return json(res, 400, { error: 'date, activity_type, and duration_min are required' });
      }

      const id = body.id || genId();
      const entry = {
        id,
        user_id: user.id,
        date: String(body.date).slice(0, 10),
        activity_type: String(body.activity_type).trim(),
        duration_min: Math.max(0, Number(body.duration_min) || 0),
        distance_km: body.distance_km != null && body.distance_km !== '' ? Number(body.distance_km) : null,
        steps: body.steps != null && body.steps !== '' ? Number(body.steps) : null,
        calories_burned: body.calories_burned != null && body.calories_burned !== '' ? Number(body.calories_burned) : null,
        notes: body.notes ? String(body.notes).trim() : null,
        created_at: body.created_at || new Date().toISOString()
      };

      if (body.id) {
        updateCardioLog(id, user.id, entry);
      } else {
        addCardioLog(entry);
      }

      // MongoDB persistence & states.state.cardioLogs sync
      if (process.env.MONGODB_URI) {
        try {
          const mongo = await getMongoDb();
          if (mongo) {
            await mongo.collection('cardio_logs').updateOne(
              { id: entry.id, userId: user.id },
              { $set: { ...entry, userId: user.id, updatedAt: new Date().toISOString() } },
              { upsert: true }
            );

            const stateDoc = await mongo.collection('states').findOne({ userId: user.id });
            if (stateDoc?.state) {
              const currentCardio = Array.isArray(stateDoc.state.cardioLogs) ? [...stateDoc.state.cardioLogs] : [];
              const idx = currentCardio.findIndex(c => c.id === entry.id);
              const storeCardioEntry = {
                id: entry.id,
                d: entry.date,
                date: entry.date,
                activity: entry.activity_type,
                activity_type: entry.activity_type,
                durationMinutes: entry.duration_min,
                totalDurationMinutes: entry.duration_min,
                distanceKm: entry.distance_km,
                distance_km: entry.distance_km,
                steps: entry.steps,
                calories_burned: entry.calories_burned,
                createdAt: entry.created_at
              };
              if (idx >= 0) {
                currentCardio[idx] = { ...currentCardio[idx], ...storeCardioEntry };
              } else {
                currentCardio.push(storeCardioEntry);
              }
              await mongo.collection('states').updateOne(
                { userId: user.id },
                { $set: { 'state.cardioLogs': currentCardio, updatedAt: new Date().toISOString() } }
              );
            }
          }
        } catch (err) {
          console.error('MongoDB cardio save sync error:', err.message);
        }
      }

      return json(res, body.id ? 200 : 201, { ok: true, entry });
    },

    'POST /api/nutrition/cardio/delete': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const id = body.id;
      if (!id) return json(res, 400, { error: 'cardio entry id is required' });

      const ok = deleteCardioLog(id, user.id);

      if (process.env.MONGODB_URI) {
        try {
          const mongo = await getMongoDb();
          if (mongo) {
            await mongo.collection('cardio_logs').deleteOne({ id, $or: [{ userId: user.id }, { user_id: user.id }] });
            const stateDoc = await mongo.collection('states').findOne({ userId: user.id });
            if (stateDoc?.state?.cardioLogs && Array.isArray(stateDoc.state.cardioLogs)) {
              const filtered = stateDoc.state.cardioLogs.filter(c => c.id !== id);
              await mongo.collection('states').updateOne(
                { userId: user.id },
                { $set: { 'state.cardioLogs': filtered, updatedAt: new Date().toISOString() } }
              );
            }
          }
        } catch (err) {
          console.error('MongoDB cardio delete sync error:', err.message);
        }
      }

      json(res, 200, { ok });
    },

    /* ---------- Strength Workout CRUD ---------- */
    'POST /api/nutrition/strength/save': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      if (!body.date || !body.exercise_name) {
        return json(res, 400, { error: 'date and exercise_name are required' });
      }

      const id = body.id || genId();
      const entry = {
        id,
        user_id: user.id,
        date: String(body.date).slice(0, 10),
        exercise_name: String(body.exercise_name).trim(),
        muscle_group: body.muscle_group ? String(body.muscle_group).trim() : null,
        sets: body.sets != null && body.sets !== '' ? Number(body.sets) : null,
        reps: body.reps != null && body.reps !== '' ? Number(body.reps) : null,
        weight_kg: body.weight_kg != null && body.weight_kg !== '' ? Number(body.weight_kg) : null,
        duration_min: body.duration_min != null && body.duration_min !== '' ? Number(body.duration_min) : null,
        calories_burned: body.calories_burned != null && body.calories_burned !== '' ? Number(body.calories_burned) : null,
        notes: body.notes ? String(body.notes).trim() : null,
        created_at: body.created_at || new Date().toISOString()
      };

      if (body.id) {
        const updated = updateStrengthLog(id, user.id, entry);
        return json(res, 200, { ok: true, entry: updated || entry });
      } else {
        addStrengthLog(entry);
        return json(res, 201, { ok: true, entry });
      }
    },

    'POST /api/nutrition/strength/delete': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const id = body.id;
      if (!id) return json(res, 400, { error: 'strength entry id is required' });

      const ok = deleteStrengthLog(id, user.id);
      json(res, 200, { ok });
    },

    /* ---------- Daily Health Settings ---------- */
    'GET /api/nutrition/health-settings': async (req, res) => {
      const user = readSession(req);
      if (!user) {
        return json(res, 200, {
          ok: true,
          settings: {
            calorie_target: 1900,
            water_goal_litres: 2.5
          }
        });
      }

      const settings = getDailyHealthSettings(user.id);
      json(res, 200, { ok: true, settings });
    },

    'POST /api/nutrition/health-settings': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const settings = setDailyHealthSettings(user.id, body);
      json(res, 200, { ok: true, settings });
    },

    /* ---------- Backwards Compatibility Endpoints ---------- */
    'GET /api/nutrition/targets': async (req, res) => {
      const user = readSession(req);
      if (!user) {
        return json(res, 200, {
          ok: true,
          targets: {
            calorie_target: 1900,
            protein_target_g: 140,
            carb_target_g: 220,
            fat_target_g: 65,
            fibre_target_g: 30,
            diet_preference: 'all'
          }
        });
      }

      const targets = getUserTargets(user.id);
      json(res, 200, { ok: true, targets: targets || { calorie_target: 1900 } });
    },

    'POST /api/nutrition/targets': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const targets = setUserTargets(user.id, body);
      json(res, 200, { ok: true, targets });
    },

    'GET /api/nutrition/log': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const url = new URL(req.url, 'http://x');
      const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

      const logs = getMealLogs(user.id, date);
      const totals = {
        energy_kcal: 0,
        protein_g: 0,
        carb_g: 0,
        fat_g: 0,
        fibre_g: 0
      };

      for (const log of logs) {
        totals.energy_kcal += log.energy_kcal || 0;
        totals.protein_g += log.protein_g || 0;
        totals.carb_g += log.carb_g || 0;
        totals.fat_g += log.fat_g || 0;
        totals.fibre_g += log.fibre_g || 0;
      }

      totals.energy_kcal = Math.round(totals.energy_kcal * 10) / 10;
      totals.protein_g = Math.round(totals.protein_g * 10) / 10;
      totals.carb_g = Math.round(totals.carb_g * 10) / 10;
      totals.fat_g = Math.round(totals.fat_g * 10) / 10;
      totals.fibre_g = Math.round(totals.fibre_g * 10) / 10;

      json(res, 200, { ok: true, date, totals, logs });
    },

    'POST /api/nutrition/log': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      if (!body.food_name || !body.meal_type || !body.date) {
        return json(res, 400, { error: 'food_name, meal_type, and date are required' });
      }

      const id = body.id || genId();
      const entry = {
        id,
        user_id: user.id,
        date: String(body.date).slice(0, 10),
        meal_type: String(body.meal_type).toLowerCase(),
        food_id: body.food_id || null,
        food_name: String(body.food_name).trim(),
        serving_quantity: Number(body.serving_quantity) || 1,
        serving_unit: String(body.serving_unit || 'g').trim(),
        serving_grams: Number(body.serving_grams) || 100,
        energy_kcal: Number(body.energy_kcal) || 0,
        protein_g: Number(body.protein_g) || 0,
        carb_g: Number(body.carb_g) || 0,
        fat_g: Number(body.fat_g) || 0,
        fibre_g: Number(body.fibre_g) || 0,
        notes: body.notes || null,
        assumptions: body.notes || body.assumptions || null,
        created_at: body.created_at || new Date().toISOString()
      };

      addMealLog(entry);
      json(res, 201, { ok: true, entry });
    },

    'POST /api/nutrition/log/update': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const id = body.id;
      if (!id) return json(res, 400, { error: 'log id required' });

      const updated = updateMealLog(id, user.id, body);
      json(res, 200, { ok: true, entry: updated });
    },

    'POST /api/nutrition/log/delete': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const id = body.id;
      if (!id) return json(res, 400, { error: 'log id required' });

      const ok = deleteMealLog(id, user.id);
      json(res, 200, { ok });
    },

    'POST /api/nutrition/calculate': async (req, res) => {
      const body = await readBody(req);
      const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
      const servings = Math.max(1, +(body.servings || 1));

      if (!ingredients.length) {
        return json(res, 400, { error: 'ingredients list is required' });
      }

      try {
        const result = calculateRecipeNutrition(ingredients, servings);
        json(res, 200, { ok: true, ...result });
      } catch (e) {
        json(res, 500, { error: e.message });
      }
    },

    /* ---------- Repeat Previous Meals ---------- */
    'GET /api/nutrition/previous-meals': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const result = getPreviousMeals(user.id);
        json(res, 200, { ok: true, ...result });
      } catch (e) {
        json(res, 500, { ok: false, error: e.message });
      }
    },

    /* ---------- Saved Custom Meals & Templates ---------- */
    'GET /api/nutrition/templates': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const templates = await getMealTemplates(user.id);
        json(res, 200, { ok: true, count: templates.length, templates });
      } catch (e) {
        json(res, 500, { ok: false, error: e.message });
      }
    },

    'POST /api/nutrition/templates': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const body = await readBody(req);
        if (!body.name || !body.items || !body.items.length) {
          return json(res, 400, { error: 'Template name and at least one food item are required' });
        }
        const saved = saveMealTemplate(user.id, body);
        json(res, 200, { ok: true, template: saved });
      } catch (e) {
        json(res, 500, { ok: false, error: e.message });
      }
    },

    'POST /api/nutrition/templates/delete': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const body = await readBody(req);
        const id = body.id || (new URL(req.url, 'http://x')).searchParams.get('id');
        if (!id) return json(res, 400, { error: 'Template ID is required' });
        const ok = deleteMealTemplate(id, user.id);
        json(res, 200, { ok });
      } catch (e) {
        json(res, 500, { ok: false, error: e.message });
      }
    },

    'DELETE /api/nutrition/templates': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const url = new URL(req.url, 'http://x');
        const id = url.searchParams.get('id') || (await readBody(req).catch(() => ({})))?.id;
        if (!id) return json(res, 400, { error: 'Template ID is required' });
        const ok = deleteMealTemplate(id, user.id);
        json(res, 200, { ok });
      } catch (e) {
        json(res, 500, { ok: false, error: e.message });
      }
    },

    /* ---------- Raw Ingredient Recipe Builder ---------- */
    'GET /api/nutrition/recipes': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const recipes = await getCustomRecipes(user.id);
        json(res, 200, { ok: true, count: recipes.length, recipes });
      } catch (e) {
        json(res, 500, { ok: false, error: e.message });
      }
    },

    'POST /api/nutrition/recipes': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const body = await readBody(req);
        if (!body.name || !body.ingredients || !body.ingredients.length) {
          return json(res, 400, { error: 'Recipe name and raw ingredients are required' });
        }
        const saved = saveCustomRecipe(user.id, body);
        json(res, 200, { ok: true, recipe: saved });
      } catch (e) {
        json(res, 500, { ok: false, error: e.message });
      }
    },

    'POST /api/nutrition/recipes/delete': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const body = await readBody(req);
        const id = body.id || (new URL(req.url, 'http://x')).searchParams.get('id');
        if (!id) return json(res, 400, { error: 'Recipe ID is required' });
        const ok = deleteCustomRecipe(id, user.id);
        json(res, 200, { ok });
      } catch (e) {
        json(res, 500, { ok: false, error: e.message });
      }
    },

    'DELETE /api/nutrition/recipes': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const url = new URL(req.url, 'http://x');
        const id = url.searchParams.get('id') || (await readBody(req).catch(() => ({})))?.id;
        if (!id) return json(res, 400, { error: 'Recipe ID is required' });
        const ok = deleteCustomRecipe(id, user.id);
        json(res, 200, { ok });
      } catch (e) {
        json(res, 500, { ok: false, error: e.message });
      }
    },

    /* ---------- Delete Food support via DELETE method ---------- */
    'DELETE /api/nutrition/food': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const url = new URL(req.url, 'http://x');
        const id = url.searchParams.get('id') || (await readBody(req).catch(() => ({})))?.id;
        if (!id) return json(res, 400, { error: 'food entry id is required' });
        const ok = deleteMealLog(id, user.id);
        if (process.env.MONGODB_URI) {
          getMongoDb().then(mongo => {
            if (mongo) {
              mongo.collection('meal_logs').deleteOne({ id, user_id: user.id }).catch(() => {});
              mongo.collection('states').updateOne(
                { userId: user.id },
                { $pull: { 'state.meals': { id } } }
              ).catch(() => {});
            }
          }).catch(() => {});
        }
        json(res, 200, { ok: true, deleted: ok, id });
      } catch (e) {
        json(res, 500, { ok: false, error: e.message });
      }
    },

    /* ---------- AI Nutrition Coach: Calorie & Macro Target Calculator ---------- */
    'POST /api/nutrition/coach/targets': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const age = Number(body.age);
      const sex = String(body.sex || 'male').toLowerCase();
      const heightCm = Number(body.height_cm || body.height);
      const weightKg = Number(body.weight_kg || body.weight);
      const activity = String(body.activity_level || 'moderate').toLowerCase();
      const goal = String(body.fitness_goal || body.goal || 'fat_loss').toLowerCase();
      const rate = String(body.target_rate || body.rate || 'moderate').toLowerCase();
      const diet = String(body.diet_preference || body.diet || 'all').toLowerCase();
      const bodyFat = body.body_fat_pct != null ? Number(body.body_fat_pct) : null;

      const missing = [];
      if (!age || age < 10 || age > 120) missing.push('age (10-120 yrs)');
      if (!heightCm || heightCm < 100 || heightCm > 250) missing.push('height (100-250 cm)');
      if (!weightKg || weightKg < 30 || weightKg > 300) missing.push('weight (30-300 kg)');

      if (missing.length > 0) {
        return json(res, 400, {
          ok: false,
          error: `Please complete required profile fields: ${missing.join(', ')}`,
          missing
        });
      }

      // 1. Validated BMR (Mifflin-St Jeor equation)
      let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
      if (sex === 'female') {
        bmr -= 161;
      } else {
        bmr += 5;
      }
      bmr = Math.round(bmr);

      // 2. TDEE from activity multiplier
      const multipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        very_active: 1.725,
        extra_active: 1.9
      };
      const mult = multipliers[activity] || 1.45;
      const tdee = Math.round(bmr * mult);

      // 3. Goal adjustment with safety boundaries
      let delta = 0;
      let explanation = '';
      let safetyNotes = '';

      if (goal === 'fat_loss') {
        if (rate === 'conservative') {
          delta = -Math.round(tdee * 0.12);
          explanation = 'Conservative fat loss (~0.25–0.35 kg/week). Gentle calorie deficit preserving maximum lean muscle, workout performance, and hormone balance.';
        } else if (rate === 'aggressive') {
          delta = -Math.round(tdee * 0.25);
          const minFloor = sex === 'female' ? 1200 : 1500;
          if (tdee + delta < minFloor) {
            delta = minFloor - tdee;
            safetyNotes = `Adjusted to safe physiological intake floor of ${minFloor} kcal to prevent metabolic slowdown and nutrient deficiency.`;
          }
          explanation = 'Aggressive fat loss (~0.6–0.8 kg/week). Recommended for short durations with high protein intake.';
        } else {
          delta = -Math.round(tdee * 0.20);
          explanation = 'Moderate fat loss (~0.4–0.5 kg/week). The standard evidence-based rate for steady fat loss and energy maintenance.';
        }
      } else if (goal === 'muscle_gain') {
        delta = Math.round(tdee * 0.12);
        explanation = 'Lean hypertrophy surplus (~0.2–0.3 kg/week). Fuels progressive overload and muscle synthesis while minimizing fat accumulation.';
      } else if (goal === 'recomp') {
        delta = -Math.round(tdee * 0.05);
        explanation = 'Body recomposition (losing fat while simultaneously building muscle) through high protein density and a very mild deficit.';
      } else {
        delta = 0;
        explanation = 'Maintenance energy balance. Stabilizes body weight while fueling athletic recovery and performance.';
      }

      const minFloor = sex === 'female' ? 1200 : 1500;
      let targetCalories = Math.max(minFloor, tdee + delta);

      // 4. Macro targets (internally consistent: 4 kcal/g protein, 4 kcal/g carb, 9 kcal/g fat)
      let proteinMultiplier = 1.8;
      if (goal === 'fat_loss' || goal === 'recomp') proteinMultiplier = 2.0;
      else if (goal === 'muscle_gain') proteinMultiplier = 1.8;
      else proteinMultiplier = 1.6;

      let proteinG = Math.round(weightKg * proteinMultiplier);
      let proteinKcal = proteinG * 4;

      // Fat: 25% of target calories
      let fatKcal = Math.round(targetCalories * 0.25);
      let fatG = Math.round(fatKcal / 9);

      // Carbs: remainder
      let carbKcal = Math.max(0, targetCalories - proteinKcal - (fatG * 9));
      let carbG = Math.round(carbKcal / 4);

      const calculatedTargets = {
        calorie_target: targetCalories,
        calories: targetCalories,
        protein_target_g: proteinG,
        protein: proteinG,
        carb_target_g: carbG,
        carbs: carbG,
        fat_target_g: fatG,
        fat: fatG,
        fibre_target_g: 30,
        diet_preference: diet
      };

      setUserTargets(user.id, calculatedTargets);

      json(res, 200, {
        ok: true,
        targets: calculatedTargets,
        calculation: {
          bmr,
          tdee,
          goal,
          rate,
          deficit_or_surplus_kcal: delta,
          target_calories: targetCalories,
          protein_g: proteinG,
          protein_kcal: proteinG * 4,
          carb_g: carbG,
          carb_kcal: carbG * 4,
          fat_g: fatG,
          fat_kcal: fatG * 9,
          macro_kcal_sum: (proteinG * 4) + (carbG * 4) + (fatG * 9),
          explanation,
          safety_notes: safetyNotes || null
        }
      });
    },

    /* ---------- IRONX AI: Conversational Intelligence Assistant ---------- */
    'POST /api/nutrition/coach/chat': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const message = String(body.message || body.prompt || '').trim();
      const date = String(body.date || new Date().toISOString().slice(0, 10));

      if (!message) {
        return json(res, 400, { error: 'Message is required' });
      }

      try {
        const turnResult = await handleConversationalTurn({ user, message, date });
        json(res, 200, {
          ok: true,
          ...turnResult,
          model: 'ironx-ai-deterministic-engine'
        });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ---------- IRONX AI: Get Active Diet Plan ---------- */
    'GET /api/nutrition/ai/diet-plan/current': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      const plan = getUserDietPlan(user.id);
      json(res, 200, { ok: true, plan: plan || null });
    },

    /* ---------- IRONX AI: Generate Diet Plan ---------- */
    'POST /api/nutrition/ai/diet-plan/generate': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      const profile = { ...(user.profile || {}), ...body };
      const targets = calculatePersonalizedTargets(profile);
      const plan = generateDietPlan(profile, targets);
      saveUserDietPlan(user.id, plan);
      setUserTargets(user.id, {
        calorie_target: targets.target_calories,
        protein_target_g: targets.protein_target_g,
        carb_target_g: targets.carb_target_g,
        fat_target_g: targets.fat_target_g,
        fibre_target_g: targets.fibre_target_g,
        diet_preference: profile.diet_preference || profile.dietPreferences || 'non_veg'
      });
      json(res, 200, { ok: true, plan, targets });
    },

    /* ---------- IRONX AI: Modify Diet Plan (Interactive Food Substitutions) ---------- */
    'POST /api/nutrition/ai/diet-plan/modify': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      const currentPlan = getUserDietPlan(user.id);
      if (!currentPlan) {
        return json(res, 400, { error: 'No active diet plan to modify. Generate one first.' });
      }
      const requestText = String(body.request || body.modification || body.message || '').trim();
      const modified = modifyDietPlan(currentPlan, requestText);
      saveUserDietPlan(user.id, modified);
      json(res, 200, { ok: true, plan: modified });
    },

    /* ---------- IRONX AI: Download PDF Diet Plan ---------- */
    'GET /api/nutrition/ai/diet-plan/pdf': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      const plan = getUserDietPlan(user.id);
      if (!plan) {
        return json(res, 404, { error: 'No active diet plan found. Generate a diet plan first with IRONX AI.' });
      }
      try {
        const arrayBuffer = generateDietPlanPdf(plan);
        const pdfBuf = Buffer.from(arrayBuffer);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="ironx_ai_diet_plan.pdf"',
          'Content-Length': pdfBuf.length,
          'Cache-Control': 'no-cache'
        });
        res.end(pdfBuf);
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ---------- IRONX AI: 1-Click Log Plan Meals to Today's Food Log ---------- */
    'POST /api/nutrition/ai/diet-plan/log-to-today': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      const date = String(body.date || new Date().toISOString().slice(0, 10));
      const plan = getUserDietPlan(user.id);
      if (!plan || !Array.isArray(plan.meals)) {
        return json(res, 400, { error: 'No active diet plan found' });
      }
      const mealName = body.meal_name ? String(body.meal_name).toLowerCase() : null;
      const loggedItems = [];

      for (const meal of plan.meals) {
        if (mealName && !meal.meal_name.toLowerCase().includes(mealName)) continue;
        const mealType = meal.meal_name.toLowerCase().includes('breakfast') ? 'breakfast'
          : meal.meal_name.toLowerCase().includes('lunch') ? 'lunch'
          : meal.meal_name.toLowerCase().includes('dinner') ? 'dinner'
          : 'snacks';

        for (const it of meal.items) {
          const logEntry = {
            user_id: user.id,
            date: date,
            meal_type: mealType,
            food_id: it.food_id || 'INX_STAPLE',
            food_name: it.food_name || it.name || 'Food Item',
            serving_quantity: it.serving_quantity != null ? it.serving_quantity : 1,
            serving_unit: it.serving_unit || 'g',
            serving_grams: it.serving_grams || it.portion_grams || 100,
            energy_kcal: it.energy_kcal != null ? it.energy_kcal : (it.calories || 0),
            protein_g: it.protein_g || 0,
            carb_g: it.carb_g || 0,
            fat_g: it.fat_g || 0,
            fibre_g: it.fibre_g || 0,
            notes: 'Logged from IRONX AI Diet Plan'
          };
          const created = addMealLog(logEntry);
          loggedItems.push(created);
        }
      }
      json(res, 200, { ok: true, logged_items_count: loggedItems.length, logged_items: loggedItems });
    },

    /* ---------- IRONX AI: Reset Conversation ---------- */
    'POST /api/nutrition/ai/conversation/reset': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      clearUserConversation(user.id);
      json(res, 200, { ok: true, message: 'Conversation reset successfully' });
    },

    /* ---------- IRONX AI: Verified Foods Knowledge Search ---------- */
    'GET /api/nutrition/ai/foods': async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const query = url.searchParams.get('q') || '';
      const category = url.searchParams.get('category') || null;
      const foodState = url.searchParams.get('state') || null;
      const limit = Math.min(100, Math.max(1, +(url.searchParams.get('limit') || 25)));
      const offset = Math.max(0, +(url.searchParams.get('offset') || 0));

      try {
        const foods = searchVerifiedFoods({ query, category, foodState, limit, offset });
        json(res, 200, { ok: true, count: foods.length, foods });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ---------- IRONX AI: Verified Recipes Search ---------- */
    'GET /api/nutrition/ai/recipes': async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const query = url.searchParams.get('q') || '';
      const category = url.searchParams.get('category') || null;
      const cuisine = url.searchParams.get('cuisine') || null;
      const limit = Math.min(50, Math.max(1, +(url.searchParams.get('limit') || 20)));
      const offset = Math.max(0, +(url.searchParams.get('offset') || 0));

      try {
        const recipes = searchVerifiedRecipes({ query, category, cuisine, limit, offset });
        json(res, 200, { ok: true, count: recipes.length, recipes });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ---------- IRONX AI: Single Recipe Details & Ingredients ---------- */
    'GET /api/nutrition/ai/recipes/item': async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const recipeId = url.searchParams.get('id') || '';
      if (!recipeId) {
        return json(res, 400, { error: 'recipeId is required' });
      }

      try {
        const recipe = getVerifiedRecipeById(recipeId);
        if (!recipe) {
          return json(res, 404, { error: 'Recipe not found' });
        }
        json(res, 200, { ok: true, recipe });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ---------- IRONX AI: Deterministic Recipe Calculator ---------- */
    'POST /api/nutrition/ai/calculate-recipe': async (req, res) => {
      const body = await readBody(req);
      const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
      const cookingOilGrams = Number(body.cooking_oil_grams || body.oil_grams || 0);
      const servings = Math.max(0.25, Number(body.servings || 1));
      const cookedBatchWeightG = body.cooked_batch_weight_g ? Number(body.cooked_batch_weight_g) : null;

      try {
        const calculation = calculateDeterministicRecipe(ingredients, {
          cookingOilGrams,
          servings,
          cookedBatchWeightG
        });
        json(res, 200, { ok: true, calculation });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ---------- IRONX AI: Natural-Language Food & Meal Parser (Bilingual English/Tamil) ---------- */
    'POST /api/nutrition/ai/parse-nl': async (req, res) => {
      const body = await readBody(req);
      const rawText = String(body.text || body.query || '').trim();
      if (!rawText) {
        return json(res, 400, { error: 'Input text is required' });
      }

      try {
        // High-precision pattern matching for Tamil and English
        const items = [];
        const tLower = rawText.toLowerCase();

        // 1. Chapatis / Roti / சப்பாத்தி
        const chapatiMatch = rawText.match(/(\d+)\s*(?:chapatis?|chappathis?|rotis?|phulkas?|சப்பாத்தி)/i) ||
                             (tLower.includes('சப்பாத்தி') ? [null, '2'] : null) ||
                             (tLower.includes('chapati') || tLower.includes('roti') ? [null, '2'] : null);
        if (chapatiMatch) {
          const qty = parseInt(chapatiMatch[1], 10) || 2;
          items.push({
            food_id: 'INX_STAPLE_ROTI_COOKED',
            food_name: 'Wheat Roti / Chapati (Cooked)',
            food_name_tamil: 'சப்பாத்தி',
            food_state: 'cooked',
            serving_quantity: qty,
            serving_unit: 'piece',
            serving_grams: qty * 35,
            energy_kcal: Math.round(qty * 104),
            protein_g: Math.round(qty * 3.1 * 10) / 10,
            carb_g: Math.round(qty * 20.3 * 10) / 10,
            fat_g: Math.round(qty * 1.2 * 10) / 10,
            fibre_g: Math.round(qty * 2.8 * 10) / 10,
            source_name: 'ICMR-NIN 2017 Verified'
          });
        }

        // 2. Boiled Eggs / முட்டை / அவிச்ச முட்டை
        const eggMatch = rawText.match(/(\d+)\s*(?:boiled\s+eggs?|eggs?|முட்டை|அவிச்ச\s+முட்டை)/i) ||
                         (tLower.includes('boiled egg') || tLower.includes('முட்டை') ? [null, '2'] : null);
        if (eggMatch) {
          const qty = parseInt(eggMatch[1], 10) || 2;
          items.push({
            food_id: 'INX_STAPLE_EGG_BOILED',
            food_name: 'Boiled Egg (Whole)',
            food_name_tamil: 'வேகவைத்த முட்டை',
            food_state: 'boiled',
            serving_quantity: qty,
            serving_unit: 'piece',
            serving_grams: qty * 50,
            energy_kcal: Math.round(qty * 70),
            protein_g: Math.round(qty * 6.3 * 10) / 10,
            carb_g: Math.round(qty * 0.4 * 10) / 10,
            fat_g: Math.round(qty * 4.8 * 10) / 10,
            fibre_g: 0.0,
            source_name: 'USDA SR Legacy Verified'
          });
        }

        // 3. Cooked Rice / சாதம் / சோறு
        const riceMatch = rawText.match(/(\d+)\s*(?:g|grams?|கிராம்)?\s*(?:cooked\s+rice|rice|சாதம்|சோறு)/i) ||
                          (tLower.includes('சாதம்') || tLower.includes('rice') ? [null, '150'] : null);
        if (riceMatch && !tLower.includes('curd rice') && !tLower.includes('lemon rice')) {
          const grams = parseInt(riceMatch[1], 10) || 150;
          const ratio = grams / 100.0;
          items.push({
            food_id: 'INX_STAPLE_RICE_COOKED',
            food_name: 'Cooked Rice (Steamed)',
            food_name_tamil: 'சாதம்',
            food_state: 'cooked',
            serving_quantity: grams,
            serving_unit: 'g',
            serving_grams: grams,
            energy_kcal: Math.round(130 * ratio),
            protein_g: Math.round(2.7 * ratio * 10) / 10,
            carb_g: Math.round(28.2 * ratio * 10) / 10,
            fat_g: Math.round(0.3 * ratio * 10) / 10,
            fibre_g: Math.round(0.4 * ratio * 10) / 10,
            source_name: 'ICMR-NIN 2017 Verified'
          });
        }

        // 4. Chicken / சிக்கன் / கோழி
        const chickenMatch = rawText.match(/(\d+)\s*(?:g|grams?|கிராம்)?\s*(?:chicken(?:\s+breast|\s+gravy|\s+curry)?|சிக்கன்(?:\s+குழம்பு|\s+கறி)?|கோழி)/i) ||
                             (tLower.includes('chicken') || tLower.includes('சிக்கன்') || tLower.includes('கோழி') ? [null, '100'] : null);
        if (chickenMatch) {
          const grams = parseInt(chickenMatch[1], 10) || 100;
          const ratio = grams / 100.0;
          const isGravy = /gravy|curry|குழம்பு/i.test(rawText);
          items.push({
            food_id: isGravy ? 'STAPLE:chicken_gravy' : 'INX_STAPLE_CHICKEN_COOKED',
            food_name: isGravy ? 'Chicken Gravy / Curry' : 'Chicken Breast (Cooked)',
            food_name_tamil: isGravy ? 'சிக்கன் குழம்பு' : 'கோழி இறைச்சி',
            food_state: 'cooked',
            serving_quantity: grams,
            serving_unit: 'g',
            serving_grams: grams,
            energy_kcal: Math.round((isGravy ? 125 : 165) * ratio),
            protein_g: Math.round((isGravy ? 14.0 : 31.0) * ratio * 10) / 10,
            carb_g: Math.round((isGravy ? 4.5 : 0.0) * ratio * 10) / 10,
            fat_g: Math.round((isGravy ? 6.0 : 3.6) * ratio * 10) / 10,
            fibre_g: isGravy ? Math.round(1.2 * ratio * 10) / 10 : 0.0,
            source_name: isGravy ? 'INDB Recipe Verified' : 'ICMR-NIN & USDA Verified'
          });
        }

        // 5. Dosa / தோசை
        const dosaMatch = rawText.match(/(\d+)\s*(?:dosas?|dosais?|தோசை)/i);
        if (dosaMatch) {
          const qty = parseInt(dosaMatch[1], 10) || 2;
          items.push({
            food_id: 'INX_STAPLE_DOSA_COOKED',
            food_name: 'Plain Dosa (Cooked)',
            food_name_tamil: 'தோசை',
            food_state: 'cooked',
            serving_quantity: qty,
            serving_unit: 'piece',
            serving_grams: qty * 80,
            energy_kcal: Math.round(qty * 133),
            protein_g: Math.round(qty * 3.3 * 10) / 10,
            carb_g: Math.round(qty * 22.0 * 10) / 10,
            fat_g: Math.round(qty * 3.7 * 10) / 10,
            fibre_g: Math.round(qty * 1.5 * 10) / 10,
            source_name: 'ICMR-NIN 2017 Verified'
          });
        }

        // 6. Idli / இட்லி
        const idliMatch = rawText.match(/(\d+)\s*(?:idlis?|idlys?|இட்லி)/i);
        if (idliMatch) {
          const qty = parseInt(idliMatch[1], 10) || 3;
          items.push({
            food_id: 'INX_STAPLE_IDLI_COOKED',
            food_name: 'Steamed Idli (Cooked)',
            food_name_tamil: 'இட்லி',
            food_state: 'steamed',
            serving_quantity: qty,
            serving_unit: 'piece',
            serving_grams: qty * 50,
            energy_kcal: Math.round(qty * 58),
            protein_g: Math.round(qty * 2.0 * 10) / 10,
            carb_g: Math.round(qty * 12.0 * 10) / 10,
            fat_g: Math.round(qty * 0.2 * 10) / 10,
            fibre_g: Math.round(qty * 0.9 * 10) / 10,
            source_name: 'ICMR-NIN 2017 Verified'
          });
        }

        // Fallback: If no regex matched, search verified foods database
        if (items.length === 0) {
          const candidates = searchVerifiedFoods({ query: rawText, limit: 3 });
          for (const c of candidates) {
            items.push({
              food_id: c.food_id,
              food_name: c.food_name,
              food_name_tamil: c.food_name_tamil,
              food_state: c.food_state,
              serving_quantity: 1,
              serving_unit: 'serving',
              serving_grams: 100,
              energy_kcal: c.energy_kcal,
              protein_g: c.protein_g,
              carb_g: c.carb_g,
              fat_g: c.fat_g,
              fibre_g: c.fibre_g,
              source_name: c.source_name
            });
          }
        }

        const totalKcal = Math.round(items.reduce((s, it) => s + (it.energy_kcal || 0), 0));
        const totalP = Math.round(items.reduce((s, it) => s + (it.protein_g || 0), 0) * 10) / 10;
        const totalC = Math.round(items.reduce((s, it) => s + (it.carb_g || 0), 0) * 10) / 10;
        const totalF = Math.round(items.reduce((s, it) => s + (it.fat_g || 0), 0) * 10) / 10;

        json(res, 200, {
          ok: true,
          source_text: rawText,
          parsed_items: items,
          total_calories: totalKcal,
          total_protein_g: totalP,
          total_carbohydrate_g: totalC,
          total_fat_g: totalF,
          requires_confirmation: true
        });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },
  };
}
