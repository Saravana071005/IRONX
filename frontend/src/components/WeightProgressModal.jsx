import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate, fmtNum, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import LineChart from './LineChart.jsx'
import { awardXPEvent } from '../lib/gamification.js'

export default function WeightProgressModal({ close, entries }) {
  const storeS = useStore(s => s.S)
  const S = storeS || (useStore.getState && useStore.getState().S) || {}
  const update = useStore(s => s.update) || (useStore.getState && useStore.getState().update)
  const toast = (useUI && useUI(s => s.toast)) || (useUI.getState && useUI.getState().toast) || (() => {})
  const unit = S?.unit || 'kg'

  const currentBodyweight = entries || (S?.bodyweight && S.bodyweight.length > 0 ? S.bodyweight : useStore.getState?.()?.S?.bodyweight) || []
  const rawEntries = currentBodyweight.slice().sort((a, b) => (a.d < b.d ? -1 : (a.d > b.d ? 1 : 0)))
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const existingForSelectedDate = rawEntries.find(b => b.d === selectedDate)
  const [weightValue, setWeightValue] = useState(existingForSelectedDate ? String(existingForSelectedDate.w) : '')

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate)
    const match = rawEntries.find(b => b.d === newDate)
    setWeightValue(match ? String(match.w) : '')
  }

  const handleEditEntry = (entry) => {
    setSelectedDate(entry.d)
    setWeightValue(String(entry.w))
  }

  const handleDeleteEntry = (date) => {
    update(s => {
      s.bodyweight = (s.bodyweight || []).filter(b => b.d !== date)
    })
    toast(t('Weight record deleted'))
  }

  const handleSave = () => {
    const num = parseFloat(weightValue)
    if (isNaN(num) || num <= 0) {
      toast(t('Enter a valid weight'))
      return
    }
    const cleanWeight = Math.round(num * 10) / 10

    update(s => {
      s.bodyweight = s.bodyweight || []
      const existingIdx = s.bodyweight.findIndex(b => b.d === selectedDate)
      if (existingIdx >= 0) {
        s.bodyweight[existingIdx] = {
          ...s.bodyweight[existingIdx],
          w: cleanWeight,
          u: unit,
          t: Date.now()
        }
      } else {
        s.bodyweight.push({
          d: selectedDate,
          w: cleanWeight,
          u: unit,
          t: Date.now()
        })
      }
      s.bodyweight.sort((a, b) => (a.d < b.d ? -1 : (a.d > b.d ? 1 : 0)))

      const xRes = awardXPEvent(s.xp || 0, s.xpHistory || [], 'bw:' + selectedDate, 'WEIGHT_LOGGED', 15, `Logged weight: ${cleanWeight} ${unit}`)
      if (xRes.awarded) {
        s.xp = xRes.newTotal
        s.xpHistory = xRes.history
      }
    })

    toast(existingForSelectedDate ? t('Weight updated') : t('Weight saved'))
  }

  const hasEntries = rawEntries.length > 0
  const firstEntry = hasEntries ? rawEntries[0] : null
  const latestEntry = hasEntries ? rawEntries[rawEntries.length - 1] : null

  let deltaVal = null
  let progressText = t('No entries yet')
  if (hasEntries && firstEntry && latestEntry) {
    if (rawEntries.length === 1) {
      progressText = t('Initial baseline recorded')
    } else {
      deltaVal = Number((latestEntry.w - firstEntry.w).toFixed(1))
      if (deltaVal < 0) {
        progressText = `${Math.abs(deltaVal).toFixed(1)} ${unit} ${t('reduction')}`
      } else if (deltaVal > 0) {
        progressText = `+${deltaVal.toFixed(1)} ${unit} ${t('gain')}`
      } else {
        progressText = t('Maintained weight')
      }
    }
  }

  const chartPoints = rawEntries.map(b => ({
    t: b.t || (b.d ? new Date(b.d + (b.d.includes('T') ? '' : 'T12:00:00')).getTime() : 0),
    y: b.w,
    d: b.d
  }))

  const recentReversed = rawEntries.slice().reverse()

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', color: '#FFFFFF', paddingBottom: 16 }}>
      {/* Header */}
      <div className="row between" style={{ alignItems: 'center', marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#242429', border: '1px solid #303036', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
            <Icon name="scale" size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              {t('Body Weight Progress')}
            </h2>
            <div style={{ fontSize: 12, color: '#A1A1AA', marginTop: 2 }}>
              {t('Verified weight entries and body composition trends')}
            </div>
          </div>
        </div>
        {close && (
          <button
            onClick={close}
            className="iconbtn"
            style={{ width: 34, height: 34, borderRadius: 10, background: '#1C1C20', border: '1px solid #303036', color: '#FFFFFF' }}
            aria-label="Close"
          >
            <Icon name="xmark" />
          </button>
        )}
      </div>

      {/* KPI Cards (3 Columns) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {/* Starting Weight */}
        <div style={{ background: '#1C1C20', border: '1px solid #303036', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {t('Starting')}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#FFFFFF', marginTop: 3 }}>
            {firstEntry ? `${fmtNum(firstEntry.w)}` : '—'} <span style={{ fontSize: 12, fontWeight: 500, color: '#71717A' }}>{firstEntry ? unit : ''}</span>
          </div>
        </div>

        {/* Current Weight */}
        <div style={{ background: '#1C1C20', border: '1px solid #303036', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {t('Current')}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#FFFFFF', marginTop: 3 }}>
            {latestEntry ? `${fmtNum(latestEntry.w)}` : '—'} <span style={{ fontSize: 12, fontWeight: 500, color: '#71717A' }}>{latestEntry ? unit : ''}</span>
          </div>
        </div>

        {/* Delta Progress */}
        <div style={{ background: '#1C1C20', border: '1px solid #303036', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {t('Progress')}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {progressText}
          </div>
        </div>
      </div>

      {/* Weight Trend Line Chart */}
      <div style={{ background: '#1C1C20', border: '1px solid #303036', borderRadius: 14, padding: '14px', marginBottom: 14 }}>
        <div className="row between" style={{ marginBottom: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {t('Weight Progression Curve')}
          </div>
          {rawEntries.length > 0 && (
            <span style={{ fontSize: 11, color: '#71717A' }}>
              {rawEntries.length} {rawEntries.length === 1 ? t('entry') : t('entries')}
            </span>
          )}
        </div>
        {chartPoints.length > 0 ? (
          <div style={{ marginTop: 6 }}>
            <LineChart points={chartPoints} h={150} unit={unit} color="#FFFFFF" goal={S?.targetW} />
          </div>
        ) : (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#71717A', fontSize: 13 }}>
            {t('Log your first body weight to view your progress trend.')}
          </div>
        )}
      </div>

      {/* Daily Weight Entry Form */}
      <div style={{ background: '#1C1C20', border: '1px solid #303036', borderRadius: 14, padding: '14px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 12 }}>
          {existingForSelectedDate ? t('Update Daily Weight') : t('Log Daily Weight')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#71717A', marginBottom: 4 }}>
              {t('Date')}
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => handleDateChange(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 10,
                background: '#09090B',
                border: '1px solid #303036',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#71717A', marginBottom: 4 }}>
              {t('Weight')} ({unit})
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                value={weightValue}
                onChange={e => setWeightValue(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 10,
                  background: '#09090B',
                  border: '1px solid #303036',
                  color: '#FFFFFF',
                  fontSize: 15,
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#A1A1AA' }}>{unit}</span>
            </div>
          </div>
        </div>

        {existingForSelectedDate && (
          <div style={{ fontSize: 11, color: '#FFFFFF', marginBottom: 10, background: '#242429', padding: '6px 10px', borderRadius: 8, border: '1px solid #303036' }}>
            ℹ️ {t('Updating existing record for this date (prevents duplicates)')}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!weightValue || isNaN(parseFloat(weightValue)) || parseFloat(weightValue) <= 0}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: 10,
            background: (!weightValue || isNaN(parseFloat(weightValue)) || parseFloat(weightValue) <= 0) ? '#242429' : '#FFFFFF',
            color: (!weightValue || isNaN(parseFloat(weightValue)) || parseFloat(weightValue) <= 0) ? '#71717A' : '#09090B',
            fontWeight: 700,
            fontSize: 14,
            border: '1px solid #303036',
            cursor: (!weightValue || isNaN(parseFloat(weightValue)) || parseFloat(weightValue) <= 0) ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {existingForSelectedDate ? t('Update Weight Record') : t('Save Weight Record')}
        </button>
      </div>

      {/* Entry History List */}
      {recentReversed.length > 0 && (
        <div style={{ background: '#1C1C20', border: '1px solid #303036', borderRadius: 14, padding: '14px' }}>
          <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {t('Weight History')}
            </div>
            <span style={{ fontSize: 11, color: '#71717A' }}>
              {recentReversed.length} {t('total')}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {recentReversed.map(entry => (
              <div
                key={entry.d}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: '#09090B',
                  borderRadius: 10,
                  border: '1px solid #303036'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#FFFFFF' }}>
                    {fmtNum(entry.w)} {entry.u || unit}
                  </div>
                  <div style={{ fontSize: 11, color: '#71717A', marginTop: 1 }}>
                    {fmtDate(entry.d, true)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => handleEditEntry(entry)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: '#242429',
                      border: '1px solid #303036',
                      color: '#FFFFFF',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {t('Edit')}
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(entry.d)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'transparent',
                      border: '1px solid #303036',
                      color: '#A1A1AA',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    aria-label={t('Delete')}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
