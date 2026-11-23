import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  const scrollRef = useRef(null)
  const activeBtnRef = useRef(null)

  if (!user && !isGuest) return null

  const cur = loc.pathname.split('/')[1] || 'home'

  // The 7 official destinations as specified in Section 6
  const destinations = [
    {
      id: 'home',
      label: t('Home'),
      icon: 'house',
      to: '/home',
      active: cur === 'home' || cur === ''
    },
    {
      id: 'weekly',
      label: t('Weekly'),
      icon: 'calendar',
      to: '/planner',
      active: cur === 'planner'
    },
    {
      id: 'exercises',
      label: t('Exercise Library'),
      icon: 'book',
      to: '/exercise-library',
      active: cur === 'exercise-library' || cur === 'library'
    },
    {
      id: 'workout',
      label: t('Workout'),
      icon: 'dumbbell',
      to: '/workout',
      active: cur === 'workout' || cur === 'plan',
      badge: !!S?.active
    },
    {
      id: 'health',
      label: t('Health Logs'),
      icon: 'nutrition',
      to: '/nutrition',
      active: cur === 'nutrition'
    },
    {
      id: 'stats',
      label: t('Stats'),
      icon: 'chart',
      to: '/stats',
      active: cur === 'stats'
    },
    {
      id: 'history',
      label: t('History'),
      icon: 'history',
      to: '/history',
      active: cur === 'history'
    }
  ]

  // Automatically scroll the active tab smoothly into view when active tab changes
  useEffect(() => {
    if (activeBtnRef.current && scrollRef.current) {
      activeBtnRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      })
    }
  }, [cur])

  return (
    <nav
      id="tabbar"
      className="liquid-glass-tabbar"
      role="navigation"
      aria-label="Main Navigation"
    >
      <div className="tabbar-scroll-track" ref={scrollRef}>
        {destinations.map(dest => {
          const isActive = dest.active
          return (
            <button
              key={dest.id}
              ref={isActive ? activeBtnRef : null}
              className={`tab-btn ${isActive ? 'on active' : ''}`}
              onClick={() => nav(dest.to)}
              aria-label={dest.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="tab-icon-wrap">
                <Icon name={dest.icon} />
                {dest.badge && <span className="tab-badge" />}
              </div>
              <span className="tab-label">{dest.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
