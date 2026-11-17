import { EXIDX, exOr } from './exercises.js'
import { musclesOf, MUSCLES, MUSCLE_NAME } from './muscles.js'
import { todayISO } from './format.js'
import { getTodayScheduledWorkout } from './customPlanner.js'

export const MUSCLE_DETAILS = {
  chest: { name: 'Chest', view: 'front', views: ['front'], region: 'Upper Body' },
  deltoids: { name: 'Shoulders (Deltoids)', view: 'both', views: ['front', 'back'], region: 'Upper Body', frontName: 'Front & Side Shoulders', backName: 'Rear Shoulders' },
  biceps: { name: 'Biceps', view: 'front', views: ['front'], region: 'Arms' },
  triceps: { name: 'Triceps', view: 'back', views: ['back'], region: 'Arms' },
  forearm: { name: 'Forearms', view: 'both', views: ['front', 'back'], region: 'Arms' },
  'upper-back': { name: 'Upper Back & Lats', view: 'back', views: ['back'], region: 'Back' },
  'lower-back': { name: 'Lower Back', view: 'back', views: ['back'], region: 'Back' },
  trapezius: { name: 'Traps', view: 'both', views: ['front', 'back'], region: 'Back & Neck' },
  abs: { name: 'Abs (Abdominals)', view: 'front', views: ['front'], region: 'Core' },
  obliques: { name: 'Obliques', view: 'front', views: ['front'], region: 'Core' },
  serratus: { name: 'Serratus', view: 'front', views: ['front'], region: 'Core' },
  gluteal: { name: 'Glutes', view: 'back', views: ['back'], region: 'Lower Body' },
  quadriceps: { name: 'Quadriceps (Quads)', view: 'front', views: ['front'], region: 'Legs' },
  hamstring: { name: 'Hamstrings', view: 'back', views: ['back'], region: 'Legs' },
  calves: { name: 'Calves', view: 'both', views: ['front', 'back'], region: 'Legs' },
  adductors: { name: 'Adductors', view: 'both', views: ['front', 'back'], region: 'Legs' },
  'hip-flexors': { name: 'Hip Flexors', view: 'front', views: ['front'], region: 'Core & Hips' },
  tibialis: { name: 'Shins', view: 'front', views: ['front'], region: 'Lower Legs' }
}

/**
 * Resolves muscles targeted by an exercise, supporting:
 * 1. Standard library exercise ID (EXIDX)
 * 2. Custom exercise metadata (bp, tg, sm)
 * 3. Fallback keyword matching on exercise name or ID
 */
export function resolveExerciseMuscles(entryOrEx) {
  if (!entryOrEx) return {}
  const id = String(entryOrEx.id || '')
  const exMeta = EXIDX[id]
  const fullObj = exMeta ? { ...exMeta, ...entryOrEx } : entryOrEx
  let muscles = musclesOf(fullObj)
  if (Object.keys(muscles).length > 0) return muscles

  // Body part / category matching
  const bp = (entryOrEx.bodyPart || entryOrEx.bp || entryOrEx.category || '').toLowerCase()
  if (bp) {
    if (bp.includes('chest')) return { chest: 1, deltoids: 0.4, triceps: 0.4 }
    if (bp.includes('shoulder')) return { deltoids: 1, triceps: 0.3 }
    if (bp.includes('back')) return { 'upper-back': 0.75, 'lower-back': 0.25, biceps: 0.4 }
    if (bp.includes('arm')) return { biceps: 0.5, triceps: 0.5, forearm: 0.3 }
    if (bp.includes('leg')) return { quadriceps: 0.5, hamstring: 0.4, gluteal: 0.3, calves: 0.3 }
    if (bp.includes('core') || bp.includes('ab')) return { abs: 0.8, obliques: 0.4 }
  }

  // Name / ID heuristic matching across id, name, and n
  const idStr = id.toLowerCase()
  const nameStr = String(entryOrEx.name || (entryOrEx.n && !entryOrEx.missing ? entryOrEx.n : '')).toLowerCase()
  const text = `${idStr} ${nameStr}`

  const out = {}
  if (/bench|chest|push[\s-]?up|pec|fly|dip/i.test(text)) {
    out.chest = 1
    out.deltoids = 0.4
    out.triceps = 0.4
  }
  if (/curl|bicep/i.test(text)) {
    out.biceps = 1
  }
  if (/tricep|skull|pushdown|extension/i.test(text)) {
    out.triceps = 1
  }
  if (/squat|leg press|lunge|quad|quadricep|hack/i.test(text)) {
    out.quadriceps = 1
    out.gluteal = 0.5
  }
  if (/deadlift|row|pull[\s-]?up|chin[\s-]?up|lat|back/i.test(text)) {
    out['upper-back'] = 0.8
    out['lower-back'] = 0.4
    out.biceps = 0.3
  }
  if (/shoulder|delt|overhead|press|military|raise/i.test(text)) {
    out.deltoids = 1
    out.triceps = 0.3
  }
  if (/calf|calves/i.test(text)) {
    out.calves = 1
  }
  if (/hamstring|leg curl|stiff[\s-]?leg/i.test(text)) {
    out.hamstring = 1
  }
  if (/glute|hip thrust/i.test(text)) {
    out.gluteal = 1
  }
  if (/ab|abs|crunch|plank|sit[\s-]?up|twist|hollow/i.test(text)) {
    out.abs = 1
  }
  return out
}

/**
 * Extracts and computes today's muscle targets and completed activity.
 * Strict rules:
 * - Completed workouts for today determine highlighted muscles.
 * - Only sets marked done: true are counted.
 * - Multiple workouts in a day combine their muscle targets.
 * - Scheduled but not completed workouts show planned muscles in outlined/neutral state.
 * - Cancelled or abandoned workouts are not counted as completed.
 */
export function getTodayMuscleActivity(S, targetDate = new Date()) {
  const d = typeof targetDate === 'string'
    ? (targetDate.includes('T') ? new Date(targetDate) : new Date(targetDate + 'T00:00:00'))
    : targetDate
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const isTargetDateToday = todayStr === todayISO()

  // 1. Gather all completed workouts for today
  const finishedToday = (S?.workouts || []).filter(w => w.d === todayStr)
  
  // Also collect any completed sets from currently active workout if it belongs to today
  const activeEntries = (S?.active && (isTargetDateToday || S.active.d === todayStr || !S.active.d)) ? (S.active.entries || []) : []

  const completedMuscles = {}
  const uniqueExerciseIds = new Set()
  let totalCompletedSets = 0
  let totalDurationMs = 0

  finishedToday.forEach(w => {
    if (w.dur) totalDurationMs += w.dur
  })

  // Helper to record a completed exercise entry
  const recordCompletedEntry = (entry, durMinutes = 0) => {
    const doneSets = (entry.sets || []).filter(s => s.done)
    if (doneSets.length === 0) return

    uniqueExerciseIds.add(entry.id)
    totalCompletedSets += doneSets.length

    const exMeta = EXIDX[entry.id] || exOr(entry.id) || { name: entry.name, id: entry.id }
    const exName = exMeta.name || entry.name || entry.id || 'Exercise'
    const muscles = resolveExerciseMuscles({ ...exMeta, ...entry })

    const repsList = doneSets.map(s => s.r ?? s.reps).filter(r => typeof r === 'number' && r > 0)
    const weightsList = doneSets.map(s => s.w ?? s.weight).filter(w => typeof w === 'number' && w > 0)
    const avgReps = repsList.length > 0 ? Math.round(repsList.reduce((a, b) => a + b, 0) / repsList.length) : null
    const topWeight = weightsList.length > 0 ? Math.max(...weightsList) : null

    for (const slug in muscles) {
      if (!completedMuscles[slug]) {
        const info = MUSCLE_DETAILS[slug] || {}
        completedMuscles[slug] = {
          slug,
          name: info.name || MUSCLE_NAME[slug] || slug,
          sets: 0,
          weightContribution: 0,
          exercises: [],
          totalDurationMin: 0
        }
      }
      completedMuscles[slug].sets += doneSets.length
      completedMuscles[slug].weightContribution += muscles[slug] * doneSets.length
      completedMuscles[slug].totalDurationMin += durMinutes

      // Add exercise info if not already in list
      const existing = completedMuscles[slug].exercises.find(e => e.id === entry.id)
      if (existing) {
        existing.sets += doneSets.length
      } else {
        completedMuscles[slug].exercises.push({
          id: entry.id,
          name: exName,
          sets: doneSets.length,
          avgReps,
          topWeight
        })
      }
    }
  }

  // Process all finished workouts today
  finishedToday.forEach(w => {
    const durM = w.dur ? Math.round(w.dur / 60000) : 0
    ;(w.entries || []).forEach(entry => recordCompletedEntry(entry, durM))
  })

  // Process any currently completed sets in active workout
  activeEntries.forEach(entry => recordCompletedEntry(entry, 0))

  // 2. Gather scheduled muscles from Weekly Workout Planner
  const scheduledMuscles = {}
  let scheduledToday = getTodayScheduledWorkout(S, d)

  // Fallback for custom schedule mocks in tests or direct S.weeklySchedule
  if ((!scheduledToday || scheduledToday.isRest || !scheduledToday.template) && S?.weeklySchedule) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayKey = dayNames[d.getDay()]
    const mockDay = S.weeklySchedule[dayKey] || S.weeklySchedule[d.getDay()]
    if (mockDay) {
      const tpl = mockDay.template || (typeof mockDay === 'object' && mockDay.exercises ? mockDay : null)
      if (tpl) {
        scheduledToday = { isRest: false, template: tpl, templateId: tpl.id || mockDay.templateId }
      }
    }
  }

  if (scheduledToday && !scheduledToday.isRest && scheduledToday.template) {
    const tpl = scheduledToday.template
    ;(tpl.exercises || []).forEach(ex => {
      const exMeta = EXIDX[ex.id] || exOr(ex.id) || ex
      const muscles = resolveExerciseMuscles({ ...exMeta, ...ex })
      for (const slug in muscles) {
        if (!scheduledMuscles[slug]) {
          const info = MUSCLE_DETAILS[slug] || {}
          scheduledMuscles[slug] = {
            slug,
            name: info.name || MUSCLE_NAME[slug] || slug,
            plannedSets: 0,
            exercises: []
          }
        }
        scheduledMuscles[slug].plannedSets += (ex.sets || 3)
        if (!scheduledMuscles[slug].exercises.some(e => e.id === ex.id)) {
          scheduledMuscles[slug].exercises.push({
            id: ex.id,
            name: ex.name || ex.id,
            sets: ex.sets || 3,
            reps: ex.reps || 10,
            weight: ex.weight || 0
          })
        }
      }
    })
  }

  // 3. Compute status for every muscle
  const muscleStatuses = {}
  MUSCLES.forEach(slug => {
    if (completedMuscles[slug]) {
      muscleStatuses[slug] = {
        status: 'completed',
        data: completedMuscles[slug]
      }
    } else if (scheduledMuscles[slug]) {
      muscleStatuses[slug] = {
        status: 'scheduled',
        data: scheduledMuscles[slug]
      }
    } else {
      const info = MUSCLE_DETAILS[slug] || {}
      muscleStatuses[slug] = {
        status: 'untrained',
        data: {
          slug,
          name: info.name || MUSCLE_NAME[slug] || slug,
          sets: 0,
          exercises: []
        }
      }
    }
  })

  return {
    todayStr,
    completedMuscles,
    scheduledMuscles,
    muscleStatuses,
    muscleGroupsTrainedCount: Object.keys(completedMuscles).length,
    completedExercisesCount: uniqueExerciseIds.size,
    completedSetsCount: totalCompletedSets,
    totalDurationMinutes: Math.round(totalDurationMs / 60000),
    hasCompletedToday: Object.keys(completedMuscles).length > 0,
    hasScheduledToday: !scheduledToday?.isRest && !!scheduledToday?.template,
    scheduledTemplateName: scheduledToday?.template?.name || null
  }
}
