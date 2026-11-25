// Pure helpers over the state object S (ported 1:1 from the vanilla app).
import { todayISO, isoOf, weekKey, fmtNum } from './format.js'
import { isCardio } from './exercises.js'

// How an exercise is logged (issue #16). This used to be derived from the body part alone,
// which meant a plank or a farmer's carry could only be timed by filing it under cardio.
// A routine entry can now say so explicitly:
//   reps   — weight × reps      sets look like { w, r }
//   time   — a work duration    sets look like { sec, w }   (w = 0 for bodyweight)
//   cardio — duration + speed   sets look like { min, speed }
// An entry without `mode` behaves exactly as before, so every existing plan, workout and
// plan file is read unchanged and nothing needs migrating.
export function modeOf(cfg) {
  const m = cfg && cfg.mode
  if (m === 'reps' || m === 'time' || m === 'cardio') return m
  return isCardio(cfg && cfg.id) ? 'cardio' : 'reps'
}
export const isTimed = cfg => modeOf(cfg) === 'time'

// mm:ss for a work duration — seconds alone read badly past a minute ("90 s" vs "1:30").
export function fmtSec(sec) {
  const n = Math.max(0, Math.round(Number(sec) || 0))
  return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0')
}

// How hard a set felt, if the profile logs it at all. Two scales for the same thing, kept in
// their own fields: RIR counts the reps still in the tank, RPE reads the same effort off a
// 10-point scale from the top (RPE 8 ≈ RIR 2). A set logged on one scale is never silently
// rewritten as the other — switching the setting changes what new sets ask for, nothing else.
// `min`..`max` is the range the stepper walks. RIR bottoms out at 0 (a set taken to failure);
// RPE bottoms out at 6, since the scale is only meaningful for working sets and anything
// lighter is a warm-up nobody rates.
export const EFFORT = {
  rir: { f: 'rir', hd: 'RIR', step: 0.5, min: 0, max: 10 },
  rpe: { f: 'rpe', hd: 'RPE', step: 0.5, min: 6, max: 10 }
}
// One tap of an effort stepper. Empty is not 0 — an unlogged effort must not become "went to
// failure" from one stray tap — so − on an empty cell leaves it empty, and + starts at the
// bottom of the scale and walks up from there in even steps. Stepping back off the bottom
// clears the cell again, so a mistap is undoable. null means "nothing logged"; the caller
// stores that by dropping the key rather than writing a null.
export function stepEffort(kind, cur, dir) {
  const e = EFFORT[kind]
  if (!e) return cur ?? null
  if (cur == null) return dir < 0 ? null : e.min
  const n = Math.round((cur + dir * e.step) * 100) / 100
  if (dir < 0 && n < e.min) return null
  // only the ceiling is enforced on the way up: a value typed below the floor (nothing stops
  // someone entering RPE 3) still steps in even increments instead of snapping to the floor.
  return dir > 0 ? Math.min(e.max, n) : Math.max(e.min, n)
}
// A typed effort is capped but not floored — clamping up while someone types "10" would turn
// the first keystroke into the floor and fight the input.
export const capEffort = (kind, v) =>
  (v == null || !EFFORT[kind] ? v : Math.min(EFFORT[kind].max, v))
// Which scale a profile logs. `showRir` is the boolean this replaced and is only consulted
// when the profile has no answer of its own — an explicit 'none' has to win over it, or a
// backup or another device that still carries the old flag would switch the column back on.
export const effortOf = S => {
  const e = S && S.effort
  return e === 'none' || EFFORT[e] ? e : (S && S.showRir ? 'rir' : 'none')
}
// The "(RIR 2)" / "(RPE 8)" tail on a set summary, empty when nothing was logged.
const effortTail = s => {
  const k = s.rir != null ? 'rir' : s.rpe != null ? 'rpe' : null
  return k ? ` (${EFFORT[k].hd} ${fmtNum(s[k])})` : ''
}

// One-line summary of a logged set. `cfg` carries the mode when the caller has it (a routine
// entry or a workout entry); passing an id alone keeps the old body-part behaviour.
export function setLabel(id, s, cfg) {
  const mode = modeOf(cfg || { id })
  if (mode === 'cardio') return `${s.min || 0} min @ ${fmtNum(s.speed || 0)} km/h`
  if (mode === 'time') return fmtSec(s.sec) + (s.w > 0 ? ` · ${fmtNum(s.w)}` : '')
  return `${fmtNum(s.w || 0)}×${s.r || 0}` + effortTail(s)
}
// Default config for a freshly added exercise.
export function defaultConfig(id, mode) {
  const m = mode || modeOf({ id })
  if (m === 'cardio') return { sets: 1, min: 20, speed: 8 }
  if (m === 'time') return { sets: 3, sec: 45, weight: 0, mode: 'time' }
  return { sets: 3, reps: 10, weight: 0, mode: 'reps' }
}
// One-line summary of a planned exercise ("3 × 10 · 60 kg"), shared by the routine editor
// and the plan export so a mode is described the same way everywhere.
export function exLine(cfg, unit) {
  const mode = modeOf(cfg)
  const n = cfg.sets || 1
  const load = cfg.weight ? ' · ' + fmtNum(cfg.weight) + ' ' + unit : ''
  if (mode === 'cardio') return `${n} × ${cfg.min || 20} min @ ${fmtNum(cfg.speed || 8)} km/h`
  if (mode === 'time') return `${n} × ${fmtSec(cfg.sec || 45)}${load}`
  return `${n} × ${cfg.reps}${load}`
}

// Drop superset ids that no longer have an adjacent partner (after unlink/reorder/remove).
export function cleanupSg(ex) {
  ex.forEach((e, i) => {
    if (e.sg && !(ex[i - 1]?.sg === e.sg || ex[i + 1]?.sg === e.sg)) delete e.sg
  })
}

/**
 * Retrieves the immediately previous completed session performance for an exact exercise variation.
 *
 * Rules:
 * 1. Differentiates strictly by canonical ID / exact variation (case-insensitive trim match on exId).
 *    Never matches by muscle group or category.
 * 2. Only considers completed past sessions (!w.inProgress, w.id !== activeWorkoutId, w.id !== S?.active?.id).
 * 3. Sorts finished workouts descending by completion timestamp (w.end > w.start > w.d).
 * 4. Extracts only completed sets (s.done === true).
 * 5. If no previous session exists for this exact exercise/variation, returns clean first-time state.
 *
 * @param {Object} S - Application state
 * @param {string} exId - Exact exercise or variation ID
 * @param {string} [activeWorkoutId] - ID of active workout to exclude
 * @returns {Object} Previous performance details or clean first-time state
 */
export function getPreviousExercisePerformance(S, exId, activeWorkoutId = null) {
  if (!S || !exId) {
    return {
      found: false,
      message: 'No previous session for this exercise.',
      subtext: 'First time logging this variation. Complete sets below to establish your baseline.',
      sets: []
    }
  }

  const workouts = Array.isArray(S.workouts) ? S.workouts : []
  const targetId = String(exId).trim().toLowerCase()
  const currentActiveId = activeWorkoutId || S.active?.id || null

  // 1. Filter out unfinished sessions, planned sessions, and current active workout
  const completedWorkouts = workouts.filter(w => {
    if (!w || !Array.isArray(w.entries)) return false
    if (w.inProgress) return false
    if (currentActiveId && w.id === currentActiveId) return false
    if (w.completed === false) return false
    return true
  })

  // 2. Sort workouts descending by completion timestamp (w.end > w.start > w.d)
  const sorted = [...completedWorkouts].sort((a, b) => {
    const timeA = Number(a.end) || Number(a.start) || (a.d ? new Date(a.d + 'T23:59:59').getTime() : 0)
    const timeB = Number(b.end) || Number(b.start) || (b.d ? new Date(b.d + 'T23:59:59').getTime() : 0)
    return timeB - timeA
  })

  // 3. Find immediately previous completed workout containing this exact exercise variation
  for (const w of sorted) {
    const entry = w.entries.find(e => {
      if (!e || !e.id) return false
      return String(e.id).trim().toLowerCase() === targetId
    })

    if (!entry || !Array.isArray(entry.sets)) continue

    // Filter sets to only completed sets
    const doneSets = entry.sets.filter(s => s && (s.done === true || s.completed === true))
    if (!doneSets.length) continue

    const dateStr = w.d || ''
    let formattedDate = dateStr
    if (dateStr) {
      try {
        const dt = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr)
        if (!isNaN(dt.getTime())) {
          formattedDate = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        }
      } catch (e) {
        formattedDate = dateStr
      }
    }

    const mode = modeOf({ ...(entry.target || {}), id: exId })

    const formattedSets = doneSets.map((s, idx) => ({
      setNumber: s.setNumber || idx + 1,
      w: s.w != null ? Number(s.w) : 0,
      r: s.r != null ? Number(s.r) : 0,
      sec: s.sec != null ? Number(s.sec) : 0,
      min: s.min != null ? Number(s.min) : 0,
      speed: s.speed != null ? Number(s.speed) : 0,
      warmup: !!s.warmup,
      rir: s.rir ?? null,
      rpe: s.rpe ?? null,
      completed: true
    }))

    return {
      found: true,
      workoutId: w.id,
      workoutName: w.name || 'Workout',
      workoutGroup: w.routineId || '',
      date: dateStr,
      formattedDate,
      end: w.end || null,
      mode,
      target: entry.target || null,
      sets: formattedSets
    }
  }

  return {
    found: false,
    message: 'No previous session for this exercise.',
    subtext: 'First time logging this variation. Complete sets below to establish your baseline.',
    sets: []
  }
}

export function lastEntryFor(S, exId) {
  const perf = getPreviousExercisePerformance(S, exId)
  if (perf && perf.found) {
    return {
      d: perf.date,
      sets: perf.sets,
      target: perf.target,
      workoutName: perf.workoutName,
      formattedDate: perf.formattedDate
    }
  }
  return null
}
export function bestWeightFor(S, exId) {
  let best = 0
  S.workouts.forEach(w => w.entries.forEach(e => {
    if (e.id === exId) {
      e.sets.forEach(s => { if (s.done && s.w > best) best = s.w })
      if (e.topW && e.topW > best) best = e.topW
    }
  }))
  return best
}
export function effectiveRoutineId(S, iso) {
  const ov = S.dayPlan[iso]
  if (ov === 'rest') return null
  if (ov && S.routines.some(r => r.id === ov)) return ov
  const wd = new Date(iso + 'T12:00:00').getDay()
  return S.week[wd] || null
}
export function effectiveRoutine(S, iso) {
  const id = effectiveRoutineId(S, iso)
  return id ? S.routines.find(r => r.id === id) || null : null
}
export function buildSets(S, cfg) {
  const last = lastEntryFor(S, cfg.id)
  const n = Math.max(1, cfg.sets || 1)
  const mode = modeOf(cfg)
  const sets = []
  // Last time's set at the same position, falling back to its final set when the plan grew.
  const prevAt = i => (last ? (last.sets[i] || last.sets[last.sets.length - 1]) : null)

  if (mode === 'cardio') {
    for (let i = 0; i < n; i++) {
      const prev = prevAt(i)
      sets.push({ min: prev ? prev.min : (cfg.min || 20), speed: prev ? prev.speed : (cfg.speed || 8), done: false })
    }
    return sets
  }
  if (mode === 'time') {
    for (let i = 0; i < n; i++) {
      // Only carry a previous value over when it came from a timed set — switching an
      // exercise from reps to time must not seed the duration from a rep count.
      const prev = prevAt(i)
      const carried = prev && prev.sec > 0 ? prev : null
      sets.push({ sec: carried ? carried.sec : (cfg.sec || 45), w: carried ? (carried.w || 0) : (cfg.weight || 0), done: false })
    }
    return sets
  }
  const conf = S.exWeights[cfg.id]
  for (let i = 0; i < n; i++) {
    const prev = prevAt(i)
    const usable = prev && prev.r > 0 ? prev : null
    const w = conf && conf.w > 0 ? conf.w : (usable ? usable.w : cfg.weight)
    sets.push({ w, r: usable ? usable.r : cfg.reps, done: false })
  }
  return sets
}
export function workoutVolume(w) {
  let v = 0
  w.entries.forEach(e => e.sets.forEach(s => { if (s.done) v += (s.w || 0) * (s.r || 0) }))
  return v
}
export function setsDone(w) {
  let n = 0
  w.entries.forEach(e => e.sets.forEach(s => { if (s.done) n++ }))
  return n
}
export function setsDoneActive(A) {
  let n = 0
  if (A) A.entries.forEach(e => e.sets.forEach(s => { if (s.done) n++ }))
  return n
}
export const lastBW = S => (S?.bodyweight?.length ? S.bodyweight[S.bodyweight.length - 1] : null)

// Group consecutive items sharing a superset id (sg) into "units" of indices.
// items may be routine exercises ({sg}) or active-workout entries ({sg}).
export function supersetUnits(items) {
  const units = []
  if (!Array.isArray(items)) return units
  items.forEach((e, i) => {
    const prev = items[i - 1]
    if (i > 0 && e && e.sg && prev && prev.sg && e.sg === prev.sg) units[units.length - 1].push(i)
    else units.push([i])
  })
  return units
}
export function unitOf(units, idx) { return (Array.isArray(units) && units.find(u => u.includes(idx))) || [idx] }

export function streakWeeks(S) {
  const workouts = Array.isArray(S) ? S : (S?.workouts || [])
  if (!workouts.length) return 0
  const weeks = new Set(workouts.map(w => (w?.d ? weekKey(w.d) : null)).filter(Boolean))
  let streak = 0
  const cur = new Date()
  for (let i = 0; i < 520; i++) {
    const wk = weekKey(isoOf(cur))
    if (weeks.has(wk)) streak++
    else if (i > 0) break
    cur.setDate(cur.getDate() - 7)
  }
  return streak
}
