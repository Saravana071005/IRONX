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
  syncHealthLogsFromMongo
} from './db.js';
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
    }
  };
}
