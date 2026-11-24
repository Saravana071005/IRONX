import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import IronXLogo from './IronXLogo.jsx'

export default function Sidebar({ onStart, mobileOpen = false, onClose }) {
  const nav = useNavigate()
  const loc = useLocation()
  const { S, user } = useStore()
  const isGuest = useStore(s => s.isGuest())

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('opengym_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  if (!user && !isGuest) return null

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem('opengym_sidebar_collapsed', String(next))
      } catch {}
      return next
    })
  }

  const cur = loc.pathname.split('/')[1] || 'home'
  const isActive = k => {
    if (k === 'home') return cur === 'home'
    if (k === 'planner') return cur === 'planner'
    if (k === 'exercise-library') return cur === 'exercise-library'
    if (k === 'plan') return cur === 'plan'
    if (k === 'workout') return cur === 'workout'
    if (k === 'library') return cur === 'library'
    if (k === 'nutrition') return cur === 'nutrition'
    if (k === 'stats') return cur === 'stats'
    if (k === 'history') return cur === 'history'
    if (k === 'settings') return cur === 'settings'
    if (k === 'coach') return cur === 'coach'
    if (k === 'admin') return cur === 'admin'
    return false
  }

  const handleNav = (to) => {
    nav(to)
    if (mobileOpen && onClose) {
      onClose()
    }
  }

  const startWorkout = () => {
    if (!S.active) {
      const r = effectiveRoutine(S, todayISO())
      if (r && r.ex.length && onStart) {
        onStart(r.id)
        if (mobileOpen && onClose) onClose()
        return
      }
    }
    handleNav('/workout')
  }

  const NavItem = ({ k, icon, to, label, badge }) => {
    const active = isActive(k)
    return (
      <button
        className={`sidebar-nav-item ${active ? 'active' : ''} ${collapsed ? 'icon-only' : ''}`}
        onClick={() => handleNav(to)}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? label : undefined}
        aria-label={label}
      >
        <span className="sidebar-nav-icon"><Icon name={icon} /></span>
        {!collapsed && <span className="sidebar-nav-label">{label}</span>}
        {badge && <span className="sidebar-nav-badge">{badge}</span>}
      </button>
    )
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        id="sidebar"
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        aria-label={t('Sidebar Navigation')}
      >
        <div className="sidebar-header">
          <div
            className="sidebar-brand"
            onClick={() => handleNav('/home')}
            title="IRONX Home"
          >
            <IronXLogo size={collapsed ? 30 : 34} />
            {!collapsed && (
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-title">IRONX</span>
              </div>
            )}
          </div>

          {/* Desktop collapse toggle / Mobile close button */}
          <div className="sidebar-header-actions">
            {mobileOpen ? (
              <button
                className="sidebar-toggle-btn mobile-close"
                onClick={onClose}
                aria-label={t('Close navigation drawer')}
                title={t('Close')}
              >
                <Icon name="xmark" />
              </button>
            ) : (
              <button
                className="sidebar-toggle-btn desktop-collapse"
                onClick={toggleCollapsed}
                aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}
                title={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}
              >
                <Icon name={collapsed ? "chevronRight" : "bars"} />
              </button>
            )}
          </div>
        </div>

        {/* Start / Active workout button */}
        <div className="sidebar-action-wrap">
          {S.active ? (
            <button
              className={`sidebar-active-btn ${collapsed ? 'icon-only' : ''}`}
              onClick={() => handleNav('/workout')}
              title={collapsed ? t('Workout in progress — Resume') : undefined}
            >
              <span className="sidebar-pulse-dot" />
              {!collapsed && (
                <div className="sidebar-active-info">
                  <span className="sidebar-active-title">{t('Workout active')}</span>
                  <span className="sidebar-active-desc">{t('Resume')} &rarr;</span>
                </div>
              )}
              <Icon name="play" />
            </button>
          ) : (
            <button
              className={`sidebar-start-btn ${collapsed ? 'icon-only' : ''}`}
              onClick={startWorkout}
              title={collapsed ? t('Start workout') : undefined}
            >
              <Icon name="dumbbell" />
              {!collapsed && <span>{t('Start workout')}</span>}
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav className="sidebar-nav">
          {!collapsed && <div className="sidebar-nav-group-title">{t('Navigation')}</div>}
          <NavItem k="home" icon="house" to="/home" label={t('Home')} />
          <NavItem k="planner" icon="calendar" to="/planner" label={t('Weekly Planner')} />
          <NavItem k="exercise-library" icon="list" to="/exercise-library" label={t('Exercise Library')} />
          <NavItem k="workout" icon={S.active ? "play" : "dumbbell"} to="/workout" label={t('Workout')} badge={S.active ? '●' : null} />
          <NavItem k="nutrition" icon="nutrition" to="/nutrition" label={t('Daily Health Log')} />
          <NavItem k="stats" icon="chart" to="/stats" label={t('Stats')} />
          <NavItem k="history" icon="history" to="/history" label={t('History')} />

          {!collapsed && <div className="sidebar-nav-group-title" style={{ marginTop: 14 }}>{t('Preferences')}</div>}
          <NavItem k="settings" icon="gear" to="/settings" label={t('Settings')} />
          {user?.admin && <NavItem k="admin" icon="wrench" to="/admin" label={t('Admin')} />}
        </nav>

        {/* User profile footer */}
        <div className="sidebar-footer">
          {!collapsed && (
            <div style={{ padding: '0 4px 12px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                <span style={{ fontWeight: 700, color: 'var(--label)' }}>Level 28</span>
                <span style={{ color: 'var(--label-3)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>XP 7,420 / 8,000</span>
              </div>
              <div style={{ height: 4, borderRadius: 9999, background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                <div style={{ width: '92%', height: '100%', background: 'linear-gradient(90deg, #A5A5A5, #F5F5F5)', borderRadius: 9999 }} />
              </div>
            </div>
          )}
          <div
            className={`sidebar-user-card ${collapsed ? 'icon-only' : ''}`}
            onClick={() => handleNav('/settings')}
            title={user ? (user.name || user.id) : t('Guest Mode')}
          >
            <div className="sidebar-user-avatar">
              <Icon name={user ? "personCircle" : "key"} />
            </div>
            {!collapsed && (
              <>
                <div className="sidebar-user-info">
                  <span className="sidebar-user-name">
                    {user ? (user.name || user.id) : 'Saravana Kumar'}
                  </span>
                  <span className="sidebar-user-meta">
                    {user?.admin ? t('Admin') : t('Athlete')}
                  </span>
                </div>
                <Icon name="chevronRight" size={14} style={{ color: 'var(--label-3)', flex: 'none', marginLeft: 4 }} />
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
