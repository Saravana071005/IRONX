import { Component, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, getHealthStorageKey } from '../store/useStore.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW, setsDone } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekKey, DAYS } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor, cardioSheet, weightProgressSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { coachAvailable, hasConsent } from '../lib/coach.js'
import { useCoachStatus } from '../lib/coach-api.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import {
  getTodayScheduledWorkout,
  createSessionFromTemplate,
  getTodayDisplayDate,
  getUserTemplates
} from '../lib/customPlanner.js'
import { unlockAudio } from '../lib/sound.js'
import HomeMealTracker from '../components/HomeMealTracker.jsx'

/**
 * WidgetBoundary isolates failures in individual dashboard sections
 * so no single widget can crash the entire Home page.
 */
class WidgetBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.warn(`[IRONX Widget Error] ${this.props.title || 'Widget'}:`, error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="card"
          style={{
            padding: '20px',
            borderRadius: 20,
            background: 'var(--surface)',
            border: '1px solid var(--theme-accent-border, var(--border-gold))',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: 120
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-2)' }}>
            {this.props.title || t('Section')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--label-3)' }}>
            {t('Could not load this section')}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              background: 'var(--surface-2)',
              color: 'var(--theme-accent, #F5F5F5)',
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid var(--theme-accent-border, var(--borders, #303036))',
              cursor: 'pointer'
            }}
          >
            {t('Retry')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function CoachCard({ nav }) {
  const S = useStore(s => s.S)
  const { job, pending } = useCoachStatus(hasConsent(S))
  if (!hasConsent(S) || (!job && !pending)) return null
  const ready = !!pending
  return (
    <div
      className="card"
      style={{
        border: ready ? '1px solid var(--theme-accent, #F5F5F5)' : '1px solid var(--theme-accent-border, var(--borders, #303036))',
        background: 'var(--surface)',
        marginBottom: 16
      }}
    >
      <div
        className="today-row"
        onClick={() => nav(ready ? '/coach/proposal' : '/coach')}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}
      >
        <div className="row" style={{ gap: 12, minWidth: 0, display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--theme-accent-light, var(--borders, #303036))',
              color: 'var(--theme-accent, #F5F5F5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--theme-accent-border, var(--borders, #303036))'
            }}
          >
            <Icon name="sparkles" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-accent, #F5F5F5)', textTransform: 'uppercase' }}>
              {t('AI Coach')}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>
              {ready
                ? (pending.kind === 'create'
                  ? t('Your plan is ready')
                  : t(pending.changes?.length === 1 ? '{0} suggestion for you' : '{0} suggestions for you', pending.changes?.length || 0))
                : t('Reading your training…')}
            </div>
          </div>
        </div>
        {ready ? (
          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 9999, background: '#FFFFFF', color: '#09090B', fontWeight: 700 }}>
            {t('Review')}
          </span>
        ) : (
          <Icon name="chevronRight" size={16} style={{ color: 'var(--label-3)' }} />
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const nav = useNavigate()
  const hookS = useStore(s => s.S)
  const hookUser = useStore(s => s.user)
  const S = (typeof window === 'undefined' && useStore.getState().S) ? useStore.getState().S : hookS
  const user = (typeof window === 'undefined' && useStore.getState().user) ? useStore.getState().user : hookUser
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const coachOn = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE })

  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => todayISO(), [])
  const todayInfo = useMemo(() => {
    try {
      return getTodayDisplayDate(today)
    } catch {
      return { fullFormatted: todayStr }
    }
  }, [today, todayStr])

  const userTemplates = useMemo(() => getUserTemplates(S), [S?.workoutTemplates])
  const hasTemplates = userTemplates.length > 0

  const bw = S ? lastBW(S) : null
  const prevBW = (S?.bodyweight && S.bodyweight.length > 1) ? S.bodyweight[S.bodyweight.length - 2] : null
  const hasBW = !!(bw && typeof bw.w === 'number' && !isNaN(bw.w))
  const currentWeightVal = hasBW ? bw.w : null
  const weightUnit = bw?.u || S?.unit || 'kg'
  const delta = (hasBW && prevBW && typeof prevBW.w === 'number')
    ? Number((bw.w - prevBW.w).toFixed(1))
    : null
  const deltaFormatted = delta !== null ? (delta > 0 ? `+${delta.toFixed(1)}` : `${delta.toFixed(1)}`) : null

  const allBW = (S?.bodyweight || []).slice().sort((a, b) => (a.d < b.d ? -1 : (a.d > b.d ? 1 : 0)))
  const firstBW = allBW.length > 0 ? allBW[0] : null
  const totalWeightDelta = (allBW.length > 1 && firstBW && bw)
    ? Number((bw.w - firstBW.w).toFixed(1))
    : null
  const progressDisplay = totalWeightDelta !== null
    ? (totalWeightDelta > 0 ? `+${totalWeightDelta} ${weightUnit}` : `${totalWeightDelta} ${weightUnit}`)
    : (hasBW ? `${currentWeightVal} ${weightUnit}` : '—')

  // Read today's scheduled workout from weekly planner
  const todayScheduled = useMemo(() => {
    try {
      return (S && today)
        ? (getTodayScheduledWorkout(S, today) || { isRest: false, isUnscheduled: true, template: null })
        : { isRest: false, isUnscheduled: true, template: null }
    } catch {
      return { isRest: false, isUnscheduled: true, template: null }
    }
  }, [S, today])

  const scheduledTemplate = todayScheduled?.template || null
  const isScheduledRest = !!todayScheduled?.isRest
  const isUnscheduled = !scheduledTemplate && !isScheduledRest

  // Read today's health log (food, water, cardio)
  const todayHealth = useMemo(() => {
    try {
      const key = getHealthStorageKey(user?.id, todayStr)
      const stored = localStorage.getItem(key)
      if (stored) return JSON.parse(stored)
    } catch (e) {}
    return null
  }, [user?.id, todayStr, S?.meals])

  const foodsToday = (todayHealth?.foods && todayHealth.foods.length > 0) ? todayHealth.foods : (S?.meals || []).filter(m => m && (m.d === todayStr || m.date === todayStr))
  const foodCount = foodsToday.length

  // Calculate calories and macros for donut chart (0 if no foods logged)
  const loggedCalories = useMemo(() => {
    return foodsToday.reduce((acc, f) => acc + (Number(f?.calories) || Number(f?.calorie) || Number(f?.energy_kcal) || 0), 0)
  }, [foodsToday])

  const proteinGrams = useMemo(() => {
    return foodsToday.reduce((acc, f) => acc + (Number(f?.protein) || Number(f?.protein_g) || 0), 0)
  }, [foodsToday])

  const carbsGrams = useMemo(() => {
    return foodsToday.reduce((acc, f) => acc + (Number(f?.carb) || Number(f?.carbs) || Number(f?.carb_g) || 0), 0)
  }, [foodsToday])

  const fatsGrams = useMemo(() => {
    return foodsToday.reduce((acc, f) => acc + (Number(f?.fat) || Number(f?.fat_g) || 0), 0)
  }, [foodsToday])

  const totalMacroGrams = proteinGrams + carbsGrams + fatsGrams
  const proteinPct = totalMacroGrams > 0 ? Math.round((proteinGrams / totalMacroGrams) * 100) : 0
  const carbsPct = totalMacroGrams > 0 ? Math.round((carbsGrams / totalMacroGrams) * 100) : 0
  const fatsPct = totalMacroGrams > 0 ? Math.max(0, 100 - proteinPct - carbsPct) : 0

  const targetCalories = Number(S?.nutritionTargets?.calorie || S?.nutritionTargets?.calories || user?.calorie_target || user?.nutritionTargets?.calorie) || 2000
  const caloriePct = targetCalories > 0 ? Math.min(100, Math.max(0, Math.round((loggedCalories / targetCalories) * 100))) : 0
  const remainingCalories = Math.max(0, targetCalories - loggedCalories)

  const isCardioOnDay = (c, targetIso) => {
    if (!c || !targetIso) return false
    if (c.d === targetIso || c.date === targetIso) return true
    if (typeof c.createdAt === 'string') return c.createdAt.slice(0, 10) === targetIso
    if (typeof c.createdAt === 'number') {
      try { return new Date(c.createdAt).toISOString().slice(0, 10) === targetIso } catch { return false }
    }
    return false
  }

  // Separate exercise calories burned (strength + cardio)
  const exerciseCaloriesBurned = useMemo(() => {
    let burned = 0
    const todayW = (S?.workouts || []).find(w => w && (w.d === todayStr || w.date === todayStr))
    if (todayW) {
      burned += Math.round((Number(todayW.dur) || 0) / 60000 * 6)
    }
    const cardioToday = (S?.cardioLogs || []).filter(c => isCardioOnDay(c, todayStr))
    for (const c of cardioToday) {
      burned += Number(c.calories_burned) || Number(c.caloriesBurned) || 0
    }
    return burned
  }, [S?.workouts, S?.cardioLogs, todayStr])

  // Workouts and week strip calculation
  const todayWorkout = (S?.workouts || []).find(w => w && (w.d === todayStr || w.date === todayStr))
  const wThisWeek = (S?.workouts || []).filter(w => w && w.d && weekKey(w.d) === weekKey(todayStr)).length
  const plannedPerWeek = Object.keys(S?.week || {}).filter(k => S?.week?.[k]).length || 5

  const streakCount = useMemo(() => {
    try {
      const w = streakWeeks(S)
      return typeof w === 'number' ? w : 0
    } catch {
      return 0
    }
  }, [S])

  // Week days for Weekly Activity and This Week Plan
  const monday = useMemo(() => {
    const d = new Date(today)
    d.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    return d
  }, [today])

  const doneDays = useMemo(() => new Set((S?.workouts || []).map(w => w?.d).filter(Boolean)), [S?.workouts])

  const weekActivityDays = useMemo(() => {
    const days = []
    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const iso = isoOf(d)
      const isToday = iso === todayStr
      const doneWorkout = (S?.workouts || []).some(w => w && w.d === iso)
      const doneCardio = (S?.cardioLogs || []).some(c => isCardioOnDay(c, iso))
      const done = doneWorkout || doneCardio
      const sched = (S && d) ? (getTodayScheduledWorkout(S, d) || { isRest: false, isUnscheduled: true, template: null }) : { isRest: false, isUnscheduled: true, template: null }
      const hasPlan = !sched.isRest && !sched.isUnscheduled && !!sched.template

      let fillH = 0
      if (done) fillH = 100
      else if (isToday && hasPlan) fillH = 40

      days.push({
        label: dayLabels[i],
        iso,
        isToday,
        done,
        fillH,
        active: done,
        sched,
        name: sched.template?.name || (sched.isRest ? t('Rest Day') : t('Not Scheduled'))
      })
    }
    return days
  }, [monday, todayStr, S])

  const handleStartTodayWorkout = () => {
    unlockAudio()
    if (S?.active) {
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
    if (!hasTemplates) {
      nav('/library')
      return
    }
    nav('/planner')
  }

  // Weight Progress Chart Points: ONLY real manually recorded entries in chronological order
  const rawWeightEntries = useMemo(() => {
    if (!S?.bodyweight || !Array.isArray(S.bodyweight)) return []
    return S.bodyweight
      .filter(b => b && typeof b.w === 'number' && !isNaN(b.w))
      .sort((a, b) => (a.d < b.d ? -1 : (a.d > b.d ? 1 : 0)))
  }, [S?.bodyweight])

  const chartWidth = 240
  const chartHeight = 70

  const coords = useMemo(() => {
    if (rawWeightEntries.length === 0) return []
    if (rawWeightEntries.length === 1) {
      return [{ x: Math.round(chartWidth / 2), y: Math.round(chartHeight / 2), val: rawWeightEntries[0].w, date: rawWeightEntries[0].d }]
    }
    const slice = rawWeightEntries.slice(-14)
    const vals = slice.map(b => b.w)
    const minW = Math.min(...vals) - 0.5
    const maxW = Math.max(...vals) + 0.5
    const rangeW = (maxW - minW) || 1
    const denom = slice.length - 1

    return slice.map((b, idx) => {
      const x = Math.round((idx / denom) * (chartWidth - 24) + 12)
      const rawY = chartHeight - 14 - ((b.w - minW) / rangeW) * (chartHeight - 28)
      const y = isNaN(rawY) ? Math.round(chartHeight / 2) : Math.round(rawY)
      return { x, y, val: b.w, date: b.d }
    })
  }, [rawWeightEntries, chartWidth, chartHeight])

  const pathD = useMemo(() => {
    if (!coords || coords.length < 2) return ''
    return coords.reduce((acc, pt, idx, arr) => {
      if (idx === 0) return `M ${pt.x} ${pt.y}`
      const prev = arr[idx - 1]
      const cpX = (prev.x + pt.x) / 2
      return `${acc} C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`
    }, '')
  }, [coords])

  const areaD = useMemo(() => {
    if (!coords || coords.length < 2 || !pathD) return ''
    const lastPt = coords[coords.length - 1]
    const firstPt = coords[0]
    return `${pathD} L ${lastPt.x} ${chartHeight} L ${firstPt.x} ${chartHeight} Z`
  }, [coords, pathD, chartHeight])

  // Donut chart calculations
  const donutR = 48
  const donutC = 2 * Math.PI * donutR
  const donutOffset = isNaN(donutC - (caloriePct / 100) * donutC) ? 0 : Math.max(0, donutC - (caloriePct / 100) * donutC)

  const userName = user?.name || 'Athlete'

  return (
    <div className="dashboard-layout" style={{ maxWidth: 1240, margin: '0 auto', width: '100%' }}>
      
      {/* 1. Main Dashboard Header & Greeting (Liquid Glass UI) & Metric Summary Strip */}
      <WidgetBoundary title={t('Dashboard Overview')}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 14
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#A5A5A5', letterSpacing: '0.02em', display: 'block', marginBottom: 2 }}>
            {todayInfo?.fullFormatted || 'Today, Mon, Nov 23'}
          </span>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              margin: '0',
              color: '#F5F5F5',
              letterSpacing: '-0.025em',
              fontFamily: "var(--font-heading)"
            }}
          >
            {t('Welcome back!')}
          </h1>
          <div style={{ fontSize: 13, color: '#A5A5A5', marginTop: 4 }}>
            <span>{t('Hi, {0} 👋', userName)}</span> · <span>{t('Stay consistent. Stronger every day with IRONX.')}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Search Button */}
          <button
            className="iconbtn"
            onClick={() => nav('/exercise-library')}
            aria-label={t('Search')}
            title={t('Search exercises')}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#F5F5F5',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Icon name="search" size={17} />
          </button>

          {/* Notification / Health Log Bell */}
          <button
            className="iconbtn"
            onClick={() => nav('/nutrition')}
            aria-label={t('Daily Health Log')}
            title={t('Daily Health Log')}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#F5F5F5',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.18)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Icon name="bell" size={17} />
            <span
              style={{
                position: 'absolute',
                top: 9,
                right: 9,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#FFFFFF',
                boxShadow: '0 0 6px #FFFFFF'
              }}
            />
          </button>

          {/* User Profile Avatar */}
          <div
            onClick={() => nav('/settings')}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.20)',
              color: '#F5F5F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 16,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.22)'
            }}
            title={t('User Profile')}
          >
            <Icon name="person" size={19} />
          </div>
        </div>
      </div>

      {/* Metric Summary Strip (Strict 3-Pill Row: Day Streak, Workouts, Progress) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginBottom: 16
        }}
        className="metric-summary-strip"
      >
        {/* Pill 1: Day Streak */}
        <div
          className="card"
          style={{
            padding: '12px 6px',
            borderRadius: 14,
            background: 'var(--surface-2)',
            border: '1px solid var(--borders)',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 2
          }}
        >
          <div style={{ color: 'var(--label)', marginBottom: 2 }}>
            <Icon name="flame" size={17} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)', fontFamily: 'var(--font-heading)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {streakCount > 0 ? streakCount : 0}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--label-2)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
            {t('Day Streak')}
          </span>
        </div>

        {/* Pill 2: Workouts */}
        <div
          className="card"
          style={{
            padding: '12px 6px',
            borderRadius: 14,
            background: 'var(--surface-2)',
            border: '1px solid var(--borders)',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 2
          }}
        >
          <div style={{ color: 'var(--label)', marginBottom: 2 }}>
            <Icon name="dumbbell" size={17} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)', fontFamily: 'var(--font-heading)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {wThisWeek > 0 ? wThisWeek : (S?.workouts?.length || 0)}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--label-2)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
            {t('Workouts')}
          </span>
        </div>

        {/* Pill 3: Progress (Clickable -> WeightProgressModal) */}
        <div
          className="card"
          onClick={() => weightProgressSheet()}
          role="button"
          tabIndex={0}
          title={t('View and log body weight progress')}
          style={{
            padding: '12px 6px',
            borderRadius: 14,
            background: 'var(--surface-2)',
            border: '1px solid var(--borders)',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 2,
            cursor: 'pointer'
          }}
        >
          <div style={{ color: 'var(--label)', marginBottom: 2 }}>
            <Icon name="chartLine" size={17} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--label)', fontFamily: 'var(--font-heading)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 4px' }}>
            {progressDisplay}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--label-2)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
            {t('Progress')}
          </span>
        </div>
      </div>
      </WidgetBoundary>

      {/* 6. Today in Progress */}
      {/* 1. Today's Schedule / Session (Full-width Hero Card) */}
      <WidgetBoundary title={t('Today in Progress')}>
        <div
          className="card"
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: '28px 30px',
            borderRadius: 22,
            background: 'var(--surface)',
            backgroundImage: 'var(--grad-glass-surface)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--theme-accent-border, var(--border-gold))',
            boxShadow: 'var(--card-shadow), var(--glass-highlight)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: 220,
            marginBottom: 18
          }}
        >
          {/* Ambient accent lighting background effect */}
          <div
            style={{
              position: 'absolute',
              top: '-20%',
              right: '-10%',
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--theme-accent-glow) 0%, transparent 70%)',
              filter: 'blur(45px)',
              pointerEvents: 'none'
            }}
          />
          {/* Decorative geometric accent arcs */}
          <svg
            style={{
              position: 'absolute',
              right: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 220,
              height: 220,
              opacity: 0.18,
              pointerEvents: 'none'
            }}
            viewBox="0 0 200 200"
          >
            <circle cx="100" cy="100" r="85" fill="none" stroke="var(--theme-accent, #F5F5F5)" strokeWidth="1" strokeDasharray="6 6" />
            <circle cx="100" cy="100" r="65" fill="none" stroke="var(--theme-accent, #F5F5F5)" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="45" fill="none" stroke="var(--theme-accent-highlight, var(--label, #F5F5F5))" strokeWidth="1" strokeDasharray="4 4" />
          </svg>

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Today's Date & Training Status Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 9999,
                background: 'var(--theme-accent-light, var(--borders, #303036))',
                border: '1px solid var(--theme-accent-border, var(--borders, #303036))',
                marginBottom: 12
              }}
            >
              <Icon name="calendar" size={13} style={{ color: 'var(--theme-accent, #F5F5F5)' }} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--theme-accent, #F5F5F5)',
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase'
                }}
              >
                {todayInfo.dayName || t('Today')} · {
                  S?.active
                    ? t('In Progress')
                    : todayWorkout
                    ? t('Completed ✓')
                    : !hasTemplates
                    ? t('Workout Setup')
                    : scheduledTemplate
                    ? t('Scheduled Session')
                    : isScheduledRest
                    ? t('Rest & Recovery')
                    : t('Not Scheduled')
                }
              </span>
            </div>

            {/* Main Workout Session Heading */}
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: 'var(--label)',
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
                fontFamily: "var(--font-heading)"
              }}
            >
              {S?.active
                ? (S.active.name || t('Active Workout'))
                : todayWorkout
                ? (todayWorkout.name || scheduledTemplate?.name || t('Completed Workout'))
                : !hasTemplates
                ? t('Set Up Your First Workout Template')
                : scheduledTemplate
                ? scheduledTemplate.name
                : isScheduledRest
                ? t('Rest & Muscle Recovery')
                : t('No Workout Scheduled')}
            </div>

            {todayWorkout ? (
              /* Fitness Metrics for Completed Workout */
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginTop: 12,
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--label-2)' }}>
                  <Icon name="dumbbell" size={14} style={{ color: 'var(--theme-accent, #F5F5F5)' }} />
                  <span>
                    {`${todayWorkout.entries?.length || 0} ${t('exercises completed')}`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--label-2)' }}>
                  <Icon name="timer" size={14} style={{ color: 'var(--theme-accent, #F5F5F5)' }} />
                  <span>{`${Math.max(1, Math.round((todayWorkout.dur || 0) / 60000))} min`}</span>
                </div>
                {setsDone(todayWorkout) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--label-2)' }}>
                    <Icon name="checkCircle" size={14} style={{ color: 'var(--theme-accent, #F5F5F5)' }} />
                    <span>{`${setsDone(todayWorkout)} ${t('sets completed')}`}</span>
                  </div>
                )}
              </div>
            ) : !hasTemplates ? (
              <div style={{ color: 'var(--label-2)', fontSize: 13, marginTop: 10, maxWidth: 520, lineHeight: 1.45 }}>
                {t('Create your workout template to start tracking your fitness journey.')}
              </div>
            ) : S?.active || scheduledTemplate ? (
              /* Clean Fitness Metrics Row */
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginTop: 12,
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--label-2)' }}>
                  <Icon name="dumbbell" size={14} style={{ color: 'var(--theme-accent, #F5F5F5)' }} />
                  <span>
                    {`${(S?.active ? S.active.entries : (scheduledTemplate?.exercises || scheduledTemplate?.ex || []))?.length || 0} ${t('exercises')}`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--label-2)' }}>
                  <Icon name="timer" size={14} style={{ color: 'var(--theme-accent, #F5F5F5)' }} />
                  <span>{S?.active ? t('In progress') : '~45–60 min'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--label-2)' }}>
                  <Icon name="flame" size={14} style={{ color: 'var(--theme-accent, #F5F5F5)' }} />
                  <span>~380 kcal</span>
                </div>
              </div>
            ) : isScheduledRest ? (
              <div style={{ color: 'var(--label-2)', fontSize: 13, marginTop: 10, maxWidth: 520, lineHeight: 1.45 }}>
                {t('Today is a scheduled recovery day. Rest, hydrate, and allow your muscles to rebuild.')}
              </div>
            ) : (
              <div style={{ color: 'var(--label-2)', fontSize: 13, marginTop: 10, maxWidth: 520, lineHeight: 1.45 }}>
                {t('Assign a workout template in your Weekly Planner to get started.')}
              </div>
            )}

            {/* Action Button */}
            {todayWorkout ? (
              <button
                onClick={() => nav('/nutrition')}
                style={{
                  marginTop: 22,
                  padding: '12px 24px',
                  borderRadius: 9999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--label)',
                  color: 'var(--bg)',
                  fontWeight: 800,
                  fontSize: 14,
                  border: '1px solid var(--borders)',
                  cursor: 'pointer',
                  boxShadow: 'var(--card-shadow)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <Icon name="check" size={15} />
                <span>{t('View in Health Log')}</span>
              </button>
            ) : !hasTemplates ? (
              <button
                onClick={() => nav('/library')}
                style={{
                  marginTop: 22,
                  padding: '12px 24px',
                  borderRadius: 9999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--label)',
                  color: 'var(--bg)',
                  fontWeight: 800,
                  fontSize: 14,
                  border: '1px solid var(--borders)',
                  cursor: 'pointer',
                  boxShadow: 'var(--card-shadow)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <span>{t('Create Template')}</span>
                <Icon name="plus" size={15} />
              </button>
            ) : S?.active ? (
              <button
                onClick={() => nav('/workout')}
                style={{
                  marginTop: 22,
                  padding: '12px 24px',
                  borderRadius: 9999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--label)',
                  color: 'var(--bg)',
                  fontWeight: 800,
                  fontSize: 14,
                  border: '1px solid var(--borders)',
                  cursor: 'pointer',
                  boxShadow: 'var(--card-shadow)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <span>{t('Resume Workout')}</span>
                <Icon name="arrowRight" size={15} />
              </button>
            
            ) : scheduledTemplate ? (
              <button
                onClick={handleStartTodayWorkout}
                style={{
                  marginTop: 22,
                  padding: '12px 24px',
                  borderRadius: 9999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--label)',
                  color: 'var(--bg)',
                  fontWeight: 800,
                  fontSize: 14,
                  border: '1px solid var(--borders)',
                  cursor: 'pointer',
                  boxShadow: 'var(--card-shadow)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <span>{t('Start Workout')}</span>
                <Icon name="arrowRight" size={15} />
              </button>
            ) : (
              <button
                onClick={() => nav('/planner')}
                style={{
                  marginTop: 22,
                  padding: '12px 24px',
                  borderRadius: 9999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--surface-3)',
                  color: 'var(--theme-accent, #F5F5F5)',
                  border: '1px solid var(--theme-accent-border, var(--borders, #303036))',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <span>{t('Open Weekly Planner')}</span>
                <Icon name="arrowRight" size={15} />
              </button>
            )}
          </div>
        </div>
      </WidgetBoundary>

      {/* 3. Target Today */}
      {/* 8. Target Today Card (Strict Monochrome) */}
      <WidgetBoundary title={t('Target Today')}>
        <div
          className="card"
          style={{
            padding: '16px 18px',
            borderRadius: 14,
            background: 'var(--surface-2)',
            border: '1px solid var(--borders)',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-2)', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span>🎯</span>
              <span>{t('Target Today')}</span>
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('Day {0} of 30', Math.min(30, (streakCount || 0) + 1))}
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>
            {S?.active?.name || scheduledTemplate?.name || (todayWorkout ? todayWorkout.name : t('Daily Workout Session'))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--borders)', fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--label)' }}>
              <span>🔥</span>
              <span>{streakCount > 0 ? `${streakCount}-Day Streak` : 'Streak Active'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--label-2)', fontWeight: 600 }}>
              <Icon name="bolt" size={14} style={{ color: 'var(--label)' }} />
              <span>{exerciseCaloriesBurned > 0 ? `${exerciseCaloriesBurned} kcal burned` : `${Math.round(loggedCalories || 0)} kcal burned`}</span>
            </div>
          </div>
        </div>
      </WidgetBoundary>

      {/* 4. Daily Biometrics & Calories Overview */}
      <div style={{ marginBottom: 16 }}>
        <WidgetBoundary title={t('Calories Overview')}>
          <div
            className="card"
            style={{
              padding: '20px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.06)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="vital" size={18} style={{ color: 'var(--label)' }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>
                    {t('Daily Bio-Metrics')} · {t('Calories Overview')}
                  </span>
                </div>
                <button
                  onClick={() => nav('/nutrition')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--label)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Icon name="plus" size={13} />
                  <span>{t('Log Meal')}</span>
                </button>
              </div>

              {/* Biometric Metrics Trio (Protein, Calories, Hydration/Carbs) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  marginBottom: 14
                }}
              >
                {/* Protein Ring Metric */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '10px 6px',
                    borderRadius: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--borders)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ position: 'relative', width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--borders)" strokeWidth="3.5" />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="var(--label)"
                        strokeDasharray={`${Math.min(100, Math.round((proteinGrams / 180) * 100))}, 100`}
                        strokeLinecap="round"
                        strokeWidth="3.5"
                      />
                    </svg>
                    <span style={{ position: 'absolute', fontSize: 11, fontWeight: 700, color: 'var(--label)' }}>
                      {`${Math.min(100, Math.round((proteinGrams / 180) * 100))}%`}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label)', lineHeight: 1.1 }}>
                    {proteinGrams} / 180g
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>
                    {t('Protein')}
                  </span>
                </div>

                {/* Calories Ring Metric */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '10px 6px',
                    borderRadius: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--borders)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ position: 'relative', width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--borders)" strokeWidth="3.5" />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="var(--label)"
                        strokeDasharray={`${Math.min(100, Math.round((loggedCalories / targetCalories) * 100))}, 100`}
                        strokeLinecap="round"
                        strokeWidth="3.5"
                      />
                    </svg>
                    <span style={{ position: 'absolute', fontSize: 11, fontWeight: 700, color: 'var(--label)' }}>
                      {loggedCalories > 999 ? `${(loggedCalories / 1000).toFixed(1)}k` : loggedCalories}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label)', lineHeight: 1.1 }}>
                    {`${loggedCalories.toLocaleString()} / ${targetCalories.toLocaleString()} kcal`}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>
                    {t('Calories')}
                  </span>
                </div>

                {/* Hydration / Carbs Ring Metric */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '10px 6px',
                    borderRadius: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--borders)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ position: 'relative', width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--borders)" strokeWidth="3.5" />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="var(--label-2)"
                        strokeDasharray={`${Math.min(100, Math.round((carbsGrams / 250) * 100))}, 100`}
                        strokeLinecap="round"
                        strokeWidth="3.5"
                      />
                    </svg>
                    <span style={{ position: 'absolute', fontSize: 11, fontWeight: 700, color: 'var(--label)' }}>
                      {`${Math.min(100, Math.round((carbsGrams / 250) * 100))}%`}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label)', lineHeight: 1.1 }}>
                    {carbsGrams} / 250g
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>
                    {t('Carbs')}
                  </span>
                </div>
              </div>
            </div>

            {/* Exercise Burned & Remaining Status */}
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--borders)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--label-2)'
              }}
            >
              <span>
                {t('Remaining')}: <strong style={{ color: 'var(--theme-accent, #F5F5F5)' }}>{`${remainingCalories.toLocaleString()} kcal`}</strong>
              </span>
              <span>
                {t('Exercise Burned')}: <strong style={{ color: 'var(--label)' }}>{`${exerciseCaloriesBurned} kcal`}</strong>
              </span>
            </div>
          </div>
        </WidgetBoundary>
      </div>

      {/* 7. Quick Actions */}
      {/* 3. Quick Actions Grid (Google Stitch 4-Column Touch-Friendly Layout) */}
      <WidgetBoundary title={t('Quick Actions')}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)', marginBottom: 12 }}>{t('Quick Actions')}</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8
            }}
            className="quick-actions-strip"
          >
            {/* Action 1: Log Workout */}
            <button
              onClick={handleStartTodayWorkout}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 6px',
                borderRadius: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--borders)',
                boxShadow: 'var(--card-shadow)',
                gap: 6,
                cursor: 'pointer',
                textAlign: 'center',
                minHeight: 76,
                transition: 'background 0.15s ease, transform 0.1s ease'
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--surface-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--label)'
                }}
              >
                <Icon name="dumbbell" size={18} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {t('Log Workout')}
              </span>
            </button>

            {/* Action 2: Log Food */}
            <button
              onClick={() => nav('/nutrition')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 6px',
                borderRadius: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--borders)',
                boxShadow: 'var(--card-shadow)',
                gap: 6,
                cursor: 'pointer',
                textAlign: 'center',
                minHeight: 76,
                transition: 'background 0.15s ease, transform 0.1s ease'
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--surface-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--label)'
                }}
              >
                <Icon name="apple" size={18} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {t('Log Food')}
              </span>
            </button>

            {/* Action 3: Log Cardio */}
            <button
              onClick={() => cardioSheet(null, todayStr)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 6px',
                borderRadius: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--borders)',
                boxShadow: 'var(--card-shadow)',
                gap: 6,
                cursor: 'pointer',
                textAlign: 'center',
                minHeight: 76,
                transition: 'background 0.15s ease, transform 0.1s ease'
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--surface-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--label)'
                }}
              >
                <Icon name="figureRun" size={18} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {t('Log Cardio')}
              </span>
            </button>

            {/* Action 4: Body Stats */}
            <button
              onClick={() => weightProgressSheet()}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 6px',
                borderRadius: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--borders)',
                boxShadow: 'var(--card-shadow)',
                gap: 6,
                cursor: 'pointer',
                textAlign: 'center',
                minHeight: 76,
                transition: 'background 0.15s ease, transform 0.1s ease'
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--surface-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--label)'
                }}
              >
                <Icon name="scale" size={18} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {t('Body Stats')}
              </span>
            </button>
          </div>
        </div>
      </WidgetBoundary>

      {/* 5. Today's Meal Tracker */}
      {/* 9. Today's Meal Tracker (4 Strict Meal Rows) */}
      <WidgetBoundary title={t("Today's Meal Tracker")}>
        <div style={{ marginBottom: 24 }}>
          <HomeMealTracker
            date={todayISO()}
            onNavigateNutrition={() => nav('/nutrition')}
          />
        </div>
      </WidgetBoundary>

      {/* 8. Weekly Activity */}
      {/* 4. Weekly Activity Card (Google Stitch Design Transfer) */}
      <WidgetBoundary title={t('Weekly Activity')}>
        <div
          className="card"
          style={{
            padding: '20px',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.06)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 190,
            marginBottom: 18
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)', letterSpacing: '-0.015em', margin: 0, textTransform: 'lowercase' }}>
              {t('Weekly Activity')}
            </h3>
            <button
              onClick={() => nav('/stats')}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--label)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>{t('View All')}</span>
              <Icon name="chevronRight" size={12} />
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: 110,
              paddingTop: 8,
              paddingBottom: 2
            }}
          >
            {weekActivityDays.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1
                }}
              >
                {/* Vertical Pill Bar Track (Monochrome) */}
                <div
                  style={{
                    width: 12,
                    height: 80,
                    borderRadius: 9999,
                    background: 'rgba(255, 255, 255, 0.08)',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.14)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${item.fillH}%`,
                      borderRadius: 9999,
                      background: item.active
                        ? '#FFFFFF'
                        : 'rgba(255, 255, 255, 0.08)',
                      boxShadow: item.active ? '0 0 12px rgba(255, 255, 255, 0.4)' : 'none',
                      transition: 'height 0.4s ease'
                    }}
                  />
                </div>
                {/* Day Label */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: item.isToday ? 800 : 600,
                    color: item.isToday ? '#FFFFFF' : '#71717A'
                  }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </WidgetBoundary>

      {/* 9. Your Progress */}
      {/* 5. Your Progress Card */}
      <WidgetBoundary title={t('Your Progress')}>
        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius: 22,
            background: 'var(--surface)',
            backgroundImage: 'var(--grad-glass-surface)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--theme-accent-border, var(--border-gold))',
            boxShadow: 'var(--card-shadow), var(--glass-highlight)',
            marginBottom: 18
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>
              {t('Your Progress')}
            </span>
            <button
              onClick={() => weightProgressSheet()}
              style={{
                padding: '5px 12px',
                borderRadius: 10,
                background: 'var(--surface-2)',
                border: '1px solid var(--theme-accent-border, var(--borders, #303036))',
                fontSize: 12,
                color: 'var(--theme-accent, #F5F5F5)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
            >
              <span>{t('Body Weight')}</span>
              <Icon name="plus" size={13} />
            </button>
          </div>

          {rawWeightEntries.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 32, color: 'var(--theme-accent, #F5F5F5)', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                <Icon name="scale" size={34} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--label)', marginBottom: 4 }}>
                {t('No weight records yet')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--label-2)', marginBottom: 16, maxWidth: 300, margin: '0 auto 16px auto', lineHeight: 1.4 }}>
                {t('Add your first body weight entry to start tracking progress.')}
              </div>
              <button
                onClick={() => weightProgressSheet()}
                style={{
                  padding: '8px 22px',
                  borderRadius: 9999,
                  background: '#FFFFFF',
                  color: '#09090B',
                  fontWeight: 800,
                  fontSize: 13,
                  border: '1px solid #303036',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(255, 255, 255, 0.2)'
                }}
              >
                {t('Add Weight')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--label)', lineHeight: 1.1 }}>
                  {currentWeightVal} {weightUnit}
                </div>
                {deltaFormatted ? (
                  <div style={{ fontSize: 12, color: '#FFFFFF', fontWeight: 600, marginTop: 4 }}>
                    ▽ {deltaFormatted} kg ({t('Last change')})
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 4 }}>
                    {rawWeightEntries.length === 1 ? t('First entry') : fmtDate(rawWeightEntries[rawWeightEntries.length - 1].d)}
                  </div>
                )}
              </div>

              {/* Dynamic Accent SVG Smooth Line Chart */}
              <div style={{ width: chartWidth, height: chartHeight, flex: 'none' }}>
                <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="chartAccentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--label)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--label)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Gradient Area under curve */}
                  {areaD ? <path d={areaD} fill="url(#chartAccentGrad)" /> : null}
                  {/* Glowing Line */}
                  {pathD ? (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="var(--label)" strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  ) : null}
                  {/* Data Points */}
                  {coords.map((pt, idx) => (
                    <circle
                      key={idx}
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill="var(--label)"
                      stroke="var(--surface)"
                      strokeWidth="2"
                    />
                  ))}
                </svg>
              </div>
            </div>
          )}
        </div>
      </WidgetBoundary>

      {/* 10. This Week Plan */}
      <div style={{ marginBottom: 24 }}>
        <WidgetBoundary title={t('This Week Plan')}>
          <div
            className="card"
            style={{
              padding: '20px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.06)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
              background: 'var(--surface)',
              backgroundImage: 'var(--grad-glass-surface)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: '1px solid var(--theme-accent-border, var(--border-gold))',
              boxShadow: 'var(--card-shadow), var(--glass-highlight)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>
                  {t('This Week Plan')}
                </span>
                <button
                  onClick={() => nav('/planner')}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span>{t('View Full Plan')}</span>
                  <Icon name="arrowRight" size={13} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {weekActivityDays.slice(0, 4).map((day, idx) => {
                  const isDayToday = day.isToday
                  const sched = day.sched || getTodayScheduledWorkout(S, day.iso)
                  const hasCompleted = (S?.workouts || []).some(w => w && w.d === day.iso)
                  const dayNameLabel = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx]

                  let titleText = t('Not Scheduled')
                  let statusBadge = (
                    <span style={{ fontSize: 12, color: 'var(--label-2)' }}>
                      {t('Not Scheduled')}
                    </span>
                  )

                  if (hasCompleted) {
                    titleText = sched.template?.name || t('Workout')
                    statusBadge = (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ✓ {t('Completed')}
                      </span>
                    )
                  } else if (sched.template) {
                    titleText = sched.template.name
                    statusBadge = (
                      <span style={{ fontSize: 12, color: '#A1A1AA', fontWeight: 600 }}>
                        {t('Scheduled')}
                      </span>
                    )
                  } else if (sched.isRest) {
                    titleText = t('Rest Day')
                    statusBadge = (
                      <span style={{ fontSize: 12, color: 'var(--label-2)' }}>
                        {t('Rest Day')}
                      </span>
                    )
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => nav('/planner')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: isDayToday ? 'var(--surface-3)' : 'var(--surface-2)',
                        border: isDayToday ? '1px solid var(--label)' : '1px solid var(--borders)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 64 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isDayToday ? 'var(--label)' : 'var(--label-3)' }}>
                            {dayNameLabel}
                          </span>
                          {isDayToday && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '2px 5px',
                                borderRadius: 9999,
                                background: 'var(--label)',
                                color: 'var(--bg)'
                              }}
                            >
                              {t('Today')}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>
                          {titleText}
                        </span>
                      </div>

                      <div>
                        {statusBadge}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </WidgetBoundary>
      </div>
    </div>
  )
}
