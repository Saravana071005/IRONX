import { useState, useEffect, useMemo } from 'react'
import { t } from '../lib/i18n.js'
import { MUSCLES, INERT } from '../lib/muscles.js'
import { getTodayMuscleActivity, MUSCLE_DETAILS } from '../lib/muscleTracker.js'
import Icon from './Icon.jsx'

let CACHE = null
let PENDING = null

function useBodyPaths() {
  const [paths, setPaths] = useState(CACHE)
  useEffect(() => {
    if (CACHE) return
    let alive = true
    PENDING = PENDING || import('../lib/body-paths.js').then(m => (CACHE = m.default))
    PENDING.then(p => { if (alive) setPaths(p) }).catch(() => {})
    return () => { alive = false }
  }, [])
  return paths
}

function SvgBodyView({ view, muscleStatuses, onMuscleSelect, selectedMuscle, isFront }) {
  if (!view) return null

  return (
    <svg className="bm-v" viewBox={view.vb} role="img" style={{ maxHeight: 310, width: '100%', cursor: 'pointer' }}>
      {/* Inert silhouette paths (head, hair, hands, feet, etc.) */}
      {INERT.map(slug => (view.p[slug] || []).map((d, i) => (
        <path key={slug + i} className="bm-sil" d={d} />
      )))}

      {/* Muscle paths with completion / scheduled / untrained coloring */}
      {MUSCLES.map(slug => {
        const paths = view.p[slug] || []
        if (paths.length === 0) return null

        const statusInfo = muscleStatuses[slug] || { status: 'untrained' }
        const status = statusInfo.status
        const isSel = selectedMuscle === slug

        let fill = 'var(--bm-base)'
        let stroke = 'var(--surface)'
        let strokeWidth = '2'
        let strokeDasharray = 'none'

        if (status === 'completed') {
          fill = 'var(--mint)'
          stroke = 'var(--surface)'
          strokeWidth = '2'
        } else if (status === 'scheduled') {
          fill = 'color-mix(in srgb, var(--mint) 18%, var(--surface-2))'
          stroke = 'var(--mint)'
          strokeWidth = '2.5'
          strokeDasharray = '4 2'
        } else {
          fill = 'var(--bm-base)'
        }

        if (isSel) {
          stroke = 'var(--label)'
          strokeWidth = '5'
          strokeDasharray = 'none'
        }

        return paths.map((d, i) => (
          <path
            key={slug + i}
            d={d}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeLinejoin="round"
            style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
            onClick={() => onMuscleSelect(slug)}
          >
            <title>{MUSCLE_DETAILS[slug]?.name || slug}</title>
          </path>
        ))
      })}
    </svg>
  )
}

export default function TodayMuscleChart({ S, body = 'male' }) {
  const paths = useBodyPaths()
  const [viewMode, setViewMode] = useState('both') // 'front' | 'back' | 'both'
  const [selectedMuscle, setSelectedMuscle] = useState(null)

  const activity = useMemo(() => getTodayMuscleActivity(S), [S?.workouts, S?.active, S?.dayPlan, S?.weeklySchedule])
  const g = paths && (paths[body] || paths.male)

  const selectedInfo = useMemo(() => {
    if (!selectedMuscle) return null
    const meta = MUSCLE_DETAILS[selectedMuscle] || { name: selectedMuscle, region: 'Body' }
    const statusData = activity.muscleStatuses[selectedMuscle] || { status: 'untrained', data: {} }
    return {
      slug: selectedMuscle,
      meta,
      status: statusData.status,
      data: statusData.data
    }
  }, [selectedMuscle, activity])

  return (
    <div className="card" style={{ padding: '16px', marginBottom: 16 }}>
      {/* Section Header */}
      <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mint)', letterSpacing: '0.06em' }}>
            {t("TODAY'S MUSCLE ACTIVITY")}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)', marginTop: 2 }}>
            {activity.hasCompletedToday
              ? t('Muscles Trained Today')
              : activity.hasScheduledToday
                ? t('Scheduled Muscle Targets')
                : t('No Muscles Trained Today')}
          </div>
        </div>

        {/* View Toggle Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 3, borderRadius: 10 }}>
          <button
            type="button"
            className="btn sm"
            style={{
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 8,
              background: viewMode === 'front' ? 'var(--surface-1)' : 'transparent',
              color: viewMode === 'front' ? 'var(--mint)' : 'var(--label-2)',
              border: 'none',
              fontWeight: viewMode === 'front' ? 700 : 500,
              boxShadow: viewMode === 'front' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
            }}
            onClick={() => setViewMode('front')}
          >
            {t('Front Body')}
          </button>
          <button
            type="button"
            className="btn sm"
            style={{
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 8,
              background: viewMode === 'back' ? 'var(--surface-1)' : 'transparent',
              color: viewMode === 'back' ? 'var(--mint)' : 'var(--label-2)',
              border: 'none',
              fontWeight: viewMode === 'back' ? 700 : 500,
              boxShadow: viewMode === 'back' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
            }}
            onClick={() => setViewMode('back')}
          >
            {t('Back Body')}
          </button>
          <button
            type="button"
            className="btn sm"
            style={{
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 8,
              background: viewMode === 'both' ? 'var(--surface-1)' : 'transparent',
              color: viewMode === 'both' ? 'var(--mint)' : 'var(--label-2)',
              border: 'none',
              fontWeight: viewMode === 'both' ? 700 : 500,
              boxShadow: viewMode === 'both' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
            }}
            onClick={() => setViewMode('both')}
          >
            {t('Both')}
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          background: 'var(--surface-2)',
          padding: '10px 12px',
          borderRadius: 12,
          marginBottom: 14,
          textAlign: 'center'
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--label-3)', textTransform: 'uppercase', fontWeight: 600 }}>
            {t('Muscles Trained')}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: activity.muscleGroupsTrainedCount > 0 ? 'var(--mint)' : 'var(--label)' }}>
            {activity.muscleGroupsTrainedCount}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--label-3)', textTransform: 'uppercase', fontWeight: 600 }}>
            {t('Exercises')}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--label)' }}>
            {activity.completedExercisesCount}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--label-3)', textTransform: 'uppercase', fontWeight: 600 }}>
            {t('Sets Done')}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--label)' }}>
            {activity.completedSetsCount}
          </div>
        </div>
      </div>

      {/* Interactive Muscle Map */}
      <div
        className="bodymap tappable"
        style={{
          minHeight: 280,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          padding: '8px 0'
        }}
      >
        {g ? (
          <>
            {(viewMode === 'front' || viewMode === 'both') && (
              <div style={{ flex: 1, maxWidth: viewMode === 'both' ? 240 : 320, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-3)', marginBottom: 4, textTransform: 'uppercase' }}>
                  {t('Front')}
                </div>
                <SvgBodyView
                  view={g.front}
                  muscleStatuses={activity.muscleStatuses}
                  onMuscleSelect={slug => setSelectedMuscle(prev => prev === slug ? null : slug)}
                  selectedMuscle={selectedMuscle}
                  isFront={true}
                />
              </div>
            )}
            {(viewMode === 'back' || viewMode === 'both') && (
              <div style={{ flex: 1, maxWidth: viewMode === 'both' ? 240 : 320, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-3)', marginBottom: 4, textTransform: 'uppercase' }}>
                  {t('Back')}
                </div>
                <SvgBodyView
                  view={g.back}
                  muscleStatuses={activity.muscleStatuses}
                  onMuscleSelect={slug => setSelectedMuscle(prev => prev === slug ? null : slug)}
                  selectedMuscle={selectedMuscle}
                  isFront={false}
                />
              </div>
            )}
          </>
        ) : (
          <div className="bm-ph" aria-hidden="true" style={{ textAlign: 'center', color: 'var(--label-3)' }}>
            {t('Loading anatomical muscle map…')}
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          fontSize: 11,
          color: 'var(--label-2)',
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid var(--sep)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--mint)', display: 'inline-block' }} />
          <span>{t('Completed')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'color-mix(in srgb, var(--mint) 18%, var(--surface-2))', border: '1.5px dashed var(--mint)', display: 'inline-block' }} />
          <span>{t('Scheduled')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--bm-base)', border: '1px solid var(--sep)', display: 'inline-block' }} />
          <span>{t('Not trained')}</span>
        </div>
      </div>

      {/* Selected Muscle Detail Card */}
      {selectedInfo && (
        <div
          style={{
            marginTop: 12,
            padding: '12px 14px',
            background: 'var(--surface-2)',
            borderRadius: 12,
            border: '1px solid var(--sep)'
          }}
        >
          <div className="row between" style={{ alignItems: 'center', marginBottom: 8 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: selectedInfo.status === 'completed'
                    ? 'var(--mint)'
                    : selectedInfo.status === 'scheduled'
                      ? 'var(--amber)'
                      : 'var(--label-3)'
                }}
              />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>
                {selectedInfo.meta.name}
              </span>
            </div>
            <span
              className="tag"
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                background: selectedInfo.status === 'completed' ? 'var(--mint)' : 'var(--surface-1)',
                color: selectedInfo.status === 'completed' ? '#fff' : 'var(--label-2)'
              }}
            >
              {selectedInfo.status === 'completed'
                ? t('✓ Completed Today')
                : selectedInfo.status === 'scheduled'
                  ? t('Scheduled in Plan')
                  : t('Not Trained')}
            </span>
          </div>

          {selectedInfo.status === 'completed' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 6 }}>
                {t('Exercises Targeting {0}:', selectedInfo.meta.name)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(selectedInfo.data.exercises || []).map((ex, i) => (
                  <div
                    key={ex.id || i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 13,
                      padding: '4px 8px',
                      background: 'var(--surface-1)',
                      borderRadius: 8
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--label)' }}>
                      {ex.name}
                    </span>
                    <span style={{ color: 'var(--mint)', fontWeight: 700 }}>
                      {ex.sets} {t(ex.sets === 1 ? 'set' : 'sets')}
                      {ex.topWeight ? ` @ ${ex.topWeight}kg` : ''}
                    </span>
                  </div>
                ))}
              </div>
              {selectedInfo.data.totalDurationMin > 0 && (
                <div style={{ fontSize: 11, color: 'var(--label-3)', marginTop: 8 }}>
                  {t('Workout duration: ~{0} min', selectedInfo.data.totalDurationMin)}
                </div>
              )}
            </div>
          )}

          {selectedInfo.status === 'scheduled' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--label-2)', marginBottom: 6 }}>
                {t('Planned in today\'s scheduled routine:')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(selectedInfo.data.exercises || []).map((ex, i) => (
                  <div
                    key={ex.id || i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 13,
                      padding: '4px 8px',
                      background: 'var(--surface-1)',
                      borderRadius: 8
                    }}
                  >
                    <span style={{ color: 'var(--label)' }}>{ex.name}</span>
                    <span style={{ color: 'var(--label-2)', fontSize: 12 }}>
                      {ex.sets}×{ex.reps}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedInfo.status === 'untrained' && (
            <div style={{ fontSize: 12, color: 'var(--label-3)' }}>
              {t('No exercises targeting this muscle group today.')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
