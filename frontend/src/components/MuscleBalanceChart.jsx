import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import BodyMap, { BodyMapLegend } from './BodyMap.jsx'
import {
  loadOfWorkouts,
  rankOf,
  MUSCLE_NAME,
  musclesOf,
  MUSCLES,
  resolveExerciseMeta,
  getExerciseMuscleBreakdown
} from '../lib/muscles.js'
import { isHardSet } from '../lib/effort.js'
import { todayISO, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { Button, Segmented } from './ui.jsx'
import Icon from './Icon.jsx'

/**
 * Normalizes any date value (ISO string, timestamp, YYYY-MM-DD) to YYYY-MM-DD
 */
function normalizeDateStr(val) {
  if (!val) return ''
  if (typeof val === 'string') {
    const s = val.trim()
    if (s.length >= 10 && s[4] === '-' && s[7] === '-') return s.slice(0, 10)
  }
  try {
    const dt = new Date(val)
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear()
      const m = String(dt.getMonth() + 1).padStart(2, '0')
      const d = String(dt.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  } catch {}
  return ''
}

/**
 * Shifts a YYYY-MM-DD date by N days
 */
function shiftDate(isoStr, days) {
  try {
    const [y, m, d] = isoStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + days)
    const ry = dt.getFullYear()
    const rm = String(dt.getMonth() + 1).padStart(2, '0')
    const rd = String(dt.getDate()).padStart(2, '0')
    return `${ry}-${rm}-${rd}`
  } catch {
    return isoStr
  }
}

/**
 * Formats YYYY-MM-DD into a human-friendly label
 */
function formatDateLabel(isoStr, today) {
  if (!isoStr) return ''
  if (isoStr === today) return `${t('Today')} (${isoStr})`
  const yesterday = shiftDate(today, -1)
  if (isoStr === yesterday) return `${t('Yesterday')} (${isoStr})`
  try {
    const [y, m, d] = isoStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return isoStr
  }
}

/**
 * Returns Monday..Sunday bounds for a given week offset from today (0 = current week)
 */
function getWeekBounds(offset = 0) {
  const base = new Date()
  const day = (base.getDay() + 6) % 7 // 0=Mon, 6=Sun
  const mon = new Date(base.getFullYear(), base.getMonth(), base.getDate() - day + offset * 7)
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)

  const toIso = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const startStr = toIso(mon)
  const endStr = toIso(sun)
  const label = `${mon.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  return { startStr, endStr, label }
}

/**
 * MuscleBalanceChart
 * Visualizes targeted and loaded muscle groups from completed workouts.
 * Supports Day | Week | 30 Days | 90 Days | All filters with date selection and week navigation.
 * Interactive muscle inspection showing exercises, sets, volume, and primary vs secondary distinctions.
 */
export default function MuscleBalanceChart({ S }) {
  const nav = useNavigate()
  const todayStr = useMemo(() => todayISO(), [])

  // Filter window: 1 (Day), 7 (Week), 30 (30 Days), 90 (90 Days), 0 (All)
  const [win, setWin] = useState(7)
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [weekOffset, setWeekOffset] = useState(0)
  const [hard, setHard] = useState(false)
  const [sel, setSel] = useState(null)

  // Current week bounds
  const currentWeek = useMemo(() => getWeekBounds(weekOffset), [weekOffset])

  // Filter completed workouts strictly by selected window and verified completed sets
  const inWin = useMemo(() => {
    const workouts = S?.workouts || []
    return workouts.filter(w => {
      if (!w) return false
      // Only workouts with at least one completed set
      const hasCompletedSets = (w.entries || []).some(e => (e.sets || []).some(s => s && s.done))
      if (!hasCompletedSets) return false

      const wDate = normalizeDateStr(w.d || w.date || w.start)
      if (!wDate) return false

      if (win === 1) {
        return wDate === selectedDate
      }
      if (win === 7) {
        return wDate >= currentWeek.startStr && wDate <= currentWeek.endStr
      }
      if (win === 30) {
        const cutoff = shiftDate(todayStr, -30)
        return wDate >= cutoff && wDate <= todayStr
      }
      if (win === 90) {
        const cutoff = shiftDate(todayStr, -90)
        return wDate >= cutoff && wDate <= todayStr
      }
      return true // All
    })
  }, [S?.workouts, win, selectedDate, currentWeek, todayStr])

  const rated = useMemo(() => {
    return inWin.some(w =>
      (w.entries || []).some(e => (e.sets || []).some(s => s && s.done && isHardSet(s)))
    )
  }, [inWin])

  const on = hard && rated
  const load = useMemo(() => {
    return loadOfWorkouts(inWin, on ? isHardSet : null, S?.customEx)
  }, [inWin, on, S?.customEx])

  const { worked } = useMemo(() => rankOf(load), [load])

  const setsOf = m => Math.round((load[m] || 0) * 10) / 10

  // Detailed breakdown of each completed workout and exercise in the current window
  const workoutDetailsList = useMemo(() => {
    return inWin.map(w => {
      const durM = w.dur ? Math.max(1, Math.round(w.dur / 60000)) : null
      const exercises = (w.entries || [])
        .filter(e => e.sets && e.sets.some(s => s && s.done))
        .map(e => {
          const breakdown = getExerciseMuscleBreakdown(e.id, e, S?.customEx)
          const doneSets = (e.sets || []).filter(s => s && s.done && (!on || isHardSet(s)))
          const setDescriptions = doneSets.map(s => {
            const wVal = Number(s.w) || 0
            const rVal = Number(s.r) || 0
            return wVal > 0 ? `${wVal}kg × ${rVal}` : `${rVal} reps`
          })
          const volume = doneSets.reduce(
            (sum, s) => sum + (Number(s.w) || 0) * (Number(s.r) || 0),
            0
          )
          return {
            id: e.id,
            name: e.name || e.n || breakdown.meta?.n || e.id,
            primaryMuscles: breakdown.primary,
            secondaryMuscles: breakdown.secondary,
            primaryNames: breakdown.primaryNames,
            secondaryNames: breakdown.secondaryNames,
            setsCount: doneSets.length,
            setDescriptions,
            volume
          }
        })

      return {
        id: w.id,
        name: w.name || t('Strength Workout'),
        date: normalizeDateStr(w.d || w.date || w.start),
        durationMinutes: durM,
        volume: w.vol || exercises.reduce((acc, ex) => acc + ex.volume, 0),
        exercises
      }
    })
  }, [inWin, S?.customEx, on])

  // Aggregate trained primary vs secondary vs untrained muscle groups across the current window
  const muscleClassification = useMemo(() => {
    const primarySet = new Set()
    const secondarySet = new Set()

    workoutDetailsList.forEach(w => {
      w.exercises.forEach(ex => {
        ex.primaryMuscles.forEach(m => primarySet.add(m))
        ex.secondaryMuscles.forEach(m => {
          if (!primarySet.has(m)) secondarySet.add(m)
        })
      })
    })

    // If a muscle became primary, remove from secondary
    primarySet.forEach(m => secondarySet.delete(m))

    const trainedPrimary = Array.from(primarySet)
    const trainedSecondary = Array.from(secondarySet)
    const untrained = MUSCLES.filter(m => !primarySet.has(m) && !secondarySet.has(m))

    return {
      trainedPrimary,
      trainedSecondary,
      untrained
    }
  }, [workoutDetailsList])

  // Detailed breakdown of exercises that contributed to the selected muscle
  const selectedDetails = useMemo(() => {
    if (!sel) return null
    const muscleSlug = sel
    const muscleLabel = t(MUSCLE_NAME[muscleSlug] || muscleSlug)
    const effectiveSets = setsOf(muscleSlug)

    const exerciseMap = new Map()

    for (const w of inWin) {
      for (const e of w.entries || []) {
        if (!e) continue
        const breakdown = getExerciseMuscleBreakdown(e.id, e, S?.customEx)
        const exMeta = breakdown.meta
        const muscleWeights = musclesOf(exMeta || { bp: e.bodyPart || e.bp })
        const weight = muscleWeights[muscleSlug]

        if (weight && weight > 0) {
          const completedSets = (e.sets || []).filter(
            s => s && s.done && (!on || isHardSet(s))
          )
          if (completedSets.length === 0) continue

          const volumeKg = completedSets.reduce(
            (sum, s) => sum + (Number(s.w) || 0) * (Number(s.r) || 0),
            0
          )
          const totalReps = completedSets.reduce((sum, s) => sum + (Number(s.r) || 0), 0)

          const key = e.id || e.name
          if (exerciseMap.has(key)) {
            const exData = exerciseMap.get(key)
            exData.sets += completedSets.length
            exData.volume += volumeKg
            exData.reps += totalReps
          } else {
            const isPrimary =
              breakdown.primary.includes(muscleSlug) ||
              exMeta?.tg?.toLowerCase() === muscleSlug ||
              weight >= 0.8
            exerciseMap.set(key, {
              id: key,
              name: exMeta?.n || e.name || key,
              isPrimary,
              weight,
              sets: completedSets.length,
              volume: volumeKg,
              reps: totalReps
            })
          }
        }
      }
    }

    const contributingExercises = Array.from(exerciseMap.values()).sort(
      (a, b) => b.sets - a.sets
    )

    return {
      slug: muscleSlug,
      name: muscleLabel,
      effectiveSets,
      exercises: contributingExercises
    }
  }, [sel, inWin, on, load, S?.customEx])

  const filterOptions = [
    { value: 1, label: t('Day') },
    { value: 7, label: t('Week') },
    { value: 30, label: t('30 Days') },
    { value: 90, label: t('90 Days') },
    { value: 0, label: t('All') }
  ]

  const hasActivity = inWin.length > 0 && worked.length > 0

  const navBtnStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: 'var(--label)',
    borderRadius: 8,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  }

  return (
    <div
      className="card muscle-balance-card"
      style={{
        padding: '24px',
        borderRadius: 22,
        background: 'var(--surface)',
        backgroundImage: 'var(--grad-glass-surface)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--theme-accent-border, var(--border-gold))',
        boxShadow: 'var(--card-shadow), var(--glass-highlight)',
        marginBottom: 18,
        position: 'relative'
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--theme-accent, #E8B477)', display: 'flex' }}>
              <Icon name="dumbbell" size={18} />
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: 'var(--label)',
                letterSpacing: '-0.015em',
                fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
              }}
            >
              {t('Muscle Balance')}
            </h2>
          </div>
          <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 3 }}>
            {on
              ? t('Tracking hard sets near failure')
              : t('Targeted training load across muscle groups')}
          </div>
        </div>

        {rated && (
          <Button
            size="sm"
            icon="flame"
            style={on ? { color: 'var(--amber)', borderColor: 'var(--amber)' } : undefined}
            onClick={() => {
              setHard(h => !h)
              setSel(null)
            }}
          >
            {on ? t('Hard sets') : t('All sets')}
          </Button>
        )}
      </div>

      {/* Range Segmented Tabs: Day | Week | 30 Days | 90 Days | All */}
      <div style={{ marginBottom: 12 }}>
        <Segmented
          className="seg-range"
          value={win}
          onChange={v => {
            setWin(v)
            setSel(null)
          }}
          options={filterOptions}
        />
      </div>

      {/* Date Navigation for Day Filter */}
      {win === 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 16,
            padding: '8px 12px',
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)'
          }}
        >
          <button
            aria-label="Previous day"
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            style={navBtnStyle}
            title={t('Previous Day')}
          >
            <Icon name="chevronLeft" size={16} />
          </button>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <Icon name="calendar" size={15} style={{ color: 'var(--theme-accent, #E8B477)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
              {formatDateLabel(selectedDate, todayStr)}
            </span>
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              style={{
                opacity: 0,
                width: 24,
                height: 24,
                position: 'absolute',
                left: 0,
                top: 0,
                cursor: 'pointer'
              }}
              title={t('Select Date')}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {selectedDate !== todayStr && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 9999,
                  background: 'rgba(232, 180, 119, 0.15)',
                  color: 'var(--theme-accent, #E8B477)',
                  border: '1px solid rgba(232, 180, 119, 0.3)',
                  cursor: 'pointer'
                }}
              >
                {t('Today')}
              </button>
            )}
            <button
              aria-label="Next day"
              disabled={selectedDate >= todayStr}
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              style={{
                ...navBtnStyle,
                opacity: selectedDate >= todayStr ? 0.3 : 1,
                cursor: selectedDate >= todayStr ? 'not-allowed' : 'pointer'
              }}
              title={t('Next Day')}
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Week Navigator for Week Filter */}
      {win === 7 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 16,
            padding: '8px 12px',
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)'
          }}
        >
          <button
            aria-label="Previous week"
            onClick={() => setWeekOffset(w => w - 1)}
            style={navBtnStyle}
            title={t('Previous Week')}
          >
            <Icon name="chevronLeft" size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="calendar" size={15} style={{ color: 'var(--theme-accent, #E8B477)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
              {currentWeek.label}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 9999,
                  background: 'rgba(232, 180, 119, 0.15)',
                  color: 'var(--theme-accent, #E8B477)',
                  border: '1px solid rgba(232, 180, 119, 0.3)',
                  cursor: 'pointer'
                }}
              >
                {t('Current Week')}
              </button>
            )}
            <button
              aria-label="Next week"
              disabled={weekOffset >= 0}
              onClick={() => setWeekOffset(w => w + 1)}
              style={{
                ...navBtnStyle,
                opacity: weekOffset >= 0 ? 0.3 : 1,
                cursor: weekOffset >= 0 ? 'not-allowed' : 'pointer'
              }}
              title={t('Next Week')}
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {hasActivity ? (
        <div>
          {/* Anatomical Heatmap SVG */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 6px' }}>
            <BodyMap
              className="tappable"
              load={load}
              body={S?.body}
              selected={sel}
              onMuscle={m => setSel(s => (s === m ? null : m))}
            />
          </div>

          <BodyMapLegend />

          {/* Muscle Status Categorization Summary */}
          <div
            style={{
              marginTop: 18,
              padding: '14px',
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}
          >
            {/* Primary Muscles */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--theme-accent, #E8B477)',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--theme-accent, #E8B477)'
                  }}
                />
                <span>{t('Primary Target Muscles')}</span>
                <span style={{ opacity: 0.6 }}>({muscleClassification.trainedPrimary.length})</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {muscleClassification.trainedPrimary.map(m => {
                  const isSelected = sel === m
                  const sets = setsOf(m)
                  return (
                    <button
                      key={m}
                      onClick={() => setSel(s => (s === m ? null : m))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 9999,
                        background: isSelected
                          ? 'var(--theme-accent, #E8B477)'
                          : 'rgba(232, 180, 119, 0.12)',
                        color: isSelected ? '#12100E' : 'var(--theme-accent, #E8B477)',
                        border: isSelected
                          ? '1px solid var(--theme-accent, #E8B477)'
                          : '1px solid rgba(232, 180, 119, 0.28)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      <span>{t(MUSCLE_NAME[m] || m)}</span>
                      <span style={{ fontSize: 10, opacity: 0.8 }}>{sets}s</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Secondary / Supporting Muscles */}
            {muscleClassification.trainedSecondary.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--label-2)',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.35)'
                    }}
                  />
                  <span>{t('Secondary / Supporting Muscles')}</span>
                  <span style={{ opacity: 0.6 }}>({muscleClassification.trainedSecondary.length})</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {muscleClassification.trainedSecondary.map(m => {
                    const isSelected = sel === m
                    const sets = setsOf(m)
                    return (
                      <button
                        key={m}
                        onClick={() => setSel(s => (s === m ? null : m))}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 9999,
                          background: isSelected
                            ? 'rgba(255, 255, 255, 0.2)'
                            : 'rgba(255, 255, 255, 0.04)',
                          color: isSelected ? '#FFFFFF' : 'var(--label-2)',
                          border: isSelected
                            ? '1px solid rgba(255, 255, 255, 0.4)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                      >
                        <span>{t(MUSCLE_NAME[m] || m)}</span>
                        <span style={{ fontSize: 10, opacity: 0.7 }}>{sets}s</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Inspection Card when a Muscle is Tapped */}
          {selectedDetails && (
            <div
              style={{
                marginTop: 16,
                padding: '16px',
                borderRadius: 16,
                background: 'var(--surface-2)',
                border: '1px solid var(--theme-accent-border, rgba(232, 180, 119, 0.35))',
                animation: 'fadeIn 0.2s ease'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--theme-accent, #E8B477)',
                      boxShadow: '0 0 8px var(--theme-accent-glow, rgba(232, 180, 119, 0.5))'
                    }}
                  />
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--label)' }}>
                    {selectedDetails.name}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--theme-accent, #E8B477)'
                  }}
                >
                  {selectedDetails.effectiveSets} {t('effective sets')}
                </div>
              </div>

              {selectedDetails.exercises.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {selectedDetails.exercises.map(ex => (
                    <div
                      key={ex.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
                          {ex.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--label-2)', marginTop: 2 }}>
                          {ex.isPrimary ? (
                            <span
                              style={{
                                color: 'var(--theme-accent, #E8B477)',
                                fontWeight: 600
                              }}
                            >
                              {t('Primary Target')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--label-3)' }}>
                              {t('Secondary / Supporting')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
                          {ex.sets} {t('sets')}
                        </div>
                        {ex.volume > 0 && (
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--label-2)',
                              marginTop: 2
                            }}
                          >
                            {Math.round(ex.volume).toLocaleString()} kg vol
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--label-3)',
                    fontStyle: 'italic',
                    marginTop: 6
                  }}
                >
                  {t('Trained indirectly through compound movements.')}
                </div>
              )}
            </div>
          )}

          {/* Daily Muscle Training Details Breakdown */}
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: 'var(--label)',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Icon name="clipboard" size={16} style={{ color: 'var(--theme-accent, #E8B477)' }} />
              <span>
                {win === 1
                  ? t('Daily Workout & Muscle Training Details')
                  : t('Completed Workout Details')}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {workoutDetailsList.map(w => (
                <div
                  key={w.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.07)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                      flexWrap: 'wrap',
                      gap: 8
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--label)' }}>
                        {w.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--label-2)', marginTop: 2 }}>
                        {w.date}
                        {w.durationMinutes ? ` · ${w.durationMinutes} min` : ''}
                        {w.volume > 0 ? ` · ${Math.round(w.volume).toLocaleString()} kg vol` : ''}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(232, 180, 119, 0.15)',
                        color: 'var(--theme-accent, #E8B477)',
                        border: '1px solid rgba(232, 180, 119, 0.3)'
                      }}
                    >
                      {w.exercises.length} {t('exercises')}
                    </span>
                  </div>

                  {/* Exercises Performed */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {w.exercises.map((ex, idx) => (
                      <div
                        key={ex.id + '_' + idx}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.04)'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 4
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
                            {ex.name}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: 'var(--theme-accent, #E8B477)'
                            }}
                          >
                            {ex.setsCount} {t('sets')}
                          </span>
                        </div>

                        {/* Sets & Reps detail */}
                        {ex.setDescriptions && ex.setDescriptions.length > 0 && (
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--label-2)',
                              marginBottom: 6,
                              fontFamily: 'monospace'
                            }}
                          >
                            {ex.setDescriptions.join(', ')}
                          </div>
                        )}

                        {/* Muscle Badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {ex.primaryNames.map(pn => (
                            <span
                              key={pn}
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: 'rgba(232, 180, 119, 0.16)',
                                color: 'var(--theme-accent, #E8B477)',
                                border: '1px solid rgba(232, 180, 119, 0.3)'
                              }}
                            >
                              {t('Primary')}: {t(pn)}
                            </span>
                          ))}
                          {ex.secondaryNames.map(sn => (
                            <span
                              key={sn}
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--label-3)',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                              }}
                            >
                              {t('Secondary')}: {t(sn)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div
          style={{
            padding: '36px 16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--theme-accent-light, rgba(232, 180, 119, 0.12))',
              border: '1px solid var(--theme-accent-border, rgba(232, 180, 119, 0.25))',
              color: 'var(--theme-accent, #E8B477)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4
            }}
          >
            <Icon name="dumbbell" size={24} />
          </div>

          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--label)',
              fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
            }}
          >
            {win === 1
              ? selectedDate === todayStr
                ? t('No muscle activity recorded today.')
                : t('No muscle activity recorded on this date.')
              : t('No muscle activity recorded yet.')}
          </div>

          <div
            style={{
              fontSize: 13,
              color: 'var(--label-2)',
              maxWidth: 360,
              lineHeight: 1.45,
              margin: '0 auto 10px'
            }}
          >
            {win === 1
              ? selectedDate === todayStr
                ? t(
                    'Complete your daily workout to visualize which muscle groups were stimulated today.'
                  )
                : t(
                    'No completed workouts were found for this selected day. Choose another date or log a workout.'
                  )
              : t(
                  'Complete strength workouts to see your anatomical muscle balance and recovery load.'
                )}
          </div>

          <button
            onClick={() => nav('/workout')}
            style={{
              padding: '9px 20px',
              borderRadius: 9999,
              background:
                'var(--theme-accent-gradient, linear-gradient(135deg, #FFD09A 0%, #E8B477 100%))',
              color: '#12100E',
              fontWeight: 800,
              fontSize: 13,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 14px var(--theme-accent-glow, rgba(232, 180, 119, 0.35))'
            }}
          >
            <Icon name="arrowRight" size={14} />
            <span>{t('Go to Workouts')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
