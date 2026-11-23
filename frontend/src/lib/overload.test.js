import { describe, it, expect } from 'vitest'
import { calcEpley1RM, exercisePerformanceHistory, evaluateOverloadGuidance } from './overload.js'

describe('progressive overload engine', () => {
  it('calculates Epley 1RM accurately for valid rep ranges', () => {
    // 100kg for 10 reps: 100 * (1 + 10/30) = 133.33 -> 133.3
    expect(calcEpley1RM(100, 10)).toBe(133.3)
    expect(calcEpley1RM(100, 1)).toBe(100)
    expect(calcEpley1RM(0, 10)).toBe(0)
    expect(calcEpley1RM(100, 0)).toBe(0)
  })

  it('extracts session history and trends correctly', () => {
    const S = {
      workouts: [
        {
          d: '2026-11-01',
          entries: [
            {
              id: '0025',
              sets: [
                { done: true, w: 80, r: 8 },
                { done: true, w: 80, r: 8 }
              ]
            }
          ]
        },
        {
          d: '2026-11-08',
          entries: [
            {
              id: '0025',
              sets: [
                { done: true, w: 80, r: 10 },
                { done: true, w: 80, r: 10 }
              ]
            }
          ]
        }
      ]
    }

    const hist = exercisePerformanceHistory(S, '0025')
    expect(hist.hasHistory).toBe(true)
    expect(hist.sessionsCount).toBe(2)
    expect(hist.bestWeight).toBe(80)
    expect(hist.bestReps).toBe(10)
    expect(hist.recentTrend).toBe('improving')
  })

  it('prompts for progressive overload when target reps are met on all working sets', () => {
    const S = {
      unit: 'kg',
      workouts: [
        {
          d: '2026-11-10',
          entries: [
            {
              id: '0025',
              sets: [
                { done: true, w: 60, r: 10 },
                { done: true, w: 60, r: 10 }
              ]
            }
          ]
        }
      ],
      overloadDecisions: {}
    }

    const guidance = evaluateOverloadGuidance(S, '0025', { reps: 10 })
    expect(guidance.shouldPrompt).toBe(true)
    expect(guidance.type).toBe('increase')
    expect(guidance.currentWeight).toBe(60)
    expect(guidance.suggestedWeight).toBe(62.5) // +2.5 kg upper body
  })

  it('suppresses prompt if user dismissed recommendation for that session', () => {
    const S = {
      unit: 'kg',
      workouts: [
        {
          d: '2026-11-10',
          entries: [
            {
              id: '0025',
              sets: [
                { done: true, w: 60, r: 10 },
                { done: true, w: 60, r: 10 }
              ]
            }
          ]
        }
      ],
      overloadDecisions: {
        '0025': { date: '2026-11-10', decision: 'dismiss' }
      }
    }

    const guidance = evaluateOverloadGuidance(S, '0025', { reps: 10 })
    expect(guidance.shouldPrompt).toBe(false)
    expect(guidance.reason).toBe('user_dismissed')
  })
})
