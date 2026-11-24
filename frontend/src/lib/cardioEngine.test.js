import { describe, it, expect } from 'vitest'
import {
  calculateHaversineDistance,
  filterGpsPoint,
  calculateTotalRouteDistance,
  formatPace,
  calculateEstimatedSteps,
  calculateMETCalories,
  calculateCardioBoost
} from './cardioEngine.js'

describe('cardioEngine - GPS Tracking & Intelligence', () => {
  it('correctly calculates Haversine distance between two points', () => {
    // New York (40.7128, -74.0060) to Boston (42.3601, -71.0589) ~ 306 km
    const dist = calculateHaversineDistance(40.7128, -74.0060, 42.3601, -71.0589)
    expect(dist).toBeGreaterThan(300)
    expect(dist).toBeLessThan(320)

    // Identical point is 0 km
    expect(calculateHaversineDistance(40.7128, -74.0060, 40.7128, -74.0060)).toBe(0)
  })

  it('filters noisy GPS points with accuracy > 30m or teleport jumps', () => {
    const p1 = { lat: 13.0827, lng: 80.2707, accuracy: 12, timestamp: 1000 }
    const pNoisy = { lat: 13.0830, lng: 80.2710, accuracy: 45, timestamp: 2000 } // Accuracy 45m > 30m
    const pValid = { lat: 13.0829, lng: 80.2709, accuracy: 15, timestamp: 3000 }

    expect(filterGpsPoint(p1, null)).toBe(true)
    expect(filterGpsPoint(pNoisy, p1)).toBe(false)
    expect(filterGpsPoint(pValid, p1)).toBe(true)
  })

  it('formats pace correctly from distance and seconds', () => {
    // 5 km in 25 min (1500s) -> 5'00" /km
    expect(formatPace(5, 1500)).toBe('5\'00" /km')
    // 10 km in 52 min 30 sec (3150s) -> 5'15" /km
    expect(formatPace(10, 3150)).toBe('5\'15" /km')
    expect(formatPace(0, 100)).toBe('—')
  })

  it('calculates height-based steps for walking and jogging, and 0 for cycling', () => {
    // 1 km = 1000m. Height 175cm -> step length = 175 * 0.415 / 100 = 0.72625m -> ~1377 steps
    const stepsWalking = calculateEstimatedSteps(1.0, 175, 'Walking')
    expect(stepsWalking).toBeGreaterThan(1300)
    expect(stepsWalking).toBeLessThan(1450)

    // Cycling has 0 steps
    expect(calculateEstimatedSteps(10.0, 175, 'Cycling')).toBe(0)
  })

  it('calculates MET calories accurately', () => {
    // Running (MET 8.0), 1 hour, 70kg -> 560 kcal
    expect(calculateMETCalories('Running', 1.0, 70)).toBe(560)
    // Walking (MET 3.5), 0.5 hours (30 min), 80kg -> 3.5 * 80 * 0.5 = 140 kcal
    expect(calculateMETCalories('Walking', 0.5, 80)).toBe(140)
  })

  it('calculates safe progressive Cardio Boost recommendations (+5% to +10%)', () => {
    const now = Date.now()
    const recentLogs = [
      { d: new Date(now - 86400000).toISOString(), distance_km: 5.0, activity_type: 'Running' },
      { d: new Date(now - 2 * 86400000).toISOString(), distance_km: 5.0, activity_type: 'Running' }
    ] // Total 10 km past week

    const boost = calculateCardioBoost(recentLogs)
    expect(boost.pastWeekKm).toBe(10)
    // +8% of 10km is +0.8km -> target 10.8km
    expect(boost.recommendedIncreaseKm).toBe(0.8)
    expect(boost.nextTargetKm).toBe(10.8)
    expect(boost.recommendationMessage).toContain('Cardio Boost')
  })
})
