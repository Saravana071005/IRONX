import React, { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'

/* =========================================================================
   1. REPEAT PREVIOUS MEAL MODAL
   Allows user to pick a past meal (Breakfast, Lunch, Dinner, Snacks),
   customize quantities in an editable draft, and save as new entries for today.
   ========================================================================= */
export function RepeatPreviousMealModal({ defaultMealType = 'breakfast', onSaveBatch, close, toast }) {
  const [activeTab, setActiveTab] = useState(defaultMealType)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ breakfast: [], lunch: [], dinner: [], snacks: [] })
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [draftItems, setDraftItems] = useState([])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const res = await api('/api/nutrition/previous-meals')
        if (mounted && res?.ok) {
          setData({
            breakfast: res.breakfast || [],
            lunch: res.lunch || [],
            dinner: res.dinner || [],
            snacks: res.snacks || []
          })
        }
      } catch (e) {
        if (mounted) toast(t('Could not load previous meals'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const handleSelectMeal = (m) => {
    setSelectedMeal(m)
    // Clone items so edits never modify past records
    setDraftItems((m.items || []).map(it => ({
      ...it,
      id: 'food_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      serving_quantity: Number(it.serving_quantity || it.qty) || 1,
      orig_qty: Number(it.serving_quantity || it.qty) || 1,
      orig_kcal: Number(it.energy_kcal || it.calories) || 0,
      orig_p: Number(it.protein_g || it.protein) || 0,
      orig_c: Number(it.carb_g || it.carbs) || 0,
      orig_f: Number(it.fat_g || it.fat) || 0
    })))
  }

  const handleQtyChange = (idx, newQtyStr) => {
    const newQty = parseFloat(newQtyStr) || 0
    setDraftItems(prev => {
      const copy = [...prev]
      const item = { ...copy[idx] }
      item.serving_quantity = newQty
      if (item.orig_qty > 0) {
        const ratio = newQty / item.orig_qty
        item.energy_kcal = Math.round(item.orig_kcal * ratio)
        item.calories = item.energy_kcal
        item.protein_g = Math.round(item.orig_p * ratio * 10) / 10
        item.protein = item.protein_g
        item.carb_g = Math.round(item.orig_c * ratio * 10) / 10
        item.carbs = item.carb_g
        item.fat_g = Math.round(item.orig_f * ratio * 10) / 10
        item.fat = item.fat_g
      }
      copy[idx] = item
      return copy
    })
  }

  const handleRemoveDraftItem = (idx) => {
    setDraftItems(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSaveToToday = () => {
    if (draftItems.length === 0) {
      toast(t('At least one food item is required'))
      return
    }
    const targetMealType = selectedMeal?.meal_type || activeTab
    const finalEntries = draftItems.map(it => ({
      ...it,
      meal_type: targetMealType,
      type: targetMealType
    }))
    onSaveBatch(finalEntries)
    close()
  }

  const list = data[activeTab] || []

  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#FFFFFF' }}>
          <span style={{ color: 'var(--theme-accent, #E8B477)' }}><Icon name="reset" /></span>
          {t('Repeat Previous Meal')}
        </h3>
        <button className="iconbtn" onClick={close}><Icon name="xmark" /></button>
      </div>

      {!selectedMeal ? (
        <>
          {/* Meal Type Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
            {['breakfast', 'lunch', 'dinner', 'snacks'].map(mt => (
              <button
                key={mt}
                type="button"
                onClick={() => setActiveTab(mt)}
                style={{
                  padding: '8px 4px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'capitalize',
                  background: activeTab === mt ? 'var(--theme-accent, #E8B477)' : 'rgba(255, 255, 255, 0.08)',
                  color: activeTab === mt ? '#000000' : 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer'
                }}
              >
                {t(mt)}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
              {t('Loading past meals...')}
            </div>
          ) : list.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
              {t('No previous {0} logs found. Save a {1} first to repeat it.', activeTab, activeTab)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
              {list.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-accent, #E8B477)' }}>
                        {m.date}
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 9999, background: 'rgba(255,255,255,0.1)', color: '#FFFFFF' }}>
                        {m.total_calories} kcal · {m.total_protein}g P
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.items.map(it => `${it.food_name || it.name} (${it.serving_quantity || it.qty} ${it.serving_unit || it.unit || 'g'})`).join(', ')}
                    </div>
                  </div>

                  <button
                    className="btn small"
                    onClick={() => handleSelectMeal(m)}
                    style={{
                      background: 'rgba(232, 180, 119, 0.2)',
                      color: 'var(--theme-accent, #E8B477)',
                      fontWeight: 700,
                      borderRadius: 8,
                      border: '1px solid rgba(232, 180, 119, 0.4)',
                      padding: '6px 12px',
                      flex: 'none'
                    }}
                  >
                    {t('Select')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Customize & Edit Quantities Before Adding */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)' }}>
              {t('Repeating from')} <strong style={{ color: 'var(--theme-accent, #E8B477)' }}>{selectedMeal.date}</strong>
            </span>
            <button
              className="btn small"
              onClick={() => setSelectedMeal(null)}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              {t('Change Meal')}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxHeight: 280, overflowY: 'auto' }}>
            {draftItems.map((it, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.07)',
                  border: '1px solid rgba(255, 255, 255, 0.12)'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{it.food_name || it.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', marginTop: 2 }}>
                    {it.energy_kcal} kcal · {it.protein_g}g P · {it.carb_g}g C · {it.fat_g}g F
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    value={it.serving_quantity}
                    onChange={e => handleQtyChange(idx, e.target.value)}
                    style={{
                      width: 60,
                      padding: '5px 8px',
                      borderRadius: 6,
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      color: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 700,
                      textAlign: 'center'
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)' }}>{it.serving_unit || 'g'}</span>
                  <button
                    className="iconbtn"
                    onClick={() => handleRemoveDraftItem(idx)}
                    style={{ width: 26, height: 26, color: 'var(--coral, #FF6B6B)' }}
                  >
                    <Icon name="xmark" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'rgba(232, 180, 119, 0.15)', border: '1px solid rgba(232, 180, 119, 0.3)', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>{t("Today's Total")}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--theme-accent, #E8B477)' }}>
              {Math.round(draftItems.reduce((acc, it) => acc + (Number(it.energy_kcal) || 0), 0))} kcal · {Math.round(draftItems.reduce((acc, it) => acc + (Number(it.protein_g) || 0), 0) * 10) / 10}g P
            </span>
          </div>

          <Button
            variant="primary"
            onClick={handleSaveToToday}
            style={{ width: '100%', padding: '12px', fontWeight: 700, borderRadius: 10 }}
          >
            {t("Add {0} Items to Today's {1}", draftItems.length, selectedMeal?.meal_type || activeTab)}
          </Button>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   2. SAVE AS MY MEAL (CUSTOM MEAL TEMPLATE MODAL)
   Saves current meal foods as a reusable template.
   ========================================================================= */
export function SaveAsMyMealModal({ defaultMealType = 'breakfast', currentFoods = [], onSaved, close, toast }) {
  const [name, setName] = useState('')
  const [mealType, setMealType] = useState(defaultMealType)
  const [notes, setNotes] = useState('')
  const [selectedFoods, setSelectedFoods] = useState(currentFoods.map(f => f.id))
  const [saving, setSaving] = useState(false)

  const toggleSelect = (id) => {
    setSelectedFoods(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const itemsToSave = currentFoods.filter(f => selectedFoods.includes(f.id))
  const totalCals = Math.round(itemsToSave.reduce((sum, f) => sum + (Number(f.energy_kcal || f.calories) || 0), 0))
  const totalP = Math.round(itemsToSave.reduce((sum, f) => sum + (Number(f.protein_g || f.protein) || 0), 0) * 10) / 10
  const totalC = Math.round(itemsToSave.reduce((sum, f) => sum + (Number(f.carb_g || f.carbs) || 0), 0) * 10) / 10
  const totalF = Math.round(itemsToSave.reduce((sum, f) => sum + (Number(f.fat_g || f.fat) || 0), 0) * 10) / 10

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      toast(t('Please enter a name for your meal template'))
      return
    }
    if (itemsToSave.length === 0) {
      toast(t('Please select at least one food item'))
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        meal_type: mealType,
        items: itemsToSave.map(it => ({
          food_name: it.food_name || it.name,
          name: it.food_name || it.name,
          serving_quantity: it.serving_quantity || it.qty || 1,
          serving_unit: it.serving_unit || it.unit || 'g',
          energy_kcal: it.energy_kcal || it.calories || 0,
          protein_g: it.protein_g || it.protein || 0,
          carb_g: it.carb_g || it.carbs || 0,
          fat_g: it.fat_g || it.fat || 0
        })),
        total_calories: totalCals,
        total_protein: totalP,
        total_carbs: totalC,
        total_fat: totalF,
        notes: notes.trim() || null
      }

      const res = await api('/api/nutrition/templates', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (res?.ok) {
        toast(t('Meal template "{0}" saved!', name.trim()))
        if (onSaved) onSaved(res.template)
        close()
      } else {
        toast(t('Error saving template: {0}', res?.error || 'Unknown'))
      }
    } catch (err) {
      toast(t('Failed to save meal template'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} style={{ padding: '4px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#FFFFFF' }}>
          <span style={{ color: 'var(--theme-accent, #E8B477)' }}><Icon name="bookmark" /></span>
          {t('Save as My Meal')}
        </h3>
        <button type="button" className="iconbtn" onClick={close}><Icon name="xmark" /></button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
          {t('Meal Template Name *')}
        </label>
        <input
          type="text"
          required
          placeholder={t('e.g. My Chapathi + Egg Gravy Breakfast')}
          value={name}
          onChange={e => setName(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: 600,
            outline: 'none'
          }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
          {t('Category')}
        </label>
        <select
          value={mealType}
          onChange={e => setMealType(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 10,
            background: '#1A1A1E',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            fontSize: 14
          }}
        >
          {['breakfast', 'lunch', 'dinner', 'snacks'].map(m => (
            <option key={m} value={m}>{t(m.charAt(0).toUpperCase() + m.slice(1))}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
          {t('Select Foods to Include ({0} selected)', itemsToSave.length)}
        </label>
        {currentFoods.length === 0 ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
            {t('No foods currently recorded in this meal. Add foods first or use the Recipe Builder.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {currentFoods.map(f => {
              const checked = selectedFoods.includes(f.id)
              return (
                <div
                  key={f.id}
                  onClick={() => toggleSelect(f.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: checked ? 'rgba(232, 180, 119, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: checked ? '1px solid rgba(232, 180, 119, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(f.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>{f.food_name || f.name}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>({f.serving_quantity || f.qty} {f.serving_unit || f.unit || 'g'})</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-accent, #E8B477)' }}>
                    {f.energy_kcal || f.calories || 0} kcal
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{t('Template Totals')}</span>
          <strong style={{ color: 'var(--theme-accent, #E8B477)' }}>
            {totalCals} kcal · {totalP}g P · {totalC}g C · {totalF}g F
          </strong>
        </div>
      </div>

      <Button
        variant="primary"
        type="submit"
        disabled={saving || itemsToSave.length === 0}
        style={{ width: '100%', padding: '12px', fontWeight: 700, borderRadius: 10 }}
      >
        {saving ? t('Saving...') : t('Save Meal Template')}
      </Button>
    </form>
  )
}

/* =========================================================================
   3. MY SAVED MEALS DRAWER / VIEW
   Lists saved custom meal templates with 1-click addition to today.
   ========================================================================= */
export function MySavedMealsModal({ onAddTemplateToToday, close, toast }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = async () => {
    try {
      const res = await api('/api/nutrition/templates')
      if (res?.ok) setTemplates(res.templates || [])
    } catch (e) {
      toast(t('Could not load saved meals'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const handleDelete = (tpl) => {
    confirmSheet({
      title: t('Delete Saved Meal?'),
      message: t('Delete "{0}" from your saved meal templates? Previously logged meals will remain unchanged.', tpl.name),
      confirmText: t('Delete'),
      danger: true,
      onConfirm: async () => {
        try {
          await api('/api/nutrition/templates/delete', {
            method: 'POST',
            body: JSON.stringify({ id: tpl.id })
          })
          setTemplates(prev => prev.filter(t => t.id !== tpl.id))
          toast(t('Meal template deleted'))
        } catch (e) {
          toast(t('Failed to delete template'))
        }
      }
    })
  }

  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#FFFFFF' }}>
          <span style={{ color: 'var(--theme-accent, #E8B477)' }}><Icon name="bookmark" /></span>
          {t('My Saved Meals & Templates')}
        </h3>
        <button className="iconbtn" onClick={close}><Icon name="xmark" /></button>
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
          {t('Loading saved meals...')}
        </div>
      ) : templates.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
          {t('No saved meals yet. Tap "Save as My Meal" on Today\'s Meals to create reusable templates!')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 380, overflowY: 'auto' }}>
          {templates.map(tpl => (
            <div
              key={tpl.id}
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>{tpl.name}</h4>
                  <div style={{ fontSize: 11, color: 'var(--theme-accent, #E8B477)', fontWeight: 600, textTransform: 'capitalize', marginTop: 2 }}>
                    {tpl.meal_type} · {tpl.total_calories} kcal ({tpl.total_protein}g P · {tpl.total_carbs}g C · {tpl.total_fat}g F)
                  </div>
                </div>
                <button
                  className="iconbtn"
                  onClick={() => handleDelete(tpl)}
                  style={{ color: 'var(--coral, #FF6B6B)', width: 28, height: 28 }}
                >
                  <Icon name="trash" />
                </button>
              </div>

              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 12 }}>
                {(tpl.items || []).map(it => `${it.food_name || it.name} (${it.serving_quantity || it.qty} ${it.serving_unit || it.unit || 'g'})`).join(', ')}
              </div>

              {/* 1-Click Quick Add Row */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', alignSelf: 'center', marginRight: 4 }}>
                  {t('Log to:')}
                </span>
                {['breakfast', 'lunch', 'dinner', 'snacks'].map(mt => (
                  <button
                    key={mt}
                    className="btn small"
                    onClick={() => {
                      onAddTemplateToToday(tpl, mt)
                      close()
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 6,
                      background: tpl.meal_type === mt ? 'rgba(232, 180, 119, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                      color: tpl.meal_type === mt ? 'var(--theme-accent, #E8B477)' : 'rgba(255, 255, 255, 0.8)',
                      border: tpl.meal_type === mt ? '1px solid rgba(232, 180, 119, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)'
                    }}
                  >
                    + {t(mt.charAt(0).toUpperCase() + mt.slice(1))}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   4. RAW INGREDIENT RECIPE BUILDER MODAL
   Allows assembling raw ingredients (eggs, onion, tomato, spices, oil),
   summing total recipe macros, calculating per-serving/per-100g, and logging.
   ========================================================================= */
export function RawRecipeBuilderModal({ onLogRecipePortion, close, toast }) {
  const [recipeName, setRecipeName] = useState('')
  const [ingredients, setIngredients] = useState([])
  const [oilGrams, setOilGrams] = useState(15) // standard 1 tbsp cooking oil
  const [cookedWeight, setCookedWeight] = useState('')
  const [servings, setServings] = useState(2)
  const [notes, setNotes] = useState('')

  // Search ingredient state
  const [ingQuery, setIngQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedRawFood, setSelectedRawFood] = useState(null)
  const [ingGrams, setIngGrams] = useState(100)

  useEffect(() => {
    if (!ingQuery || ingQuery.length < 2) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api(`/api/nutrition/search?q=${encodeURIComponent(ingQuery)}`)
        setSearchResults((res.foods || []).slice(0, 6))
      } catch (e) {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [ingQuery])

  const handleAddIngredient = () => {
    if (!selectedRawFood && !ingQuery.trim()) return
    const g = parseFloat(ingGrams) || 100
    const food = selectedRawFood || {
      name: ingQuery.trim(),
      calories: 100,
      protein: 2,
      carbs: 10,
      fat: 1,
      source: 'Manual'
    }

    const baseKcal = Number(food.energy_kcal != null ? food.energy_kcal : food.calories) || 0
    const baseP = Number(food.protein_g != null ? food.protein_g : food.protein) || 0
    const baseC = Number(food.carb_g != null ? food.carb_g : food.carbs) || 0
    const baseF = Number(food.fat_g != null ? food.fat_g : food.fat) || 0

    const ratio = g / 100
    const item = {
      id: 'ing_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: food.name,
      food_id: food.id || null,
      grams: g,
      energy_kcal: Math.round(baseKcal * ratio),
      protein_g: Math.round(baseP * ratio * 10) / 10,
      carb_g: Math.round(baseC * ratio * 10) / 10,
      fat_g: Math.round(baseF * ratio * 10) / 10,
      source: food.source || 'Verified'
    }

    setIngredients(prev => [...prev, item])
    setIngQuery('')
    setSelectedRawFood(null)
    setSearchResults([])
    setIngGrams(100)
  }

  const handleRemoveIngredient = (id) => {
    setIngredients(prev => prev.filter(x => x.id !== id))
  }

  // Real-time Calculations
  const oilKcal = Math.round(oilGrams * 8.84)
  const oilFat = Math.round(oilGrams * 10) / 10

  const sumRawGrams = ingredients.reduce((sum, it) => sum + it.grams, 0) + oilGrams
  const sumKcal = ingredients.reduce((sum, it) => sum + it.energy_kcal, 0) + oilKcal
  const sumP = Math.round(ingredients.reduce((sum, it) => sum + it.protein_g, 0) * 10) / 10
  const sumC = Math.round(ingredients.reduce((sum, it) => sum + it.carb_g, 0) * 10) / 10
  const sumF = Math.round((ingredients.reduce((sum, it) => sum + it.fat_g, 0) + oilFat) * 10) / 10

  const sCount = Math.max(0.5, parseFloat(servings) || 1)
  const perServingKcal = Math.round(sumKcal / sCount)
  const perServingP = Math.round((sumP / sCount) * 10) / 10
  const perServingC = Math.round((sumC / sCount) * 10) / 10
  const perServingF = Math.round((sumF / sCount) * 10) / 10

  const cWeight = parseFloat(cookedWeight) || null
  const basisWeight = cWeight || sumRawGrams
  const per100gKcal = basisWeight > 0 ? Math.round(sumKcal * (100 / basisWeight)) : 0
  const per100gP = basisWeight > 0 ? Math.round(sumP * (100 / basisWeight) * 10) / 10 : 0
  const per100gC = basisWeight > 0 ? Math.round(sumC * (100 / basisWeight) * 10) / 10 : 0
  const per100gF = basisWeight > 0 ? Math.round(sumF * (100 / basisWeight) * 10) / 10 : 0

  const [savingRecipe, setSavingRecipe] = useState(false)

  const handleSaveAndLog = async (targetMeal = 'lunch') => {
    if (!recipeName.trim()) {
      toast(t('Please enter a recipe name'))
      return
    }
    if (ingredients.length === 0) {
      toast(t('Please add at least one raw ingredient'))
      return
    }

    setSavingRecipe(true)
    try {
      const payload = {
        name: recipeName.trim(),
        ingredients,
        oil_grams: oilGrams,
        total_raw_weight_g: sumRawGrams,
        cooked_weight_g: cWeight,
        servings: sCount,
        total_calories: sumKcal,
        total_protein: sumP,
        total_carbs: sumC,
        total_fat: sumF,
        per_serving_calories: perServingKcal,
        per_serving_protein: perServingP,
        per_serving_carbs: perServingC,
        per_serving_fat: perServingF,
        per_100g_calories: per100gKcal,
        per_100g_protein: per100gP,
        per_100g_carbs: per100gC,
        per_100g_fat: per100gF,
        notes: notes.trim() || null
      }

      await api('/api/nutrition/recipes', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      // Log 1 serving to selected meal
      if (onLogRecipePortion) {
        onLogRecipePortion({
          meal_type: targetMeal,
          food_name: `${recipeName.trim()} (1 serving)`,
          serving_quantity: 1,
          serving_unit: 'serving',
          serving_grams: cWeight ? Math.round(cWeight / sCount) : Math.round(sumRawGrams / sCount),
          energy_kcal: perServingKcal,
          protein_g: perServingP,
          carb_g: perServingC,
          fat_g: perServingF,
          notes: t('Homemade recipe ({0} servings total)', sCount)
        })
      }

      toast(t('Recipe saved and 1 serving added to {0}!', targetMeal))
      close()
    } catch (err) {
      toast(t('Failed to save recipe: {0}', err.message))
    } finally {
      setSavingRecipe(false)
    }
  }

  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#FFFFFF' }}>
          <span style={{ color: 'var(--theme-accent, #E8B477)' }}><Icon name="flame" /></span>
          {t('Raw Ingredient Recipe Builder')}
        </h3>
        <button className="iconbtn" onClick={close}><Icon name="xmark" /></button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
          {t('Recipe Name *')}
        </label>
        <input
          type="text"
          placeholder={t('e.g. Onion-Tomato Egg Gravy')}
          value={recipeName}
          onChange={e => setRecipeName(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: 600,
            outline: 'none'
          }}
        />
      </div>

      {/* Add Raw Ingredient Input */}
      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginBottom: 8 }}>
          {t('Add Raw Ingredient')}
        </div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input
            type="text"
            placeholder={t('Search raw ingredient e.g. eggs, onion, tomato, chicken')}
            value={ingQuery}
            onChange={e => {
              setIngQuery(e.target.value)
              setSelectedRawFood(null)
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              fontSize: 13
            }}
          />
          {searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#18181B',
                border: '1px solid rgba(232, 180, 119, 0.35)',
                borderRadius: 8,
                zIndex: 50,
                maxHeight: 180,
                overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.8)'
              }}
            >
              {searchResults.map(f => (
                <div
                  key={f.id}
                  onClick={() => {
                    setSelectedRawFood(f)
                    setIngQuery(f.name)
                    setSearchResults([])
                  }}
                  style={{
                    padding: '8px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#FFFFFF'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span>{f.name}</span>
                  <span style={{ color: 'var(--theme-accent, #E8B477)', fontWeight: 700 }}>
                    100g = {f.calories || f.energy_kcal} kcal
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('Raw Weight:')}</span>
            <input
              type="number"
              step="any"
              min="1"
              value={ingGrams}
              onChange={e => setIngGrams(e.target.value)}
              style={{
                width: 75,
                padding: '6px 8px',
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                textAlign: 'center'
              }}
            />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>g</span>
          </div>

          <Button
            variant="tinted"
            size="sm"
            onClick={handleAddIngredient}
            disabled={!ingQuery.trim()}
          >
            + {t('Add')}
          </Button>
        </div>
      </div>

      {/* Added Ingredients List */}
      {ingredients.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {ingredients.map(ing => (
            <div
              key={ing.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>{ing.name}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginLeft: 6 }}>
                  ({ing.grams}g · {ing.energy_kcal} kcal)
                </span>
              </div>
              <button
                className="iconbtn"
                onClick={() => handleRemoveIngredient(ing.id)}
                style={{ width: 24, height: 24, color: 'var(--coral, #FF6B6B)' }}
              >
                <Icon name="xmark" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Cooking Oil Input */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
            {t('Cooking Oil (g) *')}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              min="0"
              step="any"
              value={oilGrams}
              onChange={e => setOilGrams(parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700
              }}
            />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>g</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--theme-accent, #E8B477)', marginTop: 2 }}>
            = {oilKcal} kcal ({oilFat}g fat)
          </div>
        </div>

        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
            {t('Servings in Batch *')}
          </label>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={servings}
            onChange={e => setServings(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 700
            }}
          />
        </div>
      </div>

      {/* Yield & Nutrition Output Card */}
      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(232, 180, 119, 0.12)', border: '1px solid rgba(232, 180, 119, 0.3)', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{t('Per Serving ({0} of {1}):', 1, sCount)}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--theme-accent, #E8B477)' }}>
            {perServingKcal} kcal
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', display: 'flex', gap: 10 }}>
          <span><strong>{perServingP}g</strong> {t('Protein')}</span>
          <span><strong>{perServingC}g</strong> {t('Carbs')}</span>
          <span><strong>{perServingF}g</strong> {t('Fat')}</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6, fontStyle: 'italic' }}>
          {t('Total recipe batch: {0} kcal ({1}g raw weight including {2}g cooking oil). Cooking water loss/absorption accounted for.', sumKcal, sumRawGrams, oilGrams)}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant="tinted"
          onClick={() => handleSaveAndLog('breakfast')}
          disabled={savingRecipe || ingredients.length === 0}
          style={{ flex: 1, padding: '10px', fontSize: 12 }}
        >
          {t('+ Log 1 Serving to Breakfast')}
        </Button>
        <Button
          variant="primary"
          onClick={() => handleSaveAndLog('lunch')}
          disabled={savingRecipe || ingredients.length === 0}
          style={{ flex: 1, padding: '10px', fontSize: 12 }}
        >
          {t('+ Log 1 Serving to Lunch')}
        </Button>
      </div>
    </div>
  )
}

/* =========================================================================
   5. AI NUTRITION COACH COMPONENT
   Complete personalized assistant based on real profile & daily logs.
   ========================================================================= */
export function AICoachView({ user, foods = [], currentTargets = {}, onTargetsUpdated, toast }) {
  const [activeSubTab, setActiveSubTab] = useState('coach') // 'coach' | 'foods' | 'recipes' | 'nl_log'

  const [profile, setProfile] = useState({
    age: user?.age || 26,
    sex: user?.sex || 'male',
    height_cm: user?.height || 178,
    weight_kg: user?.weight || 76,
    activity_level: 'moderate',
    workout_frequency: '4-5 days/week',
    fitness_goal: 'fat_loss',
    target_rate: 'moderate',
    diet_preference: 'non_veg'
  })

  const [calcResult, setCalcResult] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  // AI Chat Assistant State
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: t('Hello! I am your IRONX Nutrition Coach. I track your actual daily intake and recommend authentic South Indian & Indian foods (Idli, Dosa, Chapathi, Boiled Eggs, Sambar, Chicken, Fish, Sundal) tailored to your exact remaining calories and protein goals. How can I help you today?')
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [sendingChat, setSendingChat] = useState(false)

  // Verified Foods Explorer State
  const [foodQuery, setFoodQuery] = useState('')
  const [foodCategory, setFoodCategory] = useState('')
  const [foodStateFilter, setFoodStateFilter] = useState('')
  const [verifiedFoodsList, setVerifiedFoodsList] = useState([])
  const [loadingFoods, setLoadingFoods] = useState(false)

  // Verified Recipes Browser State
  const [recipeQuery, setRecipeQuery] = useState('')
  const [verifiedRecipesList, setVerifiedRecipesList] = useState([])
  const [selectedRecipeItem, setSelectedRecipeItem] = useState(null)
  const [loadingRecipes, setLoadingRecipes] = useState(false)

  // Natural Language Meal Logger State
  const [nlText, setNlText] = useState('')
  const [nlMealType, setNlMealType] = useState('breakfast')
  const [nlParsedData, setNlParsedData] = useState(null)
  const [parsingNl, setParsingNl] = useState(false)
  const [loggingNl, setLoggingNl] = useState(false)

  // Calculate real daily consumption from actual foods
  const targetKcal = Number(currentTargets.calorie_target || currentTargets.calories || 1900)
  const targetP = Number(currentTargets.protein_target_g || currentTargets.protein || 140)
  const targetC = Number(currentTargets.carb_target_g || currentTargets.carbs || 220)
  const targetF = Number(currentTargets.fat_target_g || currentTargets.fat || 65)

  const realFoods = foods.filter(f => !f.is_example)
  const consumedKcal = Math.round(realFoods.reduce((sum, f) => sum + (Number(f.energy_kcal || f.calories) || 0), 0))
  const consumedP = Math.round(realFoods.reduce((sum, f) => sum + (Number(f.protein_g || f.protein) || 0), 0) * 10) / 10
  const consumedC = Math.round(realFoods.reduce((sum, f) => sum + (Number(f.carb_g || f.carbs) || 0), 0) * 10) / 10
  const consumedF = Math.round(realFoods.reduce((sum, f) => sum + (Number(f.fat_g || f.fat) || 0), 0) * 10) / 10

  const remainingKcal = Math.max(0, targetKcal - consumedKcal)
  const remainingP = Math.max(0, Math.round((targetP - consumedP) * 10) / 10)
  const remainingC = Math.max(0, Math.round((targetC - consumedC) * 10) / 10)
  const remainingF = Math.max(0, Math.round((targetF - consumedF) * 10) / 10)

  // Fetch verified foods
  const fetchVerifiedFoods = async (q = foodQuery, cat = foodCategory, st = foodStateFilter) => {
    setLoadingFoods(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (cat) params.set('category', cat)
      if (st) params.set('state', st)
      params.set('limit', '25')
      const res = await api(`/api/nutrition/ai/foods?${params.toString()}`)
      if (res?.ok) {
        setVerifiedFoodsList(res.foods || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingFoods(false)
    }
  }

  // Fetch verified recipes
  const fetchVerifiedRecipes = async (q = recipeQuery) => {
    setLoadingRecipes(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      params.set('limit', '25')
      const res = await api(`/api/nutrition/ai/recipes?${params.toString()}`)
      if (res?.ok) {
        setVerifiedRecipesList(res.recipes || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingRecipes(false)
    }
  }

  // Fetch single recipe details
  const handleSelectRecipe = async (r) => {
    try {
      const res = await api(`/api/nutrition/ai/recipes/item?id=${r.recipe_id}`)
      if (res?.ok && res.recipe) {
        setSelectedRecipeItem(res.recipe)
      } else {
        setSelectedRecipeItem(r)
      }
    } catch {
      setSelectedRecipeItem(r)
    }
  }

  // Parse Natural Language Meal
  const handleParseNL = async (queryText = nlText) => {
    const text = String(queryText || '').trim()
    if (!text) return
    setParsingNl(true)
    try {
      const res = await api('/api/nutrition/ai/parse-nl', {
        method: 'POST',
        body: JSON.stringify({ text })
      })
      if (res?.ok) {
        setNlParsedData(res)
      } else {
        toast?.(t('Could not parse meal description'))
      }
    } catch (err) {
      toast?.(t('Error parsing meal: {0}', err.message))
    } finally {
      setParsingNl(false)
    }
  }

  // Log parsed NL items
  const handleLogParsedMeal = async () => {
    if (!nlParsedData?.parsed_items?.length) return
    setLoggingNl(true)
    try {
      const foodsToLog = nlParsedData.parsed_items.map(it => ({
        food_name: it.food_name,
        food_name_tamil: it.food_name_tamil || null,
        serving_quantity: it.serving_quantity || 1,
        serving_unit: it.serving_unit || 'serving',
        energy_kcal: it.energy_kcal || 0,
        protein_g: it.protein_g || 0,
        carb_g: it.carb_g || 0,
        fat_g: it.fat_g || 0,
        fibre_g: it.fibre_g || 0,
        source_name: it.source_name || 'IRONX AI Verified'
      }))

      const res = await api('/api/nutrition/food/save-batch', {
        method: 'POST',
        body: JSON.stringify({
          meal_type: nlMealType,
          foods: foodsToLog
        })
      })

      if (res?.ok) {
        toast?.(t('Successfully logged {0} items to {1}!', foodsToLog.length, nlMealType))
        setNlText('')
        setNlParsedData(null)
      } else {
        toast?.(t('Failed to save meal'))
      }
    } catch (err) {
      toast?.(t('Error logging meal: {0}', err.message))
    } finally {
      setLoggingNl(false)
    }
  }

  // Load foods or recipes when switching tabs
  useEffect(() => {
    if (activeSubTab === 'foods' && verifiedFoodsList.length === 0) {
      fetchVerifiedFoods()
    } else if (activeSubTab === 'recipes' && verifiedRecipesList.length === 0) {
      fetchVerifiedRecipes()
    }
  }, [activeSubTab])

  const handleCalculateTargets = async (e) => {
    if (e) e.preventDefault()
    setCalculating(true)
    try {
      const res = await api('/api/nutrition/coach/targets', {
        method: 'POST',
        body: JSON.stringify(profile)
      })
      if (res?.ok) {
        setCalcResult(res.calculation)
        if (onTargetsUpdated) onTargetsUpdated(res.targets)
        toast?.(t('New personalized targets calculated & saved!'))
        setShowConfig(false)
      } else {
        toast?.(t('Calculation error: {0}', res?.error || 'Unknown'))
      }
    } catch (err) {
      toast?.(t('Failed to calculate targets: {0}', err.message))
    } finally {
      setCalculating(false)
    }
  }

  const handleSendChat = async (presetText = null) => {
    const textToSend = presetText || chatInput.trim()
    if (!textToSend || sendingChat) return

    const userMsg = { role: 'user', text: textToSend }
    setMessages(prev => [...prev, userMsg])
    if (!presetText) setChatInput('')
    setSendingChat(true)

    try {
      const res = await api('/api/nutrition/coach/chat', {
        method: 'POST',
        body: JSON.stringify({ message: textToSend })
      })
      if (res?.ok && res.reply) {
        setMessages(prev => [...prev, { role: 'assistant', text: res.reply }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: t('You currently have {0} kcal and {1}g protein remaining today. High-protein picks: 3 Boiled Eggs (19g P), 100g Chicken (31g P), or 1 bowl Sundal (14g P).', remainingKcal, remainingP)
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: t('Based on your logged meals, you have {0} kcal and {1}g protein left. Try 2-3 chapatis with egg gravy or dal for a balanced South Indian meal.', remainingKcal, remainingP)
      }])
    } finally {
      setSendingChat(false)
    }
  }

  const PHASE2_CATEGORIES = [
    'Cereals and grains',
    'Vegetables',
    'Pulses and legumes',
    'Fruits',
    'Spices and ingredients',
    'Nuts, seeds and fats',
    'Dairy',
    'Fish and seafood',
    'Poultry and eggs',
    'Meat'
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sub-Tab Navigation Pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { key: 'coach', label: t('AI Nutrition Coach'), icon: 'sparkles' },
          { key: 'foods', label: t('Verified Foods (2,799)'), icon: 'apple' },
          { key: 'recipes', label: t('Verified Recipes (1,014)'), icon: 'flame' },
          { key: 'nl_log', label: t('AI Fast Meal Log'), icon: 'check' }
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSubTab(tab.key)}
            style={{
              padding: '8px 14px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              border: activeSubTab === tab.key ? '1px solid var(--theme-accent, #E8B477)' : '1px solid rgba(255, 255, 255, 0.12)',
              background: activeSubTab === tab.key ? 'rgba(232, 180, 119, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: activeSubTab === tab.key ? 'var(--theme-accent, #E8B477)' : 'rgba(255, 255, 255, 0.75)'
            }}
          >
            <Icon name={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* VIEW 1: AI COACH & TARGETS */}
      {activeSubTab === 'coach' && (
        <>
          {/* Top Banner & Profile Trigger */}
          <div className="card" style={{ padding: '16px 18px', background: 'linear-gradient(135deg, rgba(232, 180, 119, 0.15) 0%, rgba(20, 20, 24, 0.95) 100%)', border: '1px solid rgba(232, 180, 119, 0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--theme-accent, #E8B477)', fontSize: 20 }}><Icon name="sparkles" /></span>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>{t('AI Nutrition Coach')}</h2>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: 'rgba(46, 196, 182, 0.25)', color: 'var(--teal, #2EC4B6)', fontWeight: 700 }}>
                    {t('Context-Aware')}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.75)', marginTop: 4 }}>
                  {t('Personalized BMR & TDEE target: {0} kcal · {1}g Protein · Authentic South Indian advice', targetKcal, targetP)}
                </div>
              </div>

              <Button
                variant="tinted"
                size="sm"
                onClick={() => setShowConfig(!showConfig)}
                style={{ borderRadius: 8, fontWeight: 700 }}
              >
                {showConfig ? t('Hide Profile Form') : t('Edit Profile & Goals')}
              </Button>
            </div>

            {/* Profile & Goal Configuration Form */}
            {showConfig && (
              <form onSubmit={handleCalculateTargets} style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{t('Age (yrs)')}</label>
                    <input
                      type="number"
                      min="12"
                      max="100"
                      value={profile.age}
                      onChange={e => setProfile({ ...profile, age: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: 13 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{t('Sex')}</label>
                    <select
                      value={profile.sex}
                      onChange={e => setProfile({ ...profile, sex: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: 13 }}
                    >
                      <option value="male">{t('Male')}</option>
                      <option value="female">{t('Female')}</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{t('Height (cm)')}</label>
                    <input
                      type="number"
                      min="100"
                      max="250"
                      value={profile.height_cm}
                      onChange={e => setProfile({ ...profile, height_cm: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: 13 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{t('Weight (kg)')}</label>
                    <input
                      type="number"
                      min="30"
                      max="250"
                      value={profile.weight_kg}
                      onChange={e => setProfile({ ...profile, weight_kg: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: 13 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{t('Fitness Goal')}</label>
                    <select
                      value={profile.fitness_goal}
                      onChange={e => setProfile({ ...profile, fitness_goal: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: 13 }}
                    >
                      <option value="fat_loss">{t('Fat Loss')}</option>
                      <option value="muscle_gain">{t('Muscle Gain')}</option>
                      <option value="recomp">{t('Body Recomposition')}</option>
                      <option value="maintenance">{t('Weight Maintenance')}</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{t('Fat Loss Rate')}</label>
                    <select
                      value={profile.target_rate}
                      onChange={e => setProfile({ ...profile, target_rate: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: 13 }}
                    >
                      <option value="conservative">{t('Conservative (Safe & Steady)')}</option>
                      <option value="moderate">{t('Moderate (Recommended)')}</option>
                      <option value="aggressive">{t('Aggressive (High Deficit)')}</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{t('Dietary Preference')}</label>
                    <select
                      value={profile.diet_preference}
                      onChange={e => setProfile({ ...profile, diet_preference: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: '#1A1A1E', border: '1px solid rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: 13 }}
                    >
                      <option value="non_veg">{t('Non-Vegetarian (Eggs, Chicken, Fish)')}</option>
                      <option value="eggetarian">{t('Eggetarian (Vegetarian + Eggs)')}</option>
                      <option value="veg">{t('Vegetarian (Dairy, Dal, Soya)')}</option>
                      <option value="vegan">{t('Vegan (Plant-based)')}</option>
                    </select>
                  </div>
                </div>

                <Button
                  variant="primary"
                  type="submit"
                  disabled={calculating}
                  style={{ width: '100%', padding: '10px', fontWeight: 700, borderRadius: 8 }}
                >
                  {calculating ? t('Calculating BMR & Targets...') : t('Calculate & Update Nutrition Targets')}
                </Button>
              </form>
            )}
          </div>

          {/* Target & Progress Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {/* Calories Card */}
            <div className="card" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--coral, #FF6B6B)', textTransform: 'uppercase' }}>
                {t('Daily Calories')}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', marginTop: 4 }}>
                {consumedKcal} <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>/ {targetKcal} kcal</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.round((consumedKcal / targetKcal) * 100))}%`, height: '100%', background: 'var(--coral, #FF6B6B)', borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
                {remainingKcal > 0 ? t('{0} kcal remaining', remainingKcal) : t('Target met!')}
              </div>
            </div>

            {/* Protein Card */}
            <div className="card" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-accent, #E8B477)', textTransform: 'uppercase' }}>
                {t('Protein Progress')}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', marginTop: 4 }}>
                {consumedP}g <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>/ {targetP}g</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.round((consumedP / targetP) * 100))}%`, height: '100%', background: 'var(--theme-accent, #E8B477)', borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
                {remainingP > 0 ? t('{0}g protein needed today', remainingP) : t('Target achieved!')}
              </div>
            </div>

            {/* Carbs & Fat Card */}
            <div className="card" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal, #2EC4B6)', textTransform: 'uppercase' }}>
                {t('Carbs & Fat Balance')}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', marginTop: 6 }}>
                {t('Carbs')}: {consumedC}g / {targetC}g ({remainingC}g left)
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', marginTop: 4 }}>
                {t('Fat')}: {consumedF}g / {targetF}g ({remainingF}g left)
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
                {t('Internally consistent 4P / 4C / 9F macro split')}
              </div>
            </div>
          </div>

          {/* South Indian Recommendation Chips */}
          <div className="card" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-accent, #E8B477)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="apple" />
              {t('Suggested South Indian Foods (Tailored to Your Remaining Macros)')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 12, color: '#FFFFFF' }}>
                <strong>3 Boiled Eggs (முட்டை)</strong>: 19g P · 234 kcal
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Instant complete protein & vitamins</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 12, color: '#FFFFFF' }}>
                <strong>100g Air-Fried Chicken (கோழி)</strong>: 31g P · 165 kcal
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Maximum protein density for fat loss</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 12, color: '#FFFFFF' }}>
                <strong>2 Chapatis (சப்பாத்தி) + Dal</strong>: 12g P · 330 kcal
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>High fibre, steady digestion</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 12, color: '#FFFFFF' }}>
                <strong>1 Cup Sundal (சுண்டல்)</strong>: 14g P · 220 kcal
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Affordable, slow-burning complex carbs</div>
              </div>
            </div>
          </div>

          {/* Interactive AI Chat Assistant */}
          <div className="card" style={{ padding: '16px 18px', background: 'rgba(18, 18, 22, 0.95)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ color: 'var(--theme-accent, #E8B477)' }}><Icon name="sparkles" /></span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>{t('Ask Nutrition Coach')}</h3>
            </div>

            {/* Quick Suggestion Chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                'How much protein do I still need today?',
                'What should I eat for breakfast?',
                'Suggest a South Indian lunch',
                'Can I eat dosa and still lose fat?',
                'How many chapatis fit my target?',
                'What should I eat before my workout?'
              ].map((promptText, i) => (
                <button
                  key={i}
                  type="button"
                  className="chip"
                  onClick={() => handleSendChat(promptText)}
                  disabled={sendingChat}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 9999,
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'rgba(255, 255, 255, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    cursor: 'pointer'
                  }}
                >
                  {promptText}
                </button>
              ))}
            </div>

            {/* Message Thread */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', marginBottom: 14, paddingRight: 4 }}>
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    fontSize: 13,
                    lineHeight: 1.45,
                    background: m.role === 'user' ? 'var(--theme-accent, #E8B477)' : 'rgba(255, 255, 255, 0.08)',
                    color: m.role === 'user' ? '#000000' : '#FFFFFF',
                    border: m.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                    whiteSpace: 'pre-line'
                  }}
                >
                  {m.text}
                </div>
              ))}
              {sendingChat && (
                <div style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.08)', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                  {t('Analyzing your real logged food...')}
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder={t('Ask anything e.g. "Can I eat 3 chapatis for dinner?"')}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendChat() }}
                disabled={sendingChat}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              <Button
                variant="primary"
                onClick={() => handleSendChat()}
                disabled={!chatInput.trim() || sendingChat}
                style={{ borderRadius: 10, padding: '10px 18px', fontWeight: 700 }}
              >
                {t('Send')}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* VIEW 2: VERIFIED FOODS EXPLORER */}
      {activeSubTab === 'foods' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--theme-accent, #E8B477)' }}><Icon name="apple" /></span>
              {t('Verified Food Knowledge Database (2,799 Items)')}
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'rgba(255, 255, 255, 0.7)' }}>
              {t('Source-grounded food compositions from ICMR-NIN 2017 & USDA FoodData Central. Exact per-100g lab values, regional Tamil/Hindi names, and preparation states.')}
            </p>

            {/* Search Input */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                placeholder={t('Search food in English or Tamil (e.g. chapati, சப்பாத்தி, dosa, chicken breast, spinach)...')}
                value={foodQuery}
                onChange={e => setFoodQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') fetchVerifiedFoods(foodQuery, foodCategory, foodStateFilter) }}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              <Button
                variant="primary"
                onClick={() => fetchVerifiedFoods(foodQuery, foodCategory, foodStateFilter)}
                style={{ borderRadius: 10, padding: '10px 16px', fontWeight: 700 }}
              >
                {t('Search')}
              </Button>
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
              <button
                type="button"
                onClick={() => { setFoodCategory(''); fetchVerifiedFoods(foodQuery, '', foodStateFilter); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 9999,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: !foodCategory ? '1px solid var(--theme-accent, #E8B477)' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: !foodCategory ? 'rgba(232, 180, 119, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: !foodCategory ? 'var(--theme-accent, #E8B477)' : 'rgba(255, 255, 255, 0.7)'
                }}
              >
                {t('All Categories')}
              </button>
              {PHASE2_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setFoodCategory(cat); fetchVerifiedFoods(foodQuery, cat, foodStateFilter); }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    border: foodCategory === cat ? '1px solid var(--theme-accent, #E8B477)' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: foodCategory === cat ? 'rgba(232, 180, 119, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: foodCategory === cat ? 'var(--theme-accent, #E8B477)' : 'rgba(255, 255, 255, 0.7)'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Results List */}
          {loadingFoods ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
              {t('Loading verified food compositions...')}
            </div>
          ) : verifiedFoodsList.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
              {t('No verified foods found matching "{0}". Try a different name or category.', foodQuery)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              {verifiedFoodsList.map(food => (
                <div
                  key={food.food_id || food.id}
                  className="card"
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>{food.food_name || food.name}</div>
                      {food.food_name_tamil && (
                        <div style={{ fontSize: 12, color: 'var(--theme-accent, #E8B477)', fontWeight: 600 }}>{food.food_name_tamil}</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: food.food_state === 'cooked' ? 'rgba(232, 180, 119, 0.2)' : 'rgba(46, 196, 182, 0.2)',
                      color: food.food_state === 'cooked' ? 'var(--theme-accent, #E8B477)' : 'var(--teal, #2EC4B6)',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {food.food_state}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                    {food.category} · {food.source_name}
                  </div>

                  {/* Nutrients per 100g grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: 8, textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{t('Energy')}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{food.energy_kcal} <span style={{ fontSize: 9 }}>kcal</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--theme-accent, #E8B477)' }}>{t('Protein')}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{food.protein_g}g</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--teal, #2EC4B6)' }}>{t('Carbs')}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{food.carb_g}g</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--coral, #FF6B6B)' }}>{t('Fat')}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{food.fat_g}g</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: VERIFIED RECIPES BROWSER */}
      {activeSubTab === 'recipes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--theme-accent, #E8B477)' }}><Icon name="flame" /></span>
              {t('Verified Indian & South Indian Recipes (1,014 Dishes)')}
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'rgba(255, 255, 255, 0.7)' }}>
              {t('Authentic composite recipes with deterministic ingredient aggregation, cooking yield calculations, per-serving and per-100g nutritional breakdowns.')}
            </p>

            {/* Search Input */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder={t('Search recipes e.g. sambar, chicken curry, biryani, rasam, kootu...')}
                value={recipeQuery}
                onChange={e => setRecipeQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') fetchVerifiedRecipes(recipeQuery) }}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              <Button
                variant="primary"
                onClick={() => fetchVerifiedRecipes(recipeQuery)}
                style={{ borderRadius: 10, padding: '10px 16px', fontWeight: 700 }}
              >
                {t('Search')}
              </Button>
            </div>
          </div>

          {/* Recipe List */}
          {loadingRecipes ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
              {t('Loading verified recipes...')}
            </div>
          ) : verifiedRecipesList.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
              {t('No verified recipes found matching "{0}".', recipeQuery)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              {verifiedRecipesList.map(rec => (
                <div
                  key={rec.recipe_id}
                  className="card"
                  style={{
                    padding: '14px 16px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    cursor: 'pointer'
                  }}
                  onClick={() => handleSelectRecipe(rec)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>{rec.recipe_name}</div>
                      {rec.recipe_name_tamil && (
                        <div style={{ fontSize: 12, color: 'var(--theme-accent, #E8B477)', fontWeight: 600 }}>{rec.recipe_name_tamil}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: 'rgba(232, 180, 119, 0.2)', color: 'var(--theme-accent, #E8B477)', fontWeight: 700 }}>
                      {rec.cuisine || 'Indian Regional'}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                    {rec.recipe_category} · {rec.serving_count} servings ({rec.serving_weight_g}g / serving)
                  </div>

                  {/* Nutrients Per Serving */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: 8, textAlign: 'center', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{t('Serving')}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{Math.round(rec.total_energy_kcal / (rec.serving_count || 1))} <span style={{ fontSize: 9 }}>kcal</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--theme-accent, #E8B477)' }}>{t('Protein')}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{Math.round((rec.total_protein_g / (rec.serving_count || 1)) * 10) / 10}g</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--teal, #2EC4B6)' }}>{t('Carbs')}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{Math.round((rec.total_carbohydrate_g / (rec.serving_count || 1)) * 10) / 10}g</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--coral, #FF6B6B)' }}>{t('Fat')}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{Math.round((rec.total_fat_g / (rec.serving_count || 1)) * 10) / 10}g</div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--theme-accent, #E8B477)', textAlign: 'right', fontWeight: 600 }}>
                    {t('View Ingredients & Breakdown →')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected Recipe Detail Modal / Panel */}
          {selectedRecipeItem && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 16
            }}>
              <div style={{
                background: '#18181B',
                border: '1px solid rgba(232, 180, 119, 0.4)',
                borderRadius: 16,
                padding: '20px 24px',
                maxWidth: 550,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>{selectedRecipeItem.recipe_name}</h3>
                    {selectedRecipeItem.recipe_name_tamil && (
                      <div style={{ fontSize: 13, color: 'var(--theme-accent, #E8B477)', fontWeight: 600 }}>{selectedRecipeItem.recipe_name_tamil}</div>
                    )}
                  </div>
                  <button className="iconbtn" onClick={() => setSelectedRecipeItem(null)}><Icon name="xmark" /></button>
                </div>

                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>
                  {selectedRecipeItem.cuisine} · {selectedRecipeItem.recipe_category} · {selectedRecipeItem.cooking_method || 'Standard cooking'}
                </div>

                {/* Serving & Total Details */}
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '12px 14px', borderRadius: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', marginBottom: 6 }}>
                    {t('Per Serving Nutrition ({0}g / serving · {1} servings total)', selectedRecipeItem.serving_weight_g, selectedRecipeItem.serving_count)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{t('Energy')}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>{Math.round(selectedRecipeItem.total_energy_kcal / (selectedRecipeItem.serving_count || 1))} kcal</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--theme-accent, #E8B477)' }}>{t('Protein')}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>{Math.round((selectedRecipeItem.total_protein_g / (selectedRecipeItem.serving_count || 1)) * 10) / 10}g</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--teal, #2EC4B6)' }}>{t('Carbs')}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>{Math.round((selectedRecipeItem.total_carbohydrate_g / (selectedRecipeItem.serving_count || 1)) * 10) / 10}g</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--coral, #FF6B6B)' }}>{t('Fat')}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>{Math.round((selectedRecipeItem.total_fat_g / (selectedRecipeItem.serving_count || 1)) * 10) / 10}g</div>
                    </div>
                  </div>
                </div>

                {/* Raw Ingredients Breakdown */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginBottom: 8 }}>
                    {t('Raw Ingredients Breakdown')}
                  </div>
                  {Array.isArray(selectedRecipeItem.ingredient_list) && selectedRecipeItem.ingredient_list.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                      {selectedRecipeItem.ingredient_list.map((ing, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', fontSize: 12 }}>
                          <div>
                            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{ing.ingredient_name}</span>
                            <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>({ing.ingredient_weight_g}g)</span>
                          </div>
                          <div style={{ color: 'var(--theme-accent, #E8B477)', fontWeight: 600 }}>
                            {ing.contribution_energy_kcal} kcal · {ing.contribution_protein_g}g P
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                      {selectedRecipeItem.ingredients || selectedRecipeItem.ingredients_summary}
                    </div>
                  )}
                </div>

                <Button
                  variant="primary"
                  onClick={() => setSelectedRecipeItem(null)}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, fontWeight: 700 }}
                >
                  {t('Close')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: NATURAL LANGUAGE MEAL LOGGER */}
      {activeSubTab === 'nl_log' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--theme-accent, #E8B477)' }}><Icon name="check" /></span>
              {t('AI Fast Meal Logger (English & Tamil)')}
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'rgba(255, 255, 255, 0.7)' }}>
              {t('Type what you ate in natural language. IRONX AI breaks it down into verified food codes, calculates exact calories and macros, and lets you verify before logging.')}
            </p>

            {/* Quick Example Chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                '2 chapatis and 100g chicken',
                '3 boiled eggs and 1 cup oats',
                '2 சப்பாத்தி மற்றும் 100 கிராம் சாதம்',
                '3 இட்லி மற்றும் சாம்பார்',
                '1 plate curd rice with pickle',
                '150g cooked rice and 150g chicken gravy'
              ].map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setNlText(ex); handleParseNL(ex); }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 9999,
                    fontSize: 11,
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'rgba(255, 255, 255, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    cursor: 'pointer'
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* Input Textarea */}
            <textarea
              rows={3}
              placeholder={t('Describe what you ate e.g. "I ate 2 chapatis, 100g cooked chicken breast and 1 boiled egg"...')}
              value={nlText}
              onChange={e => setNlText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                fontSize: 13,
                outline: 'none',
                resize: 'none',
                marginBottom: 10
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{t('Target Meal:')}</span>
                <select
                  value={nlMealType}
                  onChange={e => setNlMealType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: '#1A1A1E',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  <option value="breakfast">{t('Breakfast')}</option>
                  <option value="lunch">{t('Lunch')}</option>
                  <option value="dinner">{t('Dinner')}</option>
                  <option value="snacks">{t('Snacks')}</option>
                </select>
              </div>

              <Button
                variant="primary"
                onClick={() => handleParseNL(nlText)}
                disabled={!nlText.trim() || parsingNl}
                style={{ borderRadius: 10, padding: '8px 18px', fontWeight: 700 }}
              >
                {parsingNl ? t('Analyzing...') : t('Parse Meal')}
              </Button>
            </div>
          </div>

          {/* Parsed Results Preview */}
          {nlParsedData && (
            <div className="card" style={{ padding: '16px', background: 'rgba(232, 180, 119, 0.08)', border: '1px solid rgba(232, 180, 119, 0.35)', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>{t('Verified Meal Breakdown')}</h4>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                    {t('Source: "{0}"', nlParsedData.source_text)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--theme-accent, #E8B477)' }}>
                    {nlParsedData.total_calories} <span style={{ fontSize: 12 }}>kcal</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                    {nlParsedData.total_protein_g}g P · {nlParsedData.total_carbohydrate_g}g C · {nlParsedData.total_fat_g}g F
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {nlParsedData.parsed_items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>
                        {item.food_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                        {item.serving_quantity} {item.serving_unit} ({item.serving_grams}g) · {item.source_name}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{item.energy_kcal} kcal</div>
                      <div style={{ fontSize: 11, color: 'var(--theme-accent, #E8B477)', fontWeight: 600 }}>{item.protein_g}g P</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Batch Button */}
              <Button
                variant="primary"
                onClick={handleLogParsedMeal}
                disabled={loggingNl}
                style={{ width: '100%', padding: '12px', borderRadius: 10, fontWeight: 800, fontSize: 14 }}
              >
                {loggingNl ? t('Logging...') : t('✓ Confirm & Log to {0}', nlMealType.toUpperCase())}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
