import { useState, useEffect, useMemo, useCallback } from 'react'
import { useStore, getHealthStorageKey, getHealthSettingsKey } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { todayISO, fmtDate, fmtDur, fmtVol } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { exportDailyReportPdf } from '../lib/exportDailyReportPdf.js'
import { cardioSheet, confirmSheet } from '../sheets.jsx'
import { EXIDX } from '../lib/exercises.js'
import {
  AddDietPlanPdfModal,
  MyDietPlansView,
  MyNutritionGoalsView,
  CheatMealModal,
  AvailableFoodsModal,
  NutritionNotificationsModal
} from './DietPlanModals.jsx'
import DailyMealTracker from '../components/DailyMealTracker.jsx'
import {
  RepeatPreviousMealModal,
  SaveAsMyMealModal,
  MySavedMealsModal,
  RawRecipeBuilderModal,
  AICoachView
} from './NutritionModals.jsx'

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: 'sun', color: 'var(--orange)' },
  { id: 'lunch', label: 'Lunch', icon: 'sun', color: 'var(--yellow)' },
  { id: 'dinner', label: 'Dinner', icon: 'moon', color: 'var(--indigo)' },
  { id: 'snacks', label: 'Snacks', icon: 'apple', color: 'var(--green)' }
]

const UNITS = ['g', 'kg', 'ml', 'L', 'piece', 'cup', 'serving']

const CARDIO_TYPES = ['walking', 'running', 'cycling', 'treadmill', 'HIIT', 'other']

const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full Body', 'Other']

// Reference examples showing the simplified food logging format (clearly marked and not counted in user data)
const EXAMPLE_ENTRIES = [
  {
    id: 'example-1',
    is_example: true,
    meal_type: 'breakfast',
    food_name: 'Rolled oats, overnight soaked',
    serving_quantity: 100,
    serving_unit: 'g',
    notes: 'Soaked overnight in water'
  },
  {
    id: 'example-2',
    is_example: true,
    meal_type: 'breakfast',
    food_name: 'Banana',
    serving_quantity: 150,
    serving_unit: 'g',
    notes: 'Medium banana, sliced'
  }
]

export default function Nutrition({ initialTab = 'today_plan' } = {}) {
  const hookS = useStore(s => s.S)
  const hookUser = useStore(s => s.user)
  const S = (typeof window === 'undefined' && useStore.getState().S) ? useStore.getState().S : hookS
  const user = (typeof window === 'undefined' && useStore.getState().user) ? useStore.getState().user : hookUser
  const { openSheet, toast } = useUI()
  const [activeTab, setActiveTab] = useState(initialTab) // 'today_plan' | 'log' | 'diet_plans' | 'goals' | 'coach' | 'saved'

  const handleOpenAddDietPdf = () => {
    openSheet(close => (
      <AddDietPlanPdfModal
        onPlanSaved={() => {
          loadData()
          setActiveTab('today_plan')
        }}
        close={close}
        toast={toast}
      />
    ))
  }

  const handleOpenCheatMeal = () => {
    openSheet(close => (
      <CheatMealModal
        onLogged={() => {
          loadData()
        }}
        close={close}
        toast={toast}
      />
    ))
  }

  const handleOpenAvailableFoods = () => {
    openSheet(close => (
      <AvailableFoodsModal
        close={close}
        toast={toast}
      />
    ))
  }

  const handleOpenNotificationsConfig = () => {
    openSheet(close => (
      <NutritionNotificationsModal
        close={close}
        toast={toast}
      />
    ))
  }

  const canonicalTarget = Number(S?.nutritionTargets?.calorie || S?.nutritionTargets?.calories || user?.calorie_target || user?.nutritionTargets?.calorie) || 2000
  const [userCalorieTarget, setUserCalorieTarget] = useState(canonicalTarget)
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [editingCalorieGoal, setEditingCalorieGoal] = useState(canonicalTarget)
  const [savingGoal, setSavingGoal] = useState(false)

  useEffect(() => {
    setUserCalorieTarget(canonicalTarget)
    if (!isEditingGoal) setEditingCalorieGoal(canonicalTarget)
  }, [canonicalTarget])

  const handleSaveDailyCalorieGoal = async () => {
    const val = Math.round(Number(editingCalorieGoal))
    if (!val || isNaN(val) || val < 500 || val > 10000) {
      toast(t('Please enter a valid daily calorie goal between 500 and 10,000 kcal.'))
      return
    }
    try {
      setSavingGoal(true)
      const res = await api('/api/nutrition/daily-goal', {
        method: 'POST',
        body: JSON.stringify({ calorie_target: val })
      })
      if (res?.ok) {
        useStore.getState().setCalorieTarget(val)
        setUserCalorieTarget(val)
        setIsEditingGoal(false)
        toast(t('Daily Calorie Goal updated to {0} kcal', val.toLocaleString()))
        loadDayData(date)
      } else {
        toast(res?.error || t('Failed to update calorie goal'))
      }
    } catch (err) {
      toast(t('Error updating calorie goal: {0}', err.message))
    } finally {
      setSavingGoal(false)
    }
  }

  const [date, setDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)
  const [showExamples, setShowExamples] = useState(false)

  // Daily records
  const [foods, setFoods] = useState(() => {
    try {
      const d = todayISO()
      return (S?.meals || []).filter(m => m && (m.date === d || m.d === d)).map(m => ({
        id: m.id,
        user_id: m.user_id,
        meal_type: m.meal_type || m.type || 'breakfast',
        food_name: m.food_name || m.name || 'Food entry',
        serving_quantity: Number(m.serving_quantity || m.qty) || 100,
        serving_unit: m.serving_unit || m.unit || 'g',
        energy_kcal: Number(m.energy_kcal || m.calories || m.calorie) || 0,
        calories: Number(m.energy_kcal || m.calories || m.calorie) || 0,
        protein_g: Number(m.protein_g || m.protein) || 0,
        protein: Number(m.protein_g || m.protein) || 0,
        carb_g: Number(m.carb_g || m.carbs || m.carb) || 0,
        carbs: Number(m.carb_g || m.carbs || m.carb) || 0,
        fat_g: Number(m.fat_g || m.fat) || 0,
        fat: Number(m.fat_g || m.fat) || 0,
        notes: m.notes || null,
        date: m.date || m.d || d,
        created_at: m.created_at || m.createdAt || null
      }))
    } catch {
      return []
    }
  })
  const [water, setWater] = useState([])
  const [cardio, setCardio] = useState([])
  const [strength, setStrength] = useState([])

  // Settings
  const [waterGoalL, setWaterGoalL] = useState(2.5)
  const [editingWaterGoal, setEditingWaterGoal] = useState(false)
  const [waterGoalDraft, setWaterGoalDraft] = useState('2.5')

  // Quick water custom input
  const [customWaterAmount, setCustomWaterAmount] = useState('')
  const [customWaterUnit, setCustomWaterUnit] = useState('ml')
  const [customWaterNote, setCustomWaterNote] = useState('')

  // Load daily health data whenever date or user changes
  useEffect(() => {
    loadDayData(date)
  }, [date, user])

  // Completed strength workouts for the selected date from S.workouts
  const completedWorkoutsForDay = useMemo(() => {
    return (S.workouts || []).filter(w => w && (w.d === date || w.date === date))
  }, [S.workouts, date])

  // Unified cardio activities from store and health log
  const allCardioForDay = useMemo(() => {
    const storeCardio = (S.cardioLogs || []).filter(c => {
      if (!c) return false
      if (c.d === date || c.date === date) return true
      if (c.createdAt) {
        if (typeof c.createdAt === 'string') return c.createdAt.slice(0, 10) === date
        if (typeof c.createdAt === 'number') {
          try { return new Date(c.createdAt).toISOString().slice(0, 10) === date } catch (e) { return false }
        }
      }
      return false
    })
    const map = new Map()
    storeCardio.forEach(c => {
      map.set(c.id, {
        id: c.id,
        activity_type: c.activity || c.activity_type || 'Walking',
        duration_min: c.totalDurationMinutes || c.duration_min || (Number(c.durationHours || 0) * 60 + Number(c.durationMinutes || 0)),
        distance_km: c.distanceKm != null ? c.distanceKm : c.distance_km,
        steps: c.steps || null,
        calories_burned: c.calories_burned || Math.round((c.totalDurationMinutes || c.duration_min || 30) * 5),
        notes: c.notes || ''
      })
    })
    cardio.forEach(c => {
      if (!map.has(c.id)) {
        map.set(c.id, c)
      }
    })
    return Array.from(map.values())
  }, [S.cardioLogs, cardio, date])

  async function loadDayData(d) {
    setLoading(true)
    // Synchronize immediately from store in-memory state to eliminate latency
    const storeDayMeals = (S.meals || []).filter(m => m && (m.date === d || m.d === d)).map(m => ({
      id: m.id,
      user_id: m.user_id,
      meal_type: m.meal_type || m.type || 'breakfast',
      food_name: m.food_name || m.name || 'Food entry',
      serving_quantity: Number(m.serving_quantity || m.qty) || 100,
      serving_unit: m.serving_unit || m.unit || 'g',
      energy_kcal: Number(m.energy_kcal || m.calories || m.calorie) || 0,
      calories: Number(m.energy_kcal || m.calories || m.calorie) || 0,
      protein_g: Number(m.protein_g || m.protein) || 0,
      protein: Number(m.protein_g || m.protein) || 0,
      carb_g: Number(m.carb_g || m.carbs || m.carb) || 0,
      carbs: Number(m.carb_g || m.carbs || m.carb) || 0,
      fat_g: Number(m.fat_g || m.fat) || 0,
      fat: Number(m.fat_g || m.fat) || 0,
      notes: m.notes || null,
      date: m.date || m.d || d,
      created_at: m.created_at || m.createdAt || null
    }))
    if (storeDayMeals.length > 0) {
      setFoods(storeDayMeals)
    }

    if (user) {
      try {
        const res = await api(`/api/nutrition/health-log?date=${d}`)
        if (res.ok) {
          const fetchedFoods = (res.foods || []).map(f => ({
            id: f.id,
            user_id: f.user_id,
            meal_type: f.meal_type || f.type || 'breakfast',
            food_name: f.food_name || f.name || 'Food entry',
            serving_quantity: Number(f.serving_quantity || f.qty) || 100,
            serving_unit: f.serving_unit || f.unit || 'g',
            energy_kcal: Number(f.energy_kcal != null ? f.energy_kcal : (f.calories != null ? f.calories : 0)),
            calories: Number(f.energy_kcal != null ? f.energy_kcal : (f.calories != null ? f.calories : 0)),
            protein_g: Number(f.protein_g != null ? f.protein_g : (f.protein != null ? f.protein : 0)),
            protein: Number(f.protein_g != null ? f.protein_g : (f.protein != null ? f.protein : 0)),
            carb_g: Number(f.carb_g != null ? f.carb_g : (f.carbs != null ? f.carbs : 0)),
            carbs: Number(f.carb_g != null ? f.carb_g : (f.carbs != null ? f.carbs : 0)),
            fat_g: Number(f.fat_g != null ? f.fat_g : (f.fat != null ? f.fat : 0)),
            fat: Number(f.fat_g != null ? f.fat_g : (f.fat != null ? f.fat : 0)),
            notes: f.notes || null,
            date: f.date || f.d || d,
            created_at: f.created_at || f.createdAt || null
          }))

          setFoods(fetchedFoods)
          setWater(res.water || [])
          setCardio(res.cardio || [])
          setStrength(res.strength || [])
          if (res.settings && res.settings.calorie_target != null) {
            const calT = Math.round(Number(res.settings.calorie_target))
            setUserCalorieTarget(calT)
            useStore.getState().setCalorieTarget(calT)
          }
          if (res.settings && res.settings.water_goal_litres != null) {
            setWaterGoalL(res.settings.water_goal_litres)
            setWaterGoalDraft(String(res.settings.water_goal_litres))
          }
          saveToLocalStorage(d, fetchedFoods, res.water || [], res.cardio || [], res.strength || [])

          // Synchronize store so deleted items are strictly removed and cross-device sync matches authoritative server state
          useStore.getState().update(s => {
            const otherDayMeals = (s.meals || []).filter(m => m && m.date !== d && m.d !== d)
            s.meals = [...otherDayMeals, ...fetchedFoods]
          }, false)
        }
      } catch (e) {
        loadFromLocalStorage(d)
      }
    } else {
      loadFromLocalStorage(d)
    }
    setLoading(false)
  }

  function loadFromLocalStorage(d) {
    try {
      const stored = localStorage.getItem(getHealthStorageKey(user?.id, d))
      if (stored) {
        const parsed = JSON.parse(stored)
        setFoods(parsed.foods || [])
        setWater(parsed.water || [])
        setCardio(parsed.cardio || [])
        setStrength(parsed.strength || [])
      } else {
        // Fallback to legacy meals if any match date
        const dayMeals = (S.meals || []).filter(m => m.date === d || m.d === d).map(m => ({
          id: m.id,
          meal_type: m.type || m.meal_type || 'lunch',
          food_name: m.name || m.food_name || 'Food entry',
          serving_quantity: m.qty || m.serving_quantity || 1,
          serving_unit: m.unit || m.serving_unit || 'g',
          energy_kcal: Number(m.energy_kcal || m.calories || m.calorie) || 0,
          calories: Number(m.energy_kcal || m.calories || m.calorie) || 0,
          protein_g: Number(m.protein_g || m.protein) || 0,
          protein: Number(m.protein_g || m.protein) || 0,
          carb_g: Number(m.carb_g || m.carbs || m.carb) || 0,
          carbs: Number(m.carb_g || m.carbs || m.carb) || 0,
          fat_g: Number(m.fat_g || m.fat) || 0,
          fat: Number(m.fat_g || m.fat) || 0,
          notes: m.notes || null
        }))
        setFoods(dayMeals)
        setWater([])
        setCardio([])
        setStrength([])
      }

      const savedSettings = localStorage.getItem(getHealthSettingsKey(user?.id))
      if (savedSettings) {
        const s = JSON.parse(savedSettings)
        if (s.water_goal_litres != null) {
          setWaterGoalL(s.water_goal_litres)
          setWaterGoalDraft(String(s.water_goal_litres))
        }
      }
    } catch (e) {
      setFoods([])
      setWater([])
      setCardio([])
      setStrength([])
    }
  }

  function saveToLocalStorage(d, newFoods, newWater, newCardio, newStrength) {
    try {
      localStorage.setItem(getHealthStorageKey(user?.id, d), JSON.stringify({
        foods: newFoods,
        water: newWater,
        cardio: newCardio,
        strength: newStrength
      }))
    } catch (e) {}
  }

  function loadData(d) {
    return loadDayData(d || date)
  }

  // Save water goal setting
  const handleSaveWaterGoal = async (val) => {
    const num = Math.max(0.5, Math.min(10, parseFloat(val) || 2.5))
    setWaterGoalL(num)
    setWaterGoalDraft(String(num))
    setEditingWaterGoal(false)

    try {
      localStorage.setItem(getHealthSettingsKey(user?.id), JSON.stringify({ water_goal_litres: num, calorie_target: userCalorieTarget }))
    } catch (e) {}

    if (user) {
      try {
        await api('/api/nutrition/health-settings', {
          method: 'POST',
          body: JSON.stringify({ water_goal_litres: num, calorie_target: userCalorieTarget })
        })
      } catch (e) {}
    }
    toast(t('Water goal updated to {0} L', num))
  }

  // --- Calculations for Daily Summary ---
  const totals = useMemo(() => {
    const realFoods = foods.filter(f => !f.is_example)
    const foodCalories = realFoods.reduce((acc, f) => acc + (Number(f.energy_kcal) || Number(f.calories) || 0), 0)
    const foodProtein = realFoods.reduce((acc, f) => acc + (Number(f.protein_g) || Number(f.protein) || 0), 0)
    const foodCarbs = realFoods.reduce((acc, f) => acc + (Number(f.carb_g) || Number(f.carbs) || Number(f.carb) || 0), 0)
    const foodFat = realFoods.reduce((acc, f) => acc + (Number(f.fat_g) || Number(f.fat) || 0), 0)

    const waterTotalMl = water.reduce((acc, w) => acc + (Number(w.amount_ml) || 0), 0)
    const waterLitres = Math.round((waterTotalMl / 1000) * 100) / 100

    let cardioDurationMin = 0
    let cardioDistanceKm = 0
    let cardioCaloriesBurned = 0

    for (const c of allCardioForDay) {
      cardioDurationMin += Number(c.duration_min) || 0
      cardioDistanceKm += Number(c.distance_km) || 0
      cardioCaloriesBurned += Number(c.calories_burned) || 0
    }

    let strengthDurationMin = 0
    let strengthCaloriesBurned = 0

    for (const w of completedWorkoutsForDay) {
      const dur = Math.max(1, Math.round((w.dur || (w.end - w.start) || 0) / 60000))
      strengthDurationMin += dur
      strengthCaloriesBurned += Math.round(dur * 6)
    }

    for (const s of strength) {
      strengthDurationMin += Number(s.duration_min) || 0
      strengthCaloriesBurned += Number(s.calories_burned) || 0
    }

    const totalWorkoutDurationMin = cardioDurationMin + strengthDurationMin
    const totalExerciseCaloriesBurned = cardioCaloriesBurned + strengthCaloriesBurned

    return {
      food_count: realFoods.length,
      food_calories: Math.round(foodCalories),
      food_protein: Math.round(foodProtein * 10) / 10,
      food_carbs: Math.round(foodCarbs * 10) / 10,
      food_fat: Math.round(foodFat * 10) / 10,
      calorie_target: userCalorieTarget,
      water_ml: waterTotalMl,
      water_litres: waterLitres,
      water_goal_litres: waterGoalL,
      cardio_duration_min: cardioDurationMin,
      cardio_distance_km: Math.round(cardioDistanceKm * 10) / 10,
      cardio_calories_burned: cardioCaloriesBurned,
      strength_duration_min: strengthDurationMin,
      total_workout_duration_min: totalWorkoutDurationMin,
      exercise_calories_burned: totalExerciseCaloriesBurned
    }
  }, [foods, water, allCardioForDay, completedWorkoutsForDay, strength, waterGoalL, userCalorieTarget])

  // --- Date navigation ---
  const changeDate = (days) => {
    const cur = new Date(date + 'T00:00:00')
    cur.setDate(cur.getDate() + days)
    setDate(cur.toISOString().slice(0, 10))
  }

  // --- Food Operations ---
  const handleOpenFoodModal = (existing = null, defaultMeal = 'breakfast') => {
    openSheet(close => (
      <SimplifiedFoodFormModal
        date={date}
        existing={existing}
        defaultMeal={defaultMeal}
        onSave={async (savedEntry) => {
          close()
          const unified = {
            id: savedEntry.id,
            user_id: user?.id || null,
            meal_type: savedEntry.meal_type,
            type: savedEntry.meal_type,
            food_name: savedEntry.food_name,
            name: savedEntry.food_name,
            serving_quantity: Number(savedEntry.serving_quantity) || 100,
            qty: Number(savedEntry.serving_quantity) || 100,
            serving_unit: savedEntry.serving_unit || 'g',
            unit: savedEntry.serving_unit || 'g',
            energy_kcal: Number(savedEntry.energy_kcal || savedEntry.calories) || 0,
            calories: Number(savedEntry.energy_kcal || savedEntry.calories) || 0,
            protein_g: Number(savedEntry.protein_g || savedEntry.protein) || 0,
            protein: Number(savedEntry.protein_g || savedEntry.protein) || 0,
            carb_g: Number(savedEntry.carb_g || savedEntry.carbs) || 0,
            carbs: Number(savedEntry.carb_g || savedEntry.carbs) || 0,
            fat_g: Number(savedEntry.fat_g || savedEntry.fat) || 0,
            fat: Number(savedEntry.fat_g || savedEntry.fat) || 0,
            notes: savedEntry.notes || null,
            date: date,
            d: date,
            created_at: savedEntry.created_at || new Date().toISOString()
          }

          // 1. Immediately update store meals so Home and other views are in sync
          if (existing) {
            useStore.getState().updateMeal(unified.id, unified)
          } else {
            useStore.getState().logMeal(unified)
          }

          // 2. Update local state
          const updatedFoods = existing
            ? foods.map(f => f.id === unified.id ? unified : f)
            : [...foods.filter(f => f.id !== unified.id), unified]
          setFoods(updatedFoods)
          saveToLocalStorage(date, updatedFoods, water, cardio, strength)

          // 3. Persist to MongoDB & SQLite
          if (user) {
            try {
              const res = await api('/api/nutrition/food/save', {
                method: 'POST',
                body: JSON.stringify(unified)
              })
              if (res?.entry) {
                const enriched = { ...unified, ...res.entry }
                useStore.getState().updateMeal(enriched.id, enriched)
                setFoods(prev => prev.map(f => f.id === enriched.id ? enriched : f))
              }
            } catch (e) {
              toast(t('Saved locally. Will sync when online.'))
            }
          }
          toast(existing ? t('Food entry updated') : t('Food entry saved'))
        }}
        onSaveBatch={async (batchEntries) => {
          close()
          if (!Array.isArray(batchEntries) || batchEntries.length === 0) return
          const unifiedList = batchEntries.map(savedEntry => ({
            id: savedEntry.id || 'food_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            user_id: user?.id || null,
            meal_type: savedEntry.meal_type || defaultMeal,
            type: savedEntry.meal_type || defaultMeal,
            food_name: savedEntry.food_name || savedEntry.name,
            name: savedEntry.food_name || savedEntry.name,
            serving_quantity: Number(savedEntry.serving_quantity || savedEntry.qty) || 100,
            qty: Number(savedEntry.serving_quantity || savedEntry.qty) || 100,
            serving_unit: savedEntry.serving_unit || savedEntry.unit || 'g',
            unit: savedEntry.serving_unit || savedEntry.unit || 'g',
            energy_kcal: Number(savedEntry.energy_kcal || savedEntry.calories) || 0,
            calories: Number(savedEntry.energy_kcal || savedEntry.calories) || 0,
            protein_g: Number(savedEntry.protein_g || savedEntry.protein) || 0,
            protein: Number(savedEntry.protein_g || savedEntry.protein) || 0,
            carb_g: Number(savedEntry.carb_g || savedEntry.carbs) || 0,
            carbs: Number(savedEntry.carb_g || savedEntry.carbs) || 0,
            fat_g: Number(savedEntry.fat_g || savedEntry.fat) || 0,
            fat: Number(savedEntry.fat_g || savedEntry.fat) || 0,
            notes: savedEntry.notes || null,
            date: date,
            d: date,
            created_at: savedEntry.created_at || new Date().toISOString()
          }))

          // 1. Immediately update store meals so Home and other views are in sync
          unifiedList.forEach(u => useStore.getState().logMeal(u))

          // 2. Update local state
          const updatedFoods = [...foods, ...unifiedList]
          setFoods(updatedFoods)
          saveToLocalStorage(date, updatedFoods, water, cardio, strength)

          // 3. Persist batch to server
          if (user) {
            try {
              const res = await api('/api/nutrition/food/save-batch', {
                method: 'POST',
                body: JSON.stringify({ entries: unifiedList, date })
              })
              if (res?.entries) {
                res.entries.forEach(enriched => {
                  useStore.getState().updateMeal(enriched.id, enriched)
                })
                setFoods(prev => {
                  const map = new Map(prev.map(f => [f.id, f]))
                  res.entries.forEach(e => map.set(e.id, { ...map.get(e.id), ...e }))
                  return Array.from(map.values())
                })
              }
            } catch (e) {
              toast(t('Saved locally. Will sync when online.'))
            }
          }
          toast(t('{0} food items saved to meal', unifiedList.length))
        }}
      />
    ))
  }

  const handleDeleteFood = (food) => {
    if (food.is_example) {
      toast(t('Example entries cannot be deleted; toggle "Show Examples" to hide them.'))
      return
    }
    confirmSheet({
      title: t('Delete Food Entry?'),
      message: t('Are you sure you want to delete "{0}" from {1}?', food.food_name || food.name, food.meal_type || 'today\'s meal'),
      confirmText: t('Delete'),
      danger: true,
      onConfirm: async () => {
        const prevFoods = [...foods]
        useStore.getState().deleteMeal(food.id)
        const updatedFoods = foods.filter(f => f.id !== food.id)
        setFoods(updatedFoods)
        saveToLocalStorage(date, updatedFoods, water, cardio, strength)

        if (user) {
          try {
            const res = await api('/api/nutrition/food/delete', {
              method: 'POST',
              body: JSON.stringify({ id: food.id })
            })
            if (res && res.ok === false) {
              setFoods(prevFoods)
              saveToLocalStorage(date, prevFoods, water, cardio, strength)
              toast(t('Failed to delete on server. Restored entry.'))
              return
            }
          } catch (e) {
            setFoods(prevFoods)
            saveToLocalStorage(date, prevFoods, water, cardio, strength)
            toast(t('Failed to delete: {0}', e.message))
            return
          }
        }
        toast(t('Food entry permanently deleted'))
      }
    })
  }

  // --- Water Operations ---
  const handleAddWater = async (amountMl, note = '') => {
    if (!amountMl || amountMl <= 0) return
    const id = 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    const newEntry = {
      id,
      date,
      amount_ml: Math.round(amountMl),
      unit: 'ml',
      notes: note || null,
      created_at: new Date().toISOString()
    }

    const updatedWater = [...water, newEntry]
    setWater(updatedWater)
    saveToLocalStorage(date, foods, updatedWater, cardio, strength)

    if (user) {
      try {
        await api('/api/nutrition/water/save', {
          method: 'POST',
          body: JSON.stringify(newEntry)
        })
      } catch (e) {}
    }
    setCustomWaterAmount('')
    setCustomWaterNote('')
    toast(t('Added {0} ml water', Math.round(amountMl)))
  }

  const handleDeleteWater = (id) => {
    confirmSheet({
      title: t('Delete Water Entry?'),
      message: t('Delete this water log entry?'),
      confirmText: t('Delete'),
      danger: true,
      onConfirm: async () => {
        const updatedWater = water.filter(w => w.id !== id)
        setWater(updatedWater)
        saveToLocalStorage(date, foods, updatedWater, cardio, strength)

        if (user) {
          try {
            await api('/api/nutrition/water/delete', {
              method: 'POST',
              body: JSON.stringify({ id })
            })
          } catch (e) {}
        }
        toast(t('Water entry removed'))
      }
    })
  }

  // --- Cardio Operations ---
  const handleOpenCardioModal = (existing = null) => {
    cardioSheet(existing, date, () => {
      loadDayData(date)
    })
  }

  const handleDeleteCardio = (session) => {
    confirmSheet({
      title: t('Delete Cardio Session?'),
      message: t('Delete {0} session from your activity history?', session.activity_type || session.activity || 'cardio'),
      confirmText: t('Delete'),
      danger: true,
      onConfirm: async () => {
        useStore.getState().deleteCardio(session.id)
        setCardio(prev => prev.filter(c => c.id !== session.id))
        const updated = allCardioForDay.filter(c => c.id !== session.id)
        saveToLocalStorage(date, foods, water, updated, strength)
        if (user) {
          try {
            await api('/api/nutrition/cardio/delete', {
              method: 'POST',
              body: JSON.stringify({ id: session.id })
            })
          } catch (e) {}
        }
        toast(t('Cardio session deleted'))
      }
    })
  }

  // --- Strength Operations ---
  const handleOpenStrengthModal = (existing = null) => {
    openSheet(close => (
      <StrengthFormModal
        date={date}
        existing={existing}
        onSave={async (savedEntry) => {
          close()
          let updatedStrength
          if (existing) {
            updatedStrength = strength.map(s => s.id === savedEntry.id ? savedEntry : s)
          } else {
            updatedStrength = [...strength, savedEntry]
          }
          setStrength(updatedStrength)
          saveToLocalStorage(date, foods, water, cardio, updatedStrength)

          if (user) {
            try {
              await api('/api/nutrition/strength/save', {
                method: 'POST',
                body: JSON.stringify({ ...savedEntry, date })
              })
            } catch (e) {}
          }
          toast(existing ? t('Exercise updated') : t('Exercise recorded'))
        }}
      />
    ))
  }

  const handleDeleteStrength = (exercise) => {
    confirmSheet({
      title: t('Delete Strength Entry?'),
      message: t('Delete {0} exercise entry?', exercise.exercise_name),
      confirmText: t('Delete'),
      danger: true,
      onConfirm: async () => {
        const updatedStrength = strength.filter(s => s.id !== exercise.id)
        setStrength(updatedStrength)
        saveToLocalStorage(date, foods, water, cardio, updatedStrength)

        if (user) {
          try {
            await api('/api/nutrition/strength/delete', {
              method: 'POST',
              body: JSON.stringify({ id: exercise.id })
            })
          } catch (e) {}
        }
        toast(t('Strength exercise deleted'))
      }
    })
  }

  // --- Action Handlers for Repeat Meal, Custom Meal, Recipe Builder & Saved Meals ---
  const handleOpenRepeatMealModal = (defaultMealType = 'breakfast') => {
    openSheet(close => (
      <RepeatPreviousMealModal
        defaultMealType={defaultMealType}
        onSaveBatch={async (newEntries) => {
          const unifiedList = newEntries.map(e => ({
            id: 'food_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            user_id: user?.id || null,
            meal_type: e.meal_type || defaultMealType,
            type: e.meal_type || defaultMealType,
            food_name: e.food_name || e.name,
            name: e.food_name || e.name,
            serving_quantity: Number(e.serving_quantity || e.qty) || 1,
            qty: Number(e.serving_quantity || e.qty) || 1,
            serving_unit: e.serving_unit || e.unit || 'g',
            unit: e.serving_unit || e.unit || 'g',
            energy_kcal: Number(e.energy_kcal || e.calories) || 0,
            calories: Number(e.energy_kcal || e.calories) || 0,
            protein_g: Number(e.protein_g || e.protein) || 0,
            protein: Number(e.protein_g || e.protein) || 0,
            carb_g: Number(e.carb_g || e.carbs) || 0,
            carbs: Number(e.carb_g || e.carbs) || 0,
            fat_g: Number(e.fat_g || e.fat) || 0,
            fat: Number(e.fat_g || e.fat) || 0,
            notes: e.notes || null,
            date: date,
            d: date,
            created_at: new Date().toISOString()
          }))

          unifiedList.forEach(u => useStore.getState().logMeal(u))
          const updatedFoods = [...foods, ...unifiedList]
          setFoods(updatedFoods)
          saveToLocalStorage(date, updatedFoods, water, cardio, strength)

          if (user) {
            try {
              await api('/api/nutrition/food/save-batch', {
                method: 'POST',
                body: JSON.stringify({ entries: unifiedList, date })
              })
            } catch (err) {}
          }
          toast(t('Added {0} items from previous meal', unifiedList.length))
        }}
        close={close}
        toast={toast}
      />
    ))
  }

  const handleOpenSaveAsMyMeal = (defaultMealType = 'breakfast') => {
    const mealFoods = foods.filter(f => !f.is_example && (f.meal_type === defaultMealType || f.type === defaultMealType))
    openSheet(close => (
      <SaveAsMyMealModal
        defaultMealType={defaultMealType}
        currentFoods={mealFoods.length > 0 ? mealFoods : foods.filter(f => !f.is_example)}
        onSaved={() => {
          toast(t('Meal template saved'))
        }}
        close={close}
        toast={toast}
      />
    ))
  }

  const handleOpenRecipeBuilder = () => {
    openSheet(close => (
      <RawRecipeBuilderModal
        onLogRecipePortion={async (portionEntry) => {
          const unified = {
            id: 'food_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            user_id: user?.id || null,
            meal_type: portionEntry.meal_type || 'lunch',
            type: portionEntry.meal_type || 'lunch',
            food_name: portionEntry.food_name,
            name: portionEntry.food_name,
            serving_quantity: portionEntry.serving_quantity || 1,
            qty: portionEntry.serving_quantity || 1,
            serving_unit: portionEntry.serving_unit || 'serving',
            unit: portionEntry.serving_unit || 'serving',
            energy_kcal: Number(portionEntry.energy_kcal) || 0,
            calories: Number(portionEntry.energy_kcal) || 0,
            protein_g: Number(portionEntry.protein_g) || 0,
            protein: Number(portionEntry.protein_g) || 0,
            carb_g: Number(portionEntry.carb_g) || 0,
            carbs: Number(portionEntry.carb_g) || 0,
            fat_g: Number(portionEntry.fat_g) || 0,
            fat: Number(portionEntry.fat_g) || 0,
            notes: portionEntry.notes || null,
            date: date,
            d: date,
            created_at: new Date().toISOString()
          }

          useStore.getState().logMeal(unified)
          const updatedFoods = [...foods, unified]
          setFoods(updatedFoods)
          saveToLocalStorage(date, updatedFoods, water, cardio, strength)

          if (user) {
            try {
              await api('/api/nutrition/food/save', {
                method: 'POST',
                body: JSON.stringify(unified)
              })
            } catch (err) {}
          }
        }}
        close={close}
        toast={toast}
      />
    ))
  }

  const handleOpenMySavedMeals = () => {
    openSheet(close => (
      <MySavedMealsModal
        onAddTemplateToToday={async (template, targetMealType) => {
          const unifiedList = (template.items || []).map(it => ({
            id: 'food_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            user_id: user?.id || null,
            meal_type: targetMealType || template.meal_type || 'breakfast',
            type: targetMealType || template.meal_type || 'breakfast',
            food_name: it.food_name || it.name,
            name: it.food_name || it.name,
            serving_quantity: Number(it.serving_quantity || it.qty) || 1,
            qty: Number(it.serving_quantity || it.qty) || 1,
            serving_unit: it.serving_unit || it.unit || 'g',
            unit: it.serving_unit || it.unit || 'g',
            energy_kcal: Number(it.energy_kcal || it.calories) || 0,
            calories: Number(it.energy_kcal || it.calories) || 0,
            protein_g: Number(it.protein_g || it.protein) || 0,
            protein: Number(it.protein_g || it.protein) || 0,
            carb_g: Number(it.carb_g || it.carbs) || 0,
            carbs: Number(it.carb_g || it.carbs) || 0,
            fat_g: Number(it.fat_g || it.fat) || 0,
            fat: Number(it.fat_g || it.fat) || 0,
            notes: it.notes || null,
            date: date,
            d: date,
            created_at: new Date().toISOString()
          }))

          unifiedList.forEach(u => useStore.getState().logMeal(u))
          const updatedFoods = [...foods, ...unifiedList]
          setFoods(updatedFoods)
          saveToLocalStorage(date, updatedFoods, water, cardio, strength)

          if (user) {
            try {
              await api('/api/nutrition/food/save-batch', {
                method: 'POST',
                body: JSON.stringify({ entries: unifiedList, date })
              })
            } catch (err) {}
          }
          toast(t('Added template "{0}" to {1}', template.name, targetMealType))
        }}
        close={close}
        toast={toast}
      />
    ))
  }

  // --- Export PDF ---
  const handleExportPdf = () => {
    try {
      const realFoods = foods.filter(f => !f.is_example)
      const combinedStrength = [
        ...completedWorkoutsForDay.flatMap(w => (w.entries || []).map(e => {
          const exInfo = EXIDX[e.id] || {}
          const doneSets = (e.sets || []).filter(s => s.done)
          const topWeight = Math.max(0, ...doneSets.map(s => Number(s.w) || 0))
          const totalReps = doneSets.reduce((sum, s) => sum + (Number(s.r) || 0), 0)
          const durMin = Math.max(1, Math.round((w.dur || (w.end - w.start) || 0) / 60000))
          return {
            id: `${w.id}_${e.id}`,
            workout_id: w.id,
            workout_name: w.name || 'Strength Workout',
            exercise_name: exInfo.n || e.name || e.id,
            muscle_group: exInfo.g || 'Strength',
            sets: doneSets.length,
            reps: doneSets.length ? `${totalReps} (${doneSets.map(s => s.r).join('/')})` : '0',
            weight_kg: topWeight,
            duration_min: durMin,
            calories_burned: Math.round(durMin * 6),
            notes: `Completed ✓ · ${w.name || 'Workout'} (${doneSets.map(s => `${s.w || 0}kg×${s.r || 0}`).join(', ')})`
          }
        })),
        ...strength
      ]

      exportDailyReportPdf({
        date,
        foods: realFoods,
        water,
        cardio: allCardioForDay,
        strength: combinedStrength,
        totals,
        settings: {
          calorie_target: userCalorieTarget,
          water_goal_litres: waterGoalL
        }
      })
      toast(t('Daily Report PDF exported successfully'))
    } catch (e) {
      toast(t('Failed to export PDF: {0}', e.message))
    }
  }

  const displayFoods = showExamples ? [...EXAMPLE_ENTRIES, ...foods] : foods

  return (
    <div className="narrow" style={{ maxWidth: 960, margin: '0 auto', padding: '16px 14px 80px' }}>
      {/* Page Title & Top Actions */}
      <div className="hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.025em' }}>
            <span style={{ color: 'var(--coral)' }}><Icon name="apple" /></span>
            {t('Daily Health Log')}
          </h1>
          <div className="sub" style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2 }}>
            {t('Manual tracking · {0} kcal target · ChatGPT PDF', userCalorieTarget.toLocaleString())}
          </div>
        </div>

        {/* Prominent Export Daily Report PDF Button */}
        <Button
          variant="primary"
          icon="download"
          onClick={handleExportPdf}
          style={{ fontWeight: 700, padding: '10px 18px', fontSize: 14, borderRadius: 9999, boxShadow: '0 4px 14px -2px rgba(46,196,182,0.4)' }}
        >
          {t('Export Daily Report PDF')}
        </Button>
      </div>

      {/* Quick Action Bar for PDF Import, Cheat Meal, Pantry, Notifications */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn small primary"
          onClick={handleOpenAddDietPdf}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 9999, padding: '6px 14px' }}
        >
          <Icon name="upload" />
          {t('+ Add Diet Plan PDF')}
        </button>
        <button
          type="button"
          className="btn small"
          onClick={handleOpenCheatMeal}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 9999, padding: '6px 14px', color: '#EAB308' }}
        >
          ★ {t('+ Cheat Meal')}
        </button>
        <button
          type="button"
          className="btn small"
          onClick={handleOpenAvailableFoods}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 9999, padding: '6px 14px' }}
        >
          🥫 {t('Pantry Foods')}
        </button>
        <button
          type="button"
          className="btn small"
          onClick={handleOpenNotificationsConfig}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 9999, padding: '6px 14px' }}
        >
          🔔 {t('Notifications')}
        </button>
      </div>

      {/* View Switcher: Today's Plan, Daily Log, My Diet Plans, Nutrition Goals, Food Database, Saved Meals */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10, overflowX: 'auto' }}>
        <button
          type="button"
          className={`btn small ${activeTab === 'today_plan' ? 'primary' : ''}`}
          onClick={() => setActiveTab('today_plan')}
          style={{ fontWeight: 700, borderRadius: 9999, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
        >
          <Icon name="calendar" />
          {t("Today's Plan")}
        </button>
        <button
          type="button"
          className={`btn small ${activeTab === 'log' ? 'primary' : ''}`}
          onClick={() => setActiveTab('log')}
          style={{ fontWeight: 700, borderRadius: 9999, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
        >
          <Icon name="apple" />
          {t("Daily Log")}
        </button>
        <button
          type="button"
          className={`btn small ${activeTab === 'diet_plans' ? 'primary' : ''}`}
          onClick={() => setActiveTab('diet_plans')}
          style={{ fontWeight: 700, borderRadius: 9999, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
        >
          <Icon name="file" />
          {t("My Diet Plans")}
        </button>
        <button
          type="button"
          className={`btn small ${activeTab === 'goals' ? 'primary' : ''}`}
          onClick={() => setActiveTab('goals')}
          style={{ fontWeight: 700, borderRadius: 9999, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
        >
          <Icon name="target" />
          {t("My Nutrition Goals")}
        </button>
        <button
          type="button"
          className={`btn small ${activeTab === 'coach' ? 'primary' : ''}`}
          onClick={() => setActiveTab('coach')}
          style={{ fontWeight: 700, borderRadius: 9999, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
        >
          <Icon name="search" />
          {t("Food Database")}
        </button>
        <button
          type="button"
          className={`btn small ${activeTab === 'saved' ? 'primary' : ''}`}
          onClick={handleOpenMySavedMeals}
          style={{ fontWeight: 700, borderRadius: 9999, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
        >
          <Icon name="bookmark" />
          {t("My Saved Meals")}
        </button>
      </div>

      {activeTab === 'today_plan' ? (
        <DailyMealTracker
          date={date}
          onOpenGoals={() => setActiveTab('goals')}
          onMealStatusChanged={loadData}
          toast={toast}
        />
      ) : activeTab === 'diet_plans' ? (
        <MyDietPlansView
          onOpenAddPdf={handleOpenAddDietPdf}
          onApplyPlanToToday={(planId) => {
            api('/api/nutrition/daily-plan/apply', {
              method: 'POST',
              body: { date, plan_id: planId }
            }).then(() => {
              if (toast) toast('Applied diet plan to today!', 'success')
              setActiveTab('today_plan')
              loadData()
            }).catch(e => {
              if (toast) toast('Apply error: ' + e.message, 'error')
            })
          }}
          toast={toast}
        />
      ) : activeTab === 'goals' ? (
        <MyNutritionGoalsView
          toast={toast}
          onTargetsSaved={(targets) => {
            if (targets?.calorie_target) {
              useStore.getState().setNutritionTargets(targets)
            }
            loadData()
          }}
        />
      ) : activeTab === 'coach' ? (
        <AICoachView
          user={user}
          foods={foods}
          currentTargets={{ calorie_target: userCalorieTarget }}
          onTargetsUpdated={(newTargets) => {
            if (newTargets?.calorie_target) {
              useStore.getState().setNutritionTargets(newTargets)
            }
          }}
          toast={toast}
        />
      ) : (
        <>
      {/* Date Selector Strip */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="iconbtn"
              onClick={() => changeDate(-1)}
              aria-label="Previous day"
              style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-2)' }}
            >
              <Icon name="chevronLeft" />
            </button>
            <input
              type="date"
              value={date}
              onChange={e => e.target.value && setDate(e.target.value)}
              style={{
                background: 'var(--surface-2)',
                border: 'var(--card-border)',
                borderRadius: 12,
                padding: '6px 12px',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--label)'
              }}
            />
            <button
              className="iconbtn"
              onClick={() => changeDate(1)}
              aria-label="Next day"
              style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-2)' }}
            >
              <Icon name="chevronRight" />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {date !== todayISO() && (
              <button
                className="btn small"
                onClick={() => setDate(todayISO())}
                style={{ padding: '5px 12px', fontSize: 13, borderRadius: 9999 }}
              >
                {t('Today')}
              </button>
            )}
            <button
              className={`btn small ${showExamples ? 'primary' : ''}`}
              onClick={() => setShowExamples(!showExamples)}
              style={{ padding: '5px 12px', fontSize: 13, borderRadius: 9999 }}
              title={t('Toggle reference example entries')}
            >
              <Icon name="lightbulb" />
              <span style={{ marginLeft: 4 }}>{showExamples ? t('Hide Examples') : t('Show Examples')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Calorie Goal & Overview Card — Inspired by Phone 6 in reference image */}
      <div className="calorie-goal-card" style={{ position: 'relative' }}>
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('Daily Calorie Goal')}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingCalorieGoal(userCalorieTarget)
                  setIsEditingGoal(!isEditingGoal)
                }}
                style={{
                  background: isEditingGoal ? 'var(--surface-3)' : 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--borders)',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--theme-accent, #F5F5F5)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
                aria-label={t('Edit Daily Calorie Goal')}
                title={t('Edit Daily Calorie Goal')}
              >
                <Icon name="pencil" size={11} />
                <span>{isEditingGoal ? t('Cancel') : t('Edit')}</span>
              </button>
            </div>
            
            <div className="big" style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>
              {totals.food_calories > 0 ? (
                <>
                  {`${totals.food_calories.toLocaleString()} `}<span style={{ fontSize: 15, fontWeight: 500, color: 'var(--label-2)' }}>{`/ ${userCalorieTarget.toLocaleString()} kcal`}</span>
                </>
              ) : (
                <>
                  {userCalorieTarget.toLocaleString()} <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--label-2)' }}>kcal</span>
                </>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: (userCalorieTarget - totals.food_calories) < 0 ? '#F59E0B' : 'var(--label)' }}>
              {`${Math.max(0, userCalorieTarget - totals.food_calories).toLocaleString()} kcal`}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--label-2)' }}>
              {t('Remaining')}
            </div>
          </div>
        </div>

        {/* Inline Edit Form when user selects Edit */}
        {isEditingGoal && (
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--borders)',
              borderRadius: 12,
              padding: '12px 14px',
              marginTop: 10,
              marginBottom: 10
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--label)', marginBottom: 6 }}>
              {t('Edit Daily Calorie Goal')}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <input
                type="number"
                min="500"
                max="10000"
                step="10"
                value={editingCalorieGoal}
                onChange={e => setEditingCalorieGoal(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 120,
                  background: '#242429',
                  color: '#FFFFFF',
                  border: '1px solid #38383F',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 15,
                  fontWeight: 700
                }}
                placeholder="e.g. 2000"
                autoFocus
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-2)' }}>kcal</span>
              <Button
                size="sm"
                variant="primary"
                disabled={savingGoal}
                onClick={handleSaveDailyCalorieGoal}
              >
                {savingGoal ? t('Saving...') : t('Save')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={savingGoal}
                onClick={() => setIsEditingGoal(false)}
              >
                {t('Cancel')}
              </Button>
            </div>
            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--label-3)' }}>{t('Quick Presets')}:</span>
              {[1800, 1900, 2000, 2200, 2500].map(pVal => (
                <button
                  key={pVal}
                  type="button"
                  onClick={() => setEditingCalorieGoal(pVal)}
                  style={{
                    background: Number(editingCalorieGoal) === pVal ? 'var(--label)' : 'rgba(255, 255, 255, 0.06)',
                    color: Number(editingCalorieGoal) === pVal ? 'var(--bg)' : 'var(--label)',
                    border: '1px solid var(--borders)',
                    borderRadius: 9999,
                    padding: '2px 8px',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {pVal.toLocaleString()} kcal
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="calorie-bar-wrap">
          <div className="calorie-bar-track">
            <div
              className="calorie-bar-fill"
              style={{ width: `${Math.min(100, Math.round((totals.food_calories / userCalorieTarget) * 100))}%` }}
            />
          </div>
        </div>

        {/* Summary Pills Grid */}
        <div className="macro-pills-grid">
          <div className="macro-pill-item">
            <span className="macro-pill-title">{t('Food Items')}</span>
            <span className="macro-pill-val">{totals.food_count}</span>
          </div>
          <div className="macro-pill-item">
            <span className="macro-pill-title">{t('Water')}</span>
            <span className="macro-pill-val" style={{ color: 'var(--teal)' }}>
              {totals.water_litres} L <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--label-3)' }}>/ {waterGoalL}L</span>
            </span>
          </div>
          <div className="macro-pill-item">
            <span className="macro-pill-title">{t('Activity')}</span>
            <span className="macro-pill-val" style={{ color: 'var(--coral)' }}>
              {totals.total_workout_duration_min} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--label-3)' }}>min</span>
            </span>
          </div>
        </div>

        <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 14px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--mint)', fontSize: 16 }}><Icon name="info" /></span>
          <div style={{ fontSize: 12, color: 'var(--label-2)', lineHeight: 1.4 }}>
            {t('Manual tracking · {0} kcal target. Click "Export Daily Report PDF" to analyze full meals, macros and hydration in ChatGPT.', userCalorieTarget.toLocaleString())}
          </div>
        </div>
      </div>

      {/* Today's Meals Section — Grouped cards matching Phone 6 in reference image */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12, padding: '0 4px' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--label)' }}>
            {t("Today's Meals")}
          </h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button
              variant="tinted"
              icon="plus"
              size="sm"
              onClick={() => handleOpenFoodModal()}
            >
              {t('Add Food')}
            </Button>
            <Button
              variant="tinted"
              icon="reset"
              size="sm"
              onClick={() => handleOpenRepeatMealModal()}
            >
              {t('Repeat Meal')}
            </Button>
            <Button
              variant="tinted"
              icon="bookmark"
              size="sm"
              onClick={() => handleOpenSaveAsMyMeal()}
            >
              {t('Save as My Meal')}
            </Button>
            <Button
              variant="tinted"
              icon="flame"
              size="sm"
              onClick={handleOpenRecipeBuilder}
            >
              {t('Recipe Builder')}
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MEAL_TYPES.map(meal => {
            const mealFoods = displayFoods.filter(f => (f.meal_type === meal.id || f.type === meal.id))
            const mealCals = Math.round(mealFoods.reduce((acc, f) => acc + (Number(f.energy_kcal) || Number(f.calories) || 0), 0))
            const mealP = Math.round(mealFoods.reduce((acc, f) => acc + (Number(f.protein_g) || Number(f.protein) || 0), 0) * 10) / 10
            const mealC = Math.round(mealFoods.reduce((acc, f) => acc + (Number(f.carb_g) || Number(f.carbs) || Number(f.carb) || 0), 0) * 10) / 10
            const mealF = Math.round(mealFoods.reduce((acc, f) => acc + (Number(f.fat_g) || Number(f.fat) || 0), 0) * 10) / 10

            return (
              <div key={meal.id} className="card" style={{ padding: '16px 18px', marginBottom: 0 }}>
                <div className="row between" style={{ marginBottom: mealFoods.length ? 12 : 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: 'var(--surface-2)',
                        color: meal.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18
                      }}
                    >
                      <Icon name={meal.icon} />
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>
                        {t(meal.label)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 1 }}>
                        {mealFoods.length} {t(mealFoods.length === 1 ? 'item' : 'items')}
                        {mealCals > 0 && (
                          <span style={{ color: 'var(--theme-accent, #F5F5F5)', marginLeft: 6, fontWeight: 600 }}>
                            · {mealCals} kcal · {mealP}g P · {mealC}g C · {mealF}g F
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="iconbtn"
                      style={{ width: 28, height: 28, fontSize: 12, background: 'var(--surface-2)', color: 'var(--theme-accent, #F5F5F5)' }}
                      onClick={() => handleOpenRepeatMealModal(meal.id)}
                      aria-label={t('Repeat previous {0}', meal.label)}
                      title={t('Repeat previous {0}', meal.label)}
                    >
                      <Icon name="reset" />
                    </button>
                    <button
                      className="iconbtn"
                      style={{ width: 28, height: 28, fontSize: 12, background: 'var(--surface-2)', color: 'var(--theme-accent, #F5F5F5)' }}
                      onClick={() => handleOpenSaveAsMyMeal(meal.id)}
                      aria-label={t('Save {0} as template', meal.label)}
                      title={t('Save {0} as template', meal.label)}
                    >
                      <Icon name="bookmark" />
                    </button>
                    <button
                      className="iconbtn"
                      style={{ width: 32, height: 32, fontSize: 14, background: 'var(--surface-2)', color: 'var(--mint)' }}
                      onClick={() => handleOpenFoodModal(null, meal.id)}
                      aria-label={t('Add food to {0}', meal.label)}
                      title={t('Add food to {0}', meal.label)}
                    >
                      <Icon name="plus" />
                    </button>
                  </div>
                </div>

                {/* Food Entries in this meal */}
                {mealFoods.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mealFoods.map(f => {
                      const itemCal = Math.round(Number(f.energy_kcal) || Number(f.calories) || 0)
                      const itemP = Math.round((Number(f.protein_g) || Number(f.protein) || 0) * 10) / 10
                      const itemC = Math.round((Number(f.carb_g) || Number(f.carbs) || Number(f.carb) || 0) * 10) / 10
                      const itemF = Math.round((Number(f.fat_g) || Number(f.fat) || 0) * 10) / 10

                      return (
                        <div
                          key={f.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 12,
                            background: f.is_example ? 'color-mix(in srgb, var(--surface-2) 60%, transparent)' : 'var(--surface-2)'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>
                              {f.food_name || f.name}
                              {f.is_example && (
                                <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--surface-3)', color: 'var(--label-3)', padding: '2px 6px', borderRadius: 4 }}>
                                  {t('Example')}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {itemCal > 0 && (
                                <span style={{ fontWeight: 600, color: 'var(--theme-accent, #F5F5F5)' }}>
                                  {itemCal} kcal
                                </span>
                              )}
                              {(itemP > 0 || itemC > 0 || itemF > 0) && (
                                <span>
                                  ({itemP}g P · {itemC}g C · {itemF}g F)
                                </span>
                              )}
                              {f.notes && <span>— {f.notes}</span>}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                            <span
                              style={{
                                background: 'var(--surface)',
                                border: 'var(--card-border)',
                                padding: '4px 10px',
                                borderRadius: 9999,
                                fontSize: 12,
                                fontWeight: 700,
                                color: 'var(--label)'
                              }}
                            >
                              {f.serving_quantity || f.qty} {f.serving_unit || f.unit || 'g'}
                            </span>

                            {!f.is_example && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  className="iconbtn"
                                  onClick={() => handleOpenFoodModal(f, meal.id)}
                                  style={{ width: 28, height: 28, fontSize: 12 }}
                                  aria-label="Edit food"
                                >
                                  <Icon name="pencil" />
                                </button>
                                <button
                                  className="iconbtn"
                                  onClick={() => handleDeleteFood(f)}
                                  style={{ width: 28, height: 28, fontSize: 12, color: 'var(--coral)' }}
                                  aria-label="Delete food"
                                >
                                  <Icon name="trash" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '8px 4px', fontSize: 13, color: 'var(--label-3)', fontStyle: 'italic' }}>
                    {t('No {0} entries recorded yet.', meal.label.toLowerCase())}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* SECTION B: Water Intake Tracker */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--blue)', fontSize: '1.2rem' }}><Icon name="cup" /></span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{t('Water Intake')}</h2>
          </div>

          {/* Daily Water Goal Setting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {editingWaterGoal ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="10"
                  value={waterGoalDraft}
                  onChange={e => setWaterGoalDraft(e.target.value)}
                  style={{ width: 64, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)' }}
                />
                <span style={{ fontSize: '0.85rem' }}>L</span>
                <button className="btn small acc" onClick={() => handleSaveWaterGoal(waterGoalDraft)}>
                  <Icon name="check" />
                </button>
                <button className="btn small" onClick={() => setEditingWaterGoal(false)}>
                  <Icon name="xmark" />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}>
                <span className="muted">{t('Daily Goal')}:</span>
                <strong style={{ color: 'var(--fg)' }}>{waterGoalL} L</strong>
                <button
                  className="iconbtn"
                  onClick={() => setEditingWaterGoal(true)}
                  style={{ width: 24, height: 24 }}
                  aria-label="Edit water goal"
                >
                  <Icon name="pencil" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Hydration Status Bar */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--blue)' }}>{totals.water_litres} L</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)', marginLeft: 6 }}>({totals.water_ml} ml)</span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {totals.water_litres >= waterGoalL ? (
                <span style={{ color: 'var(--green)' }}>✓ {t('Daily goal reached!')}</span>
              ) : (
                <span style={{ color: 'var(--muted)' }}>
                  {Math.round((waterGoalL - totals.water_litres) * 100) / 100} L {t('remaining')}
                </span>
              )}
            </div>
          </div>

          <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-3)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round((totals.water_litres / waterGoalL) * 100))}%`,
                background: 'var(--blue)',
                borderRadius: 4,
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>

        {/* Quick Add Buttons & Custom Amount */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <button className="btn small" onClick={() => handleAddWater(250, 'Glass of water')}>
            + 250 ml
          </button>
          <button className="btn small" onClick={() => handleAddWater(500, 'Bottle of water')}>
            + 500 ml
          </button>
          <button className="btn small" onClick={() => handleAddWater(750, 'Large bottle')}>
            + 750 ml
          </button>
          <button className="btn small" onClick={() => handleAddWater(1000, '1 Litre jug')}>
            + 1,000 ml (1 L)
          </button>
        </div>

        {/* Custom Water Input */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <input
            type="number"
            min="1"
            placeholder={t('Amount')}
            value={customWaterAmount}
            onChange={e => setCustomWaterAmount(e.target.value)}
            style={{ width: 100, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
          <select
            value={customWaterUnit}
            onChange={e => setCustomWaterUnit(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <option value="ml">ml</option>
            <option value="L">L</option>
          </select>
          <input
            type="text"
            placeholder={t('Optional notes (e.g. morning glass, post-workout)')}
            value={customWaterNote}
            onChange={e => setCustomWaterNote(e.target.value)}
            style={{ flex: 1, minWidth: 160, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
          <Button
            variant="acc"
            size="small"
            onClick={() => {
              const amt = customWaterUnit === 'L' ? parseFloat(customWaterAmount) * 1000 : parseFloat(customWaterAmount)
              handleAddWater(amt, customWaterNote)
            }}
          >
            {t('Add Water')}
          </Button>
        </div>

        {/* Water Log Entries List */}
        {water.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>
              {t("Today's Water Entries")} ({water.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {water.map((w, idx) => (
                <div
                  key={w.id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--surface-2)',
                    fontSize: '0.88rem'
                  }}
                >
                  <div>
                    <strong>{w.amount_ml} ml</strong> <span style={{ color: 'var(--muted)' }}>({(w.amount_ml / 1000).toFixed(2)} L)</span>
                    {w.notes && <span style={{ marginLeft: 8, color: 'var(--muted)', fontSize: '0.82rem' }}>— {w.notes}</span>}
                  </div>
                  <button
                    className="iconbtn danger"
                    onClick={() => handleDeleteWater(w.id)}
                    style={{ width: 26, height: 26 }}
                    aria-label="Delete water entry"
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION C: Cardio Activity Log */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--orange)', fontSize: '1.2rem' }}><Icon name="figureRun" /></span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{t('Cardio Activity Log')}</h2>
          </div>
          <Button
            variant="acc"
            icon="plus"
            size="small"
            onClick={() => handleOpenCardioModal()}
            style={{ fontWeight: 600 }}
          >
            {t('Add Cardio Session')}
          </Button>
        </div>

        {allCardioForDay.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--muted)', background: 'var(--surface-2)', borderRadius: 10 }}>
            <div style={{ fontWeight: 600 }}>{t('No cardio sessions recorded today')}</div>
            <div style={{ fontSize: '0.85rem', marginTop: 4 }}>{t('Record walking, running, jogging, or cycling sessions.')}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px 10px' }}>{t('Activity')}</th>
                  <th style={{ padding: '8px 10px' }}>{t('Duration')}</th>
                  <th style={{ padding: '8px 10px' }}>{t('Distance')}</th>
                  <th style={{ padding: '8px 10px' }}>{t('Calories Burned (est)')}</th>
                  <th style={{ padding: '8px 10px' }}>{t('Notes')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>{t('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {allCardioForDay.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px', fontWeight: 600, textTransform: 'capitalize' }}>{c.activity_type || c.activity}</td>
                    <td style={{ padding: '10px' }}>{c.duration_min} min</td>
                    <td style={{ padding: '10px' }}>{c.distance_km != null ? `${c.distance_km} km` : '-'}</td>
                    <td style={{ padding: '10px', color: 'var(--orange)', fontWeight: 600 }}>{c.calories_burned != null ? `${c.calories_burned} kcal` : '-'}</td>
                    <td style={{ padding: '10px', color: 'var(--muted)', fontSize: '0.85rem' }}>{c.notes || '-'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="iconbtn"
                        onClick={() => handleOpenCardioModal(c)}
                        style={{ width: 28, height: 28, marginRight: 4 }}
                        aria-label="Edit cardio session"
                      >
                        <Icon name="pencil" />
                      </button>
                      <button
                        className="iconbtn danger"
                        onClick={() => handleDeleteCardio(c)}
                        style={{ width: 28, height: 28 }}
                        aria-label="Delete cardio session"
                      >
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                  <td style={{ padding: '10px' }}>{t('Total Cardio')}</td>
                  <td style={{ padding: '10px' }}>{totals.cardio_duration_min} min</td>
                  <td style={{ padding: '10px' }}>{totals.cardio_distance_km ? `${totals.cardio_distance_km} km` : '-'}</td>
                  <td style={{ padding: '10px', color: 'var(--orange)' }}>
                    {totals.cardio_calories_burned ? `${totals.cardio_calories_burned} kcal` : '-'}
                  </td>
                  <td colSpan={2} style={{ padding: '10px' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* SECTION D: Strength Workout Log */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--purple)', fontSize: '1.2rem' }}><Icon name="dumbbell" /></span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{t('Strength Workout Log')}</h2>
          </div>
          <Button
            variant="ghost"
            icon="plus"
            size="small"
            onClick={() => handleOpenStrengthModal()}
            style={{ fontWeight: 600 }}
          >
            {t('Manual Exercise')}
          </Button>
        </div>

        {completedWorkoutsForDay.length === 0 && strength.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--muted)', background: 'var(--surface-2)', borderRadius: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--label)' }}>
              {t('No strength workouts completed today')}
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: 4, color: 'var(--label-2)' }}>
              {t('Workouts finished using Start Workout / Finish Workout will automatically appear here.')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {completedWorkoutsForDay.map((w, wIdx) => {
              const durMin = Math.max(1, Math.round((w.dur || (w.end - w.start) || 0) / 60000))
              const totalSets = (w.entries || []).reduce((acc, e) => acc + (e.sets ? e.sets.filter(s => s.done).length : 0), 0)
              return (
                <div key={w.id || wIdx} style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--theme-accent-border, var(--borders, #303036))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--label)' }}>
                          {w.name || t('Strength Workout')}
                        </h3>
                        <span style={{ background: 'color-mix(in srgb, var(--mint) 15%, transparent)', color: 'var(--mint)', padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>
                          {t('Completed ✓')}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 2 }}>
                        {durMin} {t('min')} · {w.entries?.length || 0} {t('exercises')} · {totalSets} {t('sets')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(w.entries || []).map((e, eIdx) => {
                      const exInfo = EXIDX[e.id] || {}
                      const exName = exInfo.n || e.name || e.id
                      const doneSets = (e.sets || []).filter(s => s.done)
                      const maxWeight = Math.max(0, ...doneSets.map(s => Number(s.w) || 0))
                      return (
                        <div key={e.id || eIdx} style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--label)' }}>
                              {exName}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-accent, #F5F5F5)' }}>
                              {doneSets.length} {t('sets')} {maxWeight > 0 ? `· ${t('Top')} ${maxWeight} kg` : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                            {doneSets.map((s, sIdx) => (
                              <span key={sIdx} style={{ background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 6, fontSize: 11, color: 'var(--label-2)' }}>
                                {t('Set')} {sIdx + 1}: {s.w || 0} kg × {s.r || 0} {t('reps')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Any extra manual strength exercises */}
            {strength.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                  {t('Additional Manual Exercises')} ({strength.length})
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '8px 10px' }}>{t('Exercise Name')}</th>
                        <th style={{ padding: '8px 10px' }}>{t('Muscle Group')}</th>
                        <th style={{ padding: '8px 10px' }}>{t('Sets')}</th>
                        <th style={{ padding: '8px 10px' }}>{t('Reps')}</th>
                        <th style={{ padding: '8px 10px' }}>{t('Weight (kg)')}</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>{t('Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strength.map(s => (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px', fontWeight: 600 }}>{s.exercise_name}</td>
                          <td style={{ padding: '10px' }}>{s.muscle_group || '-'}</td>
                          <td style={{ padding: '10px' }}>{s.sets != null ? s.sets : '-'}</td>
                          <td style={{ padding: '10px' }}>{s.reps != null ? s.reps : '-'}</td>
                          <td style={{ padding: '10px' }}>{s.weight_kg != null ? `${s.weight_kg} kg` : '-'}</td>
                          <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              className="iconbtn danger"
                              onClick={() => handleDeleteStrength(s)}
                              style={{ width: 28, height: 28 }}
                              aria-label="Delete strength exercise"
                            >
                              <Icon name="trash" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Floating/Docked Export Report Card */}
      <div className="card" style={{ padding: 18, textAlign: 'center', background: 'var(--surface)', marginTop: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)', marginBottom: 4 }}>
          {t('Ready to analyze your daily nutrition?')}
        </div>
        <div className="muted small" style={{ marginBottom: 14 }}>
          {t('Exports your complete daily food, water, cardio, steps, and strength records formatted for instant evaluation by ChatGPT.')}
        </div>
        <Button
          variant="primary"
          size="lg"
          icon="download"
          onClick={handleExportPdf}
          style={{ width: '100%', padding: '15px', borderRadius: 'var(--r)', fontSize: 16, fontWeight: 700 }}
        >
          {t('Export Daily Report PDF')}
        </Button>
      </div>
      </>
      )}
    </div>
  )
}

/* ============================ MODALS ============================ */

/**
 * Comprehensive Smart Food Modal & Multi-Item Meal Builder:
 * - Verified Dataset Search with exact 100g base reference
 * - Autocomplete Search with Verified badges (ICMR-NIN, INDB, USDA) and regional names
 * - Mathematically verified proportional recalculation (100g base reference)
 * - Quick Portion Chips (Piece foods vs Metric foods)
 * - Instant Nutrition Preview Card
 * - Multi-Item Meal Builder with combined meal totals
 */
function SimplifiedFoodFormModal({ date, existing, defaultMeal = 'breakfast', onSave, onSaveBatch }) {
  const [mealType, setMealType] = useState(existing?.meal_type || existing?.type || defaultMeal)
  const [foodName, setFoodName] = useState(existing?.food_name || existing?.name || '')
  const [quantity, setQuantity] = useState(existing?.serving_quantity != null ? String(existing.serving_quantity) : (existing?.qty != null ? String(existing.qty) : '100'))
  const [unit, setUnit] = useState(existing?.serving_unit || existing?.unit || 'g')
  const [calories, setCalories] = useState(existing?.energy_kcal != null ? String(existing.energy_kcal) : (existing?.calories != null ? String(existing.calories) : ''))
  const [protein, setProtein] = useState(existing?.protein_g != null ? String(existing.protein_g) : (existing?.protein != null ? String(existing.protein) : ''))
  const [carbs, setCarbs] = useState(existing?.carb_g != null ? String(existing.carb_g) : (existing?.carbs != null ? String(existing.carbs) : ''))
  const [fat, setFat] = useState(existing?.fat_g != null ? String(existing.fat_g) : (existing?.fat != null ? String(existing.fat) : ''))
  const [notes, setNotes] = useState(existing?.notes || '')
  const [err, setErr] = useState('')

  // Multi-Item Meal Draft State
  const [draftItems, setDraftItems] = useState([])

  // Custom food & verification workflow
  const [customFoodConfirmed, setCustomFoodConfirmed] = useState(existing?.is_custom || false)
  const [showCustomForm, setShowCustomForm] = useState(false)

  // Food search & autocomplete
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [baseFood, setBaseFood] = useState(existing ? {
    id: existing.food_id || existing.id,
    name: existing.food_name || existing.name,
    calories: existing.energy_kcal != null ? existing.energy_kcal : existing.calories,
    protein: existing.protein_g != null ? existing.protein_g : existing.protein,
    carbs: existing.carb_g != null ? existing.carb_g : existing.carbs,
    fat: existing.fat_g != null ? existing.fat_g : existing.fat,
    serving_unit: existing.serving_unit || existing.unit,
    serving_size: existing.serving_quantity || existing.qty
  } : null)

  // Standard portion weights map
  const PORTION_WEIGHT_MAP = {
    'wheat roti / chapati': 35,
    'roti': 35,
    'chapati': 35,
    'egg': 50,
    'boiled egg': 50,
    'egg white': 33,
    'banana': 120,
    'apple': 150,
    'idli': 50,
    'dosa': 80,
    'slice': 30,
    'cup': 150,
    'bowl': 150,
    'katori': 150,
    'glass': 200,
    'tbsp': 15,
    'tsp': 5,
    'scoop': 30,
    'plate': 300,
    'serving': 150,
    'portion': 150
  }

  // Calculate proportional nutrients based on 100g standard reference
  const computeNutrients = (food, qVal, uVal) => {
    const q = parseFloat(qVal) || 0
    if (!food || q <= 0) return { kcal: 0, p: 0, c: 0, f: 0, grams: 0 }

    let grams = q
    const lowerName = (food.name || food.food_name || '').toLowerCase()

    if (uVal === 'g' || uVal === 'ml') {
      grams = q
    } else if (uVal === 'piece' || uVal === 'pieces') {
      let pw = food.piece_weight_g
      if (!pw) {
        if (lowerName.includes('chapati') || lowerName.includes('roti')) pw = 35
        else if (lowerName.includes('egg white')) pw = 33
        else if (lowerName.includes('egg')) pw = 50
        else if (lowerName.includes('banana')) pw = 120
        else if (lowerName.includes('apple')) pw = 150
        else if (lowerName.includes('idli')) pw = 50
        else if (lowerName.includes('dosa')) pw = 80
        else pw = 50
      }
      grams = q * pw
    } else if (PORTION_WEIGHT_MAP[uVal]) {
      grams = q * PORTION_WEIGHT_MAP[uVal]
    } else if (food.serving_unit === uVal && Number(food.serving_size) > 0) {
      grams = q * Number(food.serving_size)
    } else if (uVal === 'serving' || uVal === 'portion' || uVal === 'plate') {
      grams = q * (PORTION_WEIGHT_MAP[uVal] || Number(food.serving_size) || 150)
    } else {
      grams = q
    }

    // Safety clamp grams to prevent implausible overflow
    if (grams > 10000) grams = 10000

    const baseKcal = Number(food.energy_kcal != null ? food.energy_kcal : food.calories) || 0
    const baseP = Number(food.protein_g != null ? food.protein_g : food.protein) || 0
    const baseC = Number(food.carb_g != null ? food.carb_g : food.carbs) || 0
    const baseF = Number(food.fat_g != null ? food.fat_g : food.fat) || 0

    // All database base nutrients are per 100g
    const ratio = grams / 100
    return {
      grams: Math.round(grams),
      kcal: Math.round(baseKcal * ratio),
      p: Math.round(baseP * ratio * 10) / 10,
      c: Math.round(baseC * ratio * 10) / 10,
      f: Math.round(baseF * ratio * 10) / 10
    }
  }

  // Detect if current typed name is unmatched in dataset
  const isUnmatched = foodName.trim().length >= 2 &&
    searchResults.length === 0 &&
    !searching &&
    (!baseFood || baseFood.name.toLowerCase() !== foodName.trim().toLowerCase()) &&
    !customFoodConfirmed &&
    !existing

  useEffect(() => {
    if (!foodName || foodName.length < 2 || (baseFood && baseFood.name.toLowerCase() === foodName.toLowerCase())) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api(`/api/nutrition/search?q=${encodeURIComponent(foodName)}`)
        const items = res?.foods || res?.results || (Array.isArray(res) ? res : [])
        setSearchResults(items.slice(0, 8))
      } catch (e) {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [foodName, baseFood])

  const handleFoodNameChange = (val) => {
    setFoodName(val)
    setErr('')
    setCustomFoodConfirmed(false)
    // Invalidate stale base food and clear nutrition numbers when user edits food name away from selection
    if (baseFood && baseFood.name.toLowerCase() !== val.trim().toLowerCase()) {
      setBaseFood(null)
      setCalories('')
      setProtein('')
      setCarbs('')
      setFat('')
    }
  }

  const handleSelectFood = (item) => {
    setBaseFood(item)
    setFoodName(item.name)
    setSearchResults([])
    setCustomFoodConfirmed(false)
    setShowCustomForm(false)
    setErr('')

    // Determine smart default unit & quantity
    const lower = item.name.toLowerCase()
    let initialUnit = item.serving_unit || 'g'
    let initialQty = '100'

    if (item.serving_unit === 'piece' || lower.includes('chapati') || lower.includes('roti') || lower.includes('egg') || lower.includes('idli') || lower.includes('dosa') || lower.includes('banana')) {
      initialUnit = 'piece'
      initialQty = '1'
    } else if (item.serving_size && Number(item.serving_size) > 0) {
      initialQty = String(item.serving_size)
    }

    setUnit(initialUnit)
    setQuantity(initialQty)

    const computed = computeNutrients(item, initialQty, initialUnit)
    setCalories(String(computed.kcal))
    setProtein(String(computed.p))
    setCarbs(String(computed.c))
    setFat(String(computed.f))
  }

  const handleQuantityOrUnitChange = (newQty, newUnit) => {
    setQuantity(newQty)
    setUnit(newUnit)
    if (baseFood && !baseFood.is_custom) {
      const computed = computeNutrients(baseFood, newQty, newUnit)
      setCalories(String(computed.kcal))
      setProtein(String(computed.p))
      setCarbs(String(computed.c))
      setFat(String(computed.f))
    }
  }

  const handleEnableCustomFood = () => {
    setShowCustomForm(true)
    setCustomFoodConfirmed(true)
    setBaseFood({
      name: foodName.trim(),
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      is_custom: true,
      is_verified: false,
      data_source: 'custom_verified'
    })
    setErr('')
  }

  // Validate sanity limits for nutrition values
  const validateNutritionSanity = (calNum, pNum, cNum, fNum) => {
    if (calNum > 5000) {
      return t('Calories ({0} kcal) exceed realistic single-item threshold (max 5,000 kcal). Please verify portion.', calNum)
    }
    if (pNum > 400) {
      return t('Protein ({0}g) exceeds realistic single-item threshold (max 400g). Please verify portion.', pNum)
    }
    if (cNum > 600) {
      return t('Carbohydrates ({0}g) exceed realistic single-item threshold (max 600g). Please verify portion.', cNum)
    }
    if (fNum > 300) {
      return t('Fat ({0}g) exceeds realistic single-item threshold (max 300g). Please verify portion.', fNum)
    }
    return null
  }

  // Add current active input to draft
  const handleAddToDraft = () => {
    if (!foodName.trim()) {
      setErr(t('Please enter or select a food name'))
      return
    }
    if (isUnmatched || (!baseFood && !customFoodConfirmed && !existing)) {
      setErr(t('Food not found in verified dataset. Select an item or tap "+ Add as Custom Food".'))
      return
    }
    const qNum = parseFloat(quantity)
    if (isNaN(qNum) || qNum <= 0) {
      setErr(t('Please enter a valid positive quantity'))
      return
    }

    const calNum = parseFloat(calories) || 0
    const pNum = parseFloat(protein) || 0
    const cNum = parseFloat(carbs) || 0
    const fNum = parseFloat(fat) || 0

    const sanityErr = validateNutritionSanity(calNum, pNum, cNum, fNum)
    if (sanityErr) {
      setErr(sanityErr)
      return
    }

    setErr('')

    const newItem = {
      id: 'draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      meal_type: mealType,
      food_name: foodName.trim(),
      serving_quantity: qNum,
      serving_unit: unit,
      energy_kcal: calNum,
      protein_g: pNum,
      carb_g: cNum,
      fat_g: fNum,
      notes: notes.trim() || null,
      is_verified: baseFood?.is_verified,
      data_source: baseFood?.data_source || (customFoodConfirmed ? 'custom_user' : undefined)
    }

    setDraftItems(prev => [...prev, newItem])

    // Reset current input fields for next item
    setFoodName('')
    setBaseFood(null)
    setQuantity('100')
    setUnit('g')
    setCalories('')
    setProtein('')
    setCarbs('')
    setFat('')
    setNotes('')
    setCustomFoodConfirmed(false)
    setShowCustomForm(false)
  }

  const handleRemoveDraftItem = (id) => {
    setDraftItems(prev => prev.filter(it => it.id !== id))
  }

  // Combined totals of draft items
  const draftTotals = useMemo(() => {
    return draftItems.reduce((acc, it) => ({
      kcal: acc.kcal + (Number(it.energy_kcal) || 0),
      p: Math.round((acc.p + (Number(it.protein_g) || 0)) * 10) / 10,
      c: Math.round((acc.c + (Number(it.carb_g) || 0)) * 10) / 10,
      f: Math.round((acc.f + (Number(it.fat_g) || 0)) * 10) / 10
    }), { kcal: 0, p: 0, c: 0, f: 0 })
  }, [draftItems])

  const handleSubmit = (e) => {
    e.preventDefault()

    // If draft items exist
    if (draftItems.length > 0) {
      let finalItems = [...draftItems]
      if (foodName.trim()) {
        if (isUnmatched || (!baseFood && !customFoodConfirmed && !existing)) {
          setErr(t('Unmatched food in progress. Clear the field or confirm as custom food before saving.'))
          return
        }
        const qNum = parseFloat(quantity)
        if (!isNaN(qNum) && qNum > 0) {
          const calNum = parseFloat(calories) || 0
          const pNum = parseFloat(protein) || 0
          const cNum = parseFloat(carbs) || 0
          const fNum = parseFloat(fat) || 0

          const sanityErr = validateNutritionSanity(calNum, pNum, cNum, fNum)
          if (sanityErr) {
            setErr(sanityErr)
            return
          }

          finalItems.push({
            id: 'draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            meal_type: mealType,
            food_name: foodName.trim(),
            serving_quantity: qNum,
            serving_unit: unit,
            energy_kcal: calNum,
            protein_g: pNum,
            carb_g: cNum,
            fat_g: fNum,
            notes: notes.trim() || null,
            is_verified: baseFood?.is_verified,
            data_source: baseFood?.data_source || (customFoodConfirmed ? 'custom_user' : undefined)
          })
        }
      }

      if (onSaveBatch) {
        onSaveBatch(finalItems)
      } else {
        finalItems.forEach(it => onSave(it))
      }
      return
    }

    // Single item submission validation
    if (!foodName.trim()) {
      setErr(t('Please enter or select a food name'))
      return
    }
    if (isUnmatched || (!baseFood && !customFoodConfirmed && !existing)) {
      setErr(t('Food not found in verified dataset. Select an item or tap "+ Add as Custom Food".'))
      return
    }

    const qNum = parseFloat(quantity)
    if (isNaN(qNum) || qNum <= 0) {
      setErr(t('Please enter a valid positive quantity'))
      return
    }

    const calNum = parseFloat(calories) || 0
    const pNum = parseFloat(protein) || 0
    const cNum = parseFloat(carbs) || 0
    const fNum = parseFloat(fat) || 0

    const sanityErr = validateNutritionSanity(calNum, pNum, cNum, fNum)
    if (sanityErr) {
      setErr(sanityErr)
      return
    }

    const entry = {
      id: existing?.id || 'meal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      meal_type: mealType,
      type: mealType,
      food_name: foodName.trim(),
      name: foodName.trim(),
      serving_quantity: qNum,
      qty: qNum,
      serving_unit: unit,
      unit: unit,
      energy_kcal: calNum,
      calories: calNum,
      protein_g: pNum,
      protein: pNum,
      carb_g: cNum,
      carbs: cNum,
      fat_g: fNum,
      fat: fNum,
      notes: notes.trim() || null,
      is_verified: baseFood?.is_verified,
      data_source: baseFood?.data_source || (customFoodConfirmed ? 'custom_user' : undefined),
      created_at: existing?.created_at || new Date().toISOString()
    }

    onSave(entry)
  }

  // Determine if active food is piece-based
  const isPieceFood = unit === 'piece' || (baseFood && (baseFood.serving_unit === 'piece' || /roti|chapati|egg|idli|dosa|banana|apple/i.test(baseFood.name)))

  // Can user submit active food
  const hasActiveFood = Boolean(foodName.trim() && (baseFood || customFoodConfirmed || existing))
  const canSubmit = (draftItems.length > 0 || hasActiveFood) && !isUnmatched

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: '4px 0 24px',
        maxHeight: '85vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 80px)'
      }}
    >
      <h3 style={{ margin: '0 0 14px', fontSize: '1.25rem', fontWeight: 800, color: 'var(--label)' }}>
        {existing ? t('Edit Food Entry') : t('Add Food & Meal Builder')}
      </h3>

      {/* Multi-Item Meal Draft List */}
      {draftItems.length > 0 && (
        <div style={{ background: 'var(--surface-2, #1E1E22)', border: '1px solid var(--borders, #303036)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-accent, #F5F5F5)' }}>
              {t('Meal Draft ({0} items)', draftItems.length)}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label)' }}>
              {draftTotals.kcal} kcal · {draftTotals.p}g P · {draftTotals.c}g C · {draftTotals.f}g F
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {draftItems.map((item, idx) => (
              <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-1, #141416)', padding: '6px 10px', borderRadius: 8, fontSize: 13 }}>
                <div>
                  <strong>{item.food_name}</strong>
                  <span style={{ color: 'var(--label-2)', marginLeft: 6, fontSize: 12 }}>
                    ({item.serving_quantity} {item.serving_unit})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 600, color: 'var(--theme-accent, #F5F5F5)', fontSize: 12 }}>
                    {item.energy_kcal} kcal
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDraftItem(item.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 2, fontSize: 14 }}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {err && (
        <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 12, padding: '8px 12px', background: 'color-mix(in srgb,var(--red) 12%,transparent)', borderRadius: 8, border: '1px solid color-mix(in srgb,var(--red) 30%,transparent)', lineHeight: 1.4 }}>
          {err}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Meal *')}
          </label>
          <select
            value={mealType}
            onChange={e => setMealType(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--borders, #303036)', background: '#242429', color: '#FFFFFF', fontWeight: 600 }}
          >
            {MEAL_TYPES.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Food Name *')}
          </label>
          <input
            type="text"
            required={draftItems.length === 0}
            placeholder={t('Search or enter food, e.g. chapathi, rice, egg, chicken')}
            value={foodName}
            onChange={e => handleFoodNameChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--borders, #303036)',
              background: '#242429',
              color: '#FFFFFF',
              fontSize: '0.95rem',
              fontWeight: 600,
              outline: 'none',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)'
            }}
          />
          {searching && (
            <div style={{ position: 'absolute', right: 10, top: 34, fontSize: 11, color: 'var(--muted)' }}>
              {t('Searching...')}
            </div>
          )}

          {/* Unmatched Food Warning with Explicit Custom Food Action */}
          {isUnmatched && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--surface-1, #1A1A1A)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 8,
                marginTop: 4,
                zIndex: 100,
                padding: '12px 14px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--coral, #FF6B6B)', marginBottom: 4 }}>
                {t('Food not found in dataset.')}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 10, lineHeight: 1.4 }}>
                {t('"{0}" is not in ICMR-NIN 2017 or USDA SR Legacy verified tables.', foodName)}
              </div>
              <button
                type="button"
                onClick={handleEnableCustomFood}
                style={{
                  background: 'var(--borders, #303036)',
                  border: '1px solid var(--theme-accent-border, rgba(255,255,255,0.2))',
                  borderRadius: 6,
                  color: 'var(--theme-accent, #F5F5F5)',
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                + {t('Add as Custom Food')}
              </button>
            </div>
          )}

          {searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--surface-1, #1A1A1A)',
                border: '1px solid var(--theme-accent-border, var(--borders, #303036))',
                borderRadius: 8,
                marginTop: 4,
                zIndex: 100,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                maxHeight: 240,
                overflowY: 'auto'
              }}
            >
              {searchResults.map(item => {
                const itemKcal = item.calories != null ? item.calories : (item.energy_kcal != null ? item.energy_kcal : null);
                const itemP = item.protein != null ? item.protein : (item.protein_g != null ? item.protein_g : 0);
                const itemC = item.carbs != null ? item.carbs : (item.carb_g != null ? item.carb_g : 0);
                const itemF = item.fat != null ? item.fat : (item.fat_g != null ? item.fat_g : 0);
                const hasNutrition = itemKcal != null && Number(itemKcal) > 0;

                return (
                  <div
                    key={item.id || item.name}
                    onClick={() => handleSelectFood(item)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      fontSize: 13,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <strong style={{ color: '#FFFFFF', fontSize: '0.9rem' }}>{item.name}</strong>
                        {(item.name_regional || item.tamil_name || item.hindi_name) && (
                          <span style={{ fontSize: 11, color: 'var(--theme-accent, #F5F5F5)', fontWeight: 600 }}>
                            ({item.name_regional || item.tamil_name || item.hindi_name})
                          </span>
                        )}
                        {item.source === 'NIN_STAPLE' || item.source === 'INDB_ICMR' || item.data_source === 'icmr_nin_2017' ? (
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 9999, background: 'var(--borders, #303036)', color: 'var(--theme-accent, #F5F5F5)', fontWeight: 700 }}>
                            ICMR-NIN Verified
                          </span>
                        ) : item.source === 'INDB_RECIPE' || item.data_source === 'indb' ? (
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 9999, background: 'var(--borders, #303036)', color: 'var(--theme-accent, #F5F5F5)', fontWeight: 700 }}>
                            INDB Recipe
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 9999, background: 'rgba(46, 196, 182, 0.2)', color: 'var(--teal, #2EC4B6)', fontWeight: 700 }}>
                            {item.source || 'USDA'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: hasNutrition ? 'rgba(255, 255, 255, 0.7)' : 'var(--coral, #FF6B6B)', marginTop: 3 }}>
                        {hasNutrition ? (
                          `100g = ${itemKcal} kcal · ${itemP}g P · ${itemC}g C · ${itemF}g F`
                        ) : (
                          'Nutrition information unavailable — verify or enter values manually.'
                        )}
                      </div>
                    </div>
                    <span style={{ color: hasNutrition ? 'var(--theme-accent, #F5F5F5)' : 'rgba(255, 255, 255, 0.4)', fontWeight: 700, fontSize: 13, flex: 'none', marginLeft: 8 }}>
                      {hasNutrition ? `${itemKcal} kcal` : 'Manual'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Quantity *')}
          </label>
          <input
            type="number"
            step="any"
            min="0.1"
            max="5000"
            required={draftItems.length === 0}
            placeholder="e.g. 100"
            value={quantity}
            onChange={e => handleQuantityOrUnitChange(e.target.value, unit)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--borders, #303036)', background: '#242429', color: '#FFFFFF', fontWeight: 600 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Unit *')}
          </label>
          <select
            value={unit}
            onChange={e => handleQuantityOrUnitChange(quantity, e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--borders, #303036)', background: '#242429', color: '#FFFFFF', fontWeight: 600 }}
          >
            {UNITS.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Portion Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--label-2)', fontWeight: 600 }}>{t('Quick Portions:')}</span>
        {isPieceFood ? (
          [
            { label: '1 piece', q: '1', u: 'piece' },
            { label: '2 pieces', q: '2', u: 'piece' },
            { label: '3 pieces', q: '3', u: 'piece' },
            { label: '4 pieces', q: '4', u: 'piece' },
            { label: '100 g', q: '100', u: 'g' }
          ].map(chip => (
            <button
              key={chip.label}
              type="button"
              onClick={() => handleQuantityOrUnitChange(chip.q, chip.u)}
              style={{
                padding: '4px 10px',
                borderRadius: 9999,
                border: quantity === chip.q && unit === chip.u ? '1px solid var(--theme-accent, #F5F5F5)' : '1px solid var(--borders, #303036)',
                background: quantity === chip.q && unit === chip.u ? 'var(--borders, #303036)' : 'var(--surface-2, #1E1E22)',
                color: quantity === chip.q && unit === chip.u ? 'var(--theme-accent, #F5F5F5)' : 'var(--label)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {chip.label}
            </button>
          ))
        ) : (
          [
            { label: '40 g', q: '40', u: 'g' },
            { label: '50 g', q: '50', u: 'g' },
            { label: '100 g', q: '100', u: 'g' },
            { label: '150 g', q: '150', u: 'g' },
            { label: '200 g', q: '200', u: 'g' },
            { label: '1 bowl / cup', q: '1', u: 'bowl' }
          ].map(chip => (
            <button
              key={chip.label}
              type="button"
              onClick={() => handleQuantityOrUnitChange(chip.q, chip.u)}
              style={{
                padding: '4px 10px',
                borderRadius: 9999,
                border: quantity === chip.q && unit === chip.u ? '1px solid var(--theme-accent, #F5F5F5)' : '1px solid var(--borders, #303036)',
                background: quantity === chip.q && unit === chip.u ? 'var(--borders, #303036)' : 'var(--surface-2, #1E1E22)',
                color: quantity === chip.q && unit === chip.u ? 'var(--theme-accent, #F5F5F5)' : 'var(--label)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {chip.label}
            </button>
          ))
        )}
      </div>

      {/* Instant Nutrition Preview Card */}
      <div style={{ background: 'var(--surface-2, #1E1E22)', border: '1px solid var(--borders, #303036)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--label-2)', fontWeight: 600 }}>
            {t('Instant Nutrition Preview')} ({quantity} {unit})
          </span>
          {baseFood && (
            <span style={{ fontSize: 11, color: 'var(--theme-accent, #F5F5F5)' }}>
              {baseFood.is_custom ? t('Custom User Food') : `100g base = ${baseFood.calories || 0} kcal`}
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
          <div style={{ background: 'var(--surface-1, #141416)', padding: '6px 4px', borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--label-2)' }}>{t('Calories')}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--theme-accent, #F5F5F5)' }}>{calories || 0} <span style={{ fontSize: 10 }}>kcal</span></div>
          </div>
          <div style={{ background: 'var(--surface-1, #141416)', padding: '6px 4px', borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--label-2)' }}>{t('Protein')}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--label)' }}>{protein || 0}g</div>
          </div>
          <div style={{ background: 'var(--surface-1, #141416)', padding: '6px 4px', borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--label-2)' }}>{t('Carbs')}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--label)' }}>{carbs || 0}g</div>
          </div>
          <div style={{ background: 'var(--surface-1, #141416)', padding: '6px 4px', borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--label-2)' }}>{t('Fat')}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--label)' }}>{fat || 0}g</div>
          </div>
        </div>
      </div>

      {/* Manual Editable Micro Nutrients Row (Foldable/Inline) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--theme-accent, #F5F5F5)', marginBottom: 4 }}>
            {t('Calories (kcal)')}
          </label>
          <input
            type="number"
            step="any"
            min="0"
            max="5000"
            placeholder="0"
            value={calories}
            onChange={e => {
              setCalories(e.target.value)
              if (customFoodConfirmed && baseFood) baseFood.calories = parseFloat(e.target.value) || 0
            }}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--borders, #303036)', background: '#242429', color: '#FFFFFF', fontSize: 13 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Protein (g)')}
          </label>
          <input
            type="number"
            step="any"
            min="0"
            max="400"
            placeholder="0"
            value={protein}
            onChange={e => {
              setProtein(e.target.value)
              if (customFoodConfirmed && baseFood) baseFood.protein = parseFloat(e.target.value) || 0
            }}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--borders, #303036)', background: '#242429', color: '#FFFFFF', fontSize: 13 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Carbs (g)')}
          </label>
          <input
            type="number"
            step="any"
            min="0"
            max="600"
            placeholder="0"
            value={carbs}
            onChange={e => {
              setCarbs(e.target.value)
              if (customFoodConfirmed && baseFood) baseFood.carbs = parseFloat(e.target.value) || 0
            }}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--borders, #303036)', background: '#242429', color: '#FFFFFF', fontSize: 13 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Fat (g)')}
          </label>
          <input
            type="number"
            step="any"
            min="0"
            max="300"
            placeholder="0"
            value={fat}
            onChange={e => {
              setFat(e.target.value)
              if (customFoodConfirmed && baseFood) baseFood.fat = parseFloat(e.target.value) || 0
            }}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--borders, #303036)', background: '#242429', color: '#FFFFFF', fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
          {t('Notes (optional)')}
        </label>
        <input
          type="text"
          placeholder="e.g. Soaked overnight in water, raw, boiled"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--borders, #303036)', background: '#242429', color: '#FFFFFF' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        {!existing && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddToDraft}
            disabled={!foodName.trim() || isUnmatched || (!baseFood && !customFoodConfirmed)}
            style={{ padding: '10px 16px', fontWeight: 600, fontSize: 13 }}
          >
            + {t('Add to Meal Draft')}
          </Button>
        )}
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
          <Button
            variant="acc"
            type="submit"
            disabled={!canSubmit}
            style={{ padding: '10px 20px', fontWeight: 700, fontSize: 14 }}
          >
            {draftItems.length > 0
              ? t('Save Complete Meal ({0} items)', draftItems.length + (hasActiveFood ? 1 : 0))
              : (existing ? t('Update Food Entry') : t('Save Food Entry'))}
          </Button>
        </div>
      </div>
    </form>
  )
}

function CardioFormModal({ date, existing, onSave }) {
  const [activityType, setActivityType] = useState(existing?.activity_type || 'walking')
  const [durationMin, setDurationMin] = useState(existing?.duration_min != null ? String(existing.duration_min) : '')
  const [distanceKm, setDistanceKm] = useState(existing?.distance_km != null ? String(existing.distance_km) : '')
  const [steps, setSteps] = useState(existing?.steps != null ? String(existing.steps) : '')
  const [caloriesBurned, setCaloriesBurned] = useState(existing?.calories_burned != null ? String(existing.calories_burned) : '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [err, setErr] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!durationMin || isNaN(parseFloat(durationMin))) {
      setErr('Please enter duration in minutes')
      return
    }

    const entry = {
      id: existing?.id || 'cardio_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date,
      activity_type: activityType,
      duration_min: Math.max(1, parseFloat(durationMin) || 0),
      distance_km: distanceKm !== '' ? Math.max(0, parseFloat(distanceKm)) : null,
      steps: steps !== '' ? Math.max(0, parseInt(steps, 10)) : null,
      calories_burned: caloriesBurned !== '' ? Math.max(0, parseFloat(caloriesBurned)) : null,
      notes: notes.trim() || null
    }

    onSave(entry)
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: '4px 0 16px' }}>
      <h3 style={{ margin: '0 0 14px', fontSize: '1.2rem', fontWeight: 700 }}>
        {existing ? t('Edit Cardio Session') : t('Add Cardio Session')}
      </h3>

      {err && (
        <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 12, padding: '6px 10px', background: 'color-mix(in srgb,var(--red) 12%,transparent)', borderRadius: 6 }}>
          {err}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Activity Type *')}
          </label>
          <select
            value={activityType}
            onChange={e => setActivityType(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            {CARDIO_TYPES.map(act => (
              <option key={act} value={act}>{act.charAt(0).toUpperCase() + act.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Duration (minutes) *')}
          </label>
          <input
            type="number"
            min="1"
            required
            placeholder="e.g. 30"
            value={durationMin}
            onChange={e => setDurationMin(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Distance (km)')}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="optional"
            value={distanceKm}
            onChange={e => setDistanceKm(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Steps')}
          </label>
          <input
            type="number"
            min="0"
            placeholder="optional"
            value={steps}
            onChange={e => setSteps(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Est. Calories Burned')}
          </label>
          <input
            type="number"
            min="0"
            placeholder="optional"
            value={caloriesBurned}
            onChange={e => setCaloriesBurned(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
          {t('Notes (optional)')}
        </label>
        <input
          type="text"
          placeholder="e.g. brisk walk in park, incline 3"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="acc" type="submit" style={{ padding: '10px 20px', fontWeight: 600 }}>
          {t('Save Cardio Session')}
        </Button>
      </div>
    </form>
  )
}

function StrengthFormModal({ date, existing, onSave }) {
  const [exerciseName, setExerciseName] = useState(existing?.exercise_name || '')
  const [muscleGroup, setMuscleGroup] = useState(existing?.muscle_group || 'Chest')
  const [sets, setSets] = useState(existing?.sets != null ? String(existing.sets) : '')
  const [reps, setReps] = useState(existing?.reps != null ? String(existing.reps) : '')
  const [weightKg, setWeightKg] = useState(existing?.weight_kg != null ? String(existing.weight_kg) : '')
  const [durationMin, setDurationMin] = useState(existing?.duration_min != null ? String(existing.duration_min) : '')
  const [caloriesBurned, setCaloriesBurned] = useState(existing?.calories_burned != null ? String(existing.calories_burned) : '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [err, setErr] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!exerciseName.trim()) {
      setErr('Please enter exercise name')
      return
    }

    const entry = {
      id: existing?.id || 'strength_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date,
      exercise_name: exerciseName.trim(),
      muscle_group: muscleGroup || null,
      sets: sets !== '' ? Math.max(1, parseInt(sets, 10)) : null,
      reps: reps !== '' ? Math.max(1, parseInt(reps, 10)) : null,
      weight_kg: weightKg !== '' ? Math.max(0, parseFloat(weightKg)) : null,
      duration_min: durationMin !== '' ? Math.max(0, parseFloat(durationMin)) : null,
      calories_burned: caloriesBurned !== '' ? Math.max(0, parseFloat(caloriesBurned)) : null,
      notes: notes.trim() || null
    }

    onSave(entry)
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: '4px 0 16px' }}>
      <h3 style={{ margin: '0 0 14px', fontSize: '1.2rem', fontWeight: 700 }}>
        {existing ? t('Edit Strength Exercise') : t('Add Strength Exercise')}
      </h3>

      {err && (
        <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 12, padding: '6px 10px', background: 'color-mix(in srgb,var(--red) 12%,transparent)', borderRadius: 6 }}>
          {err}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Exercise Name *')}
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Barbell Squat, Dumbbell Curl"
            value={exerciseName}
            onChange={e => setExerciseName(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Muscle Group')}
          </label>
          <select
            value={muscleGroup}
            onChange={e => setMuscleGroup(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            {MUSCLE_GROUPS.map(mg => (
              <option key={mg} value={mg}>{mg}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Sets')}
          </label>
          <input
            type="number"
            min="1"
            placeholder="e.g. 4"
            value={sets}
            onChange={e => setSets(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Reps')}
          </label>
          <input
            type="number"
            min="1"
            placeholder="e.g. 10"
            value={reps}
            onChange={e => setReps(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Weight (kg)')}
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            placeholder="e.g. 60"
            value={weightKg}
            onChange={e => setWeightKg(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Duration (min, optional)')}
          </label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 20"
            value={durationMin}
            onChange={e => setDurationMin(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            {t('Est. Calories (optional)')}
          </label>
          <input
            type="number"
            min="0"
            placeholder="optional manual estimate"
            value={caloriesBurned}
            onChange={e => setCaloriesBurned(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
          {t('Notes (optional)')}
        </label>
        <input
          type="text"
          placeholder="e.g. drop set on last set, good form"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="acc" type="submit" style={{ padding: '10px 20px', fontWeight: 600 }}>
          {t('Save Strength Exercise')}
        </Button>
      </div>
    </form>
  )
}
