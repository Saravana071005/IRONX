import { describe, it, expect } from 'vitest'
import { getTodayMuscleActivity, MUSCLE_DETAILS } from './muscleTracker.js'
import { todayISO } from './format.js'

describe('Feature 1: Today Muscle Target Chart & Tracker', () => {
  const today = todayISO()

  it('returns empty neutral state when no workouts or scheduled routines exist', () => {
    const emptyS = { workouts: [], active: null, dayPlan: {}, weeklySchedule: {} }
    const res = getTodayMuscleActivity(emptyS)

    expect(res.hasCompletedToday).toBe(false)
    expect(res.hasScheduledToday).toBe(false)
    expect(res.muscleGroupsTrainedCount).toBe(0)
    expect(res.completedExercisesCount).toBe(0)
    expect(res.completedSetsCount).toBe(0)

    // All muscles should be untrained
    Object.values(res.muscleStatuses).forEach(m => {
      expect(m.status).toBe('untrained')
    })
  })

  it('marks completed muscles in completed state from finished workouts today', () => {
    const state = {
      workouts: [
        {
          id: 'w-1',
          d: today,
          dur: 3600000, // 60 min
          entries: [
            {
              id: 'bench-press', // targets chest, deltoids, triceps
              sets: [
                { done: true, reps: 10, w: 80 },
                { done: true, reps: 8, w: 85 }
              ]
            },
            {
              id: 'barbell-curl', // targets biceps
              sets: [
                { done: true, reps: 12, w: 30 }
              ]
            }
          ]
        }
      ],
      active: null
    }

    const res = getTodayMuscleActivity(state)
    expect(res.hasCompletedToday).toBe(true)
    expect(res.completedExercisesCount).toBe(2)
    expect(res.completedSetsCount).toBe(3)
    expect(res.muscleGroupsTrainedCount).toBeGreaterThanOrEqual(2)

    // Chest should be completed
    expect(res.muscleStatuses.chest?.status).toBe('completed')
    expect(res.muscleStatuses.chest?.data.exercises.length).toBeGreaterThan(0)

    // Biceps should be completed
    expect(res.muscleStatuses.biceps?.status).toBe('completed')

    // Untrained muscle should remain untrained
    expect(res.muscleStatuses.quadriceps?.status).toBe('untrained')
  })

  it('combines multiple workouts logged on the same day without double counting exercises', () => {
    const state = {
      workouts: [
        {
          id: 'w-morning',
          d: today,
          dur: 1800000,
          entries: [
            {
              id: 'bench-press',
              sets: [{ done: true, reps: 10, w: 80 }]
            }
          ]
        },
        {
          id: 'w-evening',
          d: today,
          dur: 1800000,
          entries: [
            {
              id: 'squat', // targets quadriceps, gluteal
              sets: [
                { done: true, reps: 5, w: 120 },
                { done: true, reps: 5, w: 120 }
              ]
            }
          ]
        }
      ]
    }

    const res = getTodayMuscleActivity(state)
    expect(res.hasCompletedToday).toBe(true)
    expect(res.completedExercisesCount).toBe(2)
    expect(res.completedSetsCount).toBe(3)
    expect(res.muscleStatuses.chest?.status).toBe('completed')
    expect(res.muscleStatuses.quadriceps?.status).toBe('completed')
  })

  it('ignores workouts from previous or future dates', () => {
    const state = {
      workouts: [
        {
          id: 'w-yesterday',
          d: '2020-01-01',
          dur: 3600000,
          entries: [
            { id: 'bench-press', sets: [{ done: true, reps: 10, w: 80 }] }
          ]
        }
      ]
    }

    const res = getTodayMuscleActivity(state)
    expect(res.hasCompletedToday).toBe(false)
    expect(res.muscleGroupsTrainedCount).toBe(0)
    expect(res.muscleStatuses.chest?.status).toBe('untrained')
  })

  it('shows scheduled muscles as scheduled (not completed) when workout has not started', () => {
    const state = {
      workouts: [],
      active: null,
      weeklySchedule: {
        monday: {
          templateId: 'tpl-chest',
          template: {
            id: 'tpl-chest',
            name: 'Chest & Triceps',
            exercises: [
              { id: 'bench-press', sets: 3, reps: 10, weight: 80 }
            ]
          }
        }
      }
    }

    // Force date to a Monday (e.g. 2026-11-16)
    const targetMonday = new Date(2026, 10, 16)
    const res = getTodayMuscleActivity(state, targetMonday)

    expect(res.hasCompletedToday).toBe(false)
    expect(res.hasScheduledToday).toBe(true)

    // Should be in 'scheduled' state with dashed/outline indication
    expect(res.muscleStatuses.chest?.status).toBe('scheduled')
    expect(res.muscleStatuses.chest?.data.exercises.length).toBe(1)
  })

  it('correctly tracks partial in-progress workout sets', () => {
    const state = {
      workouts: [],
      active: {
        id: 'active-session',
        start: Date.now() - 15 * 60000,
        entries: [
          {
            id: 'bench-press',
            sets: [
              { done: true, reps: 10, w: 80 },
              { done: false, reps: 10, w: 80 }
            ]
          },
          {
            id: 'overhead-press',
            sets: [
              { done: false, reps: 8, w: 50 }
            ]
          }
        ]
      }
    }

    const res = getTodayMuscleActivity(state)
    expect(res.hasCompletedToday).toBe(true)
    expect(res.completedSetsCount).toBe(1) // Only 1 completed set
    expect(res.completedExercisesCount).toBe(1) // Only bench-press had completed set
    expect(res.muscleStatuses.chest?.status).toBe('completed')
  })

  it('provides anatomical metadata for all major muscle groups', () => {
    const expectedMuscles = [
      'chest', 'deltoids', 'biceps', 'triceps', 'upper-back', 'lower-back',
      'trapezius', 'abs', 'obliques', 'gluteal', 'quadriceps', 'hamstring', 'calves'
    ]

    expectedMuscles.forEach(slug => {
      const meta = MUSCLE_DETAILS[slug]
      expect(meta).toBeDefined()
      expect(meta.name).toBeDefined()
      expect(typeof meta.name).toBe('string')
      expect(meta.views).toBeDefined()
      expect(Array.isArray(meta.views)).toBe(true)
    })
  })
})
