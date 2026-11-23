import { describe, it, expect } from 'vitest'
import { musclesOf, loadOfWorkouts, rankOf, muscleDetailsFor, MUSCLES } from './muscles.js'

describe('muscles', () => {
  it('maps standard exercise targets to anatomical slugs', () => {
    const ex = { tg: 'pectorals', sm: ['triceps', 'deltoids'], bp: 'chest' }
    const m = musclesOf(ex)
    expect(m.chest).toBe(1)
    expect(m.triceps).toBe(0.4)
    expect(m.deltoids).toBe(0.4)
  })

  it('ranks worked and missed muscles correctly from workouts', () => {
    const workouts = [
      {
        d: '2026-11-20',
        entries: [
          {
            id: '0025',
            sets: [
              { done: true, w: 80, r: 8 },
              { done: true, w: 80, r: 8 },
              { done: false, w: 80, r: 8 }
            ]
          }
        ]
      }
    ]
    const load = loadOfWorkouts(workouts)
    const { worked, missed } = rankOf(load)
    expect(worked.length).toBeGreaterThan(0)
    expect(missed.length).toBeGreaterThan(0)
    expect(worked.length + missed.length).toBe(MUSCLES.length)
  })

  it('computes muscleDetailsFor with exercise breakdowns, rep ranges, and top weights', () => {
    const workouts = [
      {
        d: '2026-11-20',
        name: 'Push Day',
        entries: [
          {
            id: '0025', // Barbell Bench Press
            name: 'Barbell Bench Press',
            sets: [
              { done: true, w: 70, r: 10 },
              { done: true, w: 80, r: 8 },
              { done: true, w: 85, r: 6 },
              { done: false, w: 90, r: 5 } // uncompleted
            ]
          }
        ]
      }
    ]

    const details = muscleDetailsFor('chest', workouts)
    expect(details.muscle).toBe('chest')
    expect(details.totalSets).toBeGreaterThan(0)
    expect(details.exercises.length).toBe(1)
    const item = details.exercises[0]
    expect(item.sets).toBe(3) // 3 completed sets
    expect(item.topWeight).toBe(85)
    expect(item.repRange).toBe('6–10')
    expect(item.isPrimary).toBe(true)
  })

  it('returns empty breakdown gracefully for unworked muscle or empty workouts', () => {
    const emptyDetails = muscleDetailsFor('calves', [])
    expect(emptyDetails.totalSets).toBe(0)
    expect(emptyDetails.exercises).toEqual([])
  })
})
