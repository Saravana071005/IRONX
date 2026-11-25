import BODY_PATHS from '../lib/body-paths.js'
import { MUSCLES, INERT, MUSCLE_NAME, levelsOf } from '../lib/muscles.js'
import { t } from '../lib/i18n.js'

function View({ view, levels, onMuscle, selected, viewName, showLabel = true }) {
  if (!view) return null
  return (
    <div className="bm-col">
      {showLabel && <div className="bm-label">{viewName}</div>}
      <svg className="bm-v" viewBox={view.vb} role="img" aria-label={viewName}>
        {INERT.map(slug => (view.p[slug] || []).map((d, i) => (
          <path key={slug + i} className="bm-sil" d={d} />
        )))}
        {MUSCLES.map(slug => (view.p[slug] || []).map((d, i) => {
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

/**
 * <BodyMap load={{ chest: 12, … }} body="male" onMuscle={...} selected={...} />
 * Detailed anatomical human body muscular diagram (Anterior/Front and Posterior/Back).
 * Shading is relative to training load across muscle groups.
 */
export default function BodyMap({
  load = {},
  body = 'male',
  onMuscle,
  selected,
  className = '',
  showLabels = true,
  activeView = 'both'
}) {
  const levels = levelsOf(load)
  const g = BODY_PATHS && (BODY_PATHS[body] || BODY_PATHS.male)
  const showFront = activeView === 'both' || activeView === 'front' || activeView === 'anterior'
  const showBack = activeView === 'both' || activeView === 'back' || activeView === 'posterior'

  return (
    <div className={'bodymap ' + className + (activeView !== 'both' ? ' single-view' : '')}>
      {g ? (
        <>
          {showFront && (
            <View
              view={g.front}
              levels={levels}
              onMuscle={onMuscle}
              selected={selected}
              viewName={t('Anterior (Front)')}
              showLabel={showLabels}
            />
          )}
          {showBack && (
            <View
              view={g.back}
              levels={levels}
              onMuscle={onMuscle}
              selected={selected}
              viewName={t('Posterior (Back)')}
              showLabel={showLabels}
            />
          )}
        </>
      ) : (
        <div className="bm-ph" aria-hidden="true" />
      )}
    </div>
  )
}

export function BodyMapLegend() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        fontSize: 11,
        color: 'var(--label-2)',
        marginTop: 10,
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: 'var(--bm-base, #98624F)',
            border: '1px solid var(--bm-stroke, #775344)'
          }}
        />
        <span>{t('Resting')}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: '#BD806A',
            border: '1px solid #775344'
          }}
        />
        <span>{t('Light / Secondary')}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: '#DFA88E',
            border: '1px solid #BD806A'
          }}
        />
        <span>{t('Moderate')}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: '#F0C2A9',
            border: '1px solid #DFA88E',
            boxShadow: '0 0 6px rgba(240, 194, 169, 0.5)'
          }}
        />
        <span>{t('Primary Target')}</span>
      </div>
    </div>
  )
}
