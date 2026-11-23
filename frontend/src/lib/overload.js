/**
 * IRONX - Progressive Overload Guidance Engine
 *
 * Tracks previous working weights, sets, reps, and Epley 1RM.
 * Evaluates performance against target rep ranges and suggests
 * conservative, optional load progressions.
 */

import { EXIDX } from './exercises.js'
import { modeOf } from './history.js'

/**
 * Standard Epley Estimated 1RM Formula:
 * 1RM = Weight * (1 + Reps / 30)
 * Valid for resistance movements with reps between 1 and 20.
 */
export function calcEpley1RM(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (w <= 0 || r <= 0) return 0
  if (r === 1) return w
  if (r > 20) return w // Epley accuracy degrades significantly above 20 reps
  return Math.round((w * (1 + r / 30)) * 10) / 10
}

/**
 * Extracts exercise history, previous working sets, best working weight,
 * best reps, and historical e1RM.
 */
export function exercisePerformanceHistory(S, exId) {
  const workouts = (S.workouts || []).filter(w =>
    (w.entries || []).some(e => e.id === exId && (e.sets || []).some(s => s.done))
  )

  if (!workouts.length) {
    return {
      exId,
      hasHistory: false,
      sessionsCount: 0,
      prevSession: null,
      bestWeight: 0,
      bestReps: 0,
      best1RM: 0,
      recentTrend: 'none'
    }
  }

  // Workouts are typically ordered chronologically or reverse; sort by date ascending
  const sorted = [...workouts].sort((a, b) => (a.d < b.d ? -1 : 1))
  let bestWeight = 0
  let bestReps = 0
  let best1RM = 0
  const sessionSummaries = []

  for (const w of sorted) {
    const entry = w.entries.find(e => e.id === exId)
    if (!entry) continue
    const completedSets = (entry.sets || []).filter(s => s.done && !s.warmup)
    if (!completedSets.length) continue

    const weights = completedSets.map(s => Number(s.w) || 0)
    const reps = completedSets.map(s => Number(s.r) || 0)
    const maxW = Math.max(0, ...weights)
    const maxR = Math.max(0, ...reps)

    // Calculate max e1RM in this session
    let sessionBest1RM = 0
    for (const s of completedSets) {
      const e1rm = calcEpley1RM(s.w, s.r)
      if (e1rm > sessionBest1RM) sessionBest1RM = e1rm
    }

    if (maxW > bestWeight) bestWeight = maxW
    if (maxR > bestReps) bestReps = maxR
    if (sessionBest1RM > best1RM) best1RM = sessionBest1RM

    sessionSummaries.push({
      date: w.d,
      sets: completedSets,
      setCount: completedSets.length,
      maxWeight: maxW,
      maxReps: maxR,
      avgWeight: Math.round(weights.reduce((a, b) => a + b, 0) / weights.length * 10) / 10,
      best1RM: sessionBest1RM,
      target: entry.target || {}
    })
  }

  const prevSession = sessionSummaries.length ? sessionSummaries[sessionSummaries.length - 1] : null

  // Trend analysis (comparing last 2 sessions)
  let recentTrend = 'stable'
  if (sessionSummaries.length >= 2) {
    const last = sessionSummaries[sessionSummaries.length - 1]
    const prior = sessionSummaries[sessionSummaries.length - 2]
    if (last.best1RM > prior.best1RM * 1.02) recentTrend = 'improving'
    else if (last.best1RM < prior.best1RM * 0.95) recentTrend = 'declining'
  }

  return {
    exId,
    hasHistory: true,
    sessionsCount: sessionSummaries.length,
    prevSession,
    bestWeight,
    bestReps,
    best1RM,
    recentTrend,
    sessions: sessionSummaries
  }
}

/**
 * Generates progressive overload guidance for an exercise.
 * Suggests load increments only when working sets hit or exceed the upper target rep range.
 */
export function evaluateOverloadGuidance(S, exId, currentPlan = {}) {
  const history = exercisePerformanceHistory(S, exId)
  if (!history.hasHistory || !history.prevSession) {
    return { shouldPrompt: false, reason: 'no_history' }
  }

  const ex = EXIDX[exId]
  const mode = modeOf(currentPlan)
  if (mode === 'cardio' || mode === 'time') {
    return { shouldPrompt: false, reason: 'unsuitable_mode' }
  }

  const targetReps = currentPlan.reps || (currentPlan.target && currentPlan.target.reps) || 10
  const prev = history.prevSession
  const workingSets = prev.sets

  // Check if user hit the target reps across completed working sets
  const hitTargetAllSets = workingSets.length >= 2 && workingSets.every(s => (Number(s.r) || 0) >= targetReps)
  const currentWeight = prev.maxWeight

  // Determine conservative increment based on bodypart
  const isLowerBody = ex && ['upper legs', 'lower legs', 'back', 'hips', 'glutes'].includes(ex.bp)
  const unit = S.unit || 'kg'
  const step = unit === 'lb' ? (isLowerBody ? 10 : 5) : (isLowerBody ? 5 : 2.5)

  // Check previous user decision
  const pastDecision = (S.overloadDecisions || {})[exId]
  if (pastDecision && pastDecision.date === prev.date && pastDecision.decision === 'dismiss') {
    return { shouldPrompt: false, reason: 'user_dismissed' }
  }

  if (hitTargetAllSets) {
    const suggestedWeight = Math.round((currentWeight + step) * 10) / 10
    return {
      shouldPrompt: true,
      type: 'increase',
      exId,
      exName: ex ? ex.n : 'Exercise',
      currentWeight,
      suggestedWeight,
      step,
      targetReps,
      achievedReps: prev.maxReps,
      message: `You completed all sets at ${currentWeight} ${unit} for ${targetReps}+ reps. Consider increasing to ${suggestedWeight} ${unit}.`
    }
  }

  return {
    shouldPrompt: false,
    reason: 'in_progress',
    currentWeight,
    targetReps,
    prevReps: prev.maxReps
  }
}
