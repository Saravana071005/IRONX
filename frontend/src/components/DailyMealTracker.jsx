import React, { useState, useEffect, useMemo } from 'react'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import { api } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'

const MEAL_CONFIG = [
  { id: 'breakfast', label: 'Breakfast', icon: 'sun', color: '#F59E0B' },
  { id: 'lunch', label: 'Lunch', icon: 'sun', color: '#EAB308' },
  { id: 'snacks', label: 'Snacks', icon: 'apple', color: '#10B981' },
  { id: 'dinner', label: 'Dinner', icon: 'moon', color: '#6366F1' }
]

export default function DailyMealTracker({
  date = todayISO(),
  onOpenAddPdf,
  onOpenGoals,
  onOpenCheatMeal,
  onOpenAvailableFoods,
  onMealStatusChanged,
  toast
}) {
  const [loading, setLoading] = useState(false)
  const [dailyPlan, setDailyPlan] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [actualConsumed, setActualConsumed] = useState([])
  const [activePlanName, setActivePlanName] = useState('')

  // Load today's planned and actual meals
  const loadDailyData = async () => {
    setLoading(true)
    try {
      const res = await api(`/api/nutrition/daily-plan?date=${date}`)
      if (res?.ok) {
        setDailyPlan(res.dailyPlan)
        setComparison(res.comparison)
        setActualConsumed(res.actualConsumed || [])
      }

      // Check active plan name
      const plansRes = await api('/api/nutrition/plans')
      if (plansRes?.ok && Array.isArray(plansRes.plans)) {
        const active = plansRes.plans.find(p => p.is_active)
        if (active) setActivePlanName(active.name)
      }
    } catch (err) {
      console.warn('Daily meal tracker load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDailyData()
  }, [date])

  // Toggle meal status (Not Done -> Completed -> Not Done)
  const handleToggleStatus = async (mealType, currentStatus) => {
    const nextStatus = currentStatus === 'completed' ? 'not_done' : 'completed'
    try {
      const res = await api('/api/nutrition/daily-plan/toggle-status', {
        method: 'POST',
        body: { date, meal_type: mealType, status: nextStatus }
      })

      if (res?.ok) {
        if (toast) {
          toast(
            nextStatus === 'completed'
              ? `${mealType.toUpperCase()} marked as Completed!`
              : `${mealType.toUpperCase()} marked as Not Done`,
            'success'
          )
        }
        await loadDailyData()
        if (onMealStatusChanged) onMealStatusChanged()
      }
    } catch (err) {
      if (toast) toast('Status update error: ' + err.message, 'error')
    }
  }

  // Remove individual food item from today's plan ONLY
  const handleRemoveItemForToday = async (mealType, itemId, foodName) => {
    try {
      const res = await api('/api/nutrition/daily-plan/update-item', {
        method: 'POST',
        body: {
          date,
          meal_type: mealType,
          item_id: itemId,
          updates: { remove: true }
        }
      })

      if (res?.ok) {
        if (toast) toast(`Removed ${foodName || 'item'} for today only. Original template is unchanged.`, 'info')
        await loadDailyData()
        if (onMealStatusChanged) onMealStatusChanged()
      }
    } catch (err) {
      if (toast) toast(err.message, 'error')
    }
  }

  const meals = dailyPlan?.meals || {}
  const statusMap = dailyPlan?.status || {}

  // Calculate planned vs actual totals for each meal card
  const mealCardMetrics = useMemo(() => {
    const metrics = {}

    MEAL_CONFIG.forEach(mt => {
      const plannedItems = (meals[mt.id] || []).filter(item => !item.removed)
      let plannedCal = 0, plannedP = 0, plannedC = 0, plannedF = 0, plannedFib = 0

      plannedItems.forEach(item => {
        plannedCal += Number(item.energy_kcal) || 0
        plannedP += Number(item.protein_g) || 0
        plannedC += Number(item.carb_g) || 0
        plannedF += Number(item.fat_g) || 0
        plannedFib += Number(item.fibre_g) || 0
      })

      // Actual consumed for this meal type
      const consumedItems = actualConsumed.filter(c => String(c.meal_type || '').toLowerCase() === mt.id)
      let consumedCal = 0, consumedP = 0, consumedC = 0, consumedF = 0, consumedFib = 0

      consumedItems.forEach(c => {
        consumedCal += Number(c.energy_kcal || c.calories) || 0
        consumedP += Number(c.protein_g || c.protein) || 0
        consumedC += Number(c.carb_g || c.carb || c.carbs) || 0
        consumedF += Number(c.fat_g || c.fat) || 0
        consumedFib += Number(c.fibre_g || c.fibre) || 0
      })

      metrics[mt.id] = {
        plannedItems,
        planned: {
          calories: Math.round(plannedCal),
          protein: Math.round(plannedP * 10) / 10,
          carbs: Math.round(plannedC * 10) / 10,
          fat: Math.round(plannedF * 10) / 10,
          fiber: Math.round(plannedFib * 10) / 10
        },
        consumed: {
          calories: Math.round(consumedCal),
          protein: Math.round(consumedP * 10) / 10,
          carbs: Math.round(consumedC * 10) / 10,
          fat: Math.round(consumedF * 10) / 10,
          fiber: Math.round(consumedFib * 10) / 10
        },
        status: statusMap[mt.id] || 'not_done'
      }
    })

    return metrics
  }, [meals, statusMap, actualConsumed])

  // Overall day metrics
  const dayGoals = comparison?.goals || { calories: 2000, protein: 140, carbs: 220, fat: 60, fiber: 28 }
  const dayPlanned = comparison?.planned || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  const dayConsumed = comparison?.consumed || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  const dayRemaining = comparison?.remaining || {
    calories: Math.max(0, dayGoals.calories - dayConsumed.calories),
    protein: Math.max(0, dayGoals.protein - dayConsumed.protein),
    carbs: Math.max(0, dayGoals.carbs - dayConsumed.carbs),
    fat: Math.max(0, dayGoals.fat - dayConsumed.fat),
    fiber: Math.max(0, dayGoals.fiber - dayConsumed.fiber)
  }

  const completedMealsCount = Object.values(statusMap).filter(s => s === 'completed').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tracker Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--label)' }}>
              {t("Today's Meal Tracker")}
            </h3>
            {activePlanName && (
              <span style={{
                background: 'rgba(0, 229, 255, 0.12)',
                color: '#00E5FF',
                border: '1px solid rgba(0, 229, 255, 0.25)',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 9999
              }}>
                📋 {activePlanName}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--secondary-label)', marginTop: 2 }}>
            {completedMealsCount} of 4 meals completed • Planned vs consumed tracked separately
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onOpenAddPdf && (
            <button
              type="button"
              className="btn small"
              onClick={onOpenAddPdf}
              style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Icon name="upload" />
              {t('Import PDF')}
            </button>
          )}
          {onOpenCheatMeal && (
            <button
              type="button"
              className="btn small"
              onClick={onOpenCheatMeal}
              style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: '#EAB308' }}
            >
              ★ {t('Cheat Meal')}
            </button>
          )}
          {onOpenAvailableFoods && (
            <button
              type="button"
              className="btn small"
              onClick={onOpenAvailableFoods}
              style={{ fontSize: 11 }}
            >
              🥫 {t('Pantry Foods')}
            </button>
          )}
        </div>
      </div>

      {/* Progress & Remaining Calorie Bar */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        padding: '14px 16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontSize: 12, color: 'var(--secondary-label)' }}>{t('Consumed')}: </span>
            <strong style={{ fontSize: 16, color: '#00E5FF' }}>{dayConsumed.calories} kcal</strong>
            <span style={{ fontSize: 12, color: 'var(--secondary-label)' }}> / {dayGoals.calories} kcal</span>
          </div>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--secondary-label)' }}>{t('Remaining Balance')}: </span>
            <strong style={{ color: dayRemaining.calories > 0 ? '#10B981' : '#F59E0B', fontSize: 14 }}>
              {dayRemaining.calories} kcal
            </strong>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div style={{
          height: 8,
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: 9999,
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, (dayConsumed.calories / (dayGoals.calories || 2000)) * 100)}%`,
            background: dayConsumed.calories > dayGoals.calories ? '#F59E0B' : 'linear-gradient(90deg, #00E5FF, #3B82F6)',
            borderRadius: 9999,
            transition: 'width 0.3s'
          }} />
        </div>

        {/* Macro breakdown */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--secondary-label)' }}>
          <span>Protein: <strong style={{ color: '#F59E0B' }}>{dayConsumed.protein}g</strong> / {dayGoals.protein}g</span>
          <span>Carbs: <strong style={{ color: '#EAB308' }}>{dayConsumed.carbs}g</strong> / {dayGoals.carbs}g</span>
          <span>Fat: <strong style={{ color: '#6366F1' }}>{dayConsumed.fat}g</strong> / {dayGoals.fat}g</span>
          <span>Fiber: <strong style={{ color: '#10B981' }}>{dayConsumed.fiber}g</strong> / {dayGoals.fiber}g</span>
        </div>
      </div>

      {/* 4 MEAL CARDS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {MEAL_CONFIG.map(mt => {
          const m = mealCardMetrics[mt.id] || {
            plannedItems: [],
            planned: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
            consumed: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
            status: 'not_done'
          }

          const isCompleted = m.status === 'completed'
          const isPartially = m.status === 'partially_completed'

          return (
            <div key={mt.id} style={{
              background: isCompleted ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)',
              border: isCompleted
                ? '1px solid rgba(16, 185, 129, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative'
            }}>
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: mt.color
                    }} />
                    <strong style={{ fontSize: 15, color: 'var(--label)' }}>
                      {t(mt.label)}
                    </strong>
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    background: isCompleted
                      ? 'rgba(16, 185, 129, 0.2)'
                      : isPartially
                      ? 'rgba(234, 179, 8, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: isCompleted
                      ? '#10B981'
                      : isPartially
                      ? '#EAB308'
                      : 'var(--secondary-label)',
                    border: isCompleted
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : isPartially
                      ? '1px solid rgba(234, 179, 8, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    {isCompleted ? t('Completed') : isPartially ? t('Partially Completed') : t('Not Done')}
                  </span>
                </div>

                {/* Planned Foods List */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--secondary-label)', marginBottom: 6 }}>
                    {t('Planned Foods')}:
                  </div>
                  {m.plannedItems.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--secondary-label)', fontStyle: 'italic', padding: '4px 0' }}>
                      {t('No planned foods for this meal')}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {m.plannedItems.map(item => (
                        <div key={item.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 12,
                          background: 'rgba(0, 0, 0, 0.2)',
                          padding: '6px 8px',
                          borderRadius: 6
                        }}>
                          <span style={{ color: 'var(--label)' }}>
                            • {item.serving_quantity} {item.serving_unit} {item.food_name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#00E5FF' }}>
                              {item.energy_kcal || 0} kcal
                            </span>
                            {/* Remove individual food for today only */}
                            {!isCompleted && (
                              <button
                                type="button"
                                title="Don't consume today"
                                onClick={() => handleRemoveItemForToday(mt.id, item.id, item.food_name)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#EF4444',
                                  cursor: 'pointer',
                                  padding: '0 2px',
                                  fontSize: 12
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Macro metrics table for this meal */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  marginBottom: 12,
                  fontSize: 11
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--secondary-label)', marginBottom: 4 }}>
                    <span>{t('Planned')}:</span>
                    <strong>{m.planned.calories} kcal (P: {m.planned.protein}g • C: {m.planned.carbs}g • F: {m.planned.fat}g)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: isCompleted ? '#10B981' : 'var(--secondary-label)' }}>
                    <span>{t('Actual Consumed')}:</span>
                    <strong>{m.consumed.calories} kcal (P: {m.consumed.protein}g • C: {m.consumed.carbs}g • F: {m.consumed.fat}g)</strong>
                  </div>
                </div>
              </div>

              {/* Bottom Action: Done / Mark Complete Checkbox */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <button
                  type="button"
                  className={`btn small ${isCompleted ? 'secondary' : 'primary'}`}
                  onClick={() => handleToggleStatus(mt.id, m.status)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    width: '100%',
                    justifyContent: 'center',
                    padding: '8px'
                  }}
                >
                  <Icon name={isCompleted ? 'check' : 'plus'} />
                  {isCompleted ? t('Mark as Not Done') : t('Mark as Done')}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODULE 5: RECOMMENDATION CARD */}
      {comparison?.recommendation && (
        <div style={{
          background: comparison.recommendation.is_sufficient ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)',
          border: comparison.recommendation.is_sufficient ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 14,
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18 }}>
              {comparison.recommendation.is_sufficient ? '✅' : '💡'}
            </span>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>
                {comparison.recommendation.is_sufficient ? t('Meal Plan on Track') : t('Smart Nutrition Additions')}
              </h4>
              <p style={{ margin: '4px 0 10px 0', fontSize: 12, lineHeight: 1.5, color: 'var(--label)' }}>
                {comparison.recommendation.message}
              </p>

              {/* Affordable Suggestions List if Insufficient */}
              {!comparison.recommendation.is_sufficient && comparison.recommendation.suggestions?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  {comparison.recommendation.suggestions.map((s, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      border: s.is_in_user_pantry ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 12, color: 'var(--label)' }}>{s.name}</strong>
                        {s.is_in_user_pantry && (
                          <span style={{ fontSize: 9, background: 'rgba(0, 229, 255, 0.2)', color: '#00E5FF', padding: '1px 5px', borderRadius: 4 }}>
                            🥫 In Pantry
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#00E5FF', margin: '3px 0' }}>
                        {s.calories} kcal • {s.protein}g Protein ({s.default_serving})
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--secondary-label)' }}>
                        {s.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
