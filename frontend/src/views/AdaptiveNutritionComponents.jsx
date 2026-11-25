import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

/**
 * Format weight value to 2 decimal places if decimal exists, otherwise 1 decimal
 */
export function fmtWeight(w) {
  if (w == null || isNaN(w)) return '—'
  const num = Number(w)
  return num % 1 === 0 ? num.toFixed(1) : num.toFixed(2)
}

/**
 * Body Weight Tracking Card (Module 6)
 * Displays Current Weight, 7-Day Rolling Average, Weekly Change (Delta W),
 * and quick action to log/edit body weight.
 */
export function BodyWeightCard({ weightStats, onOpenLogModal, t }) {
  const latestWeight = weightStats?.latest?.weight_kg
  const latestDate = weightStats?.latest?.date
  const rolling7Day = weightStats?.rolling_7day_avg
  const weeklyChange = weightStats?.weekly_change
  const weighInCount = weightStats?.count_14d || weightStats?.count || 0

  return (
    <div
      className="card body-weight-card"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--borders)',
        borderRadius: 16,
        padding: '16px 18px',
        marginBottom: 16
      }}
    >
      <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--label-2)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              {t ? t('Body Weight Tracking') : 'Body Weight Tracking'}
            </span>
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--borders)',
                borderRadius: 9999,
                padding: '1px 8px',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--label-2)'
              }}
            >
              {weighInCount} {t ? t('logs in window') : 'logs in window'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--label-3)', marginTop: 2 }}>
            {t ? t('Daily weigh-ins with 7-day smoothed trend') : 'Daily weigh-ins with 7-day smoothed trend'}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLogModal}
          style={{
            background: 'var(--label)',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: 9999,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
          aria-label={t ? t('Log Weight') : 'Log Weight'}
        >
          <Icon name="plus" size={12} />
          <span>{t ? t('Log Weight') : 'Log Weight'}</span>
        </button>
      </div>

      {/* Grid of Key Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))',
          gap: 10
        }}
      >
        {/* Metric 1: Latest Weight */}
        <div
          style={{
            background: 'var(--surface-3)',
            border: '1px solid var(--borders)',
            borderRadius: 12,
            padding: '10px 12px'
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--label-3)', textTransform: 'uppercase' }}>
            {t ? t('Latest') : 'Latest'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {latestWeight != null ? (
              <>
                {fmtWeight(latestWeight)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--label-2)' }}>kg</span>
              </>
            ) : (
              <span style={{ color: 'var(--label-3)' }}>—</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--label-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {latestDate || (t ? t('No log yet') : 'No log yet')}
          </div>
        </div>

        {/* Metric 2: 7-Day Rolling Average */}
        <div
          style={{
            background: 'var(--surface-3)',
            border: '1px solid var(--borders)',
            borderRadius: 12,
            padding: '10px 12px'
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--label-3)', textTransform: 'uppercase' }}>
            {t ? t('7-Day Avg') : '7-Day Avg'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {rolling7Day != null ? (
              <>
                {fmtWeight(rolling7Day)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--label-2)' }}>kg</span>
              </>
            ) : (
              <span style={{ color: 'var(--label-3)' }}>—</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--label-3)', marginTop: 2 }}>
            {t ? t('Smoothed trend') : 'Smoothed trend'}
          </div>
        </div>

        {/* Metric 3: Weekly Delta W */}
        <div
          style={{
            background: 'var(--surface-3)',
            border: '1px solid var(--borders)',
            borderRadius: 12,
            padding: '10px 12px'
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--label-3)', textTransform: 'uppercase' }}>
            {t ? t('Weekly Change') : 'Weekly Change'}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
              color: weeklyChange != null && weeklyChange !== 0
                ? (weeklyChange < 0 ? 'var(--mint)' : '#F59E0B')
                : 'var(--label-2)'
            }}
          >
            {weeklyChange != null ? (
              <>
                {weeklyChange > 0 ? `+${fmtWeight(weeklyChange)}` : fmtWeight(weeklyChange)}{' '}
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--label-2)' }}>kg</span>
              </>
            ) : (
              <span style={{ color: 'var(--label-3)' }}>—</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--label-3)', marginTop: 2 }}>
            {t ? t('vs previous wk') : 'vs previous wk'}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Log Body Weight Modal
 * Supports decimal body weights (e.g., 78.45 kg), date selection, notes,
 * and shows recent weigh-in logs with delete option.
 */
export function LogWeightModal({
  defaultDate,
  currentWeight,
  weightLogs = [],
  onSaveWeight,
  onDeleteWeight,
  close,
  toast,
  t
}) {
  const [date, setDate] = useState(defaultDate || new Date().toISOString().slice(0, 10))
  const [weight, setWeight] = useState(currentWeight != null ? String(currentWeight) : '')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e?.preventDefault()
    const num = parseFloat(weight)
    if (isNaN(num) || num < 20 || num > 400) {
      if (toast) toast(t ? t('Please enter a valid weight between 20 and 400 kg.') : 'Please enter a valid weight between 20 and 400 kg.')
      return
    }

    setSaving(true)
    try {
      await onSaveWeight({
        date,
        weight_kg: Math.round(num * 100) / 100,
        notes: notes.trim()
      })
      if (toast) toast(t ? t('Weight of {0} kg logged successfully.', fmtWeight(num)) : `Weight of ${fmtWeight(num)} kg logged successfully.`)
      close()
    } catch (err) {
      if (toast) toast(err.message || 'Error saving weight log')
    } finally {
      setSaving(false)
    }
  }

  const handlePreset = (delta) => {
    const cur = parseFloat(weight) || 75.0
    const next = Math.round((cur + delta) * 100) / 100
    setWeight(String(next))
  }

  return (
    <div style={{ padding: '4px 0 24px 0', maxWidth: 480, margin: '0 auto' }}>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--label)' }}>
            {t ? t('Log Body Weight') : 'Log Body Weight'}
          </h3>
          <div style={{ fontSize: 12, color: 'var(--label-2)' }}>
            {t ? t('Decimal precision supported (e.g. 78.45 kg)') : 'Decimal precision supported (e.g. 78.45 kg)'}
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          style={{
            background: 'var(--surface-3)',
            border: 'none',
            borderRadius: 9999,
            width: 32,
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--label)',
            cursor: 'pointer'
          }}
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Date Selector */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label-2)', marginBottom: 6, textTransform: 'uppercase' }}>
            {t ? t('Date') : 'Date'}
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              width: '100%',
              background: '#242429',
              color: '#FFFFFF',
              border: '1px solid #38383F',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 14,
              fontWeight: 600
            }}
          />
        </div>

        {/* Weight Input (Decimals supported) */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label-2)', marginBottom: 6, textTransform: 'uppercase' }}>
            {t ? t('Body Weight (kg)') : 'Body Weight (kg)'}
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="number"
              step="0.05"
              min="20"
              max="400"
              placeholder="e.g. 78.45"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                background: '#242429',
                color: '#FFFFFF',
                border: '1px solid #38383F',
                borderRadius: 10,
                padding: '12px 48px 12px 14px',
                fontSize: 20,
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums'
              }}
            />
            <span
              style={{
                position: 'absolute',
                right: 14,
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--label-2)'
              }}
            >
              kg
            </span>
          </div>

          {/* Quick Adjustment Presets */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {[-1.0, -0.5, -0.1, +0.1, +0.5, +1.0].map(delta => (
              <button
                key={delta}
                type="button"
                onClick={() => handlePreset(delta)}
                style={{
                  background: 'var(--surface-3)',
                  border: '1px solid var(--borders)',
                  borderRadius: 9999,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--label-2)',
                  cursor: 'pointer'
                }}
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>

        {/* Notes Input */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label-2)', marginBottom: 6, textTransform: 'uppercase' }}>
            {t ? t('Notes (Optional)') : 'Notes (Optional)'}
          </label>
          <input
            type="text"
            placeholder={t ? t('e.g. Morning fasted, post-workout') : 'e.g. Morning fasted, post-workout'}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{
              width: '100%',
              background: '#242429',
              color: '#FFFFFF',
              border: '1px solid #38383F',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 500
            }}
          />
        </div>

        {/* Submit & Cancel */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || !weight}
            style={{ flex: 1, padding: '12px' }}
          >
            {saving ? (t ? t('Saving...') : 'Saving...') : (t ? t('Save Weight Entry') : 'Save Weight Entry')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={close}
            disabled={saving}
            style={{ padding: '12px 18px' }}
          >
            {t ? t('Cancel') : 'Cancel'}
          </Button>
        </div>
      </form>

      {/* Recent History Table */}
      {weightLogs.length > 0 && (
        <div style={{ marginTop: 24, borderTop: '1px solid var(--borders)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-2)', textTransform: 'uppercase', marginBottom: 10 }}>
            {t ? t('Recent Weigh-ins') : 'Recent Weigh-ins'}
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {weightLogs.slice(0, 10).map(log => (
              <div
                key={log.id || log.date}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--borders)',
                  borderRadius: 10,
                  padding: '8px 12px'
                }}
              >
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)', marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtWeight(log.weight_kg)} kg
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--label-3)' }}>
                    {log.date}
                  </span>
                  {log.notes && (
                    <span style={{ fontSize: 11, color: 'var(--label-2)', marginLeft: 8, fontStyle: 'italic' }}>
                      — {log.notes}
                    </span>
                  )}
                </div>

                {onDeleteWeight && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm(t ? t('Delete weight log for {0}?', log.date) : `Delete weight log for ${log.date}?`)) {
                        await onDeleteWeight(log.id, log.date)
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--label-3)',
                      cursor: 'pointer',
                      padding: 4
                    }}
                    title={t ? t('Delete log') : 'Delete log'}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Weekly Nutrition Review & Adaptive Intelligence Card (Modules 7, 8, 9)
 * Highlights metabolic status, adherence, and deterministic calorie adjustment.
 */
export function WeeklyNutritionReviewCard({
  review,
  canonicalGoals,
  onApplyAdjustment,
  onOpenGoals,
  t
}) {
  const [applying, setApplying] = useState(false)

  if (!review) return null

  const status = review.status || 'gathering_data'
  const isActionable = review.is_actionable && review.calorie_adjustment !== 0
  const recommendedCal = review.recommended_calorie_target
  const currentCal = review.current_calorie_target || canonicalGoals?.calorie_target || 2000
  const adj = review.calorie_adjustment || 0

  // Status Badge Colors & Labels
  const badgeConfig = {
    on_track: { label: t ? t('On Track') : 'On Track', color: 'var(--mint)', bg: 'rgba(16, 185, 129, 0.12)' },
    plateau: { label: t ? t('Metabolic Plateau') : 'Metabolic Plateau', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
    rapid_loss: { label: t ? t('Rapid Weight Loss') : 'Rapid Weight Loss', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.12)' },
    surplus_stalled: { label: t ? t('Surplus Stalled') : 'Surplus Stalled', color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.12)' },
    surplus_excessive: { label: t ? t('Rapid Weight Gain') : 'Rapid Weight Gain', color: '#F87171', bg: 'rgba(248, 113, 113, 0.12)' },
    gathering_data: { label: t ? t('Data Gathering Phase') : 'Data Gathering Phase', color: 'var(--label-2)', bg: 'rgba(255, 255, 255, 0.08)' }
  }[status] || { label: review.status_label || status, color: 'var(--label-2)', bg: 'rgba(255, 255, 255, 0.08)' }

  const handleApply = async () => {
    setApplying(true)
    try {
      await onApplyAdjustment(review.id)
    } finally {
      setApplying(false)
    }
  }

  const metrics = review.metrics || {}

  return (
    <div
      className="card weekly-review-card"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--borders)',
        borderRadius: 16,
        padding: '16px 18px',
        marginBottom: 16
      }}
    >
      <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--label-2)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              {t ? t('Adaptive Nutrition Review') : 'Adaptive Nutrition Review'}
            </span>
            <span
              style={{
                background: badgeConfig.bg,
                color: badgeConfig.color,
                border: `1px solid ${badgeConfig.color}40`,
                borderRadius: 9999,
                padding: '2px 9px',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase'
              }}
            >
              {badgeConfig.label}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--label-3)', marginTop: 2 }}>
            {t ? t('14-day rolling metabolic analysis') : '14-day rolling metabolic analysis'}
          </div>
        </div>

        {onOpenGoals && (
          <button
            type="button"
            onClick={onOpenGoals}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--borders)',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--label-2)',
              cursor: 'pointer'
            }}
          >
            {t ? t('Goals') : 'Goals'}
          </button>
        )}
      </div>

      {/* Explanation Box */}
      <div
        style={{
          background: 'var(--surface-3)',
          border: '1px solid var(--borders)',
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 12,
          fontSize: 12,
          color: 'var(--label-2)',
          lineHeight: 1.5
        }}
      >
        {review.explanation}
      </div>

      {/* Metrics Summary Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))',
          gap: 8,
          marginBottom: 12
        }}
      >
        <div style={{ background: 'var(--surface-3)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--label-3)', textTransform: 'uppercase' }}>{t ? t('Avg Consumed') : 'Avg Consumed'}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', marginTop: 2 }}>
            {metrics.avg_calories_consumed ? `${metrics.avg_calories_consumed} kcal` : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--label-3)' }}>
            {metrics.calorie_adherence_pct ? `${metrics.calorie_adherence_pct}% adherence` : '—'}
          </div>
        </div>

        <div style={{ background: 'var(--surface-3)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--label-3)', textTransform: 'uppercase' }}>{t ? t('Avg Protein') : 'Avg Protein'}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', marginTop: 2 }}>
            {metrics.avg_protein_g ? `${metrics.avg_protein_g} g` : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--label-3)' }}>
            {metrics.protein_adherence_pct ? `${metrics.protein_adherence_pct}% of goal` : '—'}
          </div>
        </div>

        <div style={{ background: 'var(--surface-3)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--label-3)', textTransform: 'uppercase' }}>{t ? t('Weight Trend') : 'Weight Trend'}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', marginTop: 2 }}>
            {metrics.weight_change_kg != null ? (
              <span style={{ color: metrics.weight_change_kg < 0 ? 'var(--mint)' : '#F59E0B' }}>
                {metrics.weight_change_kg > 0 ? `+${fmtWeight(metrics.weight_change_kg)}` : fmtWeight(metrics.weight_change_kg)} kg
              </span>
            ) : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--label-3)' }}>
            {metrics.weigh_in_count || 0} weigh-ins
          </div>
        </div>

        <div style={{ background: 'var(--surface-3)', borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--label-3)', textTransform: 'uppercase' }}>{t ? t('Workouts') : 'Workouts'}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', marginTop: 2 }}>
            {(metrics.strength_workouts_count || 0) + (metrics.cardio_sessions_count || 0)} sessions
          </div>
          <div style={{ fontSize: 10, color: 'var(--label-3)' }}>
            {metrics.strength_workouts_count || 0} str • {metrics.cardio_sessions_count || 0} cardio
          </div>
        </div>
      </div>

      {/* Actionable Calorie Adjustment Banner */}
      {isActionable && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--surface-3) 90%, #F59E0B 10%)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <div className="row between" style={{ alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase' }}>
                {t ? t('Recommended Calorie Adjustment') : 'Recommended Calorie Adjustment'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--label)', marginTop: 2 }}>
                {currentCal.toLocaleString()} kcal{' '}
                <span style={{ color: 'var(--label-3)' }}>→</span>{' '}
                <span style={{ color: '#F59E0B' }}>{recommendedCal.toLocaleString()} kcal</span>{' '}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)' }}>
                  ({adj > 0 ? `+${adj}` : adj} kcal)
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              disabled={applying}
              onClick={handleApply}
              style={{
                background: '#F59E0B',
                color: '#000000',
                fontWeight: 700,
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px'
              }}
            >
              {applying ? (t ? t('Applying...') : 'Applying...') : (t ? t('Apply Adjustment') : 'Apply Adjustment')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
