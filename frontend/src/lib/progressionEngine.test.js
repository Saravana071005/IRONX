import { describe, it, expect } from 'vitest'
import { calc1RM, getExerciseMuscleGroup, evaluateWorkoutProgression } from './progressionEngine.js'

describe('progressionEngine - Deterministic PRs & Baseline Intelligence', () => {
  it('correctly calculates estimated 1RM via Epley formula', () => {
    expect(calc1RM(100, 1)).toBe(100)
    // 100 * (1 + 10 / 30) = 133.333 -> 133.3
    expect(calc1RM(100, 10)).toBe(133.3)
    // 80 * (1 + 5 / 30) = 93.333 -> 93.3
    expect(calc1RM(80, 5)).toBe(93.3)
    expect(calc1RM(0, 10)).toBe(0)
  })

  it('identifies first-time exercise baseline without triggering PR celebration notifications', () => {
    const historicalWorkouts = []
    const currentWorkout = {
      id: 'w_today',
      d: '2026-11-24',
      entries: [
        {
          id: 'bench',
          name: 'Barbell Bench Press',
          sets: [
            { w: 60, r: 10, done: true },
            { w: 70, r: 8, done: true }
          ]
        }
      ]
    }

    const result = evaluateWorkoutProgression(currentWorkout, historicalWorkouts, { unit: 'kg' })

    // Must establish baseline
    expect(result.newBaselines).toHaveLength(1)
    expect(result.newBaselines[0].exerciseId).toBe('bench')
    expect(result.newBaselines[0].topWeight).toBe(70)
    expect(result.newBaselines[0].isFirstTime).toBe(true)

    // Must NOT celebrate first-time baseline as a PR
    expect(result.prs).toHaveLength(0)
    expect(result.notifications).toHaveLength(0)
  })

  it('detects Weight PR when heavier working weight is lifted', () => {
    const pastWorkouts = [
      {
        id: 'w1',
        d: '2026-11-10',
        entries: [
          {
            id: 'bench',
            sets: [
              { w: 70, r: 8, done: true },
              { w: 75, r: 6, done: true }
            ]
          }
        ]
      }
    ]

    const currentWorkout = {
      id: 'w2',
      d: '2026-11-24',
      entries: [
        {
          id: 'bench',
          name: 'Barbell Bench Press',
          sets: [
            { w: 75, r: 6, done: true },
            { w: 80, r: 5, done: true } // New top weight: 80kg (+5kg)
          ]
        }
      ]
    }

    const result = evaluateWorkoutProgression(currentWorkout, pastWorkouts, { unit: 'kg' })

    const weightPr = result.prs.find(p => p.type === 'WEIGHT_PR')
    expect(weightPr).toBeDefined()
    expect(weightPr.weight).toBe(80)
    expect(weightPr.prevWeight).toBe(75)
    expect(weightPr.delta).toBe(5)
    expect(weightPr.message).toContain('80 kg (+5 kg)')

    // Positive notifications only
    expect(result.notifications.length).toBeGreaterThan(0)
    expect(result.notifications.some(n => n.title.includes('Weight Record'))).toBe(true)
  })

  it('detects Rep PR at identical weight', () => {
    const pastWorkouts = [
      {
        id: 'w1',
        d: '2026-11-10',
        entries: [
          {
            id: 'squat',
            sets: [
              { w: 100, r: 6, done: true } // previously max 6 reps at 100kg
            ]
          }
        ]
      }
    ]

    const currentWorkout = {
      id: 'w2',
      d: '2026-11-24',
      entries: [
        {
          id: 'squat',
          name: 'Barbell Squat',
          sets: [
            { w: 100, r: 8, done: true } // 8 reps at 100kg (+2 reps!)
          ]
        }
      ]
    }

    const result = evaluateWorkoutProgression(currentWorkout, pastWorkouts, { unit: 'kg' })

    const repPr = result.prs.find(p => p.type === 'REP_PR')
    expect(repPr).toBeDefined()
    expect(repPr.weight).toBe(100)
    expect(repPr.reps).toBe(8)
    expect(repPr.prevReps).toBe(6)
    expect(repPr.delta).toBe(2)
    expect(repPr.message).toContain('8 reps at 100 kg (+2 reps)')
  })

  it('strictly produces NO notifications or PRs on regressions (positive only)', () => {
    const pastWorkouts = [
      {
        id: 'w1',
        d: '2026-11-10',
        entries: [
          {
            id: 'bench',
            sets: [
              { w: 80, r: 8, done: true } // 80kg x 8
            ]
          }
        ]
      }
    ]

    const currentWorkout = {
      id: 'w2',
      d: '2026-11-24',
      entries: [
        {
          id: 'bench',
          name: 'Barbell Bench Press',
          sets: [
            { w: 70, r: 6, done: true }, // Deload or lower session: 70kg x 6
            { w: 75, r: 5, done: true }
          ]
        }
      ]
    }

    const result = evaluateWorkoutProgression(currentWorkout, pastWorkouts, { unit: 'kg' })

    // Absolutely zero PRs or notifications
    expect(result.prs).toHaveLength(0)
    expect(result.notifications).toHaveLength(0)
    expect(result.newBaselines).toHaveLength(0)
  })

  it('correctly maps muscle groups and accumulates muscle progression', () => {
    const pastWorkouts = [
      {
        id: 'w1',
        d: '2026-11-10',
        entries: [
          {
            id: 'bench',
            sets: [{ w: 60, r: 10, done: true }]
          }
        ]
      }
    ]

    const currentWorkout = {
      id: 'w2',
      d: '2026-11-24',
      entries: [
        {
          id: 'bench',
          name: 'Barbell Bench Press',
          sets: [{ w: 65, r: 10, done: true }]
        }
      ]
    }

    const result = evaluateWorkoutProgression(currentWorkout, pastWorkouts, { unit: 'kg' })
    expect(result.muscleGroupProgression['Chest']).toBeDefined()
    expect(result.muscleGroupProgression['Chest'].count).toBeGreaterThan(0)
  })
})
