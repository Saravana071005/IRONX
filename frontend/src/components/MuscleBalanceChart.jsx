import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import BodyMap, { BodyMapLegend } from './BodyMap.jsx'
import { loadOfWorkouts, rankOf, MUSCLE_NAME, musclesOf, MUSCLES, resolveExerciseMeta } from '../lib/muscles.js'
import { EXIDX } from '../lib/exercises.js'
import { isHardSet } from '../lib/effort.js'
import { todayISO, weekKey, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { Button, Segmented } from './ui.jsx'
import Icon from './Icon.jsx'

/**
 * MuscleBalanceChart
 * Visualizes targeted and loaded muscle groups from completed workouts.
 * Supports Day | Week | 30 Days | 90 Days | All filters.
 * Interactive muscle inspection showing exercises, sets, and volume.
 */
export default function MuscleBalanceChart({ S }) {
  const nav = useNavigate()
  // Filter window: 1 (Day), 7 (Week), 30 (30 Days), 90 (90 Days), 0 (All)
  const [win, setWin] = useState(7)
  const [hard, setHard] = useState(false)
  const [sel, setSel] = useState(null)

  const todayStr = useMemo(() => todayISO(), [])
  const now = Date.now()

  // Filter completed workouts by selected window
  const inWin = useMemo(() => {
    const workouts = S?.workouts || []
    return workouts.filter(w => {
      if (!w) return false
      const dStr = w.d || w.date || ''
      if (win === 1) return dStr === todayStr
      if (win === 7) return weekKey(dStr) === weekKey(todayStr)
      if (win === 30) return (w.start || new Date(dStr).getTime()) > now - 30 * 86400000
      if (win === 90) return (w.start || new Date(dStr).getTime()) > now - 90 * 86400000
      return true
    })
  }, [S?.workouts, win, todayStr, now])

  const rated = useMemo(() => {
    return inWin.some(w => (w.entries || []).some(e => (e.sets || []).some(s => s && s.done && isHardSet(s))))
  }, [inWin])

  const on = hard && rated
  const load = useMemo(() => {
    return loadOfWorkouts(inWin, on ? isHardSet : null, S?.customEx)
  }, [inWin, on, S?.customEx])

  const { worked } = useMemo(() => rankOf(load), [load])
  const totalWorkedSets = useMemo(() => {
    return Object.values(load).reduce((acc, v) => acc + (Number(v) || 0), 0)
  }, [load])

  const setsOf = m => Math.round((load[m] || 0) * 10) / 10

  // Detailed breakdown of exercises that contributed to the selected muscle
  const selectedDetails = useMemo(() => {
    if (!sel) return null
    const muscleSlug = sel
    const muscleLabel = t(MUSCLE_NAME[muscleSlug] || muscleSlug)
    const effectiveSets = setsOf(muscleSlug)

    const exerciseMap = new Map()

    for (const w of inWin) {
      for (const e of (w.entries || [])) {
        if (!e) continue
        const exMeta = resolveExerciseMeta(e.id, e, S?.customEx)
        const muscleWeights = musclesOf(exMeta || { bp: e.bodyPart || e.bp })
        const weight = muscleWeights[muscleSlug]

        if (weight && weight > 0) {
          const completedSets = (e.sets || []).filter(s => s && s.done && (!on || isHardSet(s)))
          if (completedSets.length === 0) continue

          const volumeKg = completedSets.reduce((sum, s) => sum + (Number(s.w) || 0) * (Number(s.r) || 0), 0)
          const totalReps = completedSets.reduce((sum, s) => sum + (Number(s.r) || 0), 0)

          const key = e.id || e.name
          if (exerciseMap.has(key)) {
            const exData = exerciseMap.get(key)
            exData.sets += completedSets.length
            exData.volume += volumeKg
            exData.reps += totalReps
          } else {
            const isPrimary = (exMeta?.tg?.toLowerCase() === muscleSlug) || weight >= 0.8
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

    const contributingExercises = Array.from(exerciseMap.values()).sort((a, b) => b.sets - a.sets)

    return {
      slug: muscleSlug,
      name: muscleLabel,
      effectiveSets,
      exercises: contributingExercises
    }
  }, [sel, inWin, on, load])

  const filterOptions = [
    { value: 1, label: t('Day') },
    { value: 7, label: t('Week') },
    { value: 30, label: t('30 Days') },
    { value: 90, label: t('90 Days') },
    { value: 0, label: t('All') }
  ]

  const hasActivity = inWin.length > 0 && worked.length > 0

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
            {on ? t('Tracking hard sets near failure') : t('Targeted training load across muscle groups')}
          </div>
        </div>

        {rated && (
          <Button
            size="sm"
            icon="flame"
            style={on ? { color: 'var(--amber)', borderColor: 'var(--amber)' } : undefined}
            onClick={() => { setHard(h => !h); setSel(null) }}
          >
            {on ? t('Hard sets') : t('All sets')}
          </Button>
        )}
      </div>

      {/* Range Segmented Tabs: Day | Week | 30 Days | 90 Days | All */}
      <div style={{ marginBottom: 16 }}>
        <Segmented
          className="seg-range"
          value={win}
          onChange={v => { setWin(v); setSel(null) }}
          options={filterOptions}
        />
      </div>

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

          {/* Quick Muscle Selector Chips */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-2)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
              {t('Trained Muscles')} ({worked.length})
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8
              }}
            >
              {worked.map(m => {
                const isSelected = sel === m
                const sets = setsOf(m)
                return (
                  <button
                    key={m}
                    onClick={() => setSel(s => (s === m ? null : m))}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 9999,
                      background: isSelected
                        ? 'var(--theme-accent, #E8B477)'
                        : 'var(--surface-2)',
                      color: isSelected ? '#12100E' : 'var(--label)',
                      border: isSelected
                        ? '1px solid var(--theme-accent, #E8B477)'
                        : '1px solid var(--theme-accent-border, rgba(232, 180, 119, 0.2))',
                      fontSize: 12,
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{t(MUSCLE_NAME[m] || m)}</span>
                    <span
                      style={{
                        fontSize: 11,
                        opacity: isSelected ? 0.9 : 0.65,
                        fontWeight: 700
                      }}
                    >
                      {sets}s
                    </span>
                  </button>
                )
              })}
            </div>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
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
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-accent, #E8B477)' }}>
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
                            <span style={{ color: 'var(--theme-accent, #E8B477)', fontWeight: 600 }}>
                              {t('Primary Target')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--label-3)' }}>
                              {t('Secondary / Stabilizer')}
                            </span>
                          )}
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
              ) : (
                <div style={{ fontSize: 12, color: 'var(--label-3)', fontStyle: 'italic', marginTop: 6 }}>
                  {t('Trained indirectly through compound movements.')}
                </div>
              )}
            </div>
          )}
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
              ? t('No muscle activity recorded today.')
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
              ? t('Complete your daily workout to visualize which muscle groups were stimulated today.')
              : t('Complete strength workouts to see your anatomical muscle balance and recovery load.')}
          </div>

          <button
            onClick={() => nav('/workout')}
            style={{
              padding: '9px 20px',
              borderRadius: 9999,
              background: 'var(--theme-accent-gradient, linear-gradient(135deg, #FFD09A 0%, #E8B477 100%))',
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
