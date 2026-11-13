import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import {
  DEFAULT_WEEKLY_SCHEDULE,
  buildDefaultPlannerState,
  ensureWeeklyPlannerState
} from '../lib/customPlanner.js'
import { uid, todayISO } from '../lib/format.js'
import { startFlow } from '../sheets.jsx'

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
  const { toast, confirmSheet } = useUI()

  // Ensure state is ready
  ensureWeeklyPlannerState(S)

  // Current template & split mode
  const planner = S.weeklyPlanner || {}
  const templates = planner.templates || []
  const activeTemplateId = planner.activeTemplateId || templates[0]?.id || 'default_split_4_2_1'
  const activeTemplate = templates.find(t => t.id === activeTemplateId) || templates[0]

  // View / Split Mode: 'fixed' (4 strength + 2 cardio) or 'custom'
  const [splitMode, setSplitMode] = useState(planner.splitMode || '4_strength_2_cardio')

  // Save Template Modal State
  const [saveTemplateModal, setSaveTemplateModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')

  // Template Switcher Dropdown
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)

  // Today's day index
  const todayDayIndex = new Date().getDay()

  // Reset to default schedule (4 Strength + 2 Cardio)
  const handleResetToDefault = () => {
    confirmSheet({
      title: t('Reset to Default Schedule?'),
      message: t('This will reset Monday-Sunday to the default 4-day Strength + 2-day Cardio split (Monday Shoulder, Tuesday Chest+Triceps, Wednesday Back+Biceps, Thursday Legs+Core, Friday/Saturday Cardio, Sunday Rest).'),
      confirmText: t('Reset Schedule'),
      danger: false,
      onConfirm: () => {
        const defaults = buildDefaultPlannerState(S)
        update(s => {
          s.routines = defaults.routines
          s.week = defaults.week
          s.weeklyPlanner = defaults.weeklyPlanner
        })
        toast(t('Reset to default 4 Strength + 2 Cardio schedule'))
      }
    })
  }

  // Quick Toggle Rest Day
  const handleToggleRest = (dayIndex) => {
    update(s => {
      s.week = s.week || {}
      s.weeklyPlanner = s.weeklyPlanner || {}
      s.weeklyPlanner.templates = s.weeklyPlanner.templates || []

      const curRoutineId = s.week[dayIndex]
      const isRest = !curRoutineId

      if (isRest) {
        // Toggle from Rest to Strength/Cardio
        const spec = DEFAULT_WEEKLY_SCHEDULE[dayIndex]
        const newRoutineId = 'r_plan_' + dayIndex + '_' + uid()
        const newRoutine = {
          id: newRoutineId,
          name: spec?.routineName || `${WEEKDAYS.find(w => w.d === dayIndex)?.name} Workout`,
          type: spec?.type === 'cardio' ? 'cardio' : 'strength',
          muscle: spec?.muscle || 'Full Body',
          emoji: spec?.type === 'cardio' ? 'heartPulse' : 'dumbbell',
          ex: []
        }
        s.routines = s.routines || []
        s.routines.push(newRoutine)
        s.week[dayIndex] = newRoutineId

        if (s.weeklyPlanner.templates[0]?.days) {
          s.weeklyPlanner.templates[0].days[dayIndex] = {
            type: newRoutine.type,
            muscle: newRoutine.muscle,
            name: newRoutine.name,
            routineId: newRoutineId
          }
        }
        toast(t('Added workout session to {0}', WEEKDAYS.find(w => w.d === dayIndex)?.name))
      } else {
        // Toggle to Rest
        s.week[dayIndex] = null
        if (s.weeklyPlanner.templates[0]?.days) {
          s.weeklyPlanner.templates[0].days[dayIndex] = {
            type: 'rest',
            muscle: 'Rest',
            name: `${WEEKDAYS.find(w => w.d === dayIndex)?.name} — Rest`,
            routineId: null
          }
        }
        toast(t('{0} set to Rest Day', WEEKDAYS.find(w => w.d === dayIndex)?.name))
      }
    })
  }

  // Quick Toggle Type between Strength and Cardio
  const handleToggleType = (dayIndex) => {
    update(s => {
      s.week = s.week || {}
      const rId = s.week[dayIndex]
      const r = (s.routines || []).find(x => x.id === rId)
      if (!r) return

      const nextType = r.type === 'cardio' ? 'strength' : 'cardio'
      r.type = nextType
      r.emoji = nextType === 'cardio' ? 'heartPulse' : 'dumbbell'
      if (nextType === 'cardio') r.muscle = 'Cardio'

      if (s.weeklyPlanner?.templates?.[0]?.days?.[dayIndex]) {
        s.weeklyPlanner.templates[0].days[dayIndex].type = nextType
        s.weeklyPlanner.templates[0].days[dayIndex].muscle = r.muscle
      }
      toast(t('Changed {0} to {1}', WEEKDAYS.find(w => w.d === dayIndex)?.name, nextType))
    })
  }

  // Save Schedule as New Template
  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) return
    const newTpl = {
      id: 'tpl_' + uid(),
      name: templateName.trim(),
      description: templateDesc.trim() || t('Custom weekly workout schedule'),
      days: JSON.parse(JSON.stringify(activeTemplate?.days || {})),
      weekMapping: JSON.parse(JSON.stringify(S.week || {})),
      createdAt: new Date().toISOString()
    }

    update(s => {
      s.weeklyPlanner = s.weeklyPlanner || {}
      s.weeklyPlanner.templates = s.weeklyPlanner.templates || []
      s.weeklyPlanner.templates.push(newTpl)
      s.weeklyPlanner.activeTemplateId = newTpl.id
    })

    toast(t('Saved template "{0}"', newTpl.name))
    setSaveTemplateModal(false)
    setTemplateName('')
    setTemplateDesc('')
  }

  // Switch Active Template
  const handleSwitchTemplate = (tpl) => {
    update(s => {
      s.weeklyPlanner = s.weeklyPlanner || {}
      s.weeklyPlanner.activeTemplateId = tpl.id
      if (tpl.weekMapping) {
        s.week = JSON.parse(JSON.stringify(tpl.weekMapping))
      }
    })
    toast(t('Switched to "{0}" schedule', tpl.name))
    setShowTemplateMenu(false)
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
            {splitMode === '4_strength_2_cardio'
              ? t('4 Days Strength · 2 Days Cardio · 1 Day Rest')
              : t('Fully Customized Weekly Schedule')}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="iconbtn"
            style={{ background: 'var(--surface-2)' }}
            onClick={() => setSaveTemplateModal(true)}
            title={t('Save as Template')}
          >
            <Icon name="bookmark" />
          </button>
          <button
            className="iconbtn"
            style={{ background: 'var(--surface-2)' }}
            onClick={handleResetToDefault}
            title={t('Reset to Default Split')}
          >
            <Icon name="refresh" />
          </button>
        </div>
      </div>

      {/* Mode Switch & Quick Action Bar */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, background: 'var(--surface-2)', padding: 4, borderRadius: 10 }}>
            <button
              className={`btn sm ${splitMode === '4_strength_2_cardio' ? 'primary' : 'ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8 }}
              onClick={() => {
                setSplitMode('4_strength_2_cardio')
                update(s => {
                  s.weeklyPlanner = s.weeklyPlanner || {}
                  s.weeklyPlanner.splitMode = '4_strength_2_cardio'
                })
              }}
            >
              {t('4 Strength + 2 Cardio')}
            </button>
            <button
              className={`btn sm ${splitMode === 'custom' ? 'primary' : 'ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8 }}
              onClick={() => {
                setSplitMode('custom')
                update(s => {
                  s.weeklyPlanner = s.weeklyPlanner || {}
                  s.weeklyPlanner.splitMode = 'custom'
                })
              }}
            >
              {t('Custom Split')}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="sm"
              variant="tinted"
              icon="list"
              onClick={() => nav('/exercise-library')}
            >
              {t('Exercise Library')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="history"
              onClick={() => nav('/history')}
            >
              {t('History')}
            </Button>
          </div>
        </div>
      </div>

      {/* Weekday Cards (Monday to Sunday) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 30 }}>
        {WEEKDAYS.map(({ d, name }) => {
          const routineId = S.week?.[d]
          const routine = (S.routines || []).find(r => r.id === routineId)
          const isToday = d === todayDayIndex
          const isRest = !routineId || routine?.type === 'rest'
          const isCardio = routine?.type === 'cardio'
          const exerciseCount = routine?.ex?.length || 0

          return (
            <div
              key={d}
              className="card"
              style={{
                padding: '16px 18px',
                borderRadius: 16,
                borderLeft: isRest
                  ? '5px solid var(--label-3)'
                  : isCardio
                  ? '5px solid var(--orange, #f97316)'
                  : '5px solid var(--mint, #10b981)',
                background: isToday ? 'var(--surface)' : 'var(--surface)',
                boxShadow: isToday ? '0 0 0 1.5px var(--mint), var(--card-shadow)' : 'var(--card-shadow)',
                transition: 'transform var(--fast)'
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--label)' }}>
                    {t(name)}
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
                  {/* Badge */}
                  <span
                    className={isRest ? 'tag' : isCardio ? 'tag' : 'tag acc'}
                    style={{
                      fontSize: 12,
                      padding: '3px 10px',
                      borderRadius: 9999,
                      fontWeight: 600,
                      background: isRest ? 'var(--surface-2)' : isCardio ? 'rgba(249, 115, 22, 0.12)' : 'var(--mint-light)',
                      color: isRest ? 'var(--label-2)' : isCardio ? '#ea580c' : 'var(--mint)'
                    }}
                  >
                    {isRest ? t('Rest Day') : isCardio ? t('Cardio') : t(routine?.muscle || 'Strength')}
                  </span>
                </div>
              </div>

              {/* Routine Details */}
              <div style={{ marginBottom: 12 }}>
                {!isRest ? (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--label)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name={isCardio ? 'heartPulse' : 'dumbbell'} style={{ color: isCardio ? '#ea580c' : 'var(--mint)' }} />
                      <span>{routine?.name || `${name} Workout`}</span>
                    </div>

                    {/* Exercise List Chips */}
                    {exerciseCount > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {routine.ex.map((e, idx) => (
                          <span
                            key={`${e.id}_${idx}`}
                            style={{
                              fontSize: 12,
                              background: 'var(--surface-2)',
                              color: 'var(--label-2)',
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontWeight: 500
                            }}
                          >
                            {e.name || e.id} ({e.sets}×{e.reps})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 4 }}>
                        {t('No exercises added yet. Tap "Assign Exercises" to add from library.')}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--label-3)', fontStyle: 'italic' }}>
                    {t('Rest and active recovery day.')}
                  </div>
                )}
              </div>

              {/* Day Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--surface-2)',
                  paddingTop: 10,
                  gap: 8,
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', gap: 6 }}>
                  {/* Edit / Assign Exercises Button */}
                  <Button
                    size="sm"
                    variant={isRest ? 'ghost' : 'tinted'}
                    icon="pen"
                    onClick={() => nav(`/planner/day/${d}`)}
                  >
                    {isRest ? t('Plan Workout') : t('Assign Exercises ({0})', exerciseCount)}
                  </Button>

                  {/* Toggle Rest Day */}
                  <button
                    className="btn sm ghost"
                    style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8 }}
                    onClick={() => handleToggleRest(d)}
                  >
                    {isRest ? t('+ Activate Day') : t('Set as Rest')}
                  </button>

                  {/* Toggle Strength / Cardio */}
                  {!isRest && (
                    <button
                      className="btn sm ghost"
                      style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8 }}
                      onClick={() => handleToggleType(d)}
                    >
                      {isCardio ? t('Switch to Strength') : t('Switch to Cardio')}
                    </button>
                  )}
                </div>

                {/* Start Today's Session */}
                {!isRest && routineId && (
                  <button
                    className="btn sm"
                    style={{
                      background: isToday ? 'var(--mint)' : 'var(--surface-2)',
                      color: isToday ? '#fff' : 'var(--label)',
                      padding: '6px 14px',
                      borderRadius: 9999,
                      fontWeight: 600,
                      fontSize: 12
                    }}
                    onClick={() => startFlow(routineId)}
                  >
                    <Icon name="play" style={{ marginRight: 4 }} />
                    {isToday ? t('Start Today') : t('Start')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* --- SAVE TEMPLATE MODAL --- */}
      {saveTemplateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setSaveTemplateModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 420,
              padding: 22,
              borderRadius: 18,
              background: 'var(--surface)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="row between" style={{ marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--label)' }}>
                {t('Save Schedule Template')}
              </h3>
              <button className="iconbtn" onClick={() => setSaveTemplateModal(false)}>
                <Icon name="xmark" />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--label-2)', marginBottom: 14 }}>
              {t('Save your current 7-day layout as a reusable template to switch whenever you like.')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                  {t('Template Name')} *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={t('e.g. My Heavy 4+2 Split')}
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                  {t('Description (Optional)')}
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={t('e.g. 4 days upper/lower + 2 weekend cardio')}
                  value={templateDesc}
                  onChange={e => setTemplateDesc(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <Button variant="ghost" style={{ flex: 1 }} onClick={() => setSaveTemplateModal(false)}>
                {t('Cancel')}
              </Button>
              <Button variant="primary" style={{ flex: 1 }} onClick={handleSaveAsTemplate} disabled={!templateName.trim()}>
                {t('Save Template')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
