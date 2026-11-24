import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import ExercisePreviewCard from '../components/ExercisePreviewCard.jsx'
import { Thumb } from '../components/Media.jsx'
import {
  LIBRARY_CATEGORIES,
  getExerciseLibrary,
  isDuplicateExerciseName,
  getUserTemplates,
  saveUserTemplate,
  deleteUserTemplate
} from '../lib/customPlanner.js'
import { allExercises, BODYPARTS, exOr } from '../lib/exercises.js'
import { uid } from '../lib/format.js'

export default function ExerciseLibrary() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { toast, confirmSheet } = useUI()

  // Top-level View Tab: 'templates' | 'library'
  const [activeTab, setActiveTab] = useState('templates')

  // --- Templates State ---
  const userTemplates = useMemo(() => getUserTemplates(S), [S.workoutTemplates])
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)

  // Keep selectedTemplateId in sync when templates change
  useEffect(() => {
    if (userTemplates.length === 0) {
      setSelectedTemplateId(null)
    } else if (!selectedTemplateId || !userTemplates.some(t => t.id === selectedTemplateId)) {
      setSelectedTemplateId(userTemplates[0].id)
    }
  }, [userTemplates, selectedTemplateId])

  // Active template being viewed/edited
  const activeTemplate = useMemo(() => {
    return userTemplates.find(t => t.id === selectedTemplateId) || null
  }, [userTemplates, selectedTemplateId])

  // Draft exercises for the active template
  const [draftExercises, setDraftExercises] = useState([])
  const [isEditingTemplateName, setIsEditingTemplateName] = useState(false)
  const [draftTemplateName, setDraftTemplateName] = useState('')

  useEffect(() => {
    if (activeTemplate) {
      setDraftExercises(JSON.parse(JSON.stringify(activeTemplate.exercises || [])))
      setDraftTemplateName(activeTemplate.name || '')
      setIsEditingTemplateName(false)
    } else {
      setDraftExercises([])
      setDraftTemplateName('')
    }
  }, [activeTemplate])

  // --- Create New Template Modal State ---
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createStep, setCreateStep] = useState(1) // 1: Name, 2: Select Exercises, 3: Configure
  const [newTemplateName, setNewTemplateName] = useState('')
  const [selectedExIds, setSelectedExIds] = useState(new Set())
  const [configuredNewExercises, setConfiguredNewExercises] = useState([])
  const [datasetSearch, setDatasetSearch] = useState('')
  const [datasetBodyPart, setDatasetBodyPart] = useState('All')

  // --- Add Exercises to Existing Template Modal ---
  const [addExModalOpen, setAddExModalOpen] = useState(false)
  const [addExSearch, setAddExSearch] = useState('')
  const [addExBodyPart, setAddExBodyPart] = useState('All')
  const [addExSelectedIds, setAddExSelectedIds] = useState(new Set())

  // --- Exercise Previews State ---
  const [createExpandedPreviews, setCreateExpandedPreviews] = useState(new Set())
  const [addExExpandedPreviews, setAddExExpandedPreviews] = useState(new Set())
  const [templateExpandedPreviews, setTemplateExpandedPreviews] = useState(new Set())
  const [configureExpandedPreviews, setConfigureExpandedPreviews] = useState(new Set())
  const [libraryExpandedPreviews, setLibraryExpandedPreviews] = useState(new Set())

  const toggleCreatePreview = (id, e) => {
    if (e) e.stopPropagation()
    setCreateExpandedPreviews(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAddExPreview = (id, e) => {
    if (e) e.stopPropagation()
    setAddExExpandedPreviews(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleTemplatePreview = (id, e) => {
    if (e) e.stopPropagation()
    setTemplateExpandedPreviews(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleConfigurePreview = (id, e) => {
    if (e) e.stopPropagation()
    setConfigureExpandedPreviews(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleLibraryPreview = (id, e) => {
    if (e) e.stopPropagation()
    setLibraryExpandedPreviews(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Complete exercise dataset
  const fullDataset = useMemo(() => allExercises(S), [S.customEx])

  // --- Library Tab State ---
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [editingEx, setEditingEx] = useState(null)

  // Custom Exercise Form State
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

  const library = useMemo(() => getExerciseLibrary(S), [S.libraryEx])

  const filteredLibrary = useMemo(() => {
    const q = search.trim().toLowerCase()
    return library.filter(e => {
      if (!e) return false
      const cat = e.category || e.bp || ''
      const matchCat = selectedCategory === 'All' || cat.toLowerCase() === selectedCategory.toLowerCase()
      const name = String(e.name || e.n || '').toLowerCase()
      const eq = String(e.equipment || e.eq || '').toLowerCase()
      const desc = String(e.description || e.desc || '').toLowerCase()
      const matchSearch =
        !q ||
        name.includes(q) ||
        eq.includes(q) ||
        desc.includes(q)
      return matchCat && matchSearch
    })
  }, [library, search, selectedCategory])

  // Filtered dataset for template creation
  const filteredDatasetForCreate = useMemo(() => {
    const q = datasetSearch.trim().toLowerCase()
    return fullDataset.filter(e => {
      if (!e) return false
      const bp = String(e.bp || e.category || '')
      const bpMatch = datasetBodyPart === 'All' || bp.toLowerCase() === datasetBodyPart.toLowerCase()
      const name = String(e.n || e.name || '').toLowerCase()
      const eq = String(e.eq || e.equipment || '').toLowerCase()
      const searchMatch = !q || name.includes(q) || eq.includes(q)
      return bpMatch && searchMatch
    })
  }, [fullDataset, datasetSearch, datasetBodyPart])

  // Filtered dataset for adding to existing template
  const filteredDatasetForAdd = useMemo(() => {
    const q = addExSearch.trim().toLowerCase()
    return fullDataset.filter(e => {
      if (!e) return false
      const bp = String(e.bp || e.category || '')
      const bpMatch = addExBodyPart === 'All' || bp.toLowerCase() === addExBodyPart.toLowerCase()
      const name = String(e.n || e.name || '').toLowerCase()
      const eq = String(e.eq || e.equipment || '').toLowerCase()
      const searchMatch = !q || name.includes(q) || eq.includes(q)
      return bpMatch && searchMatch
    })
  }, [fullDataset, addExSearch, addExBodyPart])

  // Template Editing Handlers
  const handleMoveDraftExercise = (idx, direction) => {
    const targetIdx = idx + direction
    if (targetIdx < 0 || targetIdx >= draftExercises.length) return
    const updated = [...draftExercises]
    const temp = updated[idx]
    updated[idx] = updated[targetIdx]
    updated[targetIdx] = temp
    setDraftExercises(updated)
  }

  const handleUpdateDraftExercise = (idx, field, val) => {
    const updated = [...draftExercises]
    updated[idx] = { ...updated[idx], [field]: val }
    setDraftExercises(updated)
  }

  const handleRemoveDraftExercise = (idx) => {
    const updated = draftExercises.filter((_, i) => i !== idx)
    setDraftExercises(updated)
  }

  const handleSaveActiveTemplate = () => {
    if (!activeTemplate) return
    const nameToSave = draftTemplateName.trim() || activeTemplate.name
    saveUserTemplate(update, {
      ...activeTemplate,
      name: nameToSave,
      exercises: draftExercises
    })
    setIsEditingTemplateName(false)
    toast(t('"{0}" template saved', nameToSave))
  }

  const handleDeleteActiveTemplate = () => {
    if (!activeTemplate) return
    confirmSheet({
      title: t('Delete "{0}" Template?', activeTemplate.name),
      message: t('This will remove the template and reset any weekly plan assignments for this template.'),
      confirmText: t('Delete Template'),
      danger: true,
      onConfirm: () => {
        deleteUserTemplate(update, activeTemplate.id)
        toast(t('Template deleted'))
      }
    })
  }

  // --- Create Template Flow Handlers ---
  const openCreateTemplateModal = () => {
    setNewTemplateName('')
    setSelectedExIds(new Set())
    setConfiguredNewExercises([])
    setDatasetSearch('')
    setDatasetBodyPart('All')
    setCreateExpandedPreviews(new Set())
    setConfigureExpandedPreviews(new Set())
    setCreateStep(1)
    setCreateModalOpen(true)
  }

  const handleToggleSelectExercise = (ex) => {
    setSelectedExIds(prev => {
      const next = new Set(prev)
      if (next.has(ex.id)) next.delete(ex.id)
      else next.add(ex.id)
      return next
    })
  }

  const handleProceedToConfigure = () => {
    if (!newTemplateName.trim()) {
      toast(t('Please enter a template name'))
      return
    }
    if (selectedExIds.size === 0) {
      toast(t('Please select at least one exercise'))
      return
    }
    const chosen = fullDataset.filter(e => selectedExIds.has(e.id)).map(e => {
      const isTimed = (e.tg || '').toLowerCase().includes('core') && (e.n || '').toLowerCase().includes('plank')
      return {
        id: e.id,
        name: e.n || e.name || 'Exercise',
        sets: 3,
        reps: isTimed ? 60 : 10,
        weight: 0,
        rest: 60,
        type: isTimed ? 'timed' : 'strength',
        category: e.bp || 'Strength',
        equipment: e.eq || 'None'
      }
    })
    setConfiguredNewExercises(chosen)
    setCreateStep(3)
  }

  const handleSaveNewTemplate = () => {
    if (!newTemplateName.trim()) return
    const saved = saveUserTemplate(update, {
      name: newTemplateName.trim(),
      exercises: configuredNewExercises
    })
    setCreateModalOpen(false)
    setSelectedTemplateId(saved.id)
    toast(t('Template "{0}" created with {1} exercises', saved.name, saved.exercises.length))
  }

  // --- Add Exercises to Existing Template Handlers ---
  const openAddExercisesModal = () => {
    setAddExSearch('')
    setAddExBodyPart('All')
    setAddExSelectedIds(new Set())
    setAddExExpandedPreviews(new Set())
    setAddExModalOpen(true)
  }

  const handleConfirmAddExercises = () => {
    if (addExSelectedIds.size === 0) {
      setAddExModalOpen(false)
      return
    }
    const newlyAdded = fullDataset.filter(e => addExSelectedIds.has(e.id)).map(e => {
      const isTimed = (e.tg || '').toLowerCase().includes('core') && (e.n || '').toLowerCase().includes('plank')
      return {
        id: e.id,
        name: e.n || e.name || 'Exercise',
        sets: 3,
        reps: isTimed ? 60 : 10,
        weight: 0,
        rest: 60,
        type: isTimed ? 'timed' : 'strength',
        category: e.bp || 'Strength',
        equipment: e.eq || 'None'
      }
    })
    const merged = [...draftExercises, ...newlyAdded]
    setDraftExercises(merged)
    saveUserTemplate(update, {
      ...activeTemplate,
      exercises: merged
    })
    setAddExModalOpen(false)
    toast(t('Added {0} exercises to {1}', newlyAdded.length, activeTemplate?.name))
  }

  // --- Custom Exercise Library Handlers ---
  const openAddCustomExModal = () => {
    setEditingEx(null)
    setFormData({
      name: '',
      category: 'Shoulder',
      type: 'strength',
      equipment: 'Dumbbell',
      defaultSets: 3,
      defaultReps: 12,
      defaultRestSec: 60,
      description: ''
    })
    setFormError('')
    setCustomModalOpen(true)
  }

  const handleSaveCustomExercise = () => {
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
      update(s => {
        s.libraryEx = s.libraryEx || []
        const idx = s.libraryEx.findIndex(x => x.id === editingEx.id)
        const updatedEntry = {
          ...editingEx,
          ...formData,
          name: nameTrimmed,
          updatedAt: new Date().toISOString()
        }
        if (idx >= 0) s.libraryEx[idx] = updatedEntry
        else s.libraryEx.push(updatedEntry)

        s.customEx = s.customEx || []
        const cIdx = s.customEx.findIndex(x => x.id === editingEx.id)
        if (cIdx >= 0) s.customEx[cIdx] = { ...s.customEx[cIdx], n: nameTrimmed, bp: formData.category, eq: formData.equipment }
      })
      toast(t('Exercise updated'))
    } else {
      const newId = 'cust_ex_' + uid()
      const newEx = {
        id: newId,
        ...formData,
        name: nameTrimmed,
        isCustom: true,
        createdAt: new Date().toISOString()
      }
      update(s => {
        s.libraryEx = s.libraryEx || []
        s.libraryEx.push(newEx)
        s.customEx = s.customEx || []
        s.customEx.push({
          id: newId,
          n: nameTrimmed,
          bp: formData.category?.toLowerCase() || 'other',
          tg: formData.category?.toLowerCase() || '',
          eq: formData.equipment?.toLowerCase() || 'none',
          desc: formData.description || '',
          isCustom: true
        })
      })
      toast(t('Custom exercise added to library'))
    }

    setCustomModalOpen(false)
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
              {t('Workout Library & Templates')}
            </h1>
            <div className="sub" style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2 }}>
              {t('Build custom workout templates and browse movement library')}
            </div>
          </div>
        </div>

        {activeTab === 'templates' ? (
          <Button
            variant="primary"
            icon="plus"
            size="sm"
            onClick={openCreateTemplateModal}
          >
            {t('Create New Template')}
          </Button>
        ) : (
          <Button
            variant="primary"
            icon="plus"
            size="sm"
            onClick={openAddCustomExModal}
          >
            {t('Add Custom Exercise')}
          </Button>
        )}
      </div>

      {/* Main Tab Switcher: Templates vs All Exercises */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          background: 'var(--surface-2)',
          padding: 4,
          borderRadius: 14,
          marginBottom: 16
        }}
      >
        <button
          onClick={() => setActiveTab('templates')}
          style={{
            padding: '9px 14px',
            borderRadius: 10,
            border: 'none',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: activeTab === 'templates' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'templates' ? 'var(--label)' : 'var(--label-2)',
            boxShadow: activeTab === 'templates' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
          }}
        >
          <Icon name="calendar" style={{ marginRight: 6 }} />
          {t('Workout Templates')} {userTemplates.length > 0 && `(${userTemplates.length})`}
        </button>

        <button
          onClick={() => setActiveTab('library')}
          style={{
            padding: '9px 14px',
            borderRadius: 10,
            border: 'none',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: activeTab === 'library' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'library' ? 'var(--label)' : 'var(--label-2)',
            boxShadow: activeTab === 'library' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
          }}
        >
          <Icon name="dumbbell" style={{ marginRight: 6 }} />
          {t('All Exercises')} ({library.length})
        </button>
      </div>

      {/* ===================== VIEW 1: CUSTOM WORKOUT TEMPLATES ===================== */}
      {activeTab === 'templates' && (
        <div>
          {userTemplates.length === 0 ? (
            /* Initially Empty State for New Users */
            <div className="card" style={{ textAlign: 'center', padding: '42px 20px', borderRadius: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 44, color: 'var(--mint)', marginBottom: 12 }}>
                <Icon name="dumbbell" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px 0', color: 'var(--label)' }}>
                {t('No workout templates yet')}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--label-2)', maxWidth: 440, margin: '0 auto 20px auto', lineHeight: 1.5 }}>
                {t('Create your own custom workout templates (e.g. Shoulder, Chest + Biceps, Back + Chest, Legs + Core) with any combination of exercises from the complete dataset.')}
              </p>
              <Button
                variant="primary"
                size="lg"
                icon="plus"
                onClick={openCreateTemplateModal}
                style={{ margin: '0 auto' }}
              >
                {t('+ Create New Template')}
              </Button>
            </div>
          ) : (
            /* User Templates Available */
            <div>
              {/* Template Pills & Create Button */}
              <div className="chips" style={{ marginBottom: 16, overflowX: 'auto', paddingBottom: 4, alignItems: 'center' }}>
                {userTemplates.map(tpl => (
                  <button
                    key={tpl.id}
                    className={`chip ${selectedTemplateId === tpl.id ? 'on' : ''}`}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    style={{ fontWeight: selectedTemplateId === tpl.id ? 700 : 500, fontSize: 13 }}
                  >
                    <Icon name="dumbbell" style={{ marginRight: 5 }} />
                    {tpl.name}
                  </button>
                ))}
                <button
                  className="chip"
                  onClick={openCreateTemplateModal}
                  style={{ border: '1px dashed var(--mint)', color: 'var(--mint)', fontWeight: 600, fontSize: 13 }}
                >
                  <Icon name="plus" style={{ marginRight: 4 }} />
                  {t('New Template')}
                </button>
              </div>

              {/* Active Template Editor Card */}
              {activeTemplate && (
                <div className="card" style={{ padding: 18, marginBottom: 20 }}>
                  <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      {isEditingTemplateName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="text"
                            className="input"
                            value={draftTemplateName}
                            onChange={e => setDraftTemplateName(e.target.value)}
                            autoFocus
                            style={{ fontSize: 18, fontWeight: 700 }}
                          />
                          <Button size="sm" variant="primary" onClick={handleSaveActiveTemplate}>
                            {t('Done')}
                          </Button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--label)' }}>
                            {draftTemplateName || activeTemplate.name}
                          </h2>
                          <button
                            className="iconbtn"
                            style={{ width: 28, height: 28 }}
                            onClick={() => setIsEditingTemplateName(true)}
                            title={t('Edit template name')}
                          >
                            <Icon name="pen" style={{ fontSize: 12 }} />
                          </button>
                          <span className="tag acc" style={{ fontSize: 11, fontWeight: 700 }}>
                            {draftExercises.length} {t(draftExercises.length === 1 ? 'exercise' : 'exercises')}
                          </span>
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 4 }}>
                        {t('Configure sets, repetitions, and weights for this template.')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ color: 'var(--red)' }}
                        onClick={handleDeleteActiveTemplate}
                        title={t('Delete template')}
                      >
                        <Icon name="trash" style={{ marginRight: 4 }} />
                        {t('Delete')}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveActiveTemplate}
                      >
                        <Icon name="check" style={{ marginRight: 4 }} />
                        {t('Save Changes')}
                      </Button>
                    </div>
                  </div>

                  {/* Exercises in Template */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                    {draftExercises.length > 0 ? (
                      draftExercises.map((ex, idx) => {
                        const previewKey = ex.id || `draft_${idx}`
                        const isExpanded = templateExpandedPreviews.has(previewKey)
                        return (
                          <div key={previewKey} style={{ display: 'flex', flexDirection: 'column' }}>
                            <div
                              style={{
                                background: 'var(--surface-2)',
                                borderRadius: isExpanded ? '12px 12px 0 0' : 12,
                                border: '1px solid var(--card-border)',
                                borderBottom: isExpanded ? '1px dashed var(--border)' : undefined,
                                padding: '12px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                flexWrap: 'wrap',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {/* Reorder, Thumbnail & Name */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 160 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <button
                                    disabled={idx === 0}
                                    onClick={() => handleMoveDraftExercise(idx, -1)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: idx === 0 ? 'default' : 'pointer',
                                      opacity: idx === 0 ? 0.25 : 0.8,
                                      padding: 2,
                                      color: 'var(--label)'
                                    }}
                                    aria-label="Move up"
                                    title={t('Move up')}
                                  >
                                    <Icon name="chevronUp" style={{ fontSize: 12 }} />
                                  </button>
                                  <button
                                    disabled={idx === draftExercises.length - 1}
                                    onClick={() => handleMoveDraftExercise(idx, 1)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: idx === draftExercises.length - 1 ? 'default' : 'pointer',
                                      opacity: idx === draftExercises.length - 1 ? 0.25 : 0.8,
                                      padding: 2,
                                      color: 'var(--label)'
                                    }}
                                    aria-label="Move down"
                                    title={t('Move down')}
                                  >
                                    <Icon name="chevronDown" style={{ fontSize: 12 }} />
                                  </button>
                                </div>

                                {/* Thumbnail Preview Trigger */}
                                <div
                                  onClick={(e) => toggleTemplatePreview(previewKey, e)}
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                    background: 'var(--surface)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    border: isExpanded ? '1.5px solid var(--mint)' : '1px solid var(--border)'
                                  }}
                                  title={isExpanded ? t('Collapse preview') : t('Tap to preview exercise demonstration')}
                                >
                                  <Thumb ex={exOr(ex.id) || ex} />
                                  <div
                                    style={{
                                      position: 'absolute',
                                      inset: 0,
                                      background: 'rgba(0,0,0,0.3)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    <Icon name={isExpanded ? 'chevronUp' : 'play'} style={{ fontSize: 13, color: '#fff' }} />
                                  </div>
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--label)' }}>
                                    {idx + 1}. {ex.name}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--label-2)', marginTop: 2 }}>
                                    {ex.category ? `${ex.category} · ` : ''}{ex.equipment || 'Exercise'}
                                  </div>
                                </div>
                              </div>

                              {/* Sets, Reps, Weight Inputs & Actions */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 12, color: 'var(--label-2)', fontWeight: 600 }}>{t('Sets')}:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={ex.sets}
                                    onChange={e => handleUpdateDraftExercise(idx, 'sets', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    style={{
                                      width: 46,
                                      padding: '4px 6px',
                                      borderRadius: 6,
                                      border: 'var(--card-border)',
                                      background: 'var(--surface)',
                                      color: 'var(--label)',
                                      fontSize: 13,
                                      fontWeight: 700,
                                      textAlign: 'center'
                                    }}
                                  />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 12, color: 'var(--label-2)', fontWeight: 600 }}>
                                    {ex.type === 'timed' ? t('Sec') : t('Reps')}:
                                  </span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="500"
                                    value={ex.reps}
                                    onChange={e => handleUpdateDraftExercise(idx, 'reps', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    style={{
                                      width: 48,
                                      padding: '4px 6px',
                                      borderRadius: 6,
                                      border: 'var(--card-border)',
                                      background: 'var(--surface)',
                                      color: 'var(--label)',
                                      fontSize: 13,
                                      fontWeight: 700,
                                      textAlign: 'center'
                                    }}
                                  />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 12, color: 'var(--label-2)', fontWeight: 600 }}>{t('Kg')}:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={ex.weight || 0}
                                    onChange={e => handleUpdateDraftExercise(idx, 'weight', Math.max(0, parseFloat(e.target.value) || 0))}
                                    style={{
                                      width: 50,
                                      padding: '4px 6px',
                                      borderRadius: 6,
                                      border: 'var(--card-border)',
                                      background: 'var(--surface)',
                                      color: 'var(--label)',
                                      fontSize: 13,
                                      fontWeight: 700,
                                      textAlign: 'center'
                                    }}
                                  />
                                </div>

                                {/* Preview Toggle Button */}
                                <button
                                  type="button"
                                  className="iconbtn"
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 6,
                                    color: isExpanded ? 'var(--mint)' : 'var(--label-2)',
                                    border: isExpanded ? '1px solid var(--mint)' : '1px solid var(--border)',
                                    background: isExpanded ? 'var(--surface)' : 'transparent'
                                  }}
                                  onClick={(e) => toggleTemplatePreview(previewKey, e)}
                                  title={isExpanded ? t('Collapse preview') : t('Preview exercise demonstration')}
                                  aria-expanded={isExpanded}
                                >
                                  <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} style={{ fontSize: 13 }} />
                                </button>

                                <button
                                  className="iconbtn"
                                  style={{ color: 'var(--red)', width: 30, height: 30 }}
                                  onClick={() => handleRemoveDraftExercise(idx)}
                                  title={t('Remove from template')}
                                >
                                  <Icon name="trash" style={{ fontSize: 13 }} />
                                </button>
                              </div>
                            </div>

                            {/* Expanded Preview inside Saved Template View */}
                            {isExpanded && (
                              <ExercisePreviewCard
                                exercise={exOr(ex.id) || ex}
                                onClose={() => toggleTemplatePreview(previewKey)}
                              />
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--label-2)' }}>
                        {t('No exercises in this template. Click below to add exercises.')}
                      </div>
                    )}
                  </div>

                  {/* Add Exercises Button */}
                  <div style={{ marginTop: 14 }}>
                    <Button
                      variant="ghost"
                      style={{ width: '100%', border: '1px dashed var(--border)', background: 'var(--surface)' }}
                      onClick={openAddExercisesModal}
                    >
                      <Icon name="plus" style={{ marginRight: 6 }} />
                      {t('Add Exercises to "{0}"', activeTemplate.name)}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================== VIEW 2: ALL EXERCISES (LIBRARY) ===================== */}
      {activeTab === 'library' && (
        <div>
          {/* Search Bar */}
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
              placeholder={t('Search complete exercise dataset by name, muscle, equipment...')}
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

          {/* Category Chips */}
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

          {/* Exercise List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
            {filteredLibrary.length > 0 ? (
              filteredLibrary.map(ex => (
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
                        <span><strong>{t('Equipment')}:</strong> {ex.equipment || 'None'}</span>
                        <span>·</span>
                        <span><strong>{t('Target')}:</strong> {ex.defaultSets} sets × {ex.defaultReps} {ex.type === 'timed' ? 'sec' : 'reps'}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Preview Demonstration Button */}
                      <button
                        type="button"
                        className="btn sm"
                        style={{
                          background: libraryExpandedPreviews.has(ex.id) ? 'var(--mint)' : 'var(--surface-2)',
                          color: libraryExpandedPreviews.has(ex.id) ? '#fff' : 'var(--label)',
                          fontWeight: 600,
                          padding: '6px 10px',
                          fontSize: 12,
                          borderRadius: 8,
                          border: '1px solid var(--border)'
                        }}
                        onClick={() => toggleLibraryPreview(ex.id)}
                        title={libraryExpandedPreviews.has(ex.id) ? t('Collapse preview') : t('Preview exercise')}
                      >
                        <Icon name={libraryExpandedPreviews.has(ex.id) ? 'chevronUp' : 'eye'} style={{ marginRight: 4 }} />
                        {libraryExpandedPreviews.has(ex.id) ? t('Close') : t('Preview')}
                      </button>

                      {userTemplates.length > 0 && (
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
                          onClick={() => {
                            // Quick add to active template or prompt choice
                            if (activeTemplate) {
                              const newEntry = {
                                id: ex.id,
                                name: ex.name,
                                sets: ex.defaultSets || 3,
                                reps: ex.defaultReps || 10,
                                weight: 0,
                                rest: ex.defaultRestSec || 60,
                                type: ex.type || 'strength',
                                category: ex.category || 'Strength',
                                equipment: ex.equipment || 'None'
                              }
                              const updated = [...(activeTemplate.exercises || []), newEntry]
                              saveUserTemplate(update, { ...activeTemplate, exercises: updated })
                              toast(t('Added "{0}" to "{1}"', ex.name, activeTemplate.name))
                            }
                          }}
                          title={t('Add to Active Template')}
                        >
                          <Icon name="plus" style={{ marginRight: 4 }} />
                          {t('Add to Template')}
                        </button>
                      )}
                      {ex.isCustom && (
                        <button
                          className="iconbtn"
                          style={{ width: 32, height: 32, fontSize: 13, color: 'var(--red)' }}
                          onClick={() => {
                            confirmSheet({
                              title: t('Delete "{0}"?', ex.name),
                              message: t('This will remove the custom exercise from your library.'),
                              confirmText: t('Delete'),
                              danger: true,
                              onConfirm: () => {
                                update(s => {
                                  s.libraryEx = (s.libraryEx || []).filter(x => x.id !== ex.id)
                                  s.customEx = (s.customEx || []).filter(x => x.id !== ex.id)
                                })
                                toast(t('Custom exercise removed'))
                              }
                            })
                          }}
                          aria-label={t('Delete')}
                        >
                          <Icon name="trash" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Preview inside Library Tab */}
                  {libraryExpandedPreviews.has(ex.id) && (
                    <ExercisePreviewCard
                      exercise={exOr(ex.id) || ex}
                      onClose={() => toggleLibraryPreview(ex.id)}
                    />
                  )}
                </div>
              ))
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
                <div style={{ fontSize: 36, color: 'var(--label-3)', marginBottom: 8 }}>
                  <Icon name="magnifier" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)', marginBottom: 6 }}>
                  {search ? t('No exercises matching "{0}"', search) : t('No exercises in this category')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== CREATE NEW TEMPLATE MODAL ===================== */}
      {createModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 580,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 22,
              borderRadius: 18,
              background: 'var(--surface)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="row between" style={{ marginBottom: 14, alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--label)' }}>
                  {t('Create New Workout Template')}
                </h2>
                <div className="muted small" style={{ fontSize: 12, marginTop: 2 }}>
                  {createStep === 1 && t('Step 1: Choose a name for your workout template')}
                  {createStep === 2 && t('Step 2: Select exercises from the complete dataset')}
                  {createStep === 3 && t('Step 3: Configure sets, reps, and weights')}
                </div>
              </div>
              <button className="iconbtn" onClick={() => setCreateModalOpen(false)}>
                <Icon name="xmark" />
              </button>
            </div>

            {/* STEP 1: Template Name */}
            {createStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: '16px 0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--label-2)', marginBottom: 6 }}>
                    {t('Template Name')} *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder={t('e.g. Chest + Biceps, Shoulder, Back + Chest, Legs + Core...')}
                    value={newTemplateName}
                    onChange={e => setNewTemplateName(e.target.value)}
                    autoFocus
                    style={{ fontSize: 16, padding: '12px 14px' }}
                  />
                  <div style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 6 }}>
                    {t('You can create any combination of exercises regardless of muscle groups.')}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <Button variant="ghost" style={{ flex: 1 }} onClick={() => setCreateModalOpen(false)}>
                    {t('Cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    style={{ flex: 1 }}
                    disabled={!newTemplateName.trim()}
                    onClick={() => setCreateStep(2)}
                  >
                    {t('Next: Select Exercises →')}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Select Exercises from Complete Dataset */}
            {createStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* Search & Category Filter */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'var(--surface-2)',
                      padding: '8px 12px',
                      borderRadius: 10
                    }}
                  >
                    <Icon name="magnifier" style={{ fontSize: 14, color: 'var(--label-3)' }} />
                    <input
                      type="text"
                      placeholder={t('Search exercise dataset...')}
                      value={datasetSearch}
                      onChange={e => setDatasetSearch(e.target.value)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'none',
                        color: 'var(--label)',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div className="chips" style={{ marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
                  <button
                    className={`chip ${datasetBodyPart === 'All' ? 'on' : ''}`}
                    onClick={() => setDatasetBodyPart('All')}
                  >
                    {t('All')}
                  </button>
                  {BODYPARTS.map(bp => (
                    <button
                      key={bp}
                      className={`chip ${datasetBodyPart === bp ? 'on' : ''}`}
                      onClick={() => setDatasetBodyPart(bp)}
                      style={{ textTransform: 'capitalize' }}
                    >
                      {bp}
                    </button>
                  ))}
                </div>

                {/* Exercises Multi-select List with Interactive Previews */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, paddingRight: 4 }}>
                  {filteredDatasetForCreate.slice(0, 100).map(ex => {
                    const isSelected = selectedExIds.has(ex.id)
                    const isExpanded = createExpandedPreviews.has(ex.id)
                    return (
                      <div key={ex.id} style={{ display: 'flex', flexDirection: 'column' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: isExpanded ? '10px 10px 0 0' : 10,
                            background: isSelected ? 'var(--mint-light)' : 'var(--surface-2)',
                            border: isSelected ? '1px solid var(--mint)' : '1px solid transparent',
                            borderBottom: isExpanded ? '1px dashed var(--border)' : undefined,
                            transition: 'all 0.1s ease',
                            gap: 10
                          }}
                        >
                          {/* Left: Thumbnail & Name / Muscle Info */}
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}
                            onClick={() => handleToggleSelectExercise(ex)}
                          >
                            {/* Thumbnail Preview Trigger */}
                            <div
                              onClick={(e) => toggleCreatePreview(ex.id, e)}
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 8,
                                overflow: 'hidden',
                                flexShrink: 0,
                                background: 'var(--surface)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                cursor: 'pointer',
                                border: isExpanded ? '1.5px solid var(--mint)' : '1px solid var(--border)'
                              }}
                              title={isExpanded ? t('Collapse preview') : t('Tap to preview exercise demonstration')}
                            >
                              <Thumb ex={ex} />
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: 'rgba(0,0,0,0.3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Icon name={isExpanded ? 'chevronUp' : 'play'} style={{ fontSize: 13, color: '#fff' }} />
                              </div>
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ex.n || ex.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--label-2)', textTransform: 'capitalize', marginTop: 2 }}>
                                {ex.bp || ex.category} · {ex.eq || ex.equipment || 'No equipment'}
                              </div>
                            </div>
                          </div>

                          {/* Right Actions: Preview Button + Checkbox */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <button
                              type="button"
                              className="iconbtn"
                              onClick={(e) => toggleCreatePreview(ex.id, e)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: isExpanded ? 'var(--surface)' : 'transparent',
                                color: isExpanded ? 'var(--mint)' : 'var(--label-2)',
                                border: isExpanded ? '1px solid var(--mint)' : '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                              title={isExpanded ? t('Collapse preview') : t('Preview exercise')}
                              aria-label={isExpanded ? t('Collapse preview') : t('Preview exercise')}
                              aria-expanded={isExpanded}
                            >
                              <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} style={{ fontSize: 14 }} />
                            </button>

                            <div
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleSelectExercise(ex)
                              }}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                border: isSelected ? 'none' : '2px solid var(--label-3)',
                                background: isSelected ? 'var(--mint)' : 'transparent',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 13,
                                cursor: 'pointer'
                              }}
                              role="checkbox"
                              aria-checked={isSelected}
                              title={isSelected ? t('Selected') : t('Select exercise')}
                            >
                              {isSelected && <Icon name="check" />}
                            </div>
                          </div>
                        </div>

                        {/* Interactive Exercise Preview Section */}
                        {isExpanded && (
                          <ExercisePreviewCard
                            exercise={ex}
                            isSelected={isSelected}
                            onToggleSelect={() => handleToggleSelectExercise(ex)}
                            onClose={() => toggleCreatePreview(ex.id)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Step 2 Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--surface-2)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--mint)' }}>
                    {selectedExIds.size} {t('exercises selected')}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="ghost" size="sm" onClick={() => setCreateStep(1)}>
                      {t('← Back')}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={selectedExIds.size === 0}
                      onClick={handleProceedToConfigure}
                    >
                      {t('Next: Configure →')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Configure Sets, Reps, Weights */}
            {createStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--label-2)', marginBottom: 12 }}>
                  {t('Template: ')}<strong>{newTemplateName}</strong> ({configuredNewExercises.length} {t('exercises')})
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, paddingRight: 4 }}>
                  {configuredNewExercises.map((ex, idx) => {
                    const previewKey = ex.id || `cfg_${idx}`
                    const isExpanded = configureExpandedPreviews.has(previewKey)
                    return (
                      <div key={previewKey} style={{ display: 'flex', flexDirection: 'column' }}>
                        <div
                          style={{
                            background: 'var(--surface-2)',
                            padding: '10px 12px',
                            borderRadius: isExpanded ? '10px 10px 0 0' : 10,
                            border: '1px solid var(--card-border)',
                            borderBottom: isExpanded ? '1px dashed var(--border)' : undefined,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            flexWrap: 'wrap'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 140 }}>
                            <div
                              onClick={(e) => toggleConfigurePreview(previewKey, e)}
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 6,
                                overflow: 'hidden',
                                flexShrink: 0,
                                background: 'var(--surface)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                cursor: 'pointer',
                                border: isExpanded ? '1.5px solid var(--mint)' : '1px solid var(--border)'
                              }}
                              title={isExpanded ? t('Collapse preview') : t('Preview exercise demonstration')}
                            >
                              <Thumb ex={exOr(ex.id) || ex} />
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--label)', flex: 1, minWidth: 100 }}>
                              {idx + 1}. {ex.name}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <span style={{ fontSize: 11, color: 'var(--label-2)', fontWeight: 600 }}>{t('Sets')}:</span>
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={ex.sets}
                                onChange={e => {
                                  const updated = [...configuredNewExercises]
                                  updated[idx].sets = Math.max(1, parseInt(e.target.value, 10) || 1)
                                  setConfiguredNewExercises(updated)
                                }}
                                style={{
                                  width: 44,
                                  padding: '3px 4px',
                                  borderRadius: 6,
                                  border: 'var(--card-border)',
                                  background: 'var(--surface)',
                                  color: 'var(--label)',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textAlign: 'center'
                                }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <span style={{ fontSize: 11, color: 'var(--label-2)', fontWeight: 600 }}>{t('Reps')}:</span>
                              <input
                                type="number"
                                min="1"
                                max="500"
                                value={ex.reps}
                                onChange={e => {
                                  const updated = [...configuredNewExercises]
                                  updated[idx].reps = Math.max(1, parseInt(e.target.value, 10) || 1)
                                  setConfiguredNewExercises(updated)
                                }}
                                style={{
                                  width: 48,
                                  padding: '3px 4px',
                                  borderRadius: 6,
                                  border: 'var(--card-border)',
                                  background: 'var(--surface)',
                                  color: 'var(--label)',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textAlign: 'center'
                                }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <span style={{ fontSize: 11, color: 'var(--label-2)', fontWeight: 600 }}>{t('Kg')}:</span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={ex.weight || 0}
                                onChange={e => {
                                  const updated = [...configuredNewExercises]
                                  updated[idx].weight = Math.max(0, parseFloat(e.target.value) || 0)
                                  setConfiguredNewExercises(updated)
                                }}
                                style={{
                                  width: 50,
                                  padding: '3px 4px',
                                  borderRadius: 6,
                                  border: 'var(--card-border)',
                                  background: 'var(--surface)',
                                  color: 'var(--label)',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textAlign: 'center'
                                }}
                              />
                            </div>

                            <button
                              type="button"
                              className="iconbtn"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                color: isExpanded ? 'var(--mint)' : 'var(--label-2)',
                                border: isExpanded ? '1px solid var(--mint)' : '1px solid var(--border)',
                                background: isExpanded ? 'var(--surface)' : 'transparent'
                              }}
                              onClick={(e) => toggleConfigurePreview(previewKey, e)}
                              title={isExpanded ? t('Collapse preview') : t('Preview exercise demonstration')}
                            >
                              <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} style={{ fontSize: 12 }} />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <ExercisePreviewCard
                            exercise={exOr(ex.id) || ex}
                            onClose={() => toggleConfigurePreview(previewKey)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <Button variant="ghost" style={{ flex: 1 }} onClick={() => setCreateStep(2)}>
                    {t('← Back to Selection')}
                  </Button>
                  <Button variant="primary" style={{ flex: 1 }} onClick={handleSaveNewTemplate}>
                    {t('Save Template')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== ADD EXERCISES TO EXISTING TEMPLATE MODAL ===================== */}
      {addExModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setAddExModalOpen(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 540,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 22,
              borderRadius: 18,
              background: 'var(--surface)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="row between" style={{ marginBottom: 14, alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  {t('Add Exercises to "{0}"', activeTemplate?.name)}
                </h3>
                <div className="muted small" style={{ fontSize: 12, marginTop: 2 }}>
                  {t('Select any exercises from the complete dataset')}
                </div>
              </div>
              <button className="iconbtn" onClick={() => setAddExModalOpen(false)}>
                <Icon name="xmark" />
              </button>
            </div>

            {/* Search & Category Filter */}
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
              <Icon name="magnifier" style={{ fontSize: 14, color: 'var(--label-3)' }} />
              <input
                type="text"
                placeholder={t('Search exercise dataset...')}
                value={addExSearch}
                onChange={e => setAddExSearch(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'none',
                  color: 'var(--label)',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>

            <div className="chips" style={{ marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
              <button
                className={`chip ${addExBodyPart === 'All' ? 'on' : ''}`}
                onClick={() => setAddExBodyPart('All')}
              >
                {t('All')}
              </button>
              {BODYPARTS.map(bp => (
                <button
                  key={bp}
                  className={`chip ${addExBodyPart === bp ? 'on' : ''}`}
                  onClick={() => setAddExBodyPart(bp)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {bp}
                </button>
              ))}
            </div>

            {/* Exercise List with Interactive Previews */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, paddingRight: 4 }}>
              {filteredDatasetForAdd.slice(0, 100).map(ex => {
                const isSelected = addExSelectedIds.has(ex.id)
                const isExpanded = addExExpandedPreviews.has(ex.id)
                return (
                  <div key={ex.id} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: isExpanded ? '10px 10px 0 0' : 10,
                        background: isSelected ? 'var(--mint-light)' : 'var(--surface-2)',
                        border: isSelected ? '1px solid var(--mint)' : '1px solid transparent',
                        borderBottom: isExpanded ? '1px dashed var(--border)' : undefined,
                        transition: 'all 0.1s ease',
                        gap: 10
                      }}
                    >
                      {/* Left: Thumbnail & Name / Muscle Info */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}
                        onClick={() => {
                          setAddExSelectedIds(prev => {
                            const next = new Set(prev)
                            if (next.has(ex.id)) next.delete(ex.id)
                            else next.add(ex.id)
                            return next
                          })
                        }}
                      >
                        {/* Thumbnail Preview Trigger */}
                        <div
                          onClick={(e) => toggleAddExPreview(ex.id, e)}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 8,
                            overflow: 'hidden',
                            flexShrink: 0,
                            background: 'var(--surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            cursor: 'pointer',
                            border: isExpanded ? '1.5px solid var(--mint)' : '1px solid var(--border)'
                          }}
                          title={isExpanded ? t('Collapse preview') : t('Tap to preview exercise demonstration')}
                        >
                          <Thumb ex={ex} />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(0,0,0,0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Icon name={isExpanded ? 'chevronUp' : 'play'} style={{ fontSize: 13, color: '#fff' }} />
                          </div>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ex.n || ex.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--label-2)', textTransform: 'capitalize', marginTop: 2 }}>
                            {ex.bp || ex.category} · {ex.eq || ex.equipment || 'No equipment'}
                          </div>
                        </div>
                      </div>

                      {/* Right Actions: Preview Button + Checkbox */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="iconbtn"
                          onClick={(e) => toggleAddExPreview(ex.id, e)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: isExpanded ? 'var(--surface)' : 'transparent',
                            color: isExpanded ? 'var(--mint)' : 'var(--label-2)',
                            border: isExpanded ? '1px solid var(--mint)' : '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title={isExpanded ? t('Collapse preview') : t('Preview exercise')}
                          aria-label={isExpanded ? t('Collapse preview') : t('Preview exercise')}
                          aria-expanded={isExpanded}
                        >
                          <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} style={{ fontSize: 14 }} />
                        </button>

                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setAddExSelectedIds(prev => {
                              const next = new Set(prev)
                              if (next.has(ex.id)) next.delete(ex.id)
                              else next.add(ex.id)
                              return next
                            })
                          }}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            border: isSelected ? 'none' : '2px solid var(--label-3)',
                            background: isSelected ? 'var(--mint)' : 'transparent',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            cursor: 'pointer'
                          }}
                          role="checkbox"
                          aria-checked={isSelected}
                          title={isSelected ? t('Selected') : t('Select exercise')}
                        >
                          {isSelected && <Icon name="check" />}
                        </div>
                      </div>
                    </div>

                    {/* Interactive Exercise Preview Section */}
                    {isExpanded && (
                      <ExercisePreviewCard
                        exercise={ex}
                        isSelected={isSelected}
                        onToggleSelect={() => {
                          setAddExSelectedIds(prev => {
                            const next = new Set(prev)
                            if (next.has(ex.id)) next.delete(ex.id)
                            else next.add(ex.id)
                            return next
                          })
                        }}
                        onClose={() => toggleAddExPreview(ex.id)}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--surface-2)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--mint)' }}>
                {addExSelectedIds.size} {t('selected')}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="ghost" size="sm" onClick={() => setAddExModalOpen(false)}>
                  {t('Cancel')}
                </Button>
                <Button variant="primary" size="sm" disabled={addExSelectedIds.size === 0} onClick={handleConfirmAddExercises}>
                  {t('Add Selected Exercises')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ADD / EDIT CUSTOM EXERCISE MODAL ===================== */}
      {customModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
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
                {editingEx ? t('Edit Custom Exercise') : t('Add Custom Exercise')}
              </h2>
              <button className="iconbtn" onClick={() => setCustomModalOpen(false)}>
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
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
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
                    {formData.type === 'timed' ? t('Seconds') : t('Default Reps')}
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
                    {t('Rest (Sec)')}
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
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <Button variant="ghost" style={{ flex: 1 }} onClick={() => setCustomModalOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button variant="primary" style={{ flex: 1 }} onClick={handleSaveCustomExercise}>
                {editingEx ? t('Save Changes') : t('Add to Library')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
