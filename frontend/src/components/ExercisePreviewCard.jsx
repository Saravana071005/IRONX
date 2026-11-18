import { useState, useMemo } from 'react'
import { exOr } from '../lib/exercises.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { getExerciseMedia, getPostureGuidance, getExerciseSteps } from '../lib/exercisePreview.js'

export default function ExercisePreviewCard({
  exercise,
  isSelected = false,
  onToggleSelect,
  onClose,
  compact = false
}) {
  // Resolve full exercise record if ID or partial object was provided
  const ex = useMemo(() => {
    if (!exercise) return null
    if (typeof exercise === 'string') return exOr(exercise)
    return exOr(exercise.id) || exercise
  }, [exercise])

  const [playing, setPlaying] = useState(true)
  const [fallbackUsed, setFallbackUsed] = useState(false)
  const [mediaError, setMediaError] = useState(false)

  if (!ex) return null

  const mediaInfo = getExerciseMedia(ex)
  const postureTips = getPostureGuidance(ex)
  const steps = getExerciseSteps(ex)

  const handleMediaError = () => {
    if (!fallbackUsed && mediaInfo.fallbackSrc) {
      setFallbackUsed(true)
    } else {
      setMediaError(true)
    }
  }

  // Determine current image/gif src
  let currentImgSrc = ''
  if (mediaInfo.type === 'gif') {
    if (fallbackUsed) {
      currentImgSrc = playing ? mediaInfo.fallbackSrc : mediaInfo.stillFallbackSrc
    } else {
      currentImgSrc = playing ? mediaInfo.src : mediaInfo.stillSrc
    }
  } else if (mediaInfo.type === 'image') {
    currentImgSrc = fallbackUsed ? mediaInfo.fallbackSrc : mediaInfo.src
  }

  const exName = ex.n || ex.name || t('Exercise')
  const targetMuscle = ex.tg || ex.category || ''
  const bodyPart = ex.bp || ''
  const equipment = ex.eq || ex.equipment || 'No equipment'
  const secondaryMuscles = Array.isArray(ex.sm) ? ex.sm : []

  return (
    <div
      className="card"
      style={{
        background: 'var(--surface-3, #161821)',
        border: '1px solid var(--border)',
        borderTop: 'none',
        borderRadius: '0 0 12px 12px',
        padding: compact ? '12px' : '16px',
        marginTop: -2,
        marginBottom: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* 1. DEMONSTRATION MEDIA (Video > GIF > Image > Unavailable) */}
      <div style={{ width: '100%', position: 'relative' }}>
        {mediaInfo.type === 'video' && !mediaError && (
          <div
            style={{
              position: 'relative',
              borderRadius: 10,
              overflow: 'hidden',
              background: '#000',
              maxHeight: 220,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <video
              src={mediaInfo.src}
              controls
              autoPlay
              loop
              muted
              playsInline
              onError={() => setMediaError(true)}
              style={{
                width: '100%',
                maxHeight: 220,
                objectFit: 'contain',
                display: 'block'
              }}
            />
          </div>
        )}

        {(mediaInfo.type === 'gif' || mediaInfo.type === 'image') && !mediaError && (
          <div
            onClick={() => {
              if (mediaInfo.type === 'gif') setPlaying(p => !p)
            }}
            style={{
              position: 'relative',
              borderRadius: 10,
              overflow: 'hidden',
              background: '#fff',
              maxHeight: 220,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: mediaInfo.type === 'gif' ? 'pointer' : 'default',
              border: '1px solid var(--card-border)'
            }}
            title={mediaInfo.type === 'gif' ? (playing ? t('Tap to pause animation') : t('Tap to play animation')) : ''}
          >
            <img
              src={currentImgSrc}
              alt={exName}
              loading="lazy"
              decoding="async"
              onError={handleMediaError}
              style={{
                width: '100%',
                maxHeight: 220,
                objectFit: 'contain',
                display: 'block'
              }}
            />
            {mediaInfo.type === 'gif' && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  backdropFilter: 'blur(4px)'
                }}
              >
                <Icon name={playing ? 'pause' : 'play'} style={{ fontSize: 11 }} />
                {playing ? t('tap to pause') : t('tap to play')}
              </span>
            )}
          </div>
        )}

        {(mediaInfo.type === 'none' || mediaError) && (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              background: 'var(--surface-2)',
              borderRadius: 10,
              border: '1px dashed var(--border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--label-3)'
              }}
            >
              <Icon name="dumbbell" style={{ fontSize: 22 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
                {t('Preview demonstration unavailable')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--label-2)', marginTop: 2 }}>
                {t('No visual asset is registered for this exercise. Refer to instructions below.')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. EXERCISE METADATA TAGS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {targetMuscle && (
          <span
            className="tag acc"
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'capitalize',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Icon name="target" style={{ fontSize: 12 }} />
            {t(targetMuscle)}
          </span>
        )}
        {bodyPart && (
          <span
            className="tag"
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'capitalize'
            }}
          >
            {t(bodyPart)}
          </span>
        )}
        <span
          className="tag"
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'capitalize',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <Icon name="dumbbell" style={{ fontSize: 12 }} />
          {t(equipment)}
        </span>
        {secondaryMuscles.slice(0, 3).map((sm, idx) => (
          <span
            key={idx}
            className="tag"
            style={{
              fontSize: 10,
              color: 'var(--label-2)',
              textTransform: 'capitalize'
            }}
          >
            +{t(sm)}
          </span>
        ))}
      </div>

      {/* 3. STEP-BY-STEP INSTRUCTIONS */}
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: 'var(--label-2)',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Icon name="list" style={{ fontSize: 13, color: 'var(--mint)' }} />
          {t('Step-by-Step Execution')}
        </div>

        {steps.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {steps.map((step, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: 12,
                  lineHeight: '1.45',
                  color: 'var(--label)'
                }}
              >
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'var(--surface-2)',
                    color: 'var(--mint)',
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                    flexShrink: 0
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ flex: 1 }}>{step}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--label-3)', fontStyle: 'italic' }}>
            {t('Follow standard gym safety and controlled range of motion for this exercise.')}
          </div>
        )}
      </div>

      {/* 4. POSTURE & MOVEMENT GUIDANCE */}
      <div
        style={{
          background: 'rgba(52, 199, 89, 0.08)',
          border: '1px solid rgba(52, 199, 89, 0.25)',
          borderRadius: 10,
          padding: '10px 12px'
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: 'var(--mint)',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Icon name="shield" style={{ fontSize: 13 }} />
          {t('Posture & Movement Guidance')}
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {postureTips.map((tip, idx) => (
            <li
              key={idx}
              style={{
                fontSize: 11,
                lineHeight: '1.4',
                color: 'var(--label-2)'
              }}
            >
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* 5. FOOTER CONTROLS: Selection Confirmation + Collapse */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTop: '1px solid var(--border)',
          gap: 10,
          flexWrap: 'wrap'
        }}
      >
        {onToggleSelect && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onToggleSelect()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: isSelected ? 'rgba(52, 199, 89, 0.2)' : 'var(--mint)',
              color: isSelected ? 'var(--mint)' : '#fff',
              border: isSelected ? '1px solid var(--mint)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Icon name={isSelected ? 'check' : 'plus'} style={{ fontSize: 13 }} />
            {isSelected ? t('Selected (Tap to Remove)') : t('+ Select Exercise')}
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onClose()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: 'transparent',
              color: 'var(--label-2)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            <Icon name="chevronUp" style={{ fontSize: 12 }} />
            {t('Collapse')}
          </button>
        )}
      </div>
    </div>
  )
}
