import { useEffect, useState, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bindUI } from './components/ui.jsx'
import { ACCENTS } from './lib/format.js'
import { setLang, useLang, t } from './lib/i18n.js'
import { setNav } from './lib/nav.js'
import { useWakeLock } from './lib/wakelock.js'
import { startFlow } from './sheets.jsx'
import { applyThemeToDocument } from './lib/themes.js'
import Icon from './components/Icon.jsx'
import IronXLogo from './components/IronXLogo.jsx'
import TabBar from './components/TabBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import RestTimer from './components/RestTimer.jsx'
import Login from './views/Login.jsx'
import Home from './views/Home.jsx'

// Lazy-loaded routes for code-splitting and ultra-fast initial bundle
const Plan = lazy(() => import('./views/Plan.jsx'))
const RoutineEdit = lazy(() => import('./views/RoutineEdit.jsx'))
const Workout = lazy(() => import('./views/Workout.jsx'))
const Stats = lazy(() => import('./views/Stats.jsx'))
const History = lazy(() => import('./views/History.jsx'))
const Library = lazy(() => import('./views/Library.jsx'))
const Settings = lazy(() => import('./views/Settings.jsx'))
const Admin = lazy(() => import('./views/Admin.jsx'))
const Nutrition = lazy(() => import('./views/Nutrition.jsx'))
const WeeklyPlanner = lazy(() => import('./views/WeeklyPlanner.jsx'))
const DayPlanner = lazy(() => import('./views/DayPlanner.jsx'))
const ExerciseLibrary = lazy(() => import('./views/ExerciseLibrary.jsx'))
const ProfileSetup = lazy(() => import('./views/ProfileSetup.jsx'))
const AuthCallback = lazy(() => import('./views/AuthCallback.jsx'))

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

function applyPrefs(S) {
  const de = document.documentElement
  de.dataset.theme = S.theme === 'dark' ? 'dark' : 'light'
  de.dataset.accent = ACCENTS[S.accent] ? S.accent : 'mint'
  if (S.stealthDim && S.stealthMode) de.classList.add('stealth-dim')
  else de.classList.remove('stealth-dim')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = de.dataset.theme === 'dark' ? '#07080c' : '#fbf9f5'
  applyThemeToDocument(S)
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const { S, user, ready } = useStore()
  const isGuest = useStore(s => s.isGuest())
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => { applyPrefs(S) }, [S.theme, S.accent, S.stealthDim, S.stealthMode, S.bgTheme, S.glowIntensity, S.upperGlowIntensity, S.blurIntensity, S.bgAnimation, S.customGlow1, S.customGlow2, S.customGlow3, S.customGlow4])
  useEffect(() => { setLang(S.lang || 'en') }, [S.lang])
  useEffect(() => { document.documentElement.lang = S.lang || 'en' }, [langV, S.lang])
  // every tab/route change starts at the top of the page and closes mobile drawer
  useEffect(() => {
    window.scrollTo(0, 0)
    setMobileDrawerOpen(false)
  }, [loc.pathname])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && S.keepAwake !== false)

  const isAuthCallback = loc.pathname === '/auth-callback'
  const isProfileSetup = loc.pathname === '/profile-setup'
  const authed = user || isGuest

  // Profile setup redirect: If user is authenticated via Google but profile setup is incomplete,
  // guide them into the existing profile setup flow.
  useEffect(() => {
    if (ready && user && !isGuest && !user.profile?.completed && !isProfileSetup && !isAuthCallback) {
      navigate('/profile-setup', { replace: true })
    }
  }, [ready, user, isGuest, isProfileSetup, isAuthCallback, navigate])

  // Simple loading screen while initializing — pure black background, small spinner, "Loading..."
  // No logo, brand name, slogan, decorative glow, or additional text.
  if (!ready && !isAuthCallback) {
    return (
      <div
        id="app"
        style={{
          background: '#000000',
          minHeight: '100vh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}
        role="status"
        aria-live="polite"
      >
        <div className="simple-loading-spinner" />
        <span style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '13px', fontWeight: 500, letterSpacing: '0.02em', fontFamily: 'var(--font-sans)' }}>
          Loading...
        </span>
      </div>
    )
  }

  return (
    <>
      <div className="aurora-fusion-bg" aria-hidden="true">
        <div className="aurora-glow aurora-glow-1" />
        <div className="aurora-glow aurora-glow-2" />
        <div className="aurora-glow aurora-glow-3" />
        <div className="aurora-glow aurora-glow-4" />
      </div>

      <div className="layout-shell">
        <Sidebar
          onStart={startFlow}
          mobileOpen={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
        />
        <main className="layout-main">
          {authed && (
            <header className="mobile-header-bar" role="banner">
              <button
                className="mobile-header-btn"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label={t('Open navigation menu')}
              >
                <Icon name="bars" />
              </button>
              <div className="mobile-header-brand" onClick={() => navigate('/home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                <IronXLogo size={28} />
                <span className="sidebar-brand-title" style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--label)' }}>IRONX</span>
              </div>
              <div className="mobile-header-actions">
                {S.active ? (
                  <button
                    className="mobile-header-active-pill"
                    onClick={() => navigate('/workout')}
                    title={t('Resume active workout')}
                  >
                    <span className="mobile-active-pulse" />
                    <span>{t('Active')}</span>
                  </button>
                ) : (
                  <button
                    className="mobile-header-btn"
                    onClick={() => navigate('/settings')}
                    aria-label={t('Settings')}
                  >
                    <Icon name="gear" />
                  </button>
                )}
              </div>
            </header>
          )}

          {/* keyed on the route: a view that throws is contained, and switching tabs
              re-mounts the boundary, so the tab bar is always a way out */}
          <div id="app" className="vfade" key={loc.pathname}>
            <ErrorBoundary>
              <Suspense fallback={
                <div style={{ paddingTop: '38vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div className="simple-loading-spinner" />
                  <span style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--label-3)' }}>Loading...</span>
                </div>
              }>
                {!authed && !isAuthCallback ? <Login /> : (
                  <Routes>
                    <Route path="/auth-callback" element={<AuthCallback />} />
                    <Route path="/profile-setup" element={<ProfileSetup />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/" element={<Navigate to="/home" replace />} />
                    <Route path="/planner" element={<WeeklyPlanner />} />
                    <Route path="/planner/day/:dayId" element={<DayPlanner />} />
                    <Route path="/exercise-library" element={<ExerciseLibrary />} />
                    <Route path="/plan" element={<Plan />} />
                    <Route path="/plan/r/:id" element={<RoutineEdit />} />
                    <Route path="/workout" element={<Workout />} />
                    <Route path="/stats" element={<Stats />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/library" element={<Library />} />
                    <Route path="/nutrition" element={<Nutrition />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/admin" element={user?.admin ? <Admin /> : <Navigate to="/home" replace />} />
                    <Route path="*" element={<Navigate to={authed ? "/home" : "/"} replace />} />
                  </Routes>
                )}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <TabBar onStart={startFlow} />
      <RestTimer />
      <Modals />
      <Toast />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  return <HashRouter><Shell /></HashRouter>
}
