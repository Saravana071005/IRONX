import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { workoutDetailSheet, cardioSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { exOr } from '../lib/exercises.js'
import { fmtDate, fmtNum, uid, todayISO } from '../lib/format.js'

export default function History() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { toast } = useUI()

  const workouts = S.workouts || []
  const cardioLogs = S.cardioLogs || []

  const [activeTab, setActiveTab] = useState('All') // 'All', 'Strength', 'Cardio'
  const [search, setSearch] = useState('')

  // Compute aggregate real statistics from actual workout history
  const stats = useMemo(() => {
    let totalSets = 0
    let totalReps = 0
    let totalVolume = 0
    let totalStrengthMin = 0
    let totalCardioMin = 0
    let totalDistanceKm = 0

    workouts.forEach(w => {
      const dur = Math.round((w.end && w.start ? w.end - w.start : (w.dur || 0)) / 60000)
      const isCardio = (w.entries || []).every(e => exOr(e.id)?.bp === 'cardio') || (w.name || '').toLowerCase().includes('cardio')
      if (isCardio) {
        totalCardioMin += dur
      } else {
        totalStrengthMin += dur
      }

      ;(w.entries || []).forEach(e => {
        ;(e.sets || []).forEach(s => {
          if (s.done && !s.warmup) {
            totalSets++
            totalReps += Number(s.r) || 0
            totalVolume += (Number(s.w) || 0) * (Number(s.r) || 0)
          }
        })
      })
    })

    cardioLogs.forEach(c => {
      const cMin = Number(c.totalDurationMinutes) || ((Number(c.durationHours) || 0) * 60 + (Number(c.durationMinutes) || 0)) || Number(c.duration_min) || 0
      totalCardioMin += cMin
      totalDistanceKm += Number(c.distanceKm) || Number(c.distance_km) || 0
    })

    return {
      totalWorkouts: workouts.length + cardioLogs.length,
      strengthWorkouts: workouts.length,
      cardioSessions: cardioLogs.length,
      totalSets,
      totalReps,
      totalVolume: Math.round(totalVolume),
      totalDurationMin: totalStrengthMin + totalCardioMin,
      totalCardioMin,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10
    }
  }, [workouts, cardioLogs])

  // Unified chronological timeline: Strength workouts + Cardio logs
  const unifiedHistory = useMemo(() => {
    const list = []

    workouts.forEach(w => {
      const isCardio = (w.entries || []).every(e => exOr(e.id)?.bp === 'cardio') || (w.name || '').toLowerCase().includes('cardio')
      list.push({
        id: w.id,
        kind: isCardio ? 'cardio_legacy' : 'strength',
        date: w.d || '',
        timestamp: w.end || w.start || (w.d ? new Date(w.d).getTime() : 0),
        data: w
      })
    })

    cardioLogs.forEach(c => {
      list.push({
        id: c.id,
        kind: 'cardio',
        date: c.d || '',
        timestamp: c.createdAt ? new Date(c.createdAt).getTime() : (c.d ? new Date(c.d).getTime() : 0),
        data: c
      })
    })

    // Sort descending by date/timestamp
    list.sort((a, b) => {
      if (b.date !== a.date) return (b.date || '').localeCompare(a.date || '')
      return (b.timestamp || 0) - (a.timestamp || 0)
    })

    const q = search.trim().toLowerCase()
    return list.filter(item => {
      if (activeTab === 'Strength' && item.kind !== 'strength') return false
      if (activeTab === 'Cardio' && item.kind !== 'cardio' && item.kind !== 'cardio_legacy') return false

      if (!q) return true

      if (item.kind === 'strength' || item.kind === 'cardio_legacy') {
        const w = item.data
        const matchName = (w.name || '').toLowerCase().includes(q)
        const matchDate = (w.d || '').includes(q)
        const matchEx = (w.entries || []).some(e => {
          const ex = exOr(e.id)
          return (ex?.n || e.n || '').toLowerCase().includes(q)
        })
        return matchName || matchDate || matchEx
      } else {
        const c = item.data
        const matchActivity = (c.activity || '').toLowerCase().includes(q)
        const matchDate = (c.d || '').includes(q)
        return matchActivity || matchDate
      }
    })
  }, [workouts, cardioLogs, activeTab, search])

  // Weekly workout volume chart data (last 7 recorded strength sessions)
  const recentVolumeData = useMemo(() => {
    return workouts
      .slice(-7)
      .map(w => {
        let vol = 0
        ;(w.entries || []).forEach(e => {
          ;(e.sets || []).forEach(s => {
            if (s.done && !s.warmup) vol += (Number(s.w) || 0) * (Number(s.r) || 0)
          })
        })
        return {
          d: w.d?.slice(5) || '',
          name: w.name || 'Workout',
          vol: Math.round(vol)
        }
      })
  }, [workouts])

  const maxVol = Math.max(1, ...recentVolumeData.map(d => d.vol))

  // Repeat Workout Handler
  const handleRepeatWorkout = (w, e) => {
    e.stopPropagation()
    update(s => {
      s.active = {
        id: 'w_' + uid(),
        routineId: w.routineId || null,
        groupId: w.groupId || null,
        name: w.name || t('Workout'),
        category: w.category || null,
        type: 'strength',
        d: todayISO(),
        start: Date.now(),
        cur: 0,
        entries: (w.entries || []).map(ent => ({
          id: ent.id,
          name: ent.name || ent.n || ent.id,
          target: ent.target || { reps: 10, sets: ent.sets?.length || 3 },
          sets: (ent.sets || []).map(s => ({
            r: Number(s.r) || 10,
            w: Number(s.w) || 0,
            sec: s.sec,
            done: false
          }))
        }))
      }
    })
    toast(t('Loaded workout into new active session'))
    nav('/workout')
  }

  return (
    <div className="narrow">
      {/* Header */}
      <div className="hdr" style={{ alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="iconbtn" onClick={() => nav('/planner')} aria-label={t('Planner')}>
            <Icon name="chevronLeft" />
          </button>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.025em' }}>
              {t('Workout History & Progress')}
            </h1>
            <div className="sub" style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2 }}>
              {t('{0} total training sessions recorded', stats.totalWorkouts)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="sm"
            variant="ghost"
            icon="figureRun"
            onClick={() => cardioSheet()}
          >
            {t('+ Cardio')}
          </Button>
          <Button
            size="sm"
            variant="tinted"
            icon="calendar"
            onClick={() => nav('/planner')}
          >
            {t('Planner')}
          </Button>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <div className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--label-3)', textTransform: 'uppercase', fontWeight: 600 }}>
            {t('Sessions')}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)', marginTop: 2 }}>
            {stats.totalWorkouts}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--label-3)', textTransform: 'uppercase', fontWeight: 600 }}>
            {t('Total Sets')}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--mint)', marginTop: 2 }}>
            {stats.totalSets}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--label-3)', textTransform: 'uppercase', fontWeight: 600 }}>
            {t('Volume')}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)', marginTop: 2 }}>
            {fmtNum(stats.totalVolume)} kg
          </div>
        </div>

        <div className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--label-3)', textTransform: 'uppercase', fontWeight: 600 }}>
            {t('Total Time')}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)', marginTop: 2 }}>
            {stats.totalDurationMin} min
          </div>
        </div>
      </div>

      {/* Actual Progress Chart (Volume over Recent Sessions) */}
      {recentVolumeData.length > 1 && stats.totalVolume > 0 && (
        <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
          <div className="row between" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>
              {t('Volume Progression (Recent Workouts)')}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--label-3)' }}>
              {t('Total load (kg × reps)')}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110, paddingTop: 10 }}>
            {recentVolumeData.map((d, idx) => {
              const hPct = Math.max(12, Math.round((d.vol / maxVol) * 100))
              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--label-2)', marginBottom: 4 }}>
                    {d.vol > 1000 ? `${(d.vol / 1000).toFixed(1)}k` : d.vol}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 32,
                      height: `${hPct}%`,
                      background: 'linear-gradient(180deg, var(--mint) 0%, rgba(16, 185, 129, 0.4) 100%)',
                      borderRadius: '6px 6px 0 0',
                      transition: 'height 0.4s ease'
                    }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--label-3)', marginTop: 6 }}>
                    {d.d}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div className="chips" style={{ margin: 0 }}>
          {['All', 'Strength', 'Cardio'].map(tab => (
            <button
              key={tab}
              className={`chip ${activeTab === tab ? 'on' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {t(tab)}
            </button>
          ))}
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface-2)',
            padding: '6px 12px',
            borderRadius: 9999
          }}
        >
          <Icon name="magnifier" style={{ fontSize: 14, color: 'var(--label-3)' }} />
          <input
            type="text"
            placeholder={t('Search past sessions...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              color: 'var(--label)',
              fontSize: 13,
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Workout Sessions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 30 }}>
        {unifiedHistory.length > 0 ? (
          unifiedHistory.map(item => {
            // Cardio Activity Card
            if (item.kind === 'cardio') {
              const c = item.data
              const durHours = Number(c.durationHours) || Math.floor((Number(c.totalDurationMinutes) || 0) / 60)
              const durMins = Number(c.durationMinutes) || ((Number(c.totalDurationMinutes) || 0) % 60)
              const durDisplay = durHours > 0 ? `${durHours}h ${durMins}m` : `${durMins} min`
              const distDisplay = c.distanceKm != null ? `${c.distanceKm} km` : '—'

              return (
                <div
                  key={c.id}
                  className="card"
                  style={{
                    padding: '16px 18px',
                    borderRadius: 16,
                    cursor: 'pointer',
                    borderLeft: '4px solid var(--mint)'
                  }}
                  onClick={() => cardioSheet(c)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18, color: 'var(--mint)' }}>
                          <Icon name="figureRun" />
                        </span>
                        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--label)' }}>
                          {c.activity || t('Cardio')}
                        </h3>
                        <span className="tag acc" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 700 }}>
                          {t('Cardio')}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 4 }}>
                        {fmtDate(c.d)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="btn sm ghost"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          cardioSheet(c)
                        }}
                      >
                        <Icon name="pen" style={{ marginRight: 4 }} />
                        {t('Edit')}
                      </button>
                    </div>
                  </div>

                  {/* Dedicated Cardio Metrics: Duration and Distance ONLY */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px solid var(--surface-2)'
                    }}
                  >
                    <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--label-3)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {t('Total Duration')}
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--label)', marginTop: 2 }}>
                        {durDisplay}
                      </div>
                    </div>

                    <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--label-3)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {t('Distance Covered')}
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--mint)', marginTop: 2 }}>
                        {distDisplay}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            // Strength Workout Card
            const w = item.data
            const durationMin = Math.round((w.end && w.start ? w.end - w.start : (w.dur || 0)) / 60000)
            const entries = w.entries || []
            const completedSets = entries.reduce((acc, e) => acc + (e.sets || []).filter(s => s.done).length, 0)
            const completedReps = entries.reduce(
              (acc, e) => acc + (e.sets || []).filter(s => s.done).reduce((rAcc, s) => rAcc + (Number(s.r) || 0), 0),
              0
            )
            const hasPR = (w.prs || []).length > 0

            return (
              <div
                key={w.id}
                className="card"
                style={{
                  padding: '16px 18px',
                  borderRadius: 16,
                  cursor: 'pointer',
                  borderLeft: '4px solid var(--blue, #3b82f6)'
                }}
                onClick={() => workoutDetailSheet(w)}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--label)' }}>
                        {w.name || t('Workout')}
                      </h3>
                      {hasPR && (
                        <span className="tag acc" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 9999 }}>
                          ★ {t('PR')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2 }}>
                      {fmtDate(w.d)} {durationMin > 0 ? `· ${durationMin} min` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn sm"
                      style={{
                        background: 'var(--mint-light)',
                        color: 'var(--mint)',
                        fontWeight: 600,
                        padding: '5px 10px',
                        fontSize: 12,
                        borderRadius: 8
                      }}
                      onClick={(e) => handleRepeatWorkout(w, e)}
                      title={t('Load exercises into a new active session')}
                    >
                      <Icon name="arrowRotateRight" style={{ marginRight: 4 }} />
                      {t('Repeat')}
                    </button>
                    <Icon name="chevronRight" className="chev" style={{ fontSize: 16, color: 'var(--label-3)' }} />
                  </div>
                </div>

                {/* Exercises & Set Records Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  {entries.slice(0, 5).map((e, idx) => {
                    const ex = exOr(e.id)
                    const doneSets = (e.sets || []).filter(s => s.done)
                    const setsStr = doneSets
                      .map(s => (s.w > 0 ? `${s.w}kg × ${s.r}` : `${s.r} reps`))
                      .join(', ')

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          fontSize: 13,
                          padding: '4px 0',
                          borderBottom: idx < Math.min(entries.length, 5) - 1 ? '1px dashed var(--surface-2)' : 'none'
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--label)', maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ex.n || e.n || e.id}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--label-2)', textAlign: 'right' }}>
                          {setsStr || `${doneSets.length} sets completed`}
                        </span>
                      </div>
                    )
                  })}
                  {entries.length > 5 && (
                    <div style={{ fontSize: 12, color: 'var(--mint)', fontWeight: 600, marginTop: 2 }}>
                      + {entries.length - 5} {t('more exercises')}...
                    </div>
                  )}
                </div>

                {/* Footer Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--surface-2)', fontSize: 12, color: 'var(--label-3)' }}>
                  <span>{entries.length} {t('exercises')}</span>
                  <span>·</span>
                  <span>{completedSets} {t('sets')}</span>
                  <span>·</span>
                  <span>{completedReps} {t('reps')}</span>
                  {w.vol > 0 && (
                    <>
                      <span>·</span>
                      <span>{fmtNum(w.vol)} kg {t('volume')}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <div style={{ fontSize: 36, color: 'var(--label-3)', marginBottom: 8 }}>
              <Icon name="history" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)', marginBottom: 6 }}>
              {search ? t('No sessions matching "{0}"', search) : t('No workout sessions recorded yet')}
            </div>
            <div className="muted small" style={{ marginBottom: 16 }}>
              {t('Complete your first workout or log a cardio activity to see your sets, duration, and progress.')}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button variant="primary" icon="calendar" onClick={() => nav('/planner')}>
                {t('Weekly Planner')}
              </Button>
              <Button variant="ghost" icon="figureRun" onClick={() => cardioSheet()}>
                {t('Log Cardio')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
