import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, hasData, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api, importGuestProgress } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

export default function AuthCallback() {
  const navigate = useNavigate()
  const setUser = useStore(s => s.setUser)
  const pullState = useStore(s => s.pullState)
  const toast = useUI(s => s.toast)

  const [loading, setLoading] = useState(true)
  const [pendingGuestState, setPendingGuestState] = useState(null)
  const [targetPath, setTargetPath] = useState('/home')

  useEffect(() => {
    async function processAuth() {
      try {
        const hash = window.location.hash || ''
        const search = window.location.search || ''
        const qStr = hash.includes('?') ? hash.split('?')[1] : (search.startsWith('?') ? search.slice(1) : '')
        const params = new URLSearchParams(qStr)

        const token = params.get('token')
        const target = params.get('target') || '/home'
        const isNew = params.get('isNew') === '1'

        if (token) {
          localStorage.setItem('gym_auth_token', token)
        }

        // Fetch current user from /api/me
        const me = await api('/api/me')
        setUser(me.user)
        localStorage.removeItem('gym_guest')

        // Check if there was guest data in localStorage
        let localState = null
        try {
          const raw = localStorage.getItem('gym_state_v1')
          if (raw) localState = JSON.parse(raw)
        } catch {}

        const finalTarget = isNew || !me.user?.profile?.completed ? '/profile-setup' : target

        if (localState && hasData(localState)) {
          // Guest data exists: prompt user before merging
          setPendingGuestState(localState)
          setTargetPath(finalTarget)
          setLoading(false)
        } else {
          // No guest data, pull cloud state and navigate immediately
          await pullState()
          navigate(finalTarget, { replace: true })
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        toast(t('Sign-in failed: {0}', err.message))
        navigate('/login', { replace: true })
      }
    }

    processAuth()
  }, [navigate, setUser, pullState, toast])

  const handleImport = async () => {
    setLoading(true)
    try {
      await importGuestProgress(pendingGuestState)
      await pullState()
      toast(t('Guest progress merged into your Google account!'))
    } catch (e) {
      toast(t('Failed to merge guest data: {0}', e.message))
    }
    navigate(targetPath, { replace: true })
  }

  const handleSkip = async () => {
    setLoading(true)
    await pullState()
    navigate(targetPath, { replace: true })
  }

  if (loading) {
    return (
      <div id="app" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <div style={{ fontSize: 44, color: 'var(--acc)', marginBottom: 16 }}>
          <Icon name="dumbbell" />
        </div>
        <p className="muted">{t('Connecting to Google and syncing your fitness profile...')}</p>
      </div>
    )
  }

  if (pendingGuestState) {
    const workoutCount = (pendingGuestState.workouts || []).length
    const routineCount = (pendingGuestState.routines || []).length
    const mealCount = (pendingGuestState.meals || []).length

    return (
      <div className="narrow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '70vh' }}>
        <div style={{ fontSize: 48, color: 'var(--acc)', textAlign: 'center', marginBottom: 10 }}>
          <Icon name="sparkles" />
        </div>
        <h2 style={{ textAlign: 'center', margin: '0 0 10px' }}>{t('Save Guest Progress?')}</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 20 }}>
          {t('We found {0} workouts, {1} routines, and {2} nutrition logs from your guest session.', workoutCount, routineCount, mealCount)}
        </p>

        <div className="card" style={{ marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
          <div>✅ {t('Keep all guest workouts and personal records')}</div>
          <div>✅ {t('Prevent duplicates automatically')}</div>
          <div>✅ {t('Sync securely with your Google cloud profile')}</div>
        </div>

        <Button variant="primary" onClick={handleImport} style={{ fontSize: 16, padding: '13px 20px', borderRadius: 12, marginBottom: 10 }}>
          {t('Merge Guest Progress into Google Account')}
        </Button>

        <Button variant="ghost" className="dim" onClick={handleSkip}>
          {t('Keep Cloud Data Only')}
        </Button>
      </div>
    )
  }

  return null
}
