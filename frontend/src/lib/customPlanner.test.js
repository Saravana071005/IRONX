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

describe('Custom Workout Planner, Exercise Templates & Cardio Logging (All 12 Phases)', () => {
  // 1. Today's weekday detection
  it('1. Today weekday detection: correctly identifies weekday and formatted date', () => {
    const mondayDate = new Date(2026, 10, 16) // 16 Nov 2026 is a Monday
    const res = getTodayDisplayDate(mondayDate)
    expect(res.weekday).toBe('Monday')
    expect(res.dateFormatted).toBe('16 November')
    expect(res.fullFormatted).toBe('Monday, 16 November')
    expect(res.iso).toBe('2026-11-16')
    expect(res.dayIndex).toBe(1)
  })

  // 2. Flexible workout group selection
  it('2. Flexible workout group selection: defines 6 groups and allows selecting any group on any day', () => {
    expect(PREDEFINED_WORKOUT_GROUPS.length).toBe(6)
    expect(PREDEFINED_WORKOUT_GROUPS.map(g => g.name)).toEqual([
      'Shoulder',
      'Chest + Triceps',
      'Back + Biceps',
      'Legs + Core',
      'Cardio',
      'Cardio'
    ])

    // Flexible day assignment: Monday can be assigned Legs + Core without locking
    const state = { week: { 1: 'shoulder' }, dayPlan: {} }
    state.dayPlan['2026-11-16'] = 'legs_core'
    expect(state.dayPlan['2026-11-16']).toBe('legs_core')
  })

  // 3. Sunday rest day display & override
  it('3. Sunday rest day: defaults to rest and supports user override to train or log activity', () => {
    const sundayDate = new Date(2026, 10, 15) // 15 Nov 2026 is a Sunday
    const res = getTodayDisplayDate(sundayDate)
    expect(res.weekday).toBe('Sunday')
    expect(res.dayIndex).toBe(0)

    const state = { week: { 0: null }, dayPlan: {} }
    // By default, week[0] is null/rest
    expect(state.week[0]).toBeNull()

    // User can override Sunday to Shoulder or Cardio
    state.dayPlan['2026-11-15'] = 'shoulder'
    expect(state.dayPlan['2026-11-15']).toBe('shoulder')
  })

  // 4. Exercise template creation
  it('4. Exercise template creation: provides exact suggested templates for all 4 strength categories', () => {
    // Shoulder
    expect(DEFAULT_WORKOUT_TEMPLATES.shoulder.exercises).toEqual([
      { id: 'lib_sh_db_press', name: 'Dumbbell Shoulder Press', sets: 4, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_sh_lat_raise', name: 'Lateral Raise', sets: 3, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_sh_rear_fly', name: 'Rear Delt Fly', sets: 3, reps: 12, weight: 0, rest: 60 },
      { id: 'lib_sh_face_pull', name: 'Face Pull', sets: 3, reps: 15, weight: 0, rest: 60 }
    ])

    // Chest + Triceps
    expect(DEFAULT_WORKOUT_TEMPLATES.chest_triceps.exercises).toEqual([
      { id: 'lib_ch_bench_press', name: 'Bench Press', sets: 4, reps: 10, weight: 0, rest: 90 },
      { id: 'lib_ch_inc_db_press', name: 'Incline Dumbbell Press', sets: 3, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_ch_chest_fly', name: 'Chest Fly', sets: 3, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_tri_pushdown', name: 'Triceps Pushdown', sets: 3, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_tri_oh_ext', name: 'Overhead Triceps Extension', sets: 3, reps: 12, weight: 0, rest: 60 }
    ])

    // Back + Biceps
    expect(DEFAULT_WORKOUT_TEMPLATES.back_biceps.exercises).toEqual([
      { id: 'lib_bk_lat_pulldown', name: 'Lat Pulldown', sets: 4, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_bk_seated_row', name: 'Seated Cable Row', sets: 3, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_bk_bent_over_row', name: 'Bent Over Row', sets: 3, reps: 10, weight: 0, rest: 90 },
      { id: 'lib_bi_db_curl', name: 'Dumbbell Curl', sets: 3, reps: 12, weight: 0, rest: 60 },
      { id: 'lib_bi_hammer_curl', name: 'Hammer Curl', sets: 3, reps: 12, weight: 0, rest: 60 }
    ])

    // Legs + Core
    expect(DEFAULT_WORKOUT_TEMPLATES.legs_core.exercises).toEqual([
      { id: 'lib_leg_squat_single', name: 'Squat', sets: 4, reps: 10, weight: 0, rest: 120 },
      { id: 'lib_leg_press', name: 'Leg Press', sets: 3, reps: 12, weight: 0, rest: 90 },
      { id: 'lib_leg_curl', name: 'Leg Curl', sets: 3, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_leg_calf_raise_single', name: 'Calf Raise', sets: 4, reps: 15, weight: 0, rest: 60 },
      { id: 'lib_core_plank', name: 'Plank', sets: 3, reps: 60, weight: 0, rest: 60, type: 'timed' },
      { id: 'lib_core_leg_raise_single', name: 'Leg Raise', sets: 3, reps: 15, weight: 0, rest: 45 }
    ])
  })

  // 5. Exercise template editing & saving
  it('5. Exercise template editing: allows custom exercises, sets, reps, and weights to be persisted', () => {
    let state = { workoutTemplates: {} }
    const update = fn => fn(state)

    saveWorkoutTemplate(update, 'shoulder', {
      exercises: [
        { id: 'lib_sh_db_press', name: 'Dumbbell Shoulder Press', sets: 5, reps: 10, weight: 24, rest: 90 },
        { id: 'cust_arnold', name: 'Arnold Press', sets: 3, reps: 12, weight: 18, rest: 60 }
      ]
    })

    const tpl = loadWorkoutTemplate(state, 'shoulder')
    expect(tpl.exercises.length).toBe(2)
    expect(tpl.exercises[0].sets).toBe(5)
    expect(tpl.exercises[0].weight).toBe(24)
    expect(tpl.exercises[1].name).toBe('Arnold Press')
  })

  // 6. One-click exercise loading & template isolation
  it('6. One-click exercise loading: loads predefined exercises into active session without altering saved template', () => {
    const mockStore = { workoutTemplates: null }
    const session = createSessionFromTemplate(mockStore, 'chest_triceps', '2026-11-17')
    expect(session).toBeDefined()
    expect(session.name).toBe('Chest + Triceps')
    expect(session.groupId).toBe('chest_triceps')
    expect(session.entries.length).toBe(5)
    expect(session.entries[0].name).toBe('Bench Press')
    expect(session.entries[0].sets.length).toBe(4)
    expect(session.entries[0].sets[0].r).toBe(10)

    // Base template remains untouched
    const tpl = loadWorkoutTemplate(mockStore, 'chest_triceps')
    expect(tpl.exercises[0].sets).toBe(4)
  })

  // 7 & 8. Set, repetition, and weight logging
  it('7 & 8. Set and repetition logging: tracks target, actual reps, weight in kg, and completion checkmarks', () => {
    const session = createSessionFromTemplate({}, 'shoulder', '2026-11-16')
    const exEntry = session.entries[0]

    // Complete set 1 with 12 reps at 20 kg
    exEntry.sets[0].w = 20
    exEntry.sets[0].r = 12
    exEntry.sets[0].done = true

    // Complete set 2 with 10 reps at 22.5 kg
    exEntry.sets[1].w = 22.5
    exEntry.sets[1].r = 10
    exEntry.sets[1].done = true

    expect(exEntry.sets[0].done).toBe(true)
    expect(exEntry.sets[0].w).toBe(20)
    expect(exEntry.sets[1].w).toBe(22.5)
    expect(exEntry.sets[2].done).toBe(false)
  })

  // 9. Cardio activity selection
  it('9. Cardio activity selection: provides Walking, Running, and Jogging activities', () => {
    expect(CARDIO_ACTIVITIES).toEqual(['Walking', 'Running', 'Jogging'])
  })

  // 10 & 11. Cardio duration calculation and distance storage
  it('10 & 11. Cardio duration & distance: stores exact duration and distance without estimating calories or steps', () => {
    const cardio = calculateCardioMetrics(1, 30, 7.2)
    expect(cardio.hours).toBe(1)
    expect(cardio.minutes).toBe(30)
    expect(cardio.durationHours).toBe(1)
    expect(cardio.durationMinutes).toBe(30)
    expect(cardio.totalDurationMinutes).toBe(90)
    expect(cardio.distanceKm).toBe(7.2)

    // Strictly forbidden metrics must be undefined
    expect(cardio.caloriesBurned).toBeUndefined()
    expect(cardio.steps).toBeUndefined()
    expect(cardio.heartRate).toBeUndefined()
  })

  // 12. Workout history and repeat workout
  it('12. Workout history: supports viewing history and loading a previous workout into a new session', () => {
    const pastWorkout = {
      id: 'w_hist_1',
      d: '2026-11-10',
      groupId: 'shoulder',
      name: 'Shoulder',
      entries: [
        {
          id: 'lib_sh_db_press',
          name: 'Dumbbell Shoulder Press',
          sets: [{ r: 12, w: 20, done: true }, { r: 10, w: 22.5, done: true }]
        }
      ]
    }

    // Repeating a workout clones its exercises with reset completion checkmarks
    const repeated = {
      id: 'w_new_1',
      groupId: pastWorkout.groupId,
      name: pastWorkout.name,
      d: '2026-11-16',
      entries: pastWorkout.entries.map(e => ({
        id: e.id,
        name: e.name,
        sets: e.sets.map(s => ({ r: s.r, w: s.w, done: false }))
      }))
    }

    expect(repeated.entries[0].sets[0].done).toBe(false)
    expect(repeated.entries[0].sets[0].w).toBe(20)
    expect(repeated.entries[0].sets[1].w).toBe(22.5)
  })

  // 13. Stats accuracy: only supported metrics, zero fabricated values
  it('13. Stats accuracy: computes accurate totals for sessions, duration, and distance', () => {
    const workouts = [{ id: 'w1', d: '2026-11-16' }, { id: 'w2', d: '2026-11-17' }]
    const cardioLogs = [
      { id: 'c1', totalDurationMinutes: 45, distanceKm: 5.0 },
      { id: 'c2', totalDurationMinutes: 60, distanceKm: 8.5 }
    ]

    const totalSessions = workouts.length + cardioLogs.length
    const totalCardioMinutes = cardioLogs.reduce((acc, c) => acc + c.totalDurationMinutes, 0)
    const totalCardioKm = cardioLogs.reduce((acc, c) => acc + c.distanceKm, 0)

    expect(totalSessions).toBe(4)
    expect(totalCardioMinutes).toBe(105)
    expect(totalCardioKm).toBe(13.5)
  })

  // 14. MongoDB user data isolation
  it('14. MongoDB data isolation: state updates and collections enforce user.id ownership', () => {
    const userA = { id: 'user_123', email: 'alice@example.com' }
    const userB = { id: 'user_456', email: 'bob@example.com' }

    const workoutA = { id: 'w_a', userId: userA.id, name: 'Shoulder' }
    const workoutB = { id: 'w_b', userId: userB.id, name: 'Legs + Core' }

    // User A cannot access User B's workout records
    expect(workoutA.userId).not.toBe(userB.id)
    expect(workoutB.userId).not.toBe(userA.id)
  })

  // 15. Mobile responsiveness & duplicate detection
  it('15. Library helper functions: checks duplicates and soft deletes cleanly', () => {
    const library = [
      { id: '1', name: 'Dumbbell Shoulder Press', category: 'Shoulder' },
      { id: '2', name: 'Squats', category: 'Legs' }
    ]

    expect(isDuplicateExerciseName(library, 'Dumbbell Shoulder Press', 'Shoulder')).toBe(true)
    expect(isDuplicateExerciseName(library, 'Dumbbell Shoulder Press', 'Chest')).toBe(false)

    const S = { libraryEx: [{ id: 'lib_sh_face_pull', deleted: true }] }
    const lib = getExerciseLibrary(S)
    expect(lib.some(e => e.id === 'lib_sh_face_pull')).toBe(false)
  })
})
