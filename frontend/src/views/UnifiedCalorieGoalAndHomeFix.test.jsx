import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home.jsx'
import Nutrition from './Nutrition.jsx'
import DailyMealTracker from '../components/DailyMealTracker.jsx'
import HomeMealTracker from '../components/HomeMealTracker.jsx'
import { useStore, DEF } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'

describe('IRONX — Unified Daily Calorie Goal & Home Dashboard Fixes', () => {
  const today = todayISO()

  beforeEach(() => {
    try { localStorage.clear() } catch {}

    const baseS = JSON.parse(JSON.stringify(DEF))
    baseS.nutritionTargets = {
      ...baseS.nutritionTargets,
      calorie: 2000,
      calories: 2000
    }
    // Seed 1,836 kcal of actual consumed foods for today (matching the user's video)
    baseS.meals = [
      {
        id: 'm1',
        d: today,
        date: today,
        type: 'breakfast',
        meal_type: 'breakfast',
        name: 'Oats & Berries',
        food_name: 'Oats & Berries',
        qty: 100,
        unit: 'g',
        calories: 380,
        energy_kcal: 380,
        protein: 18,
        protein_g: 18,
        carbs: 60,
        carb_g: 60,
        fat: 6,
        fat_g: 6
      },
      {
        id: 'm2',
        d: today,
        date: today,
        type: 'lunch',
        meal_type: 'lunch',
        name: 'Grilled Chicken & Rice',
        food_name: 'Grilled Chicken & Rice',
        qty: 350,
        unit: 'g',
        calories: 750,
        energy_kcal: 750,
        protein: 65,
        protein_g: 65,
        carbs: 85,
        carb_g: 85,
        fat: 16,
        fat_g: 16
      },
      {
        id: 'm3',
        d: today,
        date: today,
        type: 'dinner',
        meal_type: 'dinner',
        name: 'Salmon & Steamed Veg',
        food_name: 'Salmon & Steamed Veg',
        qty: 300,
        unit: 'g',
        calories: 706,
        energy_kcal: 706,
        protein: 52,
        protein_g: 52,
        carbs: 25,
        carb_g: 25,
        fat: 42,
        fat_g: 42
      }
    ]

    useStore.setState({
      S: baseS,
      user: { id: 'u_test_athlete', name: 'Athlete Pro', email: 'athlete@ironx.fit' },
      config: {}
    })
  })

  it('Module 1 & 3: Home Dashboard, Daily Health Log, and Today Plan share exact canonical goal', () => {
    // Set canonical goal to 2000 kcal
    useStore.getState().setCalorieTarget(2000)

    const homeHtml = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    // Home Calories Overview renders Consumed / Goal (1,836 / 2,000 kcal) and Remaining (164 kcal)
    expect(homeHtml).toContain('1,836 / 2,000 kcal')
    expect(homeHtml).toContain('Remaining')
    expect(homeHtml).toContain('164 kcal')

    const nutritionHtml = renderToString(
      <MemoryRouter>
        <Nutrition initialTab="log" />
      </MemoryRouter>
    )
    // Daily Health Log shows Daily Calorie Goal control and Remaining
    expect(nutritionHtml).toContain('Daily Calorie Goal')
    expect(nutritionHtml).toContain('1,836')
    expect(nutritionHtml).toContain('/ 2,000 kcal')
    expect(nutritionHtml).toContain('164 kcal')
    expect(nutritionHtml).toContain('Remaining')

    const todayPlanHtml = renderToString(
      <MemoryRouter>
        <DailyMealTracker date={today} />
      </MemoryRouter>
    )
    expect(todayPlanHtml).toContain('2000 kcal')
  })

  it('Module 2: Updating Daily Calorie Goal updates all sections immediately without altering consumed calories', () => {
    // Initial state: goal is 1900 kcal
    useStore.getState().setCalorieTarget(1900)
    let homeHtml = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(homeHtml).toContain('1,836 / 1,900 kcal')
    expect(homeHtml).toContain('64 kcal') // 1900 - 1836 = 64 kcal remaining

    // User edits goal in Daily Health Log to 2200 kcal
    useStore.getState().setCalorieTarget(2200)

    // Re-render Home Dashboard
    homeHtml = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    // Consumed calories remain 1,836 kcal, goal is now 2,200 kcal, remaining is 364 kcal
    expect(homeHtml).toContain('1,836 / 2,200 kcal')
    expect(homeHtml).toContain('364 kcal')

    // Re-render Daily Health Log
    const nutritionHtml = renderToString(
      <MemoryRouter>
        <Nutrition initialTab="log" />
      </MemoryRouter>
    )
    expect(nutritionHtml).toContain('/ 2,200 kcal')
    expect(nutritionHtml).toContain('364 kcal')
  })

  it('Module 5: Home Dashboard renders without crashing when todayWorkout exists (verifies setsDone import)', () => {
    // Add completed workout for today
    useStore.getState().update(s => {
      s.workouts = [
        {
          id: 'w_today',
          d: today,
          date: today,
          name: 'Hypertrophy Upper',
          dur: 3600000, // 60 min
          entries: [
            {
              id: 'bench-press',
              sets: [
                { done: true, w: 90, r: 8 },
                { done: true, w: 90, r: 8 },
                { done: true, w: 90, r: 7 }
              ]
            },
            {
              id: 'pull-up',
              sets: [
                { done: true, w: 0, r: 10 },
                { done: true, w: 0, r: 10 }
              ]
            }
          ]
        }
      ]
    })

    let html = ''
    expect(() => {
      html = renderToString(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )
    }).not.toThrow()

    // Verifies completed workout metrics rendered without crashing
    expect(html).toContain('Hypertrophy Upper')
    expect(html).toContain('5 sets completed')
    expect(html).toContain('2 exercises completed')
    expect(html).not.toContain('Something went wrong')
  })

  it('Module 5: Home Dashboard handles cardio logs with numeric timestamps without throwing TypeError', () => {
    useStore.getState().update(s => {
      s.cardioLogs = [
        {
          id: 'c1',
          d: today,
          activity: 'Outdoor Run',
          distanceKm: 5.5,
          totalDurationMinutes: 30,
          calories_burned: 360,
          createdAt: Date.now() // timestamp number
        },
        {
          id: 'c2',
          activity: 'Brisk Walk',
          distanceKm: 2.0,
          totalDurationMinutes: 20,
          calories_burned: 110,
          createdAt: null // null createdAt
        }
      ]
    })

    let html = ''
    expect(() => {
      html = renderToString(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )
    }).not.toThrow()

    expect(html).toContain('Weekly Activity')
    expect(html).not.toContain('Something went wrong')
  })

  it('Module 6: HomeMealTracker renders adherence and connects to canonical goal', () => {
    useStore.getState().setCalorieTarget(2000)

    let html = ''
    expect(() => {
      html = renderToString(
        <MemoryRouter>
          <HomeMealTracker />
        </MemoryRouter>
      )
    }).not.toThrow()

    expect(html).toMatch(/Today(&#x27;|')s Meal Tracker/)
    expect(html).toContain('4 daily meals adherence')
    expect(html).toContain('Breakfast')
    expect(html).toContain('Lunch')
    expect(html).toContain('Dinner')
    expect(html).toContain('Snacks')
    expect(html).toContain('2,000')
    expect(html).toContain('kcal')
  })
})
