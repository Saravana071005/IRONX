import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { EXIDX } from '../lib/exercises.js'
import { lastBW, streakWeeks, setLabel, modeOf } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, weekKey, DAYS, fmtVol } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { bwSheet, goalSheet, calendarSheet, workoutDetailSheet, WorkoutRow, bwDeltaColor, cardioSheet } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Heatmap from '../components/Heatmap.jsx'
import Icon from '../components/Icon.jsx'
import MuscleBalanceChart from '../components/MuscleBalanceChart.jsx'
import { calcEWMA, calcTransformationProgress, compareMeasurements, MEASUREMENT_SITES } from '../lib/transformation.js'
import { generateWeeklyFitnessReport } from '../lib/fitnessReport.js'
import { e1rmSeries, best1RM } from '../lib/onerm.js'
import {
  hasEffort, displayScale, scaleName, toScale, avgRir, isHardSet
} from '../lib/effort.js'
import { Button, Segmented, SelectRow } from '../components/ui.jsx'



function WeeklyReportCard({ S }) {
  const [open, setOpen] = useState(false)
  let report = null
  try {
    report = generateWeeklyFitnessReport(S)
  } catch (err) {
    console.error('Error generating weekly fitness report:', err)
  }

  if (!report) return null

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row between" style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="lrow-i" style={{ background: '#242429', color: '#FFFFFF', width: 28, height: 28, fontSize: 14 }}>
            <Icon name="sparkles" />
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#FFFFFF' }}>{t('Weekly Fitness Intelligence')}</h2>
            <div className="muted small">{report?.training?.workoutsCount || 0} {t('workouts')} · {fmtVol(report?.training?.totalVolumeKg || 0, S?.unit || 'kg')} {t('tonnage')}</div>
          </div>
        </div>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} className="chev" />
      </div>

      {open && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--sep)', paddingTop: 12 }}>
          <div className="grid2" style={{ marginBottom: 12 }}>
            <div className="tile" style={{ padding: '8px 12px' }}>
              <div className="l">{t('Completed Sets')}</div>
              <div className="v" style={{ fontSize: '1.2rem', color: '#FFFFFF' }}>{report?.training?.totalSets || 0}</div>
            </div>
            <div className="tile" style={{ padding: '8px 12px' }}>
              <div className="l">{t('New PRs')}</div>
              <div className="v" style={{ fontSize: '1.2rem', color: '#FFFFFF' }}>{report?.training?.newPRCount || 0}</div>
            </div>
          </div>

          {report?.training?.topExercises?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>{t('Top Performing Exercises')}</div>
              {report.training.topExercises.map(ex => (
                <div key={ex.id} className="row between small" style={{ padding: '4px 0', borderBottom: 'var(--hair) solid var(--sep)' }}>
                  <span>{ex.name}</span>
                  <span><b>{fmtVol(ex.volume, S?.unit || 'kg')}</b> · {ex.sets} sets</span>
                </div>
              ))}
            </div>
          )}

          {report?.nutrition?.hasData && (
            <div style={{ marginBottom: 12 }}>
              <div className="small muted" style={{ fontWeight: 600, marginBottom: 4 }}>{t('Nutrition Adherence')}</div>
              <div className="small">
                {t('Avg Calories')}: <b>{report.nutrition.avgCalories}</b> / {report.nutrition.targetCalorie} kcal · {t('Avg Protein')}: <b>{report.nutrition.avgProtein}g</b> / {report.nutrition.targetProtein}g
              </div>
            </div>
          )}

          {report?.recommendations?.length > 0 && (
            <div>
              <div className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>{t('Actionable Improvement Focus')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {report.recommendations.map((rec, i) => (
                  <div key={i} style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: '#FFFFFF', marginBottom: 2 }}>{rec.title}</div>
                    <div className="muted">{rec.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PRVaultCard({ S }) {
  const [filter, setFilter] = useState('')
  const vault = S.prVault || []
  const filtered = filter ? vault.filter(p => (p.exName || '').toLowerCase().includes(filter.toLowerCase())) : vault

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="lrow-i" style={{ background: '#242429', color: '#FFFFFF', width: 28, height: 28, fontSize: 14 }}>
            <Icon name="trophy" />
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#FFFFFF' }}>{t('Personal Record Vault')}</h2>
            <div className="muted small">{vault.length} {t('verified personal records')}</div>
          </div>
        </div>
      </div>

      {vault.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
          {filtered.map(pr => (
            <div key={pr.id} className="row between" style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#FFFFFF' }}>{pr.exName}</div>
                <div className="small muted">{pr.label} · {fmtDate(pr.date)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#FFFFFF' }}>
                  {pr.value} {pr.metric === 'duration' ? 's' : (S.unit || 'kg')}
                </div>
                {pr.prevValue && (
                  <div className="small dim">was {pr.prevValue}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted small">{t('No personal records verified yet. Complete workouts to automatically unlock records!')}</div>
      )}
    </div>
  )
}
export default function Stats() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const workouts = S.workouts || []
  const cardioLogs = S.cardioLogs || []
  const bodyweight = S.bodyweight || []

  const [period, setPeriod] = useState('Week')
  const [range, setRange] = useState(30)
  const [exId, setExId] = useState(null)
  const [exMetric, setExMetric] = useState('top')

  const now = Date.now()
  const anyEffort = hasEffort(S)
  const kind = displayScale(S)
  const hd = scaleName(kind)

  // Real Supported Metrics Computation
  const supportedStats = useMemo(() => {
    const totalSessions = workouts.length + cardioLogs.length
    const uniqueStrengthDays = new Set(workouts.map(w => w.d).filter(Boolean)).size

    let totalCardioMin = 0
    let totalCardioKm = 0
    cardioLogs.forEach(c => {
      const mins = Number(c.totalDurationMinutes) || ((Number(c.durationHours) || 0) * 60 + (Number(c.durationMinutes) || 0)) || Number(c.duration_min) || 0
      totalCardioMin += mins
      totalCardioKm += Number(c.distanceKm) || Number(c.distance_km) || 0
    })

    // This week's sessions
    const curWeekKey = weekKey(todayISO())
    const thisWeekWorkouts = workouts.filter(w => weekKey(w.d) === curWeekKey)
    const thisWeekCardio = cardioLogs.filter(c => weekKey(c.d) === curWeekKey)
    const thisWeekTotal = thisWeekWorkouts.length + thisWeekCardio.length

    return {
      totalSessions,
      uniqueStrengthDays,
      totalCardioMin,
      totalCardioKm: Math.round(totalCardioKm * 10) / 10,
      thisWeekTotal,
      thisWeekWorkouts: thisWeekWorkouts.length,
      thisWeekCardio: thisWeekCardio.length
    }
  }, [workouts, cardioLogs])

  // Volume in last 7 days
  const winWorkouts = workouts.filter(w => {
    const t = w.start || (w.d ? new Date(w.d + (w.d.includes('T') ? '' : 'T12:00:00')).getTime() : 0)
    return t > now - 7 * 86400000
  })
  const totalVolume7d = winWorkouts.reduce((acc, w) => {
    return acc + (w.entries || []).reduce((a, e) => {
      return a + (e.sets || []).filter(s => s.done).reduce((as, s) => as + (Number(s.w) || 0) * (Number(s.r) || 0), 0)
    }, 0)
  }, 0)

  // Volume curve points for the chart
  const volumePoints = workouts.slice(-14).map(w => {
    const vol = (w.entries || []).reduce((a, e) => a + (e.sets || []).filter(s => s.done).reduce((as, s) => as + (Number(s.w) || 0) * (Number(s.r) || 0), 0), 0)
    return { t: w.start || (w.d ? new Date(w.d + (w.d.includes('T') ? '' : 'T12:00:00')).getTime() : 0), y: vol, d: w.d }
  })

  // Bodyweight Points
  const bwPts = bodyweight.filter(b => range === 0 || ((b.t || (b.d ? new Date(b.d + (b.d.includes('T') ? '' : 'T12:00:00')).getTime() : 0)) > now - range * 86400000))
    .map(b => ({ t: b.t || (b.d ? new Date(b.d + (b.d.includes('T') ? '' : 'T12:00:00')).getTime() : 0), y: b.w, d: b.d }))
  const bw30 = bodyweight.filter(b => (b.t || (b.d ? new Date(b.d + (b.d.includes('T') ? '' : 'T12:00:00')).getTime() : 0)) > now - 30 * 86400000)
  const bwDelta30 = bw30.length > 1 ? bw30[bw30.length - 1].w - bw30[0].w : null
  const monthW = workouts.filter(w => (w.d || '').slice(0, 7) === todayISO().slice(0, 7)).length

  // Exercise Progress Curve Data
  const exHist = [...new Set(workouts.flatMap(w => (w.entries || []).map(e => e.id)))].filter(id => EXIDX[id]).sort((a, b) => EXIDX[a].n < EXIDX[b].n ? -1 : 1)
  const curEx = exId && exHist.includes(exId) ? exId : exHist[0] || null

  const curMode = curEx ? (() => {
    for (let i = workouts.length - 1; i >= 0; i--) {
      const en = (workouts[i].entries || []).find(e => e.id === curEx)
      if (en) return modeOf({ ...(en.target || {}), id: curEx })
    }
    return modeOf({ id: curEx })
  })() : 'reps'
  const curCardio = curMode === 'cardio'
  const curTimed = curMode === 'time'
  const metric = s => curCardio ? (s.speed || 0) : curTimed ? (s.sec || 0) : (s.w || 0)
  const exUnit = curCardio ? 'km/h' : curTimed ? 's' : S.unit
  let exPts = [], exList = [], exBest = 0
  if (curEx) {
    workouts.forEach(w => {
      const en = (w.entries || []).find(e => e.id === curEx)
      if (en) {
        const mx = Math.max(0, ...(en.sets || []).filter(s => s.done).map(metric), curCardio || curTimed ? 0 : (en.topW || 0))
        if (mx > 0) {
          exPts.push({ t: w.start, y: mx, d: w.d, sets: (en.sets || []).filter(s => s.done), target: en.target })
          if (mx > exBest) exBest = mx
        }
      }
    })
    exList = exPts.slice(-5).reverse()
  }

  const e1Pts = curEx ? e1rmSeries(S, curEx) : []
  const e1Best = curEx ? best1RM(S, curEx) : null
  const showE1 = e1Pts.length > 0
  const exRir = exPts.map(p => avgRir(p.sets))
  const showEff = exRir.filter(v => v != null).length >= 3
  const effPts = exPts.map((p, i) => (exRir[i] == null ? null : { t: p.t, y: toScale(kind, exRir[i]), d: p.d })).filter(Boolean)
  const onE1 = showE1 && exMetric === 'e1rm'
  const onEff = showEff && exMetric === 'effort'
  const topPts = exPts.map((p, i) => ({
    t: p.t, y: p.y, d: p.d,
    m: exRir[i] == null ? null : 1 - Math.min(4, Math.max(0, exRir[i])) / 4,
    note: exRir[i] == null ? undefined : hd + ' ' + fmtNum(toScale(kind, exRir[i]))
  }))
  const exOpts = [{ value: 'top', label: t('Top set') }]
  if (showE1) exOpts.push({ value: 'e1rm', label: t('Est. 1RM') })
  if (showEff) exOpts.push({ value: 'effort', label: t('Effort') })

  const periodOptions = ['Day', 'Week', 'Month', 'Year']

  return (
    <div className="narrow">
      {/* Header */}
      <div className="hdr" style={{ alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.025em', color: '#FFFFFF' }}>
            {t('Activity & Stats')}
          </h1>
          <div className="sub" style={{ fontSize: 13, color: '#A1A1AA', marginTop: 2 }}>
            {t('Real verified workout progression and cardio logs')}
          </div>
        </div>
        <button className="iconbtn" onClick={() => nav('/history')} aria-label={t('History')} title={t('History')}>
          <Icon name="history" />
        </button>
      </div>

      {/* Period Selector Pills */}
      <div className="chips" style={{ marginBottom: 14 }}>
        {periodOptions.map(p => (
          <button
            key={p}
            className={`chip ${period === p ? 'on' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {t(p)}
          </button>
        ))}
      </div>

      {/* Summary KPI Tiles */}
      <div className="tiles" style={{ marginBottom: 14 }}>
        <div className="tile">
          <div className="l"><Icon name="dumbbell" />{t('Total Sessions')}</div>
          <div className="v">{supportedStats.totalSessions}</div>
        </div>
        <div className="tile">
          <div className="l"><Icon name="calendar" />{t('This Month')}</div>
          <div className="v">{monthW}</div>
        </div>
        <div className="tile">
          <div className="l"><Icon name="flame" />{t('Week Streak')}</div>
          <div className="v">{streakWeeks(S)}</div>
        </div>
        <div className="tile">
          <div className="l"><Icon name="scale" />{t('Weight 30d')}</div>
          <div className="v" style={{ fontSize: 20, color: '#FFFFFF' }}>
            {bwDelta30 === null ? '—' : (bwDelta30 > 0 ? '+' : '') + fmtNum(bwDelta30) + ' ' + S.unit}
          </div>
        </div>
      </div>

      {/* Dedicated Cardio Activity Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA', textTransform: 'uppercase' }}>
              {t('Dedicated Cardio Activity')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
              <div className="big" style={{ fontSize: 26, fontWeight: 800, color: '#FFFFFF' }}>
                {supportedStats.totalCardioKm > 0 ? `${supportedStats.totalCardioKm} km` : '0 km'}
              </div>
              <span style={{ fontSize: 13, color: '#A1A1AA' }}>
                {supportedStats.totalCardioMin > 0 ? `· ${supportedStats.totalCardioMin} min total` : ''}
              </span>
            </div>
          </div>
          <Button size="sm" variant="tinted" icon="plus" onClick={() => cardioSheet()}>
            {t('Log Cardio')}
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
          <div style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#71717A', textTransform: 'uppercase', fontWeight: 600 }}>{t('Sessions')}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>{cardioLogs.length}</div>
          </div>
          <div style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#71717A', textTransform: 'uppercase', fontWeight: 600 }}>{t('Total Time')}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>{supportedStats.totalCardioMin} min</div>
          </div>
          <div style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#71717A', textTransform: 'uppercase', fontWeight: 600 }}>{t('Distance')}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>{supportedStats.totalCardioKm} km</div>
          </div>
        </div>
      </div>

      {/* Primary Strength Volume Curve Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA', textTransform: 'uppercase' }}>
              {t('Total Volume Lifted (7d)')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <div className="big" style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF' }}>
                {totalVolume7d > 0 ? `${fmtNum(totalVolume7d)}` : '0'} <span style={{ fontSize: 15, fontWeight: 500, color: '#A1A1AA' }}>{S.unit}</span>
              </div>
              {totalVolume7d > 0 && (
                <span className="tag acc" style={{ fontSize: 12, padding: '3px 8px', borderRadius: 9999, background: '#242429', color: '#FFFFFF', border: '1px solid #303036' }}>
                  ▲ {t('Active')}
                </span>
              )}
            </div>
          </div>
          <span className="small muted" style={{ fontSize: 12 }}>
            {winWorkouts.length} {t(winWorkouts.length === 1 ? 'workout' : 'workouts')}
          </span>
        </div>

        {volumePoints.length > 1 ? (
          <div className="chart" style={{ marginTop: 12 }}>
            <LineChart points={volumePoints} h={140} unit={S.unit} color="#FFFFFF" />
          </div>
        ) : (
          <div className="muted small" style={{ padding: '16px 0', textAlign: 'center' }}>
            {t('Complete strength workouts to generate your volume curve.')}
          </div>
        )}
      </div>

      {/* Weekly Activity Summary (Monday - Sunday) */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>
            {t('Weekly Activity Summary')}
          </h2>
          <span className="tag acc" style={{ fontSize: 11, fontWeight: 700, background: '#242429', color: '#FFFFFF', border: '1px solid #303036' }}>
            {supportedStats.thisWeekTotal} {t('sessions this week')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 70, marginTop: 12 }}>
          {DAYS.map((d, i) => {
            const isToday = i === new Date().getDay()
            // Check if there is a session on this day of current week
            const hasSession = workouts.some(w => {
              if (!w.d) return false
              const dt = new Date(w.d + (w.d.includes('T') ? '' : 'T12:00:00'))
              return dt.getDay() === i && weekKey(w.d) === weekKey(todayISO())
            }) || cardioLogs.some(c => {
              if (!c.d) return false
              const dt = new Date(c.d + (c.d.includes('T') ? '' : 'T12:00:00'))
              return dt.getDay() === i && weekKey(c.d) === weekKey(todayISO())
            })

            const heightPct = hasSession ? 85 : 18
            return (
              <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                <div style={{ flex: 1, width: 10, background: 'var(--surface-2)', borderRadius: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPct}%`,
                      background: hasSession ? '#FFFFFF' : (isToday ? '#71717A' : '#1C1C20'),
                      borderRadius: 9999
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: isToday ? '#FFFFFF' : '#71717A' }}>
                  {d.slice(0, 1)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Activity Heatmap — last 12 months */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>
          {t('Activity — last 12 months')} <span className="dim" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>· {t('by time trained')}</span>
        </h2>
        <Heatmap
          S={S}
          onDay={iso => {
            const ws = workouts.filter(w => w.d === iso)
            if (ws.length === 1) workoutDetailSheet(ws[0])
            else if (ws.length) calendarSheet(iso)
          }}
        />
      </div>

      <WeeklyReportCard S={S} />
      <PRVaultCard S={S} />
      <MuscleBalanceChart S={S} />

      <div className="cols">
        {/* Body weight card with time range */}
        <div className="card">
          <div className="row between" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>{t('Body weight')}</h2>
            <div className="row" style={{ gap: 8 }}>
              <Button size="sm" icon="target" style={S.targetW ? { color: '#FFFFFF' } : undefined} onClick={goalSheet}>
                {S.targetW ? fmtNum(S.targetW) : t('Goal')}
              </Button>
              <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
            </div>
          </div>
          <Segmented
            className="seg-range"
            value={range}
            onChange={setRange}
            options={[{ value: 30, label: '1M' }, { value: 90, label: '3M' }, { value: 365, label: '1Y' }, { value: 0, label: t('All') }]}
          />
          <div className="chart"><LineChart points={bwPts} h={160} unit={S.unit} goal={S.targetW} /></div>
        </div>

        {/* Exercise Progress Curve */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>{t('Exercise progress')}</h2>
          {exHist.length ? (
            <>
              <div className="sect-b" style={{ marginBottom: 10 }}>
                <SelectRow
                  title={t('Exercise')}
                  sheetTitle={t('Exercise progress')}
                  value={curEx}
                  onChange={setExId}
                  options={exHist.map(id => ({ value: id, label: EXIDX[id].n }))}
                />
              </div>
              {exOpts.length > 1 && (
                <Segmented
                  className="seg-range"
                  value={onEff ? 'effort' : onE1 ? 'e1rm' : 'top'}
                  onChange={setExMetric}
                  options={exOpts}
                />
              )}
              <div className="chart">
                {onEff ? (
                  <LineChart points={effPts} h={150} unit={hd} color="#A1A1AA" invert={kind === 'rir'} />
                ) : (
                  <LineChart points={onE1 ? e1Pts.map(p => ({ t: p.t, y: p.y, d: p.d })) : topPts} h={150} unit={exUnit} color="#FFFFFF" />
                )}
              </div>
              <div style={{ marginTop: 8 }}>
                {exList.map((p, i) => (
                  <div key={i} className="row between small" style={{ padding: '6px 0', borderBottom: 'var(--hair) solid var(--sep)' }}>
                    <span className="muted">{fmtDate(p.d, true)}</span>
                    <span>{(p.sets || []).map(s => setLabel(curEx, s, p.target)).join('  ')}</span>
                  </div>
                ))}
              </div>
              <div className="small dim" style={{ marginTop: 8 }}>
                {onEff ? t('Average effort per workout') : onE1 ? t('Estimated 1RM per workout') : curCardio ? t('Top speed per workout') : curTimed ? t('Longest hold per workout') : t('Best set weight per workout')}
                {onEff ? '' : <> · {t('Best:')}{' '}<b className="accent">{fmtNum(onE1 ? e1Best.est : exBest)} {onE1 ? S.unit : exUnit}</b></>}
              </div>
            </>
          ) : (
            <div className="muted small">{t('Finish your first workout to see progress curves here.')}</div>
          )}
        </div>
      </div>

      {/* Recent Workouts */}
      {workouts.length > 0 && (
        <div style={{ marginTop: 12, marginBottom: 20 }}>
          <div className="row between" style={{ marginBottom: 10, padding: '0 4px' }}>
            <h4 className="sec" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--label-2)' }}>
              {t('Recent workouts')}
            </h4>
            <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={() => nav('/history')}>
              {t('All')} {workouts.length}
            </Button>
          </div>
          <div className="list">
            {[...workouts].reverse().slice(0, 6).map(w => (
              <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
