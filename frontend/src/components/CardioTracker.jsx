import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import { todayISO, uid } from '../lib/format.js'
import { api } from '../lib/api.js'
import {
  calculateHaversineDistance,
  filterGpsPoint,
  formatPace,
  calculateEstimatedSteps,
  calculateMETCalories
} from '../lib/cardioEngine.js'

const STORAGE_KEY = 'ironx_active_cardio_session'

export default function CardioTracker({ onClose, onSaved }) {
  const S = useStore(s => s.S)
  const logCardio = useStore(s => s.logCardio)
  const { toast } = useUI()

  // Session state
  const [activity, setActivity] = useState('Walking') // Walking, Running, Jogging, Cycling
  const [status, setStatus] = useState('idle') // 'idle' | 'running' | 'paused' | 'finished'
  const [elapsedSec, setElapsedSec] = useState(0)
  const [coordinates, setCoordinates] = useState([])
  const [distanceKm, setDistanceKm] = useState(0)
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0)
  const [maxSpeedKmh, setMaxSpeedKmh] = useState(0)
  const [gpsAccuracy, setGpsAccuracy] = useState(null)
  const [gpsError, setGpsError] = useState(null)

  // Tracking refs
  const watchIdRef = useRef(null)
  const timerIntervalRef = useRef(null)
  const startTimeRef = useRef(null)
  const pausedTimeRef = useRef(0)
  const lastPauseStartRef = useRef(null)

  // User biometrics
  const userWeight = useMemo(() => {
    const bwList = S.bodyweight || []
    if (bwList.length > 0) return Number(bwList[bwList.length - 1].w) || 70
    return 70
  }, [S.bodyweight])

  const userHeight = useMemo(() => {
    return Number(S.profile?.height) || 175
  }, [S.profile])

  // Restore active session from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.status === 'running' || data.status === 'paused') {
          setActivity(data.activity || 'Walking')
          setStatus(data.status)
          startTimeRef.current = data.startTime
          pausedTimeRef.current = data.pausedTime || 0
          lastPauseStartRef.current = data.lastPauseStart || null
          setCoordinates(data.coordinates || [])
          setDistanceKm(data.distanceKm || 0)
          setMaxSpeedKmh(data.maxSpeedKmh || 0)

          // Calculate elapsed time from timestamps
          const now = Date.now()
          const pauseOffset = data.status === 'paused' && data.lastPauseStart ? (now - data.lastPauseStart) : 0
          const totalSec = Math.max(0, Math.floor((now - data.startTime - (data.pausedTime || 0) - pauseOffset) / 1000))
          setElapsedSec(totalSec)
        }
      }
    } catch (e) {
      // ignore JSON parse error
    }
  }, [])

  // Persist session to localStorage
  const persistSession = (currentStatus, currentCoords, currentDist, currentMaxSpeed) => {
    try {
      if (currentStatus === 'idle' || currentStatus === 'finished') {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          status: currentStatus,
          activity,
          startTime: startTimeRef.current,
          pausedTime: pausedTimeRef.current,
          lastPauseStart: lastPauseStartRef.current,
          coordinates: currentCoords,
          distanceKm: currentDist,
          maxSpeedKmh: currentMaxSpeed
        }))
      }
    } catch (e) {}
  }

  // Timer Tick
  useEffect(() => {
    if (status === 'running') {
      timerIntervalRef.current = setInterval(() => {
        const now = Date.now()
        if (startTimeRef.current) {
          const sec = Math.max(0, Math.floor((now - startTimeRef.current - pausedTimeRef.current) / 1000))
          setElapsedSec(sec)
        }
      }, 1000)
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [status])

  // GPS Watcher
  useEffect(() => {
    if (status === 'running' && 'geolocation' in navigator) {
      const handleGpsSuccess = (pos) => {
        setGpsError(null)
        const { latitude, longitude, accuracy, speed } = pos.coords
        setGpsAccuracy(Math.round(accuracy))

        const newPoint = {
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: pos.timestamp || Date.now()
        }

        setCoordinates(prevCoords => {
          const lastPoint = prevCoords.length > 0 ? prevCoords[prevCoords.length - 1] : null
          if (!filterGpsPoint(newPoint, lastPoint, 30)) {
            return prevCoords // Discard noisy / duplicate point
          }

          const addedDist = lastPoint ? calculateHaversineDistance(lastPoint.lat, lastPoint.lng, latitude, longitude) : 0
          const newDist = Math.round((distanceKm + addedDist) * 100) / 100
          setDistanceKm(newDist)

          // Speed in km/h
          const curSpeed = speed != null && speed >= 0 ? Math.round(speed * 3.6 * 10) / 10 : (addedDist > 0 ? 5.0 : 0)
          setCurrentSpeedKmh(curSpeed)
          setMaxSpeedKmh(prev => Math.max(prev, curSpeed))

          const nextCoords = [...prevCoords, newPoint]
          persistSession('running', nextCoords, newDist, Math.max(maxSpeedKmh, curSpeed))
          return nextCoords
        })
      }

      const handleGpsError = (err) => {
        setGpsError(err.message || t('GPS location unavailable'))
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        handleGpsSuccess,
        handleGpsError,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
      )
    } else {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }

    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [status, distanceKm, maxSpeedKmh])

  // Control Handlers
  const handleStart = () => {
    startTimeRef.current = Date.now()
    pausedTimeRef.current = 0
    lastPauseStartRef.current = null
    setStatus('running')
    persistSession('running', [], 0, 0)
  }

  const handlePause = () => {
    lastPauseStartRef.current = Date.now()
    setStatus('paused')
    persistSession('paused', coordinates, distanceKm, maxSpeedKmh)
  }

  const handleResume = () => {
    if (lastPauseStartRef.current) {
      pausedTimeRef.current += (Date.now() - lastPauseStartRef.current)
      lastPauseStartRef.current = null
    }
    setStatus('running')
    persistSession('running', coordinates, distanceKm, maxSpeedKmh)
  }

  const handleFinish = async () => {
    setStatus('finished')
    persistSession('finished', [], 0, 0)

    const durMin = Math.max(1, Math.round(elapsedSec / 60))
    const durHours = elapsedSec / 3600
    const caloriesBurned = calculateMETCalories(activity, durHours, userWeight)
    const stepsCount = calculateEstimatedSteps(distanceKm, userHeight, activity)

    const entry = {
      id: 'cardio_' + uid(),
      d: todayISO(),
      date: todayISO(),
      activity,
      activity_type: activity,
      duration_min: durMin,
      totalDurationMinutes: durMin,
      distance_km: distanceKm,
      distanceKm,
      steps: stepsCount,
      calories_burned: caloriesBurned,
      max_speed_kmh: maxSpeedKmh,
      avg_speed_kmh: durHours > 0 ? Math.round((distanceKm / durHours) * 10) / 10 : 0,
      coordinates,
      createdAt: new Date().toISOString()
    }

    // Save to local store
    logCardio(entry)

    // Sync to backend cardio log table
    try {
      await api('/api/nutrition/cardio/save', {
        method: 'POST',
        body: JSON.stringify({
          id: entry.id,
          date: entry.d,
          activity_type: entry.activity_type,
          duration_min: entry.duration_min,
          distance_km: entry.distance_km,
          calories_burned: entry.calories_burned,
          steps: entry.steps,
          notes: `${activity} GPS session: ${distanceKm} km in ${durMin} min`,
          created_at: entry.createdAt
        })
      })
    } catch (e) {
      // Backend sync error handled gracefully
    }

    toast(t('Cardio session saved! ({0} km, {1} kcal)', distanceKm, caloriesBurned))
    if (onSaved) onSaved(entry)
  }

  const handleDiscard = () => {
    setStatus('idle')
    setElapsedSec(0)
    setCoordinates([])
    setDistanceKm(0)
    setCurrentSpeedKmh(0)
    setMaxSpeedKmh(0)
    persistSession('idle', [], 0, 0)
    if (onClose) onClose()
  }

  // Derived real-time calculations
  const paceDisplay = formatPace(distanceKm, elapsedSec)
  const stepsDisplay = calculateEstimatedSteps(distanceKm, userHeight, activity)
  const caloriesDisplay = calculateMETCalories(activity, elapsedSec / 3600, userWeight)
  const avgSpeedKmh = elapsedSec > 0 ? Math.round((distanceKm / (elapsedSec / 3600)) * 10) / 10 : 0

  // Format digital timer string: HH:MM:SS or MM:SS
  const formatTimer = (sec) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // SVG Map Polyline Projection
  const mapSvgData = useMemo(() => {
    if (coordinates.length < 2) return null
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
    for (const c of coordinates) {
      if (c.lat < minLat) minLat = c.lat
      if (c.lat > maxLat) maxLat = c.lat
      if (c.lng < minLng) minLng = c.lng
      if (c.lng > maxLng) maxLng = c.lng
    }

    const latSpan = Math.max(0.001, maxLat - minLat)
    const lngSpan = Math.max(0.001, maxLng - minLng)

    const mapW = 320
    const mapH = 180
    const pad = 24

    const points = coordinates.map(c => {
      const x = pad + ((c.lng - minLng) / lngSpan) * (mapW - 2 * pad)
      // Invert Y because latitude increases northward
      const y = (mapH - pad) - ((c.lat - minLat) / latSpan) * (mapH - 2 * pad)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    return {
      svgPoints: points.join(' '),
      startPoint: points[0],
      endPoint: points[points.length - 1],
      width: mapW,
      height: mapH
    }
  }, [coordinates])

  return (
    <div
      className="cardio-tracker-modal"
      style={{
        padding: '16px 14px 24px',
        maxHeight: '90vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: 'var(--bg, #09090B)',
        color: '#FFFFFF'
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--label)' }}>
            {t('IRONX Cardio GPS Tracker')}
          </h2>
          <div style={{ fontSize: 11, color: 'var(--label-2)', marginTop: 2 }}>
            {t('Precision outdoor tracking with route mapping')}
          </div>
        </div>

        {/* GPS Signal Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2, #18181C)', padding: '4px 10px', borderRadius: 9999, border: '1px solid var(--borders, #303036)' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: gpsError ? 'var(--coral, #FF6B6B)' : (gpsAccuracy != null && gpsAccuracy <= 20 ? 'var(--mint, #10B981)' : '#F59E0B')
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label-2)' }}>
            {gpsError ? t('GPS Error') : gpsAccuracy != null ? `GPS: ±${gpsAccuracy}m` : t('GPS Ready')}
          </span>
        </div>
      </div>

      {/* Activity Selector Tabs (Disabled while actively running) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {['Walking', 'Jogging', 'Running', 'Cycling'].map(act => (
          <button
            key={act}
            type="button"
            disabled={status === 'running' || status === 'paused'}
            onClick={() => setActivity(act)}
            style={{
              padding: '8px 4px',
              borderRadius: 10,
              border: activity === act ? '1px solid var(--theme-accent, #F5F5F5)' : '1px solid var(--borders, #303036)',
              background: activity === act ? 'var(--borders, #303036)' : 'var(--surface-2, #18181C)',
              color: activity === act ? 'var(--theme-accent, #F5F5F5)' : 'var(--label-2)',
              fontSize: 12,
              fontWeight: 700,
              cursor: status === 'idle' ? 'pointer' : 'default',
              opacity: (status === 'running' || status === 'paused') && activity !== act ? 0.4 : 1
            }}
          >
            {t(act)}
          </button>
        ))}
      </div>

      {/* Main Digital HUD Timer & Distance */}
      <div
        style={{
          background: 'var(--surface-2, #18181C)',
          border: '1px solid var(--borders, #303036)',
          borderRadius: 14,
          padding: '16px 14px',
          textAlign: 'center',
          marginBottom: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--label-2)', letterSpacing: '0.05em' }}>
          {status === 'running' ? t('Session in Progress') : status === 'paused' ? t('Session Paused') : t('Ready to Track')}
        </div>

        <div style={{ fontSize: 44, fontWeight: 900, fontFamily: 'monospace', color: 'var(--label)', margin: '4px 0', letterSpacing: '-0.02em' }}>
          {formatTimer(elapsedSec)}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--theme-accent, #F5F5F5)' }}>
            {distanceKm.toFixed(2)}
          </span>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-2)' }}>km</span>
        </div>
      </div>

      {/* Live Route Polyline Map */}
      <div
        style={{
          background: '#0D0D10',
          border: '1px solid var(--borders, #303036)',
          borderRadius: 14,
          height: 190,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14
        }}
      >
        {/* Coordinate Grid Background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
            opacity: 0.7
          }}
        />

        {mapSvgData ? (
          <svg width={mapSvgData.width} height={mapSvgData.height} style={{ width: '100%', height: '100%' }}>
            {/* Projected Route Polyline */}
            <polyline
              points={mapSvgData.svgPoints}
              fill="none"
              stroke="var(--theme-accent, #F5F5F5)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Start Pin */}
            {mapSvgData.startPoint && (
              <circle
                cx={mapSvgData.startPoint.split(',')[0]}
                cy={mapSvgData.startPoint.split(',')[1]}
                r="5"
                fill="#10B981"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            )}
            {/* Current Beacon Pin */}
            {mapSvgData.endPoint && (
              <circle
                cx={mapSvgData.endPoint.split(',')[0]}
                cy={mapSvgData.endPoint.split(',')[1]}
                r="6"
                fill="#3B82F6"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            )}
          </svg>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--label-3)', fontSize: 12, zIndex: 1 }}>
            <Icon name="navigation" size={24} style={{ marginBottom: 6, opacity: 0.6 }} />
            <div>{status === 'running' ? t('Acquiring GPS route path...') : t('Start session to track live GPS route')}</div>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4 }}>
          {coordinates.length} {t('GPS Points')}
        </div>
      </div>

      {/* Real-time Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18, textAlign: 'center' }}>
        <div style={{ background: 'var(--surface-2, #18181C)', padding: '10px 4px', borderRadius: 10, border: '1px solid var(--borders, #303036)' }}>
          <div style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase', fontWeight: 700 }}>{t('Pace')}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--label)', marginTop: 4 }}>{paceDisplay}</div>
        </div>

        <div style={{ background: 'var(--surface-2, #18181C)', padding: '10px 4px', borderRadius: 10, border: '1px solid var(--borders, #303036)' }}>
          <div style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase', fontWeight: 700 }}>{t('Speed')}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--label)', marginTop: 4 }}>{currentSpeedKmh} <span style={{ fontSize: 9 }}>km/h</span></div>
        </div>

        <div style={{ background: 'var(--surface-2, #18181C)', padding: '10px 4px', borderRadius: 10, border: '1px solid var(--borders, #303036)' }}>
          <div style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase', fontWeight: 700 }}>{activity === 'Cycling' ? t('Avg Speed') : t('Steps')}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--label)', marginTop: 4 }}>
            {activity === 'Cycling' ? `${avgSpeedKmh} km/h` : stepsDisplay.toLocaleString()}
          </div>
        </div>

        <div style={{ background: 'var(--surface-2, #18181C)', padding: '10px 4px', borderRadius: 10, border: '1px solid var(--borders, #303036)' }}>
          <div style={{ fontSize: 10, color: 'var(--label-2)', textTransform: 'uppercase', fontWeight: 700 }}>{t('Calories')}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--theme-accent, #F5F5F5)', marginTop: 4 }}>{caloriesDisplay} <span style={{ fontSize: 9 }}>kcal</span></div>
        </div>
      </div>

      {/* Control Buttons Bar */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {status === 'idle' && (
          <Button
            variant="acc"
            onClick={handleStart}
            style={{ width: '100%', padding: '12px 20px', fontWeight: 800, fontSize: 15 }}
          >
            ▶ {t('Start Outdoor {0}', t(activity))}
          </Button>
        )}

        {status === 'running' && (
          <>
            <Button
              variant="secondary"
              onClick={handlePause}
              style={{ flex: 1, padding: '12px 14px', fontWeight: 700 }}
            >
              ⏸ {t('Pause')}
            </Button>
            <Button
              variant="acc"
              onClick={handleFinish}
              style={{ flex: 1.5, padding: '12px 14px', fontWeight: 800 }}
            >
              ✓ {t('Finish & Save')}
            </Button>
          </>
        )}

        {status === 'paused' && (
          <>
            <Button
              variant="secondary"
              onClick={handleDiscard}
              style={{ flex: 1, padding: '12px 14px', fontWeight: 600, color: 'var(--coral, #FF6B6B)' }}
            >
              ✕ {t('Discard')}
            </Button>
            <Button
              variant="secondary"
              onClick={handleResume}
              style={{ flex: 1, padding: '12px 14px', fontWeight: 700 }}
            >
              ▶ {t('Resume')}
            </Button>
            <Button
              variant="acc"
              onClick={handleFinish}
              style={{ flex: 1.5, padding: '12px 14px', fontWeight: 800 }}
            >
              ✓ {t('Finish & Save')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
