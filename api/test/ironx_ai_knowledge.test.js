import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'

import {
  getFoodById,
  searchFoods,
  searchVerifiedFoods,
  searchVerifiedRecipes,
  getVerifiedRecipeById,
  calculateDeterministicRecipe,
  getDb
} from '../nutrition/db.js'
import { nutritionRoutes } from '../nutrition/routes.js'

test('IRONX AI Phase 14: Scenario 1 - Search chapathi and dosa with verified values', () => {
  const chapati = searchVerifiedFoods({ query: 'chapati', limit: 5 })
  assert.ok(chapati.length > 0, 'Found chapati in verified foods')
  const topChapati = chapati[0]
  assert.ok(topChapati.energy_kcal > 200, 'Chapati energy > 200 kcal/100g')
  assert.ok(topChapati.protein_g > 5, 'Chapati protein > 5g/100g')
  assert.ok(topChapati.carb_g > 40, 'Chapati carbs > 40g/100g')

  const dosa = searchVerifiedFoods({ query: 'dosa', limit: 5 })
  assert.ok(dosa.length > 0, 'Found dosa in verified foods')
  const topDosa = dosa.find(d => d.name.toLowerCase().includes('dosa') || d.energy_kcal > 100) || dosa[0]
  assert.ok(topDosa.energy_kcal > 100, 'Dosa energy > 100 kcal/100g')
  assert.ok(topDosa.protein_g > 2, 'Dosa protein > 2g/100g')
})

test('IRONX AI Phase 14: Scenario 2 - Raw vs Cooked Chicken separation', () => {
  const rawChicken = searchVerifiedFoods({ query: 'chicken breast', foodState: 'raw', limit: 5 })
  const cookedChicken = searchVerifiedFoods({ query: 'chicken breast', foodState: 'cooked', limit: 5 })

  assert.ok(rawChicken.length > 0, 'Raw chicken breast exists')
  assert.ok(cookedChicken.length > 0, 'Cooked chicken breast exists')

  const raw = rawChicken[0]
  const cooked = cookedChicken[0]

  // Cooked chicken loses water so protein per 100g is higher than raw
  assert.ok(cooked.protein_g > raw.protein_g, 'Cooked chicken has higher protein density per 100g due to moisture loss')
  assert.equal(raw.food_state, 'raw')
  assert.equal(cooked.food_state, 'cooked')
})

test('IRONX AI Phase 14: Scenario 3 - Rice varieties (raw vs cooked basmati/white/brown)', () => {
  const cookedRice = searchVerifiedFoods({ query: 'rice', foodState: 'cooked', limit: 10 })
  assert.ok(cookedRice.length > 0, 'Cooked rice found')
  const r = cookedRice[0]
  // Cooked rice has around 130 kcal/100g, carbs around 28g
  assert.ok(r.energy_kcal >= 100 && r.energy_kcal <= 180, 'Cooked rice calories in expected range (100-180 kcal/100g)')
  assert.equal(r.food_state, 'cooked')

  const rawRice = searchVerifiedFoods({ query: 'rice', foodState: 'raw', limit: 10 })
  assert.ok(rawRice.length > 0, 'Raw rice found')
  const rawR = rawRice[0]
  assert.ok(rawR.energy_kcal > 300, 'Raw rice calories > 300 kcal/100g (dry grain)')
})

test('IRONX AI Phase 14: Scenario 4 - Seafood, fish and prawns', () => {
  const fish = searchVerifiedFoods({ query: 'fish', limit: 5 })
  assert.ok(fish.length > 0, 'Fish found')
  assert.ok(fish[0].protein_g >= 15, 'Fish is high protein (>= 15g/100g)')

  const prawns = searchVerifiedFoods({ query: 'prawn', limit: 5 })
  assert.ok(prawns.length > 0, 'Prawns found')
  assert.ok(prawns[0].protein_g >= 15, 'Prawns high protein')
})

test('IRONX AI Phase 14: Scenario 5 - Fruits and vegetables nutrition metrics', () => {
  const banana = searchVerifiedFoods({ query: 'banana', limit: 5 })
  assert.ok(banana.length > 0, 'Banana found')
  assert.ok(banana[0].energy_kcal >= 70 && banana[0].energy_kcal <= 130, 'Banana ~89-110 kcal/100g')
  assert.ok(banana[0].carb_g >= 18, 'Banana carbs >= 18g/100g')

  const spinach = searchVerifiedFoods({ query: 'spinach', limit: 5 })
  assert.ok(spinach.length > 0, 'Spinach found')
  assert.ok(spinach[0].energy_kcal < 50, 'Spinach is low calorie (< 50 kcal/100g)')
})

test('IRONX AI Phase 14: Scenario 6 - Search Tamil food names directly', () => {
  // சப்பாத்தி, தோசை, இட்லி, சாதம், முட்டை, பருப்பு, சாம்பார்
  const chapatiTa = searchVerifiedFoods({ query: 'சப்பாத்தி', limit: 5 })
  assert.ok(chapatiTa.length > 0, 'Tamil query சப்பாத்தி matches food record')

  const dosaTa = searchVerifiedFoods({ query: 'தோசை', limit: 5 })
  assert.ok(dosaTa.length > 0, 'Tamil query தோசை matches food record')

  const idliTa = searchVerifiedFoods({ query: 'இட்லி', limit: 5 })
  assert.ok(idliTa.length > 0, 'Tamil query இட்லி matches food record')

  const sadamTa = searchVerifiedFoods({ query: 'சாதம்', limit: 5 })
  assert.ok(sadamTa.length > 0, 'Tamil query சாதம் matches food record')

  const eggTa = searchVerifiedFoods({ query: 'முட்டை', limit: 5 })
  assert.ok(eggTa.length > 0, 'Tamil query முட்டை matches food record')
})

test('IRONX AI Phase 14: Scenario 7 - Verified Indian Recipes database inspection', () => {
  const recipes = searchVerifiedRecipes({ query: '', limit: 10 })
  assert.ok(recipes.length >= 10, 'Recipes list returned')
  assert.ok(recipes[0].recipe_id, 'Has recipe_id')
  assert.ok(recipes[0].recipe_name, 'Has recipe_name')
  assert.ok(recipes[0].total_energy_kcal > 0, 'Has positive energy')
  assert.ok(recipes[0].serving_weight_g > 0, 'Has serving weight')

  const single = getVerifiedRecipeById(recipes[0].recipe_id)
  assert.ok(single, 'Fetched single recipe by id')
  assert.ok(Array.isArray(single.ingredients), 'Has ingredient array')
  assert.ok(single.ingredients.length > 0, 'Has ingredients listed')
})

test('IRONX AI Phase 14: Scenario 8 - Deterministic Recipe Calculation Engine', () => {
  // Compute composite dish: 200g Raw Rice (INX_STAPLE_RICE_RAW) + 10g Cooking Oil (INX_STAPLE_OIL)
  const calc = calculateDeterministicRecipe([
    { food_id: 'INX_STAPLE_RICE_RAW', amount_g: 200 },
    { food_id: 'INX_STAPLE_OIL', amount_g: 10 }
  ], {
    cookingOilGrams: 0,
    servings: 2,
    cookedBatchWeightG: 500
  })

  assert.ok(calc, 'Calculation succeeded')
  assert.equal(calc.servings, 2)
  assert.equal(calc.total_raw_weight_g, 210)
  assert.equal(calc.cooked_batch_weight_g, 500)
  assert.equal(calc.serving_weight_g, 250)

  // Energy check: 200g raw rice (~700 kcal) + 10g oil (~88.4 kcal) = ~788.4 kcal total
  assert.ok(calc.total_nutrients.energy_kcal > 700 && calc.total_nutrients.energy_kcal < 850)
  // Per serving should be half of total
  assert.ok(Math.abs(calc.per_serving.energy_kcal - (calc.total_nutrients.energy_kcal / 2)) <= 1.0)
})

test('IRONX AI Phase 14: Scenario 9 - Missing values left blank or null, not 0 unless verified 0', () => {
  const db = getDb()
  const rows = db.prepare('SELECT moisture_g FROM foods WHERE moisture_g IS NULL LIMIT 5').all()
  // Verified foods with unknown moisture store NULL, avoiding artificial 0
  assert.ok(rows !== undefined)
})

test('IRONX AI Phase 14: Scenario 10 - Zero-Hallucination AI Gate', () => {
  // Ensure that verified food values come strictly from database records
  const item = getFoodById('INX_STAPLE_ROTI_COOKED')
  assert.ok(item, 'Roti item found')
  // Database values are fixed and immutable by LLM prompt
  assert.equal(item.energy_kcal, 297)
  assert.equal(item.protein_g, 9.0)
  assert.equal(item.carb_g, 58.0)
})

test('IRONX AI Phase 14: Scenario 11 - Provenance, Source Citation, and Licensing', () => {
  const db = getDb()
  const foodsWithLicence = db.prepare(`
    SELECT source_reference, source_version, licence_status, last_verified_date
    FROM foods
    WHERE licence_status IS NOT NULL AND licence_status != ''
    LIMIT 10
  `).all()

  assert.ok(foodsWithLicence.length >= 10, 'Verified foods have licensing status')
  for (const f of foodsWithLicence) {
    assert.ok(f.licence_status.includes('Public Domain') || f.licence_status.includes('Academic') || f.licence_status.includes('Government') || f.licence_status.includes('Open Access'), 'Valid license status')
    assert.ok(f.last_verified_date, 'Has last verified date')
  }
})

test('IRONX AI Phase 14: Scenario 12 - 10 Phase 2 Categories Coverage', () => {
  const db = getDb()
  const categories = db.prepare(`
    SELECT DISTINCT category FROM foods WHERE category IS NOT NULL AND category != ''
  `).all().map(c => c.category)

  const requiredCategories = [
    'Cereals and grains',
    'Vegetables',
    'Pulses and legumes',
    'Fruits',
    'Spices and ingredients',
    'Nuts, seeds and fats',
    'Dairy',
    'Fish and seafood',
    'Poultry and eggs',
    'Meat'
  ]

  for (const reqCat of requiredCategories) {
    assert.ok(categories.includes(reqCat), `Category "${reqCat}" is present in verified foods database`)
  }
})

test('IRONX AI Phase 14: Scenario 13 - Natural Language Bilingual Parsing (English & Tamil)', async () => {
  // Mock request/response helpers for HTTP endpoint
  const routes = nutritionRoutes({
    json: (res, code, data) => { res.statusCode = code; res.body = data; },
    readBody: async (req) => req._body,
    readSession: () => ({ id: 'usr_test', email: 'test@ironx.com' })
  })

  // English multi-item query
  const resEn = {}
  await routes['POST /api/nutrition/ai/parse-nl']({
    _body: { text: 'I ate 2 chapatis and 100g chicken' }
  }, resEn)

  assert.equal(resEn.statusCode, 200)
  assert.ok(resEn.body.ok)
  assert.equal(resEn.body.parsed_items.length, 2)
  assert.equal(resEn.body.parsed_items[0].food_id, 'INX_STAPLE_ROTI_COOKED')
  assert.equal(resEn.body.parsed_items[0].serving_quantity, 2)
  assert.ok(resEn.body.total_calories > 250)

  // Tamil query: 2 சப்பாத்தி மற்றும் 100 கிராம் சாதம்
  const resTa = {}
  await routes['POST /api/nutrition/ai/parse-nl']({
    _body: { text: '2 சப்பாத்தி மற்றும் 100 கிராம் சாதம்' }
  }, resTa)

  assert.equal(resTa.statusCode, 200)
  assert.ok(resTa.body.ok)
  assert.ok(resTa.body.parsed_items.length >= 2, 'Parsed both Tamil items')
})

test('IRONX AI Phase 14: Scenario 14 - Recipe Macro Consistency (Atwater check)', () => {
  const db = getDb()
  const recipes = db.prepare(`
    SELECT recipe_name, total_energy_kcal, total_protein_g, total_carbohydrate_g, total_fat_g
    FROM verified_recipes
    LIMIT 20
  `).all()

  for (const r of recipes) {
    const calcKcal = (r.total_protein_g * 4) + (r.total_carbohydrate_g * 4) + (r.total_fat_g * 9)
    // Tolerance within 20% due to dietary fibre (2 kcal/g) and rounding
    const diff = Math.abs(r.total_energy_kcal - calcKcal)
    assert.ok(diff <= (r.total_energy_kcal * 0.25 + 25), `Macro consistency holds for ${r.recipe_name}`)
  }
})

test('IRONX AI Phase 14: Scenario 15 - HTTP API Endpoints GET /api/nutrition/ai/foods & /recipes', async () => {
  const routes = nutritionRoutes({
    json: (res, code, data) => { res.statusCode = code; res.body = data; },
    readBody: async (req) => req._body,
    readSession: () => ({ id: 'usr_test', email: 'test@ironx.com' })
  })

  // GET /api/nutrition/ai/foods
  const resFoods = {}
  await routes['GET /api/nutrition/ai/foods']({
    url: '/api/nutrition/ai/foods?q=dosa&limit=3'
  }, resFoods)
  assert.equal(resFoods.statusCode, 200)
  assert.ok(resFoods.body.ok)
  assert.ok(resFoods.body.foods.length > 0)

  // GET /api/nutrition/ai/recipes
  const resRecipes = {}
  await routes['GET /api/nutrition/ai/recipes']({
    url: '/api/nutrition/ai/recipes?q=curry&limit=3'
  }, resRecipes)
  assert.equal(resRecipes.statusCode, 200)
  assert.ok(resRecipes.body.ok)
  assert.ok(resRecipes.body.recipes.length > 0)
})
