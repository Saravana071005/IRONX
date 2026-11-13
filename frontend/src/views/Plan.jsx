import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet, startFlow } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { coachAvailable } from '../lib/coach.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { exOr } from '../lib/exercises.js'
import { Thumb } from '../components/Media.jsx'

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const coachOn = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE })

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  const categories = ['All', 'Strength', 'Cardio', 'HIIT', 'Mobility', 'Schedule']

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  // Filter routines by search and category
  const filteredRoutines = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return (S.routines || []).filter(r => {
      const matchSearch = !q || r.name.toLowerCase().includes(q) || (r.ex || []).some(e => {
        const ex = exOr(e.id)
        return (ex.n || '').toLowerCase().includes(q)
      })
      if (!matchSearch) return false

      if (activeCategory === 'All' || activeCategory === 'Schedule') return true
      if (activeCategory === 'Strength') {
        return r.name.toLowerCase().includes('strength') || r.name.toLowerCase().includes('push') || r.name.toLowerCase().includes('pull') || r.name.toLowerCase().includes('leg') || (r.ex || []).length > 0
      }
      if (activeCategory === 'Cardio') {
        return r.name.toLowerCase().includes('cardio') || r.name.toLowerCase().includes('run') || (r.ex || []).some(e => exOr(e.id).eq === 'cardio')
      }
      if (activeCategory === 'HIIT') {
        return r.name.toLowerCase().includes('hiit') || r.name.toLowerCase().includes('burn') || r.name.toLowerCase().includes('circuit')
      }
      if (activeCategory === 'Mobility') {
        return r.name.toLowerCase().includes('mobility') || r.name.toLowerCase().includes('stretch') || r.name.toLowerCase().includes('yoga')
      }
      return true
    })
  }, [S.routines, searchQuery, activeCategory])

  return (
    <div className="narrow">
      {/* Header */}
      <div className="hdr" style={{ alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.025em' }}>
            {t('Workouts & Plans')}
          </h1>
          <div className="sub" style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2 }}>
            {t('{0} routines · weekly plan', (S.routines || []).length)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {coachOn && (
            <button
              className="iconbtn"
              onClick={() => nav('/coach')}
              aria-label={t('Coach')}
              title={t('Coach')}
            >
              <Icon name="sparkles" />
            </button>
          )}
          <button
            className="iconbtn"
            onClick={planToolsSheet}
            aria-label={t('Share or backup plan')}
            title={t('Share or backup plan')}
          >
            <Icon name="upload" />
          </button>
          <button
            className="iconbtn"
            style={{ background: 'var(--mint-light)', color: 'var(--mint)' }}
            onClick={addRoutine}
            aria-label={t('New routine')}
            title={t('New routine')}
          >
            <Icon name="plus" />
          </button>
        </div>
      </div>

      {/* Featured Weekly Workout Planner Card */}
      <div
        className="card"
        style={{
          padding: '16px 18px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(14, 116, 144, 0.08) 100%)',
          border: '1.5px solid var(--mint)',
          borderRadius: 16,
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="tag acc" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999 }}>
                {t('Custom System')}
              </span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--label)' }}>
                {t('Weekly Workout Planner')}
              </h2>
            </div>
            <div style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 4 }}>
              {t('4 Days Strength · 2 Days Cardio · 1 Day Rest · Exercise Library')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="primary" icon="calendar" onClick={() => nav('/planner')}>
              {t('Open Planner')}
            </Button>
            <Button size="sm" variant="tinted" icon="list" onClick={() => nav('/exercise-library')}>
              {t('Exercise Library')}
            </Button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--surface)',
          padding: '10px 16px',
          borderRadius: '9999px',
          boxShadow: 'var(--card-shadow)',
          border: 'var(--card-border)',
          marginBottom: 12
        }}
      >
        <span style={{ color: 'var(--label-3)', fontSize: 18, display: 'flex', alignItems: 'center' }}>
          <Icon name="magnifier" />
        </span>
        <input
          type="text"
          placeholder={t('Search workouts...')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            background: 'none',
            color: 'var(--label)',
            fontSize: 15,
            outline: 'none',
            minWidth: 0
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ color: 'var(--label-3)', padding: 4, display: 'flex', alignItems: 'center' }}
            aria-label="Clear search"
          >
            <Icon name="xmark" />
          </button>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="chips" style={{ marginBottom: 16 }}>
        {categories.map(c => (
          <button
            key={c}
            className={`chip ${activeCategory === c ? 'on' : ''}`}
            onClick={() => setActiveCategory(c)}
          >
            {t(c)}
          </button>
        ))}
      </div>

      {/* If category is Schedule or All, render week schedule */}
      {(activeCategory === 'Schedule' || activeCategory === 'All') && !searchQuery && (
        <div style={{ marginBottom: 20 }}>
          <div className="row between" style={{ marginBottom: 8, padding: '0 4px' }}>
            <h4 className="sec" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--label-2)' }}>
              {t('Week Schedule')}
            </h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn sm ghost"
                style={{ fontSize: 12, padding: '3px 8px', color: 'var(--mint)' }}
                onClick={() => nav('/planner')}
              >
                {t('Open Full Planner')} &rarr;
              </button>
            </div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1, 2, 3, 4, 5, 6, 0].map(d => {
                const r = (S.routines || []).find(x => x.id === S.week?.[d])
                return (
                  <div
                    key={d}
                    onClick={() => nav(`/planner/day/${d}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: r ? 'var(--surface-2)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background var(--fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)', width: 85 }}>
                        {t(DAYN[d])}
                      </span>
                      {r ? (
                        <span className="tag acc" style={{ fontSize: 12, padding: '3px 8px', borderRadius: 9999 }}>
                          <Icon name={glyphOf(r.emoji)} style={{ marginRight: 4, fontSize: 13 }} />
                          {r.name}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--label-3)' }}>{t('Rest Day')}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--label-3)' }}>{t('Edit')}</span>
                      <Icon name="chevronRight" className="chev" style={{ fontSize: 14, color: 'var(--label-3)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Workout Routine Cards */}
      {activeCategory !== 'Schedule' && (
        <div style={{ marginBottom: 24 }}>
          <div className="row between" style={{ marginBottom: 10, padding: '0 4px' }}>
            <h4 className="sec" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--label-2)' }}>
              {t('Available Workouts')} ({filteredRoutines.length})
            </h4>
            <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>
              {t('New Routine')}
            </Button>
          </div>

          {filteredRoutines.length > 0 ? (
            <div>
              {filteredRoutines.map(r => {
                const estMin = Math.max(20, (r.ex || []).length * 9)
                const firstEx = (r.ex || []).length > 0 ? exOr(r.ex[0].id) : null
                return (
                  <div
                    key={r.id}
                    className="workout-card"
                    onClick={() => nav('/plan/r/' + r.id)}
                  >
                    {/* Thumbnail box */}
                    <div className="workout-card-thumb">
                      {firstEx && firstEx.img ? (
                        <Thumb ex={firstEx} />
                      ) : (
                        <Icon name={glyphOf(r.emoji) || 'dumbbell'} />
                      )}
                    </div>

                    {/* Workout Info */}
                    <div className="workout-card-info">
                      <div className="workout-card-title">{r.name}</div>
                      <div className="workout-card-meta">
                        <span>{estMin} min</span>
                        <span>·</span>
                        <span>{exCount((r.ex || []).length)}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn sm"
                        style={{
                          background: 'var(--mint)',
                          color: '#fff',
                          fontWeight: 600,
                          padding: '7px 12px',
                          fontSize: 13,
                          borderRadius: 9999
                        }}
                        onClick={() => startFlow(r.id)}
                      >
                        {t('Start')}
                      </button>
                      <button
                        className="workout-card-action"
                        onClick={() => nav('/plan/r/' + r.id)}
                        aria-label="View routine details"
                      >
                        <Icon name="chevronRight" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ fontSize: 36, color: 'var(--label-3)', marginBottom: 12 }}>
                <Icon name="clipboard" />
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--label)', marginBottom: 6 }}>
                {searchQuery ? t('No routines found matching "{0}"', searchQuery) : t('No routines yet')}
              </div>
              <div className="muted small" style={{ marginBottom: 16 }}>
                {t('Create your own custom workout or load the ready-made 6-day split.')}
              </div>
              <Button variant="primary" icon="calendar" onClick={() => nav('/planner')}>
                {t('Open Weekly Workout Planner')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
