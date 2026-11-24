import { useState, useRef, useEffect, useCallback } from 'react'
import BODY_PATHS from '../lib/body-paths.js'
import { MUSCLES, INERT, MUSCLE_NAME, levelsOf } from '../lib/muscles.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

/**
 * InteractiveMuscleViewer
 * Touch-enabled post-workout anatomical muscle diagram explorer.
 * Supports:
 * - Pinch-to-zoom (1x - 3x)
 * - Pan / Drag
 * - Double-tap zoom toggle
 * - Fullscreen mode
 * - Anterior (Front), Posterior (Back), or Combined views
 * - "Save Muscle Chart" clean high-resolution PNG export with date/group captions
 */
export default function InteractiveMuscleViewer({
  load = {},
  body = 'male',
  workoutTitle = 'Strength Workout',
  workoutDate = new Date().toISOString().slice(0, 10),
  onMuscle,
  selected,
  className = ''
}) {
  const levels = levelsOf(load)
  const g = BODY_PATHS && (BODY_PATHS[body] || BODY_PATHS.male)

  // View state
  const [activeView, setActiveView] = useState('both') // 'both' | 'front' | 'back'
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Gesture tracking refs
  const containerRef = useRef(null)
  const isDraggingRef = useRef(false)
  const lastTouchRef = useRef({ x: 0, y: 0 })
  const initialPinchDistRef = useRef(0)
  const initialScaleRef = useRef(1)
  const lastTapRef = useRef(0)

  // Reset transformation
  const handleReset = useCallback(() => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const handleZoomIn = () => {
    setScale(prev => Math.min(3.0, Math.round((prev + 0.3) * 10) / 10))
  }

  const handleZoomOut = () => {
    setScale(prev => {
      const next = Math.max(1.0, Math.round((prev - 0.3) * 10) / 10)
      if (next === 1.0) setPan({ x: 0, y: 0 })
      return next
    })
  }

  // Double-tap zoom toggle
  const handleDoubleTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      if (scale > 1.2) {
        handleReset()
      } else {
        setScale(2.0)
      }
    }
    lastTapRef.current = now
  }

  // Touch gesture handlers
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      handleDoubleTap()
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      initialPinchDistRef.current = dist
      initialScaleRef.current = scale
    }
  }

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDraggingRef.current && scale > 1) {
      const dx = e.touches[0].clientX - lastTouchRef.current.x
      const dy = e.touches[0].clientY - lastTouchRef.current.y
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      setPan(prev => ({
        x: Math.max(-150, Math.min(150, prev.x + dx)),
        y: Math.max(-200, Math.min(200, prev.y + dy))
      }))
    } else if (e.touches.length === 2 && initialPinchDistRef.current > 0) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const ratio = currentDist / initialPinchDistRef.current
      const newScale = Math.max(1.0, Math.min(3.0, initialScaleRef.current * ratio))
      setScale(Math.round(newScale * 100) / 100)
    }
  }

  const handleTouchEnd = () => {
    isDraggingRef.current = false
    initialPinchDistRef.current = 0
  }

  // Mouse drag handlers for desktop exploration
  const handleMouseDown = (e) => {
    if (scale <= 1) return
    isDraggingRef.current = true
    lastTouchRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || scale <= 1) return
    const dx = e.clientX - lastTouchRef.current.x
    const dy = e.clientY - lastTouchRef.current.y
    lastTouchRef.current = { x: e.clientX, y: e.clientY }
    setPan(prev => ({
      x: Math.max(-150, Math.min(150, prev.x + dx)),
      y: Math.max(-200, Math.min(200, prev.y + dy))
    }))
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
  }

  // High-Resolution PNG Export (Clean, No UI Controls on Image)
  const handleSaveMuscleChart = async () => {
    if (exporting) return
    setExporting(true)

    try {
      const canvas = document.createElement('canvas')
      const width = 1200
      const height = 900
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      // 1. Dark athletic background
      ctx.fillStyle = '#0E0E12'
      ctx.fillRect(0, 0, width, height)

      // Decorative top gradient header bar
      const grad = ctx.createLinearGradient(0, 0, width, 0)
      grad.addColorStop(0, '#242429')
      grad.addColorStop(0.5, '#3A3A42')
      grad.addColorStop(1, '#242429')
      ctx.fillStyle = grad
      ctx.fillRect(40, 24, width - 80, 2)

      // 2. Captions & Branding
      ctx.fillStyle = '#F5F5F5'
      ctx.font = 'bold 28px sans-serif'
      ctx.fillText('IRONX FITNESS', 50, 70)

      ctx.fillStyle = '#A0A0A8'
      ctx.font = '16px sans-serif'
      ctx.fillText('POST-WORKOUT MUSCLE STIMULATION REPORT', 50, 96)

      // Workout Details Badge on Top Right
      ctx.fillStyle = '#18181C'
      ctx.roundRect(width - 450, 44, 400, 64, 10)
      ctx.fill()
      ctx.strokeStyle = '#303036'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 18px sans-serif'
      ctx.fillText(workoutTitle || 'Strength Workout', width - 430, 72)

      ctx.fillStyle = '#A0A0A8'
      ctx.font = '14px sans-serif'
      ctx.fillText(`Completed: ${workoutDate}`, width - 430, 94)

      // 3. Render Anterior and Posterior SVGs onto Canvas
      const colorMap = {
        base: '#98624F',
        stroke: '#775344',
        l1: '#C47B62',
        l2: '#D98267',
        l3: '#E07353',
        l4: '#E65D37'
      }

      const drawSvgToCanvas = (viewData, posX, posY, viewWidth, viewHeight, label) => {
        return new Promise((resolve) => {
          let svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewData.vb}" width="${viewWidth}" height="${viewHeight}">`
          // Base silhouette
          INERT.forEach(slug => {
            (viewData.p[slug] || []).forEach(d => {
              svgString += `<path d="${d}" fill="${colorMap.base}" stroke="${colorMap.stroke}" stroke-width="0.8" />`
            })
          })
          // Active muscle paths with level fills
          MUSCLES.forEach(slug => {
            const lv = levels[slug] || 0
            const fill = lv > 0 ? (colorMap[`l${lv}`] || colorMap.l1) : colorMap.base
            const stroke = lv > 0 ? '#FFFFFF' : colorMap.stroke
            const strokeWidth = lv > 0 ? '1.2' : '0.8';
            (viewData.p[slug] || []).forEach(d => {
              svgString += `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`
            })
          })
          svgString += `</svg>`

          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            ctx.drawImage(img, posX, posY, viewWidth, viewHeight)
            // Draw column label
            ctx.fillStyle = '#E0E0E6'
            ctx.font = 'bold 18px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(label, posX + viewWidth / 2, posY + viewHeight + 35)
            ctx.textAlign = 'left'
            resolve()
          }
          img.onerror = () => resolve()
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString)
        })
      }

      if (g) {
        const diagramWidth = 320
        const diagramHeight = 580
        const diagramY = 140

        // Anterior View
        await drawSvgToCanvas(g.front, width / 2 - diagramWidth - 40, diagramY, diagramWidth, diagramHeight, 'ANTERIOR (FRONT)')
        // Posterior View
        await drawSvgToCanvas(g.back, width / 2 + 40, diagramY, diagramWidth, diagramHeight, 'POSTERIOR (BACK)')
      }

      // 4. Legend Footer
      const legendY = height - 60
      ctx.fillStyle = '#141416'
      ctx.roundRect(width / 2 - 280, legendY - 24, 560, 48, 8)
      ctx.fill()
      ctx.strokeStyle = '#28282E'
      ctx.stroke()

      const legendItems = [
        { label: 'Resting', color: colorMap.base },
        { label: 'Moderate Load', color: colorMap.l1 },
        { label: 'High Load', color: colorMap.l2 },
        { label: 'Primary Target', color: colorMap.l4 }
      ]

      let lx = width / 2 - 240
      legendItems.forEach(item => {
        ctx.fillStyle = item.color
        ctx.fillRect(lx, legendY - 8, 16, 16)
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 0.5
        ctx.strokeRect(lx, legendY - 8, 16, 16)

        ctx.fillStyle = '#CCCCCC'
        ctx.font = '13px sans-serif'
        ctx.fillText(item.label, lx + 24, legendY + 5)
        lx += 135
      })

      // Convert to blob and download
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const fileName = `ironx_muscle_chart_${workoutDate}.png`

        // Check Web Share API with files
        if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] })) {
          try {
            await navigator.share({
              title: `${workoutTitle} Muscle Chart`,
              text: `Check out my muscles trained on IRONX: ${workoutTitle}`,
              files: [new File([blob], fileName, { type: 'image/png' })]
            })
            setExporting(false)
            return
          } catch (e) {
            // User cancelled or fallback to download
          }
        }

        // Standard browser download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setExporting(false)
      }, 'image/png')
    } catch (err) {
      console.error('Failed to export muscle chart:', err)
      setExporting(false)
    }
  }

  // Render individual body view column
  const renderView = (viewData, viewName) => {
    if (!viewData) return null
    return (
      <div className="bm-col" style={{ flex: 1, minWidth: 140, maxWidth: 260 }}>
        <div className="bm-label" style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-2)', marginBottom: 6, textAlign: 'center' }}>
          {viewName}
        </div>
        <svg
          className="bm-v"
          viewBox={viewData.vb}
          role="img"
          aria-label={viewName}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {INERT.map(slug => (viewData.p[slug] || []).map((d, i) => (
            <path key={slug + i} className="bm-sil" d={d} />
          )))}
          {MUSCLES.map(slug => (viewData.p[slug] || []).map((d, i) => {
            const lv = levels[slug] || 0
            const isSel = selected === slug
            return (
              <path
                key={slug + i}
                className={`bm-m l${lv}${isSel ? ' sel' : ''}`}
                d={d}
                onClick={onMuscle ? () => onMuscle(slug) : undefined}
              >
                <title>{t(MUSCLE_NAME[slug])}</title>
              </path>
            )
          }))}
        </svg>
      </div>
    )
  }

  return (
    <div
      className={`interactive-muscle-viewer ${className}`}
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
        background: isFullscreen ? 'var(--bg, #09090B)' : 'var(--surface-2, #18181B)',
        border: isFullscreen ? 'none' : '1px solid var(--borders, #303036)',
        borderRadius: isFullscreen ? 0 : 14,
        padding: isFullscreen ? '20px 16px' : '14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* Top Toolbar: View Toggles & Zoom Controls */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap'
        }}
      >
        {/* View Switcher Chips: Both / Anterior / Posterior */}
        <div style={{ display: 'flex', background: 'var(--surface-1, #121214)', padding: 3, borderRadius: 8, border: '1px solid var(--borders, #303036)' }}>
          {[
            { id: 'both', label: t('Both') },
            { id: 'front', label: t('Front') },
            { id: 'back', label: t('Back') }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              style={{
                background: activeView === tab.id ? 'var(--borders, #303036)' : 'transparent',
                color: activeView === tab.id ? 'var(--theme-accent, #F5F5F5)' : 'var(--label-2)',
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Zoom Controls & Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 1}
            style={{
              background: 'var(--surface-1, #121214)',
              border: '1px solid var(--borders, #303036)',
              borderRadius: 6,
              color: 'var(--label)',
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: scale > 1 ? 'pointer' : 'default',
              opacity: scale > 1 ? 1 : 0.4
            }}
            title={t('Zoom Out')}
          >
            <Icon name="minus" size={14} />
          </button>

          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-2)', minWidth: 36, textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 3}
            style={{
              background: 'var(--surface-1, #121214)',
              border: '1px solid var(--borders, #303036)',
              borderRadius: 6,
              color: 'var(--label)',
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: scale < 3 ? 'pointer' : 'default',
              opacity: scale < 3 ? 1 : 0.4
            }}
            title={t('Zoom In')}
          >
            <Icon name="plus" size={14} />
          </button>

          {scale > 1 && (
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: 'var(--surface-1, #121214)',
                border: '1px solid var(--borders, #303036)',
                borderRadius: 6,
                color: 'var(--label)',
                padding: '0 8px',
                height: 30,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title={t('Reset Zoom')}
            >
              {t('Reset')}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(prev => !prev)}
            style={{
              background: isFullscreen ? 'var(--borders, #303036)' : 'var(--surface-1, #121214)',
              border: '1px solid var(--borders, #303036)',
              borderRadius: 6,
              color: 'var(--label)',
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title={isFullscreen ? t('Exit Fullscreen') : t('Fullscreen')}
          >
            <Icon name={isFullscreen ? 'cross' : 'expand'} size={14} />
          </button>
        </div>
      </div>

      {/* Interactive Muscle Canvas Container */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          touchAction: 'none',
          cursor: scale > 1 ? 'grab' : 'default',
          minHeight: isFullscreen ? 'calc(100vh - 160px)' : 340,
          position: 'relative'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 20,
            width: '100%',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDraggingRef.current ? 'none' : 'transform 0.15s ease-out'
          }}
        >
          {g ? (
            <>
              {(activeView === 'both' || activeView === 'front') && renderView(g.front, t('Anterior (Front)'))}
              {(activeView === 'both' || activeView === 'back') && renderView(g.back, t('Posterior (Back)'))}
            </>
          ) : (
            <div className="bm-ph" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Bottom Action Footer: Save Muscle Chart & Legend */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          paddingTop: 10,
          borderTop: '1px solid var(--borders, #303036)',
          flexWrap: 'wrap',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--label-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bm-base, #98624F)' }} />
            <span>{t('Resting')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#C47B62' }} />
            <span>{t('Active')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#E65D37' }} />
            <span>{t('Targeted')}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveMuscleChart}
          disabled={exporting}
          style={{
            background: 'var(--theme-accent, #F5F5F5)',
            color: '#111111',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: exporting ? 'default' : 'pointer',
            opacity: exporting ? 0.7 : 1,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          <Icon name="camera" size={14} />
          <span>{exporting ? t('Exporting PNG...') : t('Save Muscle Chart')}</span>
        </button>
      </div>
    </div>
  )
}
