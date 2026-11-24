import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, dateLocale } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import {
  getUserTemplates,
  getWeeklySchedule,
  saveWeeklySchedule,
  createSessionFromTemplate
} from '../lib/customPlanner.js'
import { todayISO, isoOf } from '../lib/format.js'
import { cardioSheet } from '../sheets.jsx'
import { unlockAudio } from '../lib/sound.js'

const WEEKDAYS = [
  { d: 1, name: 'Monday' },
  { d: 2, name: 'Tuesday' },
  { d: 3, name: 'Wednesday' },
  { d: 4, name: 'Thursday' },
  { d: 5, name: 'Friday' },
  { d: 6, name: 'Saturday' },
  { d: 0, name: 'Sunday' }
]

export default function WeeklyPlanner() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { toast } = useUI()

  // User templates (only templates the user has created)
  const userTemplates = useMemo(() => getUserTemplates(S), [S.workoutTemplates])

  // Local schedule state: map of weekday (0..6) -> templateId | 'rest'
  const [schedule, setSchedule] = useState(() => getWeeklySchedule(S))
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setSchedule(getWeeklySchedule(S))
    setIsDirty(false)
  }, [S.weeklySchedule, S.week])

  // Current dates for week
  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => todayISO(), [])
  const monday = useMemo(() => {
    const d = new Date(today)
    d.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    return d
  }, [today])

  // Summary statistics for the weekly planner
  const summary = useMemo(() => {
    let plannedCount = 0
    let restCount = 0
    let completedCount = 0

    WEEKDAYS.forEach(({ d }) => {
      const dayOffset = d === 0 ? 6 : d - 1
      const dayDate = new Date(monday)
      dayDate.setDate(monday.getDate() + dayOffset)
      const dayIso = isoOf(dayDate)

      const templateId = schedule[d] || 'rest'
      if (templateId === 'rest') {
        restCount++
      } else {
        plannedCount++
      }

      const dayWorkout = (S.workouts || []).find(w => w.d === dayIso)
      const dayCardio = (S.cardioLogs || []).find(c => c.d === dayIso)
      if (dayWorkout || dayCardio) {
        completedCount++
      }
    })

    const pct = plannedCount > 0 ? Math.min(100, Math.round((completedCount / plannedCount) * 100)) : (completedCount > 0 ? 100 : 0)

    return { plannedCount, restCount, completedCount, pct }
  }, [schedule, S.workouts, S.cardioLogs, monday])

  const handleDayTemplateChange = (weekdayNum, templateId) => {
    setSchedule(prev => ({
      ...prev,
      [weekdayNum]: templateId
    }))
    setIsDirty(true)
  }

  const handleSaveWeeklyPlan = () => {
    saveWeeklySchedule(update, schedule)
    setIsDirty(false)
    toast(t('Weekly workout plan saved successfully!'))
  }

  const handleStartWorkout = (template, targetIso) => {
    if (!template) return
    unlockAudio()
    const session = createSessionFromTemplate(S, template.id, targetIso)
    if (session) {
      update(s => { s.active = session })
      nav('/workout')
    }
  }

  return (
    <div className="planner-layout">
      {/* Header with Title and Actions */}
      <div className="hdr" style={{ alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--surface-2)',
                color: 'var(--label)',
                border: '1px solid var(--borders)'
              }}
            >
              <Icon name="calendar" size={20} />
            </span>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 800,
                margin: 0,
                letterSpacing: '-0.025em',
                color: 'var(--label)'
              }}
            >
              {t('Weekly Workout Planner')}
            </h1>
          </div>
          <div className="sub" style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 4, marginLeft: 48 }}>
            {t('Organize your 7-day schedule with custom workout templates, active rest, and real-time execution.')}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            size="sm"
            variant="tinted"
            icon="list"
            onClick={() => nav('/exercise-library')}
          >
            {t('Templates & Library')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon="check"
            onClick={handleSaveWeeklyPlan}
          >
            {t('Save Weekly Plan')}
          </Button>
        </div>
      </div>

      {/* Top Weekly Summary Bar */}
      <div
        className="card"
        style={{
          padding: '18px 24px',
          marginBottom: 24,
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
          border: '1px solid var(--border-glass)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          
          
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 18, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('Workouts Planned')}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--label)', marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span>{summary.plannedCount}</span>
              <span style={{ fontSize: 13, color: 'var(--label-2)', fontWeight: 600 }}>/ 7 {t('days')}</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('Rest & Recovery')}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--label)', marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span>{summary.restCount}</span>
              <span style={{ fontSize: 13, color: 'var(--label-2)', fontWeight: 600 }}>{t('days')}</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('Completed This Week')}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--mint)', marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span>{summary.completedCount}</span>
              <span style={{ fontSize: 13, color: 'var(--label-2)', fontWeight: 600 }}>
                / {summary.plannedCount} {t('sessions')}
              </span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('Plan Completion')}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--theme-accent, #F5F5F5)' }}>
                {summary.pct}%
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 9999,
                background: 'var(--surface-3)',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${summary.pct}%`,
                  borderRadius: 9999,
                  background: 'var(--label, #F5F5F5)',
                  boxShadow: 'var(--card-shadow)',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Info / Empty Templates Notice */}
      {userTemplates.length === 0 && (
        <div
          className="card"
          style={{
            padding: '20px 24px',
            marginBottom: 20,
            background: 'var(--surface-2)',
            border: '1px solid var(--borders)',
            borderRadius: 18,
            
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--label)' }}>
                {t('No workout templates created yet')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 4, lineHeight: 1.5, maxWidth: 680 }}>
                {t('Create custom templates (e.g. Chest & Triceps, Back & Biceps, Leg Day, Shoulder Focus) in the Exercise Library to assign them to your weekdays.')}
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon="plus"
              onClick={() => nav('/exercise-library')}
            >
              {t('Create New Template')}
            </Button>
          </div>
        </div>
      )}

      {/* Sticky Save Bar if changes are unsaved */}
      {isDirty && (
        <div
          style={{
            position: 'sticky',
            top: 16,
            zIndex: 100,
            background: 'var(--surface-2)',
            color: 'var(--label)',
            padding: '12px 20px',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--card-shadow)',
            marginBottom: 20,
            border: '1px solid var(--borders)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="checkCircle" size={18} />
            <span style={{ fontSize: 14, fontWeight: 800 }}>
              {t('You have unsaved changes to your weekly schedule')}
            </span>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={handleSaveWeeklyPlan}
          >
            {t('Save Weekly Plan')}
          </Button>
        </div>
      )}

      {/* 7 Days Responsive Grid: Monday through Sunday */}
      <div className="planner-days-grid">
        {WEEKDAYS.map(({ d, name }) => {
          const dayOffset = d === 0 ? 6 : d - 1
          const dayDate = new Date(monday)
          dayDate.setDate(monday.getDate() + dayOffset)
          const dayIso = isoOf(dayDate)
          const dayDateFormatted = `${dayDate.getDate()} ${dayDate.toLocaleDateString(dateLocale(), { month: 'short' })}`
          const isToday = dayIso === todayStr

          const assignedTemplateId = schedule[d] || null
          const isRest = assignedTemplateId === 'rest'
          const isUnscheduled = !assignedTemplateId || assignedTemplateId === 'none'
          const assignedTemplate = (!isRest && !isUnscheduled) ? userTemplates.find(t => t.id === assignedTemplateId) : null

          // Completed workout or cardio on this day
          const dayWorkout = (S.workouts || []).find(w => w.d === dayIso)
          const dayCardio = (S.cardioLogs || []).find(c => c.d === dayIso)
          const isCompleted = !!dayWorkout || !!dayCardio

          return (
            <div
              key={d}
              className={`card planner-day-card ${d === 0 ? 'span-full' : ''}`}
              style={{
                padding: '20px 22px',
                borderRadius: 20,
                background: isToday
                  ? 'var(--surface-2)'
                  : 'var(--surface)',
                border: isToday
                  ? '1px solid var(--borders)'
                  : isRest || isUnscheduled
                    ? '1px solid var(--sep)'
                    : '1px solid var(--borders)',
                borderLeft: isToday ? '4px solid var(--label)' : isRest || isUnscheduled ? '1px solid var(--borders)' : '4px solid var(--label-3)',
                boxShadow: 'var(--card-shadow)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14,
                transition: 'all 0.25s ease'
              }}
            >
              {/* Day Header Row */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--label)', letterSpacing: '-0.015em' }}>
                      {t(name)}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--label-2)', fontWeight: 600 }}>
                      {dayDateFormatted}
                    </span>
                    {isToday && (
                      <span
                        style={{
                          background: 'var(--label)',
                          color: 'var(--bg)',
                          fontSize: 10,
                          fontWeight: 900,
                          padding: '3px 9px',
                          borderRadius: 9999,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          boxShadow: 'var(--card-shadow)',
                        }}
                      >
                        {t('Today')}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isCompleted && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '3px 9px',
                          borderRadius: 9999,
                          fontWeight: 700,
                          background: 'var(--surface-2)',
                          color: 'var(--label)',
                          border: '1px solid var(--borders)'
                        }}
                      >
                        ✓ {t('Completed')}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 9999,
                        fontWeight: 700,
                        background: isRest || isUnscheduled ? 'var(--surface-2)' : 'var(--surface-3)',
                        color: isRest || isUnscheduled ? 'var(--label-2)' : 'var(--label)',
                        border: '1px solid var(--borders)'
                      }}
                    >
                      {isRest ? t('Rest Day') : isUnscheduled ? t('Not Scheduled') : (assignedTemplate?.name || t('Custom Workout'))}
                    </span>
                  </div>
                </div>

                {/* Template Selection Dropdown */}
                <div style={{ marginTop: 6 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--label-2)', marginBottom: 6 }}>
                    {t('Assigned Workout Template')}:
                  </label>
                  <select
                    className="input"
                    value={assignedTemplateId || ''}
                    onChange={e => handleDayTemplateChange(d, e.target.value || null)}
                    style={{
                      width: '100%',
                      fontSize: 14,
                      fontWeight: 600,
                      background: 'var(--surface-2)',
                      borderRadius: 12,
                      padding: '10px 14px',
                      color: 'var(--label)',
                      border: '1px solid var(--borders)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="" style={{ background: 'var(--surface-2)', color: 'var(--label)' }}>{t('Not Scheduled')}</option>
                    <option value="rest" style={{ background: 'var(--surface-2)', color: 'var(--label)' }}>{t('Rest Day')}</option>
                    {userTemplates.map(tpl => (
                      <option key={tpl.id} value={tpl.id} style={{ background: 'var(--surface-2)', color: 'var(--label)' }}>
                        {tpl.name} ({tpl.exercises.length} {t(tpl.exercises.length === 1 ? 'exercise' : 'exercises')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Template Exercises Preview or Rest Day Details */}
              {isUnscheduled && (
                <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--sep)', fontSize: 12, color: 'var(--label-2)' }}>
                  {t('No workout template assigned. Choose a template or mark as Rest Day.')}
                </div>
              )}
              {assignedTemplate ? (
                <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--sep)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="dumbbell" size={13} style={{ color: 'var(--label)' }} />
                    <span>{assignedTemplate.exercises.length} {t('Planned Exercises')}:</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 110, overflowY: 'auto' }}>
                    {assignedTemplate.exercises.map((ex, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--borders)',
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: 12,
                          color: 'var(--label)',
                          fontWeight: 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <span>{ex.name}</span>
                        <span style={{ color: 'var(--label)', fontWeight: 700, fontSize: 11 }}>
                          {ex.sets}×{ex.reps}
                        </span>
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <Button
                      size="sm"
                      variant="primary"
                      icon="play"
                      onClick={() => handleStartWorkout(assignedTemplate, dayIso)}
                      style={{ flex: 1 }}
                    >
                      {t('Start Workout')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="pencil"
                      onClick={() => nav('/exercise-library')}
                    >
                      {t('Edit Template')}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Rest Day View */
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 12,
                    borderTop: '1px solid var(--sep)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--label)' }}>
                      <Icon name="heart" size={15} />
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--label-2)', fontWeight: 500 }}>
                      {t('Active recovery, sleep & nutrition.')}
                    </span>
                  </div>
                  <button
                    className="btn sm ghost"
                    style={{
                      fontSize: 12,
                      padding: '5px 12px',
                      color: 'var(--label)',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--borders)',
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    onClick={() => cardioSheet(null, dayIso)}
                  >
                    <Icon name="figureRun" size={14} />
                    <span>{t('Log Cardio')}</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom Save Action */}
      <div style={{ textAlign: 'center', marginBottom: 40, marginTop: 10 }}>
        <Button
          variant="primary"
          size="lg"
          icon="check"
          onClick={handleSaveWeeklyPlan}
          style={{ minWidth: 240, padding: '14px 28px', fontSize: 16, borderRadius: 16 }}
        >
          {t('Save Weekly Plan')}
        </Button>
      </div>
    </div>
  )
}
