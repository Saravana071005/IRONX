import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import BodyMap, { BodyMapLegend } from './BodyMap.jsx'
import {
  loadOfWorkouts,
  rankOf,
  MUSCLE_NAME,
  ANATOMICAL_MAP,
  musclesOf,
  MUSCLES,
  getExerciseMuscleBreakdown
} from '../lib/muscles.js'
import { isHardSet } from '../lib/effort.js'
import { todayISO } from '../lib/format.js'
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

const ANTERIOR_CHIPS = ['chest', 'deltoids', 'biceps', 'abs', 'obliques', 'quadriceps', 'adductors', 'calves']
const POSTERIOR_CHIPS = ['trapezius', 'deltoids', 'upper-back', 'lower-back', 'triceps', 'gluteal', 'hamstring', 'calves']

/**
 * MuscleBalanceChart
 * Premium Interactive Anatomical Muscle Balance Map.
 * Renders Front (Anterior) and Back (Posterior) human muscular anatomy diagrams with
 * dynamic highlighting based on real completed workout records.
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

  // Detailed breakdown of exercises that contributed to the selected muscle
  const selectedDetails = useMemo(() => {
    if (!sel) return null
    const muscleSlug = sel
    const info = ANATOMICAL_MAP[muscleSlug] || {}
    const muscleLabel = t(info.name || MUSCLE_NAME[muscleSlug] || muscleSlug)
    const anatomicalName = info.anatomical || muscleLabel
    const viewLabel = t(info.viewLabel || (info.view === 'back' ? 'Posterior (Back)' : 'Anterior (Front)'))
    const effectiveSets = setsOf(muscleSlug)

    const exerciseMap = new Map()

    for (const w of inWin) {
      const wDate = normalizeDateStr(w.d || w.date || w.start)
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
          const setStrings = completedSets.map(s => {
            const wVal = Number(s.w) || 0
            const rVal = Number(s.r) || 0
            return wVal > 0 ? `${wVal}kg × ${rVal}` : `${rVal} reps`
          })

          const key = e.id || e.name
          if (exerciseMap.has(key)) {
            const exData = exerciseMap.get(key)
            exData.sets += completedSets.length
            exData.volume += volumeKg
            exData.setDescriptions.push(...setStrings)
          } else {
            const isPrimary =
              breakdown.primary.includes(muscleSlug) ||
              exMeta?.tg?.toLowerCase() === muscleSlug ||
              weight >= 0.8
            exerciseMap.set(key, {
              id: key,
              name: e.name || exMeta?.n || key,
              isPrimary,
              workoutName: w.name || t('Strength Workout'),
              workoutDate: wDate,
              sets: completedSets.length,
              volume: volumeKg,
              setDescriptions: setStrings
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
      anatomicalName,
      viewLabel,
      effectiveSets,
      isTrained: effectiveSets > 0,
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
        padding: '24px 20px',
        borderRadius: 22,
        background: 'var(--surface, #090909)',
        backgroundImage: 'var(--grad-glass-surface)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--theme-accent-border, var(--borders, #303036))',
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
            <span style={{ color: 'var(--theme-accent, #F5F5F5)', display: 'flex' }}>
              <Icon name="dumbbell" size={20} />
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
            {t('Interactive Anatomical Stimulation & Recovery Map')}
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
            <Icon name="calendar" size={15} style={{ color: 'var(--theme-accent, #F5F5F5)' }} />
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
                  background: 'var(--borders, #303036)',
                  color: 'var(--theme-accent, #F5F5F5)',
                  border: '1px solid var(--borders, #303036)',
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
            <Icon name="calendar" size={15} style={{ color: 'var(--theme-accent, #F5F5F5)' }} />
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
                  background: 'var(--borders, #303036)',
                  color: 'var(--theme-accent, #F5F5F5)',
                  border: '1px solid var(--borders, #303036)',
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

      {/* CORE HERO COMPONENT: Human Body Muscle Anatomy Map (ALWAYS RENDERED) */}
      <div style={{ margin: '8px 0 16px', position: 'relative' }}>
        <BodyMap
          className="tappable"
          load={load}
          body={S?.body}
          selected={sel}
          onMuscle={m => setSel(s => (s === m ? null : m))}
          showLabels={true}
        />
      </div>

      {/* Anatomical Heatmap Legend */}
      <BodyMapLegend />

      {/* Summary Status Readout */}
      <div
        style={{
          marginTop: 14,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: hasActivity ? 'var(--theme-accent, #F5F5F5)' : '#555560',
              boxShadow: hasActivity
                ? '0 0 8px var(--theme-accent-glow, var(--borders, #303036))'
                : 'none'
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
            {hasActivity
              ? `${worked.length} / ${MUSCLES.length} ${t('Muscle Groups Stimulated')}`
              : win === 1
                ? t('Rest & Recovery Day · All muscles resting')
                : t('No muscle activity recorded in this period')}
          </span>
        </div>

        {!hasActivity && (
          <button
            onClick={() => nav('/workout')}
            style={{
              padding: '5px 12px',
              borderRadius: 9999,
              background: 'var(--borders, #303036)',
              color: 'var(--theme-accent, #F5F5F5)',
              border: '1px solid var(--borders, #303036)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span>{t('Log Workout')}</span>
            <Icon name="arrowRight" size={12} />
          </button>
        )}
      </div>

      {/* Interactive Muscle Inspection Card (when a muscle is selected) */}
      {selectedDetails && (
        <div
          style={{
            marginTop: 16,
            padding: '16px',
            borderRadius: 16,
            background: 'var(--surface-2, #141418)',
            border: '1px solid var(--theme-accent-border, var(--borders, #303036))',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 10
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: selectedDetails.isTrained
                      ? 'var(--theme-accent, #F5F5F5)'
                      : '#555560',
                    boxShadow: selectedDetails.isTrained
                      ? '0 0 10px var(--theme-accent-glow, var(--borders, #303036))'
                      : 'none'
                  }}
                />
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--label)' }}>
                  {selectedDetails.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: selectedDetails.isTrained
                      ? 'var(--borders, #303036)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: selectedDetails.isTrained
                      ? 'var(--theme-accent, #F5F5F5)'
                      : 'var(--label-3)',
                    border: selectedDetails.isTrained
                      ? '1px solid var(--borders, #303036)'
                      : '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  {selectedDetails.isTrained ? t('Trained') : t('Resting')}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--label-2)', marginTop: 3 }}>
                <em>{selectedDetails.anatomicalName}</em> · {selectedDetails.viewLabel}
              </div>
            </div>

            <button
              onClick={() => setSel(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--label-2)',
                cursor: 'pointer',
                padding: '4px'
              }}
              title={t('Close')}
            >
              <Icon name="xmark" size={16} />
            </button>
          </div>

          {selectedDetails.isTrained ? (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--theme-accent, #F5F5F5)',
                  marginBottom: 8
                }}
              >
                {selectedDetails.effectiveSets} {t('effective sets completed')}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedDetails.exercises.map(ex => (
                  <div
                    key={ex.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
                        {ex.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--label-2)', marginTop: 2 }}>
                        {ex.isPrimary ? (
                          <span style={{ color: 'var(--theme-accent, #F5F5F5)', fontWeight: 600 }}>
                            {t('Primary Target')}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--label-3)' }}>
                            {t('Supporting / Secondary')}
                          </span>
                        )}
                        {ex.workoutDate ? ` · ${ex.workoutDate}` : ''}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
                        {ex.sets} {t('sets')}
                      </div>
                      {ex.volume > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--label-2)', marginTop: 2 }}>
                          {Math.round(ex.volume).toLocaleString()} kg vol
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--label-2)', fontStyle: 'italic', marginTop: 4 }}>
              {t('This muscle group was not stimulated during this period. It is fully recovered.')}
            </div>
          )}
        </div>
      )}

      {/* Quick Anatomical Muscle Selectors */}
      <div style={{ marginTop: 18 }}>
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--label-2)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6
            }}
          >
            {t('Anterior / Front Muscles')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ANTERIOR_CHIPS.map(m => {
              const isSelected = sel === m
              const sets = setsOf(m)
              const isTrained = sets > 0
              return (
                <button
                  key={'ant_' + m}
                  onClick={() => setSel(s => (s === m ? null : m))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 9999,
                    background: isSelected
                      ? 'var(--theme-accent, #F5F5F5)'
                      : isTrained
                        ? 'var(--borders, #303036)'
                        : 'rgba(255, 255, 255, 0.03)',
                    color: isSelected
                      ? '#12100E'
                      : isTrained
                        ? 'var(--theme-accent, #F5F5F5)'
                        : 'var(--label-2)',
                    border: isSelected
                      ? '1px solid var(--theme-accent, #F5F5F5)'
                      : isTrained
                        ? '1px solid var(--borders, #303036)'
                        : '1px solid rgba(255, 255, 255, 0.07)',
                    fontSize: 11,
                    fontWeight: isSelected || isTrained ? 700 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isTrained ? 'var(--theme-accent, #F5F5F5)' : 'rgba(255, 255, 255, 0.25)'
                    }}
                  />
                  <span>{t(ANATOMICAL_MAP[m]?.frontName || MUSCLE_NAME[m] || m)}</span>
                  {isTrained && <span style={{ fontSize: 10, opacity: 0.85 }}>{sets}s</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--label-2)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6
            }}
          >
            {t('Posterior / Back Muscles')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {POSTERIOR_CHIPS.map(m => {
              const isSelected = sel === m
              const sets = setsOf(m)
              const isTrained = sets > 0
              return (
                <button
                  key={'post_' + m}
                  onClick={() => setSel(s => (s === m ? null : m))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 9999,
                    background: isSelected
                      ? 'var(--theme-accent, #F5F5F5)'
                      : isTrained
                        ? 'var(--borders, #303036)'
                        : 'rgba(255, 255, 255, 0.03)',
                    color: isSelected
                      ? '#12100E'
                      : isTrained
                        ? 'var(--theme-accent, #F5F5F5)'
                        : 'var(--label-2)',
                    border: isSelected
                      ? '1px solid var(--theme-accent, #F5F5F5)'
                      : isTrained
                        ? '1px solid var(--borders, #303036)'
                        : '1px solid rgba(255, 255, 255, 0.07)',
                    fontSize: 11,
                    fontWeight: isSelected || isTrained ? 700 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isTrained ? 'var(--theme-accent, #F5F5F5)' : 'rgba(255, 255, 255, 0.25)'
                    }}
                  />
                  <span>{t(ANATOMICAL_MAP[m]?.backName || MUSCLE_NAME[m] || m)}</span>
                  {isTrained && <span style={{ fontSize: 10, opacity: 0.85 }}>{sets}s</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
