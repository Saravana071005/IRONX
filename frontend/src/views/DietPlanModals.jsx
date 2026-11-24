import React, { useState, useEffect, useMemo } from 'react'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { api } from '../lib/api.js'
import { t } from '../lib/i18n.js'

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: 'sun', color: '#F59E0B' },
  { id: 'lunch', label: 'Lunch', icon: 'sun', color: '#EAB308' },
  { id: 'dinner', label: 'Dinner', icon: 'moon', color: '#6366F1' },
  { id: 'snacks', label: 'Snacks', icon: 'apple', color: '#10B981' }
]

/* ==================== MODULE 1: ADD DIET PLAN PDF & REVIEW MODAL ==================== */

export function AddDietPlanPdfModal({ onPlanSaved, close, toast }) {
  const [step, setStep] = useState('upload') // 'upload' | 'review'
  const [loading, setLoading] = useState(false)
  const [planName, setPlanName] = useState('My Diet Plan')
  const [sourceFileName, setSourceFileName] = useState('')
  const [rawText, setRawText] = useState('')
  const [parsedMeals, setParsedMeals] = useState({
    breakfast: [],
    lunch: [],
    snacks: [],
    dinner: []
  })
  const [expandedRecipeIds, setExpandedRecipeIds] = useState({})
  const [makeActive, setMakeActive] = useState(true)

  // File Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSourceFileName(file.name)
    setPlanName(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
    setLoading(true)

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1]
        try {
          const res = await api('/api/nutrition/pdf/parse', {
            method: 'POST',
            body: {
              pdfBase64: base64Data,
              filename: file.name
            }
          })

          if (res?.ok && res?.meals) {
            setParsedMeals(res.meals)
            setRawText(res.rawText || '')
            setStep('review')
            if (toast) toast('Diet plan extracted successfully!', 'success')
          } else {
            throw new Error(res?.error || 'Failed to extract diet plan')
          }
        } catch (err) {
          if (toast) toast(err.message || 'Error parsing PDF', 'error')
        } finally {
          setLoading(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setLoading(false)
      if (toast) toast('File reading error: ' + err.message, 'error')
    }
  }

  // Handle direct text parse
  const handleParseText = async () => {
    if (!rawText.trim()) {
      if (toast) toast('Please paste or enter diet plan text', 'warning')
      return
    }

    setLoading(true)
    try {
      const res = await api('/api/nutrition/pdf/parse', {
        method: 'POST',
        body: { text: rawText }
      })

      if (res?.ok && res?.meals) {
        setParsedMeals(res.meals)
        setStep('review')
        if (toast) toast('Diet plan parsed successfully!', 'success')
      } else {
        throw new Error(res?.error || 'Could not parse text')
      }
    } catch (err) {
      if (toast) toast(err.message || 'Parse error', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Update item in review
  const handleUpdateItem = (mealType, itemId, field, value) => {
    setParsedMeals(prev => {
      const list = [...(prev[mealType] || [])]
      const idx = list.findIndex(i => i.id === itemId)
      if (idx < 0) return prev

      const item = { ...list[idx], [field]: value }

      // Recalculate if quantity changed and reference macros exist
      if (field === 'serving_quantity' && item.serving_grams != null) {
        const prevQty = Number(list[idx].serving_quantity) || 1
        const newQty = Number(value) || 1
        const scale = newQty / prevQty
        item.serving_grams = Math.round(item.serving_grams * scale)
        if (item.energy_kcal != null) item.energy_kcal = Math.round(item.energy_kcal * scale * 10) / 10
        if (item.protein_g != null) item.protein_g = Math.round(item.protein_g * scale * 10) / 10
        if (item.carb_g != null) item.carb_g = Math.round(item.carb_g * scale * 10) / 10
        if (item.fat_g != null) item.fat_g = Math.round(item.fat_g * scale * 10) / 10
        if (item.fibre_g != null) item.fibre_g = Math.round(item.fibre_g * scale * 10) / 10
        item.requires_confirmation = false
      }

      list[idx] = item
      return { ...prev, [mealType]: list }
    })
  }

  // Remove item
  const handleRemoveItem = (mealType, itemId) => {
    setParsedMeals(prev => ({
      ...prev,
      [mealType]: (prev[mealType] || []).filter(i => i.id !== itemId)
    }))
  }

  // Add custom item to a meal
  const handleAddItem = (mealType) => {
    const newItem = {
      id: 'custom_' + Date.now() + Math.random().toString(36).slice(2, 6),
      food_name: 'New Food Item',
      serving_quantity: 1,
      serving_unit: 'serving',
      serving_grams: 100,
      energy_kcal: 100,
      protein_g: 5,
      carb_g: 15,
      fat_g: 2,
      fibre_g: 1,
      matched: true,
      requires_confirmation: false
    }
    setParsedMeals(prev => ({
      ...prev,
      [mealType]: [...(prev[mealType] || []), newItem]
    }))
  }

  // Remove individual recipe ingredient
  const handleRemoveIngredient = (mealType, itemId, ingIdx) => {
    setParsedMeals(prev => {
      const list = [...(prev[mealType] || [])]
      const idx = list.findIndex(i => i.id === itemId)
      if (idx < 0) return prev

      const item = { ...list[idx] }
      const ings = [...(item.ingredients || [])]
      const removed = ings.splice(ingIdx, 1)[0]
      item.ingredients = ings

      // Deduct removed ingredient nutrition
      if (removed) {
        item.energy_kcal = Math.max(0, Math.round(((item.energy_kcal || 0) - (removed.energy_kcal || 0)) * 10) / 10)
        item.protein_g = Math.max(0, Math.round(((item.protein_g || 0) - (removed.protein_g || 0)) * 10) / 10)
        item.carb_g = Math.max(0, Math.round(((item.carb_g || 0) - (removed.carb_g || 0)) * 10) / 10)
        item.fat_g = Math.max(0, Math.round(((item.fat_g || 0) - (removed.fat_g || 0)) * 10) / 10)
        item.fibre_g = Math.max(0, Math.round(((item.fibre_g || 0) - (removed.fibre_g || 0)) * 10) / 10)
      }

      list[idx] = item
      return { ...prev, [mealType]: list }
    })
  }

  // Calculate live review totals
  const reviewTotals = useMemo(() => {
    let cal = 0, p = 0, c = 0, f = 0, fib = 0
    Object.values(parsedMeals).forEach(mList => {
      (mList || []).forEach(item => {
        cal += Number(item.energy_kcal) || 0
        p += Number(item.protein_g) || 0
        c += Number(item.carb_g) || 0
        f += Number(item.fat_g) || 0
        fib += Number(item.fibre_g) || 0
      })
    })
    return {
      calories: Math.round(cal * 10) / 10,
      protein: Math.round(p * 10) / 10,
      carbs: Math.round(c * 10) / 10,
      fat: Math.round(f * 10) / 10,
      fiber: Math.round(fib * 10) / 10
    }
  }, [parsedMeals])

  // Save Diet Plan
  const handleSavePlan = async (applyToToday = false) => {
    if (!planName.trim()) {
      if (toast) toast('Please provide a name for this diet plan', 'warning')
      return
    }

    setLoading(true)
    try {
      const res = await api('/api/nutrition/plans/save', {
        method: 'POST',
        body: {
          name: planName.trim(),
          is_active: makeActive,
          source_pdf_name: sourceFileName,
          meals: parsedMeals
        }
      })

      if (res?.ok && res?.plan) {
        if (applyToToday) {
          const today = new Date().toISOString().slice(0, 10)
          await api('/api/nutrition/daily-plan/apply', {
            method: 'POST',
            body: { date: today, plan_id: res.plan.id }
          })
          if (toast) toast('Diet plan saved and applied to today!', 'success')
        } else {
          if (toast) toast('Diet plan saved successfully!', 'success')
        }

        if (onPlanSaved) onPlanSaved(res.plan)
        if (close) close()
      } else {
        throw new Error(res?.error || 'Failed to save diet plan')
      }
    } catch (err) {
      if (toast) toast(err.message || 'Save error', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxHeight: '85vh', overflowY: 'auto', padding: '4px' }}>
      {step === 'upload' ? (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(0, 229, 255, 0.15)',
              color: '#00E5FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
              border: '1px solid rgba(0, 229, 255, 0.3)'
            }}>
              <Icon name="file" />
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--label)' }}>
              {t('Import Diet Plan PDF')}
            </h3>
            <p style={{ margin: '6px 0 0 0', fontSize: 13, color: 'var(--secondary-label)' }}>
              Upload your diet plan PDF or paste the text. Deterministic OCR and database matching will extract your meals.
            </p>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div style={{
            border: '2px dashed rgba(255, 255, 255, 0.2)',
            borderRadius: 14,
            padding: '30px 20px',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.02)',
            cursor: 'pointer',
            marginBottom: 20,
            transition: 'border-color 0.2s'
          }}
          onClick={() => document.getElementById('pdf-file-input')?.click()}
          >
            <input
              id="pdf-file-input"
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <Icon name="upload" style={{ fontSize: 28, color: '#00E5FF', marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)', marginBottom: 4 }}>
              {loading ? t('Extracting text & OCR matching...') : t('Click to choose PDF or drag and drop')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--secondary-label)' }}>
              {t('Supports digital PDFs and scanned image documents')}
            </div>
          </div>

          {/* Fallback Text Paste */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--secondary-label)' }}>
                {t('Or Paste Diet Plan Text')}
              </label>
              <button
                type="button"
                className="btn small"
                onClick={() => setRawText("Breakfast:\n- 2 Chapathi\n- 3 Eggs\n\nLunch:\n- 150 g Rice\n- 150 g Chicken\n- Vegetables\n\nDinner:\n- 2 Chapathi\n- Egg Curry")}
                style={{ fontSize: 11, padding: '2px 8px' }}
              >
                {t('Load Sample')}
              </button>
            </div>
            <textarea
              className="input"
              rows={6}
              placeholder={"Breakfast:\n- 2 Chapathi\n- 3 Eggs\n\nLunch:\n- 150 g Rice\n- 150 g Chicken\n..."}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={close}>
              {t('Cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={loading || !rawText.trim()}
              onClick={handleParseText}
            >
              {loading ? t('Parsing...') : t('Parse & Review')}
            </Button>
          </div>
        </div>
      ) : (
        /* ==================== REVIEW SCREEN ==================== */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>
                {t('Diet Plan Review')}
              </h3>
              <div style={{ fontSize: 12, color: 'var(--secondary-label)', marginTop: 2 }}>
                {t('Verify extracted items, edit quantities, and confirm before saving.')}
              </div>
            </div>
            <button
              type="button"
              className="btn small"
              onClick={() => setStep('upload')}
              style={{ fontSize: 12 }}
            >
              {t('Re-upload')}
            </button>
          </div>

          {/* Plan Name & Options */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
                {t('Plan Name')}
              </label>
              <input
                type="text"
                className="input"
                value={planName}
                onChange={e => setPlanName(e.target.value)}
                placeholder="e.g. My Regular Diet"
              />
            </div>
            <div style={{ paddingTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--label)' }}>
                <input
                  type="checkbox"
                  checked={makeActive}
                  onChange={e => setMakeActive(e.target.checked)}
                />
                {t('Set as Active Plan')}
              </label>
            </div>
          </div>

          {/* Live Nutrition Summary Bar */}
          <div style={{
            background: 'rgba(0, 229, 255, 0.08)',
            border: '1px solid rgba(0, 229, 255, 0.25)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8
          }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--secondary-label)', textTransform: 'uppercase' }}>{t('Total Planned')}: </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#00E5FF', marginLeft: 4 }}>
                {reviewTotals.calories} kcal
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <span>P: <strong style={{ color: '#F59E0B' }}>{reviewTotals.protein}g</strong></span>
              <span>C: <strong style={{ color: '#EAB308' }}>{reviewTotals.carbs}g</strong></span>
              <span>F: <strong style={{ color: '#6366F1' }}>{reviewTotals.fat}g</strong></span>
              <span>Fib: <strong style={{ color: '#10B981' }}>{reviewTotals.fiber}g</strong></span>
            </div>
          </div>

          {/* Meal Sections */}
          {MEAL_TYPES.map(mType => {
            const items = parsedMeals[mType.id] || []
            return (
              <div key={mType.id} style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: '12px 14px',
                marginBottom: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: mType.color
                    }} />
                    <strong style={{ fontSize: 14, color: 'var(--label)' }}>
                      {t(mType.label)}
                    </strong>
                    <span style={{ fontSize: 12, color: 'var(--secondary-label)' }}>
                      ({items.length} {items.length === 1 ? 'item' : 'items'})
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => handleAddItem(mType.id)}
                    style={{ fontSize: 11, padding: '2px 8px' }}
                  >
                    + {t('Add Food')}
                  </button>
                </div>

                {items.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--secondary-label)', fontStyle: 'italic', padding: '6px 0' }}>
                    {t('No items extracted for this meal')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {items.map((item, idx) => {
                      const isExpanded = !!expandedRecipeIds[item.id]
                      return (
                        <div key={item.id || idx} style={{
                          background: 'rgba(0, 0, 0, 0.25)',
                          borderRadius: 8,
                          padding: '10px 12px',
                          border: item.requires_confirmation
                            ? '1px solid rgba(245, 158, 11, 0.4)'
                            : '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                            {/* Food Name & Status */}
                            <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                              <input
                                type="text"
                                className="input"
                                style={{ fontSize: 13, fontWeight: 600, padding: '4px 8px' }}
                                value={item.food_name || ''}
                                onChange={e => handleUpdateItem(mType.id, item.id, 'food_name', e.target.value)}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                {item.matched ? (
                                  <span style={{ fontSize: 10, color: '#10B981', display: 'flex', alignItems: 'center', gap: 3 }}>
                                    ✓ {t('Verified Dataset')}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 10, color: '#F59E0B' }}>
                                    ⚠ {t('Food not found in nutrition database')}
                                  </span>
                                )}
                                {item.is_recipe && (
                                  <span style={{ fontSize: 10, background: 'rgba(99, 102, 241, 0.2)', color: '#A5B4FC', padding: '1px 6px', borderRadius: 4 }}>
                                    {t('Recipe')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Quantity & Unit */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="number"
                                className="input"
                                style={{ width: 65, textAlign: 'center', padding: '4px 6px', fontSize: 13 }}
                                min={0.25}
                                step={0.25}
                                value={item.serving_quantity || 1}
                                onChange={e => handleUpdateItem(mType.id, item.id, 'serving_quantity', e.target.value)}
                              />
                              <span style={{ fontSize: 12, color: 'var(--secondary-label)', minWidth: 40 }}>
                                {item.serving_unit || 'g'}
                              </span>
                            </div>

                            {/* Nutrition Numbers */}
                            <div style={{ textAlign: 'right', minWidth: 80 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#00E5FF' }}>
                                {item.energy_kcal != null ? `${item.energy_kcal} kcal` : '—'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--secondary-label)' }}>
                                {item.protein_g != null ? `${item.protein_g}g P` : ''}
                              </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {item.ingredients && item.ingredients.length > 0 && (
                                <button
                                  type="button"
                                  className="iconbtn"
                                  onClick={() => setExpandedRecipeIds(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                  title="Expand recipe ingredients"
                                  style={{ width: 28, height: 28 }}
                                >
                                  <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="iconbtn"
                                onClick={() => handleRemoveItem(mType.id, item.id)}
                                title="Remove item"
                                style={{ width: 28, height: 28, color: '#EF4444' }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Recipe Ingredients Sub-List */}
                          {item.ingredients && item.ingredients.length > 0 && isExpanded && (
                            <div style={{
                              marginTop: 10,
                              padding: '8px 10px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: 6
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', marginBottom: 6 }}>
                                {t('Recipe Ingredients')}:
                              </div>
                              {item.ingredients.map((ing, ingIdx) => (
                                <div key={ingIdx} style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: 11,
                                  padding: '3px 0',
                                  borderBottom: '1px dashed rgba(255, 255, 255, 0.05)'
                                }}>
                                  <span>{ing.food_name || ing.name} ({ing.quantity} {ing.unit})</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: 'var(--secondary-label)' }}>{ing.energy_kcal || 0} kcal</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveIngredient(mType.id, item.id, ingIdx)}
                                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 12 }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <Button variant="ghost" onClick={close}>
              {t('Cancel')}
            </Button>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => handleSavePlan(false)}
            >
              {loading ? t('Saving...') : t('Save as Diet Plan')}
            </Button>
            <Button
              variant="primary"
              disabled={loading}
              onClick={() => handleSavePlan(true)}
            >
              {loading ? t('Saving...') : t('Save & Use Today')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ==================== MODULE 2: MY DIET PLANS VIEW ==================== */

export function MyDietPlansView({ onOpenAddPdf, onApplyPlanToToday, toast }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)

  const loadPlans = async () => {
    setLoading(true)
    try {
      const res = await api('/api/nutrition/plans')
      if (res?.ok && Array.isArray(res.plans)) {
        setPlans(res.plans)
      }
    } catch (err) {
      if (toast) toast('Error loading diet plans: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlans()
  }, [])

  const handleSetActive = async (id) => {
    try {
      const res = await api('/api/nutrition/plans/active', {
        method: 'POST',
        body: { id }
      })
      if (res?.ok) {
        if (toast) toast('Set as active diet plan', 'success')
        loadPlans()
      }
    } catch (err) {
      if (toast) toast(err.message, 'error')
    }
  }

  const handleDuplicate = async (id) => {
    try {
      const res = await api('/api/nutrition/plans/duplicate', {
        method: 'POST',
        body: { id }
      })
      if (res?.ok) {
        if (toast) toast('Plan duplicated', 'success')
        loadPlans()
      }
    } catch (err) {
      if (toast) toast(err.message, 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('Are you sure you want to delete this diet plan? Past meal history will remain intact.'))) {
      return
    }
    try {
      const res = await api('/api/nutrition/plans/delete', {
        method: 'POST',
        body: { id }
      })
      if (res?.ok) {
        if (toast) toast('Plan deleted', 'success')
        loadPlans()
      }
    } catch (err) {
      if (toast) toast(err.message, 'error')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--label)' }}>
            {t('My Diet Plans')}
          </h3>
          <div style={{ fontSize: 12, color: 'var(--secondary-label)' }}>
            {t('Manage your reusable diet templates and active meal routines')}
          </div>
        </div>
        <Button variant="primary" onClick={onOpenAddPdf} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="plus" />
          {t('+ Add Diet Plan PDF')}
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--secondary-label)' }}>
          {t('Loading diet plans...')}
        </div>
      ) : plans.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: 14,
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <Icon name="file" style={{ fontSize: 36, color: '#00E5FF', marginBottom: 10 }} />
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--label)' }}>
            {t('No Diet Plans Saved Yet')}
          </h4>
          <p style={{ margin: '6px auto 16px auto', fontSize: 13, color: 'var(--secondary-label)', maxWidth: 360 }}>
            {t('Upload your diet plan PDF or create a reusable template to track your daily nutrition effortlessly.')}
          </p>
          <Button variant="primary" onClick={onOpenAddPdf}>
            {t('+ Add Diet Plan PDF')}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {plans.map(p => {
            const meals = p.meals || {}
            let totalCal = 0, totalP = 0, totalC = 0, totalF = 0
            let itemCount = 0

            Object.values(meals).forEach(mList => {
              (mList || []).forEach(item => {
                totalCal += Number(item.energy_kcal) || 0
                totalP += Number(item.protein_g) || 0
                totalC += Number(item.carb_g) || 0
                totalF += Number(item.fat_g) || 0
                itemCount++
              })
            })

            return (
              <div key={p.id} style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: p.is_active ? '1px solid #00E5FF' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: '16px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>
                        {p.name}
                      </h4>
                      {p.is_active && (
                        <span style={{
                          background: 'rgba(0, 229, 255, 0.15)',
                          color: '#00E5FF',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 9999,
                          border: '1px solid rgba(0, 229, 255, 0.3)'
                        }}>
                          {t('ACTIVE')}
                        </span>
                      )}
                    </div>
                    {p.source_pdf_name && (
                      <div style={{ fontSize: 11, color: 'var(--secondary-label)', marginTop: 2 }}>
                        📄 {p.source_pdf_name}
                      </div>
                    )}
                  </div>

                  {/* Planned Macro Pill */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#00E5FF' }}>
                      {Math.round(totalCal)} kcal
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--secondary-label)' }}>
                      P: {Math.round(totalP)}g • C: {Math.round(totalC)}g • F: {Math.round(totalF)}g
                    </div>
                  </div>
                </div>

                {/* Meal preview pills */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  {MEAL_TYPES.map(mt => {
                    const count = (meals[mt.id] || []).length
                    return (
                      <span key={mt.id} style={{
                        fontSize: 11,
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '3px 8px',
                        borderRadius: 6,
                        color: count > 0 ? 'var(--label)' : 'var(--secondary-label)'
                      }}>
                        {mt.label}: {count}
                      </span>
                    )
                  })}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!p.is_active && (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => handleSetActive(p.id)}
                        style={{ fontSize: 11 }}
                      >
                        {t('Set as Active')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => handleDuplicate(p.id)}
                      style={{ fontSize: 11 }}
                    >
                      {t('Duplicate')}
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => handleDelete(p.id)}
                      style={{ fontSize: 11, color: '#EF4444' }}
                    >
                      {t('Delete')}
                    </button>
                  </div>

                  <Button
                    variant="primary"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => {
                      if (onApplyPlanToToday) onApplyPlanToToday(p.id)
                    }}
                  >
                    {t('Use for Today')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ==================== MODULE 4: MY NUTRITION GOALS VIEW ==================== */

export function MyNutritionGoalsView({ toast, onTargetsSaved }) {
  const [profile, setProfile] = useState({
    age: 26,
    sex: 'male',
    height_cm: 175,
    weight_kg: 72,
    target_weight_kg: 70,
    fitness_goal: 'fat_loss',
    activity_level: 'moderately_active',
    workout_experience: 'intermediate',
    workout_days_per_week: 4,
    strength_duration_min: 45,
    cardio_frequency_per_week: 2,
    cardio_duration_min: 20,
    dietary_restrictions: []
  })

  const [calculated, setCalculated] = useState(null)
  const [customOverrides, setCustomOverrides] = useState(null)
  const [isEditingCustom, setIsEditingCustom] = useState(false)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  // Load existing saved goals
  const loadGoals = async () => {
    try {
      const res = await api('/api/nutrition/goals')
      if (res?.ok && res?.goals) {
        if (res.goals.profile) setProfile(prev => ({ ...prev, ...res.goals.profile }))
        if (res.goals.calculated_targets) setCalculated(res.goals.calculated_targets)
        if (res.goals.custom_targets) {
          setCustomOverrides(res.goals.custom_targets)
          setIsEditingCustom(true)
        }
        if (res.goals.history) setHistory(res.goals.history)
      } else {
        // Trigger calculate on defaults
        handleCalculate(profile)
      }
    } catch (err) {
      console.warn('Load goals error:', err)
      handleCalculate(profile)
    }
  }

  useEffect(() => {
    loadGoals()
  }, [])

  // Calculate live targets
  const handleCalculate = async (prof) => {
    try {
      const res = await api('/api/nutrition/goals/calculate', {
        method: 'POST',
        body: { profile: prof }
      })
      if (res?.ok && res?.calculated_targets) {
        setCalculated(res.calculated_targets)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleProfileChange = (field, value) => {
    const updated = { ...profile, [field]: value }
    setProfile(updated)
    handleCalculate(updated)
  }

  const handleToggleRestriction = (r) => {
    const list = [...(profile.dietary_restrictions || [])]
    const idx = list.indexOf(r)
    if (idx >= 0) list.splice(idx, 1)
    else list.push(r)
    handleProfileChange('dietary_restrictions', list)
  }

  const handleSaveGoals = async () => {
    setLoading(true)
    try {
      const res = await api('/api/nutrition/goals/save', {
        method: 'POST',
        body: {
          profile,
          custom_targets: isEditingCustom ? customOverrides : null
        }
      })
      if (res?.ok && res?.goals) {
        if (toast) toast('Nutrition goals saved successfully!', 'success')
        if (onTargetsSaved) {
          const finalTarget = isEditingCustom ? customOverrides : res.goals.calculated_targets
          onTargetsSaved(finalTarget)
        }
        loadGoals()
      } else {
        throw new Error(res?.error || 'Save failed')
      }
    } catch (err) {
      if (toast) toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const activeTargets = (isEditingCustom && customOverrides) ? customOverrides : calculated

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--label)' }}>
          {t('Personalized Body & Nutrition Goals')}
        </h3>
        <div style={{ fontSize: 12, color: 'var(--secondary-label)' }}>
          {t('Calculated deterministically using Mifflin-St Jeor formula and PAL activity coefficients.')}
        </div>
      </div>

      {/* Target Cards Dashboard */}
      {activeTargets && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          <div style={{ background: 'rgba(0, 229, 255, 0.08)', border: '1px solid rgba(0, 229, 255, 0.3)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--secondary-label)', textTransform: 'uppercase' }}>{t('Calories')}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#00E5FF', margin: '4px 0' }}>{activeTargets.calorie_target}</div>
            <div style={{ fontSize: 10, color: 'var(--secondary-label)' }}>kcal / day</div>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--secondary-label)', textTransform: 'uppercase' }}>{t('Protein')}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#F59E0B', margin: '4px 0' }}>{activeTargets.protein_target}g</div>
            <div style={{ fontSize: 10, color: 'var(--secondary-label)' }}>{Math.round((activeTargets.protein_target * 4 / activeTargets.calorie_target) * 100)}% kcal</div>
          </div>
          <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--secondary-label)', textTransform: 'uppercase' }}>{t('Carbs')}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#EAB308', margin: '4px 0' }}>{activeTargets.carb_target}g</div>
            <div style={{ fontSize: 10, color: 'var(--secondary-label)' }}>{Math.round((activeTargets.carb_target * 4 / activeTargets.calorie_target) * 100)}% kcal</div>
          </div>
          <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--secondary-label)', textTransform: 'uppercase' }}>{t('Fat')}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#6366F1', margin: '4px 0' }}>{activeTargets.fat_target}g</div>
            <div style={{ fontSize: 10, color: 'var(--secondary-label)' }}>{Math.round((activeTargets.fat_target * 9 / activeTargets.calorie_target) * 100)}% kcal</div>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--secondary-label)', textTransform: 'uppercase' }}>{t('Fiber')}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#10B981', margin: '4px 0' }}>{activeTargets.fibre_target}g</div>
            <div style={{ fontSize: 10, color: 'var(--secondary-label)' }}>14g / 1k kcal</div>
          </div>
        </div>
      )}

      {/* Metabolic Baseline Metrics */}
      {calculated && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-around',
          textAlign: 'center',
          fontSize: 12
        }}>
          <div>
            <div style={{ color: 'var(--secondary-label)' }}>BMI</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', marginTop: 2 }}>{calculated.bmi}</div>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', height: 24 }} />
          <div>
            <div style={{ color: 'var(--secondary-label)' }}>BMR</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', marginTop: 2 }}>{calculated.bmr} kcal</div>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', height: 24 }} />
          <div>
            <div style={{ color: 'var(--secondary-label)' }}>Estimated TDEE</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#00E5FF', marginTop: 2 }}>{calculated.tdee} kcal</div>
          </div>
        </div>
      )}

      {/* Input Profile Form */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        padding: '18px'
      }}>
        <h4 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>
          {t('Physical & Activity Parameters')}
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
              {t('Age (years)')}
            </label>
            <input
              type="number"
              className="input"
              value={profile.age}
              onChange={e => handleProfileChange('age', e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
              {t('Biological Sex')}
            </label>
            <select
              className="input"
              value={profile.sex}
              onChange={e => handleProfileChange('sex', e.target.value)}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
              {t('Height (cm)')}
            </label>
            <input
              type="number"
              className="input"
              value={profile.height_cm}
              onChange={e => handleProfileChange('height_cm', e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
              {t('Current Weight (kg)')}
            </label>
            <input
              type="number"
              className="input"
              value={profile.weight_kg}
              onChange={e => handleProfileChange('weight_kg', e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
              {t('Target Weight (kg)')}
            </label>
            <input
              type="number"
              className="input"
              value={profile.target_weight_kg}
              onChange={e => handleProfileChange('target_weight_kg', e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
              {t('Fitness Goal')}
            </label>
            <select
              className="input"
              value={profile.fitness_goal}
              onChange={e => handleProfileChange('fitness_goal', e.target.value)}
            >
              <option value="fat_loss">Fat Loss (-450 kcal)</option>
              <option value="muscle_gain">Muscle Gain (+300 kcal)</option>
              <option value="recomposition">Body Recomposition (-100 kcal)</option>
              <option value="maintenance">Maintenance (0 kcal)</option>
            </select>
          </div>
        </div>

        {/* Activity & Workout Details */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
              {t('Daily Activity Level')}
            </label>
            <select
              className="input"
              value={profile.activity_level}
              onChange={e => handleProfileChange('activity_level', e.target.value)}
            >
              <option value="sedentary">Sedentary (Desk job, minimal movement)</option>
              <option value="lightly_active">Lightly Active (1-3 days exercise)</option>
              <option value="moderately_active">Moderately Active (3-5 days exercise)</option>
              <option value="very_active">Very Active (6-7 days hard training)</option>
              <option value="extra_active">Extra Active (Labor job / 2x daily training)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
              {t('Strength Training')}
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                className="input"
                style={{ width: '50%' }}
                placeholder="Days/wk"
                value={profile.workout_days_per_week}
                onChange={e => handleProfileChange('workout_days_per_week', e.target.value)}
              />
              <input
                type="number"
                className="input"
                style={{ width: '50%' }}
                placeholder="Mins/day"
                value={profile.strength_duration_min}
                onChange={e => handleProfileChange('strength_duration_min', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
              {t('Cardio Sessions')}
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                className="input"
                style={{ width: '50%' }}
                placeholder="Days/wk"
                value={profile.cardio_frequency_per_week}
                onChange={e => handleProfileChange('cardio_frequency_per_week', e.target.value)}
              />
              <input
                type="number"
                className="input"
                style={{ width: '50%' }}
                placeholder="Mins"
                value={profile.cardio_duration_min}
                onChange={e => handleProfileChange('cardio_duration_min', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Dietary Restrictions */}
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 8 }}>
            {t('Dietary Preferences & Restrictions')}
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['vegetarian', 'vegan', 'eggetarian', 'non_veg', 'lactose_free', 'gluten_free'].map(rKey => {
              const checked = (profile.dietary_restrictions || []).includes(rKey)
              return (
                <button
                  type="button"
                  key={rKey}
                  onClick={() => handleToggleRestriction(rKey)}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '5px 12px',
                    borderRadius: 9999,
                    border: checked ? '1px solid #00E5FF' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: checked ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    color: checked ? '#00E5FF' : 'var(--secondary-label)',
                    cursor: 'pointer'
                  }}
                >
                  {rKey === 'vegetarian' ? 'Vegetarian' :
                   rKey === 'vegan' ? 'Vegan' :
                   rKey === 'eggetarian' ? 'Eggetarian' :
                   rKey === 'non_veg' ? 'Non-Vegetarian' :
                   rKey === 'lactose_free' ? 'Lactose-Free' : 'Gluten-Free'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Manual Overrides Toggle */}
        <div style={{ marginTop: 18, borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)' }}>
                {t('Custom Macro Overrides')}
              </span>
              <div style={{ fontSize: 11, color: 'var(--secondary-label)' }}>
                {t('Optionally fine-tune your exact gram targets')}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--label)' }}>
              <input
                type="checkbox"
                checked={isEditingCustom}
                onChange={e => {
                  setIsEditingCustom(e.target.checked)
                  if (e.target.checked && !customOverrides && calculated) {
                    setCustomOverrides({ ...calculated })
                  }
                }}
              />
              {t('Enable Manual Overrides')}
            </label>
          </div>

          {isEditingCustom && customOverrides && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--secondary-label)' }}>Calories</label>
                <input
                  type="number"
                  className="input"
                  value={customOverrides.calorie_target}
                  onChange={e => setCustomOverrides({ ...customOverrides, calorie_target: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--secondary-label)' }}>Protein (g)</label>
                <input
                  type="number"
                  className="input"
                  value={customOverrides.protein_target}
                  onChange={e => setCustomOverrides({ ...customOverrides, protein_target: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--secondary-label)' }}>Carbs (g)</label>
                <input
                  type="number"
                  className="input"
                  value={customOverrides.carb_target}
                  onChange={e => setCustomOverrides({ ...customOverrides, carb_target: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--secondary-label)' }}>Fat (g)</label>
                <input
                  type="number"
                  className="input"
                  value={customOverrides.fat_target}
                  onChange={e => setCustomOverrides({ ...customOverrides, fat_target: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--secondary-label)' }}>Fiber (g)</label>
                <input
                  type="number"
                  className="input"
                  value={customOverrides.fibre_target}
                  onChange={e => setCustomOverrides({ ...customOverrides, fibre_target: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <Button
            variant="primary"
            disabled={loading}
            onClick={handleSaveGoals}
            style={{ minWidth: 140 }}
          >
            {loading ? t('Saving...') : t('Save Nutrition Goals')}
          </Button>
        </div>
      </div>

      {/* Goal Revision History */}
      {history && history.length > 0 && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          padding: '16px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
            {t('Goal Revision History')}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.slice(0, 5).map((h, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                padding: '6px 0',
                borderBottom: '1px dashed rgba(255, 255, 255, 0.05)'
              }}>
                <span style={{ color: 'var(--secondary-label)' }}>
                  {h.date ? new Date(h.date).toLocaleDateString() : 'Previous'}: {h.profile?.fitness_goal?.replace('_', ' ').toUpperCase()} ({h.profile?.weight_kg}kg)
                </span>
                <span style={{ fontWeight: 600, color: 'var(--label)' }}>
                  {h.targets?.calorie_target || h.targets?.calories} kcal • {h.targets?.protein_target || h.targets?.protein}g P
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ==================== MODULE 6: CHEAT MEAL MODAL ==================== */

export function CheatMealModal({ onLogged, close, toast }) {
  const [foodName, setFoodName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('serving')
  const [grams, setGrams] = useState('150')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [impactResult, setImpactResult] = useState(null)
  const [customCalories, setCustomCalories] = useState('')

  const handleLogCheatMeal = async () => {
    if (!foodName.trim()) {
      if (toast) toast('Please specify what you ate', 'warning')
      return
    }

    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await api('/api/nutrition/cheat-meals/save', {
        method: 'POST',
        body: {
          date: today,
          food_name: foodName.trim(),
          serving_quantity: Number(quantity) || 1,
          serving_unit: unit,
          serving_grams: Number(grams) || 150,
          energy_kcal: customCalories ? Number(customCalories) : null,
          notes: notes.trim()
        }
      })

      if (res?.ok && res?.impact) {
        setImpactResult(res.impact)
        if (toast) toast('Extra meal recorded without judgment', 'success')
        if (onLogged) onLogged(res.cheatMeal)
      } else {
        throw new Error(res?.error || 'Failed to log extra meal')
      }
    } catch (err) {
      if (toast) toast(err.message || 'Error logging meal', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '6px' }}>
      {!impactResult ? (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(234, 179, 8, 0.15)',
              color: '#EAB308',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px auto',
              border: '1px solid rgba(234, 179, 8, 0.3)'
            }}>
              <Icon name="sparkles" />
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--label)' }}>
              {t('Log Cheat / Extra Meal')}
            </h3>
            <p style={{ margin: '6px 0 0 0', fontSize: 12, color: 'var(--secondary-label)' }}>
              {t('Record unbudgeted meals truthfully. Nutrition progress is measured over months, not single meals.')}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
                {t('Food Name')}
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Chicken Biryani, Pizza Slice, Gulab Jamun"
                value={foodName}
                onChange={e => setFoodName(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
                  {t('Quantity')}
                </label>
                <input
                  type="number"
                  className="input"
                  min="0.5"
                  step="0.5"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
                  {t('Unit')}
                </label>
                <select className="input" value={unit} onChange={e => setUnit(e.target.value)}>
                  <option value="serving">serving</option>
                  <option value="piece">piece</option>
                  <option value="plate">plate</option>
                  <option value="bowl">bowl</option>
                  <option value="g">grams</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
                  {t('Calories (optional)')}
                </label>
                <input
                  type="number"
                  className="input"
                  placeholder="Auto from DB"
                  value={customCalories}
                  onChange={e => setCustomCalories(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', display: 'block', marginBottom: 4 }}>
                {t('Notes')}
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Birthday dinner with family"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <Button variant="ghost" onClick={close}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" disabled={loading} onClick={handleLogCheatMeal}>
              {loading ? t('Logging...') : t('Log Extra Meal')}
            </Button>
          </div>
        </div>
      ) : (
        /* Supportive Feedback Display */
        <div style={{ textAlign: 'center', padding: '10px 4px' }}>
          <div style={{
            background: impactResult.is_above_target ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: impactResult.is_above_target ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 14,
            padding: '18px 14px',
            marginBottom: 16
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>
              {impactResult.is_above_target ? t('Supportive Guidance') : t('Meal Logged')}
            </h4>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--label)' }}>
              {impactResult.supportive_message}
            </p>
          </div>

          {/* Quick Metrics */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '12px',
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 12
          }}>
            <div>
              <div style={{ color: 'var(--secondary-label)' }}>Daily Goal</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', marginTop: 2 }}>
                {impactResult.daily_goal} kcal
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--secondary-label)' }}>Actual Intake</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#00E5FF', marginTop: 2 }}>
                {impactResult.actual_intake} kcal
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--secondary-label)' }}>Difference</div>
              <div style={{
                fontSize: 15,
                fontWeight: 700,
                color: impactResult.difference_from_goal > 0 ? '#F59E0B' : '#10B981',
                marginTop: 2
              }}>
                {impactResult.difference_from_goal > 0 ? `+${impactResult.difference_from_goal}` : impactResult.difference_from_goal} kcal
              </div>
            </div>
          </div>

          {/* Transparent Optional Activity Estimate */}
          {impactResult.transparent_activity_reference && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: 10,
              padding: '10px 12px',
              textAlign: 'left',
              fontSize: 11,
              color: 'var(--secondary-label)',
              marginBottom: 18
            }}>
              <div style={{ fontWeight: 600, color: 'var(--label)', marginBottom: 4 }}>
                ℹ {t('Transparent Activity Reference (Optional)')}:
              </div>
              <div style={{ marginBottom: 4 }}>
                • {t('Brisk walking estimate')}: ~{impactResult.transparent_activity_reference.brisk_walking_min} min
              </div>
              <div style={{ fontStyle: 'italic', fontSize: 10 }}>
                {impactResult.transparent_activity_reference.disclaimer}
              </div>
            </div>
          )}

          <Button variant="primary" onClick={close} style={{ width: '100%' }}>
            {t('Got It, Keep Going')}
          </Button>
        </div>
      )}
    </div>
  )
}

/* ==================== MODULE 5: AVAILABLE FOODS (PANTRY) MODAL ==================== */

export function AvailableFoodsModal({ close, toast }) {
  const [foods, setFoods] = useState([])
  const [inputVal, setInputVal] = useState('')
  const [loading, setLoading] = useState(false)

  const loadFoods = async () => {
    try {
      const res = await api('/api/nutrition/available-foods')
      if (res?.ok && Array.isArray(res.items)) {
        setFoods(res.items)
      }
    } catch (err) {
      console.warn(err)
    }
  }

  useEffect(() => {
    loadFoods()
  }, [])

  const handleAdd = () => {
    const val = inputVal.trim()
    if (!val) return
    if (!foods.includes(val)) {
      setFoods([...foods, val])
    }
    setInputVal('')
  }

  const handleRemove = (item) => {
    setFoods(foods.filter(f => f !== item))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await api('/api/nutrition/available-foods', {
        method: 'POST',
        body: { items: foods }
      })
      if (res?.ok) {
        if (toast) toast('Pantry foods saved! Recommendations will prioritize these items.', 'success')
        if (close) close()
      }
    } catch (err) {
      if (toast) toast('Save error: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '6px' }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--label)' }}>
          {t('My Available Foods (Pantry & Fridge)')}
        </h3>
        <p style={{ margin: '6px 0 0 0', fontSize: 12, color: 'var(--secondary-label)' }}>
          {t('Tell IRONX what staples you currently have at home. When your meals fall short, recommendations will prioritize these ingredients.')}
        </p>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          className="input"
          placeholder="e.g. eggs, banana, curd, oats, rice, chicken"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        />
        <Button variant="secondary" onClick={handleAdd}>
          {t('Add')}
        </Button>
      </div>

      {/* Chips */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        minHeight: 80,
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        marginBottom: 18
      }}>
        {foods.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--secondary-label)', fontStyle: 'italic', margin: 'auto' }}>
            {t('No pantry items added yet')}
          </div>
        ) : (
          foods.map(item => (
            <span
              key={item}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(0, 229, 255, 0.12)',
                border: '1px solid rgba(0, 229, 255, 0.25)',
                color: '#00E5FF',
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 9999
              }}
            >
              {item}
              <button
                type="button"
                onClick={() => handleRemove(item)}
                style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0, fontSize: 11 }}
              >
                ✕
              </button>
            </span>
          ))
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={close}>
          {t('Cancel')}
        </Button>
        <Button variant="primary" disabled={loading} onClick={handleSave}>
          {loading ? t('Saving...') : t('Save Available Foods')}
        </Button>
      </div>
    </div>
  )
}

/* ==================== MODULE 7: NUTRITION NOTIFICATIONS MODAL ==================== */

export function NutritionNotificationsModal({ close, toast }) {
  const [prefs, setPrefs] = useState({
    remind_breakfast: true,
    remind_lunch: true,
    remind_snacks: false,
    remind_dinner: true,
    alert_calorie_goal: true,
    alert_protein_target: true,
    alert_calorie_above: true,
    alert_missing_values: true
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api('/api/nutrition/notifications/config').then(res => {
      if (res?.ok && res?.preferences) setPrefs(res.preferences)
    }).catch(console.warn)
  }, [])

  const handleToggle = (key) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await api('/api/nutrition/notifications/config', {
        method: 'POST',
        body: { preferences: prefs }
      })
      if (res?.ok) {
        if (toast) toast('Notification preferences saved', 'success')
        if (close) close()
      }
    } catch (err) {
      if (toast) toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '6px' }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--label)' }}>
          {t('Nutrition Notifications')}
        </h3>
        <p style={{ margin: '6px 0 0 0', fontSize: 12, color: 'var(--secondary-label)' }}>
          {t('Choose which daily nutrition and meal reminders you wish to receive.')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {[
          { key: 'remind_breakfast', label: 'Breakfast Reminder', desc: 'Alert if breakfast is not completed by 10:00 AM' },
          { key: 'remind_lunch', label: 'Lunch Reminder', desc: 'Alert if lunch is not completed by 2:00 PM' },
          { key: 'remind_dinner', label: 'Dinner Reminder', desc: 'Alert if dinner is not completed by 9:00 PM' },
          { key: 'alert_calorie_goal', label: 'Daily Calorie Goal Reached', desc: 'Notify when you reach your daily calorie target' },
          { key: 'alert_protein_target', label: 'Protein Target Pending', desc: 'Remind in the evening if protein target is still short' },
          { key: 'alert_calorie_above', label: 'Intake Above Target Notification', desc: 'Supportive non-judgmental alert if intake exceeds target' }
        ].map(item => (
          <label
            key={item.key}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 12px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 10,
              cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              style={{ marginTop: 3 }}
              checked={!!prefs[item.key]}
              onChange={() => handleToggle(item.key)}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)' }}>{t(item.label)}</div>
              <div style={{ fontSize: 11, color: 'var(--secondary-label)', marginTop: 2 }}>{t(item.desc)}</div>
            </div>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={close}>
          {t('Cancel')}
        </Button>
        <Button variant="primary" disabled={loading} onClick={handleSave}>
          {loading ? t('Saving...') : t('Save Preferences')}
        </Button>
      </div>
    </div>
  )
}
