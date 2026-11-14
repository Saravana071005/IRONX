import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import { todayISO, uid } from '../lib/format.js'
import { CARDIO_ACTIVITIES, calculateCardioMetrics } from '../lib/customPlanner.js'
import { api } from '../lib/api.js'

export default function CardioModal({ initialEntry = null, defaultDate = null, onClose, onSaved }) {
  const update = useStore(s => s.update)
  const logCardio = useStore(s => s.logCardio)
  const deleteCardio = useStore(s => s.deleteCardio)
  const { toast, confirmSheet } = useUI()

  const [activity, setActivity] = useState(initialEntry?.activity || 'Walking')
  const [hours, setHours] = useState(
    initialEntry?.durationHours != null
      ? String(initialEntry.durationHours)
      : initialEntry?.totalDurationMinutes
        ? String(Math.floor(initialEntry.totalDurationMinutes / 60))
        : '0'
  )
  const [minutes, setMinutes] = useState(
    initialEntry?.durationMinutes != null
      ? String(initialEntry.durationMinutes)
      : initialEntry?.totalDurationMinutes
        ? String(initialEntry.totalDurationMinutes % 60)
        : '30'
  )
  const [distance, setDistance] = useState(
    initialEntry?.distanceKm != null ? String(initialEntry.distanceKm) : ''
  )
  const [date, setDate] = useState(initialEntry?.d || defaultDate || todayISO())
  const [error, setError] = useState('')

  const metrics = calculateCardioMetrics(hours, minutes, distance)

  const handleSave = () => {
    if (metrics.totalDurationMinutes <= 0 && metrics.distanceKm <= 0) {
      setError(t('Please enter a valid duration or distance'))
      return
    }

    const entry = {
      id: initialEntry?.id || 'cardio_' + uid(),
      d: date,
      activity,
      durationHours: metrics.hours,
      durationMinutes: metrics.minutes,
      totalDurationMinutes: metrics.totalDurationMinutes,
      distanceKm: metrics.distanceKm,
      createdAt: initialEntry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save to local store
    logCardio(entry)

    // Sync to backend cardio log table and MongoDB Atlas
    api('/api/nutrition/cardio/save', {
      method: 'POST',
      body: JSON.stringify({
        id: entry.id,
        date: entry.d,
        activity_type: entry.activity,
        duration_min: entry.totalDurationMinutes,
        distance_km: entry.distanceKm,
        steps: null,
        calories_burned: null
      })
    }).catch(() => {})

    toast(initialEntry ? t('Cardio activity updated') : t('Cardio activity logged'))
    if (onSaved) onSaved(entry)
    if (onClose) onClose()
  }

  const handleDelete = () => {
    if (!initialEntry?.id) return
    confirmSheet({
      title: t('Delete cardio activity?'),
      message: t('This cardio entry will be permanently removed from your history.'),
      confirmText: t('Delete'),
      danger: true,
      onConfirm: () => {
        deleteCardio(initialEntry.id)
        api('/api/nutrition/cardio/delete', {
          method: 'POST',
          body: JSON.stringify({ id: initialEntry.id })
        }).catch(() => {})
        toast(t('Cardio activity deleted'))
        if (onClose) onClose()
      }
    })
  }

  return (
    <div className="cardio-entry-sheet" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left' }}>
      {/* Header */}
      <div className="row between" style={{ marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            className="lrow-i"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'var(--mint-light)',
              color: 'var(--mint)',
              fontSize: 20
            }}
          >
            <Icon name="figureRun" />
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {initialEntry ? t('Edit Cardio Activity') : t('Log Cardio Activity')}
            </h3>
            <div className="muted small" style={{ fontSize: 12 }}>
              {t('Walking, Running, or Jogging')}
            </div>
          </div>
        </div>
        {onClose && (
          <button className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="xmark" />
          </button>
        )}
      </div>

      {/* Activity Selection Chips */}
      <div style={{ marginBottom: 16 }}>
        <label className="lbl2" style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600 }}>
          {t('Activity')}
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {CARDIO_ACTIVITIES.map(act => {
            const isSelected = activity === act
            return (
              <button
                key={act}
                type="button"
                className={`btn ${isSelected ? 'primary' : 'ghost'}`}
                style={{
                  height: 48,
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  fontWeight: 600,
                  fontSize: 13,
                  border: isSelected ? '2px solid var(--mint)' : '1px solid var(--sep)',
                  background: isSelected ? 'var(--mint-light)' : 'var(--surface-2)',
                  color: isSelected ? 'var(--mint)' : 'var(--label)'
                }}
                onClick={() => setActivity(act)}
              >
                <span>{act}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Duration Inputs: Hours and Minutes */}
      <div style={{ marginBottom: 16 }}>
        <label className="lbl2" style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600 }}>
          {t('Duration')}
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
              {t('Hours')}
            </span>
            <div className="input-wrap" style={{ position: 'relative' }}>
              <input
                type="number"
                min="0"
                max="24"
                className="input"
                style={{
                  width: '100%',
                  height: 44,
                  fontSize: 16,
                  fontWeight: 600,
                  padding: '8px 12px',
                  borderRadius: 10
                }}
                value={hours}
                onChange={e => { setHours(e.target.value); setError('') }}
                placeholder="0"
              />
              <span style={{ position: 'absolute', right: 12, top: 12, color: 'var(--label-3)', fontSize: 12 }}>
                hr
              </span>
            </div>
          </div>

          <div>
            <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
              {t('Minutes')}
            </span>
            <div className="input-wrap" style={{ position: 'relative' }}>
              <input
                type="number"
                min="0"
                max="59"
                className="input"
                style={{
                  width: '100%',
                  height: 44,
                  fontSize: 16,
                  fontWeight: 600,
                  padding: '8px 12px',
                  borderRadius: 10
                }}
                value={minutes}
                onChange={e => { setMinutes(e.target.value); setError('') }}
                placeholder="30"
              />
              <span style={{ position: 'absolute', right: 12, top: 12, color: 'var(--label-3)', fontSize: 12 }}>
                min
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Distance Input */}
      <div style={{ marginBottom: 16 }}>
        <label className="lbl2" style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
          {t('Distance')}
        </label>
        <div className="input-wrap" style={{ position: 'relative' }}>
          <input
            type="number"
            step="0.1"
            min="0"
            max="200"
            className="input"
            style={{
              width: '100%',
              height: 44,
              fontSize: 16,
              fontWeight: 600,
              padding: '8px 12px',
              borderRadius: 10
            }}
            value={distance}
            onChange={e => { setDistance(e.target.value); setError('') }}
            placeholder="e.g. 5.0"
          />
          <span style={{ position: 'absolute', right: 12, top: 12, color: 'var(--label-3)', fontSize: 12 }}>
            km
          </span>
        </div>
      </div>

      {/* Date Input */}
      <div style={{ marginBottom: 16 }}>
        <label className="lbl2" style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
          {t('Date')}
        </label>
        <input
          type="date"
          className="input"
          style={{
            width: '100%',
            height: 44,
            fontSize: 14,
            padding: '8px 12px',
            borderRadius: 10
          }}
          value={date}
          onChange={e => setDate(e.target.value)}
        />
      </div>

      {/* Real Metrics Summary Box */}
      <div
        className="card"
        style={{
          background: 'var(--surface-2)',
          padding: '12px 14px',
          marginBottom: 16,
          borderRadius: 12
        }}
      >
        <div className="row between" style={{ alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--label-2)', textTransform: 'uppercase' }}>
              {t('Summary')}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: 'var(--mint)' }}>
              {activity} · {metrics.totalDurationMinutes} {t('min')}
              {metrics.distanceKm > 0 ? ` · ${metrics.distanceKm} km` : ''}
            </div>
          </div>
          <span className="tag acc" style={{ fontSize: 11 }}>
            {metrics.hours > 0 ? `${metrics.hours}h ${metrics.minutes}m` : `${metrics.minutes}m`}
          </span>
        </div>
        <div className="muted small" style={{ fontSize: 11, marginTop: 6, color: 'var(--label-3)' }}>
          {t('Only exact duration and distance are stored. No estimated calories or steps are calculated.')}
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button
          variant="primary"
          size="lg"
          icon="check"
          onClick={handleSave}
          style={{ width: '100%', height: 48, borderRadius: 12 }}
        >
          {initialEntry ? t('Update Cardio Activity') : t('Save Cardio Activity')}
        </Button>

        {initialEntry && (
          <Button
            variant="danger"
            size="md"
            icon="trash"
            onClick={handleDelete}
            style={{ width: '100%', borderRadius: 12 }}
          >
            {t('Delete Activity')}
          </Button>
        )}
      </div>
    </div>
  )
}
