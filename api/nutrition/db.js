import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { getMongoDb } from '../db/mongo.js';

let db = null;

export function getDb() {
  if (db) return db;
  const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
  const dataDir = process.env.DATA_DIR || (isVercel ? path.join(os.tmpdir(), 'opengym-data') : './data');
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}

  // Locate nutrition.db — on Vercel lambda, /var/task is read-only, so copy seed DB to writable /tmp
  let targetDbPath = path.join(dataDir, 'nutrition.db');
  if (isVercel && !fs.existsSync(targetDbPath)) {
    const seedCandidates = [
      path.join(process.cwd(), 'data', 'nutrition.db'),
      path.join(process.cwd(), '..', 'data', 'nutrition.db')
    ];
    const seed = seedCandidates.find(p => fs.existsSync(p));
    if (seed) {
      try {
        fs.copyFileSync(seed, targetDbPath);
      } catch (e) {
        console.error('Failed to copy seed nutrition.db to /tmp:', e.message);
      }
    }
  } else if (!isVercel && !fs.existsSync(targetDbPath)) {
    const fallback = [
      path.join(process.cwd(), 'data', 'nutrition.db'),
      path.join(process.cwd(), '..', 'data', 'nutrition.db')
    ].find(p => fs.existsSync(p));
    if (fallback) targetDbPath = fallback;
  }
  try { fs.mkdirSync(path.dirname(targetDbPath), { recursive: true }); } catch {}
  db = new DatabaseSync(targetDbPath);
  try { db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;"); } catch {}

  // Initialize health log tables if needed
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS water_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        amount_ml REAL NOT NULL,
        unit TEXT DEFAULT 'ml',
        notes TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_water_user_date ON water_logs(user_id, date);

      CREATE TABLE IF NOT EXISTS cardio_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        duration_min REAL NOT NULL,
        distance_km REAL,
        steps REAL,
        calories_burned REAL,
        notes TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cardio_user_date ON cardio_logs(user_id, date);

      CREATE TABLE IF NOT EXISTS strength_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        exercise_name TEXT NOT NULL,
        muscle_group TEXT,
        sets REAL,
        reps REAL,
        weight_kg REAL,
        duration_min REAL,
        calories_burned REAL,
        notes TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_strength_user_date ON strength_logs(user_id, date);

      CREATE TABLE IF NOT EXISTS daily_health_settings (
        user_id TEXT PRIMARY KEY,
        calorie_target REAL DEFAULT 1900,
        water_goal_litres REAL DEFAULT 2.5,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS meal_templates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        items_json TEXT NOT NULL,
        total_calories REAL NOT NULL,
        total_protein REAL NOT NULL,
        total_carbs REAL NOT NULL,
        total_fat REAL NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_meal_templates_user ON meal_templates(user_id);

      CREATE TABLE IF NOT EXISTS custom_recipes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        ingredients_json TEXT NOT NULL,
        oil_grams REAL DEFAULT 0,
        total_raw_weight_g REAL NOT NULL,
        cooked_weight_g REAL,
        servings REAL NOT NULL DEFAULT 1,
        total_calories REAL NOT NULL,
        total_protein REAL NOT NULL,
        total_carbs REAL NOT NULL,
        total_fat REAL NOT NULL,
        per_serving_calories REAL,
        per_serving_protein REAL,
        per_serving_carbs REAL,
        per_serving_fat REAL,
        per_100g_calories REAL,
        per_100g_protein REAL,
        per_100g_carbs REAL,
        per_100g_fat REAL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_custom_recipes_user ON custom_recipes(user_id);
    `);
    try {
      db.exec("ALTER TABLE meal_logs ADD COLUMN notes TEXT");
    } catch {}
  } catch (e) {
    console.error('Error ensuring health log schema:', e);
  }

  return db;
}


const TAMIL_FOOD_MAP = {
  'சப்பாத்தி': 'chapati',
  'சப்பாத்தி': 'roti',
  'தோசை': 'dosa',
  'தோசை': 'dosai',
  'இட்லி': 'idli',
  'இட்லி': 'idly',
  'சாதம்': 'rice',
  'சோறு': 'rice',
  'முட்டை': 'egg',
  'கோழி': 'chicken',
  'மீன்': 'fish',
  'பருப்பு': 'dal',
  'சாம்பார்': 'sambar',
  'தயிர்': 'curd',
  'வெங்காயம்': 'onion',
  'தக்காளி': 'tomato',
  'சுண்டல்': 'sundal',
  'பாசிப்பயறு': 'green gram',
  'வாழைப்பழம்': 'banana',
  'தர்பூசணி': 'watermelon',
  'பால்': 'milk',
  'கீரை': 'spinach',
  'பன்னீர்': 'paneer'
};

export function searchFoods(query, limit = 20, group = null) {
  const d = getDb();
  let qClean = String(query || '').trim().toLowerCase();
  if (!qClean) {
    let rawRows = [];
    if (group) {
      rawRows = d.prepare(`
        SELECT id, name, canonical_name, alternate_names, tamil_name, hindi_name,
               food_group, prep_state, source, serving_basis_g, energy_kcal, protein_g, carb_g, fat_g, fibre_g,
               is_recipe, serving_size_g, serving_unit, confidence
        FROM foods
        WHERE food_group = ?
        LIMIT ?
      `).all(group, limit);
    } else {
      rawRows = d.prepare(`
        SELECT id, name, canonical_name, alternate_names, tamil_name, hindi_name,
               food_group, prep_state, source, serving_basis_g, energy_kcal, protein_g, carb_g, fat_g, fibre_g,
               is_recipe, serving_size_g, serving_unit, confidence
        FROM foods
        LIMIT ?
      `).all(limit);
    }
    return rawRows.map(r => ({
      ...r,
      calories: r.energy_kcal,
      protein: r.protein_g,
      carbs: r.carb_g,
      fat: r.fat_g,
      fibre: r.fibre_g,
      category: r.food_group,
      serving_size: r.serving_size_g,
      serving_basis_g: r.serving_basis_g || 100,
      name_regional: r.tamil_name || r.hindi_name || null
    }));
  }

  // Check if Tamil alias exists
  let extraAliases = [];
  for (const [ta, en] of Object.entries(TAMIL_FOOD_MAP)) {
    if (qClean.includes(ta) && !extraAliases.includes(en)) {
      extraAliases.push(en);
    }
  }

  // Token-based matching: split query into tokens
  const tokens = qClean.split(/\s+/).filter(Boolean);
  const conditions = tokens.map(() => "(canonical_name LIKE ? OR alternate_names LIKE ? OR tamil_name LIKE ? OR hindi_name LIKE ?)");
  const params = [];
  tokens.forEach(tok => {
    const like = `%${tok}%`;
    params.push(like, like, like, like);
  });

  // If Tamil alias matched, allow OR match on English staple
  let extraCondition = "";
  if (extraAliases.length > 0) {
    const orParts = extraAliases.map(() => "(canonical_name LIKE ? OR alternate_names LIKE ?)");
    extraCondition = " OR (" + orParts.join(" OR ") + ")";
    extraAliases.forEach(al => {
      const like = `%${al}%`;
      params.push(like, like);
    });
  }

  let sql = `
    SELECT id, name, canonical_name, alternate_names, tamil_name, hindi_name,
           food_group, prep_state, source, serving_basis_g, energy_kcal, protein_g, carb_g, fat_g, fibre_g,
           is_recipe, serving_size_g, serving_unit, confidence
    FROM foods
    WHERE (${conditions.join(" AND ")})${extraCondition}
  `;

  if (group) {
    sql += " AND food_group = ?";
    params.push(group);
  }

  // Prioritize exact/prefix matches and recipes/verified foods
  sql += `
    ORDER BY 
      (canonical_name = ? OR alternate_names LIKE '%"' || ? || '"%') DESC,
      (canonical_name LIKE ? || ' %') DESC,
      (id LIKE 'STAPLE:%' OR source = 'NIN_STAPLE') DESC,
      (source = 'INDB_ICMR' OR source LIKE '%ICMR%' OR source LIKE '%NIN%') DESC,
      (source = 'INDB_RECIPE') DESC,
      (source = 'USDA' OR source LIKE '%USDA%') DESC,
      (source != 'OFF') DESC,
      LENGTH(canonical_name) ASC
    LIMIT ?
  `;
  params.push(qClean, qClean, qClean, limit);

  const rawResults = d.prepare(sql).all(...params);
  return rawResults.map(r => ({
    ...r,
    calories: r.energy_kcal,
    protein: r.protein_g,
    carbs: r.carb_g,
    fat: r.fat_g,
    fibre: r.fibre_g,
    category: r.food_group,
    serving_size: r.serving_size_g,
    serving_basis_g: r.serving_basis_g || 100,
    name_regional: r.tamil_name || r.hindi_name || null
  }));
}

export function getFoodById(id) {
  const d = getDb();
  return d.prepare(`
    SELECT id, name, canonical_name, alternate_names, tamil_name, hindi_name,
           food_group, prep_state, source, source_id, serving_basis_g,
           energy_kcal, protein_g, carb_g, fat_g, fibre_g, sugar_g,
           sodium_mg, calcium_mg, iron_mg, is_recipe, serving_size_g, serving_unit,
           confidence, metadata
    FROM foods
    WHERE id = ?
  `).get(id);
}

export function getRecipeIngredients(recipeCode) {
  const d = getDb();
  return d.prepare(`
    SELECT recipe_code, ingredient_food_id, ingredient_name, amount, unit, gram_weight
    FROM recipe_ingredients
    WHERE recipe_code = ?
  `).all(recipeCode);
}

export function getPortionUnits(foodPattern = null) {
  const d = getDb();
  let specific = [];
  if (foodPattern) {
    const pat = String(foodPattern).toLowerCase().trim();
    specific = d.prepare(`
      SELECT food_pattern, unit_name, gram_weight, source
      FROM portion_units
      WHERE food_pattern IS NOT NULL AND (? LIKE '%' || food_pattern || '%' OR food_pattern LIKE '%' || ? || '%')
    `).all(pat, pat);
  }
  const generic = d.prepare(`
    SELECT food_pattern, unit_name, gram_weight, source
    FROM portion_units
    WHERE food_pattern IS NULL
  `).all();
  return [...specific, ...generic];
}

export function getUserTargets(userId) {
  const d = getDb();
  const row = d.prepare(`
    SELECT user_id, calorie_target, protein_target_g, carb_target_g, fat_target_g, fibre_target_g, diet_preference, updated_at
    FROM user_nutrition_targets
    WHERE user_id = ?
  `).get(userId);
  return row || null;
}

export function setUserTargets(userId, targets) {
  const d = getDb();
  const now = new Date().toISOString();
  d.prepare(`
    INSERT OR REPLACE INTO user_nutrition_targets (
      user_id, calorie_target, protein_target_g, carb_target_g, fat_target_g, fibre_target_g, diet_preference, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    targets.calorie_target != null ? targets.calorie_target : (targets.calories != null ? targets.calories : null),
    targets.protein_target_g != null ? targets.protein_target_g : (targets.protein != null ? targets.protein : null),
    targets.carb_target_g != null ? targets.carb_target_g : (targets.carbs != null ? targets.carbs : null),
    targets.fat_target_g != null ? targets.fat_target_g : (targets.fat != null ? targets.fat : null),
    targets.fibre_target_g != null ? targets.fibre_target_g : (targets.fibre != null ? targets.fibre : null),
    targets.diet_preference || 'all',
    now
  );
  return getUserTargets(userId);
}

export function getMealLogs(userId, date) {
  const d = getDb();
  return d.prepare(`
    SELECT id, user_id, date, meal_type, food_id, food_name, serving_quantity,
           serving_unit, serving_grams, energy_kcal, protein_g, carb_g, fat_g, fibre_g,
           notes, assumptions, created_at
    FROM meal_logs
    WHERE user_id = ? AND date = ?
    ORDER BY created_at ASC
  `).all(userId, date);
}

export function addMealLog(entry) {
  const d = getDb();
  const id = entry.id || ('meal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
  d.prepare(`
    INSERT OR REPLACE INTO meal_logs (
      id, user_id, date, meal_type, food_id, food_name, serving_quantity,
      serving_unit, serving_grams, energy_kcal, protein_g, carb_g, fat_g, fibre_g,
      notes, assumptions, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    entry.user_id,
    entry.date,
    entry.meal_type,
    entry.food_id || null,
    entry.food_name,
    entry.serving_quantity != null ? entry.serving_quantity : 1,
    entry.serving_unit || 'g',
    entry.serving_grams != null ? entry.serving_grams : 0,
    entry.energy_kcal != null ? entry.energy_kcal : 0,
    entry.protein_g != null ? entry.protein_g : 0,
    entry.carb_g != null ? entry.carb_g : 0,
    entry.fat_g != null ? entry.fat_g : 0,
    entry.fibre_g != null ? entry.fibre_g : 0,
    entry.notes || null,
    typeof entry.assumptions === 'string' ? entry.assumptions : JSON.stringify(entry.assumptions || []),
    entry.created_at || new Date().toISOString()
  );
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('meal_logs').updateOne({ id, user_id: entry.user_id }, { $set: { ...entry, id } }, { upsert: true }).catch(() => {});
    }).catch(() => {});
  }
  return { ...entry, id };
}

export function updateMealLog(id, userId, updates) {
  const d = getDb();
  const existing = d.prepare("SELECT * FROM meal_logs WHERE id = ? AND user_id = ?").get(id, userId);
  if (!existing) {
    return addMealLog({ ...updates, id, user_id: userId });
  }
  const merged = { ...existing, ...updates };
  d.prepare(`
    UPDATE meal_logs
    SET meal_type = ?, food_name = ?, serving_quantity = ?, serving_unit = ?,
        serving_grams = ?, energy_kcal = ?, protein_g = ?, carb_g = ?, fat_g = ?, fibre_g = ?,
        notes = ?, assumptions = ?
    WHERE id = ? AND user_id = ?
  `).run(
    merged.meal_type,
    merged.food_name,
    merged.serving_quantity != null ? merged.serving_quantity : 1,
    merged.serving_unit || 'g',
    merged.serving_grams != null ? merged.serving_grams : 0,
    merged.energy_kcal != null ? merged.energy_kcal : 0,
    merged.protein_g != null ? merged.protein_g : 0,
    merged.carb_g != null ? merged.carb_g : 0,
    merged.fat_g != null ? merged.fat_g : 0,
    merged.fibre_g != null ? merged.fibre_g : 0,
    merged.notes || null,
    typeof merged.assumptions === 'string' ? merged.assumptions : JSON.stringify(merged.assumptions || []),
    id,
    userId
  );
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('meal_logs').updateOne({ id, user_id: userId }, { $set: merged }).catch(() => {});
    }).catch(() => {});
  }
  return d.prepare("SELECT * FROM meal_logs WHERE id = ?").get(id);
}

export function deleteMealLog(id, userId) {
  const d = getDb();
  const res = d.prepare("DELETE FROM meal_logs WHERE id = ? AND user_id = ?").run(id, userId);
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) {
        mongo.collection('meal_logs').deleteOne({ id, user_id: userId }).catch(() => {});
        mongo.collection('states').updateOne(
          { userId },
          { $pull: { 'state.meals': { id } } }
        ).catch(() => {});
      }
    }).catch(() => {});
  }
  return res.changes > 0;
}

/* ==================== Water Logs ==================== */
export function getWaterLogs(userId, date) {
  const d = getDb();
  return d.prepare(`
    SELECT id, user_id, date, amount_ml, unit, notes, created_at
    FROM water_logs
    WHERE user_id = ? AND date = ?
    ORDER BY created_at ASC
  `).all(userId, date);
}

export function addWaterLog(entry) {
  const d = getDb();
  const id = entry.id || ('water_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
  d.prepare(`
    INSERT OR REPLACE INTO water_logs (
      id, user_id, date, amount_ml, unit, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    entry.user_id,
    entry.date,
    entry.amount_ml,
    entry.unit || 'ml',
    entry.notes || null,
    entry.created_at || new Date().toISOString()
  );
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('water_logs').updateOne({ id, user_id: entry.user_id }, { $set: { ...entry, id } }, { upsert: true }).catch(() => {});
    }).catch(() => {});
  }
  return { ...entry, id };
}

export function deleteWaterLog(id, userId) {
  const d = getDb();
  const res = d.prepare("DELETE FROM water_logs WHERE id = ? AND user_id = ?").run(id, userId);
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('water_logs').deleteOne({ id, user_id: userId }).catch(() => {});
    }).catch(() => {});
  }
  return res.changes > 0;
}

/* ==================== Cardio Logs ==================== */
export function getCardioLogs(userId, date) {
  const d = getDb();
  return d.prepare(`
    SELECT id, user_id, date, activity_type, duration_min, distance_km, steps, calories_burned, notes, created_at
    FROM cardio_logs
    WHERE user_id = ? AND date = ?
    ORDER BY created_at ASC
  `).all(userId, date);
}

export function addCardioLog(entry) {
  const d = getDb();
  const id = entry.id || ('cardio_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
  d.prepare(`
    INSERT OR REPLACE INTO cardio_logs (
      id, user_id, date, activity_type, duration_min, distance_km, steps, calories_burned, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    entry.user_id,
    entry.date,
    entry.activity_type,
    entry.duration_min,
    entry.distance_km != null ? entry.distance_km : null,
    entry.steps != null ? entry.steps : null,
    entry.calories_burned != null ? entry.calories_burned : null,
    entry.notes || null,
    entry.created_at || new Date().toISOString()
  );
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('cardio_logs').updateOne({ id, user_id: entry.user_id }, { $set: { ...entry, id } }, { upsert: true }).catch(() => {});
    }).catch(() => {});
  }
  return { ...entry, id };
}

export function updateCardioLog(id, userId, updates) {
  const d = getDb();
  const existing = d.prepare("SELECT * FROM cardio_logs WHERE id = ? AND user_id = ?").get(id, userId);
  if (!existing) return null;
  const merged = { ...existing, ...updates };
  d.prepare(`
    UPDATE cardio_logs
    SET activity_type = ?, duration_min = ?, distance_km = ?, steps = ?, calories_burned = ?, notes = ?
    WHERE id = ? AND user_id = ?
  `).run(
    merged.activity_type,
    merged.duration_min,
    merged.distance_km != null ? merged.distance_km : null,
    merged.steps != null ? merged.steps : null,
    merged.calories_burned != null ? merged.calories_burned : null,
    merged.notes || null,
    id,
    userId
  );
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('cardio_logs').updateOne({ id, user_id: userId }, { $set: merged }).catch(() => {});
    }).catch(() => {});
  }
  return d.prepare("SELECT * FROM cardio_logs WHERE id = ?").get(id);
}

export function deleteCardioLog(id, userId) {
  const d = getDb();
  const res = d.prepare("DELETE FROM cardio_logs WHERE id = ? AND user_id = ?").run(id, userId);
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('cardio_logs').deleteOne({ id, user_id: userId }).catch(() => {});
    }).catch(() => {});
  }
  return res.changes > 0;
}

/* ==================== Strength Logs ==================== */
export function getStrengthLogs(userId, date) {
  const d = getDb();
  return d.prepare(`
    SELECT id, user_id, date, exercise_name, muscle_group, sets, reps, weight_kg, duration_min, calories_burned, notes, created_at
    FROM strength_logs
    WHERE user_id = ? AND date = ?
    ORDER BY created_at ASC
  `).all(userId, date);
}

export function addStrengthLog(entry) {
  const d = getDb();
  const id = entry.id || ('str_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
  d.prepare(`
    INSERT OR REPLACE INTO strength_logs (
      id, user_id, date, exercise_name, muscle_group, sets, reps, weight_kg, duration_min, calories_burned, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    entry.user_id,
    entry.date,
    entry.exercise_name || entry.workout_name || 'Workout',
    entry.muscle_group || null,
    entry.sets != null ? entry.sets : null,
    entry.reps != null ? entry.reps : null,
    entry.weight_kg != null ? entry.weight_kg : null,
    entry.duration_min != null ? entry.duration_min : null,
    entry.calories_burned != null ? entry.calories_burned : null,
    entry.notes || null,
    entry.created_at || new Date().toISOString()
  );
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('strength_logs').updateOne({ id, user_id: entry.user_id }, { $set: { ...entry, id } }, { upsert: true }).catch(() => {});
    }).catch(() => {});
  }
  return { ...entry, id };
}

export function updateStrengthLog(id, userId, updates) {
  const d = getDb();
  const existing = d.prepare("SELECT * FROM strength_logs WHERE id = ? AND user_id = ?").get(id, userId);
  if (!existing) return null;
  const merged = { ...existing, ...updates };
  d.prepare(`
    UPDATE strength_logs
    SET exercise_name = ?, muscle_group = ?, sets = ?, reps = ?, weight_kg = ?, duration_min = ?, calories_burned = ?, notes = ?
    WHERE id = ? AND user_id = ?
  `).run(
    merged.exercise_name,
    merged.muscle_group || null,
    merged.sets != null ? merged.sets : null,
    merged.reps != null ? merged.reps : null,
    merged.weight_kg != null ? merged.weight_kg : null,
    merged.duration_min != null ? merged.duration_min : null,
    merged.calories_burned != null ? merged.calories_burned : null,
    merged.notes || null,
    id,
    userId
  );
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('strength_logs').updateOne({ id, user_id: userId }, { $set: merged }).catch(() => {});
    }).catch(() => {});
  }
  return d.prepare("SELECT * FROM strength_logs WHERE id = ?").get(id);
}

export function deleteStrengthLog(id, userId) {
  const d = getDb();
  const res = d.prepare("DELETE FROM strength_logs WHERE id = ? AND user_id = ?").run(id, userId);
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('strength_logs').deleteOne({ id, user_id: userId }).catch(() => {});
    }).catch(() => {});
  }
  return res.changes > 0;
}

/* ==================== Daily Health Settings ==================== */
export function getDailyHealthSettings(userId) {
  const d = getDb();
  const row = d.prepare("SELECT * FROM daily_health_settings WHERE user_id = ?").get(userId);
  if (row) return row;
  return {
    user_id: userId,
    calorie_target: 1900,
    water_goal_litres: 2.5
  };
}

export function setDailyHealthSettings(userId, settings) {
  const d = getDb();
  const now = new Date().toISOString();
  d.prepare(`
    INSERT OR REPLACE INTO daily_health_settings (
      user_id, calorie_target, water_goal_litres, updated_at
    ) VALUES (?, ?, ?, ?)
  `).run(
    userId,
    settings.calorie_target != null ? settings.calorie_target : 1900,
    settings.water_goal_litres != null ? settings.water_goal_litres : 2.5,
    now
  );
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('daily_health_settings').updateOne({ user_id: userId }, { $set: { user_id: userId, ...settings, updated_at: now } }, { upsert: true }).catch(() => {});
    }).catch(() => {});
  }
  return getDailyHealthSettings(userId);
}

/* ==================== Serverless MongoDB Sync Helper ==================== */
export async function syncHealthLogsFromMongo(userId, date) {
  if (!process.env.MONGODB_URI) return;
  try {
    const mongo = await getMongoDb();
    if (!mongo) return;
    const d = getDb();

    // Sync meals if local SQLite cache is empty for date
    const existingMeals = d.prepare("SELECT COUNT(*) as count FROM meal_logs WHERE user_id = ? AND date = ?").get(userId, date);
    if (!existingMeals || existingMeals.count === 0) {
      let mFoods = await mongo.collection('meal_logs').find({ user_id: userId, date }).toArray();
      if (!mFoods || mFoods.length === 0) {
        const stateDoc = await mongo.collection('states').findOne({ userId });
        if (stateDoc?.state?.meals && Array.isArray(stateDoc.state.meals)) {
          mFoods = stateDoc.state.meals.filter(m => (m && (m.date === date || m.d === date)));
        }
      }
      for (const f of (mFoods || [])) {
        addMealLog({
          id: f.id || 'food_' + Math.random().toString(36).slice(2, 9),
          user_id: userId,
          date: f.date || f.d || date,
          meal_type: String(f.meal_type || f.type || 'lunch').toLowerCase(),
          food_id: f.food_id || f.foodId || null,
          food_name: f.food_name || f.name || 'Food item',
          serving_quantity: Number(f.serving_quantity || f.qty) || 1,
          serving_unit: f.serving_unit || f.unit || 'g',
          serving_grams: Number(f.serving_grams || f.grams) || 0,
          energy_kcal: Number(f.energy_kcal != null ? f.energy_kcal : (f.calories != null ? f.calories : 0)),
          protein_g: Number(f.protein_g != null ? f.protein_g : (f.protein != null ? f.protein : 0)),
          carb_g: Number(f.carb_g != null ? f.carb_g : (f.carb != null ? f.carb : 0)),
          fat_g: Number(f.fat_g != null ? f.fat_g : (f.fat != null ? f.fat : 0)),
          fibre_g: Number(f.fibre_g != null ? f.fibre_g : (f.fibre != null ? f.fibre : 0)),
          notes: f.notes || null,
          created_at: f.created_at || f.createdAt || new Date().toISOString()
        });
      }
    }

    // Sync water if local SQLite cache is empty for date
    const existingWater = d.prepare("SELECT COUNT(*) as count FROM water_logs WHERE user_id = ? AND date = ?").get(userId, date);
    if (!existingWater || existingWater.count === 0) {
      const mWater = await mongo.collection('water_logs').find({ user_id: userId, date }).toArray();
      for (const w of mWater) {
        addWaterLog(w);
      }
    }

    // Sync cardio if local SQLite cache is empty for date
    const existingCardio = d.prepare("SELECT COUNT(*) as count FROM cardio_logs WHERE user_id = ? AND date = ?").get(userId, date);
    if (!existingCardio || existingCardio.count === 0) {
      let mCardio = await mongo.collection('cardio_logs').find({ $or: [{ userId, d: date }, { user_id: userId, date }] }).toArray();
      if (!mCardio || mCardio.length === 0) {
        const stateDoc = await mongo.collection('states').findOne({ userId });
        if (stateDoc?.state?.cardioLogs && Array.isArray(stateDoc.state.cardioLogs)) {
          mCardio = stateDoc.state.cardioLogs.filter(c => (c && (c.d === date || c.date === date)));
        }
      }
      for (const c of (mCardio || [])) {
        addCardioLog({
          id: c.id,
          user_id: userId,
          date: c.date || c.d || date,
          activity_type: c.activity_type || c.activity || 'Walking',
          duration_min: Number(c.duration_min != null ? c.duration_min : (c.totalDurationMinutes || c.durationMinutes || 0)),
          distance_km: c.distance_km != null ? Number(c.distance_km) : (c.distanceKm != null ? Number(c.distanceKm) : null),
          steps: c.steps != null ? Number(c.steps) : null,
          calories_burned: c.calories_burned != null ? Number(c.calories_burned) : null,
          notes: c.notes || null,
          created_at: c.created_at || c.createdAt || new Date().toISOString()
        });
      }
    }

    // Sync strength from completed workout sessions if local SQLite strength cache is empty for date
    const existingStrength = d.prepare("SELECT COUNT(*) as count FROM strength_logs WHERE user_id = ? AND date = ?").get(userId, date);
    if (!existingStrength || existingStrength.count === 0) {
      let mStrength = await mongo.collection('strength_logs').find({ user_id: userId, date }).toArray();
      if (mStrength && mStrength.length > 0) {
        for (const s of mStrength) {
          addStrengthLog(s);
        }
      } else {
        // Look up completed workout sessions for this date
        let mWorkouts = await mongo.collection('workout_sessions').find({ userId, d: date }).toArray();
        if (!mWorkouts || mWorkouts.length === 0) {
          const stateDoc = await mongo.collection('states').findOne({ userId });
          if (stateDoc?.state?.workouts && Array.isArray(stateDoc.state.workouts)) {
            mWorkouts = stateDoc.state.workouts.filter(w => (w && w.d === date));
          }
        }
        if (mWorkouts && mWorkouts.length > 0) {
          for (const w of mWorkouts) {
            const durMin = Math.max(1, Math.round((w.dur || 0) / 60000));
            const entries = w.entries || [];
            for (let i = 0; i < entries.length; i++) {
              const e = entries[i];
              const doneSets = (e.sets || []).filter(s => s.done);
              const topWeight = Math.max(0, ...doneSets.map(s => s.w || 0), e.topW || 0);
              const repsStr = doneSets.map(s => s.r).filter(Boolean).join(', ');
              addStrengthLog({
                id: `w_${w.id}_${e.id || i}`,
                user_id: userId,
                date: w.d || date,
                exercise_name: e.name || e.id || 'Exercise',
                muscle_group: w.name || 'Strength',
                sets: doneSets.length || (e.sets || []).length || 1,
                reps: doneSets.length ? (doneSets[0]?.r || null) : null,
                weight_kg: topWeight || null,
                duration_min: i === 0 ? durMin : null,
                calories_burned: null,
                notes: `${w.name || 'Strength Workout'} · ${doneSets.length} sets${repsStr ? ` (${repsStr} reps)` : ''}`,
                created_at: w.createdAt || new Date(w.start || Date.now()).toISOString()
              });
            }
          }
        }
      }
    }

    // Sync settings if local SQLite cache is empty
    const existingSettings = d.prepare("SELECT * FROM daily_health_settings WHERE user_id = ?").get(userId);
    if (!existingSettings) {
      const mSettings = await mongo.collection('daily_health_settings').findOne({ user_id: userId });
      if (mSettings) {
        setDailyHealthSettings(userId, mSettings);
      }
    }
  } catch (err) {
    console.error('Mongo health log sync error:', err.message);
  }
}

export function clearAllNutritionDataForUser(userId) {
  if (!userId) return;
  const d = getDb();
  if (!d) return;
  try {
    try { d.prepare("DELETE FROM meal_logs WHERE user_id = ?").run(userId); } catch {}
    try { d.prepare("DELETE FROM water_logs WHERE user_id = ?").run(userId); } catch {}
    try { d.prepare("DELETE FROM cardio_logs WHERE user_id = ?").run(userId); } catch {}
    try { d.prepare("DELETE FROM strength_logs WHERE user_id = ?").run(userId); } catch {}
    try { d.prepare("DELETE FROM user_nutrition_targets WHERE user_id = ?").run(userId); } catch {}
    try { d.prepare("DELETE FROM daily_health_settings WHERE user_id = ?").run(userId); } catch {}
    try { d.prepare("DELETE FROM meal_templates WHERE user_id = ?").run(userId); } catch {}
    try { d.prepare("DELETE FROM custom_recipes WHERE user_id = ?").run(userId); } catch {}
  } catch (err) {
    console.error('Error clearing SQLite nutrition data for user:', err.message);
  }
}

/* ==================== Meal Templates (Saved Custom Meals) ==================== */
export async function getMealTemplates(userId) {
  const d = getDb();
  let rows = d.prepare(`
    SELECT id, user_id, name, meal_type, items_json, total_calories, total_protein, total_carbs, total_fat, notes, created_at, updated_at
    FROM meal_templates
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `).all(userId);

  if (rows.length === 0 && process.env.MONGODB_URI) {
    try {
      const mongo = await getMongoDb();
      if (mongo) {
        const mTemplates = await mongo.collection('meal_templates').find({ user_id: userId }).toArray();
        for (const t of mTemplates) {
          d.prepare(`
            INSERT OR REPLACE INTO meal_templates (
              id, user_id, name, meal_type, items_json, total_calories, total_protein, total_carbs, total_fat, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            t.id || t._id.toString(),
            userId,
            t.name,
            t.meal_type || 'breakfast',
            typeof t.items_json === 'string' ? t.items_json : JSON.stringify(t.items || []),
            Number(t.total_calories || t.calories || 0),
            Number(t.total_protein || t.protein || 0),
            Number(t.total_carbs || t.carbs || 0),
            Number(t.total_fat || t.fat || 0),
            t.notes || null,
            t.created_at || new Date().toISOString(),
            t.updated_at || new Date().toISOString()
          );
        }
        if (mTemplates.length > 0) {
          rows = d.prepare(`
            SELECT id, user_id, name, meal_type, items_json, total_calories, total_protein, total_carbs, total_fat, notes, created_at, updated_at
            FROM meal_templates
            WHERE user_id = ?
            ORDER BY updated_at DESC
          `).all(userId);
        }
      }
    } catch (err) {
      console.error('Mongo getMealTemplates sync error:', err.message);
    }
  }

  return rows.map(r => ({
    ...r,
    items: typeof r.items_json === 'string' ? JSON.parse(r.items_json || '[]') : (r.items_json || [])
  }));
}

export function saveMealTemplate(userId, template) {
  const d = getDb();
  const id = template.id || ('mtpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  const now = new Date().toISOString();
  const items = Array.isArray(template.items) ? template.items : [];
  const itemsJson = typeof template.items_json === 'string' ? template.items_json : JSON.stringify(items);
  
  let totalKcal = Number(template.total_calories != null ? template.total_calories : (template.calories != null ? template.calories : 0));
  let totalP = Number(template.total_protein != null ? template.total_protein : (template.protein != null ? template.protein : 0));
  let totalC = Number(template.total_carbs != null ? template.total_carbs : (template.carbs != null ? template.carbs : 0));
  let totalF = Number(template.total_fat != null ? template.total_fat : (template.fat != null ? template.fat : 0));

  if (!totalKcal && items.length > 0) {
    totalKcal = Math.round(items.reduce((acc, it) => acc + (Number(it.energy_kcal || it.calories) || 0), 0));
    totalP = Math.round(items.reduce((acc, it) => acc + (Number(it.protein_g || it.protein) || 0), 0) * 10) / 10;
    totalC = Math.round(items.reduce((acc, it) => acc + (Number(it.carb_g || it.carbs) || 0), 0) * 10) / 10;
    totalF = Math.round(items.reduce((acc, it) => acc + (Number(it.fat_g || it.fat) || 0), 0) * 10) / 10;
  }

  d.prepare(`
    INSERT OR REPLACE INTO meal_templates (
      id, user_id, name, meal_type, items_json, total_calories, total_protein, total_carbs, total_fat, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    String(template.name || 'Saved Meal').trim(),
    String(template.meal_type || 'breakfast').toLowerCase(),
    itemsJson,
    totalKcal,
    totalP,
    totalC,
    totalF,
    template.notes || null,
    template.created_at || now,
    now
  );

  const entry = {
    id,
    user_id: userId,
    name: String(template.name || 'Saved Meal').trim(),
    meal_type: String(template.meal_type || 'breakfast').toLowerCase(),
    items_json: itemsJson,
    items,
    total_calories: totalKcal,
    total_protein: totalP,
    total_carbs: totalC,
    total_fat: totalF,
    notes: template.notes || null,
    created_at: template.created_at || now,
    updated_at: now
  };

  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) {
        mongo.collection('meal_templates').updateOne(
          { id, user_id: userId },
          { $set: entry },
          { upsert: true }
        ).catch(() => {});
      }
    }).catch(() => {});
  }

  return entry;
}

export function deleteMealTemplate(id, userId) {
  const d = getDb();
  const res = d.prepare("DELETE FROM meal_templates WHERE id = ? AND user_id = ?").run(id, userId);
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('meal_templates').deleteOne({ id, user_id: userId }).catch(() => {});
    }).catch(() => {});
  }
  return res.changes > 0;
}

/* ==================== Raw Ingredient Recipes ==================== */
export async function getCustomRecipes(userId) {
  const d = getDb();
  let rows = d.prepare(`
    SELECT id, user_id, name, ingredients_json, oil_grams, total_raw_weight_g, cooked_weight_g, servings,
           total_calories, total_protein, total_carbs, total_fat,
           per_serving_calories, per_serving_protein, per_serving_carbs, per_serving_fat,
           per_100g_calories, per_100g_protein, per_100g_carbs, per_100g_fat,
           notes, created_at, updated_at
    FROM custom_recipes
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `).all(userId);

  if (rows.length === 0 && process.env.MONGODB_URI) {
    try {
      const mongo = await getMongoDb();
      if (mongo) {
        const mRecipes = await mongo.collection('custom_recipes').find({ user_id: userId }).toArray();
        for (const r of mRecipes) {
          d.prepare(`
            INSERT OR REPLACE INTO custom_recipes (
              id, user_id, name, ingredients_json, oil_grams, total_raw_weight_g, cooked_weight_g, servings,
              total_calories, total_protein, total_carbs, total_fat,
              per_serving_calories, per_serving_protein, per_serving_carbs, per_serving_fat,
              per_100g_calories, per_100g_protein, per_100g_carbs, per_100g_fat,
              notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            r.id || r._id.toString(),
            userId,
            r.name,
            typeof r.ingredients_json === 'string' ? r.ingredients_json : JSON.stringify(r.ingredients || []),
            Number(r.oil_grams || 0),
            Number(r.total_raw_weight_g || 0),
            r.cooked_weight_g != null ? Number(r.cooked_weight_g) : null,
            Number(r.servings || 1),
            Number(r.total_calories || 0),
            Number(r.total_protein || 0),
            Number(r.total_carbs || 0),
            Number(r.total_fat || 0),
            Number(r.per_serving_calories || 0),
            Number(r.per_serving_protein || 0),
            Number(r.per_serving_carbs || 0),
            Number(r.per_serving_fat || 0),
            Number(r.per_100g_calories || 0),
            Number(r.per_100g_protein || 0),
            Number(r.per_100g_carbs || 0),
            Number(r.per_100g_fat || 0),
            r.notes || null,
            r.created_at || new Date().toISOString(),
            r.updated_at || new Date().toISOString()
          );
        }
        if (mRecipes.length > 0) {
          rows = d.prepare(`
            SELECT id, user_id, name, ingredients_json, oil_grams, total_raw_weight_g, cooked_weight_g, servings,
                   total_calories, total_protein, total_carbs, total_fat,
                   per_serving_calories, per_serving_protein, per_serving_carbs, per_serving_fat,
                   per_100g_calories, per_100g_protein, per_100g_carbs, per_100g_fat,
                   notes, created_at, updated_at
            FROM custom_recipes
            WHERE user_id = ?
            ORDER BY updated_at DESC
          `).all(userId);
        }
      }
    } catch (err) {
      console.error('Mongo getCustomRecipes sync error:', err.message);
    }
  }

  return rows.map(r => ({
    ...r,
    ingredients: typeof r.ingredients_json === 'string' ? JSON.parse(r.ingredients_json || '[]') : (r.ingredients_json || [])
  }));
}

export function saveCustomRecipe(userId, recipe) {
  const d = getDb();
  const id = recipe.id || ('rcp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  const now = new Date().toISOString();
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const ingredientsJson = typeof recipe.ingredients_json === 'string' ? recipe.ingredients_json : JSON.stringify(ingredients);

  const oilGrams = Math.max(0, Number(recipe.oil_grams || 0));
  const oilKcal = oilGrams * 8.84; // ~884 kcal per 100g cooking oil
  const oilFat = oilGrams;

  let rawWeight = Number(recipe.total_raw_weight_g) || 0;
  if (!rawWeight && ingredients.length > 0) {
    rawWeight = ingredients.reduce((sum, ing) => sum + (Number(ing.raw_weight_g || ing.grams || ing.serving_quantity) || 0), 0) + oilGrams;
  }

  const cookedWeight = recipe.cooked_weight_g != null && Number(recipe.cooked_weight_g) > 0 ? Number(recipe.cooked_weight_g) : null;
  const servings = Math.max(0.5, Number(recipe.servings || 1));

  let totalKcal = Math.round((ingredients.reduce((sum, ing) => sum + (Number(ing.energy_kcal || ing.calories) || 0), 0) + oilKcal));
  let totalP = Math.round(ingredients.reduce((sum, ing) => sum + (Number(ing.protein_g || ing.protein) || 0), 0) * 10) / 10;
  let totalC = Math.round(ingredients.reduce((sum, ing) => sum + (Number(ing.carb_g || ing.carbs) || 0), 0) * 10) / 10;
  let totalF = Math.round((ingredients.reduce((sum, ing) => sum + (Number(ing.fat_g || ing.fat) || 0), 0) + oilFat) * 10) / 10;

  const perServingKcal = Math.round(totalKcal / servings);
  const perServingP = Math.round((totalP / servings) * 10) / 10;
  const perServingC = Math.round((totalC / servings) * 10) / 10;
  const perServingF = Math.round((totalF / servings) * 10) / 10;

  let per100gKcal = 0;
  let per100gP = 0;
  let per100gC = 0;
  let per100gF = 0;

  const basisWeight = cookedWeight || rawWeight;
  if (basisWeight > 0) {
    const factor = 100 / basisWeight;
    per100gKcal = Math.round(totalKcal * factor);
    per100gP = Math.round(totalP * factor * 10) / 10;
    per100gC = Math.round(totalC * factor * 10) / 10;
    per100gF = Math.round(totalF * factor * 10) / 10;
  }

  d.prepare(`
    INSERT OR REPLACE INTO custom_recipes (
      id, user_id, name, ingredients_json, oil_grams, total_raw_weight_g, cooked_weight_g, servings,
      total_calories, total_protein, total_carbs, total_fat,
      per_serving_calories, per_serving_protein, per_serving_carbs, per_serving_fat,
      per_100g_calories, per_100g_protein, per_100g_carbs, per_100g_fat,
      notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    String(recipe.name || 'Custom Recipe').trim(),
    ingredientsJson,
    oilGrams,
    rawWeight,
    cookedWeight,
    servings,
    totalKcal,
    totalP,
    totalC,
    totalF,
    perServingKcal,
    perServingP,
    perServingC,
    perServingF,
    per100gKcal,
    per100gP,
    per100gC,
    per100gF,
    recipe.notes || null,
    recipe.created_at || now,
    now
  );

  const entry = {
    id,
    user_id: userId,
    name: String(recipe.name || 'Custom Recipe').trim(),
    ingredients_json: ingredientsJson,
    ingredients,
    oil_grams: oilGrams,
    total_raw_weight_g: rawWeight,
    cooked_weight_g: cookedWeight,
    servings,
    total_calories: totalKcal,
    total_protein: totalP,
    total_carbs: totalC,
    total_fat: totalF,
    per_serving_calories: perServingKcal,
    per_serving_protein: perServingP,
    per_serving_carbs: perServingC,
    per_serving_fat: perServingF,
    per_100g_calories: per100gKcal,
    per_100g_protein: per100gP,
    per_100g_carbs: per100gC,
    per_100g_fat: per100gF,
    notes: recipe.notes || null,
    created_at: recipe.created_at || now,
    updated_at: now
  };

  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) {
        mongo.collection('custom_recipes').updateOne(
          { id, user_id: userId },
          { $set: entry },
          { upsert: true }
        ).catch(() => {});
      }
    }).catch(() => {});
  }

  return entry;
}

export function deleteCustomRecipe(id, userId) {
  const d = getDb();
  const res = d.prepare("DELETE FROM custom_recipes WHERE id = ? AND user_id = ?").run(id, userId);
  if (process.env.MONGODB_URI) {
    getMongoDb().then(mongo => {
      if (mongo) mongo.collection('custom_recipes').deleteOne({ id, user_id: userId }).catch(() => {});
    }).catch(() => {});
  }
  return res.changes > 0;
}

/* ==================== Previous Meals (Repeat Previous Meal) ==================== */
export function getPreviousMeals(userId, limitDays = 30) {
  const d = getDb();
  const rows = d.prepare(`
    SELECT id, user_id, date, meal_type, food_id, food_name, serving_quantity, serving_unit,
           serving_grams, energy_kcal, protein_g, carb_g, fat_g, fibre_g, notes, created_at
    FROM meal_logs
    WHERE user_id = ?
    ORDER BY date DESC, created_at ASC
  `).all(userId);

  const groups = {};
  for (const r of rows) {
    const mType = (r.meal_type || 'breakfast').toLowerCase();
    const key = `${r.date}__${mType}`;
    if (!groups[key]) {
      groups[key] = {
        date: r.date,
        meal_type: mType,
        items: [],
        total_calories: 0,
        total_protein: 0,
        total_carbs: 0,
        total_fat: 0
      };
    }
    groups[key].items.push({
      id: r.id,
      food_id: r.food_id,
      food_name: r.food_name,
      name: r.food_name,
      serving_quantity: r.serving_quantity,
      qty: r.serving_quantity,
      serving_unit: r.serving_unit,
      unit: r.serving_unit,
      serving_grams: r.serving_grams,
      energy_kcal: r.energy_kcal,
      calories: r.energy_kcal,
      protein_g: r.protein_g,
      protein: r.protein_g,
      carb_g: r.carb_g,
      carbs: r.carb_g,
      fat_g: r.fat_g,
      fat: r.fat_g,
      fibre_g: r.fibre_g,
      notes: r.notes
    });
    groups[key].total_calories += Number(r.energy_kcal) || 0;
    groups[key].total_protein += Number(r.protein_g) || 0;
    groups[key].total_carbs += Number(r.carb_g) || 0;
    groups[key].total_fat += Number(r.fat_g) || 0;
  }

  const list = Object.values(groups).map(g => ({
    ...g,
    total_calories: Math.round(g.total_calories),
    total_protein: Math.round(g.total_protein * 10) / 10,
    total_carbs: Math.round(g.total_carbs * 10) / 10,
    total_fat: Math.round(g.total_fat * 10) / 10
  }));

  return {
    all: list,
    breakfast: list.filter(m => m.meal_type === 'breakfast'),
    lunch: list.filter(m => m.meal_type === 'lunch'),
    dinner: list.filter(m => m.meal_type === 'dinner'),
    snacks: list.filter(m => m.meal_type === 'snacks')
  };
}

/* =========================================================================
   IRONX AI: VERIFIED NUTRITION KNOWLEDGE RETRIEVAL & CALCULATION ENGINE
   ========================================================================= */

export function searchVerifiedFoods({ query = '', category = null, foodState = null, limit = 25, offset = 0 } = {}) {
  const d = getDb();
  let sql = `
    SELECT id, name, food_name_english, food_name_tamil, food_name_hindi, alternate_names,
           category, subcategory, scientific_name, prep_state, preparation_state,
           edible_portion_basis, energy_kcal, protein_g, carb_g, fat_g, fibre_g, moisture_g,
           source, source_reference, source_version, data_quality_status, licence_status, last_verified_date
    FROM foods
    WHERE is_recipe = 0
  `;
  const params = [];

  if (category) {
    sql += ` AND (category = ? OR food_group = ?)`;
    params.push(category, category);
  }

  if (foodState) {
    sql += ` AND prep_state = ?`;
    params.push(foodState);
  }

  const qClean = String(query || '').trim().toLowerCase();
  let exactTerm = qClean;
  if (qClean) {
    // Check Tamil alias
    let searchTerms = [qClean];
    for (const [ta, en] of Object.entries(TAMIL_FOOD_MAP)) {
      if (qClean.includes(ta) && !searchTerms.includes(en)) {
        searchTerms.push(en);
      }
    }

    const orClauses = searchTerms.map(() =>
      `(LOWER(name) LIKE ? OR LOWER(food_name_english) LIKE ? OR LOWER(food_name_tamil) LIKE ? OR LOWER(canonical_name) LIKE ? OR LOWER(alternate_names) LIKE ?)`
    );
    sql += ` AND (${orClauses.join(' OR ')})`;
    for (const term of searchTerms) {
      const p = `%${term}%`;
      params.push(p, p, p, p, p);
    }
  }

  sql += `
    ORDER BY
      (LOWER(name) = ? OR LOWER(food_name_english) = ? OR LOWER(alternate_names) LIKE '%"' || ? || '"%') DESC,
      (LOWER(name) LIKE ? || ' %' OR LOWER(canonical_name) LIKE ? || ' %') DESC,
      (id LIKE 'INX_STAPLE_%' OR id LIKE 'STAPLE:%') DESC,
      CASE WHEN source LIKE '%NIN%' THEN 1 WHEN source LIKE '%ICMR%' THEN 2 ELSE 3 END,
      name ASC
    LIMIT ? OFFSET ?
  `;
  params.push(exactTerm, exactTerm, exactTerm, exactTerm, exactTerm, Math.min(100, Math.max(1, limit)), Math.max(0, offset));

  const rows = d.prepare(sql).all(...params);
  return rows.map(r => ({
    food_id: r.id,
    id: r.id,
    name: r.name,
    food_name: r.name,
    food_name_english: r.food_name_english || r.name,
    food_name_tamil: r.food_name_tamil || '',
    food_name_hindi: r.food_name_hindi || '',
    category: r.category || 'Other',
    subcategory: r.subcategory || '',
    scientific_name: r.scientific_name || '',
    food_state: r.prep_state || 'raw',
    preparation_state: r.preparation_state || 'Standard preparation',
    edible_portion_basis: r.edible_portion_basis || '100g edible portion',
    energy_kcal: r.energy_kcal,
    calories: r.energy_kcal,
    protein_g: r.protein_g,
    protein: r.protein_g,
    carb_g: r.carb_g,
    carbs: r.carb_g,
    fat_g: r.fat_g,
    fat: r.fat_g,
    fibre_g: r.fibre_g,
    fibre: r.fibre_g,
    moisture_g: r.moisture_g,
    source_name: r.source,
    source_reference: r.source_reference || '',
    source_version: r.source_version || '',
    data_quality_status: r.data_quality_status || 'Verified Laboratory Analysis',
    licence_status: r.licence_status || 'Open Access',
    last_verified_date: r.last_verified_date || '2026-11-24'
  }));
}

export function searchVerifiedRecipes({ query = '', category = null, cuisine = null, limit = 20, offset = 0 } = {}) {
  const d = getDb();
  let sql = `
    SELECT recipe_id, recipe_name, recipe_name_tamil, recipe_category, cuisine,
           ingredients, ingredient_food_ids, ingredient_quantities_g, ingredient_preparation_states,
           cooking_method, total_recipe_weight_g, serving_count, serving_weight_g,
           total_energy_kcal, total_protein_g, total_carbohydrate_g, total_fat_g, total_fibre_g,
           nutrition_per_100g, nutrition_per_serving, source_name, source_reference,
           calculation_method, confidence_level
    FROM verified_recipes
    WHERE 1=1
  `;
  const params = [];

  if (category) {
    sql += ` AND recipe_category = ?`;
    params.push(category);
  }

  if (cuisine) {
    sql += ` AND cuisine LIKE ?`;
    params.push(`%${cuisine}%`);
  }

  const qClean = String(query || '').trim().toLowerCase();
  if (qClean) {
    sql += ` AND (LOWER(recipe_name) LIKE ? OR LOWER(recipe_name_tamil) LIKE ? OR LOWER(ingredients) LIKE ?)`;
    params.push(`%${qClean}%`, `%${qClean}%`, `%${qClean}%`);
  }

  sql += ` ORDER BY recipe_name ASC LIMIT ? OFFSET ?`;
  params.push(Math.min(100, Math.max(1, limit)), Math.max(0, offset));

  const rows = d.prepare(sql).all(...params);
  return rows.map(r => ({
    ...r,
    nutrition_per_100g: r.nutrition_per_100g ? JSON.parse(r.nutrition_per_100g) : {},
    nutrition_per_serving: r.nutrition_per_serving ? JSON.parse(r.nutrition_per_serving) : {}
  }));
}

export function getVerifiedRecipeById(recipeId) {
  const d = getDb();
  const recipe = d.prepare("SELECT * FROM verified_recipes WHERE recipe_id = ?").get(recipeId);
  if (!recipe) return null;

  const ingredients = d.prepare(`
    SELECT ingredient_sequence, ingredient_food_id, ingredient_name, ingredient_quantity,
           ingredient_unit, ingredient_weight_g, prep_state, contribution_energy_kcal,
           contribution_protein_g, contribution_carbs_g, contribution_fat_g, contribution_fibre_g
    FROM verified_recipe_ingredients
    WHERE recipe_id = ?
    ORDER BY ingredient_sequence ASC
  `).all(recipeId);

  return {
    ...recipe,
    ingredients_summary: recipe.ingredients,
    ingredients: ingredients,
    ingredient_list: ingredients,
    nutrition_per_100g: recipe.nutrition_per_100g ? JSON.parse(recipe.nutrition_per_100g) : {},
    nutrition_per_serving: recipe.nutrition_per_serving ? JSON.parse(recipe.nutrition_per_serving) : {}
  };
}

export function calculateDeterministicRecipe(ingredients = [], { cookingOilGrams = 0, servings = 1, cookedBatchWeightG = null } = {}) {
  const d = getDb();
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFibre = 0;
  let totalRawWeight = 0;

  const calculatedIngredients = [];

  for (const ing of ingredients) {
    const g = Number(ing.grams || ing.weight_g || ing.amount_g || ing.amount) || 100;
    totalRawWeight += g;

    let food = null;
    if (ing.food_id) {
      food = d.prepare("SELECT energy_kcal, protein_g, carb_g, fat_g, fibre_g FROM foods WHERE id = ?").get(ing.food_id);
    }
    if (!food && ing.name) {
      food = d.prepare("SELECT energy_kcal, protein_g, carb_g, fat_g, fibre_g FROM foods WHERE LOWER(name) LIKE ? LIMIT 1").get(`%${String(ing.name).toLowerCase()}%`);
    }

    const baseKcal = Number(food?.energy_kcal) || 0;
    const baseP = Number(food?.protein_g) || 0;
    const baseC = Number(food?.carb_g) || 0;
    const baseF = Number(food?.fat_g) || 0;
    const baseFib = Number(food?.fibre_g) || 0;

    const ratio = g / 100.0;
    const cKcal = Math.round(baseKcal * ratio * 10) / 10;
    const cP = Math.round(baseP * ratio * 10) / 10;
    const cC = Math.round(baseC * ratio * 10) / 10;
    const cF = Math.round(baseF * ratio * 10) / 10;
    const cFib = Math.round(baseFib * ratio * 10) / 10;

    totalKcal += cKcal;
    totalProtein += cP;
    totalCarbs += cC;
    totalFat += cF;
    totalFibre += cFib;

    calculatedIngredients.push({
      food_id: ing.food_id || null,
      name: ing.name || 'Ingredient',
      grams: g,
      contribution_energy_kcal: cKcal,
      contribution_protein_g: cP,
      contribution_carbs_g: cC,
      contribution_fat_g: cF,
      contribution_fibre_g: cFib
    });
  }

  // Cooking Oil: ~8.84 kcal per gram / 100% lipid fat
  const oilG = Number(cookingOilGrams) || 0;
  const oilKcal = Math.round(oilG * 8.84 * 10) / 10;
  const oilFat = oilG;

  totalRawWeight += oilG;
  totalKcal += oilKcal;
  totalFat += oilFat;

  const sCount = Math.max(0.25, Number(servings) || 1);
  const finalCookedWeight = Number(cookedBatchWeightG) > 0 ? Number(cookedBatchWeightG) : Math.round(totalRawWeight * 0.88);

  const perServingKcal = Math.round(totalKcal / sCount);
  const perServingP = Math.round((totalProtein / sCount) * 10) / 10;
  const perServingC = Math.round((totalCarbs / sCount) * 10) / 10;
  const perServingF = Math.round((totalFat / sCount) * 10) / 10;
  const perServingFib = Math.round((totalFibre / sCount) * 10) / 10;

  const scale100 = 100.0 / finalCookedWeight;
  const per100gKcal = Math.round(totalKcal * scale100);
  const per100gP = Math.round(totalProtein * scale100 * 10) / 10;
  const per100gC = Math.round(totalCarbs * scale100 * 10) / 10;
  const per100gF = Math.round(totalFat * scale100 * 10) / 10;
  const per100gFib = Math.round(totalFibre * scale100 * 10) / 10;

  const totalNutrientsObj = {
    energy_kcal: Math.round(totalKcal),
    protein_g: Math.round(totalProtein * 10) / 10,
    carbohydrate_g: Math.round(totalCarbs * 10) / 10,
    fat_g: Math.round(totalFat * 10) / 10,
    fibre_g: Math.round(totalFibre * 10) / 10
  };

  const perServingObj = {
    energy_kcal: perServingKcal,
    protein_g: perServingP,
    carbohydrate_g: perServingC,
    fat_g: perServingF,
    fibre_g: perServingFib
  };

  const per100gObj = {
    energy_kcal: per100gKcal,
    protein_g: per100gP,
    carbohydrate_g: per100gC,
    fat_g: per100gF,
    fibre_g: per100gFib
  };

  return {
    ingredients: calculatedIngredients,
    cooking_oil: { grams: oilG, calories: oilKcal, fat_g: oilFat },
    total_raw_weight_g: totalRawWeight,
    final_cooked_weight_g: finalCookedWeight,
    cooked_batch_weight_g: finalCookedWeight,
    servings: sCount,
    serving_count: sCount,
    serving_weight_g: Math.round(finalCookedWeight / sCount),
    total_nutrition: totalNutrientsObj,
    total_nutrients: totalNutrientsObj,
    nutrition_per_serving: perServingObj,
    per_serving: perServingObj,
    nutrition_per_100g: per100gObj,
    per_100g: per100gObj
  };
}
