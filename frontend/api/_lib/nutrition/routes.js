/**
 * Daily Health Log & Nutrition HTTP API Routes
 * Manual food intake, water consumption, cardio activity, strength training,
 * and daily summaries with a 1,900 kcal calorie target.
 * Completely free of external AI dependencies.
 */

import crypto from 'node:crypto';
import { getMongoDb } from '../db/mongo.js';
import { extractTextFromPdf, parseDietPlanText } from './pdf_importer.js';
import { calculateNutritionTargets, calculateMealPlanComparison, calculateCheatMealImpact } from './planner.js';
import {
  getSavedDietPlans,
  getSavedDietPlanById,
  saveSavedDietPlan,
  deleteSavedDietPlan,
  setActiveDietPlan,
  getDailyMealPlan,
  saveDailyMealPlan,
  updateDailyMealItem,
  toggleDailyMealStatus,
  getUserNutritionGoals,
  saveUserNutritionGoals,
  getCanonicalUserNutritionGoals,
  saveCanonicalCalorieGoal,
  getUserAvailableFoods,
  saveUserAvailableFoods,
  getCheatMealLogs,
  addCheatMealLog,
  deleteCheatMealLog,
  getNotificationPreferences,
  saveNotificationPreferences,
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
  calculateDeterministicRecipe
} from './db.js';
import {
  calculatePersonalizedTargets
} from './knowledge.js';
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
    /* ---------- Food Search & Details (For nutrition dataset lookup & manual entry) ---------- */
    'GET /api/nutrition/search': async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const q = url.searchParams.get('q') || '';
      const group = url.searchParams.get('group') || null;
      const limit = Math.min(50, Math.max(1, +(url.searchParams.get('limit') || 20)));

      try {
        const results = searchFoods(q, limit, group);
        json(res, 200, {
          ok: true,
          count: results.length,
          foods: results,
          results: results,
          message: results.length === 0 ? 'Food not found in dataset.' : undefined
        });
      } catch (e) {
        json(res, 500, { error: e.message });
      }
    },

    'GET /api/nutrition/food': async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const id = url.searchParams.get('id');
      if (!id) return json(res, 400, { error: 'food id required' });

      const food = getFoodById(id);
      if (!food) return json(res, 404, { ok: false, error: 'Food not found in dataset.' });

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

    /* ---------- Verified Foods Dataset Search ---------- */
    'GET /api/nutrition/foods': async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const query = url.searchParams.get('q') || '';
      const category = url.searchParams.get('category') || null;
      const foodState = url.searchParams.get('state') || null;
      const limit = Math.min(100, Math.max(1, +(url.searchParams.get('limit') || 25)));
      const offset = Math.max(0, +(url.searchParams.get('offset') || 0));

      try {
        const foods = searchVerifiedFoods({ query, category, foodState, limit, offset });
        json(res, 200, {
          ok: true,
          count: foods.length,
          foods,
          message: foods.length === 0 ? 'Food not found in dataset.' : undefined
        });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'GET /api/nutrition/ai/foods': async (req, res) => {
      // Compatibility alias for /api/nutrition/foods
      const url = new URL(req.url, 'http://x');
      const query = url.searchParams.get('q') || '';
      const category = url.searchParams.get('category') || null;
      const foodState = url.searchParams.get('state') || null;
      const limit = Math.min(100, Math.max(1, +(url.searchParams.get('limit') || 25)));
      const offset = Math.max(0, +(url.searchParams.get('offset') || 0));

      try {
        const foods = searchVerifiedFoods({ query, category, foodState, limit, offset });
        json(res, 200, {
          ok: true,
          count: foods.length,
          foods,
          message: foods.length === 0 ? 'Food not found in dataset.' : undefined
        });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ---------- Verified Recipes Search ---------- */
    'GET /api/nutrition/verified-recipes': async (req, res) => {
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

    'GET /api/nutrition/ai/recipes': async (req, res) => {
      // Compatibility alias
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

    /* ---------- Recipe Details & Ingredients ---------- */
    'GET /api/nutrition/verified-recipes/item': async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const recipeId = url.searchParams.get('id') || '';
      if (!recipeId) {
        return json(res, 400, { error: 'recipeId is required' });
      }

      try {
        const recipe = getVerifiedRecipeById(recipeId);
        if (!recipe) {
          return json(res, 404, { error: 'Recipe not found in dataset' });
        }
        json(res, 200, { ok: true, recipe });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'GET /api/nutrition/ai/recipes/item': async (req, res) => {
      // Compatibility alias
      const url = new URL(req.url, 'http://x');
      const recipeId = url.searchParams.get('id') || '';
      if (!recipeId) {
        return json(res, 400, { error: 'recipeId is required' });
      }

      try {
        const recipe = getVerifiedRecipeById(recipeId);
        if (!recipe) {
          return json(res, 404, { error: 'Recipe not found in dataset' });
        }
        json(res, 200, { ok: true, recipe });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ---------- Deterministic Recipe Calculator ---------- */
    'POST /api/nutrition/calculate-recipe': async (req, res) => {
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

    'POST /api/nutrition/ai/calculate-recipe': async (req, res) => {
      // Compatibility alias
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

    /* ==================== MODULE 1: PDF DIET PLAN IMPORTER ==================== */
    'POST /api/nutrition/pdf/parse': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      try {
        const body = await readBody(req);
        let text = body.text || '';

        if (!text && body.pdfBase64) {
          const pdfBuffer = Buffer.from(body.pdfBase64, 'base64');
          text = await extractTextFromPdf(pdfBuffer);
        }

        if (!text || text.trim().length === 0) {
          return json(res, 400, { error: 'No text or valid PDF document could be extracted' });
        }

        const parsedPlan = parseDietPlanText(text);
        json(res, 200, { ok: true, ...parsedPlan });
      } catch (err) {
        console.error('PDF parse error:', err);
        json(res, 500, { error: err.message || 'Failed to parse diet plan PDF' });
      }
    },

    /* ==================== MODULE 2: SAVED DIET PLANS ==================== */
    'GET /api/nutrition/plans': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      try {
        const plans = getSavedDietPlans(user.id);
        json(res, 200, { ok: true, plans });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'GET /api/nutrition/plans/item': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const url = new URL(req.url, 'http://x');
      const id = url.searchParams.get('id');
      if (!id) return json(res, 400, { error: 'Plan id is required' });

      try {
        const plan = getSavedDietPlanById(id, user.id);
        if (!plan) return json(res, 404, { error: 'Diet plan not found' });
        json(res, 200, { ok: true, plan });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/plans/save': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      if (!body.name || !body.meals) {
        return json(res, 400, { error: 'Plan name and meals are required' });
      }

      const id = body.id || genId();
      const plan = {
        id,
        user_id: user.id,
        name: String(body.name).trim(),
        is_active: Boolean(body.is_active),
        meals: body.meals,
        source_pdf_name: body.source_pdf_name ? String(body.source_pdf_name).trim() : null,
        created_at: body.created_at || new Date().toISOString()
      };

      try {
        const saved = saveSavedDietPlan(plan);

        // MongoDB sync
        if (process.env.MONGODB_URI) {
          try {
            const mongo = await getMongoDb();
            if (mongo) {
              await mongo.collection('saved_diet_plans').updateOne(
                { id: saved.id, user_id: user.id },
                { $set: { ...saved, updatedAt: new Date().toISOString() } },
                { upsert: true }
              );
            }
          } catch (e) {
            console.error('Mongo saved_diet_plans sync error:', e.message);
          }
        }

        json(res, 200, { ok: true, plan: saved });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/plans/active': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      if (!body.id) return json(res, 400, { error: 'Plan id is required' });

      try {
        const ok = setActiveDietPlan(body.id, user.id);
        if (!ok) return json(res, 404, { error: 'Diet plan not found' });
        json(res, 200, { ok: true });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/plans/duplicate': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      if (!body.id) return json(res, 400, { error: 'Plan id is required' });

      try {
        const existing = getSavedDietPlanById(body.id, user.id);
        if (!existing) return json(res, 404, { error: 'Diet plan not found' });

        const copyPlan = {
          id: genId(),
          user_id: user.id,
          name: existing.name + ' (Copy)',
          is_active: false,
          meals: existing.meals,
          source_pdf_name: existing.source_pdf_name,
          created_at: new Date().toISOString()
        };

        const saved = saveSavedDietPlan(copyPlan);
        json(res, 200, { ok: true, plan: saved });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/plans/delete': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      if (!body.id) return json(res, 400, { error: 'Plan id is required' });

      try {
        deleteSavedDietPlan(body.id, user.id);
        if (process.env.MONGODB_URI) {
          try {
            const mongo = await getMongoDb();
            if (mongo) {
              await mongo.collection('saved_diet_plans').deleteOne({ id: body.id, user_id: user.id });
            }
          } catch {}
        }
        json(res, 200, { ok: true });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ==================== MODULE 3: DAILY HOME PAGE MEAL TRACKER ==================== */
    'GET /api/nutrition/daily-plan': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const url = new URL(req.url, 'http://x');
      const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

      try {
        let dailyPlan = getDailyMealPlan(user.id, date);
        if (!dailyPlan) {
          // If no daily plan seeded yet for today, seed from active saved plan if exists
          const plans = getSavedDietPlans(user.id);
          const active = plans.find(p => p.is_active) || (plans.length > 0 ? plans[0] : null);
          dailyPlan = {
            id: genId(),
            user_id: user.id,
            date,
            plan_id: active ? active.id : null,
            meals: active ? JSON.parse(JSON.stringify(active.meals)) : { breakfast: [], lunch: [], snacks: [], dinner: [] },
            status: { breakfast: 'not_done', lunch: 'not_done', snacks: 'not_done', dinner: 'not_done' }
          };
          saveDailyMealPlan(dailyPlan);
        }

        const actualConsumed = getMealLogs(user.id, date);
        const canonicalGoals = getCanonicalUserNutritionGoals(user.id);
        const availableFoods = getUserAvailableFoods(user.id);

        const comparison = calculateMealPlanComparison({
          plannedMeals: dailyPlan.meals,
          consumedMeals: actualConsumed,
          goals: canonicalGoals,
          availableFoods,
          dietaryRestrictions: canonicalGoals.profile?.dietary_restrictions || []
        });

        json(res, 200, {
          ok: true,
          date,
          dailyPlan,
          actualConsumed,
          comparison
        });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/daily-plan/apply': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const date = body.date || new Date().toISOString().slice(0, 10);
      const planId = body.plan_id;

      if (!planId) return json(res, 400, { error: 'plan_id is required' });

      try {
        const plan = getSavedDietPlanById(planId, user.id);
        if (!plan) return json(res, 404, { error: 'Saved plan not found' });

        const dailyPlan = {
          id: genId(),
          user_id: user.id,
          date,
          plan_id: plan.id,
          meals: JSON.parse(JSON.stringify(plan.meals)),
          status: { breakfast: 'not_done', lunch: 'not_done', snacks: 'not_done', dinner: 'not_done' }
        };

        const saved = saveDailyMealPlan(dailyPlan);
        json(res, 200, { ok: true, dailyPlan: saved });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/daily-plan/update-item': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const date = body.date || new Date().toISOString().slice(0, 10);
      const mealType = body.meal_type;
      const itemId = body.item_id;
      const updates = body.updates || {};

      if (!mealType || !itemId) {
        return json(res, 400, { error: 'meal_type and item_id are required' });
      }

      try {
        // Updates only today's daily meal plan! Saved template remains untouched.
        const updated = updateDailyMealItem(user.id, date, mealType, itemId, updates);
        if (!updated) return json(res, 404, { error: 'Item or plan not found' });
        json(res, 200, { ok: true, dailyPlan: updated });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/daily-plan/toggle-status': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const date = body.date || new Date().toISOString().slice(0, 10);
      const mealType = String(body.meal_type || '').toLowerCase();
      const status = body.status; // 'not_done' | 'partially_completed' | 'completed'

      if (!mealType || !status) {
        return json(res, 400, { error: 'meal_type and status are required' });
      }

      try {
        const updated = toggleDailyMealStatus(user.id, date, mealType, status);

        // When a meal is marked completed, synchronize its active (non-removed) foods into actual meal_logs!
        if (status === 'completed' && updated?.meals?.[mealType]) {
          const activeItems = updated.meals[mealType].filter(i => !i.removed);
          for (const item of activeItems) {
            const entryId = 'cmeal_' + item.id + '_' + date;
            const logEntry = {
              id: entryId,
              user_id: user.id,
              date,
              meal_type: mealType,
              food_id: item.food_id || null,
              food_name: item.food_name,
              serving_quantity: Number(item.serving_quantity) || 1,
              serving_unit: item.serving_unit || 'g',
              serving_grams: Number(item.serving_grams) || 100,
              energy_kcal: Number(item.energy_kcal) || 0,
              protein_g: Number(item.protein_g) || 0,
              carb_g: Number(item.carb_g) || 0,
              fat_g: Number(item.fat_g) || 0,
              fibre_g: Number(item.fibre_g) || 0,
              notes: 'Logged from Daily Meal Plan',
              created_at: new Date().toISOString()
            };
            addMealLog(logEntry);
          }
        } else if (status === 'not_done' && updated?.meals?.[mealType]) {
          // If reverted to not done, clear corresponding completed meal logs
          const activeItems = updated.meals[mealType];
          for (const item of activeItems) {
            const entryId = 'cmeal_' + item.id + '_' + date;
            deleteMealLog(entryId, user.id);
          }
        }

        json(res, 200, { ok: true, dailyPlan: updated });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    
    /* ==================== MODULE 8: UNIFIED CANONICAL CALORIE GOAL CONTROL ==================== */
    'POST /api/nutrition/daily-goal': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const body = await readBody(req);
        const targetVal = Number(body.calorie_target || body.calories || body.target);
        if (!targetVal || isNaN(targetVal) || targetVal < 500 || targetVal > 10000) {
          return json(res, 400, { error: 'Calorie target must be between 500 and 10,000 kcal' });
        }
        const updated = saveCanonicalCalorieGoal(user.id, Math.round(targetVal));
        json(res, 200, {
          ok: true,
          calorie_target: updated.calorie_target,
          calories: updated.calorie_target,
          canonical_goals: updated
        });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/calorie-goal': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const body = await readBody(req);
        const targetVal = Number(body.calorie_target || body.calories || body.target);
        if (!targetVal || isNaN(targetVal) || targetVal < 500 || targetVal > 10000) {
          return json(res, 400, { error: 'Calorie target must be between 500 and 10,000 kcal' });
        }
        const updated = saveCanonicalCalorieGoal(user.id, Math.round(targetVal));
        json(res, 200, {
          ok: true,
          calorie_target: updated.calorie_target,
          calories: updated.calorie_target,
          canonical_goals: updated
        });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ==================== MODULE 4: MY NUTRITION GOALS ==================== */
    'GET /api/nutrition/goals': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      try {
        const goals = getUserNutritionGoals(user.id);
        const canonical_goals = getCanonicalUserNutritionGoals(user.id);
        json(res, 200, { ok: true, goals, canonical_goals, calorie_target: canonical_goals.calorie_target });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/goals/calculate': async (req, res) => {
      const body = await readBody(req);
      try {
        const calculated = calculateNutritionTargets(body.profile || body);
        json(res, 200, { ok: true, calculated_targets: calculated });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/goals/save': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const profile = body.profile || {};
      const customTargets = body.custom_targets || null;

      try {
        const calculated = calculateNutritionTargets(profile);
        const goalsData = {
          profile,
          calculated_targets: calculated,
          custom_targets: customTargets
        };

        const saved = saveUserNutritionGoals(user.id, goalsData);

        // Update daily health settings calorie target
        const activeCalorieTarget = customTargets?.calorie_target || calculated.calorie_target;
        setDailyHealthSettings(user.id, { calorie_target: activeCalorieTarget });

        // MongoDB sync
        if (process.env.MONGODB_URI) {
          try {
            const mongo = await getMongoDb();
            if (mongo) {
              await mongo.collection('user_nutrition_goals').updateOne(
                { user_id: user.id },
                { $set: { ...saved, updatedAt: new Date().toISOString() } },
                { upsert: true }
              );
            }
          } catch (e) {
            console.error('Mongo user_nutrition_goals sync error:', e.message);
          }
        }

        json(res, 200, { ok: true, goals: saved });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ==================== MODULE 5: MEAL PLAN VS GOAL RECOMMENDATIONS ==================== */
    'GET /api/nutrition/recommendations': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const url = new URL(req.url, 'http://x');
      const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

      try {
        const dailyPlan = getDailyMealPlan(user.id, date) || { meals: {} };
        const consumedMeals = getMealLogs(user.id, date);
        const goals = getUserNutritionGoals(user.id) || {};
        const availableFoods = getUserAvailableFoods(user.id);

        const comparison = calculateMealPlanComparison({
          plannedMeals: dailyPlan.meals,
          consumedMeals,
          goals: goals.custom_targets || goals.calculated_targets || { calorie_target: 2000, protein_target: 140 },
          availableFoods,
          dietaryRestrictions: goals.profile?.dietary_restrictions || []
        });

        json(res, 200, { ok: true, ...comparison });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ==================== MODULE 5: USER AVAILABLE FOODS ==================== */
    'GET /api/nutrition/available-foods': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      try {
        const items = getUserAvailableFoods(user.id);
        json(res, 200, { ok: true, items });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/available-foods': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      const items = Array.isArray(body.items) ? body.items : (Array.isArray(body.foods) ? body.foods : []);

      try {
        const saved = saveUserAvailableFoods(user.id, items);
        if (process.env.MONGODB_URI) {
          try {
            const mongo = await getMongoDb();
            if (mongo) {
              await mongo.collection('user_available_foods').updateOne(
                { user_id: user.id },
                { $set: { foods: saved, updatedAt: new Date().toISOString() } },
                { upsert: true }
              );
            }
          } catch {}
        }
        json(res, 200, { ok: true, items: saved });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ==================== MODULE 6: CHEAT MEAL TRACKER ==================== */
    'GET /api/nutrition/cheat-meals': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const url = new URL(req.url, 'http://x');
      const date = url.searchParams.get('date');

      try {
        const cheatMeals = getCheatMealLogs(user.id, date);
        json(res, 200, { ok: true, cheatMeals });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/cheat-meals/save': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      if (!body.food_name || !body.date) {
        return json(res, 400, { error: 'food_name and date are required' });
      }

      const id = body.id || genId();
      let energyKcal = Number(body.energy_kcal != null ? body.energy_kcal : (body.calories != null ? body.calories : 0));
      let proteinG = Number(body.protein_g != null ? body.protein_g : (body.protein != null ? body.protein : 0));
      let carbG = Number(body.carb_g != null ? body.carb_g : (body.carb != null ? body.carb : (body.carbs != null ? body.carbs : 0)));
      let fatG = Number(body.fat_g != null ? body.fat_g : (body.fat != null ? body.fat : 0));
      let fibreG = Number(body.fibre_g != null ? body.fibre_g : (body.fibre != null ? body.fibre : 0));
      let servingGrams = Number(body.serving_grams || body.grams) || 100;

      // Auto-lookup in verified dataset if macros not provided
      if (!energyKcal && body.food_name) {
        const matches = searchFoods(body.food_name, 1);
        if (matches && matches.length > 0) {
          const f = matches[0];
          const factor = servingGrams / (f.serving_basis_g || 100);
          energyKcal = Math.round((Number(f.energy_kcal) * factor) * 10) / 10;
          proteinG = Math.round((Number(f.protein_g) * factor) * 10) / 10;
          carbG = Math.round((Number(f.carb_g) * factor) * 10) / 10;
          fatG = Math.round((Number(f.fat_g) * factor) * 10) / 10;
          fibreG = Math.round((Number(f.fibre_g) * factor) * 10) / 10;
        }
      }

      const entry = {
        id,
        user_id: user.id,
        date: String(body.date).slice(0, 10),
        food_name: String(body.food_name).trim(),
        serving_quantity: Number(body.serving_quantity) || 1,
        serving_unit: body.serving_unit || 'serving',
        serving_grams: servingGrams,
        energy_kcal: energyKcal,
        protein_g: proteinG,
        carb_g: carbG,
        fat_g: fatG,
        fibre_g: fibreG,
        notes: body.notes ? String(body.notes).trim() : 'Cheat Meal / Extra Intake',
        created_at: new Date().toISOString()
      };

      try {
        const saved = addCheatMealLog(entry);

        // Also add to actual consumption in meal_logs so daily totals include it!
        const logEntry = {
          id: 'cheat_log_' + entry.id,
          user_id: user.id,
          date: entry.date,
          meal_type: 'snacks',
          food_id: null,
          food_name: '★ Extra / Cheat: ' + entry.food_name,
          serving_quantity: entry.serving_quantity,
          serving_unit: entry.serving_unit,
          serving_grams: entry.serving_grams,
          energy_kcal: entry.energy_kcal,
          protein_g: entry.protein_g,
          carb_g: entry.carb_g,
          fat_g: entry.fat_g,
          fibre_g: entry.fibre_g,
          notes: entry.notes,
          created_at: entry.created_at
        };
        addMealLog(logEntry);

        // Calculate impact
        const currentTotals = { calories_consumed: 0 };
        const dayMeals = getMealLogs(user.id, entry.date);
        dayMeals.forEach(m => { currentTotals.calories_consumed += Number(m.energy_kcal) || 0; });
        const goals = getUserNutritionGoals(user.id);
        const target = goals?.custom_targets?.calorie_target || goals?.calculated_targets?.calorie_target || 2000;

        const impact = calculateCheatMealImpact(entry, currentTotals, target);

        // MongoDB sync
        if (process.env.MONGODB_URI) {
          try {
            const mongo = await getMongoDb();
            if (mongo) {
              await mongo.collection('cheat_meal_logs').updateOne(
                { id: entry.id, user_id: user.id },
                { $set: { ...entry, updatedAt: new Date().toISOString() } },
                { upsert: true }
              );
            }
          } catch {}
        }

        json(res, 201, { ok: true, cheatMeal: saved, impact });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/cheat-meals/delete': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      if (!body.id) return json(res, 400, { error: 'Cheat meal id is required' });

      try {
        deleteCheatMealLog(body.id, user.id);
        deleteMealLog('cheat_log_' + body.id, user.id);

        if (process.env.MONGODB_URI) {
          try {
            const mongo = await getMongoDb();
            if (mongo) {
              await mongo.collection('cheat_meal_logs').deleteOne({ id: body.id, user_id: user.id });
            }
          } catch {}
        }

        json(res, 200, { ok: true });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    /* ==================== MODULE 7: NUTRITION NOTIFICATIONS ==================== */
    'GET /api/nutrition/notifications/config': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      try {
        const preferences = getNotificationPreferences(user.id);
        json(res, 200, { ok: true, preferences });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'POST /api/nutrition/notifications/config': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const body = await readBody(req);
      try {
        const updated = saveNotificationPreferences(user.id, body.preferences || body);
        json(res, 200, { ok: true, preferences: updated });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    },

    'GET /api/nutrition/notifications/check': async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;

      const url = new URL(req.url, 'http://x');
      const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

      try {
        const prefs = getNotificationPreferences(user.id);
        const dailyPlan = getDailyMealPlan(user.id, date);
        const consumed = getMealLogs(user.id, date);
        const goals = getUserNutritionGoals(user.id) || {};
        const targetKcal = goals.custom_targets?.calorie_target || goals.calculated_targets?.calorie_target || 2000;
        const targetProtein = goals.custom_targets?.protein_target || goals.calculated_targets?.protein_target || 140;

        let totalConsumedKcal = 0;
        let totalConsumedProtein = 0;
        consumed.forEach(c => {
          totalConsumedKcal += Number(c.energy_kcal) || 0;
          totalConsumedProtein += Number(c.protein_g) || 0;
        });

        const notifications = [];
        const nowHour = new Date().getHours();

        // Check meal completion status
        const status = dailyPlan?.status || {};

        if (prefs.remind_breakfast && status.breakfast !== 'completed' && nowHour >= 10) {
          notifications.push({
            id: 'notif_breakfast_' + date,
            type: 'meal_reminder',
            meal: 'breakfast',
            title: 'Breakfast Pending',
            message: 'You have not marked Breakfast as completed for today.',
            severity: 'info'
          });
        }

        if (prefs.remind_lunch && status.lunch !== 'completed' && nowHour >= 14) {
          notifications.push({
            id: 'notif_lunch_' + date,
            type: 'meal_reminder',
            meal: 'lunch',
            title: 'Lunch Pending',
            message: 'You have not marked Lunch as completed for today.',
            severity: 'info'
          });
        }

        if (prefs.remind_dinner && status.dinner !== 'completed' && nowHour >= 21) {
          notifications.push({
            id: 'notif_dinner_' + date,
            type: 'meal_reminder',
            meal: 'dinner',
            title: 'Dinner Pending',
            message: 'You have not marked Dinner as completed for today.',
            severity: 'info'
          });
        }

        // Calorie goal alerts
        if (prefs.alert_calorie_goal && totalConsumedKcal >= targetKcal && totalConsumedKcal <= targetKcal + 100) {
          notifications.push({
            id: 'notif_calorie_reached_' + date,
            type: 'goal_reached',
            title: 'Daily Calorie Goal Reached',
            message: `You have hit your daily calorie target (${Math.round(totalConsumedKcal)} / ${targetKcal} kcal)!`,
            severity: 'success'
          });
        }

        if (prefs.alert_calorie_above && totalConsumedKcal > targetKcal + 100) {
          notifications.push({
            id: 'notif_calorie_above_' + date,
            type: 'calorie_above',
            title: 'Intake Above Target',
            message: `Today's intake (${Math.round(totalConsumedKcal)} kcal) is above your target (${targetKcal} kcal). Return to your normal plan tomorrow.`,
            severity: 'warning'
          });
        }

        if (prefs.alert_protein_target && totalConsumedProtein < targetProtein && (nowHour >= 19 || totalConsumedKcal >= targetKcal * 0.8)) {
          const proteinShort = Math.round(targetProtein - totalConsumedProtein);
          if (proteinShort > 15) {
            notifications.push({
              id: 'notif_protein_short_' + date,
              type: 'protein_target',
              title: 'Protein Target Pending',
              message: `You are ${proteinShort}g short of your daily protein goal (${Math.round(totalConsumedProtein)}/${targetProtein}g).`,
              severity: 'info'
            });
          }
        }

        json(res, 200, { ok: true, notifications });
      } catch (err) {
        json(res, 500, { error: err.message });
      }
    }
  };
}