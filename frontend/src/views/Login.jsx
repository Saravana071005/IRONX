import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { startGoogleLogin } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: 10, flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}

export default function Login() {
  const setGuest = useStore(s => s.setGuest)

  useEffect(() => {
    // Check for error in query or hash
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    const queryString = hash.includes('?') ? hash.split('?')[1] : (search.startsWith('?') ? search.slice(1) : '')
    if (queryString) {
      const params = new URLSearchParams(queryString)
      const err = params.get('error')
      if (err) {
        useUI.getState().toast(t('Sign-in failed: {0}', decodeURIComponent(err)))
      }
    }
  }, [])

  const head = (
    <>
      <div style={{ fontSize: 54, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}>
        <Icon name="dumbbell" />
      </div>
      <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.028em', margin: '10px 0 4px' }}>openGym</h1>
    </>
  )
  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }

  // Demo build (GitHub Pages): no backend to sign in against
  if (DEMO) {
    return (
      <div className="narrow" style={wrap}>
        {head}
        <div className="muted" style={{ marginBottom: 30 }}>{t('Live demo — everything stays in this browser.')}</div>
        <Button variant="primary" icon="sparkles" onClick={() => setGuest(true)}>{t('Start the demo')}</Button>
        <div className="card small muted" style={{ textAlign: 'left', marginTop: 16 }}>
          {t('This demo runs entirely in your browser on example data — nothing is sent anywhere. Cloud sync and personal fitness profiles come with the openGym server.')}
        </div>
        <div className="dim small" style={{ marginTop: 22, lineHeight: 1.6 }}>
          <a href={REPO} target="_blank" rel="noopener">{t('Self-host it in a minute →')}</a>
        </div>
      </div>
    )
  }

  return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 34 }}>{t('Your workouts. Your weights. Your profile.')}</div>

      {/* Primary: Continue with Google */}
      <button
        type="button"
        className="btn"
        onClick={() => startGoogleLogin('/home', 'login')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          padding: '13px 20px',
          borderRadius: 12,
          fontWeight: 600,
          background: '#ffffff',
          color: '#1f1f1f',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          border: '1px solid #dadce0',
          cursor: 'pointer',
          width: '100%',
          transition: 'transform 0.1s ease, box-shadow 0.1s ease'
        }}
      >
        <GoogleIcon />
        {t('Continue with Google')}
      </button>

      <div style={{ height: 12 }} />

      {/* Secondary: Continue as Guest */}
      <Button variant="ghost" className="dim" onClick={() => setGuest(true)} style={{ width: '100%', fontSize: 15 }}>
        {t('Continue as Guest')}
      </Button>

      <div className="dim small" style={{ marginTop: 28, lineHeight: 1.5 }}>
        {t('Sign in with Google to sync your personal fitness profile, workout plans, and health logs across devices.')}
        <br />
        {t('Guest mode saves temporary data on this device only.')}
      </div>
    </div>
  )
}
