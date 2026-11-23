/**
 * IRONX - Transformation & Bodyweight Trend Intelligence
 *
 * Implements 7-day EWMA (exponentially weighted moving average),
 * weekly rate-of-change, Mifflin-St Jeor TDEE estimation,
 * configurable fat-loss & recomposition planning, and body measurement tracking.
 */

export const MEASUREMENT_SITES = [
  { id: 'chest', label: 'Chest' },
  { id: 'waist', label: 'Waist' },
  { id: 'abdomen', label: 'Abdomen' },
  { id: 'hips', label: 'Hips' },
  { id: 'armL', label: 'Left Arm' },
  { id: 'armR', label: 'Right Arm' },
  { id: 'thighL', label: 'Left Thigh' },
  { id: 'thighR', label: 'Right Thigh' },
  { id: 'calves', label: 'Calves' }
]

export const PLAN_PRESETS = {
  '2-month': { name: '2-Month Sprint', deficit: 400, desc: 'Moderate deficit for focused 8-week fat loss.' },
  '3-month': { name: '3-Month Recomp', deficit: 350, desc: 'Balanced deficit for lean tissue retention & steady fat loss.' },
  '4-month': { name: '4-Month Sustainable', deficit: 250, desc: 'Gradual, highly sustainable deficit minimizing fatigue.' },
  'custom': { name: 'Custom Deficit', deficit: 300, desc: 'User-configured daily energy deficit.' }
}

/**
 * 7-Day Exponentially Weighted Moving Average (EWMA) for bodyweight.
 * Dampens transient water-weight, glycogen, and sodium fluctuations.
 * Alpha = 2 / (N + 1) = 2 / (7 + 1) = 0.25.
 */
export function calcEWMA(weights = [], alpha = 0.25) {
  if (!weights || !weights.length) return []
  const sorted = [...weights].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
  let prevEwma = sorted[0].w

  return sorted.map((entry, idx) => {
    if (idx === 0) {
      return { ...entry, ewma: Math.round(prevEwma * 10) / 10 }
    }
    const ewma = alpha * entry.w + (1 - alpha) * prevEwma
    prevEwma = ewma
    return { ...entry, ewma: Math.round(ewma * 10) / 10 }
  })
}

/**
 * Weekly Average Bodyweight calculation.
 */
export function calcWeeklyAverages(weights = []) {
  if (!weights.length) return []
  const sorted = [...weights].sort((a, b) => (a.d < b.d ? -1 : 1))
  const groups = new Map()

  for (const item of sorted) {
    const dt = new Date(item.d)
    // Find Monday of the week
    const day = dt.getDay()
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1)
    const weekStart = new Date(dt.setDate(diff)).toISOString().slice(0, 10)

    if (!groups.has(weekStart)) groups.set(weekStart, [])
    groups.get(weekStart).push(item.w)
  }

  const result = []
  for (const [weekStart, vals] of groups.entries()) {
    const avg = vals.reduce((sum, v) => sum + v, 0) / vals.length
    result.push({
      weekStart,
      count: vals.length,
      average: Math.round(avg * 10) / 10
    })
  }
  return result
}

/**
 * Overall Transformation Progress Assessment.
 */
export function calcTransformationProgress(weights = [], targetW = null) {
  if (!weights.length) {
    return {
      current: null,
      start: null,
      trendWeight: null,
      target: targetW,
      totalChange: 0,
      remaining: null,
      percent: 0,
      ratePerWeek: 0,
      hasData: false
    }
  }

  const ewmaSeries = calcEWMA(weights)
  const currentEntry = ewmaSeries[ewmaSeries.length - 1]
  const startEntry = ewmaSeries[0]
  const current = currentEntry.w
  const trendWeight = currentEntry.ewma
  const start = startEntry.w
  const totalChange = Math.round((current - start) * 10) / 10

  let remaining = null
  let percent = 0
  if (targetW != null && targetW > 0) {
    const goalDelta = targetW - start
    const currentDelta = current - start
    remaining = Math.round((targetW - current) * 10) / 10
    if (Math.abs(goalDelta) > 0.1) {
      percent = Math.min(100, Math.max(0, Math.round((currentDelta / goalDelta) * 100)))
    }
  }

  // Rate of change over last 14 days
  let ratePerWeek = 0
  if (ewmaSeries.length >= 2) {
    const cutoff = Date.now() - 14 * 86400000
    const recent = ewmaSeries.filter(e => (e.t || new Date(e.d).getTime()) >= cutoff)
    if (recent.length >= 2) {
      const first = recent[0]
      const last = recent[recent.length - 1]
      const days = Math.max(1, (new Date(last.d) - new Date(first.d)) / 86400000)
      ratePerWeek = Math.round(((last.ewma - first.ewma) / days * 7) * 10) / 10
    }
  }

  return {
    current,
    start,
    trendWeight,
    target: targetW,
    totalChange,
    remaining,
    percent,
    ratePerWeek,
    hasData: true
  }
}

/**
 * BMR calculation using the clinically validated Mifflin-St Jeor equation.
 */
export function estimateBMR(weightKg, heightCm, age, sex = 'male') {
  if (!weightKg || !heightCm || !age) return null
  const s = String(sex).toLowerCase() === 'female' ? -161 : 5
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + s)
}

/**
 * TDEE and Plan Calorie Recommendation.
 */
export function calcTransformationPlanTargets(profile = {}, currentWeightKg = 75) {
  const { height, age, sex, planType = '3-month', customDeficit } = profile
  const bmr = estimateBMR(currentWeightKg, height, age, sex)
  if (!bmr) {
    return {
      maintenance: 2200,
      deficit: 350,
      targetCal: 1850,
      targetProtein: Math.round(currentWeightKg * 1.8),
      isEstimated: false
    }
  }

  // Lightly to moderately active gym lifter multiplier (~1.45)
  const maintenance = Math.round(bmr * 1.45)
  const preset = PLAN_PRESETS[planType] || PLAN_PRESETS['3-month']
  const deficit = planType === 'custom' && customDeficit ? Number(customDeficit) : preset.deficit
  
  // Safe floor of 1200 kcal to prevent extreme restriction
  const targetCal = Math.max(1200, maintenance - deficit)
  // Optimal protein intake for lean mass retention in deficit: ~1.8–2.0 g/kg
  const targetProtein = Math.round(currentWeightKg * 1.8)

  return {
    bmr,
    maintenance,
    deficit,
    targetCal,
    targetProtein,
    isEstimated: true
  }
}

/**
 * Body measurement deltas comparing baseline (first) to latest.
 */
export function compareMeasurements(measurements = []) {
  if (!measurements || measurements.length === 0) return []
  const sorted = [...measurements].sort((a, b) => (a.d < b.d ? -1 : 1))
  const baseline = sorted[0]
  const latest = sorted[sorted.length - 1]

  return MEASUREMENT_SITES.map(site => {
    const baseVal = baseline[site.id] != null ? Number(baseline[site.id]) : null
    const curVal = latest[site.id] != null ? Number(latest[site.id]) : null
    const diff = (baseVal != null && curVal != null) ? Math.round((curVal - baseVal) * 10) / 10 : null
    return {
      id: site.id,
      label: site.label,
      baseline: baseVal,
      current: curVal,
      diff
    }
  })
}
