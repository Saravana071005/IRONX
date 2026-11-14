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
 * 6 Predefined Workout Groups as required:
 * 1. Shoulder
 * 2. Chest + Triceps
 * 3. Back + Biceps
 * 4. Legs + Core
 * 5. Cardio
 * 6. Cardio
 */
export const PREDEFINED_WORKOUT_GROUPS = [
  { id: 'shoulder', name: 'Shoulder', type: 'strength', category: 'Shoulder', emoji: 'dumbbell', color: 'var(--blue)' },
  { id: 'chest_triceps', name: 'Chest + Triceps', type: 'strength', category: 'Chest + Triceps', emoji: 'dumbbell', color: 'var(--coral)' },
  { id: 'back_biceps', name: 'Back + Biceps', type: 'strength', category: 'Back + Biceps', emoji: 'dumbbell', color: 'var(--teal)' },
  { id: 'legs_core', name: 'Legs + Core', type: 'strength', category: 'Legs + Core', emoji: 'dumbbell', color: 'var(--purple)' },
  { id: 'cardio_1', name: 'Cardio', type: 'cardio', category: 'Cardio', emoji: 'figureRun', color: 'var(--mint)' },
  { id: 'cardio_2', name: 'Cardio', type: 'cardio', category: 'Cardio', emoji: 'figureRun', color: 'var(--mint)' }
]

/**
 * Initial suggested editable exercise templates for each strength category.
 */
export const DEFAULT_WORKOUT_TEMPLATES = {
  shoulder: {
    id: 'shoulder',
    name: 'Shoulder',
    category: 'Shoulder',
    type: 'strength',
    emoji: 'dumbbell',
    exercises: [
      { id: 'lib_sh_db_press', name: 'Dumbbell Shoulder Press', sets: 4, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_sh_lat_raise', name: 'Lateral Raise', sets: 3, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_sh_rear_fly', name: 'Rear Delt Fly', sets: 3, reps: 12, weight: 0, rest: 60 },
      { id: 'lib_sh_face_pull', name: 'Face Pull', sets: 3, reps: 15, weight: 0, rest: 60 }
    ]
  },
  chest_triceps: {
    id: 'chest_triceps',
    name: 'Chest + Triceps',
    category: 'Chest + Triceps',
    type: 'strength',
    emoji: 'dumbbell',
    exercises: [
      { id: 'lib_ch_bench_press', name: 'Bench Press', sets: 4, reps: 10, weight: 0, rest: 90 },
      { id: 'lib_ch_inc_db_press', name: 'Incline Dumbbell Press', sets: 3, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_ch_chest_fly', name: 'Chest Fly', sets: 3, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_tri_pushdown', name: 'Triceps Pushdown', sets: 3, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_tri_oh_ext', name: 'Overhead Triceps Extension', sets: 3, reps: 12, weight: 0, rest: 60 }
    ]
  },
  back_biceps: {
    id: 'back_biceps',
    name: 'Back + Biceps',
    category: 'Back + Biceps',
    type: 'strength',
    emoji: 'dumbbell',
    exercises: [
      { id: 'lib_bk_lat_pulldown', name: 'Lat Pulldown', sets: 4, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_bk_seated_row', name: 'Seated Cable Row', sets: 3, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_bk_bent_over_row', name: 'Bent Over Row', sets: 3, reps: 10, weight: 0, rest: 90 },
      { id: 'lib_bi_db_curl', name: 'Dumbbell Curl', sets: 3, reps: 12, weight: 0, rest: 60 },
      { id: 'lib_bi_hammer_curl', name: 'Hammer Curl', sets: 3, reps: 12, weight: 0, rest: 60 }
    ]
  },
  legs_core: {
    id: 'legs_core',
    name: 'Legs + Core',
    category: 'Legs + Core',
    type: 'strength',
    emoji: 'dumbbell',
    exercises: [
      { id: 'lib_leg_squat_single', name: 'Squat', sets: 4, reps: 10, weight: 0, rest: 120 },
      { id: 'lib_leg_press', name: 'Leg Press', sets: 3, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_leg_curl', name: 'Leg Curl', sets: 3, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_leg_calf_raise_single', name: 'Calf Raise', sets: 4, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_core_plank', name: 'Plank', sets: 3, reps: 60, weight: 0, rest: 60, type: 'timed' },
      { id: 'lib_core_leg_raise_single', name: 'Leg Raise', sets: 3, reps: 15, weight: 0, rest: 45 }
    ]
  }
}

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
    defaultSets: 4,
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
    id: 'lib_ch_bench_press',
    name: 'Bench Press',
    category: 'Chest',
    muscleGroup: 'Chest',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 4,
    defaultReps: 10,
    defaultRestSec: 90,
    description: 'Foundational barbell horizontal press for upper body strength and chest development.'
  },
  {
    id: 'lib_ch_flat_bench',
    name: 'Flat Bench Press',
    category: 'Chest',
    muscleGroup: 'Chest',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 4,
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
    defaultReps: 15,
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
    id: 'lib_tri_pushdown',
    name: 'Triceps Pushdown',
    category: 'Triceps',
    muscleGroup: 'Triceps',
    type: 'strength',
    equipment: 'Cable',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 60,
    description: 'Triceps pushdown targeting the lateral and medial heads.'
  },
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
    defaultSets: 4,
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
    id: 'lib_bk_bent_over_row',
    name: 'Bent Over Row',
    category: 'Back',
    muscleGroup: 'Back',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 3,
    defaultReps: 10,
    defaultRestSec: 90,
    description: 'Bent over row building latissimus dorsi, rhomboids, and lower back stability.'
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
    id: 'lib_leg_squat_single',
    name: 'Squat',
    category: 'Legs',
    muscleGroup: 'Legs',
    type: 'strength',
    equipment: 'Barbell',
    defaultSets: 4,
    defaultReps: 10,
    defaultRestSec: 120,
    description: 'Foundational compound barbell squat for lower body strength and hypertrophy.'
  },
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
    defaultReps: 15,
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
    id: 'lib_leg_calf_raise_single',
    name: 'Calf Raise',
    category: 'Legs',
    muscleGroup: 'Legs',
    type: 'strength',
    equipment: 'Machine',
    defaultSets: 4,
    defaultReps: 15,
    defaultRestSec: 60,
    description: 'Targeted calf raise building ankle stability and gastrocnemius power.'
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
    id: 'lib_core_leg_raise_single',
    name: 'Leg Raise',
    category: 'Core / Abs',
    muscleGroup: 'Core / Abs',
    type: 'bodyweight',
    equipment: 'Bodyweight',
    defaultSets: 3,
    defaultReps: 15,
    defaultRestSec: 45,
    description: 'Controlled leg raises targeting lower abdominals and hip flexor strength.'
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
    id: 'lib_cardio_jogging',
    name: 'Jogging',
    category: 'Cardio',
    muscleGroup: 'Cardio',
    type: 'cardio',
    equipment: 'None',
    defaultSets: 1,
    defaultReps: 30,
    defaultRestSec: 0,
    description: 'Moderate-intensity continuous jogging for cardiovascular health and endurance.'
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

/**
 * Returns the active workout templates for the 4 strength groups,
 * falling back to DEFAULT_WORKOUT_TEMPLATES if none are custom saved.
 */
export function getWorkoutTemplates(S) {
  const userTemplates = S?.workoutTemplates || {}
  const res = {}
  for (const [key, defTpl] of Object.entries(DEFAULT_WORKOUT_TEMPLATES)) {
    if (userTemplates[key]) {
      res[key] = {
        ...defTpl,
        ...userTemplates[key],
        exercises: userTemplates[key].exercises ? [...userTemplates[key].exercises] : [...defTpl.exercises]
      }
    } else {
      res[key] = JSON.parse(JSON.stringify(defTpl))
    }
  }
  return res
}

/**
 * Retrieves a single workout template by group ID ('shoulder', 'chest_triceps', etc.).
 */
export function loadWorkoutTemplate(S, groupId) {
  const all = getWorkoutTemplates(S)
  return all[groupId] || DEFAULT_WORKOUT_TEMPLATES[groupId] || null
}

/**
 * Persists an edited workout template for a specific strength group.
 */
export function saveWorkoutTemplate(update, groupId, templateData) {
  update(s => {
    s.workoutTemplates = s.workoutTemplates || {}
    const base = DEFAULT_WORKOUT_TEMPLATES[groupId] || {}
    s.workoutTemplates[groupId] = {
      ...base,
      ...(s.workoutTemplates[groupId] || {}),
      ...templateData,
      updatedAt: new Date().toISOString()
    }
  })
}

/**
 * Creates an active workout session object from a saved template without overwriting the template.
 */
export function createSessionFromTemplate(S, groupId, dateStr = null) {
  const tpl = loadWorkoutTemplate(S, groupId)
  if (!tpl) return null

  const targetDate = dateStr || todayISO()
  const entries = (tpl.exercises || []).map(ex => {
    const count = Number(ex.sets) || 3
    const isTimed = ex.type === 'timed' || (ex.name || '').toLowerCase().includes('plank')
    const sets = []
    for (let i = 0; i < count; i++) {
      if (isTimed) {
        sets.push({ sec: Number(ex.reps) || 60, w: Number(ex.weight) || 0, done: false })
      } else {
        sets.push({ r: Number(ex.reps) || 10, w: Number(ex.weight) || 0, done: false })
      }
    }
    return {
      id: ex.id,
      name: ex.name,
      target: {
        reps: Number(ex.reps) || 10,
        sets: count,
        weight: Number(ex.weight) || 0,
        sec: isTimed ? (Number(ex.reps) || 60) : undefined
      },
      sets
    }
  })

  return {
    id: 'w_' + uid(),
    routineId: 'tpl_' + groupId,
    groupId,
    name: tpl.name,
    category: tpl.category,
    type: 'strength',
    d: targetDate,
    start: Date.now(),
    cur: 0,
    entries
  }
}

/**
 * Explicit action: saves changes made during a live session back to the group's exercise template.
 */
export function saveSessionChangesToTemplate(update, activeSession) {
  if (!activeSession || !activeSession.groupId) return false
  const groupId = activeSession.groupId
  const newExercises = (activeSession.entries || []).map(e => {
    const firstSet = e.sets?.[0] || {}
    const isTimed = firstSet.sec != null || (e.name || '').toLowerCase().includes('plank')
    return {
      id: e.id,
      name: e.target?.name || e.name || e.id,
      sets: e.sets?.length || 3,
      reps: isTimed ? (firstSet.sec || 60) : (firstSet.r || e.target?.reps || 10),
      weight: firstSet.w || e.target?.weight || 0,
      type: isTimed ? 'timed' : 'strength'
    }
  })

  update(s => {
    s.workoutTemplates = s.workoutTemplates || {}
    const base = DEFAULT_WORKOUT_TEMPLATES[groupId] || {}
    s.workoutTemplates[groupId] = {
      ...base,
      ...(s.workoutTemplates[groupId] || {}),
      exercises: newExercises,
      updatedAt: new Date().toISOString()
    }
  })
  return true
}

/**
 * Dedicated Cardio Activities list.
 */
export const CARDIO_ACTIVITIES = ['Walking', 'Running', 'Jogging']

/**
 * Dedicated Cardio Metrics calculation:
 * Strict rule: calculates ONLY duration and distance covered.
 * Does NOT estimate calories burned, steps, heart rate, or unsupported metrics.
 */
export function calculateCardioMetrics(hours, minutes, distanceKm) {
  const h = Math.max(0, parseInt(hours, 10) || 0)
  const m = Math.max(0, parseInt(minutes, 10) || 0)
  const totalDurationMinutes = h * 60 + m
  const dist = Math.max(0, parseFloat(distanceKm) || 0)
  return {
    hours: h,
    minutes: m,
    durationHours: h,
    durationMinutes: m,
    totalDurationMinutes,
    distanceKm: Math.round(dist * 100) / 100
  }
}

/**
 * Identifies and formats today's actual weekday and date (e.g. "Monday, 16 November").
 */
export function getTodayDisplayDate(targetDate = new Date()) {
  const d = typeof targetDate === 'string'
    ? (targetDate.includes('T') ? new Date(targetDate) : new Date(targetDate + 'T00:00:00'))
    : targetDate
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const weekday = weekdays[d.getDay()]
  const dayNum = d.getDate()
  const month = months[d.getMonth()]
  const dateFormatted = `${dayNum} ${month}`
  const fullFormatted = `${weekday}, ${dateFormatted}`
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { weekday, dayNum, month, dateFormatted, fullFormatted, fullDisplay: fullFormatted, iso, dayIndex: d.getDay() }
}
