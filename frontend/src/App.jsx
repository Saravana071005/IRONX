import { useEffect, useState } from 'react'
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
import IronHouseLogo from './components/IronHouseLogo.jsx'
import TabBar from './components/TabBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import RestTimer from './components/RestTimer.jsx'
import Login from './views/Login.jsx'
import Home from './views/Home.jsx'
import Plan from './views/Plan.jsx'
import RoutineEdit from './views/RoutineEdit.jsx'
import Workout from './views/Workout.jsx'
import Stats from './views/Stats.jsx'
import History from './views/History.jsx'
import Library from './views/Library.jsx'
import Settings from './views/Settings.jsx'
import Admin from './views/Admin.jsx'
import Coach from './views/Coach.jsx'
import CoachIntake from './views/CoachIntake.jsx'
import CoachProposal from './views/CoachProposal.jsx'
import Nutrition from './views/Nutrition.jsx'
import WeeklyPlanner from './views/WeeklyPlanner.jsx'
import DayPlanner from './views/DayPlanner.jsx'
import ExerciseLibrary from './views/ExerciseLibrary.jsx'
import ProfileSetup from './views/ProfileSetup.jsx'
import AuthCallback from './views/AuthCallback.jsx'

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

function applyPrefs(S) {
  const de = document.documentElement
  de.dataset.theme = S.theme === 'dark' ? 'dark' : 'light'
  de.dataset.accent = ACCENTS[S.accent] ? S.accent : 'mint'
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
  useEffect(() => { applyPrefs(S) }, [S.theme, S.accent, S.bgTheme, S.glowIntensity, S.upperGlowIntensity, S.blurIntensity, S.bgAnimation, S.customGlow1, S.customGlow2, S.customGlow3, S.customGlow4])
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
  const authed = user || isGuest
  if (!ready && !authed && !isAuthCallback) return (
    <div id="app">
      <div style={{ paddingTop: '42vh', display: 'flex', justifyContent: 'center' }}>
        <IronHouseLogo size="lg" glow />
      </div>
    </div>
  )

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
              <div className="mobile-header-brand" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
                <IronHouseLogo size="xs" glow />
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
              {!authed && !isAuthCallback ? <Login /> : (
                <Routes>
                  <Route path="/auth-callback" element={<AuthCallback />} />
                  <Route path="/profile-setup" element={<ProfileSetup />} />
                  <Route path="/home" element={<Home />} />
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
                  {/* The Coach screens gate themselves on the instance config; the routes exist
                      unconditionally so a deep link from a notification lands somewhere sane
                      rather than on the catch-all. */}
                  <Route path="/coach" element={<Coach />} />
                  <Route path="/coach/intake" element={<CoachIntake />} />
                  <Route path="/coach/proposal" element={<CoachProposal />} />
                  <Route path="/admin" element={user?.admin ? <Admin /> : <Navigate to="/home" replace />} />
                  <Route path="*" element={<Navigate to={authed ? "/home" : "/"} replace />} />
                </Routes>
              )}
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
