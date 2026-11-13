/**
 * customPlanner.js
 * Comprehensive Custom Workout Planning, Predefined Exercise Library,
 * and 6-Day Weekly Schedule (4 Strength + 2 Cardio + 1 Rest) for OpenGym.
 */

import { uid } from './format.js'
import { registerCustom } from './exercises.js'

export const LIBRARY_CATEGORIES = [
  'Shoulder',
  'Chest',
  'Triceps',
  'Back',
  'Biceps',
  'Legs',
  'Core / Abs',
  'Cardio'
]

export const WORKOUT_TYPES = ['strength', 'cardio', 'rest', 'custom']

/**
 * Initial sample exercise library entries exactly as specified in requirements.
 */
export const INITIAL_PREDEFINED_EXERCISES = [
  // --- Shoulder ---
  {
    id: 'lib_sh_db_press',
    name: 'Dumbbell Shoulder Press',
    category: 'Shoulder',
    muscleGroup: 'Shoulder',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 90,
    description: 'Seated or standing overhead press with dumbbells targeting anterior and lateral deltoids.'
  },
  {
    id: 'lib_sh_bb_press',
    name: 'Barbell Shoulder Press',
    category: 'Shoulder',
    muscleGroup: 'Shoulder',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    description: 'Overhead barbell press for overall shoulder mass and upper chest development.'
  },
  {
    id: 'lib_sh_lat_raise',
    name: 'Lateral Raise',
    category: 'Shoulder',
    muscleGroup: 'Shoulder',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    description: 'Isolation exercise targeting the lateral deltoid head for shoulder width.'
  },
  {
    id: 'lib_sh_front_raise',
    name: 'Front Raise',
    category: 'Shoulder',
    muscleGroup: 'Shoulder',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: 'Targeted anterior deltoid exercise lifting dumbbells forward to shoulder height.'
  },
  {
    id: 'lib_sh_rear_fly',
    name: 'Rear Delt Fly',
    category: 'Shoulder',
    muscleGroup: 'Shoulder',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: 'Bent-over dumbbell fly for rear deltoid and upper back posture.'
  },
  {
    id: 'lib_sh_rev_pec_deck',
    name: 'Reverse Pec Deck',
    category: 'Shoulder',
    muscleGroup: 'Shoulder',
    type: 'strength',
    equipment: 'Machine',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: 'Machine fly targeting posterior deltoids and rhomboids.'
  },
  {
    id: 'lib_sh_face_pull',
    name: 'Face Pull',
    category: 'Shoulder',
    muscleGroup: 'Shoulder',
    type: 'strength',
    equipment: 'Cable',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    description: 'Cable rope pull to face height for rotator cuff health and rear deltoid growth.'
  },
  {
    id: 'lib_sh_shrugs',
    name: 'Shrugs',
    category: 'Shoulder',
    muscleGroup: 'Shoulder',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    description: 'Vertical elevation of shoulder girdle to build the upper trapezius.'
  },

  // --- Chest ---
  {
    id: 'lib_ch_flat_bench',
    name: 'Flat Bench Press',
    category: 'Chest',
    muscleGroup: 'Chest',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    description: 'Foundational horizontal press for overall pectoralis major mass.'
  },
  {
    id: 'lib_ch_inc_db_press',
    name: 'Incline Dumbbell Press',
    category: 'Chest',
    muscleGroup: 'Chest',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 90,
    description: 'Press on 30-degree incline targeting clavicular head of the chest.'
  },
  {
    id: 'lib_ch_inc_bb_press',
    name: 'Incline Barbell Press',
    category: 'Chest',
    muscleGroup: 'Chest',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    description: 'Compound incline barbell movement building upper chest thickness.'
  },
  {
    id: 'lib_ch_dec_bench',
    name: 'Decline Bench Press',
    category: 'Chest',
    muscleGroup: 'Chest',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    description: 'Decline barbell press emphasizing the lower pectoral fibres.'
  },
  {
    id: 'lib_ch_chest_fly',
    name: 'Chest Fly',
    category: 'Chest',
    muscleGroup: 'Chest',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: 'Dumbbell adduction exercise emphasizing pectoral stretch and contraction.'
  },
  {
    id: 'lib_ch_cable_crossover',
    name: 'Cable Crossover',
    category: 'Chest',
    muscleGroup: 'Chest',
    type: 'strength',
    equipment: 'Cable',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    description: 'High-to-low or low-to-high cable movement maintaining continuous pectoral tension.'
  },
  {
    id: 'lib_ch_push_ups',
    name: 'Push-ups',
    category: 'Chest',
    muscleGroup: 'Chest',
    type: 'bodyweight',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    description: 'Classic bodyweight push targeting chest, triceps, and core stability.'
  },

  // --- Triceps ---
  {
    id: 'lib_tri_cable_pushdown',
    name: 'Cable Pushdown',
    category: 'Triceps',
    muscleGroup: 'Triceps',
    type: 'strength',
    equipment: 'Cable',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: 'Straight or V-bar pushdown focusing on triceps lateral and medial heads.'
  },
  {
    id: 'lib_tri_rope_pushdown',
    name: 'Rope Pushdown',
    category: 'Triceps',
    muscleGroup: 'Triceps',
    type: 'strength',
    equipment: 'Cable',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    description: 'Rope attachment pushdown allowing peak triceps flare at the bottom.'
  },
  {
    id: 'lib_tri_oh_ext',
    name: 'Overhead Triceps Extension',
    category: 'Triceps',
    muscleGroup: 'Triceps',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: 'Overhead extension placing maximum stretch on the triceps long head.'
  },
  {
    id: 'lib_tri_skull_crushers',
    name: 'Skull Crushers',
    category: 'Triceps',
    muscleGroup: 'Triceps',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    description: 'Lying triceps extension lowering EZ-bar or barbell towards forehead.'
  },
  {
    id: 'lib_tri_cg_bench',
    name: 'Close Grip Bench Press',
    category: 'Triceps',
    muscleGroup: 'Triceps',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    description: 'Shoulder-width grip bench press for heavy triceps overload.'
  },

  // --- Back ---
  {
    id: 'lib_bk_lat_pulldown',
    name: 'Lat Pulldown',
    category: 'Back',
    muscleGroup: 'Back',
    type: 'strength',
    equipment: 'Cable',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 90,
    description: 'Cable vertical pull building latissimus dorsi width.'
  },
  {
    id: 'lib_bk_pull_ups',
    name: 'Pull-ups',
    category: 'Back',
    muscleGroup: 'Back',
    type: 'bodyweight',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: 8,
    defaultRestSec: 90,
    description: 'Overhand bodyweight vertical pull for supreme upper-body pulling strength.'
  },
  {
    id: 'lib_bk_seated_row',
    name: 'Seated Cable Row',
    category: 'Back',
    muscleGroup: 'Back',
    type: 'strength',
    equipment: 'Cable',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 90,
    description: 'Horizontal cable pull targeting mid-back thickness and rhomboids.'
  },
  {
    id: 'lib_bk_db_row',
    name: 'One Arm Dumbbell Row',
    category: 'Back',
    muscleGroup: 'Back',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: 'Unilateral row providing deep lat stretch and balanced strength.'
  },
  {
    id: 'lib_bk_bb_row',
    name: 'Barbell Row',
    category: 'Back',
    muscleGroup: 'Back',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    description: 'Heavy bent-over compound row building entire back thickness.'
  },
  {
    id: 'lib_bk_straight_pulldown',
    name: 'Straight Arm Pulldown',
    category: 'Back',
    muscleGroup: 'Back',
    type: 'strength',
    equipment: 'Cable',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    description: 'Lat isolation movement without bicep involvement.'
  },
  {
    id: 'lib_bk_deadlift',
    name: 'Deadlift',
    category: 'Back',
    muscleGroup: 'Back',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: 6,
    defaultRestSec: 120,
    description: 'Posterior chain pillar movement building spinal erectors, lats, and glutes.'
  },

  // --- Biceps ---
  {
    id: 'lib_bi_bb_curl',
    name: 'Barbell Curl',
    category: 'Biceps',
    muscleGroup: 'Biceps',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 60,
    description: 'Classic supinated compound bicep curl with straight or EZ bar.'
  },
  {
    id: 'lib_bi_db_curl',
    name: 'Dumbbell Curl',
    category: 'Biceps',
    muscleGroup: 'Biceps',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: 'Alternating or bilateral dumbbell curl allowing natural wrist supination.'
  },
  {
    id: 'lib_bi_hammer_curl',
    name: 'Hammer Curl',
    category: 'Biceps',
    muscleGroup: 'Biceps',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: 'Neutral grip curl targeting brachialis and brachioradialis for arm thickness.'
  },
  {
    id: 'lib_bi_preacher_curl',
    name: 'Preacher Curl',
    category: 'Biceps',
    muscleGroup: 'Biceps',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 60,
    description: 'Isolated curl on preacher bench eliminating body momentum.'
  },
  {
    id: 'lib_bi_conc_curl',
    name: 'Concentration Curl',
    category: 'Biceps',
    muscleGroup: 'Biceps',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: 'Seated single-arm curl emphasizing bicep peak contraction.'
  },

  // --- Legs ---
  {
    id: 'lib_leg_squat',
    name: 'Squats',
    category: 'Legs',
    muscleGroup: 'Legs',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 4,
    defaultReps: 8,
    defaultRestSec: 120,
    description: 'The king of lower body exercises for quadriceps, hamstrings, and glutes.'
  },
  {
    id: 'lib_leg_press',
    name: 'Leg Press',
    category: 'Legs',
    muscleGroup: 'Legs',
    type: 'strength',
    equipment: 'Machine',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 90,
    description: 'Heavy machine compound leg exercise without spinal loading.'
  },
  {
    id: 'lib_leg_ext',
    name: 'Leg Extension',
    category: 'Legs',
    muscleGroup: 'Legs',
    type: 'strength',
    equipment: 'Machine',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    description: 'Quadriceps isolation machine exercise for definition.'
  },
  {
    id: 'lib_leg_curl',
    name: 'Leg Curl',
    category: 'Legs',
    muscleGroup: 'Legs',
    type: 'strength',
    equipment: 'Machine',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: 'Seated or lying hamstring isolation exercise.'
  },
  {
    id: 'lib_leg_rdl',
    name: 'Romanian Deadlift',
    category: 'Legs',
    muscleGroup: 'Legs',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    description: 'Hip hinge movement loading hamstrings and glutes in stretched position.'
  },
  {
    id: 'lib_leg_lunges',
    name: 'Lunges',
    category: 'Legs',
    muscleGroup: 'Legs',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: 'Walking or stationary lunges for unilateral leg power and balance.'
  },
  {
    id: 'lib_leg_calf_raises',
    name: 'Calf Raises',
    category: 'Legs',
    muscleGroup: 'Legs',
    type: 'strength',
    equipment: 'Machine',
    defaultSets: 4,
    defaultReps: 15,
    defaultRestSec: 60,
    description: 'Standing or seated ankle plantar flexion targeting gastrocnemius and soleus.'
  },

  // --- Core / Abs ---
  {
    id: 'lib_core_plank',
    name: 'Plank',
    category: 'Core / Abs',
    muscleGroup: 'Core / Abs',
    type: 'timed',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: 60,
    defaultRestSec: 60,
    description: 'Isometric core hold building transverse abdominis strength.'
  },
  {
    id: 'lib_core_crunches',
    name: 'Crunches',
    category: 'Core / Abs',
    muscleGroup: 'Core / Abs',
    type: 'bodyweight',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: 20,
    defaultRestSec: 45,
    description: 'Controlled spinal flexion targeting the upper rectus abdominis.'
  },
  {
    id: 'lib_core_rev_crunches',
    name: 'Reverse Crunches',
    category: 'Core / Abs',
    muscleGroup: 'Core / Abs',
    type: 'bodyweight',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 45,
    description: 'Pelvic tilt raising hips towards chest for lower abdominal focus.'
  },
  {
    id: 'lib_core_leg_raises',
    name: 'Leg Raises',
    category: 'Core / Abs',
    muscleGroup: 'Core / Abs',
    type: 'bodyweight',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 45,
    description: 'Lying or hanging leg raises targeting lower abs and hip flexors.'
  },
  {
    id: 'lib_core_bicycle',
    name: 'Bicycle Crunches',
    category: 'Core / Abs',
    muscleGroup: 'Core / Abs',
    type: 'bodyweight',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: 20,
    defaultRestSec: 45,
    description: 'Rotational abdominal movement engaging obliques and rectus abdominis.'
  },
  {
    id: 'lib_core_mountain_climbers',
    name: 'Mountain Climbers',
    category: 'Core / Abs',
    muscleGroup: 'Core / Abs',
    type: 'timed',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: 45,
    defaultRestSec: 45,
    description: 'Dynamic plank with knee drives for cardiovascular and core endurance.'
  },

  // --- Cardio ---
  {
    id: 'lib_cardio_walking',
    name: 'Walking',
    category: 'Cardio',
    muscleGroup: 'Cardio',
    type: 'cardio',
    equipment: 'None',
    defaultSets: 1,
    defaultReps: 30,
    defaultRestSec: 0,
    description: 'Low-impact steady-state walking for fat oxidation and recovery.'
  },
  {
    id: 'lib_cardio_running',
    name: 'Running',
    category: 'Cardio',
    muscleGroup: 'Cardio',
    type: 'cardio',
    equipment: 'None',
    defaultSets: 1,
    defaultReps: 30,
    defaultRestSec: 0,
    description: 'Outdoor or track running for cardiovascular stamina.'
  },
  {
    id: 'lib_cardio_cycling',
    name: 'Cycling',
    category: 'Cardio',
    muscleGroup: 'Cardio',
    type: 'cardio',
    equipment: 'Bike',
    defaultSets: 1,
    defaultReps: 30,
    defaultRestSec: 0,
    description: 'Low-impact aerobic conditioning on outdoor or stationary bicycle.'
  },
  {
    id: 'lib_cardio_treadmill',
    name: 'Treadmill',
    category: 'Cardio',
    muscleGroup: 'Cardio',
    type: 'cardio',
    equipment: 'Treadmill',
    defaultSets: 1,
    defaultReps: 30,
    defaultRestSec: 0,
    description: 'Indoor incline or speed-controlled treadmill workout.'
  },
  {
    id: 'lib_cardio_hiit',
    name: 'HIIT',
    category: 'Cardio',
    muscleGroup: 'Cardio',
    type: 'cardio',
    equipment: 'Bodyweight',
    defaultSets: 1,
    defaultReps: 20,
    defaultRestSec: 0,
    description: 'High-intensity interval bursts alternating with recovery intervals.'
  },
  {
    id: 'lib_cardio_stairs',
    name: 'Stair Climbing',
    category: 'Cardio',
    muscleGroup: 'Cardio',
    type: 'cardio',
    equipment: 'Machine',
    defaultSets: 1,
    defaultReps: 20,
    defaultRestSec: 0,
    description: 'Stair climber machine providing intensive lower-body cardiovascular burn.'
  },
  {
    id: 'lib_cardio_jump_rope',
    name: 'Jump Rope',
    category: 'Cardio',
    muscleGroup: 'Cardio',
    type: 'cardio',
    equipment: 'Rope',
    defaultSets: 1,
    defaultReps: 15,
    defaultRestSec: 0,
    description: 'Agility, coordination, and rapid calorie expenditure.'
  }
]

/**
 * Returns user's active exercise library, merging predefined sample entries with any custom user exercises.
 */
export function getExerciseLibrary(S) {
  const custom = S?.libraryEx || []
  const initialMap = new Map()
  INITIAL_PREDEFINED_EXERCISES.forEach(e => initialMap.set(e.id, { ...e, isPredefined: true }))

  // Merge custom entries
  custom.forEach(c => {
    if (c.deleted) {
      initialMap.delete(c.id)
    } else {
      initialMap.set(c.id, { ...initialMap.get(c.id), ...c })
    }
  })

  const list = Array.from(initialMap.values())

  // Also register into OpenGym's EXIDX so standard OpenGym tools (exOr) recognize them
  const openGymCustom = list.map(e => ({
    id: e.id,
    n: e.name,
    bp: e.category?.toLowerCase() || 'other',
    tg: e.muscleGroup?.toLowerCase() || '',
    eq: e.equipment?.toLowerCase() || 'dumbbell',
    desc: e.description || '',
    isCustom: true
  }))
  registerCustom(openGymCustom)

  return list
}

/**
 * Validates whether an exercise name already exists in the same category (case-insensitive).
 */
export function isDuplicateExerciseName(library, name, category, excludeId = null) {
  const normName = name.trim().toLowerCase()
  const normCat = category.trim().toLowerCase()
  return library.some(e =>
    e.id !== excludeId &&
    e.name.trim().toLowerCase() === normName &&
    (e.category || '').trim().toLowerCase() === normCat &&
    !e.deleted
  )
}

/**
 * Default 6-day split schedule specification as requested:
 * Monday — Shoulder
 * Tuesday — Chest + Triceps
 * Wednesday — Back + Biceps
 * Thursday — Legs + Core
 * Friday — Cardio
 * Saturday — Cardio
 * Sunday — Rest
 */
export const DEFAULT_WEEKLY_SCHEDULE = {
  1: {
    dayName: 'Monday',
    type: 'strength',
    muscle: 'Shoulder',
    routineName: 'Monday — Shoulder',
    defaultExerciseIds: [
      'lib_sh_db_press',
      'lib_sh_lat_raise',
      'lib_sh_rear_fly',
      'lib_sh_face_pull'
    ]
  },
  2: {
    dayName: 'Tuesday',
    type: 'strength',
    muscle: 'Chest + Triceps',
    routineName: 'Tuesday — Chest + Triceps',
    defaultExerciseIds: [
      'lib_ch_flat_bench',
      'lib_ch_inc_db_press',
      'lib_ch_cable_crossover',
      'lib_tri_cable_pushdown',
      'lib_tri_rope_pushdown'
    ]
  },
  3: {
    dayName: 'Wednesday',
    type: 'strength',
    muscle: 'Back + Biceps',
    routineName: 'Wednesday — Back + Biceps',
    defaultExerciseIds: [
      'lib_bk_lat_pulldown',
      'lib_bk_seated_row',
      'lib_bk_db_row',
      'lib_bi_bb_curl',
      'lib_bi_hammer_curl'
    ]
  },
  4: {
    dayName: 'Thursday',
    type: 'strength',
    muscle: 'Legs + Core',
    routineName: 'Thursday — Legs + Core',
    defaultExerciseIds: [
      'lib_leg_squat',
      'lib_leg_press',
      'lib_leg_curl',
      'lib_leg_calf_raises',
      'lib_core_plank',
      'lib_core_crunches'
    ]
  },
  5: {
    dayName: 'Friday',
    type: 'cardio',
    muscle: 'Cardio',
    routineName: 'Friday — Cardio',
    defaultExerciseIds: [
      'lib_cardio_treadmill',
      'lib_cardio_hiit'
    ]
  },
  6: {
    dayName: 'Saturday',
    type: 'cardio',
    muscle: 'Cardio',
    routineName: 'Saturday — Cardio',
    defaultExerciseIds: [
      'lib_cardio_cycling',
      'lib_cardio_jump_rope'
    ]
  },
  0: {
    dayName: 'Sunday',
    type: 'rest',
    muscle: 'Rest',
    routineName: 'Sunday — Rest',
    defaultExerciseIds: []
  }
}

/**
 * Initializes or resets the weekly workout planner and routines to the 6-day split.
 */
export function buildDefaultPlannerState(S) {
  const library = getExerciseLibrary(S)
  const libMap = new Map(library.map(e => [e.id, e]))

  const newRoutines = []
  const newWeek = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null }
  const scheduleDays = {}

  for (const [dayKey, daySpec] of Object.entries(DEFAULT_WEEKLY_SCHEDULE)) {
    const dNum = Number(dayKey)
    if (daySpec.type === 'rest') {
      newWeek[dNum] = null
      scheduleDays[dNum] = {
        type: 'rest',
        muscle: 'Rest',
        name: daySpec.routineName,
        routineId: null
      }
      continue
    }

    const routineId = 'r_plan_' + dNum + '_' + uid()
    const exercises = (daySpec.defaultExerciseIds || []).map(exId => {
      const ex = libMap.get(exId) || { name: exId, defaultSets: 3, defaultReps: 12, defaultRestSec: 60 }
      return {
        id: exId,
        name: ex.name,
        sets: ex.defaultSets || 3,
        reps: ex.defaultReps || 12,
        weight: 0,
        rest: ex.defaultRestSec || 60,
        notes: ''
      }
    })

    const routine = {
      id: routineId,
      name: daySpec.routineName,
      type: daySpec.type,
      muscle: daySpec.muscle,
      emoji: daySpec.type === 'cardio' ? 'heartPulse' : 'dumbbell',
      ex: exercises
    }

    newRoutines.push(routine)
    newWeek[dNum] = routineId
    scheduleDays[dNum] = {
      type: daySpec.type,
      muscle: daySpec.muscle,
      name: daySpec.routineName,
      routineId
    }
  }

  const defaultTemplate = {
    id: 'default_split_4_2_1',
    name: '6-Day Split (4 Strength + 2 Cardio)',
    description: '4 Strength, 2 Cardio, 1 Rest Day',
    days: scheduleDays,
    createdAt: new Date().toISOString()
  }

  return {
    routines: newRoutines,
    week: newWeek,
    weeklyPlanner: {
      activeTemplateId: defaultTemplate.id,
      splitMode: '4_strength_2_cardio',
      templates: [defaultTemplate]
    }
  }
}

/**
 * Ensures state has weeklyPlanner properly initialized without overwriting user data if present.
 */
export function ensureWeeklyPlannerState(S) {
  if (S.weeklyPlanner && S.weeklyPlanner.templates?.length) {
    return S
  }
  const defaults = buildDefaultPlannerState(S)
  S.weeklyPlanner = defaults.weeklyPlanner
  if (!S.routines || !S.routines.length) {
    S.routines = defaults.routines
    S.week = defaults.week
  }
  return S
}
