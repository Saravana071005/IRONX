/**
 * IRONX PDF Diet Plan Importer & Deterministic Nutrition Extractor
 * Extracts text from digital or scanned/OCR PDFs and maps foods, ingredients,
 * recipes, and quantities to the verified Food Nutrition Dataset.
 * Zero external AI / LLM dependencies.
 */

import { createRequire } from 'node:module';
import { searchFoods, getFoodById, searchVerifiedRecipes, getVerifiedRecipeById, getPortionUnits } from './db.js';

const require = createRequire(import.meta.url);

let PDFParse = null;
try {
  const pdfParsePkg = require('pdf-parse');
  PDFParse = pdfParsePkg.PDFParse || pdfParsePkg;
} catch (err) {
  console.warn('pdf-parse load warning:', err.message);
}

let Tesseract = null;
try {
  Tesseract = require('tesseract.js');
} catch (err) {
  console.warn('tesseract.js load warning:', err.message);
}

// Common count-to-gram conversion defaults
const DEFAULT_UNIT_GRAMS = {
  egg: 50,
  eggs: 50,
  piece: 50,
  pieces: 50,
  unit: 50,
  units: 50,
  chapathi: 35,
  chapati: 35,
  roti: 35,
  rotis: 35,
  paratha: 60,
  puri: 30,
  idli: 40,
  dosa: 70,
  banana: 100,
  apple: 150,
  slice: 30,
  cup: 200,
  bowl: 250,
  katori: 150,
  tbsp: 15,
  tsp: 5,
  serving: 150,
  scoop: 30
};

// Known composite recipe ingredient templates (deterministic fallbacks for popular Indian diet dishes)
const COMPOSITE_RECIPE_TEMPLATES = {
  'egg curry': {
    name: 'Egg Curry',
    default_servings: 1,
    ingredients: [
      { name: 'Boiled Egg (Whole)', query: 'egg', quantity: 2, unit: 'piece', grams: 100, prep_state: 'boiled' },
      { name: 'Tomato, ripe, hybrid', query: 'tomato', quantity: 50, unit: 'g', grams: 50, prep_state: 'raw' },
      { name: 'Onion, big', query: 'onion', quantity: 50, unit: 'g', grams: 50, prep_state: 'raw' },
      { name: 'Ginger, fresh', query: 'ginger', quantity: 10, unit: 'g', grams: 10, prep_state: 'raw' },
      { name: 'Cooking oil (Sunflower / Mustard)', query: 'oil', quantity: 5, unit: 'g', grams: 5, prep_state: 'liquid' }
    ]
  },
  'chicken curry': {
    name: 'Chicken Curry',
    default_servings: 1,
    ingredients: [
      { name: 'Chicken Breast (Raw)', query: 'chicken raw', quantity: 150, unit: 'g', grams: 150, prep_state: 'raw' },
      { name: 'Tomato, ripe, hybrid', query: 'tomato', quantity: 50, unit: 'g', grams: 50, prep_state: 'raw' },
      { name: 'Onion, big', query: 'onion', quantity: 50, unit: 'g', grams: 50, prep_state: 'raw' },
      { name: 'Ginger, fresh', query: 'ginger', quantity: 10, unit: 'g', grams: 10, prep_state: 'raw' },
      { name: 'Cooking oil', query: 'oil', quantity: 7, unit: 'g', grams: 7, prep_state: 'liquid' }
    ]
  },
  'paneer curry': {
    name: 'Paneer Curry / Bhurji',
    default_servings: 1,
    ingredients: [
      { name: 'Fresh Paneer', query: 'paneer', quantity: 100, unit: 'g', grams: 100, prep_state: 'fresh' },
      { name: 'Tomato, ripe, hybrid', query: 'tomato', quantity: 50, unit: 'g', grams: 50, prep_state: 'raw' },
      { name: 'Onion, big', query: 'onion', quantity: 50, unit: 'g', grams: 50, prep_state: 'raw' },
      { name: 'Cooking oil', query: 'oil', quantity: 5, unit: 'g', grams: 5, prep_state: 'liquid' }
    ]
  },
  'dal tadka': {
    name: 'Dal Tadka (Cooked Yellow Moong Dal)',
    default_servings: 1,
    ingredients: [
      { name: 'Moong Dal, split (Dry)', query: 'moong dal', quantity: 40, unit: 'g', grams: 40, prep_state: 'raw' },
      { name: 'Tomato, ripe, hybrid', query: 'tomato', quantity: 30, unit: 'g', grams: 30, prep_state: 'raw' },
      { name: 'Onion, big', query: 'onion', quantity: 20, unit: 'g', grams: 20, prep_state: 'raw' },
      { name: 'Ghee / Cooking oil', query: 'ghee', quantity: 5, unit: 'g', grams: 5, prep_state: 'liquid' }
    ]
  },
  'vegetable mix': {
    name: 'Steamed Mixed Vegetables',
    default_servings: 1,
    ingredients: [
      { name: 'Carrot', query: 'carrot', quantity: 30, unit: 'g', grams: 30, prep_state: 'raw' },
      { name: 'Green Peas', query: 'green peas', quantity: 30, unit: 'g', grams: 30, prep_state: 'raw' },
      { name: 'French Beans', query: 'beans', quantity: 20, unit: 'g', grams: 20, prep_state: 'raw' },
      { name: 'Cauliflower', query: 'cauliflower', quantity: 20, unit: 'g', grams: 20, prep_state: 'raw' }
    ]
  },
  'mixed vegetables': {
    name: 'Steamed Mixed Vegetables',
    default_servings: 1,
    ingredients: [
      { name: 'Carrot', query: 'carrot', quantity: 30, unit: 'g', grams: 30, prep_state: 'raw' },
      { name: 'Green Peas', query: 'green peas', quantity: 30, unit: 'g', grams: 30, prep_state: 'raw' },
      { name: 'French Beans', query: 'beans', quantity: 20, unit: 'g', grams: 20, prep_state: 'raw' },
      { name: 'Cauliflower', query: 'cauliflower', quantity: 20, unit: 'g', grams: 20, prep_state: 'raw' }
    ]
  }
};

/**
 * Extract plain text from PDF buffer, with OCR fallback for scanned pages.
 * @param {Buffer|Uint8Array} pdfBuffer
 * @returns {Promise<string>} Extracted plain text
 */
export async function extractTextFromPdf(pdfBuffer) {
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('PDF buffer is empty or invalid');
  }

  const u8Array = pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer);
  let text = '';

  // 1. Digital Text Extraction
  if (PDFParse) {
    try {
      const parser = new PDFParse(u8Array);
      if (typeof parser.load === 'function') {
        await parser.load();
        const res = await parser.getText();
        text = typeof res === 'string' ? res : (res?.text || '');
      } else if (typeof parser === 'function') {
        const res = await parser(pdfBuffer);
        text = res?.text || '';
      }
    } catch (err) {
      console.warn('PDF digital text extraction error:', err.message);
    }
  }

  // 2. OCR Fallback if text is suspiciously short or empty (scanned image)
  if ((!text || text.trim().length < 25) && Tesseract) {
    try {
      console.log('PDF text is empty or scanned image. Running Tesseract OCR fallback...');
      const ocrRes = await Tesseract.recognize(pdfBuffer, 'eng');
      text = ocrRes?.data?.text || text;
    } catch (ocrErr) {
      console.warn('Tesseract OCR fallback error:', ocrErr.message);
    }
  }

  return cleanExtractedText(text);
}

/**
 * Clean and normalize text extracted from PDF
 */
export function cleanExtractedText(raw) {
  if (!raw) return '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-') // Normalize bullets
    .replace(/[–—]/g, '-') // Normalize dashes
    .replace(/\t+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

/**
 * Deterministic NLP Diet Plan Parser
 * Analyzes structured text to identify:
 * - Meal categories (Breakfast, Lunch, Snacks, Dinner)
 * - Food names & quantities
 * - Ingredients & recipes
 * - Accurate nutrition dataset matches
 * @param {string} text
 * @returns {Object} Structured plan with matched foods and calculations
 */
export function parseDietPlanText(text) {
  const normalized = cleanExtractedText(text);
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

  const meals = {
    breakfast: [],
    lunch: [],
    snacks: [],
    dinner: []
  };

  let currentMeal = 'breakfast';
  let missingConfirmationCount = 0;

  // Meal header detection regex
  const headerPatterns = [
    { type: 'breakfast', regex: /^(?:meal\s*1|breakfast|morning(?:\s*meal)?|pre-workout|wake\s*up):?/i },
    { type: 'lunch', regex: /^(?:meal\s*2|lunch|midday|afternoon|post-workout):?/i },
    { type: 'snacks', regex: /^(?:meal\s*3|snacks?|evening(?:\s*snack)?|tea\s*time):?/i },
    { type: 'dinner', regex: /^(?:meal\s*4|dinner|night|supper):?/i }
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line is a meal category header
    let isHeader = false;
    for (const h of headerPatterns) {
      if (h.regex.test(line)) {
        currentMeal = h.type;
        isHeader = true;
        break;
      }
    }
    if (isHeader) continue;

    // Clean bullet points (do not strip the quantity digits!)
    // Strips leading hyphens, asterisks, bullets, or list indices like "1." or "1)"
    let itemStr = line.replace(/^[–—\-*•\s]+/, '').replace(/^\d+[\.\)]\s*/, '').trim();
    if (!itemStr || itemStr.length < 2) continue;

    // Parse food item
    const parsedItem = parseFoodItemString(itemStr);
    if (!parsedItem.foodName) continue;

    // Match against verified dataset and recipes
    const resolvedItem = matchFoodInDataset(parsedItem);
    if (resolvedItem.requires_confirmation) {
      missingConfirmationCount++;
    }

    meals[currentMeal].push(resolvedItem);
  }

  // Calculate planned totals
  const totalPlanned = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0
  };

  Object.values(meals).forEach(mealList => {
    mealList.forEach(item => {
      if (item.energy_kcal != null) {
        totalPlanned.calories += Number(item.energy_kcal) || 0;
        totalPlanned.protein += Number(item.protein_g) || 0;
        totalPlanned.carbs += Number(item.carb_g) || 0;
        totalPlanned.fat += Number(item.fat_g) || 0;
        totalPlanned.fiber += Number(item.fibre_g) || 0;
      }
    });
  });

  // Round values
  totalPlanned.calories = Math.round(totalPlanned.calories * 10) / 10;
  totalPlanned.protein = Math.round(totalPlanned.protein * 10) / 10;
  totalPlanned.carbs = Math.round(totalPlanned.carbs * 10) / 10;
  totalPlanned.fat = Math.round(totalPlanned.fat * 10) / 10;
  totalPlanned.fiber = Math.round(totalPlanned.fiber * 10) / 10;

  return {
    ok: true,
    rawText: normalized,
    meals,
    totalPlanned,
    missingConfirmationCount
  };
}

/**
 * Parse an individual line into quantity, unit, and food name
 * Examples:
 * - "2 Chapathi" -> qty: 2, unit: "piece", foodName: "Chapathi"
 * - "3 Eggs" -> qty: 3, unit: "piece", foodName: "Eggs"
 * - "150 g Rice" -> qty: 150, unit: "g", foodName: "Rice"
 * - "150 g Chicken" -> qty: 150, unit: "g", foodName: "Chicken"
 * - "Vegetables" -> qty: 100, unit: "g", foodName: "Vegetables"
 * - "Egg Curry" -> qty: 1, unit: "serving", foodName: "Egg Curry"
 */
export function parseFoodItemString(str) {
  let cleaned = str.trim();

  // Pattern 1: Quantity + Unit + FoodName (e.g. "150 g Rice", "200 ml Milk", "2 cups Oats")
  const p1 = /^(\d+(?:\.\d+)?)\s*(g|grams?|kg|ml|l|litres?|cups?|pieces?|units?|tbsp|tsp|katori|bowl|scoop|serving)\s+(?:of\s+)?(.+)$/i;
  const m1 = cleaned.match(p1);
  if (m1) {
    return {
      quantity: parseFloat(m1[1]),
      unit: normalizeUnit(m1[2]),
      foodName: m1[3].trim()
    };
  }

  // Pattern 2: Quantity + FoodName (e.g. "2 Chapathi", "3 Eggs", "1 Banana")
  const p2 = /^(\d+(?:\.\d+)?)\s+(.+)$/i;
  const m2 = cleaned.match(p2);
  if (m2) {
    const rawName = m2[2].trim();
    const qty = parseFloat(m2[1]);
    return {
      quantity: qty,
      unit: inferUnitForFood(rawName),
      foodName: rawName
    };
  }

  // Pattern 3: FoodName + "-" + Quantity + Unit (e.g. "Rice - 150g", "Chicken - 150 grams")
  const p3 = /^(.+?)\s*[-:]\s*(\d+(?:\.\d+)?)\s*(g|grams?|kg|ml|l|litres?|cups?|pieces?|units?|tbsp|tsp|katori|bowl|scoop|serving)?$/i;
  const m3 = cleaned.match(p3);
  if (m3) {
    const foodName = m3[1].trim();
    const qty = parseFloat(m3[2]);
    const unit = m3[3] ? normalizeUnit(m3[3]) : inferUnitForFood(foodName);
    return {
      quantity: qty,
      unit,
      foodName
    };
  }

  // Pattern 4: Bare FoodName without quantity (e.g. "Vegetables", "Egg Curry", "Apple")
  const defaultUnit = inferUnitForFood(cleaned);
  return {
    quantity: defaultUnit === 'g' ? 100 : 1,
    unit: defaultUnit,
    foodName: cleaned,
    unspecifiedQuantity: true
  };
}

/**
 * Normalize unit strings to standard values
 */
function normalizeUnit(unit) {
  if (!unit) return 'g';
  const u = unit.toLowerCase();
  if (u.startsWith('gram') || u === 'g') return 'g';
  if (u === 'kg') return 'kg';
  if (u === 'ml') return 'ml';
  if (u.startsWith('l') && !u.startsWith('lb')) return 'L';
  if (u.startsWith('cup')) return 'cup';
  if (u.startsWith('piece') || u.startsWith('unit')) return 'piece';
  if (u.startsWith('tbsp') || u.startsWith('tablespoon')) return 'tbsp';
  if (u.startsWith('tsp') || u.startsWith('teaspoon')) return 'tsp';
  if (u === 'katori') return 'katori';
  if (u === 'bowl') return 'bowl';
  if (u.startsWith('serving')) return 'serving';
  if (u.startsWith('scoop')) return 'scoop';
  return 'g';
}

/**
 * Infer standard default unit for known food patterns
 */
function inferUnitForFood(name) {
  const n = name.toLowerCase();
  if (n.includes('chapathi') || n.includes('chapati') || n.includes('roti') || n.includes('egg') || n.includes('banana') || n.includes('apple') || n.includes('idli') || n.includes('dosa') || n.includes('slice')) {
    return 'piece';
  }
  if (n.includes('curry') || n.includes('dal') || n.includes('sambar') || n.includes('soup')) {
    return 'serving';
  }
  if (n.includes('milk') || n.includes('water') || n.includes('juice')) {
    return 'ml';
  }
  return 'g';
}

/**
 * Match parsed food item against verified food dataset or recipe catalog
 * @param {Object} parsedItem
 * @returns {Object} Structured food record with verified nutrition
 */
export function matchFoodInDataset(parsedItem) {
  const { foodName, quantity, unit, unspecifiedQuantity } = parsedItem;
  const lowerName = foodName.toLowerCase();
  const id = 'diet_item_' + Math.random().toString(36).slice(2, 10);

  // 1. Check for Composite Recipes (e.g. Egg Curry, Chicken Curry, Dal Tadka)
  for (const [recipeKey, recipeTemplate] of Object.entries(COMPOSITE_RECIPE_TEMPLATES)) {
    if (lowerName.includes(recipeKey)) {
      return buildCompositeRecipeItem(id, foodName, quantity, recipeTemplate, unspecifiedQuantity);
    }
  }

  // Check verified recipes database ONLY if the food name indicates a composite dish
  const isRecipeIndicated = /(curry|sambar|biryani|korma|pulao|gravy|masala|soup|stew|bhurji|dal\s+tadka)/i.test(lowerName);
  if (isRecipeIndicated) {
    const recipeMatches = searchVerifiedRecipes({ query: foodName, limit: 1 });
    if (recipeMatches && recipeMatches.length > 0) {
      const vr = recipeMatches[0];
      const servings = quantity || 1;
      const nutrition = vr.nutrition_per_serving || vr.nutrition_per_100g || {};
      return {
        id,
        food_id: vr.recipe_id,
        food_name: vr.recipe_name,
        matched: true,
        is_recipe: true,
        serving_quantity: servings,
        serving_unit: 'serving',
        serving_grams: (vr.serving_weight_g || 150) * servings,
        energy_kcal: Math.round(((nutrition.kcal || vr.total_energy_kcal) * servings) * 10) / 10,
        protein_g: Math.round(((nutrition.protein || vr.total_protein_g) * servings) * 10) / 10,
        carb_g: Math.round(((nutrition.carbs || vr.total_carbohydrate_g) * servings) * 10) / 10,
        fat_g: Math.round(((nutrition.fat || vr.total_fat_g) * servings) * 10) / 10,
        fibre_g: Math.round(((nutrition.fibre || vr.total_fibre_g) * servings) * 10) / 10,
        prep_state: 'cooked',
        verified_source: vr.source_name || 'INDB Standardized Recipes',
        requires_confirmation: !!unspecifiedQuantity,
        ingredients: vr.ingredients ? vr.ingredients.split(';').map(ing => ({ name: ing.trim() })) : []
      };
    }
  }

  // 2. Search Verified Foods Dataset
  let foodMatch = null;

  // Direct staples prioritized mapping
  if (lowerName.includes('chapathi') || lowerName.includes('chapati') || lowerName.includes('roti')) {
    foodMatch = getFoodById('STAPLE:roti');
  } else if (lowerName.includes('boiled egg') || (lowerName.includes('egg') && !lowerName.includes('curry') && !lowerName.includes('fried'))) {
    foodMatch = getFoodById('STAPLE:egg_boiled');
  } else if (lowerName.includes('rice') && (lowerName.includes('white') || lowerName.includes('steamed') || !lowerName.includes('brown'))) {
    foodMatch = getFoodById('STAPLE:cooked_rice');
  } else if (lowerName.includes('chicken') && (lowerName.includes('breast') || lowerName.includes('cooked') || !lowerName.includes('raw'))) {
    foodMatch = getFoodById('STAPLE:chicken_cooked');
  } else if (lowerName.includes('dosa') || lowerName.includes('dosai')) {
    foodMatch = getFoodById('STAPLE:dosa');
  } else if (lowerName.includes('paneer')) {
    foodMatch = getFoodById('STAPLE:paneer');
  } else if (lowerName.includes('banana')) {
    foodMatch = getFoodById('STAPLE:banana');
  } else if (lowerName.includes('apple')) {
    foodMatch = getFoodById('STAPLE:apple');
  } else if (lowerName.includes('oat') || lowerName.includes('oats')) {
    foodMatch = getFoodById('STAPLE:oats');
  } else if (lowerName.includes('curd') || lowerName.includes('yogurt') || lowerName.includes('dahi')) {
    foodMatch = getFoodById('STAPLE:curd');
  } else if (lowerName.includes('vegetable') || lowerName.includes('veggie') || lowerName.includes('sabzi')) {
    foodMatch = getFoodById('STAPLE:mixed_veg');
  }

  // Fallback to fuzzy search if staple not directly matched
  if (!foodMatch) {
    const searchResults = searchFoods(foodName, 3);
    if (searchResults && searchResults.length > 0) {
      foodMatch = searchResults[0];
    }
  }

  // 3. Unmatched Food Handling (Never invent values, never assign 0 silently)
  if (!foodMatch) {
    return {
      id,
      food_id: null,
      food_name: foodName,
      matched: false,
      message: 'Food not found in nutrition database',
      serving_quantity: quantity,
      serving_unit: unit,
      serving_grams: unit === 'g' ? quantity : null,
      energy_kcal: null,
      protein_g: null,
      carb_g: null,
      fat_g: null,
      fibre_g: null,
      prep_state: 'unknown',
      requires_confirmation: true,
      unspecifiedQuantity: !!unspecifiedQuantity
    };
  }

  // 4. Calculate Gram Weight & Nutrition
  const servingGrams = calculateGrams(foodMatch, quantity, unit);
  const factor = servingGrams / (foodMatch.serving_basis_g || 100);

  const energyKcal = Math.round((Number(foodMatch.energy_kcal) * factor) * 10) / 10;
  const proteinG = Math.round((Number(foodMatch.protein_g) * factor) * 10) / 10;
  const carbG = Math.round((Number(foodMatch.carb_g) * factor) * 10) / 10;
  const fatG = Math.round((Number(foodMatch.fat_g) * factor) * 10) / 10;
  const fibreG = Math.round((Number(foodMatch.fibre_g) * factor) * 10) / 10;

  return {
    id,
    food_id: foodMatch.id,
    food_name: foodMatch.name,
    original_input_name: foodName,
    matched: true,
    is_recipe: false,
    serving_quantity: quantity,
    serving_unit: unit,
    serving_grams: servingGrams,
    energy_kcal: energyKcal,
    protein_g: proteinG,
    carb_g: carbG,
    fat_g: fatG,
    fibre_g: fibreG,
    category: foodMatch.category,
    prep_state: foodMatch.prep_state || 'cooked',
    verified_source: foodMatch.verified_source || 'ICMR-NIN 2017 / USDA',
    requires_confirmation: !!unspecifiedQuantity,
    unspecifiedQuantity: !!unspecifiedQuantity
  };
}

/**
 * Build composite recipe record with ingredient breakdown
 */
function buildCompositeRecipeItem(id, originalName, quantity, template, unspecifiedQuantity) {
  const servings = quantity || 1;
  const ingredients = template.ingredients.map(ing => {
    const ingQty = ing.quantity * servings;
    const ingGrams = ing.grams * servings;
    const match = searchFoods(ing.query, 1)[0];
    let cal = 0, p = 0, c = 0, f = 0, fib = 0;
    if (match) {
      const factor = ingGrams / 100;
      cal = Math.round((Number(match.energy_kcal) * factor) * 10) / 10;
      p = Math.round((Number(match.protein_g) * factor) * 10) / 10;
      c = Math.round((Number(match.carb_g) * factor) * 10) / 10;
      f = Math.round((Number(match.fat_g) * factor) * 10) / 10;
      fib = Math.round((Number(match.fibre_g) * factor) * 10) / 10;
    }
    return {
      food_id: match?.id || null,
      food_name: ing.name,
      quantity: ingQty,
      unit: ing.unit,
      grams: ingGrams,
      prep_state: ing.prep_state,
      energy_kcal: cal,
      protein_g: p,
      carb_g: c,
      fat_g: f,
      fibre_g: fib,
      requires_confirmation: false
    };
  });

  const totals = ingredients.reduce((acc, cur) => ({
    calories: acc.calories + (cur.energy_kcal || 0),
    protein: acc.protein + (cur.protein_g || 0),
    carbs: acc.carbs + (cur.carb_g || 0),
    fat: acc.fat + (cur.fat_g || 0),
    fiber: acc.fiber + (cur.fibre_g || 0),
    grams: acc.grams + (cur.grams || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, grams: 0 });

  return {
    id,
    food_id: 'COMPOSITE:' + template.name.toLowerCase().replace(/\s+/g, '_'),
    food_name: template.name,
    original_input_name: originalName,
    matched: true,
    is_recipe: true,
    serving_quantity: servings,
    serving_unit: 'serving',
    serving_grams: totals.grams,
    energy_kcal: Math.round(totals.calories * 10) / 10,
    protein_g: Math.round(totals.protein * 10) / 10,
    carb_g: Math.round(totals.carbs * 10) / 10,
    fat_g: Math.round(totals.fat * 10) / 10,
    fibre_g: Math.round(totals.fiber * 10) / 10,
    prep_state: 'cooked',
    verified_source: 'INDB / ICMR-NIN Recipe Synthesis',
    requires_confirmation: !!unspecifiedQuantity,
    unspecifiedQuantity: !!unspecifiedQuantity,
    ingredients
  };
}

/**
 * Resolve gram weight from food and portion unit
 */
function calculateGrams(food, quantity, unit) {
  const qty = Number(quantity) || 1;
  const u = String(unit || 'g').toLowerCase();

  // Metric grams
  if (u === 'g' || u === 'gram' || u === 'grams') return qty;
  if (u === 'kg') return qty * 1000;
  if (u === 'ml') return qty;
  if (u === 'l' || u === 'liter' || u === 'litre') return qty * 1000;

  // Food-specific units in DB
  const portions = getPortionUnits(food.id);
  if (portions && portions.length > 0) {
    const matchedPortion = portions.find(p => p.unit_name && p.unit_name.toLowerCase() === u);
    if (matchedPortion && matchedPortion.gram_weight) {
      return qty * matchedPortion.gram_weight;
    }
  }

  // Food name specific defaults
  const fname = (food.name || '').toLowerCase();
  for (const [key, g] of Object.entries(DEFAULT_UNIT_GRAMS)) {
    if (fname.includes(key)) {
      return qty * g;
    }
  }

  // Generic unit fallback
  if (DEFAULT_UNIT_GRAMS[u]) {
    return qty * DEFAULT_UNIT_GRAMS[u];
  }

  return qty * 100;
}
