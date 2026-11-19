// Which muscles an exercise trains, and how hard — the data behind every muscle map.
//
// The exercise dataset names muscles in free text and is not consistent about it:
// "shoulders", "deltoids" and "delts" are the same thing, so are "quads" and
// "quadriceps", "lats" and "latissimus dorsi", "core" and "abdominals". Nineteen
// primary and forty secondary spellings collapse onto the eighteen muscles the body
// map can actually draw, via ALIAS below. Anything genuinely undrawable (hands,
// ankles, "cardiovascular system") maps to null and is dropped rather than guessed at.

import { EXIDX } from './exercises.js'
import { INITIAL_PREDEFINED_EXERCISES } from './customPlanner.js'

// The muscles a map can shade, in head-to-toe order — also the order of any list
// built from them, so "what am I neglecting" reads top-down like a body.
export const MUSCLES = [
  'trapezius', 'deltoids', 'chest', 'upper-back', 'serratus',
  'biceps', 'triceps', 'forearm',
  'abs', 'obliques', 'lower-back',
  'gluteal', 'quadriceps', 'hamstring', 'adductors', 'hip-flexors',
  'calves', 'tibialis',
]

// Drawn as the silhouette, never shaded: they carry no training load.
export const INERT = ['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles']

// English display names; these strings are the i18n keys (see lib/i18n.js).
export const MUSCLE_NAME = {
  trapezius: 'Traps', deltoids: 'Shoulders', chest: 'Chest', 'upper-back': 'Upper back',
  serratus: 'Serratus', biceps: 'Biceps', triceps: 'Triceps', forearm: 'Forearms',
  abs: 'Abs', obliques: 'Obliques', 'lower-back': 'Lower back', gluteal: 'Glutes',
  quadriceps: 'Quads', hamstring: 'Hamstrings', adductors: 'Adductors',
  'hip-flexors': 'Hip flexors', calves: 'Calves', tibialis: 'Shins',
}

// Every spelling that occurs in the dataset's `tg` and `sm` fields. null = not drawable.
const ALIAS = {
  // primaries
  abs: 'abs', pectorals: 'chest', biceps: 'biceps', glutes: 'gluteal', delts: 'deltoids',
  triceps: 'triceps', 'upper back': 'upper-back', lats: 'upper-back', calves: 'calves',
  quads: 'quadriceps', forearms: 'forearm', hamstrings: 'hamstring', spine: 'lower-back',
  traps: 'trapezius', adductors: 'adductors', 'serratus anterior': 'serratus',
  abductors: 'gluteal', 'levator scapulae': 'trapezius', 'cardiovascular system': null,
  // secondaries
  shoulder: 'deltoids', shoulders: 'deltoids', deltoids: 'deltoids', 'rear deltoids': 'deltoids',
  'rotator cuff': 'deltoids', quadriceps: 'quadriceps', core: 'abs', abdominals: 'abs',
  'lower abs': 'abs', chest: 'chest', 'upper chest': 'chest', 'hip flexors': 'hip-flexors',
  obliques: 'obliques', 'lower back': 'lower-back', rhomboids: 'upper-back',
  trapezius: 'trapezius', back: 'upper-back', 'latissimus dorsi': 'upper-back',
  brachialis: 'biceps', soleus: 'calves', shins: 'tibialis', wrists: 'forearm',
  'wrist flexors': 'forearm', 'wrist extensors': 'forearm', 'grip muscles': 'forearm',
  groin: 'adductors', 'inner thighs': 'adductors',
  'core / abs': 'abs', 'chest / triceps': 'chest', 'back / biceps': 'upper-back',
  'legs': 'quadriceps', 'legs / core': 'quadriceps',
  ankles: null, feet: null, hands: null, 'ankle stabilizers': null,
  sternocleidomastoid: null,
}

// Custom exercises carry only a body part, so they fall back to it. Weights inside a
// group sum to 1 — "upper legs" spreads over three muscles rather than counting triple.
const BY_BODYPART = {
  chest: { chest: 1 },
  back: { 'upper-back': 0.75, 'lower-back': 0.25 },
  shoulders: { deltoids: 1 }, shoulder: { deltoids: 1 },
  arms: { biceps: 0.5, triceps: 0.5 },
  biceps: { biceps: 1 },
  triceps: { triceps: 1 },
  legs: { quadriceps: 0.4, hamstring: 0.35, gluteal: 0.25 },
  core: { abs: 0.7, obliques: 0.3 },
  'core / abs': { abs: 0.7, obliques: 0.3 },
  abs: { abs: 0.8, obliques: 0.2 },
  'upper arms': { biceps: 0.5, triceps: 0.5 },
  'lower arms': { forearm: 1 },
  waist: { abs: 0.7, obliques: 0.3 },
  'upper legs': { quadriceps: 0.4, hamstring: 0.35, gluteal: 0.25 },
  'lower legs': { calves: 0.8, tibialis: 0.2 },
  neck: { trapezius: 1 },
  cardio: {},
}

const SECONDARY = 0.4   // a supporting muscle counts this much against a primary

function mapPredefinedSecondaries(id, category) {
  const cat = String(category || '').toLowerCase()
  if (cat.includes('chest')) return ['triceps', 'deltoids']
  if (cat.includes('shoulder')) return ['triceps', 'trapezius']
  if (cat.includes('back')) return ['biceps', 'lower-back']
  if (cat.includes('bicep')) return ['forearm']
  if (cat.includes('tricep')) return ['chest']
  if (cat.includes('leg')) return ['hamstring', 'gluteal', 'calves']
  if (cat.includes('core') || cat.includes('abs')) return ['obliques']
  return []
}

/**
 * Resolves exercise metadata (target muscles, secondary muscles, body part)
 * from EXIDX, predefined library, custom exercises, or heuristic name inference.
 */
export function resolveExerciseMeta(id, entry = null, customEx = []) {
  if (id && EXIDX && EXIDX[id]) return EXIDX[id]

  if (id && Array.isArray(INITIAL_PREDEFINED_EXERCISES)) {
    const predefined = INITIAL_PREDEFINED_EXERCISES.find(e => e.id === id)
    if (predefined) {
      return {
        id: predefined.id,
        n: predefined.name,
        bp: predefined.category?.toLowerCase() || 'other',
        tg: predefined.muscleGroup?.toLowerCase() || predefined.category?.toLowerCase() || '',
        sm: mapPredefinedSecondaries(predefined.id, predefined.category)
      }
    }
  }

  if (id && Array.isArray(customEx)) {
    const cust = customEx.find(e => e.id === id)
    if (cust) {
      return {
        id: cust.id,
        n: cust.n || cust.name,
        bp: cust.bp || cust.category?.toLowerCase() || 'other',
        tg: cust.tg || cust.muscleGroup?.toLowerCase() || cust.category?.toLowerCase() || '',
        sm: cust.sm || []
      }
    }
  }

  const name = String(entry?.name || entry?.n || id || '').toLowerCase().trim()
  if (name) {
    const foundByName = INITIAL_PREDEFINED_EXERCISES?.find(e => e.name.toLowerCase() === name)
    if (foundByName) {
      return {
        id: foundByName.id,
        n: foundByName.name,
        bp: foundByName.category?.toLowerCase() || 'other',
        tg: foundByName.muscleGroup?.toLowerCase() || foundByName.category?.toLowerCase() || '',
        sm: mapPredefinedSecondaries(foundByName.id, foundByName.category)
      }
    }

    if (/shoulder|overhead press|military press|lateral raise|rear delt|front raise|deltoid|arnold press|sh_db|sh_bb/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'shoulders', tg: 'deltoids', sm: ['trapezius', 'triceps'] }
    }
    if (/bench press|chest press|push-up|push up|dumbbell fly|cable crossover|dip|pec deck|ch_db|ch_bb|incline.*press/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'chest', tg: 'chest', sm: ['triceps', 'deltoids'] }
    }
    if (/pull-up|pull up|chin-up|lat pulldown|lat pull|barbell row|dumbbell row|cable row|deadlift|back extension|t-bar row|face pull|bk_lat|bk_bb/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'back', tg: 'upper-back', sm: ['biceps', 'lower-back', 'trapezius'] }
    }
    if (/bicep|curl|hammer curl|preacher|chin-up|bi_bb|bi_db/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'upper arms', tg: 'biceps', sm: ['forearm'] }
    }
    if (/tricep|skull crusher|pushdown|kickback|close grip bench|tri_cable|tri_db/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'upper arms', tg: 'triceps', sm: ['chest'] }
    }
    if (/squat|leg press|lunge|leg extension|hamstring curl|romanian deadlift|rdl|calf raise|glute bridge|hip thrust|leg_sq|leg_cu/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'upper legs', tg: 'quadriceps', sm: ['hamstring', 'gluteal', 'calves'] }
    }
    if (/plank|crunch|hanging leg raise|ab wheel|russian twist|cable woodchop|core|ab_/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'waist', tg: 'abs', sm: ['obliques'] }
    }
  }

  const bp = (entry?.bodyPart || entry?.category || entry?.bp || 'other').toLowerCase()
  return {
    id: id || 'unknown',
    n: entry?.name || id || 'Exercise',
    bp,
    tg: bp,
    sm: []
  }
}

/** Muscles one exercise trains: { slug: 0…1 }. */
export function musclesOf(ex) {
  if (!ex) return {}
  const out = {}
  const add = (name, w) => {
    const raw = String(name || '').toLowerCase().trim()
    const slug = ALIAS[raw] !== undefined ? ALIAS[raw] : null
    if (slug) {
      out[slug] = Math.max(out[slug] || 0, w)
    } else if (BY_BODYPART[raw]) {
      const bpMap = BY_BODYPART[raw]
      for (const s in bpMap) {
        out[s] = Math.max(out[s] || 0, bpMap[s] * w)
      }
    }
  }
  add(ex.tg, 1)
  ;(ex.sm || []).forEach(m => add(m, SECONDARY))
  // Nothing recognised (custom exercises, or a target we don't draw) — use the body part.
  if (!Object.keys(out).length) {
    const bpSlug = String(ex.bp || '').toLowerCase().trim()
    Object.assign(out, BY_BODYPART[bpSlug] || {})
  }
  return out
}

/**
 * Training load per muscle, in "effective sets".
 * `items` is [{ id, sets, entry }] — sets being a count, so a 4×8 bench press weighs four
 * times a single set.
 */
export function loadOf(items, customEx = []) {
  const load = {}
  ;(items || []).forEach(({ id, sets, entry }) => {
    if (!sets) return
    const ex = resolveExerciseMeta(id, entry, customEx)
    const m = musclesOf(ex)
    for (const slug in m) load[slug] = (load[slug] || 0) + m[slug] * sets
  })
  return load
}

/**
 * Load for finished workouts (only sets actually ticked off count). `pick` narrows that
 * further.
 */
export const loadOfWorkouts = (workouts, pick, customEx = []) =>
  loadOf((workouts || []).flatMap(w =>
    (w.entries || []).map(e => ({
      id: e.id,
      entry: e,
      sets: (e.sets || []).filter(s => s && s.done && (!pick || pick(s))).length
    }))), customEx)

/** Load a routine *would* produce, from its planned set counts. */
export const loadOfRoutine = (routine, customEx = []) =>
  loadOf((routine?.ex || []).map(c => ({ id: c.id, entry: c, sets: c.sets || 1 })), customEx)

/** Load for a workout still in progress — the sets ticked so far. */
export const loadOfActive = (active, customEx = []) =>
  loadOf((active?.entries || []).map(e => ({
    id: e.id,
    entry: e,
    sets: (e.sets || []).filter(s => s && s.done).length
  })), customEx)

/**
 * Shade buckets 0–4 per muscle, relative to the hardest-worked muscle in the same
 * window. Relative rather than absolute on purpose: the map answers "is my training
 * balanced", which only means anything as a comparison within one period.
 */
export function levelsOf(load) {
  const max = Math.max(0, ...MUSCLES.map(m => load[m] || 0))
  const lv = {}
  MUSCLES.forEach(m => {
    const v = load[m] || 0
    lv[m] = !v ? 0 : max <= 0 ? 0 : Math.max(1, Math.min(4, Math.ceil(v / max * 4)))
  })
  return lv
}

/** Muscles sorted hardest-worked first; untrained ones last, in body order. */
export function rankOf(load) {
  const worked = MUSCLES.filter(m => (load[m] || 0) > 0).sort((a, b) => load[b] - load[a])
  const missed = MUSCLES.filter(m => !(load[m] > 0))
  return { worked, missed }
}
