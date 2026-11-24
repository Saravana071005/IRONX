import React, { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { todayISO, fmtNum } from '../lib/format.js'
import Icon from './Icon.jsx'

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: 'sun' },
  { id: 'lunch', label: 'Lunch', icon: 'sun' },
  { id: 'snacks', label: 'Snacks', icon: 'apple' },
  { id: 'dinner', label: 'Dinner', icon: 'moon' }
]

export default function HomeMealTracker({ date = todayISO(), onNavigateNutrition }) {
  const [mealStatuses, setMealStatuses] = useState({
    breakfast: 'not_done',
    lunch: 'not_done',
    snacks: 'not_done',
    dinner: 'not_done'
  })
  const [consumedCalories, setConsumedCalories] = useState(0)
  const [targetCalories, setTargetCalories] = useState(2000)
  const [loading, setLoading] = useState(false)

  const loadMealData = async () => {
    try {
      const res = await api(`/api/nutrition/daily-plan?date=${date}`)
      if (res?.ok) {
        const statuses = {
          breakfast: 'not_done',
          lunch: 'not_done',
          snacks: 'not_done',
          dinner: 'not_done'
        }

        if (Array.isArray(res.dailyPlan)) {
          res.dailyPlan.forEach(p => {
            if (p.meal_type && statuses[p.meal_type] !== undefined) {
              statuses[p.meal_type] = p.status || 'not_done'
            }
          })
        }
        setMealStatuses(statuses)

        if (res.comparison?.consumed?.calories !== undefined) {
          setConsumedCalories(Math.round(res.comparison.consumed.calories))
        } else if (Array.isArray(res.actualConsumed)) {
          const totalCals = res.actualConsumed.reduce((acc, c) => acc + (Number(c.calories) || 0), 0)
          setConsumedCalories(Math.round(totalCals))
        }

        if (res.comparison?.goals?.calories) {
          setTargetCalories(Math.round(res.comparison.goals.calories))
        }
      }
    } catch (err) {
      console.warn('Home meal tracker error:', err)
    }
  }

  useEffect(() => {
    loadMealData()
  }, [date])

  const handleToggleMeal = async (mealId) => {
    const curStatus = mealStatuses[mealId] || 'not_done'
    const newStatus = curStatus === 'completed' ? 'not_done' : 'completed'

    // Optimistic UI update
    setMealStatuses(prev => ({
      ...prev,
      [mealId]: newStatus
    }))

    try {
      await api('/api/nutrition/daily-plan/toggle-status', {
        method: 'POST',
        body: JSON.stringify({
          date,
          mealType: mealId,
          status: newStatus
        })
      })
      // Refresh to update exact consumed kcal
      loadMealData()
    } catch (err) {
      console.warn('Toggle meal status error:', err)
    }
  }

  const pct = Math.min(100, Math.round((consumedCalories / (targetCalories || 2000)) * 100))

  return (
    <div
      className="card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--borders)',
        borderRadius: 16,
        padding: '16px',
        color: 'var(--label)'
      }}
    >
      {/* Header */}
      <div className="row between" style={{ alignItems: 'center', marginBottom: 14 }}>
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--borders)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label)' }}>
            <Icon name="apple" size={17} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--label)', letterSpacing: '-0.02em' }}>
              {t("Today's Meal Tracker")}
            </h3>
            <div style={{ fontSize: 11, color: 'var(--label-2)', marginTop: 1 }}>
              {t('4 daily meals adherence')}
            </div>
          </div>
        </div>

        {onNavigateNutrition && (
          <button
            onClick={onNavigateNutrition}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--label-2)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span>{t('Health Logs')}</span>
            <Icon name="chevronRight" size={12} />
          </button>
        )}
      </div>

      {/* 4 Strict Meal Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {MEAL_TYPES.map(meal => {
          const isDone = mealStatuses[meal.id] === 'completed'

          return (
            <div
              key={meal.id}
              onClick={() => handleToggleMeal(meal.id)}
              role="button"
              tabIndex={0}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 12,
                background: isDone ? 'var(--surface-3)' : 'var(--surface-2)',
                border: isDone ? '1px solid var(--label)' : '1px solid var(--borders)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Left: Icon & Label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: isDone ? 'var(--label)' : 'var(--label-3)', display: 'flex', alignItems: 'center' }}>
                  <Icon name={meal.icon} size={16} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: isDone ? 'var(--label)' : 'var(--label-2)' }}>
                  {t(meal.label)}
                </span>
              </div>

              {/* Right: Done/Not Done status & Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 9999,
                    background: isDone ? 'var(--label)' : 'var(--surface-2)',
                    color: isDone ? 'var(--bg)' : 'var(--label-2)',
                    border: '1px solid var(--borders)'
                  }}
                >
                  {isDone ? `✓ ${t('Done')}` : `✕ ${t('Not Done')}`}
                </span>

                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    border: isDone ? '1.5px solid var(--label)' : '1.5px solid var(--label-3)',
                    background: isDone ? 'var(--label)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--bg)',
                    fontSize: 12,
                    fontWeight: 900
                  }}
                >
                  {isDone && '✓'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Consumed Calories vs Goal */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--borders)', borderRadius: 12, padding: '10px 14px' }}>
        <div className="row between" style={{ alignItems: 'baseline', marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-2)' }}>
            {t('Consumed')}: <strong style={{ color: 'var(--label)', fontSize: 14 }}>{fmtNum(consumedCalories)} kcal</strong>
            <span style={{ color: 'var(--label-3)', fontSize: 12 }}> / {fmtNum(targetCalories)} kcal</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label)' }}>
            {pct}%
          </span>
        </div>

        {/* Monochrome Bar */}
        <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 9999, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'var(--label)',
              borderRadius: 9999,
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      </div>
    </div>
  )
}
