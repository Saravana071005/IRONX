import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import {
  LIBRARY_CATEGORIES,
  getExerciseLibrary,
  isDuplicateExerciseName
} from '../lib/customPlanner.js'
import { uid } from '../lib/format.js'

export default function ExerciseLibrary() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { toast, confirmSheet } = useUI()

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEx, setEditingEx] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'Shoulder',
    type: 'strength',
    equipment: 'Dumbbell',
    defaultSets: 3,
    defaultReps: 12,
    defaultRestSec: 60,
    description: ''
  })
  const [formError, setFormError] = useState('')

  // Assign to Day Modal
  const [assignModalEx, setAssignModalEx] = useState(null)

  const library = useMemo(() => getExerciseLibrary(S), [S.libraryEx])

  // Filtered Exercises
  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase()
    return library.filter(e => {
      const matchCat = selectedCategory === 'All' || e.category === selectedCategory
      const matchSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        (e.equipment || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q)
      return matchCat && matchSearch
    })
  }, [library, search, selectedCategory])

  const openAddModal = (initialCategory = 'Shoulder') => {
    setEditingEx(null)
    setFormData({
      name: '',
      category: selectedCategory !== 'All' ? selectedCategory : initialCategory,
      type: selectedCategory === 'Cardio' ? 'cardio' : 'strength',
      equipment: selectedCategory === 'Cardio' ? 'None' : 'Dumbbell',
      defaultSets: 3,
      defaultReps: 12,
      defaultRestSec: 60,
      description: ''
    })
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (ex) => {
    setEditingEx(ex)
    setFormData({
      name: ex.name,
      category: ex.category || 'Shoulder',
      type: ex.type || 'strength',
      equipment: ex.equipment || 'Dumbbell',
      defaultSets: ex.defaultSets || 3,
      defaultReps: ex.defaultReps || 12,
      defaultRestSec: ex.defaultRestSec || 60,
      description: ex.description || ''
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleSaveExercise = () => {
    const nameTrimmed = formData.name.trim()
    if (!nameTrimmed) {
      setFormError(t('Exercise name is required'))
      return
    }

    if (isDuplicateExerciseName(library, nameTrimmed, formData.category, editingEx?.id)) {
      setFormError(t('An exercise with this name already exists in {0}', formData.category))
      return
    }

    if (editingEx) {
      // Update existing
      update(s => {
        s.libraryEx = s.libraryEx || []
        const idx = s.libraryEx.findIndex(x => x.id === editingEx.id)
        const updatedEntry = {
          ...editingEx,
          ...formData,
          name: nameTrimmed,
          updatedAt: new Date().toISOString()
        }
        if (idx >= 0) {
          s.libraryEx[idx] = updatedEntry
        } else {
          s.libraryEx.push(updatedEntry)
        }
      })
      toast(t('Exercise updated'))
    } else {
      // Add new custom exercise
      const newEx = {
        id: 'cust_ex_' + uid(),
        ...formData,
        name: nameTrimmed,
        isCustom: true,
        createdAt: new Date().toISOString()
      }
      update(s => {
        s.libraryEx = s.libraryEx || []
        s.libraryEx.push(newEx)
      })
      toast(t('Exercise added to library'))
    }

    setModalOpen(false)
  }

  const handleDeleteExercise = (ex) => {
    confirmSheet({
      title: t('Delete "{0}"?', ex.name),
      message: t('This will remove it from your predefined exercise library. Completed past workouts will keep their records intact.'),
      confirmText: t('Delete'),
      danger: true,
      onConfirm: () => {
        update(s => {
          s.libraryEx = s.libraryEx || []
          const idx = s.libraryEx.findIndex(x => x.id === ex.id)
          if (idx >= 0) {
            s.libraryEx[idx] = { ...s.libraryEx[idx], deleted: true }
          } else {
            s.libraryEx.push({ id: ex.id, deleted: true })
          }
        })
        toast(t('Exercise removed from library'))
      }
    })
  }

  // Quick Assign to a Weekday Routine
  const handleAssignToDay = (dayIndex) => {
    if (!assignModalEx) return
    update(s => {
      s.week = s.week || {}
      let routineId = s.week[dayIndex]
      let routine = (s.routines || []).find(r => r.id === routineId)

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const targetDayName = dayNames[dayIndex]

      if (!routine) {
        routineId = 'r_plan_' + dayIndex + '_' + uid()
        routine = {
          id: routineId,
          name: `${targetDayName} Workout`,
          type: assignModalEx.category === 'Cardio' ? 'cardio' : 'strength',
          muscle: assignModalEx.category,
          emoji: assignModalEx.category === 'Cardio' ? 'heartPulse' : 'dumbbell',
          ex: []
        }
        s.routines = s.routines || []
        s.routines.push(routine)
        s.week[dayIndex] = routineId
      }

      routine.ex = routine.ex || []
      routine.ex.push({
        id: assignModalEx.id,
        name: assignModalEx.name,
        sets: assignModalEx.defaultSets || 3,
        reps: assignModalEx.defaultReps || 12,
        weight: 0,
        rest: assignModalEx.defaultRestSec || 60,
        notes: ''
      })
    })

    toast(t('Added "{0}" to workout plan', assignModalEx.name))
    setAssignModalEx(null)
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
              {t('My Exercise Library')}
            </h1>
            <div className="sub" style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2 }}>
              {t('{0} predefined & custom exercises', library.length)}
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          icon="plus"
          size="sm"
          onClick={() => openAddModal(selectedCategory !== 'All' ? selectedCategory : 'Shoulder')}
        >
          {t('Add Exercise')}
        </Button>
      </div>

      {/* Navigation Quick Links */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          className="btn sm ghost"
          onClick={() => nav('/planner')}
          style={{ flex: 1, padding: '7px 12px', borderRadius: 10, fontSize: 13, background: 'var(--surface-2)' }}
        >
          <Icon name="calendar" style={{ marginRight: 6 }} />
          {t('Weekly Workout Planner')}
        </button>
        <button
          className="btn sm ghost"
          onClick={() => nav('/history')}
          style={{ flex: 1, padding: '7px 12px', borderRadius: 10, fontSize: 13, background: 'var(--surface-2)' }}
        >
          <Icon name="history" style={{ marginRight: 6 }} />
          {t('Workout History')}
        </button>
      </div>

      {/* Search Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--surface)',
          padding: '10px 16px',
          borderRadius: '9999px',
          boxShadow: 'var(--card-shadow)',
          border: 'var(--card-border)',
          marginBottom: 12
        }}
      >
        <span style={{ color: 'var(--label-3)', fontSize: 18, display: 'flex', alignItems: 'center' }}>
          <Icon name="magnifier" />
        </span>
        <input
          type="text"
          placeholder={t('Search exercises by name, equipment, or notes...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            background: 'none',
            color: 'var(--label)',
            fontSize: 15,
            outline: 'none',
            minWidth: 0
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{ color: 'var(--label-3)', padding: 4, display: 'flex', alignItems: 'center' }}
            aria-label="Clear search"
          >
            <Icon name="xmark" />
          </button>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="chips" style={{ marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        <button
          className={`chip ${selectedCategory === 'All' ? 'on' : ''}`}
          onClick={() => setSelectedCategory('All')}
        >
          {t('All')} ({library.length})
        </button>
        {LIBRARY_CATEGORIES.map(cat => {
          const count = library.filter(e => e.category === cat).length
          return (
            <button
              key={cat}
              className={`chip ${selectedCategory === cat ? 'on' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {t(cat)} ({count})
            </button>
          )
        })}
      </div>

      {/* Exercise Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
        {filteredExercises.length > 0 ? (
          filteredExercises.map(ex => (
            <div
              key={ex.id}
              className="card"
              style={{
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'box-shadow var(--fast)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>
                      {ex.name}
                    </h3>
                    <span
                      className="tag acc"
                      style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}
                    >
                      {ex.category}
                    </span>
                    {ex.isCustom && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 9999,
                          background: 'var(--surface-2)',
                          color: 'var(--label-2)',
                          fontWeight: 500
                        }}
                      >
                        {t('Custom')}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginTop: 4,
                      fontSize: 12,
                      color: 'var(--label-2)',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span>
                      <strong>{t('Equipment')}:</strong> {ex.equipment || 'None'}
                    </span>
                    <span>·</span>
                    <span>
                      <strong>{t('Target')}:</strong> {ex.defaultSets} sets × {ex.defaultReps} {ex.type === 'timed' ? 'sec' : ex.type === 'cardio' ? 'min' : 'reps'}
                    </span>
                    {ex.defaultRestSec > 0 && (
                      <>
                        <span>·</span>
                        <span>
                          <strong>{t('Rest')}:</strong> {ex.defaultRestSec}s
                        </span>
                      </>
                    )}
                  </div>

                  {ex.description && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--label-3)',
                        marginTop: 4,
                        lineHeight: 1.4
                      }}
                    >
                      {ex.description}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    className="btn sm"
                    style={{
                      background: 'var(--mint-light)',
                      color: 'var(--mint)',
                      fontWeight: 600,
                      padding: '6px 10px',
                      fontSize: 12,
                      borderRadius: 8
                    }}
                    onClick={() => setAssignModalEx(ex)}
                    title={t('Assign to Day')}
                  >
                    <Icon name="calendar" style={{ marginRight: 4 }} />
                    {t('Assign')}
                  </button>
                  <button
                    className="iconbtn"
                    style={{ width: 32, height: 32, fontSize: 13 }}
                    onClick={() => openEditModal(ex)}
                    aria-label={t('Edit')}
                  >
                    <Icon name="pen" />
                  </button>
                  <button
                    className="iconbtn"
                    style={{ width: 32, height: 32, fontSize: 13, color: 'var(--red)' }}
                    onClick={() => handleDeleteExercise(ex)}
                    aria-label={t('Delete')}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <div style={{ fontSize: 36, color: 'var(--label-3)', marginBottom: 12 }}>
              <Icon name="magnifier" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)', marginBottom: 6 }}>
              {search ? t('No exercises matching "{0}"', search) : t('No exercises in this category')}
            </div>
            <div className="muted small" style={{ marginBottom: 16 }}>
              {t('You can add your own custom exercise with specific sets, reps, and equipment.')}
            </div>
            <Button
              variant="primary"
              icon="plus"
              onClick={() => openAddModal(selectedCategory !== 'All' ? selectedCategory : 'Shoulder')}
            >
              {t('Add Exercise')}
            </Button>
          </div>
        )}
      </div>

      {/* --- ADD / EDIT EXERCISE MODAL --- */}
      {modalOpen && (
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
          onClick={() => setModalOpen(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 22,
              borderRadius: 18,
              background: 'var(--surface)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="row between" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--label)' }}>
                {editingEx ? t('Edit Exercise') : t('Add New Exercise')}
              </h2>
              <button className="iconbtn" onClick={() => setModalOpen(false)}>
                <Icon name="xmark" />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  background: 'var(--red-light, rgba(239, 68, 68, 0.12))',
                  color: 'var(--red, #ef4444)',
                  padding: '8px 12px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 14
                }}
              >
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                  {t('Exercise Name')} *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={t('e.g. Arnold Press')}
                  value={formData.name}
                  onChange={e => {
                    setFormData({ ...formData, name: e.target.value })
                    setFormError('')
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                    {t('Muscle Group / Category')}
                  </label>
                  <select
                    className="input"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value, muscleGroup: e.target.value })}
                  >
                    {LIBRARY_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                    {t('Exercise Type')}
                  </label>
                  <select
                    className="input"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="strength">{t('Strength')}</option>
                    <option value="cardio">{t('Cardio')}</option>
                    <option value="bodyweight">{t('Bodyweight')}</option>
                    <option value="timed">{t('Timed (Seconds)')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                  {t('Equipment')}
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={t('e.g. Dumbbell, Barbell, Cable, Machine, None')}
                  value={formData.equipment}
                  onChange={e => setFormData({ ...formData, equipment: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                    {t('Default Sets')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    className="input"
                    value={formData.defaultSets}
                    onChange={e => setFormData({ ...formData, defaultSets: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                    {formData.type === 'timed' ? t('Seconds') : formData.type === 'cardio' ? t('Minutes') : t('Default Reps')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={formData.defaultReps}
                    onChange={e => setFormData({ ...formData, defaultReps: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                    {t('Rest (Seconds)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="15"
                    className="input"
                    value={formData.defaultRestSec}
                    onChange={e => setFormData({ ...formData, defaultRestSec: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--label-2)', marginBottom: 4 }}>
                  {t('Description & Instructions (Optional)')}
                </label>
                <textarea
                  className="input"
                  rows="3"
                  placeholder={t('Tips on form, grip width, or cues...')}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <Button variant="ghost" style={{ flex: 1 }} onClick={() => setModalOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button variant="primary" style={{ flex: 1 }} onClick={handleSaveExercise}>
                {editingEx ? t('Save Changes') : t('Add to Library')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- QUICK ASSIGN TO DAY MODAL --- */}
      {assignModalEx && (
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
          onClick={() => setAssignModalEx(null)}
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
            <div className="row between" style={{ marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--label)' }}>
                  {t('Assign to Day Plan')}
                </h3>
                <div style={{ fontSize: 13, color: 'var(--mint)', fontWeight: 600, marginTop: 2 }}>
                  {assignModalEx.name} ({assignModalEx.category})
                </div>
              </div>
              <button className="iconbtn" onClick={() => setAssignModalEx(null)}>
                <Icon name="xmark" />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--label-2)', marginBottom: 14 }}>
              {t('Select which weekday to add this exercise to:')}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 16 }}>
              {[
                { d: 1, name: 'Monday — Shoulder / Strength' },
                { d: 2, name: 'Tuesday — Chest + Triceps' },
                { d: 3, name: 'Wednesday — Back + Biceps' },
                { d: 4, name: 'Thursday — Legs + Core' },
                { d: 5, name: 'Friday — Cardio' },
                { d: 6, name: 'Saturday — Cardio' },
                { d: 0, name: 'Sunday — Rest' }
              ].map(item => (
                <button
                  key={item.d}
                  className="btn"
                  style={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'var(--surface-2)',
                    fontSize: 14,
                    fontWeight: 600
                  }}
                  onClick={() => handleAssignToDay(item.d)}
                >
                  <Icon name="calendar" style={{ marginRight: 8, color: 'var(--mint)' }} />
                  {item.name}
                </button>
              ))}
            </div>

            <Button variant="ghost" onClick={() => setAssignModalEx(null)}>
              {t('Cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
