import { describe, it, expect } from 'vitest'
import {
  calcEWMA,
  calcWeeklyAverages,
  calcTransformationProgress,
  estimateBMR,
  calcTransformationPlanTargets,
  compareMeasurements
} from './transformation.js'

describe('transformation', () => {
  it('calculates 7-day EWMA smoothed bodyweight correctly', () => {
    const weights = [
      { d: '2026-11-01', w: 80 },
      { d: '2026-11-02', w: 81 },
      { d: '2026-11-03', w: 79.5 },
      { d: '2026-11-04', w: 80.2 }
    ]
    const res = calcEWMA(weights)
    expect(res.length).toBe(4)
    expect(res[0].ewma).toBe(80)
    // 0.25 * 81 + 0.75 * 80 = 20.25 + 60 = 80.25 -> 80.3
    expect(res[1].ewma).toBe(80.3)
    // EWMA dampens large jumps
    expect(res[2].ewma).toBeGreaterThan(79.5)
  })

  it('calculates weekly averages correctly', () => {
    const weights = [
      { d: '2026-11-02', w: 80 },
      { d: '2026-11-03', w: 80.5 },
      { d: '2026-11-04', w: 79.5 }
    ]
    const weekly = calcWeeklyAverages(weights)
    expect(weekly.length).toBe(1)
    expect(weekly[0].average).toBe(80)
    expect(weekly[0].count).toBe(3)
  })

  it('evaluates transformation progress, target delta, and percent', () => {
    const weights = [
      { d: '2026-10-01', w: 85 },
      { d: '2026-10-15', w: 83 },
      { d: '2026-11-01', w: 81 }
    ]
    const progress = calcTransformationProgress(weights, 75)
    expect(progress.hasData).toBe(true)
    expect(progress.start).toBe(85)
    expect(progress.current).toBe(81)
    expect(progress.totalChange).toBe(-4)
    expect(progress.remaining).toBe(-6) // 75 - 81 = -6 kg to lose
    expect(progress.percent).toBe(40) // 4kg of 10kg goal = 40%
  })

  it('estimates BMR using Mifflin-St Jeor formula accurately', () => {
    // 80kg, 180cm, 30yo male: 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    const bmrMale = estimateBMR(80, 180, 30, 'male')
    expect(bmrMale).toBe(1780)

    // Female: 60kg, 165cm, 28yo: 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330
    const bmrFemale = estimateBMR(60, 165, 28, 'female')
    expect(bmrFemale).toBe(1330)
  })

  it('determines plan caloric targets with safe minimum floor', () => {
    const profile = { height: 175, age: 30, sex: 'male', planType: '3-month' }
    const targets = calcTransformationPlanTargets(profile, 80)
    expect(targets.isEstimated).toBe(true)
    expect(targets.deficit).toBe(350)
    expect(targets.targetCal).toBe(targets.maintenance - 350)
    expect(targets.targetProtein).toBe(Math.round(80 * 1.8))
  })

  it('compares body measurements accurately', () => {
    const measurements = [
      { d: '2026-10-01', waist: 88, chest: 102 },
      { d: '2026-11-01', waist: 84, chest: 103 }
    ]
    const diffs = compareMeasurements(measurements)
    const waist = diffs.find(d => d.id === 'waist')
    const chest = diffs.find(d => d.id === 'chest')
    expect(waist.diff).toBe(-4)
    expect(chest.diff).toBe(1)
  })
})
