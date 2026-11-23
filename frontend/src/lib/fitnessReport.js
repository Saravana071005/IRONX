/**
 * IRONX - Weekly Fitness Intelligence Report Engine
 *
 * Computes deterministic training and nutrition aggregates, detects
 * progressive overload signals, evaluates recovery balance, and generates
 * structured, auditable weekly intelligence summaries.
 */

import { weekKey, todayISO, fmtDate } from './format.js'
import { calcEWMA } from './transformation.js'
import { loadOfWorkouts, rankOf, MUSCLE_NAME } from './muscles.js'
import { EXIDX } from './exercises.js'

/**
 * Generates the full weekly intelligence summary for a given reference date.
 */
export function generateWeeklyFitnessReport(S, targetDate = todayISO()) {
  const targetWeek = weekKey(targetDate)
  const workouts = (S.workouts || []).filter(w => weekKey(w.d) === targetWeek)
  
  // 1. Training Volume & Sets
  let totalSets = 0
  let totalVolumeKg = 0
  const exerciseStats = new Map()

  for (const w of workouts) {
    for (const en of (w.entries || [])) {
      const ex = EXIDX[en.id]
      const name = ex ? ex.n : (en.name || 'Exercise')
      const doneSets = (en.sets || []).filter(s => s.done && !s.warmup)
      totalSets += doneSets.length

      for (const s of doneSets) {
        const weight = Number(s.w) || 0
        const reps = Number(s.r) || 0
        totalVolumeKg += weight * reps

        if (!exerciseStats.has(en.id)) {
          exerciseStats.set(en.id, { id: en.id, name, sets: 0, volume: 0, topWeight: 0, maxReps: 0 })
        }
        const st = exerciseStats.get(en.id)
        st.sets++
        st.volume += weight * reps
        if (weight > st.topWeight) st.topWeight = weight
        if (reps > st.maxReps) st.maxReps = reps
      }
    }
  }

  const topExercises = Array.from(exerciseStats.values())
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5)

  // 2. Personal Records in this week
  const weekPRs = (S.prVault || []).filter(pr => weekKey(pr.date) === targetWeek)

  // 3. Muscle Distribution
  const muscleLoad = loadOfWorkouts(workouts)
  const { worked, missed } = rankOf(muscleLoad)
  const topMuscles = worked.slice(0, 4).map(m => ({
    slug: m,
    name: MUSCLE_NAME[m] || m,
    sets: Math.round((muscleLoad[m] || 0) * 10) / 10
  }))

  // 4. Bodyweight & Transformation Trend
  const bwEntries = (S.bodyweight || []).filter(b => weekKey(b.d) === targetWeek)
  const ewmaSeries = calcEWMA(S.bodyweight || [])
  const recentEWMA = ewmaSeries.length ? ewmaSeries[ewmaSeries.length - 1] : null
  const firstEWMA = ewmaSeries.length ? ewmaSeries[0] : null
  
  const bwSummary = {
    hasData: bwEntries.length > 0,
    entriesCount: bwEntries.length,
    latestWeight: recentEWMA ? recentEWMA.w : null,
    trendWeight: recentEWMA ? recentEWMA.ewma : null,
    weeklyDelta: (recentEWMA && firstEWMA) ? Math.round((recentEWMA.ewma - firstEWMA.ewma) * 10) / 10 : 0
  }

  // 5. Nutrition Adherence
  const mealsInWeek = (S.meals || []).filter(m => weekKey(m.d || m.date) === targetWeek)
  let totalKcal = 0
  let totalProtein = 0
  const daysLogged = new Set(mealsInWeek.map(m => m.d || m.date)).size

  for (const m of mealsInWeek) {
    totalKcal += Number(m.energy_kcal || m.nutrients?.calories || 0)
    totalProtein += Number(m.protein_g || m.nutrients?.protein || 0)
  }

  const nutritionSummary = {
    hasData: mealsInWeek.length > 0,
    daysLogged,
    avgCalories: daysLogged > 0 ? Math.round(totalKcal / daysLogged) : 0,
    avgProtein: daysLogged > 0 ? Math.round(totalProtein / daysLogged) : 0,
    targetCalorie: S.nutritionTargets?.calorie || S.nutritionTargets?.calories || 2000,
    targetProtein: S.nutritionTargets?.protein || 140
  }

  // 6. Actionable Improvement Suggestions
  const recommendations = []
  if (workouts.length < (S.weeklyTarget || 4)) {
    recommendations.push({
      type: 'consistency',
      title: 'Target Frequency',
      detail: `Completed ${workouts.length} of ${S.weeklyTarget || 4} planned sessions. Consider scheduling rest days in advance.`
    })
  } else {
    recommendations.push({
      type: 'consistency',
      title: 'Consistency Achieved',
      detail: `Met your weekly goal of ${S.weeklyTarget || 4} sessions! Great momentum for progressive adaptation.`
    })
  }

  if (missed.length > 4 && workouts.length > 0) {
    recommendations.push({
      type: 'balance',
      title: 'Muscle Balance Alert',
      detail: `Several major groups (${missed.slice(0, 3).map(m => MUSCLE_NAME[m] || m).join(', ')}) received 0 sets this week.`
    })
  }

  if (nutritionSummary.hasData && nutritionSummary.avgProtein < nutritionSummary.targetProtein * 0.85) {
    recommendations.push({
      type: 'nutrition',
      title: 'Protein Adherence',
      detail: `Average protein (${nutritionSummary.avgProtein}g) trailed target (${nutritionSummary.targetProtein}g). Prioritize lean sources on training days.`
    })
  }

  return {
    weekKey: targetWeek,
    targetDate,
    training: {
      workoutsCount: workouts.length,
      totalSets,
      totalVolumeKg: Math.round(totalVolumeKg),
      topExercises,
      newPRCount: weekPRs.length,
      prs: weekPRs
    },
    muscles: {
      top: topMuscles,
      missed: missed.map(m => MUSCLE_NAME[m] || m)
    },
    bodyweight: bwSummary,
    nutrition: nutritionSummary,
    recommendations
  }
}
