import { describe, it, expect } from 'vitest'
import {
  LIBRARY_CATEGORIES,
  INITIAL_PREDEFINED_EXERCISES,
  getExerciseLibrary,
  isDuplicateExerciseName,
  DEFAULT_WEEKLY_SCHEDULE,
  buildDefaultPlannerState,
  PREDEFINED_WORKOUT_GROUPS,
  DEFAULT_WORKOUT_TEMPLATES,
  getWorkoutTemplates,
  loadWorkoutTemplate,
  saveWorkoutTemplate,
  createSessionFromTemplate,
  saveSessionChangesToTemplate,
  CARDIO_ACTIVITIES,
  calculateCardioMetrics,
  getTodayDisplayDate
} from './customPlanner.js'

describe('Custom Workout Planner & Exercise Library Engine', () => {
  it('contains all 8 required categories and exact sample exercises', () => {
    expect(LIBRARY_CATEGORIES).toEqual([
      'Shoulder',
      'Chest',
      'Triceps',
      'Back',
      'Biceps',
      'Legs',
      'Core / Abs',
      'Cardio'
    ])

    const byCat = {}
    INITIAL_PREDEFINED_EXERCISES.forEach(e => {
      byCat[e.category] = byCat[e.category] || []
      byCat[e.category].push(e.name)
    })

    // Shoulder verification
    expect(byCat['Shoulder']).toContain('Dumbbell Shoulder Press')
    expect(byCat['Shoulder']).toContain('Lateral Raise')
    expect(byCat['Shoulder']).toContain('Rear Delt Fly')
    expect(byCat['Shoulder']).toContain('Face Pull')

    // Chest verification
    expect(byCat['Chest']).toContain('Bench Press')
    expect(byCat['Chest']).toContain('Incline Dumbbell Press')
    expect(byCat['Chest']).toContain('Chest Fly')

    // Triceps verification
    expect(byCat['Triceps']).toContain('Triceps Pushdown')
    expect(byCat['Triceps']).toContain('Overhead Triceps Extension')

    // Back verification
    expect(byCat['Back']).toContain('Lat Pulldown')
    expect(byCat['Back']).toContain('Seated Cable Row')
    expect(byCat['Back']).toContain('Bent Over Row')

    // Biceps verification
    expect(byCat['Biceps']).toContain('Dumbbell Curl')
    expect(byCat['Biceps']).toContain('Hammer Curl')

    // Legs verification
    expect(byCat['Legs']).toContain('Squat')
    expect(byCat['Legs']).toContain('Leg Press')
    expect(byCat['Legs']).toContain('Leg Curl')
    expect(byCat['Legs']).toContain('Calf Raise')

    // Core / Abs verification
    expect(byCat['Core / Abs']).toContain('Plank')
    expect(byCat['Core / Abs']).toContain('Leg Raise')

    // Cardio verification
    expect(byCat['Cardio']).toContain('Walking')
    expect(byCat['Cardio']).toContain('Running')
    expect(byCat['Cardio']).toContain('Jogging')
  })

  it('defines the 6 required predefined workout groups', () => {
    expect(PREDEFINED_WORKOUT_GROUPS.length).toBe(6)
    expect(PREDEFINED_WORKOUT_GROUPS[0].name).toBe('Shoulder')
    expect(PREDEFINED_WORKOUT_GROUPS[1].name).toBe('Chest + Triceps')
    expect(PREDEFINED_WORKOUT_GROUPS[2].name).toBe('Back + Biceps')
    expect(PREDEFINED_WORKOUT_GROUPS[3].name).toBe('Legs + Core')
    expect(PREDEFINED_WORKOUT_GROUPS[4].name).toBe('Cardio')
    expect(PREDEFINED_WORKOUT_GROUPS[5].name).toBe('Cardio')

    expect(CARDIO_ACTIVITIES).toEqual(['Walking', 'Running', 'Jogging'])
  })

  it('defines exact suggested templates for all 4 strength groups', () => {
    // 1. Shoulder Template
    const shoulder = DEFAULT_WORKOUT_TEMPLATES.shoulder
    expect(shoulder).toBeDefined()
    expect(shoulder.exercises).toEqual([
      { id: 'lib_sh_db_press', name: 'Dumbbell Shoulder Press', sets: 4, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_sh_lat_raise', name: 'Lateral Raise', sets: 3, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_sh_rear_fly', name: 'Rear Delt Fly', sets: 3, reps: 12, weight: 0, rest: 60 },
      { id: 'lib_sh_face_pull', name: 'Face Pull', sets: 3, reps: 15, weight: 0, rest: 60 }
    ])

    // 2. Chest + Triceps Template
    const chestTriceps = DEFAULT_WORKOUT_TEMPLATES.chest_triceps
    expect(chestTriceps).toBeDefined()
    expect(chestTriceps.exercises).toEqual([
      { id: 'lib_ch_bench_press', name: 'Bench Press', sets: 4, reps: 10, weight: 0, rest: 90 },
      { id: 'lib_ch_inc_db_press', name: 'Incline Dumbbell Press', sets: 3, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_ch_chest_fly', name: 'Chest Fly', sets: 3, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_tri_pushdown', name: 'Triceps Pushdown', sets: 3, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_tri_oh_ext', name: 'Overhead Triceps Extension', sets: 3, reps: 12, weight: 0, rest: 60 }
    ])

    // 3. Back + Biceps Template
    const backBiceps = DEFAULT_WORKOUT_TEMPLATES.back_biceps
    expect(backBiceps).toBeDefined()
    expect(backBiceps.exercises).toEqual([
      { id: 'lib_bk_lat_pulldown', name: 'Lat Pulldown', sets: 4, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_bk_seated_row', name: 'Seated Cable Row', sets: 3, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_bk_bent_over_row', name: 'Bent Over Row', sets: 3, reps: 10, weight: 0, rest: 90 },
      { id: 'lib_bi_db_curl', name: 'Dumbbell Curl', sets: 3, reps: 12, weight: 0, rest: 60 },
      { id: 'lib_bi_hammer_curl', name: 'Hammer Curl', sets: 3, reps: 12, weight: 0, rest: 60 }
    ])

    // 4. Legs + Core Template
    const legsCore = DEFAULT_WORKOUT_TEMPLATES.legs_core
    expect(legsCore).toBeDefined()
    expect(legsCore.exercises).toEqual([
      { id: 'lib_leg_squat_single', name: 'Squat', sets: 4, reps: 10, weight: 0, rest: 120 },
      { id: 'lib_leg_press', name: 'Leg Press', sets: 3, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_leg_curl', name: 'Leg Curl', sets: 3, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_leg_calf_raise_single', name: 'Calf Raise', sets: 4, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_core_plank', name: 'Plank', sets: 3, reps: 60, weight: 0, rest: 60, type: 'timed' },
      { id: 'lib_core_leg_raise_single', name: 'Leg Raise', sets: 3, reps: 15, weight: 0, rest: 45 }
    ])
  })

  it('formats today display date correctly', () => {
    // Monday Nov 16, 2026
    const testDate = new Date(2026, 10, 16) // Month index 10 = November
    const formatted = getTodayDisplayDate(testDate)
    expect(formatted.weekday).toBe('Monday')
    expect(formatted.dateFormatted).toBe('16 November')
    expect(formatted.fullDisplay).toBe('Monday, 16 November')
  })

  it('supports one-click session creation from template without mutating template', () => {
    const mockStore = { workoutTemplates: null }
    const session = createSessionFromTemplate(mockStore, 'shoulder', '2026-11-16')
    expect(session).toBeDefined()
    expect(session.name).toBe('Shoulder')
    expect(session.groupId).toBe('shoulder')
    expect(session.d).toBe('2026-11-16')
    expect(session.entries.length).toBe(4)

    // Dumbbell Shoulder Press: 4 sets of 12 reps
    expect(session.entries[0].name).toBe('Dumbbell Shoulder Press')
    expect(session.entries[0].sets.length).toBe(4)
    expect(session.entries[0].sets[0].r).toBe(12)
    expect(session.entries[0].sets[0].done).toBe(false)

    // Verify original template is untouched
    const tpl = loadWorkoutTemplate(mockStore, 'shoulder')
    expect(tpl.exercises[0].sets).toBe(4)
    expect(tpl.exercises[0].reps).toBe(12)
  })

  it('supports saving session modifications back to template only when explicitly triggered', () => {
    let state = { workoutTemplates: {} }
    const update = fn => fn(state)

    const activeSession = {
      id: 'active_123',
      groupId: 'shoulder',
      name: 'Shoulder',
      entries: [
        {
          id: 'lib_sh_db_press',
          name: 'Dumbbell Shoulder Press',
          sets: [
            { r: 8, w: 25, done: true },
            { r: 8, w: 25, done: true },
            { r: 8, w: 25, done: true }
          ]
        },
        {
          id: 'custom_shrug',
          name: 'Barbell Shrug',
          sets: [
            { r: 15, w: 60, done: true },
            { r: 15, w: 60, done: true }
          ]
        }
      ]
    }

    const saved = saveSessionChangesToTemplate(update, activeSession)
    expect(saved).toBe(true)
    expect(state.workoutTemplates.shoulder).toBeDefined()
    expect(state.workoutTemplates.shoulder.exercises.length).toBe(2)
    expect(state.workoutTemplates.shoulder.exercises[0].name).toBe('Dumbbell Shoulder Press')
    expect(state.workoutTemplates.shoulder.exercises[0].sets).toBe(3)
    expect(state.workoutTemplates.shoulder.exercises[0].reps).toBe(8)
    expect(state.workoutTemplates.shoulder.exercises[0].weight).toBe(25)
    expect(state.workoutTemplates.shoulder.exercises[1].name).toBe('Barbell Shrug')
  })

  it('calculates cardio duration and distance without estimating calories or steps', () => {
    const res = calculateCardioMetrics(1, 30, 8.5)
    expect(res.durationHours).toBe(1)
    expect(res.durationMinutes).toBe(30)
    expect(res.totalDurationMinutes).toBe(90)
    expect(res.distanceKm).toBe(8.5)

    // Strict constraint: no calories, steps, or HR estimated
    expect(res.caloriesBurned).toBeUndefined()
    expect(res.steps).toBeUndefined()
    expect(res.heartRate).toBeUndefined()
  })

  it('detects duplicate exercise names within the same category', () => {
    const library = [
      { id: '1', name: 'Dumbbell Shoulder Press', category: 'Shoulder' },
      { id: '2', name: 'Squats', category: 'Legs' }
    ]

    expect(isDuplicateExerciseName(library, 'Dumbbell Shoulder Press', 'Shoulder')).toBe(true)
    expect(isDuplicateExerciseName(library, 'dumbbell shoulder press', 'Shoulder')).toBe(true)
    expect(isDuplicateExerciseName(library, 'Dumbbell Shoulder Press', 'Chest')).toBe(false)
    expect(isDuplicateExerciseName(library, 'Dumbbell Shoulder Press', 'Shoulder', '1')).toBe(false)
  })

  it('supports soft-deleting an exercise without breaking foreign references', () => {
    const S = {
      libraryEx: [
        { id: 'lib_sh_face_pull', deleted: true }
      ]
    }
    const lib = getExerciseLibrary(S)
    expect(lib.some(e => e.id === 'lib_sh_face_pull')).toBe(false)
  })
})
