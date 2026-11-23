import { describe, it, expect } from 'vitest'
import {
  xpForLevelStep,
  levelFromXP,
  awardXPEvent,
  detectPersonalRecords,
  calcWeeklyConsistency,
  XP_REWARDS
} from './gamification.js'

describe('gamification and motivation engine', () => {
  it('computes level step XP via audit nonlinear formula', () => {
    // XP(1) = 250 * 1^1.4 = 250
    expect(xpForLevelStep(1)).toBe(250)
    // XP(2) = 250 * 2^1.4 = 250 * 2.639 = 659
    expect(xpForLevelStep(2)).toBe(659)
  })

  it('determines correct level, tier, and progress metrics', () => {
    // 0 XP -> Level 1, Bronze Iron
    const l1 = levelFromXP(0)
    expect(l1.level).toBe(1)
    expect(l1.tier).toBe('Bronze Iron')
    expect(l1.progressPercent).toBe(0)

    // 250 XP -> Level 2
    const l2 = levelFromXP(250)
    expect(l2.level).toBe(2)
    expect(l2.tier).toBe('Bronze Iron')

    // 50,000 XP -> Level 13, Silver Steel
    const mid = levelFromXP(50000)
    expect(mid.level).toBe(13)
    expect(mid.tier).toBe('Silver Steel')

    // 250,000 XP -> Titanium (Levels 21-35)
    const high = levelFromXP(250000)
    expect(high.level).toBeGreaterThanOrEqual(21)
    expect(high.tier).toBe('Titanium')

    // 600,000 XP -> Master Elite (Levels 36-50)
    const elite = levelFromXP(600000)
    expect(elite.level).toBeGreaterThanOrEqual(36)
    expect(elite.tier).toBe('Master Elite')
  })

  it('idempotently awards XP and blocks duplicate events', () => {
    let xp = 0
    let history = []

    const res1 = awardXPEvent(xp, history, 'workout:w_101', 'WORKOUT_COMPLETE', null, 'Completed Push Day')
    expect(res1.awarded).toBe(true)
    expect(res1.newTotal).toBe(100)
    expect(res1.history.length).toBe(1)

    // Repeat attempt with same eventId
    const res2 = awardXPEvent(res1.newTotal, res1.history, 'workout:w_101', 'WORKOUT_COMPLETE', null, 'Completed Push Day')
    expect(res2.awarded).toBe(false)
    expect(res2.newTotal).toBe(100)
    expect(res2.history.length).toBe(1)
  })

  it('detects verified PRs and updates personal record vault', () => {
    const workouts = [
      {
        d: '2026-11-01',
        id: 'w1',
        entries: [
          {
            id: '0025',
            sets: [{ done: true, w: 80, r: 8 }]
          }
        ]
      },
      {
        d: '2026-11-08',
        id: 'w2',
        entries: [
          {
            id: '0025',
            sets: [{ done: true, w: 85, r: 8 }] // New max weight!
          }
        ]
      }
    ]

    const { vault, newRecords } = detectPersonalRecords(workouts, [])
    expect(vault.length).toBeGreaterThan(0)
    const maxW = vault.find(v => v.metric === 'max_weight' && v.exId === '0025')
    expect(maxW).toBeDefined()
    expect(maxW.value).toBe(85)
  })

  it('evaluates non-punitive weekly consistency correctly', () => {
    const workouts = [
      { d: '2026-11-16' },
      { d: '2026-11-18' },
      { d: '2026-11-20' }
    ]
    const consistency = calcWeeklyConsistency(workouts, 4, '2026-11-21')
    expect(consistency.completed).toBe(3)
    expect(consistency.target).toBe(4)
    expect(consistency.percent).toBe(75)
    expect(consistency.remaining).toBe(1)
    expect(consistency.isTargetMet).toBe(false)
  })
})
