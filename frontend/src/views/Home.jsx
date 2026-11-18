import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekKey, DAYS } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor, cardioSheet } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import TodayMuscleChart from '../components/TodayMuscleChart.jsx'
import { coachAvailable, hasConsent } from '../lib/coach.js'
import { useCoachStatus } from '../lib/coach-api.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import {
  getTodayScheduledWorkout,
  createSessionFromTemplate,
  getTodayDisplayDate
} from '../lib/customPlanner.js'

function CoachCard({ nav }) {
  const S = useStore(s => s.S)
  const { job, pending } = useCoachStatus(hasConsent(S))
  if (!hasConsent(S) || (!job && !pending)) return null
  const ready = !!pending
  return (
    <div className="card" style={ready ? { borderColor: 'var(--acc)' } : null}>
      <div className="today-row" onClick={() => nav(ready ? '/coach/proposal' : '/coach')} style={{ cursor: 'pointer' }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <span className="lrow-i" style={{ background: ready ? 'var(--acc)' : 'var(--coral)' }}><Icon name="sparkles" /></span>
          <div style={{ minWidth: 0 }}>
            <div className="lbl2">{t('Coach')}</div>
            <div className="ttl" style={{ fontWeight: 600 }}>{ready
              ? (pending.kind === 'create'
                ? t('Your plan is ready')
                : t(pending.changes?.length === 1 ? '{0} suggestion for you' : '{0} suggestions for you', pending.changes?.length || 0))
              : t('Reading your training…')}</div>
          </div>
        </div>
        {ready ? <span className="tag acc">{t('Review')}</span> : <Icon name="chevronRight" className="chev" />}
      </div>
    </div>
  )
}

export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const [weekOffset, setWeekOffset] = useState(0)
  const coachOn = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE })

  const today = new Date()
  const todayStr = todayISO()
  const todayInfo = getTodayDisplayDate(today)
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  // Read today's scheduled workout from weekly planner (single source of truth)
  const todayScheduled = getTodayScheduledWorkout(S, today)
  const scheduledTemplate = todayScheduled?.template || null
  const isScheduledRest = todayScheduled?.isRest || !scheduledTemplate

  // Read today's health log (food, water, cardio)
  const todayHealth = useMemo(() => {
    try {
      const stored = localStorage.getItem(`opengym_health_${todayStr}`)
      if (stored) return JSON.parse(stored)
    } catch (e) {}
    return null
  }, [todayStr, S.meals])

  const foodsToday = todayHealth?.foods || (S.meals || []).filter(m => m.d === todayStr || m.date === todayStr)
  const foodCount = foodsToday.length
  const waterLogs = todayHealth?.water || []
  const waterLitres = Math.round((waterLogs.reduce((a, w) => a + (Number(w.millilitres) || 0), 0) / 1000) * 10) / 10
  const waterGoal = S.nutritionTargets?.waterGoal || 2.5

  const cardioLogs = todayHealth?.cardio || []
  const recordedSteps = cardioLogs.reduce((acc, c) => acc + (Number(c.steps) || 0), 0)

  // Workouts today
  const todayWorkout = S.workouts.find(w => w.d === todayStr)
  const workoutDurMin = todayWorkout ? Math.round((todayWorkout.dur || 0) / 60000) : 0
  const activeWorkoutMin = S.active ? Math.max(1, Math.round((Date.now() - S.active.start) / 60000)) : 0
  const totalWorkoutMin = workoutDurMin || activeWorkoutMin

  const targetCalories = S.nutritionTargets?.calorie || S.nutritionTargets?.calories || 1900

  // Calculate today's real progress score (0 to 100%) based on actual recorded activities
  let progressScore = 0
  if (todayWorkout) progressScore += 50
  else if (S.active) progressScore += 25
  if (foodCount > 0) progressScore += Math.min(25, foodCount * 10)
  if (waterLitres > 0) progressScore += Math.min(25, Math.round((waterLitres / waterGoal) * 25))

  // Week strip calculation
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  const weekData = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const sched = getTodayScheduledWorkout(S, d)
    const isSchedPlanned = !sched.isRest && !!sched.template
    const eff = isSchedPlanned || effectiveRoutineId(S, iso)
    const done = doneDays.has(iso)
    const dayWorkout = S.workouts.find(w => w.d === iso)
    const durM = dayWorkout ? Math.round((dayWorkout.dur || 0) / 60000) : 0
    const fillPercent = done ? Math.min(100, Math.max(35, durM > 0 ? (durM / 60) * 100 : 75)) : eff ? 35 : 12

    weekData.push({
      iso,
      dayName: DAYS[d.getDay()],
      dateNum: d.getDate(),
      isToday: iso === todayStr,
      done,
      ovr: false,
      planned: !!eff,
      fillPercent,
      workout: dayWorkout,
      templateName: sched.template?.name || null
    })
  }

  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const wkLabel = weekOffset === 0
    ? t('This week')
    : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`

  const wThisWeek = S.workouts.filter(w => weekKey(w.d) === weekKey(todayStr)).length
  const plannedPerWeek = Object.keys(S.week).filter(k => S.week[k]).length
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))

  const todayCardioLogged = (S.cardioLogs || []).find(c => c.d === todayStr)
  const todayCompleted = !!todayWorkout || !!todayCardioLogged

  const handleStartTodayWorkout = () => {
    if (S.active) {
      nav('/workout')
      return
    }
    if (scheduledTemplate) {
      const session = createSessionFromTemplate(S, scheduledTemplate.id, todayStr)
      if (session) {
        update(s => { s.active = session })
        nav('/workout')
        return
      }
    }
    nav('/planner')
  }

  // SVG circular progress ring calculations
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progressScore / 100) * circumference

  return (
    <div className="dashboard-layout">
      {/* Top Welcome Section */}
      <div className="hdr" style={{ alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            onClick={() => nav('/settings')}
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(0, 242, 254, 0.12)',
              color: 'var(--cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              cursor: 'pointer',
              flex: 'none',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(0, 242, 254, 0.3)',
              boxShadow: '0 4px 18px rgba(0, 242, 254, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.25)'
            }}
            title={t('Settings')}
          >
            <Icon name="personCircle" />
          </div>
          <div>
            <h1 className="text-gradient-hero" style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.024em', display: 'block' }}>
              {user ? t('Hi, {0} 👋', user.name) : 'Hi, Alex 👋'}
            </h1>
            <div className="sub" style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2, fontWeight: 500 }}>
              {t('Ready to crush your goals?')} · <span style={{ color: 'var(--cyan)' }}>{todayInfo.fullFormatted}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            size="sm"
            variant="tinted"
            icon="figureRun"
            onClick={() => cardioSheet(null, todayStr)}
          >
            {t('Log Cardio')}
          </Button>
          <button
            className="iconbtn"
            onClick={() => nav('/nutrition')}
            aria-label={t('Daily Health Log')}
            title={t('Daily Health Log')}
          >
            <Icon name="bell" />
          </button>
          <button
            className="iconbtn"
            onClick={() => nav('/settings')}
            aria-label={t('Settings')}
            title={t('Settings')}
          >
            <Icon name="gear" />
          </button>
        </div>
      </div>

      {coachOn && <CoachCard nav={nav} />}

      {/* Main Responsive Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Card 1: Today's Scheduled Workout Hero Card */}
        <div
          className="card dash-col-7"
          style={{
            padding: '20px 22px',
            borderLeft: S.active
              ? '5px solid var(--coral)'
              : todayCompleted
                ? '5px solid var(--mint)'
                : scheduledTemplate
                  ? '5px solid var(--cyan)'
                  : '5px solid var(--sep)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16
          }}
        >
          <div>
            <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: S.active ? 'var(--coral)' : 'var(--cyan)', boxShadow: `0 0 10px ${S.active ? 'var(--coral)' : 'var(--cyan)'}` }} />
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--cyan)', letterSpacing: '0.08em' }}>
                  {t("TODAY'S SCHEDULED WORKOUT")}
                </span>
              </div>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                {todayCompleted && (
                  <span className="tag acc" style={{ fontSize: 11, padding: '3px 10px', borderRadius: 9999, fontWeight: 700 }}>
                    ✓ {t('Completed')}
                  </span>
                )}
                {S.active && (
                  <span className="tag" style={{ fontSize: 11, padding: '3px 10px', borderRadius: 9999, background: 'rgba(255, 42, 95, 0.16)', color: 'var(--coral)', border: '1px solid rgba(255, 42, 95, 0.35)' }}>
                    {t('In Progress')}
                  </span>
                )}
                {isScheduledRest && !S.active && (
                  <span className="tag" style={{ fontSize: 11, padding: '3px 10px', borderRadius: 9999, background: 'var(--surface-2)', color: 'var(--label-2)' }}>
                    <Icon name="moon" style={{ marginRight: 4 }} />
                    {t('Rest Day')}
                  </span>
                )}
              </div>
            </div>

            {scheduledTemplate || S.active ? (
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--label)', letterSpacing: '-0.02em', fontFamily: "'Outfit', sans-serif" }}>
                  {S.active ? t('{0} — in progress', S.active.name) : scheduledTemplate.name}
                </div>
                <div className="muted small" style={{ marginTop: 4, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{scheduledTemplate?.exercises?.length || 0} {t(scheduledTemplate?.exercises?.length === 1 ? 'exercise' : 'exercises')}</span>
                  {scheduledTemplate?.category && <span>· {scheduledTemplate.category}</span>}
                  <span>· {todayInfo.fullFormatted}</span>
                </div>

                {/* Exercise Pills Preview */}
                {!S.active && scheduledTemplate?.exercises && scheduledTemplate.exercises.length > 0 && (
                  <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {scheduledTemplate.exercises.slice(0, 6).map((ex, idx) => (
                      <span
                        key={ex.id || idx}
                        style={{
                          fontSize: 11,
                          padding: '4px 9px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          borderRadius: 8,
                          color: 'var(--label-2)',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        {ex.name} <strong style={{ color: 'var(--label)' }}>{ex.sets}×{ex.reps}</strong>
                      </span>
                    ))}
                    {scheduledTemplate.exercises.length > 6 && (
                      <span style={{ fontSize: 11, padding: '4px 8px', color: 'var(--label-3)' }}>
                        +{scheduledTemplate.exercises.length - 6} {t('more')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--label)' }}>
                  {t('No workout scheduled for today.')}
                </div>
                <div className="muted small" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>
                  {t('Enjoy your recovery or assign a custom template from your Weekly Workout Planner.')}
                </div>
              </div>
            )}
          </div>

          <div className="row" style={{ gap: 10, marginTop: 4 }}>
            <Button
              variant="primary"
              size="md"
              icon={S.active ? 'play' : 'dumbbell'}
              onClick={handleStartTodayWorkout}
              style={{ flex: 1.3 }}
            >
              {S.active ? t('Resume Workout') : (scheduledTemplate ? t('Start Workout') : t('Open Planner'))}
            </Button>
            <Button
              variant="tinted"
              size="md"
              icon="calendar"
              onClick={() => nav('/planner')}
              style={{ flex: 1 }}
            >
              {t('Weekly Planner')}
            </Button>
          </div>
        </div>

        {/* Card 2: Activity Overview & Today's Progress Ring */}
        <div className="progress-hero-card dash-col-5" style={{ marginBottom: 0 }}>
          <div className="progress-hero-ring-wrap">
            <svg className="progress-hero-svg" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="var(--surface-2)"
                strokeWidth="9"
              />
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="var(--cyan)"
                strokeWidth="9"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="progress-hero-center">
              <span className="progress-hero-percent">{progressScore}%</span>
              <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--label-3)', fontWeight: 700, letterSpacing: '0.04em' }}>{t('Daily')}</span>
            </div>
          </div>

          <div className="progress-hero-metrics">
            <div className="progress-hero-metric-row">
              <div className="progress-hero-metric-label">
                <span className="progress-hero-metric-dot" style={{ background: 'var(--cyan)' }} />
                <span>{t('Workout')}</span>
              </div>
              <span className="progress-hero-metric-val">
                {totalWorkoutMin > 0 ? `${totalWorkoutMin} min` : (scheduledTemplate ? scheduledTemplate.name : t('Rest day'))}
              </span>
            </div>

            <div className="progress-hero-metric-row">
              <div className="progress-hero-metric-label">
                <span className="progress-hero-metric-dot" style={{ background: 'var(--coral)' }} />
                <span>{t('Target')}</span>
              </div>
              <span className="progress-hero-metric-val">{targetCalories} kcal</span>
            </div>

            <div className="progress-hero-metric-row">
              <div className="progress-hero-metric-label">
                <span className="progress-hero-metric-dot" style={{ background: 'var(--teal)' }} />
                <span>{t('Steps')}</span>
              </div>
              <span className="progress-hero-metric-val">
                {recordedSteps > 0 ? recordedSteps.toLocaleString() : '0'}
              </span>
            </div>

            <div className="progress-hero-metric-row">
              <div className="progress-hero-metric-label">
                <span className="progress-hero-metric-dot" style={{ background: 'var(--lavender)' }} />
                <span>{t('Water')}</span>
              </div>
              <span className="progress-hero-metric-val">
                {waterLitres} L <span style={{ color: 'var(--label-2)', fontWeight: 400, fontSize: 11 }}>/ {waterGoal}L</span>
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Weekly Activity Bar Chart */}
        <div className="weekly-activity-card dash-col-7" style={{ marginBottom: 0 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--label)', fontFamily: "'Outfit', sans-serif" }}>
                {t('Weekly Activity')}
              </h2>
              <div className="dim small" style={{ fontSize: 11, marginTop: 2 }}>{t('Tap any day to preview or log workout')}</div>
            </div>
            <div className="row" style={{ gap: 4, alignItems: 'center' }}>
              <button
                className="iconbtn"
                style={{ width: 30, height: 30, fontSize: 13 }}
                onClick={() => setWeekOffset(w => w - 1)}
                aria-label="Previous week"
              >
                <Icon name="chevronLeft" />
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', padding: '0 4px' }}>{wkLabel}</span>
              <button
                className="iconbtn"
                style={{ width: 30, height: 30, fontSize: 13 }}
                onClick={() => setWeekOffset(w => w + 1)}
                aria-label="Next week"
              >
                <Icon name="chevronRight" />
              </button>
            </div>
          </div>

          <div className="weekly-activity-strip">
            {weekData.map((d, idx) => (
              <div
                key={idx}
                className={`weekly-bar-col ${d.isToday ? 'active' : ''} ${d.done ? 'completed' : ''}`}
                onClick={() => dayOverrideSheet(d.iso)}
                title={`${d.dayName} ${d.dateNum}: ${d.done ? 'Completed' : d.planned ? 'Planned' : 'Rest'}`}
              >
                <div className="weekly-bar-track">
                  <div
                    className="weekly-bar-fill"
                    style={{ height: `${d.fillPercent}%` }}
                  />
                </div>
                <span className="weekly-bar-day">{d.dayName.slice(0, 1)}</span>
                <div className="weekly-bar-dot" />
              </div>
            ))}
          </div>
        </div>

        {/* Card 4: Quick Actions 2x2 Glass Grid */}
        <div className="dash-col-5">
          <div className="quick-actions-grid" style={{ marginBottom: 0, height: '100%' }}>
            <div className="quick-action-card" onClick={handleStartTodayWorkout}>
              <div className="quick-action-icon mint">
                <Icon name={S.active ? 'play' : 'dumbbell'} />
              </div>
              <div className="quick-action-title">
                {S.active ? t('Resume Workout') : (scheduledTemplate ? t('Start Workout') : t('Workout Planner'))}
              </div>
              <div className="quick-action-desc">
                {S.active ? t('In progress') : (scheduledTemplate ? scheduledTemplate.name : t('No workout scheduled'))}
              </div>
            </div>

            <div className="quick-action-card" onClick={() => cardioSheet(null, todayStr)}>
              <div className="quick-action-icon coral" style={{ background: 'rgba(0, 242, 254, 0.14)', color: 'var(--cyan)' }}>
                <Icon name="figureRun" />
              </div>
              <div className="quick-action-title">{t('Log Cardio')}</div>
              <div className="quick-action-desc">
                {t('Walking, running, cycling')}
              </div>
            </div>

            <div className="quick-action-card" onClick={() => nav('/nutrition')}>
              <div className="quick-action-icon coral">
                <Icon name="apple" />
              </div>
              <div className="quick-action-title">{t('Log Food')}</div>
              <div className="quick-action-desc">
                {foodCount > 0 ? t('{0} entries today', foodCount) : t('Manual health log')}
              </div>
            </div>

            <div className="quick-action-card" onClick={() => bwSheet()}>
              <div className="quick-action-icon lavender">
                <Icon name="scale" />
              </div>
              <div className="quick-action-title">{t('Body Stats')}</div>
              <div className="quick-action-desc">
                {bw ? `${fmtNum(bw.w)} ${S.unit}` : t('Record weight')}
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Body Weight Line Chart */}
        <div className="card dash-col-7" style={{ marginBottom: 0 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--label)', fontFamily: "'Outfit', sans-serif" }}>
                {t('Body weight & Trend')}
              </h2>
              <div className="dim small" style={{ fontSize: 11, marginTop: 2 }}>{t('Last 30 recorded weigh-ins')}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--amber)' } : undefined} onClick={goalSheet}>
                {S.targetW ? fmtNum(S.targetW) : t('Goal')}
              </Button>
              <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
            </div>
          </div>
          {bw ? (
            <>
              <div className="row" style={{ gap: 8, alignItems: 'baseline', marginTop: 6 }}>
                <div className="big" style={{ fontFamily: "'Outfit', sans-serif" }}>{fmtNum(bw.w)} <span className="muted" style={{ fontSize: '1rem', fontWeight: 500 }}>{S.unit}</span></div>
                {!!delta && (
                  <span className="small row" style={{ gap: 2, fontWeight: 700, color: bwDeltaColor(delta, bw.w) }}>
                    <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 12 }} />
                    {fmtNum(Math.abs(delta))}
                  </span>
                )}
                <span className="dim small" style={{ marginLeft: 'auto' }}>{fmtDate(bw.d, true)}</span>
              </div>
              {S.targetW && (
                <div className="small row" style={{ color: 'var(--amber)', marginTop: 4, gap: 5 }}>
                  <Icon name="target" style={{ fontSize: 13 }} />
                  <span>
                    {t('Goal')} {fmtNum(S.targetW)} {S.unit} · {Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}
                  </span>
                </div>
              )}
              <div className="chart" style={{ marginTop: 12 }}>
                <LineChart points={bwPoints} h={140} unit={S.unit} goal={S.targetW} />
              </div>
            </>
          ) : (
            <div className="muted small" style={{ padding: '24px 0', textAlign: 'center' }}>
              {t("No entries yet — log your weight to start the curve. It's also asked before every workout.")}
            </div>
          )}
        </div>

        {/* Card 6: Today's Muscle Activity & Target Chart */}
        <div className="dash-col-5" style={{ marginBottom: 0 }}>
          <TodayMuscleChart S={S} body={S.body || 'male'} />
        </div>

        {/* Card 7: Streak & Workouts Total Card */}
        <div className="card tappable dash-col-12" style={{ cursor: 'pointer', marginBottom: 0 }} onClick={() => calendarSheet()}>
          <div className="row between" style={{ alignItems: 'center' }}>
            <div className="row" style={{ gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255, 42, 95, 0.15)', color: 'var(--coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: '1px solid rgba(255, 42, 95, 0.3)' }}>
                <Icon name="flame" />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--label)', fontFamily: "'Outfit', sans-serif" }}>
                  {t('{0} week streak', streakWeeks(S))}
                </div>
                <div className="muted small" style={{ marginTop: 3 }}>
                  {wThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')} · {t(S.workouts.length === 1 ? '{0} workout total' : '{0} workouts total', S.workouts.length)}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 6, alignItems: 'center', color: 'var(--cyan)' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{t('View Calendar')}</span>
              <Icon name="chevronRight" style={{ fontSize: 16 }} />
            </div>
          </div>
        </div>

        {/* Welcome Starter Plan Card (if no routines exist yet) */}
        {!S.routines.length && !S.active && (
          <div className="card dash-col-12" style={{ marginTop: 10 }}>
            <div className="row" style={{ gap: 10, marginBottom: 8 }}>
              <span className="lrow-i" style={{ background: 'var(--cyan)' }}><Icon name="sparkles" /></span>
              <div className="big" style={{ fontSize: 22, fontFamily: "'Outfit', sans-serif" }}>{t('Welcome to openGym!')}</div>
            </div>
            <div className="muted small" style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
              {t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}
            </div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <Button variant="primary" icon="sparkles" onClick={loadStarterPlan}>
                {t('Load starter plan (PPL)')}
              </Button>
              <Button variant="tinted" icon="calendar" onClick={() => nav('/planner')}>
                {t('Weekly Workout Planner')}
              </Button>
              <Button variant="ghost" onClick={() => nav('/plan')}>
                {t('Build my own plan')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
