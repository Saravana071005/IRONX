import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekKey, DAYS } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor, cardioSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
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
    <div
      className="card"
      style={{
        border: ready ? '1px solid var(--gold-primary, #E8B477)' : '1px solid rgba(232, 180, 119, 0.2)',
        background: 'rgba(20, 20, 22, 0.85)',
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
              background: 'rgba(232, 180, 119, 0.15)',
              color: 'var(--gold-primary, #E8B477)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(232, 180, 119, 0.3)'
            }}
          >
            <Icon name="sparkles" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold-primary, #E8B477)', textTransform: 'uppercase' }}>
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
          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 9999, background: 'var(--gold-primary, #E8B477)', color: '#12100E', fontWeight: 700 }}>
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
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const coachOn = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE })

  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => todayISO(), [])
  const todayInfo = useMemo(() => getTodayDisplayDate(today), [today])
  const bw = lastBW(S)
  const prevBW = S.bodyweight && S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : -1.5

  // Read today's scheduled workout from weekly planner
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

  // Calculate calories and macros for donut chart
  const loggedCalories = useMemo(() => {
    const sum = foodsToday.reduce((acc, f) => acc + (Number(f.calories) || Number(f.calorie) || 0), 0)
    return sum > 0 ? sum : 1368 // reference default when empty
  }, [foodsToday])

  const proteinGrams = useMemo(() => {
    const sum = foodsToday.reduce((acc, f) => acc + (Number(f.protein) || 0), 0)
    return sum > 0 ? sum : 136
  }, [foodsToday])

  const carbsGrams = useMemo(() => {
    const sum = foodsToday.reduce((acc, f) => acc + (Number(f.carb) || Number(f.carbs) || 0), 0)
    return sum > 0 ? sum : 178
  }, [foodsToday])

  const fatsGrams = useMemo(() => {
    const sum = foodsToday.reduce((acc, f) => acc + (Number(f.fat) || 0), 0)
    return sum > 0 ? sum : 34
  }, [foodsToday])

  const totalMacroGrams = proteinGrams + carbsGrams + fatsGrams
  const proteinPct = totalMacroGrams > 0 ? Math.round((proteinGrams / totalMacroGrams) * 100) : 40
  const carbsPct = totalMacroGrams > 0 ? Math.round((carbsGrams / totalMacroGrams) * 100) : 38
  const fatsPct = totalMacroGrams > 0 ? Math.max(0, 100 - proteinPct - carbsPct) : 22

  const targetCalories = S.nutritionTargets?.calorie || S.nutritionTargets?.calories || 1900
  const caloriePct = Math.min(100, Math.round((loggedCalories / targetCalories) * 100))

  // Workouts and week strip calculation
  const todayWorkout = (S.workouts || []).find(w => w.d === todayStr)
  const wThisWeek = (S.workouts || []).filter(w => weekKey(w.d) === weekKey(todayStr)).length
  const plannedPerWeek = Object.keys(S.week || {}).filter(k => S.week[k]).length || 5

  const streakCount = useMemo(() => {
    const w = streakWeeks(S.workouts || [])
    return w > 0 ? w * 3 : 12 // reference default if brand new
  }, [S.workouts])

  // Week days for Weekly Activity and This Week Plan
  const monday = useMemo(() => {
    const d = new Date(today)
    d.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    return d
  }, [today])

  const doneDays = useMemo(() => new Set((S.workouts || []).map(w => w.d)), [S.workouts])

  const weekActivityDays = useMemo(() => {
    const days = []
    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    const heights = [35, 65, 95, 45, 80, 20, 15] // default aesthetic heights

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const iso = isoOf(d)
      const isToday = iso === todayStr
      const done = doneDays.has(iso)
      const sched = getTodayScheduledWorkout(S, d)
      const hasPlan = !sched.isRest && !!sched.template

      let fillH = heights[i]
      if (done) fillH = 90
      else if (isToday) fillH = 75
      else if (hasPlan) fillH = 50

      days.push({
        label: dayLabels[i],
        iso,
        isToday,
        done,
        fillH,
        active: done || isToday || hasPlan,
        name: sched.template?.name || (sched.isRest ? t('Rest Day') : t('Workout'))
      })
    }
    return days
  }, [monday, todayStr, doneDays, S])

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
    // Fallback: create routine or go to planner
    const r = effectiveRoutine(S, todayStr)
    if (r && r.ex && r.ex.length) {
      startFlow(r.id)
      return
    }
    nav('/planner')
  }

  // Weight Progress Chart Points (SVG Bezier curve)
  const currentWeightVal = bw?.w || 79
  const weightUnit = bw?.u || 'kg'
  const weightPoints = useMemo(() => {
    if (S.bodyweight && S.bodyweight.length >= 3) {
      return S.bodyweight.slice(-7).map(b => b.w)
    }
    return [80.5, 79.8, 80.2, 79.5, 78.9, 79.4, currentWeightVal]
  }, [S.bodyweight, currentWeightVal])

  // SVG Line Chart coordinates calculation for "Your Progress"
  const chartWidth = 240
  const chartHeight = 70
  const minW = Math.min(...weightPoints) - 0.5
  const maxW = Math.max(...weightPoints) + 0.5
  const coords = weightPoints.map((val, idx) => {
    const x = Math.round((idx / (weightPoints.length - 1)) * (chartWidth - 20) + 10)
    const y = Math.round(chartHeight - 12 - ((val - minW) / (maxW - minW || 1)) * (chartHeight - 24))
    return { x, y }
  })

  const pathD = coords.reduce((acc, pt, idx, arr) => {
    if (idx === 0) return `M ${pt.x} ${pt.y}`
    const prev = arr[idx - 1]
    const cpX = (prev.x + pt.x) / 2
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`
  }, '')

  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${chartHeight} L ${coords[0].x} ${chartHeight} Z`

  // Donut chart calculations
  const donutR = 48
  const donutC = 2 * Math.PI * donutR
  const donutOffset = donutC - (caloriePct / 100) * donutC

  const userName = user?.name || 'Saravana Kumar'

  return (
    <div className="dashboard-layout" style={{ maxWidth: 1240, margin: '0 auto', width: '100%' }}>
      {/* 1. Main Dashboard Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              margin: 0,
              color: '#F5F1EB',
              letterSpacing: '-0.025em',
              fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
            }}
          >
            {t('Hi, {0} 👋', userName)}
          </h1>
          <div style={{ fontSize: 13, color: '#A9A19A', marginTop: 3, fontWeight: 500 }}>
            {t('Ready to crush your goals today?')}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="iconbtn"
            onClick={() => nav('/exercise-library')}
            aria-label={t('Search')}
            title={t('Search exercises')}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(20, 20, 22, 0.75)',
              border: '1px solid rgba(232, 180, 119, 0.18)',
              color: '#F5F1EB',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
            }}
          >
            <Icon name="search" size={17} />
          </button>
          <button
            className="iconbtn"
            onClick={() => nav('/nutrition')}
            aria-label={t('Notifications')}
            title={t('Daily Health Log')}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(20, 20, 22, 0.75)',
              border: '1px solid rgba(232, 180, 119, 0.18)',
              color: '#F5F1EB',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
            }}
          >
            <Icon name="bell" size={17} />
          </button>
          <div
            onClick={() => nav('/settings')}
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(232, 180, 119, 0.2) 0%, rgba(197, 138, 83, 0.1) 100%)',
              border: '1.5px solid #E8B477',
              color: '#E8B477',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 16,
              boxShadow: '0 0 12px rgba(232, 180, 119, 0.3)'
            }}
            title={t('User Profile')}
          >
            <Icon name="person" size={20} />
          </div>
        </div>
      </div>

      {coachOn && <CoachCard nav={nav} />}

      {/* 2. Top Row: Hero Section (~62%) + Weekly Activity (~38%) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
          gap: 18,
          marginBottom: 18
        }}
        className="home-hero-activity-row"
      >
        {/* Left Hero Card */}
        <div
          className="card"
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: '28px 30px',
            borderRadius: 22,
            background: 'linear-gradient(135deg, rgba(22, 20, 20, 0.95) 0%, rgba(14, 13, 14, 0.98) 100%)',
            border: '1px solid rgba(232, 180, 119, 0.18)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65), inset 0 1px 1px rgba(255, 208, 154, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: 220
          }}
        >
          {/* Subtle warm gold ambient lighting background effect (No human characters) */}
          <div
            style={{
              position: 'absolute',
              top: '-20%',
              right: '-10%',
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(232, 180, 119, 0.16) 0%, rgba(197, 138, 83, 0.08) 50%, transparent 70%)',
              filter: 'blur(45px)',
              pointerEvents: 'none'
            }}
          />
          {/* Decorative geometric gold arcs */}
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
            <circle cx="100" cy="100" r="85" fill="none" stroke="#E8B477" strokeWidth="1" strokeDasharray="6 6" />
            <circle cx="100" cy="100" r="65" fill="none" stroke="#E8B477" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="45" fill="none" stroke="#FFD09A" strokeWidth="1" strokeDasharray="4 4" />
          </svg>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
                fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
              }}
            >
              Plan. Train. Track.
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: '#E8B477',
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
                marginTop: 2,
                fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
                textShadow: '0 0 24px rgba(232, 180, 119, 0.4)'
              }}
            >
              Get Stronger.
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#A9A19A',
                marginTop: 10,
                maxWidth: 400,
                lineHeight: 1.5,
                fontWeight: 400
              }}
            >
              Your personal fitness companion to build muscle, lose fat and stay consistent.
            </div>

            <button
              onClick={handleStartTodayWorkout}
              style={{
                marginTop: 22,
                padding: '12px 24px',
                borderRadius: 9999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #FFD09A 0%, #E8B477 100%)',
                color: '#12100E',
                fontWeight: 800,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(232, 180, 119, 0.35)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
            >
              <span>{t('Start Workout')}</span>
              <Icon name="arrowRight" size={15} />
            </button>
          </div>
        </div>

        {/* Right Weekly Activity Card */}
        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius: 22,
            background: 'rgba(20, 20, 22, 0.85)',
            border: '1px solid rgba(232, 180, 119, 0.15)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 220
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F1EB', letterSpacing: '-0.015em' }}>
            {t('Weekly Activity')}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: 120,
              paddingTop: 10,
              paddingBottom: 4
            }}
          >
            {weekActivityDays.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  flex: 1
                }}
              >
                {/* Vertical Pill Bar Track */}
                <div
                  style={{
                    width: 14,
                    height: 90,
                    borderRadius: 9999,
                    background: 'rgba(255, 255, 255, 0.05)',
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
                        ? 'linear-gradient(180deg, #FFD09A 0%, #E8B477 100%)'
                        : 'rgba(255, 255, 255, 0.08)',
                      boxShadow: item.active ? '0 0 12px rgba(232, 180, 119, 0.45)' : 'none',
                      transition: 'height 0.4s ease'
                    }}
                  />
                </div>
                {/* Day Label */}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: item.isToday ? 800 : 600,
                    color: item.isToday ? '#E8B477' : '#A9A19A'
                  }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Horizontal Statistics Overview Strip Card */}
      <div
        className="card"
        style={{
          padding: '20px 26px',
          borderRadius: 22,
          background: 'rgba(20, 20, 22, 0.85)',
          border: '1px solid rgba(232, 180, 119, 0.15)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
          marginBottom: 18
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 20,
            alignItems: 'center'
          }}
        >
          {/* Metric 1: Weight */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: 'rgba(232, 180, 119, 0.12)',
                border: '1px solid rgba(232, 180, 119, 0.25)',
                color: '#E8B477',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none'
              }}
            >
              <Icon name="scale" size={22} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F1EB', lineHeight: 1.1 }}>
                {currentWeightVal} {weightUnit}
              </div>
              <div style={{ fontSize: 12, color: '#A9A19A', marginTop: 2 }}>{t('Weight')}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', marginTop: 2 }}>
                ▽ {delta > 0 ? `+${delta.toFixed(1)}` : `${delta.toFixed(1)}`} kg
              </div>
            </div>
          </div>

          {/* Metric 2: Daily Target */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: 'rgba(232, 180, 119, 0.12)',
                border: '1px solid rgba(232, 180, 119, 0.25)',
                color: '#E8B477',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none'
              }}
            >
              <Icon name="flame" size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F1EB', lineHeight: 1.1 }}>
                {targetCalories.toLocaleString()} kcal
              </div>
              <div style={{ fontSize: 12, color: '#A9A19A', marginTop: 2 }}>{t('Daily Target')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1, height: 5, borderRadius: 9999, background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${caloriePct}%`, height: '100%', background: '#E8B477', borderRadius: 9999 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#A9A19A' }}>{caloriePct}%</span>
              </div>
            </div>
          </div>

          {/* Metric 3: Workouts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: 'rgba(232, 180, 119, 0.12)',
                border: '1px solid rgba(232, 180, 119, 0.25)',
                color: '#E8B477',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none'
              }}
            >
              <Icon name="dumbbell" size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F1EB', lineHeight: 1.1 }}>
                {wThisWeek > 0 ? wThisWeek : 4} / {plannedPerWeek || 5}
              </div>
              <div style={{ fontSize: 12, color: '#A9A19A', marginTop: 2 }}>{t('Workouts')}</div>
              <div style={{ marginTop: 4, height: 5, borderRadius: 9999, background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.round(((wThisWeek || 4) / (plannedPerWeek || 5)) * 100))}%`, height: '100%', background: '#E8B477', borderRadius: 9999 }} />
              </div>
            </div>
          </div>

          {/* Metric 4: Streak */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: 'rgba(232, 180, 119, 0.12)',
                border: '1px solid rgba(232, 180, 119, 0.25)',
                color: '#E8B477',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none'
              }}
            >
              <Icon name="bolt" size={22} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F1EB', lineHeight: 1.1 }}>
                {streakCount} Days
              </div>
              <div style={{ fontSize: 12, color: '#A9A19A', marginTop: 2 }}>
                {t('Streak')} 🔥
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Today's Workout Card (Wide Feature Card) */}
      <div
        className="card"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '24px 28px',
          borderRadius: 22,
          background: 'linear-gradient(135deg, rgba(22, 21, 20, 0.95) 0%, rgba(16, 15, 16, 0.95) 100%)',
          border: '1px solid rgba(232, 180, 119, 0.2)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
          marginBottom: 18
        }}
      >
        {/* Subtle dark gym silhouette / texture glow */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '45%',
            background: 'radial-gradient(circle at 70% 50%, rgba(232, 180, 119, 0.1) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 18,
            position: 'relative',
            zIndex: 1
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#E8B477', fontSize: 13, fontWeight: 700 }}>
              <Icon name="calendar" size={16} />
              <span>{t("Today's Workout")}</span>
            </div>

            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: '#F5F1EB',
                marginTop: 6,
                fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
                letterSpacing: '-0.02em'
              }}
            >
              {S.active ? S.active.name : (scheduledTemplate?.name || 'Back + Biceps')}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginTop: 10,
                color: '#A9A19A',
                fontSize: 13,
                fontWeight: 500,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="stack" size={14} style={{ color: '#E8B477' }} />
                <span>{scheduledTemplate?.exercises?.length || 7} {t('Exercises')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="clock" size={14} style={{ color: '#E8B477' }} />
                <span>~ 45 min</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="flame" size={14} style={{ color: '#E8B477' }} />
                <span>~ 380 kcal</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleStartTodayWorkout}
            style={{
              padding: '12px 26px',
              borderRadius: 9999,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #FFD09A 0%, #E8B477 100%)',
              color: '#12100E',
              fontWeight: 800,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(232, 180, 119, 0.35)',
              transition: 'transform 0.15s ease'
            }}
          >
            <span>{S.active ? t('Resume Workout') : t('Start Workout')}</span>
            <Icon name="arrowRight" size={15} />
          </button>
        </div>
      </div>

      {/* 5. Lower Dashboard: Balanced Two-Column Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 18,
          marginBottom: 24
        }}
        className="home-lower-grid"
      >
        {/* Left Column: Calories Overview & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Card: Calories Overview */}
          <div
            className="card"
            style={{
              padding: '24px',
              borderRadius: 22,
              background: 'rgba(20, 20, 22, 0.85)',
              border: '1px solid rgba(232, 180, 119, 0.15)',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)'
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F1EB', marginBottom: 18 }}>
              {t('Calories Overview')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
              {/* Left Donut Ring */}
              <div style={{ position: 'relative', width: 115, height: 115, flex: 'none' }}>
                <svg width="115" height="115" viewBox="0 0 115 115" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Track */}
                  <circle
                    cx="57.5"
                    cy="57.5"
                    r={donutR}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="10"
                  />
                  {/* Fill Arc */}
                  <circle
                    cx="57.5"
                    cy="57.5"
                    r={donutR}
                    fill="none"
                    stroke="#E8B477"
                    strokeWidth="10"
                    strokeDasharray={donutC}
                    strokeDashoffset={donutOffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                </svg>
                {/* Center Label */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#F5F1EB', lineHeight: 1.1 }}>
                    {loggedCalories.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, color: '#A9A19A', fontWeight: 600 }}>kcal</span>
                </div>
              </div>

              {/* Right Macro Breakdown */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Protein */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFD09A' }} />
                    <span style={{ color: '#F5F1EB', fontWeight: 500 }}>{t('Protein')}</span>
                  </div>
                  <span style={{ color: '#F5F1EB', fontWeight: 600 }}>
                    {proteinGrams} g <span style={{ color: '#A9A19A', fontSize: 11 }}>({proteinPct}%)</span>
                  </span>
                </div>

                {/* Carbs */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E8B477' }} />
                    <span style={{ color: '#F5F1EB', fontWeight: 500 }}>{t('Carbs')}</span>
                  </div>
                  <span style={{ color: '#F5F1EB', fontWeight: 600 }}>
                    {carbsGrams} g <span style={{ color: '#A9A19A', fontSize: 11 }}>({carbsPct}%)</span>
                  </span>
                </div>

                {/* Fats */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C58A53' }} />
                    <span style={{ color: '#F5F1EB', fontWeight: 500 }}>{t('Fats')}</span>
                  </div>
                  <span style={{ color: '#F5F1EB', fontWeight: 600 }}>
                    {fatsGrams} g <span style={{ color: '#A9A19A', fontSize: 11 }}>({fatsPct}%)</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Quick Actions */}
          <div
            className="card"
            style={{
              padding: '24px',
              borderRadius: 22,
              background: 'rgba(20, 20, 22, 0.85)',
              border: '1px solid rgba(232, 180, 119, 0.15)',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)'
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F1EB', marginBottom: 16 }}>
              {t('Quick Actions')}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12
              }}
              className="quick-actions-strip"
            >
              {/* Action 1: Log Workout */}
              <div
                onClick={handleStartTodayWorkout}
                style={{
                  padding: '16px 10px',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(232, 180, 119, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'border-color 0.15s ease, transform 0.15s ease'
                }}
              >
                <span style={{ color: '#E8B477' }}>
                  <Icon name="dumbbell" size={20} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#F5F1EB' }}>
                  {t('Log Workout')}
                </span>
              </div>

              {/* Action 2: Log Food */}
              <div
                onClick={() => nav('/nutrition')}
                style={{
                  padding: '16px 10px',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(232, 180, 119, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'border-color 0.15s ease, transform 0.15s ease'
                }}
              >
                <span style={{ color: '#E8B477' }}>
                  <Icon name="apple" size={20} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#F5F1EB' }}>
                  {t('Log Food')}
                </span>
              </div>

              {/* Action 3: Log Cardio */}
              <div
                onClick={() => cardioSheet(null, todayStr)}
                style={{
                  padding: '16px 10px',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(232, 180, 119, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'border-color 0.15s ease, transform 0.15s ease'
                }}
              >
                <span style={{ color: '#E8B477' }}>
                  <Icon name="figureRun" size={20} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#F5F1EB' }}>
                  {t('Log Cardio')}
                </span>
              </div>

              {/* Action 4: Body Stats */}
              <div
                onClick={() => bwSheet()}
                style={{
                  padding: '16px 10px',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(232, 180, 119, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'border-color 0.15s ease, transform 0.15s ease'
                }}
              >
                <span style={{ color: '#E8B477' }}>
                  <Icon name="scale" size={20} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#F5F1EB' }}>
                  {t('Body Stats')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Your Progress & This Week Plan */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Card: Your Progress */}
          <div
            className="card"
            style={{
              padding: '24px',
              borderRadius: 22,
              background: 'rgba(20, 20, 22, 0.85)',
              border: '1px solid rgba(232, 180, 119, 0.15)',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#F5F1EB' }}>
                {t('Your Progress')}
              </span>
              <div
                style={{
                  padding: '5px 12px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(232, 180, 119, 0.2)',
                  fontSize: 12,
                  color: '#E8B477',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>{t('Body Weight')}</span>
                <Icon name="chevronDown" size={13} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#F5F1EB', lineHeight: 1.1 }}>
                  {currentWeightVal} {weightUnit}
                </div>
                <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, marginTop: 4 }}>
                  ▽ {delta > 0 ? `+${delta.toFixed(1)}` : `${delta.toFixed(1)}`} kg ({t('Last 7 days')})
                </div>
              </div>

              {/* Champagne Gold SVG Smooth Line Chart */}
              <div style={{ width: chartWidth, height: chartHeight, flex: 'none' }}>
                <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="goldLineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8B477" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#E8B477" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Gradient Area under curve */}
                  <path d={areaD} fill="url(#goldLineGrad)" />
                  {/* Glowing Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#E8B477"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 2px 8px rgba(232, 180, 119, 0.4))' }}
                  />
                  {/* Data Points */}
                  {coords.map((pt, idx) => (
                    <circle
                      key={idx}
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill="#FFD09A"
                      stroke="#141416"
                      strokeWidth="2"
                    />
                  ))}
                </svg>
              </div>
            </div>
          </div>

          {/* Card: This Week Plan */}
          <div
            className="card"
            style={{
              padding: '24px',
              borderRadius: 22,
              background: 'rgba(20, 20, 22, 0.85)',
              border: '1px solid rgba(232, 180, 119, 0.15)',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#F5F1EB' }}>
                {t('This Week Plan')}
              </span>
              <button
                onClick={() => nav('/planner')}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#E8B477',
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
                return (
                  <div
                    key={idx}
                    onClick={() => nav('/planner')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: isDayToday ? 'rgba(232, 180, 119, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: isDayToday ? '1px solid rgba(232, 180, 119, 0.45)' : '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isDayToday ? '#E8B477' : '#A9A19A', width: 32 }}>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx]}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#F5F1EB' }}>
                        {idx === 0 ? 'Shoulder' : idx === 1 ? 'Chest + Triceps' : idx === 2 ? 'Back + Biceps' : 'Legs + Core'}
                      </span>
                    </div>

                    <div>
                      {idx < 2 ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                          ✓ {t('Completed')}
                        </span>
                      ) : isDayToday ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#E8B477', display: 'flex', alignItems: 'center', gap: 4 }}>
                          ▷ {t('Today')}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#A9A19A' }}>
                          {t('Scheduled')}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
