/**
 * IRONX GPS Cardio Tracking & Intelligence Engine
 * Deterministic formulas for distance, pace, speed, steps, MET calories, and Cardio Boost.
 * Zero external AI dependencies.
 */

export const MET_VALUES = {
  walking: 3.5,
  Walking: 3.5,
  jogging: 7.0,
  Jogging: 7.0,
  running: 8.0,
  Running: 8.0,
  cycling: 6.0,
  Cycling: 6.0
}

/**
 * Calculates distance between two GPS coordinates using the Haversine formula (in km)
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Filters raw GPS stream to eliminate noisy drift points (accuracy > 30m or unrealistic jumps)
 */
export function filterGpsPoint(newPoint, prevPoint, maxAccuracyMeters = 30) {
  if (!newPoint || newPoint.lat == null || newPoint.lng == null) return false
  if (newPoint.accuracy != null && newPoint.accuracy > maxAccuracyMeters) {
    return false // Skip noisy point
  }
  if (!prevPoint) return true

  const distKm = calculateHaversineDistance(prevPoint.lat, prevPoint.lng, newPoint.lat, newPoint.lng)
  const timeDiffSec = (newPoint.timestamp - prevPoint.timestamp) / 1000

  // If points are identical in timestamp or distance is 0, don't duplicate
  if (timeDiffSec <= 0) return false
  if (distKm < 0.001) return false // less than 1 meter

  // Max plausible speed check: 60 km/h (0.0167 km/s) for pedestrian, 100 km/h for bike
  const speedKmh = (distKm / (timeDiffSec / 3600))
  if (speedKmh > 120) return false // GPS teleport jump

  return true
}

/**
 * Calculates total route distance in km from filtered coordinates
 */
export function calculateTotalRouteDistance(coords = []) {
  if (!coords || coords.length < 2) return 0
  let totalKm = 0
  for (let i = 1; i < coords.length; i++) {
    totalKm += calculateHaversineDistance(coords[i - 1].lat, coords[i - 1].lng, coords[i].lat, coords[i].lng)
  }
  return Math.round(totalKm * 100) / 100
}

/**
 * Formats pace (min/km) from distance and seconds
 * e.g. distance = 5km, seconds = 1500 (25 min) -> 5'00" /km
 */
export function formatPace(distanceKm, seconds) {
  if (!distanceKm || distanceKm <= 0 || !seconds || seconds <= 0) return "—"
  const totalMin = seconds / 60
  const pacePerKm = totalMin / distanceKm
  if (!isFinite(pacePerKm) || pacePerKm > 60) return "—"

  const mins = Math.floor(pacePerKm)
  const secs = Math.round((pacePerKm - mins) * 60)
  return `${mins}'${secs.toString().padStart(2, '0')}" /km`
}

/**
 * Calculates height-based estimated steps from distance
 * Step length: heightCm * 0.415 for walking/jogging/running
 */
export function calculateEstimatedSteps(distanceKm, heightCm = 175, activityType = 'Walking') {
  if (activityType.toLowerCase() === 'cycling') return 0
  if (!distanceKm || distanceKm <= 0) return 0
  const stepLengthMeters = ((parseFloat(heightCm) || 175) * 0.415) / 100
  const distanceMeters = distanceKm * 1000
  return Math.round(distanceMeters / stepLengthMeters)
}

/**
 * Calculates estimated energy expenditure using standard MET formula
 * Calories (kcal) = MET * BodyWeightKg * DurationHours
 */
export function calculateMETCalories(activityType = 'Walking', durationHours = 0, bodyWeightKg = 70) {
  const met = MET_VALUES[activityType] || 4.0
  const w = parseFloat(bodyWeightKg) || 70
  const h = parseFloat(durationHours) || 0
  return Math.round(met * w * h)
}

/**
 * Progressive Cardio Boost Engine (Module 9)
 * Compares current week volume vs past week and calculates safe +5% to +10% progression
 */
export function calculateCardioBoost(cardioLogs = []) {
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 86400000
  const fourteenDaysAgo = now - 14 * 86400000

  let pastWeekKm = 0
  let prevWeekKm = 0
  let activityBreakdown = {}

  for (const log of cardioLogs) {
    const logTime = log.t || (log.d ? new Date(log.d).getTime() : (log.createdAt ? new Date(log.createdAt).getTime() : 0))
    const km = Number(log.distance_km || log.distanceKm) || 0
    const act = log.activity_type || log.activity || 'Walking'

    if (logTime >= sevenDaysAgo) {
      pastWeekKm += km
      activityBreakdown[act] = (activityBreakdown[act] || 0) + km
    } else if (logTime >= fourteenDaysAgo) {
      prevWeekKm += km
    }
  }

  pastWeekKm = Math.round(pastWeekKm * 10) / 10
  prevWeekKm = Math.round(prevWeekKm * 10) / 10

  // Safe progressive boost is 5% to 10% increase of current weekly distance
  const baseTarget = pastWeekKm > 0 ? pastWeekKm : 5.0
  const recommendedIncreaseKm = Math.round(baseTarget * 0.08 * 10) / 10
  const nextTargetKm = Math.round((baseTarget + recommendedIncreaseKm) * 10) / 10

  return {
    pastWeekKm,
    prevWeekKm,
    deltaKm: Math.round((pastWeekKm - prevWeekKm) * 10) / 10,
    recommendedIncreaseKm,
    nextTargetKm,
    activityBreakdown,
    recommendationMessage: pastWeekKm > 0
      ? `Cardio Boost: Increase weekly distance by +${recommendedIncreaseKm} km next week (Target: ${nextTargetKm} km) for safe cardiovascular adaptation.`
      : 'Cardio Boost: Begin with 5.0 km total outdoor walking or jogging this week to establish your aerobic baseline.'
  }
}
