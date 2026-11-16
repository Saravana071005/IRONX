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
  const today = new Date()
  const todayStr = todayISO()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))

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
    const session = createSessionFromTemplate(S, template.id, targetIso)
    if (session) {
      update(s => { s.active = session })
      nav('/workout')
    }
  }

  return (
    <div className="narrow">
      {/* Header */}
      <div className="hdr" style={{ alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.025em' }}>
            {t('Weekly Workout Planner')}
          </h1>
          <div className="sub" style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2 }}>
            {t('Configure your weekly schedule using your custom workout templates')}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

      {/* Info / Empty Templates Notice */}
      {userTemplates.length === 0 && (
        <div
          className="card"
          style={{
            padding: '16px 18px',
            marginBottom: 16,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 14
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>
                {t('No workout templates created yet')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 4, lineHeight: 1.4 }}>
                {t('Create custom templates (e.g. Shoulder, Chest + Biceps, Back + Chest, Legs + Core) in Workout Library to assign them to your weekdays.')}
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon="plus"
              onClick={() => nav('/exercise-library')}
            >
              {t('+ Create New Template')}
            </Button>
          </div>
        </div>
      )}

      {/* Sticky Save Bar if changes are unsaved */}
      {isDirty && (
        <div
          style={{
            position: 'sticky',
            top: 10,
            zIndex: 100,
            background: 'var(--mint)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
            marginBottom: 16
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {t('You have unsaved changes to your weekly schedule')}
          </span>
          <Button
            size="sm"
            style={{ background: '#fff', color: 'var(--mint)', fontWeight: 800 }}
            onClick={handleSaveWeeklyPlan}
          >
            {t('Save Weekly Plan')}
          </Button>
        </div>
      )}

      {/* 7 Days List: Monday through Sunday */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 30 }}>
        {WEEKDAYS.map(({ d, name }) => {
          const dayOffset = d === 0 ? 6 : d - 1
          const dayDate = new Date(monday)
          dayDate.setDate(monday.getDate() + dayOffset)
          const dayIso = isoOf(dayDate)
          const dayDateFormatted = `${dayDate.getDate()} ${dayDate.toLocaleDateString(dateLocale(), { month: 'short' })}`
          const isToday = dayIso === todayStr

          const assignedTemplateId = schedule[d] || 'rest'
          const isRest = assignedTemplateId === 'rest'
          const assignedTemplate = !isRest ? userTemplates.find(t => t.id === assignedTemplateId) : null

          // Completed workout or cardio on this day
          const dayWorkout = (S.workouts || []).find(w => w.d === dayIso)
          const dayCardio = (S.cardioLogs || []).find(c => c.d === dayIso)
          const isCompleted = !!dayWorkout || !!dayCardio

          return (
            <div
              key={d}
              className="card"
              style={{
                padding: '16px 18px',
                borderRadius: 16,
                borderLeft: isRest
                  ? '5px solid var(--label-3)'
                  : '5px solid var(--mint)',
                background: 'var(--surface)',
                boxShadow: isToday ? '0 0 0 2px var(--mint), var(--card-shadow)' : 'var(--card-shadow)'
              }}
            >
              {/* Day Header Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)' }}>
                    {t(name)}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--label-2)', fontWeight: 500 }}>
                    {dayDateFormatted}
                  </span>
                  {isToday && (
                    <span
                      style={{
                        background: 'var(--mint)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 9999,
                        textTransform: 'uppercase'
                      }}
                    >
                      {t('Today')}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isCompleted && (
                    <span
                      className="tag acc"
                      style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 700 }}
                    >
                      ✓ {t('Completed')}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 9999,
                      fontWeight: 700,
                      background: isRest ? 'var(--surface-2)' : 'var(--mint-light)',
                      color: isRest ? 'var(--label-2)' : 'var(--mint)'
                    }}
                  >
                    {isRest ? t('Rest Day') : assignedTemplate?.name || t('Custom Workout')}
                  </span>
                </div>
              </div>

              {/* Template Selection Dropdown */}
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--label-2)', marginBottom: 4 }}>
                  {t('Select Template')}:
                </label>
                <select
                  className="input"
                  value={assignedTemplateId}
                  onChange={e => handleDayTemplateChange(d, e.target.value)}
                  style={{
                    width: '100%',
                    fontSize: 14,
                    fontWeight: 600,
                    background: 'var(--surface-2)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    color: 'var(--label)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <option value="rest">{t('Rest Day')}</option>
                  {userTemplates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.exercises.length} {t(tpl.exercises.length === 1 ? 'exercise' : 'exercises')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Exercises Preview */}
              {assignedTemplate && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--surface-2)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 6 }}>
                    {assignedTemplate.exercises.length} {t('Planned Exercises')}:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {assignedTemplate.exercises.map((ex, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: 'var(--surface-2)',
                          padding: '4px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          color: 'var(--label-2)',
                          fontWeight: 500
                        }}
                      >
                        {ex.name} ({ex.sets}×{ex.reps})
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <Button
                      size="sm"
                      variant="primary"
                      icon="play"
                      onClick={() => handleStartWorkout(assignedTemplate, dayIso)}
                    >
                      {t('Start Workout')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="pen"
                      onClick={() => nav('/exercise-library')}
                    >
                      {t('Edit Template')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Rest Day Quick Option to Log Cardio */}
              {isRest && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--label-3)' }}>
                    {t('Rest and recovery. You can also log cardio if you train:')}
                  </span>
                  <button
                    className="btn sm ghost"
                    style={{ fontSize: 12, padding: '4px 10px', color: 'var(--mint)' }}
                    onClick={() => cardioSheet(null, dayIso)}
                  >
                    <Icon name="figureRun" style={{ marginRight: 4 }} />
                    {t('Log Cardio')}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom Save Action */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Button
          variant="primary"
          size="lg"
          icon="check"
          onClick={handleSaveWeeklyPlan}
          style={{ minWidth: 220 }}
        >
          {t('Save Weekly Plan')}
        </Button>
      </div>
    </div>
  )
}
