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
          <span style={{ color: 'var(--theme-accent, #F5F5F5)' }}><Icon name="reset" /></span>
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
                  background: activeTab === mt ? 'var(--theme-accent, #F5F5F5)' : 'rgba(255, 255, 255, 0.08)',
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
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-accent, #F5F5F5)' }}>
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
                      background: 'var(--borders, #303036)',
                      color: 'var(--theme-accent, #F5F5F5)',
                      fontWeight: 700,
                      borderRadius: 8,
                      border: '1px solid var(--borders, #303036)',
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
              {t('Repeating from')} <strong style={{ color: 'var(--theme-accent, #F5F5F5)' }}>{selectedMeal.date}</strong>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'var(--borders, #303036)', border: '1px solid var(--borders, #303036)', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>{t("Today's Total")}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--theme-accent, #F5F5F5)' }}>
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
          <span style={{ color: 'var(--theme-accent, #F5F5F5)' }}><Icon name="bookmark" /></span>
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
                    background: checked ? 'var(--borders, #303036)' : 'rgba(255, 255, 255, 0.05)',
                    border: checked ? '1px solid var(--borders, #303036)' : '1px solid rgba(255, 255, 255, 0.1)',
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
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-accent, #F5F5F5)' }}>
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
          <strong style={{ color: 'var(--theme-accent, #F5F5F5)' }}>
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
          <span style={{ color: 'var(--theme-accent, #F5F5F5)' }}><Icon name="bookmark" /></span>
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
                  <div style={{ fontSize: 11, color: 'var(--theme-accent, #F5F5F5)', fontWeight: 600, textTransform: 'capitalize', marginTop: 2 }}>
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
                      background: tpl.meal_type === mt ? 'var(--borders, #303036)' : 'rgba(255, 255, 255, 0.08)',
                      color: tpl.meal_type === mt ? 'var(--theme-accent, #F5F5F5)' : 'rgba(255, 255, 255, 0.8)',
                      border: tpl.meal_type === mt ? '1px solid var(--borders, #303036)' : '1px solid rgba(255, 255, 255, 0.15)'
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
    if (!selectedRawFood) {
      if (!ingQuery.trim()) return;
      toast(t('Please search and select a verified ingredient from the dataset.'));
      return;
    }
    const g = parseFloat(ingGrams) || 100
    const food = selectedRawFood

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
          <span style={{ color: 'var(--theme-accent, #F5F5F5)' }}><Icon name="flame" /></span>
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
                border: '1px solid var(--borders, #303036)',
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
                  <span style={{ color: 'var(--theme-accent, #F5F5F5)', fontWeight: 700 }}>
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
          <div style={{ fontSize: 11, color: 'var(--theme-accent, #F5F5F5)', marginTop: 2 }}>
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
      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--borders, #303036)', border: '1px solid var(--borders, #303036)', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{t('Per Serving ({0} of {1}):', 1, sCount)}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--theme-accent, #F5F5F5)' }}>
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
   5. FOOD NUTRITION DATABASE LOOKUP COMPONENT
   Verified laboratory nutrition records from ICMR-NIN 2017 & USDA SR Legacy.
   Exact per-100g and reference quantity lab values.
   Zero AI model, zero chatbot, zero LLM integration.
   ========================================================================= */
export function FoodDatabaseLookup({ user, foods = [], currentTargets = {}, onTargetsUpdated, toast }) {
  const [activeSubTab, setActiveSubTab] = useState('foods') // 'foods' | 'recipes'

  // Verified Foods Explorer State
  const [foodQuery, setFoodQuery] = useState('')
  const [foodCategory, setFoodCategory] = useState('')
  const [foodStateFilter, setFoodStateFilter] = useState('')
  const [verifiedFoodsList, setVerifiedFoodsList] = useState([])
  const [loadingFoods, setLoadingFoods] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Quick food log dialog
  const [loggingFoodItem, setLoggingFoodItem] = useState(null)
  const [logMealType, setLogMealType] = useState('breakfast')
  const [logQty, setLogQty] = useState('100')
  const [logUnit, setLogUnit] = useState('g')
  const [savingLog, setSavingLog] = useState(false)

  // Verified Recipes Browser State
  const [recipeQuery, setRecipeQuery] = useState('')
  const [verifiedRecipesList, setVerifiedRecipesList] = useState([])
  const [selectedRecipeItem, setSelectedRecipeItem] = useState(null)
  const [loadingRecipes, setLoadingRecipes] = useState(false)

  // Fetch verified foods
  const fetchVerifiedFoods = async (q = foodQuery, cat = foodCategory, st = foodStateFilter) => {
    setLoadingFoods(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (cat) params.set('category', cat)
      if (st) params.set('state', st)
      params.set('limit', '30')
      const res = await api(`/api/nutrition/foods?${params.toString()}`)
      if (res?.ok && Array.isArray(res.foods)) {
        setVerifiedFoodsList(res.foods)
      } else {
        setVerifiedFoodsList([])
      }
    } catch (err) {
      console.error(err)
      setVerifiedFoodsList([])
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
      const res = await api(`/api/nutrition/verified-recipes?${params.toString()}`)
      if (res?.ok) {
        setVerifiedRecipesList(res.recipes || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingRecipes(false)
    }
  }

  // Load initial popular staples on mount
  useEffect(() => {
    fetchVerifiedFoods('chapathi')
    fetchVerifiedRecipes('')
  }, [])

  // Fetch single recipe details
  const handleSelectRecipe = async (r) => {
    try {
      const res = await api(`/api/nutrition/verified-recipes/item?id=${r.recipe_id}`)
      if (res?.ok && res.recipe) {
        setSelectedRecipeItem(res.recipe)
      } else {
        setSelectedRecipeItem(r)
      }
    } catch {
      setSelectedRecipeItem(r)
    }
  }

  // Handle logging food to meal
  const handleSaveFoodToLog = async () => {
    if (!loggingFoodItem) return
    setSavingLog(true)
    try {
      const q = parseFloat(logQty) || 100
      let grams = q
      if (logUnit === 'piece' || logUnit === 'pieces') {
        grams = q * (loggingFoodItem.serving_size_g || 35)
      }
      const ratio = grams / 100.0

      const res = await api('/api/nutrition/food/save', {
        method: 'POST',
        body: JSON.stringify({
          meal_type: logMealType,
          food_id: loggingFoodItem.food_id || loggingFoodItem.id,
          food_name: loggingFoodItem.food_name || loggingFoodItem.name,
          serving_quantity: q,
          serving_unit: logUnit,
          serving_grams: grams,
          energy_kcal: Math.round(Number(loggingFoodItem.energy_kcal || loggingFoodItem.calories) * ratio),
          protein_g: Math.round(Number(loggingFoodItem.protein_g || loggingFoodItem.protein) * ratio * 10) / 10,
          carb_g: Math.round(Number(loggingFoodItem.carb_g || loggingFoodItem.carbs) * ratio * 10) / 10,
          fat_g: Math.round(Number(loggingFoodItem.fat_g || loggingFoodItem.fat) * ratio * 10) / 10,
          fibre_g: Math.round(Number(loggingFoodItem.fibre_g || loggingFoodItem.fibre || 0) * ratio * 10) / 10,
          notes: `Logged from Nutrition Dataset (${loggingFoodItem.source_name || 'ICMR-NIN Verified'})`
        })
      })

      if (res?.ok) {
        toast?.(t('Logged {0} to {1}!', loggingFoodItem.food_name || loggingFoodItem.name, logMealType))
        setLoggingFoodItem(null)
      } else {
        toast?.(res?.error || t('Failed to log food'))
      }
    } catch (err) {
      toast?.(err.message || t('Error logging food'))
    } finally {
      setSavingLog(false)
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
          { key: 'foods', label: t('Verified Foods (2,799)'), icon: 'apple' },
          { key: 'recipes', label: t('Verified Recipes (1,014)'), icon: 'flame' }
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSubTab(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              border: activeSubTab === tab.key ? '1px solid var(--theme-accent, #F5F5F5)' : '1px solid rgba(255, 255, 255, 0.12)',
              background: activeSubTab === tab.key ? 'var(--borders, #303036)' : 'rgba(255, 255, 255, 0.05)',
              color: activeSubTab === tab.key ? 'var(--theme-accent, #F5F5F5)' : 'rgba(255, 255, 255, 0.75)'
            }}
          >
            <Icon name={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* VIEW 1: VERIFIED FOODS EXPLORER */}
      {activeSubTab === 'foods' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '16px 18px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 14 }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--theme-accent, #F5F5F5)' }}><Icon name="apple" /></span>
              {t('Food Nutrition Database (2,799 Items)')}
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.45 }}>
              {t('Verified laboratory nutrition compositions from ICMR-NIN 2017 & USDA FoodData Central. Exact per-100g and serving reference values. Never estimated or fabricated.')}
            </p>

            {/* Search Input */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                placeholder={t('Search food in English or Tamil (e.g. chapati, சப்பாத்தி, rice, chicken, dosa, egg, paneer)...')}
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
                style={{ borderRadius: 10, padding: '10px 18px', fontWeight: 700 }}
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
                  border: !foodCategory ? '1px solid var(--theme-accent, #F5F5F5)' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: !foodCategory ? 'var(--borders, #303036)' : 'rgba(255, 255, 255, 0.05)',
                  color: !foodCategory ? 'var(--theme-accent, #F5F5F5)' : 'rgba(255, 255, 255, 0.7)'
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
                    border: foodCategory === cat ? '1px solid var(--theme-accent, #F5F5F5)' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: foodCategory === cat ? 'var(--borders, #303036)' : 'rgba(255, 255, 255, 0.05)',
                    color: foodCategory === cat ? 'var(--theme-accent, #F5F5F5)' : 'rgba(255, 255, 255, 0.7)'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Results List or Empty State */}
          {loadingFoods ? (
            <div style={{ padding: 36, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
              {t('Loading verified food compositions...')}
            </div>
          ) : verifiedFoodsList.length === 0 ? (
            <div style={{
              padding: '36px 20px',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 14,
              border: '1px dashed rgba(255, 255, 255, 0.15)'
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--coral, #FF6B6B)', marginBottom: 8 }}>
                {t('Food not found in dataset.')}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', maxWidth: 460, margin: '0 auto', lineHeight: 1.5 }}>
                {t('Never fabricated: IRONX displays only verified laboratory food records (ICMR-NIN 2017 & USDA SR Legacy). Please verify spelling or try standard staples such as chapati, rice, egg, chicken, dal, dosa, apple, or milk.')}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 12 }}>
              {verifiedFoodsList.map(food => (
                <div
                  key={food.food_id || food.id}
                  className="card"
                  style={{
                    padding: '14px 16px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>{food.food_name || food.name}</div>
                        {food.food_name_tamil && (
                          <div style={{ fontSize: 12, color: 'var(--theme-accent, #F5F5F5)', fontWeight: 600 }}>{food.food_name_tamil}</div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 10,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: food.food_state === 'cooked' ? 'var(--borders, #303036)' : 'rgba(46, 196, 182, 0.2)',
                        color: food.food_state === 'cooked' ? 'var(--theme-accent, #F5F5F5)' : 'var(--teal, #2EC4B6)',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        {food.food_state || 'raw'}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                      {food.category} · {food.source_name || 'ICMR-NIN 2017'}
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--theme-accent, #F5F5F5)', fontWeight: 600, marginBottom: 10 }}>
                      Reference: {food.edible_portion_basis || '100g edible portion'}
                    </div>

                    {/* Nutrients Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, background: 'rgba(0,0,0,0.3)', padding: '8px 6px', borderRadius: 8, textAlign: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{t('Energy')}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>{food.energy_kcal} <span style={{ fontSize: 8 }}>kcal</span></div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--theme-accent, #F5F5F5)' }}>{t('Protein')}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>{food.protein_g}g</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--teal, #2EC4B6)' }}>{t('Carbs')}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>{food.carb_g}g</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--coral, #FF6B6B)' }}>{t('Fat')}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>{food.fat_g}g</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>{t('Fiber')}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>{food.fibre_g || 0}g</div>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="tinted"
                    size="sm"
                    onClick={() => {
                      setLoggingFoodItem(food)
                      setLogQty(food.serving_size_g ? String(food.serving_size_g) : '100')
                      setLogUnit(food.serving_unit || 'g')
                    }}
                    style={{ width: '100%', borderRadius: 8, fontWeight: 700, fontSize: 12 }}
                  >
                    + Log to Meal
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Quick Food Log Dialog */}
          {loggingFoodItem && (
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
                background: '#1A1A1E',
                border: '1px solid var(--borders, #303036)',
                borderRadius: 16,
                padding: '20px 24px',
                maxWidth: 420,
                width: '100%'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>
                    Log to Today's Meal
                  </h3>
                  <button className="iconbtn" onClick={() => setLoggingFoodItem(null)}><Icon name="xmark" /></button>
                </div>

                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-accent, #F5F5F5)', marginBottom: 2 }}>
                  {loggingFoodItem.food_name || loggingFoodItem.name}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
                  Reference: 100g = {loggingFoodItem.energy_kcal} kcal · {loggingFoodItem.protein_g}g P · {loggingFoodItem.carb_g}g C · {loggingFoodItem.fat_g}g F · {loggingFoodItem.fibre_g || 0}g Fiber
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                    Meal Type
                  </label>
                  <select
                    value={logMealType}
                    onChange={e => setLogMealType(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--input-bg, #242429)', border: '1px solid var(--input-border, #414149)', color: 'var(--input-text, #FFFFFF)', fontSize: 13 }}
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snacks">Snacks</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={logQty}
                      onChange={e => setLogQty(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--input-bg, #242429)', border: '1px solid var(--input-border, #414149)', color: 'var(--input-text, #FFFFFF)', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                      Unit
                    </label>
                    <select
                      value={logUnit}
                      onChange={e => setLogUnit(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--input-bg, #242429)', border: '1px solid var(--input-border, #414149)', color: 'var(--input-text, #FFFFFF)', fontSize: 13 }}
                    >
                      <option value="g">grams (g)</option>
                      <option value="piece">piece</option>
                      <option value="ml">ml</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <Button
                    variant="tinted"
                    onClick={() => setLoggingFoodItem(null)}
                    style={{ flex: 1, padding: '10px', borderRadius: 8 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSaveFoodToLog}
                    disabled={savingLog}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, fontWeight: 700 }}
                  >
                    {savingLog ? 'Saving...' : 'Confirm & Log'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: VERIFIED RECIPES BROWSER */}
      {activeSubTab === 'recipes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '16px 18px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 14 }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--theme-accent, #F5F5F5)' }}><Icon name="flame" /></span>
              {t('Verified Indian & South Indian Recipes (1,014 Dishes)')}
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.45 }}>
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
                style={{ borderRadius: 10, padding: '10px 18px', fontWeight: 700 }}
              >
                {t('Search')}
              </Button>
            </div>
          </div>

          {/* Recipe List */}
          {loadingRecipes ? (
            <div style={{ padding: 36, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
              {t('Loading verified recipes...')}
            </div>
          ) : verifiedRecipesList.length === 0 ? (
            <div style={{
              padding: '36px 20px',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 14,
              border: '1px dashed rgba(255, 255, 255, 0.15)'
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--coral, #FF6B6B)', marginBottom: 6 }}>
                {t('Food not found in dataset.')}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
                {t('No verified recipes found matching "{0}".', recipeQuery)}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 12 }}>
              {verifiedRecipesList.map(rec => (
                <div
                  key={rec.recipe_id}
                  className="card"
                  style={{
                    padding: '14px 16px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 14,
                    cursor: 'pointer'
                  }}
                  onClick={() => handleSelectRecipe(rec)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>{rec.recipe_name}</div>
                      {rec.recipe_name_tamil && (
                        <div style={{ fontSize: 12, color: 'var(--theme-accent, #F5F5F5)', fontWeight: 600 }}>{rec.recipe_name_tamil}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 9999, background: 'var(--borders, #303036)', color: 'var(--theme-accent, #F5F5F5)', fontWeight: 700 }}>
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
                      <div style={{ fontSize: 10, color: 'var(--theme-accent, #F5F5F5)' }}>{t('Protein')}</div>
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

                  <div style={{ fontSize: 11, color: 'var(--theme-accent, #F5F5F5)', textAlign: 'right', fontWeight: 600 }}>
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
                border: '1px solid var(--borders, #303036)',
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
                      <div style={{ fontSize: 13, color: 'var(--theme-accent, #F5F5F5)', fontWeight: 600 }}>{selectedRecipeItem.recipe_name_tamil}</div>
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
                      <div style={{ fontSize: 10, color: 'var(--theme-accent, #F5F5F5)' }}>{t('Protein')}</div>
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
                          <div style={{ color: 'var(--theme-accent, #F5F5F5)', fontWeight: 600 }}>
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
    </div>
  )
}

// Backward-compatible alias
export const AICoachView = FoodDatabaseLookup;
