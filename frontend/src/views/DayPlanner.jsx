import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import {
  LIBRARY_CATEGORIES,
  WORKOUT_TYPES,
  getExerciseLibrary,
  isDuplicateExerciseName,
  DEFAULT_WEEKLY_SCHEDULE,
  ensureWeeklyPlannerState
} from '../lib/customPlanner.js'
import { uid } from '../lib/format.js'
import { startFlow } from '../sheets.jsx'

const DAY_NAMES = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  0: 'Sunday'
}

export default function DayPlanner() {
  const { dayId } = useParams()
  const dNum = parseInt(dayId, 10)
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { toast, confirmSheet } = useUI()

  // Ensure weekly planner state is initialized
  ensureWeeklyPlannerState(S)

  const dayName = DAY_NAMES[dNum] || 'Day'
  const scheduleDay = S.weeklyPlanner?.templates?.[0]?.days?.[dNum] || null

  const routineId = S.week?.[dNum]
  const routine = (S.routines || []).find(r => r.id === routineId)

  // Local editable state for this day's routine
  const [dayType, setDayType] = useState(routine?.type || scheduleDay?.type || 'strength')
  const [muscleGroup, setMuscleGroup] = useState(routine?.muscle || scheduleDay?.muscle || 'Chest')
  const [routineName, setRoutineName] = useState(routine?.name || scheduleDay?.routineName || `${dayName} Workout`)
  const [exercises, setExercises] = useState(routine?.ex ? JSON.parse(JSON.stringify(routine.ex)) : [])

  // Library picker state
  const library = useMemo(() => getExerciseLibrary(S), [S.libraryEx])
  const [libCategory, setLibCategory] = useState(muscleGroup !== 'Rest' ? muscleGroup : 'Shoulder')
  const [libSearch, setLibSearch] = useState('')
  const [selectedExIds, setSelectedExIds] = useState(new Set())

  // Add custom exercise modal state
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [customFormData, setCustomFormData] = useState({
    name: '',
    category: muscleGroup !== 'Rest' ? muscleGroup : 'Shoulder',
    type: dayType === 'cardio' ? 'cardio' : 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: ''
  })
  const [customFormError, setCustomFormError] = useState('')

  // Filter library exercises
  const filteredLibrary = useMemo(() => {
    const q = libSearch.trim().toLowerCase()
    return library.filter(e => {
      const matchCat = libCategory === 'All' || e.category === libCategory
      const matchSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        (e.equipment || '').toLowerCase().includes(q)
      return matchCat && matchSearch
    })
  }, [library, libCategory, libSearch])

  // Toggle selection of an exercise in library
  const toggleSelectExercise = (id) => {
    setSelectedExIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Select all or none in current library view
  const toggleSelectAllFiltered = () => {
    if (selectedExIds.size === filteredLibrary.length) {
      setSelectedExIds(new Set())
    } else {
      setSelectedExIds(new Set(filteredLibrary.map(e => e.id)))
    }
  }

  // One-click add selected exercises to day's plan
  const handleAddSelectedToDay = () => {
    if (!selectedExIds.size) return
    const toAdd = library.filter(e => selectedExIds.has(e.id))
    const newItems = toAdd.map(ex => ({
      id: ex.id,
      name: ex.name,
      sets: ex.defaultSets || 3,
      reps: ex.defaultReps || 12,
      weight: 0,
      rest: ex.defaultRestSec || 60,
      notes: ''
    }))

    setExercises(prev => [...prev, ...newItems])
    setSelectedExIds(new Set())
    toast(t('Added {0} exercise(s) to {1}', newItems.length, dayName))
  }

  // One-click add single exercise
  const handleAddSingleToDay = (ex) => {
    const newItem = {
      id: ex.id,
      name: ex.name,
      sets: ex.defaultSets || 3,
      reps: ex.defaultReps || 12,
      weight: 0,
      rest: ex.defaultRestSec || 60,
      notes: ''
    }
    setExercises(prev => [...prev, newItem])
    toast(t('Added "{0}" to plan', ex.name))
  }

  // Reordering exercises
  const moveExercise = (index, direction) => {
    const targetIdx = index + direction
    if (targetIdx < 0 || targetIdx >= exercises.length) return
    setExercises(prev => {
      const copy = [...prev]
      const [moved] = copy.splice(index, 1)
      copy.splice(targetIdx, 0, moved)
      return copy
    })
  }

  // Duplicate an exercise in the list
  const duplicateExercise = (index) => {
    setExercises(prev => {
      const copy = [...prev]
      const item = copy[index]
      copy.splice(index + 1, 0, { ...item })
      return copy
    })
    toast(t('Exercise duplicated'))
  }

  // Remove an exercise from the day's plan
  const removeExercise = (index) => {
    setExercises(prev => prev.filter((_, i) => i !== index))
  }

  // Update a field on an exercise (sets, reps, weight, rest)
  const updateExerciseField = (index, field, value) => {
    setExercises(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  // Save the day plan
  const handleSavePlan = () => {
    update(s => {
      s.week = s.week || {}
      s.routines = s.routines || []
      s.weeklyPlanner = s.weeklyPlanner || {}
      s.weeklyPlanner.templates = s.weeklyPlanner.templates || []

      if (dayType === 'rest') {
        s.week[dNum] = null
        if (s.weeklyPlanner.templates[0]?.days) {
          s.weeklyPlanner.templates[0].days[dNum] = {
            type: 'rest',
            muscle: 'Rest',
            name: `${dayName} — Rest`,
            routineId: null
          }
        }
        toast(t('{0} set as Rest Day', dayName))
        return
      }

      let rId = s.week[dNum]
      let rObj = s.routines.find(r => r.id === rId)

      if (!rObj) {
        rId = 'r_plan_' + dNum + '_' + uid()
        rObj = { id: rId }
        s.routines.push(rObj)
        s.week[dNum] = rId
      }

      rObj.name = routineName.trim() || `${dayName} — ${muscleGroup}`
      rObj.type = dayType
      rObj.muscle = muscleGroup
      rObj.emoji = dayType === 'cardio' ? 'heartPulse' : 'dumbbell'
      rObj.ex = exercises

      if (s.weeklyPlanner.templates[0]?.days) {
        s.weeklyPlanner.templates[0].days[dNum] = {
          type: dayType,
          muscle: muscleGroup,
          name: rObj.name,
          routineId: rId
        }
      }
    })

    toast(t('{0} workout plan saved successfully!', dayName))
    nav('/planner')
  }

  // Save custom exercise from modal directly into library and current plan
  const handleSaveCustomExercise = () => {
    const nameTrimmed = customFormData.name.trim()
    if (!nameTrimmed) {
      setCustomFormError(t('Exercise name is required'))
      return
    }

    if (isDuplicateExerciseName(library, nameTrimmed, customFormData.category)) {
      setCustomFormError(t('An exercise with this name already exists in {0}', customFormData.category))
      return
    }

    const newEx = {
      id: 'cust_ex_' + uid(),
      ...customFormData,
      name: nameTrimmed,
      n: nameTrimmed,
      bp: customFormData.category,
      eq: customFormData.equipment,
      isCustom: true,
      createdAt: new Date().toISOString()
    }

    update(s => {
      s.libraryEx = s.libraryEx || []
      s.libraryEx.push(newEx)
    })

    // Also add to current plan
    setExercises(prev => [
      ...prev,
      {
        id: newEx.id,
        name: newEx.name,
        sets: newEx.defaultSets || 3,
        reps: newEx.defaultReps || 12,
        weight: 0,
        rest: newEx.defaultRestSec || 60,
        notes: ''
      }
    ])

    toast(t('Added "{0}" to library and plan', newEx.name))
    setCustomModalOpen(false)
  }

  return (
    <div className="narrow">
      {/* Header */}
      <div className="hdr" style={{ alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="iconbtn" onClick={() => nav('/planner')} aria-label={t('Back')}>
            <Icon name="chevronLeft" />
          </button>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.025em' }}>
              {dayName} — {t('Day Plan')}
            </h1>
            <div className="sub" style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2 }}>
              {dayType === 'rest' ? t('Rest Day') : `${muscleGroup} · ${exercises.length} exercise(s)`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" icon="check" size="sm" onClick={handleSavePlan}>
            {t('Save Plan')}
          </Button>
        </div>
      </div>

      {/* Routine Configuration Card */}
      <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>
          {t('Day Settings')}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 12 }}>
          {/* Day Type Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
              {t('Workout Type')}
            </label>
            <select
              className="input"
              value={dayType}
              onChange={e => {
                const val = e.target.value
                setDayType(val)
                if (val === 'cardio') setMuscleGroup('Cardio')
                else if (val === 'rest') setMuscleGroup('Rest')
                else if (muscleGroup === 'Cardio' || muscleGroup === 'Rest') setMuscleGroup('Shoulder')
              }}
            >
              <option value="strength">{t('Strength Training')}</option>
              <option value="cardio">{t('Cardio Session')}</option>
              <option value="rest">{t('Rest Day')}</option>
              <option value="custom">{t('Custom Session')}</option>
            </select>
          </div>

          {/* Muscle Group Selector */}
          {dayType !== 'rest' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                {t('Muscle Group / Category')}
              </label>
              <select
                className="input"
                value={muscleGroup}
                onChange={e => {
                  setMuscleGroup(e.target.value)
                  setLibCategory(e.target.value)
                }}
              >
                {LIBRARY_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="Chest + Triceps">Chest + Triceps</option>
                <option value="Back + Biceps">Back + Biceps</option>
                <option value="Legs + Core">Legs + Core</option>
                <option value="Full Body">Full Body</option>
                <option value="Upper Body">Upper Body</option>
                <option value="Lower Body">Lower Body</option>
              </select>
            </div>
          )}
        </div>

        {/* Routine Name Input */}
        {dayType !== 'rest' && (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
              {t('Routine Name')}
            </label>
            <input
              type="text"
              className="input"
              value={routineName}
              onChange={e => setRoutineName(e.target.value)}
              placeholder={`${dayName} — ${muscleGroup}`}
            />
          </div>
        )}
      </div>

      {dayType === 'rest' ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 36, color: 'var(--mint)', marginBottom: 8 }}>
            <Icon name="sun" />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--label)' }}>
            {t('{0} is scheduled as a Rest Day', dayName)}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--label-2)', margin: '0 0 18px' }}>
            {t('Muscles grow and recover during rest periods. To assign exercises, change Workout Type to Strength or Cardio.')}
          </p>
          <Button
            variant="tinted"
            icon="dumbbell"
            onClick={() => {
              setDayType('strength')
              setMuscleGroup('Shoulder')
            }}
          >
            {t('Switch to Strength Training')}
          </Button>
        </div>
      ) : (
        <>
          {/* --- SECTION 1: Currently Assigned Exercises --- */}
          <div style={{ marginBottom: 24 }}>
            <div className="row between" style={{ marginBottom: 10, padding: '0 4px' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>
                {t('Planned Exercises')} ({exercises.length})
              </h3>
              {routineId && exercises.length > 0 && (
                <button
                  className="btn sm"
                  style={{ background: 'var(--mint)', color: '#fff', padding: '6px 12px', borderRadius: 9999, fontWeight: 600 }}
                  onClick={() => startFlow(routineId)}
                >
                  <Icon name="play" style={{ marginRight: 4 }} />
                  {t('Start Today')}
                </button>
              )}
            </div>

            {exercises.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {exercises.map((ex, idx) => (
                  <div
                    key={`${ex.id}_${idx}`}
                    className="card"
                    style={{
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      borderLeft: '4px solid var(--mint)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: 'var(--surface-2)',
                            color: 'var(--label-2)',
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>
                          {ex.name}
                        </span>
                      </div>

                      {/* Reorder and Item Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          className="iconbtn"
                          disabled={idx === 0}
                          style={{ width: 28, height: 28, fontSize: 12, opacity: idx === 0 ? 0.3 : 1 }}
                          onClick={() => moveExercise(idx, -1)}
                          title={t('Move Up')}
                        >
                          <Icon name="chevronUp" />
                        </button>
                        <button
                          className="iconbtn"
                          disabled={idx === exercises.length - 1}
                          style={{ width: 28, height: 28, fontSize: 12, opacity: idx === exercises.length - 1 ? 0.3 : 1 }}
                          onClick={() => moveExercise(idx, 1)}
                          title={t('Move Down')}
                        >
                          <Icon name="chevronDown" />
                        </button>
                        <button
                          className="iconbtn"
                          style={{ width: 28, height: 28, fontSize: 12 }}
                          onClick={() => duplicateExercise(idx)}
                          title={t('Duplicate')}
                        >
                          <Icon name="copy" />
                        </button>
                        <button
                          className="iconbtn"
                          style={{ width: 28, height: 28, fontSize: 12, color: 'var(--red)' }}
                          onClick={() => removeExercise(idx)}
                          title={t('Remove')}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    </div>

                    {/* In-place Set, Rep, Weight, Rest Config */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 8,
                        background: 'var(--surface-2)',
                        padding: '8px 10px',
                        borderRadius: 12
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--label-3)', fontWeight: 600, display: 'block' }}>
                          {t('Sets')}
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          className="input"
                          style={{ padding: '4px 6px', fontSize: 13, fontWeight: 700, textAlign: 'center', height: 32 }}
                          value={ex.sets || 3}
                          onChange={e => updateExerciseField(idx, 'sets', Math.max(1, parseInt(e.target.value, 10) || 1))}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: 11, color: 'var(--label-3)', fontWeight: 600, display: 'block' }}>
                          {t('Reps')}
                        </span>
                        <input
                          type="number"
                          min="1"
                          className="input"
                          style={{ padding: '4px 6px', fontSize: 13, fontWeight: 700, textAlign: 'center', height: 32 }}
                          value={ex.reps || 12}
                          onChange={e => updateExerciseField(idx, 'reps', Math.max(1, parseInt(e.target.value, 10) || 1))}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: 11, color: 'var(--label-3)', fontWeight: 600, display: 'block' }}>
                          {t('Weight (kg)')}
                        </span>
                        <input
                          type="number"
                          step="2.5"
                          min="0"
                          className="input"
                          style={{ padding: '4px 6px', fontSize: 13, fontWeight: 700, textAlign: 'center', height: 32 }}
                          value={ex.weight ?? 0}
                          onChange={e => updateExerciseField(idx, 'weight', Math.max(0, parseFloat(e.target.value) || 0))}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: 11, color: 'var(--label-3)', fontWeight: 600, display: 'block' }}>
                          {t('Rest (s)')}
                        </span>
                        <input
                          type="number"
                          step="15"
                          min="0"
                          className="input"
                          style={{ padding: '4px 6px', fontSize: 13, fontWeight: 700, textAlign: 'center', height: 32 }}
                          value={ex.rest ?? 60}
                          onChange={e => updateExerciseField(idx, 'rest', Math.max(0, parseInt(e.target.value, 10) || 0))}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--label-3)' }}>
                <Icon name="clipboard" style={{ fontSize: 28, marginBottom: 6 }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t('No exercises assigned to {0} yet', dayName)}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{t('Select exercises below from the library to build your workout.')}</div>
              </div>
            )}
          </div>

          {/* --- SECTION 2: Add from Predefined Exercise Library --- */}
          <div className="card" style={{ padding: '16px 18px', marginBottom: 30 }}>
            <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>
                  {t('Add from Exercise Library')}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 2 }}>
                  {t('Select multiple exercises and click "Add Selected"')}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="sm"
                  variant="tinted"
                  icon="plus"
                  onClick={() => {
                    setCustomFormData({
                      name: '',
                      category: muscleGroup !== 'Rest' ? muscleGroup : 'Shoulder',
                      type: dayType === 'cardio' ? 'cardio' : 'strength',
                      equipment: 'Dumbbell',
                      defaultSets: 3,
                      defaultReps: 12,
                      defaultRestSec: 60,
                      description: ''
                    })
                    setCustomFormError('')
                    setCustomModalOpen(true)
                  }}
                >
                  {t('Create Exercise')}
                </Button>
              </div>
            </div>

            {/* Library Search */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--surface-2)',
                padding: '8px 12px',
                borderRadius: 10,
                marginBottom: 10
              }}
            >
              <Icon name="magnifier" style={{ color: 'var(--label-3)', fontSize: 15 }} />
              <input
                type="text"
                placeholder={t('Search {0} exercises...', libCategory)}
                value={libSearch}
                onChange={e => setLibSearch(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'none',
                  color: 'var(--label)',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              {libSearch && (
                <button onClick={() => setLibSearch('')} style={{ color: 'var(--label-3)' }}>
                  <Icon name="xmark" />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="chips" style={{ marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
              <button
                className={`chip ${libCategory === 'All' ? 'on' : ''}`}
                onClick={() => setLibCategory('All')}
              >
                {t('All')}
              </button>
              {LIBRARY_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`chip ${libCategory === cat ? 'on' : ''}`}
                  onClick={() => setLibCategory(cat)}
                >
                  {t(cat)}
                </button>
              ))}
            </div>

            {/* Multi-Select Action Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'var(--surface-2)',
                borderRadius: 10,
                marginBottom: 10,
                fontSize: 13
              }}
            >
              <button
                onClick={toggleSelectAllFiltered}
                style={{ fontWeight: 600, color: 'var(--mint)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
              >
                {selectedExIds.size === filteredLibrary.length ? t('Deselect All') : t('Select All ({0})', filteredLibrary.length)}
              </button>

              <Button
                size="sm"
                variant="primary"
                disabled={selectedExIds.size === 0}
                onClick={handleAddSelectedToDay}
                style={{ padding: '6px 14px' }}
              >
                {t('Add Selected ({0})', selectedExIds.size)}
              </Button>
            </div>

            {/* Predefined Exercises Selectable List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
              {filteredLibrary.map(ex => {
                const isSelected = selectedExIds.has(ex.id)
                const isAlreadyInDay = exercises.some(e => e.id === ex.id)
                return (
                  <div
                    key={ex.id}
                    onClick={() => toggleSelectExercise(ex.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: isSelected ? 'var(--mint-light, rgba(16, 185, 129, 0.12))' : 'var(--surface)',
                      border: isSelected ? '1px solid var(--mint)' : '1px solid var(--card-border-color, rgba(0,0,0,0.06))',
                      cursor: 'pointer',
                      transition: 'all var(--fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by parent div
                        style={{ width: 18, height: 18, accentColor: 'var(--mint)', cursor: 'pointer' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{ex.name}</span>
                          {isAlreadyInDay && (
                            <span style={{ fontSize: 11, color: 'var(--mint)', fontWeight: 700 }}>
                              ✓ {t('In plan')}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--label-2)' }}>
                          {ex.equipment} · {ex.defaultSets} sets × {ex.defaultReps} reps
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn sm"
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        borderRadius: 6,
                        background: 'var(--surface-2)',
                        color: 'var(--label)'
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddSingleToDay(ex)
                      }}
                    >
                      + {t('Add')}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* --- CREATE CUSTOM EXERCISE MODAL --- */}
      {customModalOpen && (
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
          onClick={() => setCustomModalOpen(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 460,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 22,
              borderRadius: 18,
              background: 'var(--surface)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="row between" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--label)' }}>
                {t('Create Custom Exercise')}
              </h2>
              <button className="iconbtn" onClick={() => setCustomModalOpen(false)}>
                <Icon name="xmark" />
              </button>
            </div>

            {customFormError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {customFormError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                  {t('Exercise Name')} *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={t('e.g. Reverse Pec Deck')}
                  value={customFormData.name}
                  onChange={e => {
                    setCustomFormData({ ...customFormData, name: e.target.value })
                    setCustomFormError('')
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                    {t('Muscle Group')}
                  </label>
                  <select
                    className="input"
                    value={customFormData.category}
                    onChange={e => setCustomFormData({ ...customFormData, category: e.target.value, muscleGroup: e.target.value })}
                  >
                    {LIBRARY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                    {t('Equipment')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={customFormData.equipment}
                    onChange={e => setCustomFormData({ ...customFormData, equipment: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                    {t('Default Sets')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={customFormData.defaultSets}
                    onChange={e => setCustomFormData({ ...customFormData, defaultSets: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                    {t('Default Reps')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={customFormData.defaultReps}
                    onChange={e => setCustomFormData({ ...customFormData, defaultReps: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                    {t('Rest (s)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="15"
                    className="input"
                    value={customFormData.defaultRestSec}
                    onChange={e => setCustomFormData({ ...customFormData, defaultRestSec: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <Button variant="ghost" style={{ flex: 1 }} onClick={() => setCustomModalOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button variant="primary" style={{ flex: 1 }} onClick={handleSaveCustomExercise}>
                {t('Add to Plan')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
