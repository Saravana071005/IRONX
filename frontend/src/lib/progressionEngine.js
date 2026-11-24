import { EXIDX } from './exercises.js'
import { t } from './i18n.js'

/**
 * Deterministic Epley 1RM formula calculation
 * 1RM = Weight * (1 + Reps / 30)
 */
export function calc1RM(weight, reps) {
  const w = parseFloat(weight) || 0
  const r = parseFloat(reps) || 0
  if (w <= 0 || r <= 0) return 0
  if (r === 1) return w
  return Math.round(w * (1 + r / 30) * 10) / 10
}

/**
 * Maps exercise ID or entry to primary muscle group label
 */
export function getExerciseMuscleGroup(exId, entry = {}) {
  const meta = EXIDX[exId]
  const bp = (meta?.bp || entry.bp || '').toLowerCase()
  const name = (meta?.n || entry.name || exId || '').toLowerCase()

  if (bp.includes('chest') || name.includes('bench') || name.includes('chest') || name.includes('pushup') || name.includes('dip')) return 'Chest'
  if (bp.includes('back') || name.includes('pull') || name.includes('row') || name.includes('lat') || name.includes('deadlift')) return 'Back'
  if (bp.includes('upper leg') || bp.includes('lower leg') || bp.includes('leg') || name.includes('squat') || name.includes('lunge') || name.includes('quad') || name.includes('calf') || name.includes('hamstring')) return 'Legs'
  if (bp.includes('shoulder') || name.includes('overhead') || name.includes('press') || name.includes('deltoid')) return 'Shoulders'
  if (bp.includes('arm') || name.includes('curl') || name.includes('tricep') || name.includes('bicep')) return 'Arms'
  if (bp.includes('waist') || bp.includes('core') || name.includes('crunch') || name.includes('plank') || name.includes('ab')) return 'Core'
  return meta?.bp ? meta.bp.charAt(0).toUpperCase() + meta.bp.slice(1) : 'General'
}

/**
 * Extracts all valid, completed, non-warmup sets from a workout list for a given exercise ID
 */
export function getHistoricalSetsForExercise(workouts, exId) {
  const history = []
  for (const w of workouts || []) {
    for (const e of w.entries || []) {
      if (e.id === exId) {
        for (const s of e.sets || []) {
          if (s.done && !s.warmup && (s.w > 0 || s.r > 0)) {
            history.push({
              w: Number(s.w) || 0,
              r: Number(s.r) || 0,
              workoutId: w.id,
              date: w.d
            })
          }
        }
      }
    }
  }
  return history
}

/**
 * Evaluate progression for a finished workout against all previous workouts.
 *
 * Rules:
 * 1. First-time exercise baseline: saved without celebratory PR notification.
 * 2. Subsequent workout comparison:
 *    - Weight PR: weight > previous max weight
 *    - Rep PR at same weight: reps > previous max reps at that exact weight
 *    - Estimated 1RM PR: 1RM > previous highest 1RM
 * 3. Positive notifications ONLY: never notify or alert on regressions or drops.
 * 4. User-scoped baseline muscle groups.
 */
export function evaluateWorkoutProgression(currentWorkout, historicalWorkouts = [], options = {}) {
  const unit = options.unit || 'kg'
  const newBaselines = []
  const prs = []
  const muscleGroupProgression = {}

  // Filter historical workouts to exclude current workout if present
  const pastWorkouts = (historicalWorkouts || []).filter(w => w.id !== currentWorkout.id)

  for (const entry of currentWorkout.entries || []) {
    const exId = entry.id
    const exMeta = EXIDX[exId] || {}
    const exName = exMeta.n || entry.name || exId
    const muscleGroup = getExerciseMuscleGroup(exId, entry)

    const completedSets = (entry.sets || []).filter(s => s.done && !s.warmup && ((Number(s.w) || 0) > 0 || (Number(s.r) || 0) > 0))
    if (completedSets.length === 0) continue

    const prevSets = getHistoricalSetsForExercise(pastWorkouts, exId)

    // Current session metrics for this exercise
    const currentTopWeight = Math.max(0, ...completedSets.map(s => Number(s.w) || 0))
    let currentBest1RM = 0
    let currentBestSet = null

    for (const s of completedSets) {
      const e1rm = calc1RM(s.w, s.r)
      if (e1rm > currentBest1RM) {
        currentBest1RM = e1rm
        currentBestSet = { w: Number(s.w) || 0, r: Number(s.r) || 0 }
      }
    }

    // Case 1: First-time exercise baseline
    if (prevSets.length === 0) {
      newBaselines.push({
        exerciseId: exId,
        exerciseName: exName,
        muscleGroup,
        topWeight: currentTopWeight,
        bestSet: currentBestSet,
        est1RM: currentBest1RM,
        isFirstTime: true
      })
      // Do NOT produce celebratory PR notification for first-time baseline
      continue
    }

    // Case 2: Subsequent workout comparison against historical sets
    const prevWeights = prevSets.map(s => s.w)
    const prevMaxWeight = Math.max(0, ...prevWeights)

    const prev1RMs = prevSets.map(s => calc1RM(s.w, s.r))
    const prevBest1RM = Math.max(0, ...prev1RMs)

    let exerciseHadPR = false

    // A. Weight PR (New highest weight lifted)
    if (currentTopWeight > prevMaxWeight && prevMaxWeight > 0) {
      const deltaWeight = Math.round((currentTopWeight - prevMaxWeight) * 10) / 10
      prs.push({
        type: 'WEIGHT_PR',
        exerciseId: exId,
        exerciseName: exName,
        muscleGroup,
        weight: currentTopWeight,
        prevWeight: prevMaxWeight,
        delta: deltaWeight,
        message: t('New Weight PR: {0} {1} (+{2} {1})', currentTopWeight, unit, deltaWeight)
      })
      exerciseHadPR = true
    }

    // B. Rep PR at same weight (More reps at a previously attempted weight)
    for (const s of completedSets) {
      const setWeight = Number(s.w) || 0
      const setReps = Number(s.r) || 0
      if (setWeight > 0 && setReps > 0) {
        const matchingWeightSets = prevSets.filter(ps => ps.w === setWeight)
        if (matchingWeightSets.length > 0) {
          const prevMaxRepsAtWeight = Math.max(0, ...matchingWeightSets.map(ps => ps.r))
          if (setReps > prevMaxRepsAtWeight) {
            const deltaReps = setReps - prevMaxRepsAtWeight
            // Only add once per weight per workout
            const alreadyLogged = prs.some(p => p.type === 'REP_PR' && p.exerciseId === exId && p.weight === setWeight)
            if (!alreadyLogged) {
              prs.push({
                type: 'REP_PR',
                exerciseId: exId,
                exerciseName: exName,
                muscleGroup,
                weight: setWeight,
                reps: setReps,
                prevReps: prevMaxRepsAtWeight,
                delta: deltaReps,
                message: t('Rep PR: {0} reps at {1} {2} (+{3} reps)', setReps, setWeight, unit, deltaReps)
              })
              exerciseHadPR = true
            }
          }
        }
      }
    }

    // C. Best Estimated 1RM PR (Overall peak strength output)
    if (currentBest1RM > prevBest1RM && prevBest1RM > 0) {
      const delta1RM = Math.round((currentBest1RM - prevBest1RM) * 10) / 10
      // Check if not redundant with weight PR
      const hasWeightPR = prs.some(p => p.type === 'WEIGHT_PR' && p.exerciseId === exId)
      prs.push({
        type: 'EST_1RM_PR',
        exerciseId: exId,
        exerciseName: exName,
        muscleGroup,
        est1RM: currentBest1RM,
        prevEst1RM: prevBest1RM,
        delta: delta1RM,
        isComplementary: hasWeightPR,
        message: t('Best Estimated 1RM: {0} {1} (+{2} {1})', currentBest1RM, unit, delta1RM)
      })
      exerciseHadPR = true
    }

    if (exerciseHadPR) {
      if (!muscleGroupProgression[muscleGroup]) {
        muscleGroupProgression[muscleGroup] = { exercises: [], count: 0 }
      }
      muscleGroupProgression[muscleGroup].exercises.push(exName)
      muscleGroupProgression[muscleGroup].count += 1
    }
  }

  // Purely positive notifications
  const notifications = prs.map(p => ({
    title: p.type === 'WEIGHT_PR' ? t('Weight Record!') : p.type === 'REP_PR' ? t('Rep Record!') : t('Strength Record!'),
    message: `${p.exerciseName}: ${p.message}`,
    muscleGroup: p.muscleGroup,
    type: p.type
  }))

  return {
    newBaselines,
    prs,
    muscleGroupProgression,
    notifications
  }
}
