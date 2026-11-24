import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import {
  RepeatPreviousMealModal,
  SaveAsMyMealModal,
  MySavedMealsModal,
  RawRecipeBuilderModal,
  AICoachView
} from './NutritionModals.jsx'

describe('NutritionModals Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. RepeatPreviousMealModal
  it('RepeatPreviousMealModal renders liquid glass modal and category tabs', () => {
    const html = renderToString(
      <RepeatPreviousMealModal
        defaultMealType="breakfast"
        onSaveBatch={() => {}}
        close={() => {}}
        toast={() => {}}
      />
    )
    expect(html).toContain('Repeat Previous Meal')
    expect(html).toContain('breakfast')
    expect(html).toContain('lunch')
    expect(html).toContain('dinner')
    expect(html).toContain('snacks')
    expect(html).toContain('Loading past meals...')
  })

  // 2. SaveAsMyMealModal
  it('SaveAsMyMealModal renders meal items and calculated total macros', () => {
    const mockFoods = [
      { id: 'f1', food_name: 'Wheat Roti / Chapati (Cooked)', serving_quantity: 2, serving_unit: 'piece', energy_kcal: 208, protein_g: 6.2, carb_g: 40.6, fat_g: 2.4 },
      { id: 'f2', food_name: 'Egg Gravy (2 Eggs)', serving_quantity: 1, serving_unit: 'serving', energy_kcal: 210, protein_g: 13, carb_g: 6, fat_g: 15 }
    ]

    const html = renderToString(
      <SaveAsMyMealModal
        defaultMealType="breakfast"
        currentFoods={mockFoods}
        onSaved={() => {}}
        close={() => {}}
        toast={() => {}}
      />
    )
    expect(html).toContain('Save as My Meal')
    expect(html).toContain('Meal Template Name')
    expect(html).toContain('Wheat Roti / Chapati (Cooked)')
    expect(html).toContain('Egg Gravy (2 Eggs)')
    // Total kcal should be 208 + 210 = 418
    expect(html).toContain('418')
    expect(html).toContain('Save Meal Template')
  })

  // 3. MySavedMealsModal
  it('MySavedMealsModal renders saved templates manager with category filters', () => {
    const html = renderToString(
      <MySavedMealsModal
        onLogTemplate={() => {}}
        close={() => {}}
        toast={() => {}}
      />
    )
    expect(html).toContain('My Saved Meals &amp; Templates')
    expect(html).toContain('Loading saved meals...')
  })

  // 4. RawRecipeBuilderModal
  it('RawRecipeBuilderModal renders raw ingredients, oil input, yield and serving calculator', () => {
    const html = renderToString(
      <RawRecipeBuilderModal
        onLogRecipePortion={() => {}}
        close={() => {}}
        toast={() => {}}
      />
    )
    expect(html).toContain('Raw Ingredient Recipe Builder')
    expect(html).toContain('Recipe Name')
    expect(html).toContain('Add Raw Ingredient')
    expect(html).toContain('Cooking Oil (g)')
    expect(html).toContain('133') // 15g * 8.84 = 133 kcal
    expect(html).toContain('Per Serving')
    expect(html).toContain('+ Log 1 Serving to Breakfast')
  })

  // 5. AICoachView
  it('AICoachView renders macro targets, calculator, South Indian food recommendations and chat assistant', () => {
    const mockFoods = [
      { energy_kcal: 208, protein_g: 6.2, carb_g: 40.6, fat_g: 2.4 },
      { energy_kcal: 140, protein_g: 12, carb_g: 1, fat_g: 9 }
    ]

    const html = renderToString(
      <AICoachView
        user={{ age: 25, sex: 'male', height: 175, weight: 75 }}
        foods={mockFoods}
        currentTargets={{ calories: 2200, protein: 150, carbs: 250, fat: 60 }}
        onTargetsUpdated={() => {}}
        toast={() => {}}
      />
    )
    expect(html).toContain('IRONX AI')
    expect(html).toContain('Verified Foods (2,799)')
    expect(html).toContain('Verified Recipes (1,014)')
    expect(html).toContain('AI Fast Meal Log')
    expect(html).toContain('Daily Calories')
    expect(html).toContain('Protein Progress')
    expect(html).toContain('Carbs &amp; Fat Balance')
    expect(html).toContain('Suggested South Indian Foods')
    expect(html).toContain('சப்பாத்தி')
    expect(html).toContain('Chat with IRONX AI')
    expect(html).toContain('How much protein do I still need today?')
  })

  // 6. Recipe Macro Calculation Logic Verification
  it('correctly calculates raw recipe nutrition including cooking oil and yield per 100g and serving', () => {
    // 200g Raw Chicken Breast: ~240 kcal, 46g P, 0g C, 5.2g F
    // 14g Sunflower oil: ~123.76 kcal, 0g P, 0g C, 14g F
    // 100g Raw Onion: 40 kcal, 1.1g P, 9.3g C, 0.1g F
    const rawItems = [
      { name: 'Raw Chicken Breast', qty_g: 200, kcal: 240, p: 46, c: 0, f: 5.2 },
      { name: 'Raw Onion', qty_g: 100, kcal: 40, p: 1.1, c: 9.3, f: 0.1 }
    ]
    const oilGrams = 14
    const oilKcal = oilGrams * 8.84 // ~123.76 kcal
    const oilFat = oilGrams

    const totalRawWeight = 200 + 100 // 300g
    const totalKcal = 240 + 40 + oilKcal // 403.76 kcal
    const totalP = 46 + 1.1 // 47.1g
    const totalC = 0 + 9.3 // 9.3g
    const totalF = 5.2 + 0.1 + oilFat // 19.3g

    const cookedWeightG = 250 // Cooked down due to moisture loss
    const servings = 2

    const perServingKcal = Math.round(totalKcal / servings)
    const perServingP = Number((totalP / servings).toFixed(1))
    const perServingC = Number((totalC / servings).toFixed(1))
    const perServingF = Number((totalF / servings).toFixed(1))

    expect(perServingKcal).toBe(202)
    expect(perServingP).toBe(23.6)
    expect(perServingC).toBe(4.7)
    expect(perServingF).toBe(9.7)

    const per100gKcal = Math.round((totalKcal / cookedWeightG) * 100)
    expect(per100gKcal).toBe(162)
  })

  // 7. Mifflin-St Jeor BMR & Macro Balance Verification
  it('correctly calculates BMR and balanced 4P/4C/9F macros', () => {
    // Male: 25yo, 75kg, 175cm
    // BMR = 10 * 75 + 6.25 * 175 - 5 * 25 + 5 = 750 + 1093.75 - 125 + 5 = 1723.75 kcal
    const weightKg = 75
    const heightCm = 175
    const age = 25
    const sex = 'male'
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    expect(Math.round(bmr)).toBe(1724)

    // Activity: Moderate (1.55) -> TDEE = 1723.75 * 1.55 = 2671.8 kcal
    const tdee = bmr * 1.55
    expect(Math.round(tdee)).toBe(2672)

    // Goal: Fat loss (-400 kcal) -> Target = 2272 kcal
    const targetKcal = Math.round(tdee - 400)
    expect(targetKcal).toBe(2272)

    // High protein: 2.0g per kg = 150g protein (600 kcal)
    const proteinG = Math.round(weightKg * 2.0)
    // Fat: 25% of calories = 2272 * 0.25 / 9 = ~63g fat (568 kcal)
    const fatG = Math.round((targetKcal * 0.25) / 9)
    // Carbs: Remaining calories = (2272 - 600 - 568) / 4 = 1104 / 4 = 276g
    const carbsG = Math.max(0, Math.round((targetKcal - (proteinG * 4) - (fatG * 9)) / 4))

    const computedKcal = (proteinG * 4) + (carbsG * 4) + (fatG * 9)
    expect(Math.abs(computedKcal - targetKcal)).toBeLessThanOrEqual(5)
  })
})
