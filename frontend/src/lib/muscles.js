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

// Full anatomical names and view mapping for interactive muscular anatomy diagram
export const ANATOMICAL_MAP = {
  chest: { name: 'Chest / Pectorals', anatomical: 'Pectoralis Major & Minor', view: 'front', frontName: 'Pectorals' },
  deltoids: { name: 'Shoulders / Deltoids', anatomical: 'Anterior, Lateral & Posterior Deltoids', view: 'both', frontName: 'Front & Side Delts', backName: 'Rear Deltoids' },
  biceps: { name: 'Biceps', anatomical: 'Biceps Brachii', view: 'front', frontName: 'Biceps' },
  triceps: { name: 'Triceps', anatomical: 'Triceps Brachii (All Heads)', view: 'both', frontName: 'Lateral Triceps', backName: 'Triceps' },
  forearm: { name: 'Forearms', anatomical: 'Brachioradialis & Wrist Flexors', view: 'both', frontName: 'Forearms', backName: 'Forearms' },
  abs: { name: 'Abdominals', anatomical: 'Rectus Abdominis (Core)', view: 'front', frontName: 'Abdominals' },
  obliques: { name: 'Obliques', anatomical: 'Internal & External Obliques', view: 'front', frontName: 'Obliques' },
  serratus: { name: 'Serratus', anatomical: 'Serratus Anterior', view: 'front', frontName: 'Serratus' },
  'hip-flexors': { name: 'Hip Flexors', anatomical: 'Iliopsoas & TFL', view: 'front', frontName: 'Hip Flexors' },
  quadriceps: { name: 'Quadriceps', anatomical: 'Rectus Femoris & Vasti (Quads)', view: 'front', frontName: 'Quadriceps' },
  adductors: { name: 'Adductors', anatomical: 'Adductor Longus & Magnus (Inner Thigh)', view: 'both', frontName: 'Adductors', backName: 'Inner Thighs' },
  calves: { name: 'Calves', anatomical: 'Gastrocnemius & Soleus', view: 'both', frontName: 'Lower Calves', backName: 'Calves' },
  tibialis: { name: 'Shins', anatomical: 'Tibialis Anterior', view: 'front', frontName: 'Shins' },
  trapezius: { name: 'Trapezius', anatomical: 'Trapezius (Upper, Middle, Lower)', view: 'both', frontName: 'Upper Traps', backName: 'Trapezius' },
  'upper-back': { name: 'Lats & Rhomboids', anatomical: 'Latissimus Dorsi, Rhomboids & Teres', view: 'back', backName: 'Lats & Rhomboids' },
  'lower-back': { name: 'Lower Back', anatomical: 'Erector Spinae & Lumbar', view: 'back', backName: 'Lower Back' },
  gluteal: { name: 'Glutes', anatomical: 'Gluteus Maximus & Medius', view: 'back', backName: 'Glutes' },
  hamstring: { name: 'Hamstrings', anatomical: 'Biceps Femoris & Semitendinosus', view: 'back', backName: 'Hamstrings' }
}

// Every spelling that occurs in the dataset's `tg` and `sm` fields. null = not drawable.
const ALIAS = {
  // canonical slugs map to themselves
  trapezius: 'trapezius', deltoids: 'deltoids', chest: 'chest', 'upper-back': 'upper-back',
  serratus: 'serratus', biceps: 'biceps', triceps: 'triceps', forearm: 'forearm',
  abs: 'abs', obliques: 'obliques', 'lower-back': 'lower-back', gluteal: 'gluteal',
  quadriceps: 'quadriceps', hamstring: 'hamstring', adductors: 'adductors',
  'hip-flexors': 'hip-flexors', calves: 'calves', tibialis: 'tibialis',
  // primaries
  glutes: 'gluteal', delts: 'deltoids', pectorals: 'chest',
  'upper back': 'upper-back', lats: 'upper-back',
  quads: 'quadriceps', forearms: 'forearm', hamstrings: 'hamstring', spine: 'lower-back',
  traps: 'trapezius', 'serratus anterior': 'serratus',
  abductors: 'gluteal', 'levator scapulae': 'trapezius', 'cardiovascular system': null,
  // secondaries
  shoulder: 'deltoids', shoulders: 'deltoids', 'rear deltoids': 'deltoids',
  'front delts': 'deltoids', 'front deltoid': 'deltoids', 'front deltoids': 'deltoids',
  'rotator cuff': 'deltoids', core: 'abs', abdominals: 'abs',
  'lower abs': 'abs', 'upper chest': 'chest', 'hip flexors': 'hip-flexors',
  'lower back': 'lower-back', rhomboids: 'upper-back',
  back: 'upper-back', 'latissimus dorsi': 'upper-back',
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
  if (cat.includes('shoulder')) return ['triceps']
  if (cat.includes('lat') || cat.includes('pull')) return ['biceps']
  if (cat.includes('row')) return ['biceps']
  if (cat.includes('back')) return ['biceps', 'lower-back']
  if (cat.includes('bicep')) return []
  if (cat.includes('tricep')) return []
  if (cat.includes('squat')) return ['gluteal']
  if (cat.includes('deadlift') || cat.includes('rdl')) return ['gluteal']
  if (cat.includes('leg')) return ['hamstring', 'gluteal']
  if (cat.includes('core') || cat.includes('abs')) return ['obliques']
  return []
}

function mapPredefinedMeta(predefined) {
  const name = String(predefined.name || '').toLowerCase()
  const id = String(predefined.id || '').toLowerCase()
  const text = `${id} ${name}`

  if (/romanian deadlift|rdl|stiff.*deadlift/i.test(text)) {
    return { tg: 'hamstring', sm: ['gluteal'] }
  }
  if (/lat pulldown|lat pull/i.test(text)) {
    return { tg: 'upper-back', sm: ['biceps'] }
  }
  if (/barbell row|dumbbell row|cable row|t-bar row|seated row/i.test(text)) {
    return { tg: 'upper-back', sm: ['biceps'] }
  }
  if (/bench press|chest press/i.test(text)) {
    return { tg: 'chest', sm: ['triceps', 'deltoids'] }
  }
  if (/shoulder press|overhead press|military press/i.test(text)) {
    return { tg: 'deltoids', sm: ['triceps'] }
  }
  if (/squat|leg press/i.test(text)) {
    return { tg: 'quadriceps', sm: ['gluteal'] }
  }
  if (/leg curl|hamstring curl/i.test(text)) {
    return { tg: 'hamstring', sm: [] }
  }
  if (/leg extension/i.test(text)) {
    return { tg: 'quadriceps', sm: [] }
  }
  if (/calf raise/i.test(text)) {
    return { tg: 'calves', sm: [] }
  }
  if (/curl|bicep/i.test(text)) {
    return { tg: 'biceps', sm: [] }
  }
  if (/tricep|skull crusher|pushdown|extension/i.test(text)) {
    return { tg: 'triceps', sm: [] }
  }
  if (/deadlift/i.test(text)) {
    return { tg: 'lower-back', sm: ['gluteal', 'hamstring', 'upper-back'] }
  }

  const cat = String(predefined.category || '').toLowerCase()
  return {
    tg: predefined.muscleGroup?.toLowerCase() || cat || '',
    sm: mapPredefinedSecondaries(predefined.id, cat)
  }
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
      const pm = mapPredefinedMeta(predefined)
      return {
        id: predefined.id,
        n: predefined.name,
        bp: predefined.category?.toLowerCase() || 'other',
        tg: pm.tg,
        sm: pm.sm
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
      const pm = mapPredefinedMeta(foundByName)
      return {
        id: foundByName.id,
        n: foundByName.name,
        bp: foundByName.category?.toLowerCase() || 'other',
        tg: pm.tg,
        sm: pm.sm
      }
    }

    // Explicit name and variation matching
    if (/bench press|chest press|push-up|push up|dumbbell fly|cable crossover|dip|pec deck|ch_db|ch_bb|incline.*press/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'chest', tg: 'chest', sm: ['triceps', 'deltoids'] }
    }
    if (/lat pulldown|lat pull|pulldown/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'back', tg: 'upper-back', sm: ['biceps'] }
    }
    if (/barbell row|dumbbell row|cable row|t-bar row|bent-over row|bent over row/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'back', tg: 'upper-back', sm: ['biceps'] }
    }
    if (/shoulder press|overhead press|military press|arnold press|sh_db_press|sh_bb_press/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'shoulders', tg: 'deltoids', sm: ['triceps'] }
    }
    if (/lateral raise|front raise|rear delt|deltoid|sh_lat_raise|sh_front_raise|sh_rear_fly/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'shoulders', tg: 'deltoids', sm: ['trapezius'] }
    }
    if (/romanian deadlift|rdl|stiff-leg deadlift|stiff leg deadlift/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'upper legs', tg: 'hamstring', sm: ['gluteal'] }
    }
    if (/deadlift/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'back', tg: 'lower-back', sm: ['gluteal', 'hamstring', 'upper-back'] }
    }
    if (/squat|leg press|hack squat|leg_sq/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'upper legs', tg: 'quadriceps', sm: ['gluteal'] }
    }
    if (/leg extension/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'upper legs', tg: 'quadriceps', sm: [] }
    }
    if (/hamstring curl|leg curl|leg_cu/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'upper legs', tg: 'hamstring', sm: [] }
    }
    if (/calf raise|calves/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'lower legs', tg: 'calves', sm: [] }
    }
    if (/lunge|glute bridge|hip thrust/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'upper legs', tg: 'gluteal', sm: ['quadriceps', 'hamstring'] }
    }
    if (/pull-up|pull up|chin-up|back extension|face pull|bk_lat|bk_bb/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'back', tg: 'upper-back', sm: ['biceps', 'lower-back'] }
    }
    if (/bicep|curl|hammer curl|preacher|bi_bb|bi_db/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'upper arms', tg: 'biceps', sm: [] }
    }
    if (/tricep|skull crusher|pushdown|kickback|close grip bench|tri_cable|tri_db|triceps extension/i.test(name)) {
      return { id: id || name, n: entry?.name || name, bp: 'upper arms', tg: 'triceps', sm: [] }
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

/**
 * Returns clean muscle breakdown distinguishing primary and secondary muscles
 */
export function getExerciseMuscleBreakdown(id, entry = null, customEx = []) {
  const meta = resolveExerciseMeta(id, entry, customEx)
  const weights = musclesOf(meta)

  const primary = []
  const secondary = []

  const rawTg = String(meta?.tg || '').toLowerCase().trim()
  const tgSlug = ALIAS[rawTg] !== undefined ? ALIAS[rawTg] : null
  if (tgSlug && MUSCLES.includes(tgSlug)) {
    primary.push(tgSlug)
  }

  // Check weights >= 0.8
  for (const slug in weights) {
    if (weights[slug] >= 0.8 && !primary.includes(slug)) {
      primary.push(slug)
    }
  }

  // Secondary muscles from meta.sm
  if (Array.isArray(meta?.sm)) {
    meta.sm.forEach(m => {
      const raw = String(m || '').toLowerCase().trim()
      const slug = ALIAS[raw] !== undefined ? ALIAS[raw] : null
      if (slug && MUSCLES.includes(slug) && !primary.includes(slug) && !secondary.includes(slug)) {
        secondary.push(slug)
      }
    })
  }

  for (const slug in weights) {
    if (weights[slug] > 0 && weights[slug] < 0.8 && !primary.includes(slug) && !secondary.includes(slug)) {
      secondary.push(slug)
    }
  }

  return {
    meta,
    primary,
    secondary,
    primaryNames: primary.map(s => MUSCLE_NAME[s] || s),
    secondaryNames: secondary.map(s => MUSCLE_NAME[s] || s)
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

/**
 * Detailed exercise-by-exercise breakdown for a selected muscle in the chosen workouts window.
 * Returns: { muscle: slug, name: string, totalSets: number, exercises: [...] }
 */
export function muscleDetailsFor(muscleSlug, workouts, pick) {
  if (!muscleSlug || !workouts || !workouts.length) {
    return { muscle: muscleSlug, name: MUSCLE_NAME[muscleSlug] || muscleSlug, totalSets: 0, exercises: [] }
  }

  const exMap = new Map()
  let totalEffSets = 0

  for (const w of workouts) {
    for (const en of (w.entries || [])) {
      const ex = EXIDX[en.id]
      const mWeights = musclesOf(ex)
      const weightFactor = mWeights[muscleSlug] || 0
      if (weightFactor <= 0) continue

      const doneSets = (en.sets || []).filter(s => s.done && (!pick || pick(s)))
      if (!doneSets.length) continue

      const count = doneSets.length
      totalEffSets += count * weightFactor

      const repsList = doneSets.map(s => Number(s.r) || 0).filter(r => r > 0)
      const minReps = repsList.length ? Math.min(...repsList) : 0
      const maxReps = repsList.length ? Math.max(...repsList) : 0
      const repRange = minReps === maxReps ? (minReps ? String(minReps) : '') : (minReps + '–' + maxReps)

      const weightsList = doneSets.map(s => Number(s.w) || 0).filter(w => w > 0)
      const topWeight = weightsList.length ? Math.max(...weightsList) : null

      const key = en.id + '_' + (w.d || '')
      exMap.set(key, {
        id: en.id,
        name: ex ? ex.n : (en.name || 'Exercise'),
        sets: count,
        repRange,
        topWeight,
        date: w.d,
        routineName: w.name,
        isPrimary: weightFactor >= 0.8,
        factor: weightFactor
      })
    }
  }

  const list = Array.from(exMap.values()).sort((a, b) => (b.date > a.date ? 1 : -1))
  return {
    muscle: muscleSlug,
    name: MUSCLE_NAME[muscleSlug] || muscleSlug,
    totalSets: Math.round(totalEffSets * 10) / 10,
    exercises: list
  }
}