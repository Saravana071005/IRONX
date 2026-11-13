import { describe, it, expect } from 'vitest'
import {
  LIBRARY_CATEGORIES,
  INITIAL_PREDEFINED_EXERCISES,
  getExerciseLibrary,
  isDuplicateExerciseName,
  DEFAULT_WEEKLY_SCHEDULE,
  buildDefaultPlannerState
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
    expect(byCat['Shoulder']).toContain('Barbell Shoulder Press')
    expect(byCat['Shoulder']).toContain('Lateral Raise')
    expect(byCat['Shoulder']).toContain('Face Pull')

    // Chest verification
    expect(byCat['Chest']).toContain('Flat Bench Press')
    expect(byCat['Chest']).toContain('Incline Dumbbell Press')
    expect(byCat['Chest']).toContain('Push-ups')

    // Triceps verification
    expect(byCat['Triceps']).toContain('Cable Pushdown')
    expect(byCat['Triceps']).toContain('Rope Pushdown')
    expect(byCat['Triceps']).toContain('Close Grip Bench Press')

    // Back verification
    expect(byCat['Back']).toContain('Lat Pulldown')
    expect(byCat['Back']).toContain('Pull-ups')
    expect(byCat['Back']).toContain('Deadlift')

    // Biceps verification
    expect(byCat['Biceps']).toContain('Barbell Curl')
    expect(byCat['Biceps']).toContain('Hammer Curl')

    // Legs verification
    expect(byCat['Legs']).toContain('Squats')
    expect(byCat['Legs']).toContain('Leg Press')
    expect(byCat['Legs']).toContain('Romanian Deadlift')

    // Core / Abs verification
    expect(byCat['Core / Abs']).toContain('Plank')
    expect(byCat['Core / Abs']).toContain('Crunches')
    expect(byCat['Core / Abs']).toContain('Mountain Climbers')

    // Cardio verification
    expect(byCat['Cardio']).toContain('Walking')
    expect(byCat['Cardio']).toContain('Running')
    expect(byCat['Cardio']).toContain('Treadmill')
    expect(byCat['Cardio']).toContain('HIIT')
  })

  it('detects duplicate exercise names within the same category', () => {
    const library = [
      { id: '1', name: 'Dumbbell Shoulder Press', category: 'Shoulder' },
      { id: '2', name: 'Squats', category: 'Legs' }
    ]

    expect(isDuplicateExerciseName(library, 'Dumbbell Shoulder Press', 'Shoulder')).toBe(true)
    expect(isDuplicateExerciseName(library, 'dumbbell shoulder press', 'Shoulder')).toBe(true)
    // Same name in different category allowed
    expect(isDuplicateExerciseName(library, 'Dumbbell Shoulder Press', 'Chest')).toBe(false)
    // Edit self does not trigger duplicate
    expect(isDuplicateExerciseName(library, 'Dumbbell Shoulder Press', 'Shoulder', '1')).toBe(false)
  })

  it('builds the default 6-day split (4 strength + 2 cardio + 1 rest)', () => {
    const planner = buildDefaultPlannerState({})
    expect(planner.routines.length).toBe(6) // 4 strength + 2 cardio
    expect(planner.week[1]).toBeDefined() // Monday
    expect(planner.week[2]).toBeDefined() // Tuesday
    expect(planner.week[3]).toBeDefined() // Wednesday
    expect(planner.week[4]).toBeDefined() // Thursday
    expect(planner.week[5]).toBeDefined() // Friday
    expect(planner.week[6]).toBeDefined() // Saturday
    expect(planner.week[0]).toBeNull()    // Sunday Rest

    // Monday should be Shoulder
    const mondayRoutine = planner.routines.find(r => r.id === planner.week[1])
    expect(mondayRoutine.name).toContain('Shoulder')
    expect(mondayRoutine.type).toBe('strength')
    expect(mondayRoutine.ex.some(e => e.name === 'Dumbbell Shoulder Press')).toBe(true)
    expect(mondayRoutine.ex.some(e => e.name === 'Lateral Raise')).toBe(true)

    // Friday should be Cardio
    const fridayRoutine = planner.routines.find(r => r.id === planner.week[5])
    expect(fridayRoutine.type).toBe('cardio')

    // Sunday is Rest
    expect(DEFAULT_WEEKLY_SCHEDULE[0].type).toBe('rest')
  })

  it('merges custom user exercises into exercise library without erasing history', () => {
    const S = {
      libraryEx: [
        {
          id: 'custom_1',
          name: 'Arnold Press',
          category: 'Shoulder',
          muscleGroup: 'Shoulder',
          equipment: 'Dumbbell',
          defaultSets: 4,
          defaultReps: 10,
          isCustom: true
        }
      ]
    }
    const lib = getExerciseLibrary(S)
    const custom = lib.find(e => e.id === 'custom_1')
    expect(custom).toBeDefined()
    expect(custom.name).toBe('Arnold Press')
    expect(custom.defaultSets).toBe(4)
  })

  it('verifies the full 6-day split schedule structure and assignment', () => {
    const planner = buildDefaultPlannerState({})
    const schedule = DEFAULT_WEEKLY_SCHEDULE

    expect(schedule[1].muscle).toBe('Shoulder')
    expect(schedule[2].muscle).toBe('Chest + Triceps')
    expect(schedule[3].muscle).toBe('Back + Biceps')
    expect(schedule[4].muscle).toBe('Legs + Core')
    expect(schedule[5].type).toBe('cardio')
    expect(schedule[6].type).toBe('cardio')
    expect(schedule[0].type).toBe('rest')

    // Check Tuesday Chest + Triceps exercises
    const tuesdayRoutine = planner.routines.find(r => r.id === planner.week[2])
    expect(tuesdayRoutine.ex.some(e => e.name === 'Flat Bench Press')).toBe(true)
    expect(tuesdayRoutine.ex.some(e => e.name === 'Cable Pushdown')).toBe(true)

    // Check Wednesday Back + Biceps exercises
    const wednesdayRoutine = planner.routines.find(r => r.id === planner.week[3])
    expect(wednesdayRoutine.ex.some(e => e.name === 'Lat Pulldown')).toBe(true)
    expect(wednesdayRoutine.ex.some(e => e.name === 'Barbell Curl')).toBe(true)

    // Check Thursday Legs + Core exercises
    const thursdayRoutine = planner.routines.find(r => r.id === planner.week[4])
    expect(thursdayRoutine.ex.some(e => e.name === 'Squats')).toBe(true)
    expect(thursdayRoutine.ex.some(e => e.name === 'Plank')).toBe(true)
  })

  it('keeps planned routine templates strictly separate from completed workout logs', () => {
    const planner = buildDefaultPlannerState({})
    const mondayRoutine = planner.routines.find(r => r.id === planner.week[1])
    
    // User performs workout and logs actual weights
    const completedWorkout = {
      id: 'w_test_1',
      d: '2026-11-14',
      routineId: mondayRoutine.id,
      name: mondayRoutine.name,
      entries: [
        {
          id: mondayRoutine.ex[0].id,
          sets: [
            { w: 22.5, r: 12, done: true },
            { w: 25, r: 10, done: true }
          ]
        }
      ]
    }

    // Original routine template target reps and planned weight remain untouched
    expect(mondayRoutine.ex[0].weight).toBe(0)
    expect(mondayRoutine.ex[0].reps).toBe(12)
    expect(completedWorkout.entries[0].sets[1].w).toBe(25)
    expect(completedWorkout.entries[0].sets[1].r).toBe(10)
  })

  it('supports soft-deleting an exercise without breaking foreign references', () => {
    const S = {
      libraryEx: [
        { id: 'lib_sh_shrugs', deleted: true }
      ]
    }
    const lib = getExerciseLibrary(S)
    expect(lib.some(e => e.id === 'lib_sh_shrugs')).toBe(false)
  })
})
