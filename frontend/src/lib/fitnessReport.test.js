import { describe, it, expect } from 'vitest'
import { generateWeeklyFitnessReport } from './fitnessReport.js'

describe('weekly fitness intelligence report', () => {
  it('aggregates training volume, sets, and muscle distribution honestly without inventing numbers', () => {
    const S = {
      weeklyTarget: 3,
      workouts: [
        {
          d: '2026-11-18',
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
      ],
      prVault: [],
      bodyweight: [{ d: '2026-11-18', w: 82 }],
      meals: [{ d: '2026-11-18', energy_kcal: 2100, protein_g: 155 }],
      nutritionTargets: { calorie: 2000, protein: 150 }
    }

    const report = generateWeeklyFitnessReport(S, '2026-11-20')
    expect(report.training.workoutsCount).toBe(1)
    expect(report.training.totalSets).toBe(2)
    expect(report.training.totalVolumeKg).toBe(1600) // 80*10 + 80*10 = 1600
    expect(report.training.topExercises.length).toBe(1)
    expect(report.bodyweight.hasData).toBe(true)
    expect(report.nutrition.hasData).toBe(true)
    expect(report.nutrition.avgCalories).toBe(2100)
    expect(report.nutrition.avgProtein).toBe(155)
    expect(report.recommendations.length).toBeGreaterThan(0)
  })

  it('handles missing data honestly and flags gaps rather than inventing numbers', () => {
    const S = {
      weeklyTarget: 4,
      workouts: [],
      prVault: [],
      bodyweight: [],
      meals: []
    }

    const report = generateWeeklyFitnessReport(S, '2026-11-20')
    expect(report.training.workoutsCount).toBe(0)
    expect(report.training.totalSets).toBe(0)
    expect(report.training.totalVolumeKg).toBe(0)
    expect(report.bodyweight.hasData).toBe(false)
    expect(report.nutrition.hasData).toBe(false)
    expect(report.recommendations.some(r => r.type === 'consistency')).toBe(true)
  })
})
