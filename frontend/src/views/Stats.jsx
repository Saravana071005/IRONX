import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { EXIDX } from '../lib/exercises.js'
import { lastBW, streakWeeks, setLabel, modeOf } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, weekKey, DAYS } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { bwSheet, goalSheet, calendarSheet, workoutDetailSheet, WorkoutRow, bwDeltaColor, cardioSheet } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Heatmap from '../components/Heatmap.jsx'
import Icon from '../components/Icon.jsx'
import BodyMap, { BodyMapLegend } from '../components/BodyMap.jsx'
import { loadOfWorkouts, rankOf, MUSCLE_NAME } from '../lib/muscles.js'
import { e1rmSeries, best1RM } from '../lib/onerm.js'
import {
  hasEffort, displayScale, scaleName, toScale, avgRir, isHardSet
} from '../lib/effort.js'
import { Button, Segmented, SelectRow } from '../components/ui.jsx'

// Muscle Balance
function MuscleBalance({ S }) {
  const [win, setWin] = useState(7)
  const [hard, setHard] = useState(false)
  const [sel, setSel] = useState(null)
  const now = Date.now()
  const inWin = (S.workouts || []).filter(w =>
    win === 0 ? true
      : win === 7 ? weekKey(w.d) === weekKey(todayISO())
        : (w.start || new Date(w.d).getTime()) > now - win * 86400000)

  const rated = inWin.some(w => (w.entries || []).some(e => (e.sets || []).some(s => s.done && isHardSet(s))))
  const on = hard && rated
  const load = loadOfWorkouts(inWin, on ? isHardSet : null)
  const { worked } = rankOf(load)
  const sets = m => Math.round((load[m] || 0) * 10) / 10

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>
          {t('Muscle balance')} <span className="dim" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>· {on ? t('by hard sets') : t('by sets worked')}</span>
        </h2>
        {rated && (
          <Button size="sm" icon="flame" style={on ? { color: 'var(--amber)' } : undefined} onClick={() => { setHard(h => !h); setSel(null) }}>
            {on ? t('Hard') : t('All')}
          </Button>
        )}
      </div>
      <Segmented
        className="seg-range"
        value={win}
        onChange={v => { setWin(v); setSel(null) }}
        options={[{ value: 7, label: t('Week') }, { value: 30, label: '30d' }, { value: 90, label: '90d' }, { value: 0, label: t('All') }]}
      />
      {inWin.length ? (
        <>
          <BodyMap className="tappable" load={load} body={S.body} selected={sel} onMuscle={m => setSel(s => (s === m ? null : m))} />
          <BodyMapLegend />
          {sel && (
            <div className="mrow" style={{ borderTop: 'var(--hair) solid var(--sep)', marginTop: 4, paddingTop: 10 }}>
              <span className="nm"><b>{t(MUSCLE_NAME[sel])}</b></span>
              <span className="v">{sets(sel) ? t('{0} sets', sets(sel)) : on ? t('no hard sets') : t('not trained')}</span>
            </div>
          )}
        </>
      ) : (
        <div className="muted small" style={{ padding: '16px 0', textAlign: 'center' }}>
          {t('No workouts recorded in this time range.')}
        </div>
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
  const winWorkouts = workouts.filter(w => (w.start || new Date(w.d).getTime()) > now - 7 * 86400000)
  const totalVolume7d = winWorkouts.reduce((acc, w) => {
    return acc + (w.entries || []).reduce((a, e) => {
      return a + (e.sets || []).filter(s => s.done).reduce((as, s) => as + (Number(s.w) || 0) * (Number(s.r) || 0), 0)
    }, 0)
  }, 0)

  // Volume curve points for the chart
  const volumePoints = workouts.slice(-14).map(w => {
    const vol = (w.entries || []).reduce((a, e) => a + (e.sets || []).filter(s => s.done).reduce((as, s) => as + (Number(s.w) || 0) * (Number(s.r) || 0), 0), 0)
    return { t: w.start || new Date(w.d).getTime(), y: vol, d: w.d }
  })

  // Bodyweight Points
  const bwPts = bodyweight.filter(b => range === 0 || (b.t || new Date(b.d).getTime()) > now - range * 86400000)
    .map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))
  const bw30 = bodyweight.filter(b => (b.t || new Date(b.d).getTime()) > now - 30 * 86400000)
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
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.025em' }}>
            {t('Activity & Stats')}
          </h1>
          <div className="sub" style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2 }}>
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
          <div className="v" style={{ fontSize: 20, color: bwDelta30 === null ? 'inherit' : bwDeltaColor(bwDelta30, (lastBW(S) || {}).w || 0) }}>
            {bwDelta30 === null ? '—' : (bwDelta30 > 0 ? '+' : '') + fmtNum(bwDelta30) + ' ' + S.unit}
          </div>
        </div>
      </div>

      {/* Dedicated Cardio Activity Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', textTransform: 'uppercase' }}>
              {t('Dedicated Cardio Activity')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
              <div className="big" style={{ fontSize: 26, fontWeight: 800, color: 'var(--mint)' }}>
                {supportedStats.totalCardioKm > 0 ? `${supportedStats.totalCardioKm} km` : '0 km'}
              </div>
              <span style={{ fontSize: 13, color: 'var(--label-2)' }}>
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
            <div style={{ fontSize: 11, color: 'var(--label-3)', textTransform: 'uppercase', fontWeight: 600 }}>{t('Sessions')}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)', marginTop: 2 }}>{cardioLogs.length}</div>
          </div>
          <div style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--label-3)', textTransform: 'uppercase', fontWeight: 600 }}>{t('Total Time')}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)', marginTop: 2 }}>{supportedStats.totalCardioMin} min</div>
          </div>
          <div style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--label-3)', textTransform: 'uppercase', fontWeight: 600 }}>{t('Distance')}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--mint)', marginTop: 2 }}>{supportedStats.totalCardioKm} km</div>
          </div>
        </div>
      </div>

      {/* Primary Strength Volume Curve Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', textTransform: 'uppercase' }}>
              {t('Total Volume Lifted (7d)')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <div className="big" style={{ fontSize: 28, fontWeight: 800 }}>
                {totalVolume7d > 0 ? `${fmtNum(totalVolume7d)}` : '0'} <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--label-2)' }}>{S.unit}</span>
              </div>
              {totalVolume7d > 0 && (
                <span className="tag acc" style={{ fontSize: 12, padding: '3px 8px', borderRadius: 9999 }}>
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
            <LineChart points={volumePoints} h={140} unit={S.unit} color="var(--coral)" />
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
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>
            {t('Weekly Activity Summary')}
          </h2>
          <span className="tag acc" style={{ fontSize: 11, fontWeight: 700 }}>
            {supportedStats.thisWeekTotal} {t('sessions this week')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 70, marginTop: 12 }}>
          {DAYS.map((d, i) => {
            const isToday = i === new Date().getDay()
            // Check if there is a session on this day of current week
            const hasSession = workouts.some(w => {
              const dt = new Date(w.d)
              return dt.getDay() === i && weekKey(w.d) === weekKey(todayISO())
            }) || cardioLogs.some(c => {
              const dt = new Date(c.d)
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
                      background: hasSession ? 'var(--mint)' : (isToday ? 'var(--coral)' : 'var(--surface-3)'),
                      borderRadius: 9999
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: isToday ? 'var(--mint)' : 'var(--label-3)' }}>
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

      {workouts.length > 0 && <MuscleBalance S={S} />}

      <div className="cols">
        {/* Body weight card with time range */}
        <div className="card">
          <div className="row between" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>{t('Body weight')}</h2>
            <div className="row" style={{ gap: 8 }}>
              <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--amber)' } : undefined} onClick={goalSheet}>
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
                  <LineChart points={effPts} h={150} unit={hd} color="var(--amber)" invert={kind === 'rir'} />
                ) : (
                  <LineChart points={onE1 ? e1Pts.map(p => ({ t: p.t, y: p.y, d: p.d })) : topPts} h={150} unit={exUnit} color="var(--mint)" />
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
