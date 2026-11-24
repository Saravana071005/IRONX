import { flushQueue, getSyncStatus } from '../lib/offlineQueue.js'
import { PLAN_PRESETS } from '../lib/transformation.js'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, DEF, hasData } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { ACCENTS, todayISO, localTZ } from '../lib/format.js'
import { effortOf } from '../lib/history.js'
import { startGoogleLogin, IS_ANDROID } from '../lib/api.js'
import { pushSupported, enablePush, disablePush, sendTestPush } from '../lib/push.js'
import { wakeLockSupported } from '../lib/wakelock.js'
import { t, LANGS, INSTR_LANGS } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { MOBILE, shareExport, syncReminder } from '../lib/mobile.js'
import { loadStarterPlan, confirmSheet, importFromApp } from '../sheets.jsx'
import { coachAvailable, hasConsent } from '../lib/coach.js'
import { forgetCoach } from '../lib/coach-api.js'
import Icon from '../components/Icon.jsx'
import IronXLogo from '../components/IronXLogo.jsx'
import { Section, Row, SelectRow, Switch, Segmented, Button, TextField } from '../components/ui.jsx'
import {
  ALERT_TONES,
  previewAlertTone,
  requestNotificationPermission,
  triggerRestNotification,
  unlockAudio,
  beep,
  vibrate
} from '../lib/sound.js'
import { THEME_PRESETS } from '../lib/themes.js'

export default function Settings() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const { update, replaceState, setUser, pullState, pushState, signOut, signOutAll, resetDemo, resetAccount } = useStore()
  const toast = useUI(s => s.toast)
  const fileRef = useRef(null)
  const importRef = useRef(null)
  const wakeOK = wakeLockSupported()
  const [resetModalOpen, setResetModalOpen] = useState(false)

  const syncSettingToServer = async (patch) => {
    if (!user) return
    try {
      await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: patch })
      })
    } catch (e) {
      console.error('Failed to sync setting to server:', e)
    }
  }

  const doExport = async () => {
    const json = JSON.stringify(S, null, 2)
    const name = 'ironx-backup-' + todayISO() + '.json'
    // WKWebView can't download blob URLs — the native build hands the file to the share sheet.
    if (MOBILE) {
      try { await shareExport(json, name); toast(t('Backup exported')) } catch (e) { /* share sheet dismissed */ }
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
    toast(t('Backup exported'))
  }
  const doImport = ev => {
    const f = ev.target.files[0]; if (!f) return
    const rd = new FileReader()
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result)
        if (!data.workouts || !data.routines) throw new Error('not an IRONX backup')
        confirmSheet({ title: t('Import backup?'), message: t('This replaces all current data with the backup file.'), confirmText: t('Import'), danger: true, onConfirm: () => { replaceState(Object.assign(JSON.parse(JSON.stringify(DEF)), data), true); toast(t('Backup imported')) } })
      } catch (e) { toast(t('Import failed: {0}', e.message)) }
    }
    rd.readAsText(f)
  }
  // Ends the profile's sessions on every device — this one included, so on success it lands in
  // the same place as the plain sign-out above (home, local data cleared). On failure nothing
  // local is touched: still signed in here, and say so rather than leaving a half-signed-out app.
  const signOutEverywhere = () => confirmSheet({
    title: t('Sign out everywhere?'),
    message: t('Signs this profile out on every device, including this one. You can sign in again with Google anytime.'),
    confirmText: t('Sign out everywhere'), danger: true,
    onConfirm: async () => {
      try { await signOutAll(); nav('/home'); toast(t('Signed out on all devices')) }
      catch (e) { toast(t('Could not sign out everywhere — you are still signed in.')) }
    },
  })

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Settings')}</h1></div>
    </div>

    {/* ---------- account (demo and mobile builds have nothing to sign in to) ---------- */}
    <Section title={MOBILE ? t('Your data') : DEMO ? t('Demo') : t('Account')}>
      {MOBILE ? <>
        <Row icon="lock" iconTint="var(--acc)" title={t('All data stays on this phone')} subtitle={t('No account, no cloud — back it up anytime with Export below.')} />
        <Row icon="rocket" iconTint="var(--indigo)" title={t('Self-host IRONX')} subtitle={t('Google sign-in, sync across your devices, your own data.')} accessory="chevron"
          onClick={() => window.open(REPO, '_blank', 'noopener')} />
      </> : DEMO ? <>
        <Row icon="sparkles" iconTint="var(--theme-accent, #F5F5F5)" title={t('You’re in the demo')} subtitle={t('Example data, stored only in this browser — change anything you like.')} />
        <Row icon="reset" iconTint="var(--theme-accent, #F5F5F5)" title={t('Reset demo data')} accessory="chevron"
          onClick={() => confirmSheet({ title: t('Reset demo data?'), message: t('Puts the example plan, workouts and weigh-ins back the way they started.'), confirmText: t('Reset'), onConfirm: () => { resetDemo(); nav('/home'); toast(t('Demo data reset')) } })} />
        <Row icon="rocket" iconTint="var(--theme-accent, #F5F5F5)" title={t('Self-host IRONX')} subtitle={t('Google sign-in, sync across your devices, your own data.')} accessory="chevron"
          onClick={() => window.open(REPO, '_blank', 'noopener')} />
      </> : user ? <>
        <Row
          icon={user.picture ? null : "personCircle"}
          iconTint="var(--theme-accent, #F5F5F5)"
          title={user.name}
          subtitle={user.email ? `${user.email} · Google Account` : t('Signed in with Google')}
        >
          {user.picture && (
            <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%', marginRight: 10, flexShrink: 0 }} />
          )}
        </Row>
        <Row
          icon="heart"
          iconTint="var(--theme-accent, #F5F5F5)"
          title={t('Personal Fitness Profile')}
          subtitle={user.profile?.fitnessGoal ? t('Goal: {0}', user.profile.fitnessGoal.replace(/_/g, ' ')) : t('Set height, weight, and fitness goals')}
          accessory="chevron"
          onClick={() => nav('/profile-setup')}
        />
        {user.admin && <Row icon="wrench" iconTint="var(--theme-accent, #F5F5F5)" title={t('Admin dashboard')} accessory="chevron" onClick={() => nav('/admin')} />}
        <Row icon="signOut" iconTint="var(--red)" title={t('Sign out')} danger onClick={() => confirmSheet({ title: t('Sign out?'), message: t('Your data is synced to your profile first, then cleared from this device.'), confirmText: t('Sign out'), danger: true, onConfirm: () => { signOut(); nav('/home') } })} />
        <Row icon="shield" iconTint="var(--red)" title={t('Sign out everywhere')} subtitle={t('Ends this profile’s sessions on all your devices.')} danger onClick={signOutEverywhere} />
      </> : (
        <>
          <Row
            icon="lock"
            iconTint="var(--theme-accent, #F5F5F5)"
            title={t('Guest Mode (Local Only)')}
            subtitle={t('Workouts and health logs live only on this browser.')}
          />
          <Row
            icon="sparkles"
            iconTint="var(--theme-accent, #F5F5F5)"
            title={t('Save My Progress with Google')}
            subtitle={t('Back up workouts, custom exercises, and health logs to your Google profile.')}
            accessory="chevron"
            onClick={() => startGoogleLogin('/settings', 'import_guest')}
          />
        </>
      )}
    </Section>

    {/* ---------- transformation & goals ---------- */}
    <Section title={t('Transformation & Goals')} footer={t('Defines your fat-loss deficit plan and weekly training consistency targets.')}>
      <Row icon="calendar" iconTint="var(--blue)" title={t('Weekly workout target')}>
        <Segmented className="seg-inline"
          options={[
            { value: 3, label: '3 / wk' },
            { value: 4, label: '4 / wk' },
            { value: 5, label: '5 / wk' },
            { value: 6, label: '6 / wk' }
          ]}
          value={S.weeklyTarget || 4}
          onChange={v => update(s => { s.weeklyTarget = v })}
        />
      </Row>
      <Row icon="target" iconTint="var(--yellow)" title={t('Fat-loss / Recomp plan')}>
        <Segmented className="seg-inline"
          options={[
            { value: '2-month', label: '2M' },
            { value: '3-month', label: '3M' },
            { value: '4-month', label: '4M' },
            { value: 'custom', label: t('Custom') }
          ]}
          value={S.transformationPlan?.planType || '3-month'}
          onChange={v => update(s => { s.transformationPlan = { ...(s.transformationPlan || {}), planType: v } })}
        />
      </Row>
    </Section>

    {/* ---------- offline synchronization ---------- */}
    <Section title={t('Offline Synchronization')} footer={t('Workouts, nutrition, and weigh-ins are saved locally first and synced automatically upon reconnection.')}>
      <Row icon="cloud" iconTint="var(--teal)" title={t('Sync status')}
        subtitle={(() => {
          const st = getSyncStatus(user?.id)
          return st.state === 'offline' ? t('Offline — changes stored locally') : st.pendingCount > 0 ? t('{0} pending mutation(s)', st.pendingCount) : t('All changes synced to account')
        })()}>
        <Button size="sm" onClick={async () => {
          try {
            await flushQueue(user?.id, pushState)
            await pushState()
            toast(t('Sync complete'))
          } catch (e) {
            toast(t('Sync failed: {0}', e.message || 'offline'))
          }
        }}>{t('Sync now')}</Button>
      </Row>
    </Section>

    {/* ---------- general ---------- */}
    <Section title={t('General')} footer={t('Note: switching units only changes the label — logged numbers are not converted.')}>
      <SelectRow
        icon="globe" iconTint="var(--theme-accent, #F5F5F5)" title={t('Language')}
        value={S.lang || 'en'} onChange={v => update(s => { s.lang = v })}
        options={Object.entries(LANGS).map(([k, name]) => ({
          value: k, label: name,
          subtitle: INSTR_LANGS.includes(k) ? null : t("Exercise instructions aren't available in this language yet — they stay in English."),
        }))}
      />
      <Row icon="scale" iconTint="var(--theme-accent, #F5F5F5)" title={t('Weight unit')}>
        <Segmented className="seg-inline"
          options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
          value={S.unit} onChange={v => update(s => { s.unit = v })} />
      </Row>
    </Section>

    {/* ---------- during a workout ---------- */}
    <Section title={t('During a workout')} footer={wakeOK ? t('The screen stays on while a workout is running, so you don’t have to unlock your phone between sets.') : null}>
      <SelectRow icon="timer" iconTint="var(--theme-accent, #F5F5F5)" title={t('Rest timer')}
        value={S.restSec} onChange={v => update(s => { s.restSec = v })}
        options={[60, 90, 120, 150, 180].map(v => ({ value: v, label: v + 's' }))} />
      {(wakeOK || !MOBILE) && (
        <Row icon="sun" iconTint="var(--theme-accent, #F5F5F5)" title={t('Keep screen awake')}
          subtitle={wakeOK ? null : t('Not supported in this browser.')}>
          <Switch checked={wakeOK && S.keepAwake !== false} disabled={!wakeOK}
            onChange={v => update(s => { s.keepAwake = v })} />
        </Row>
      )}
      <Row
        icon="bell"
        iconTint="var(--theme-accent, #F5F5F5)"
        title={t('Sounds')}
        subtitle={t('Workout audio effects (beeps, countdowns, alarms)')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {S.sound && (
            <Button
              size="sm"
              variant="tinted"
              icon="play"
              onClick={() => {
                unlockAudio()
                beep(true, 1040, 0.15)
                vibrate(30)
                toast(t('Sound tested'))
              }}
              title={t('Test workout sound')}
            >
              {t('Test')}
            </Button>
          )}
          <Switch
            checked={!!S.sound}
            onChange={v => {
              if (v) unlockAudio()
              update(s => { s.sound = v })
            }}
          />
        </div>
      </Row>
      {/* Two names for the same judgement, so the column asks in the scale you already think in.
          The (i) sits before the control — you read it on the way to the choice, not after it. */}
      <Row icon="target" iconTint="var(--theme-accent, #F5F5F5)" title={t('Effort per set')}>
        <button className="helpbtn" aria-label={t('What are RIR and RPE?')} onClick={effortHelpSheet}><Icon name="info" /></button>
        <Segmented className="seg-inline"
          options={[{ value: 'none', label: t('Off') }, { value: 'rir', label: t('RIR') }, { value: 'rpe', label: t('RPE') }]}
          value={effortOf(S)} onChange={v => update(s => { s.effort = v; delete s.showRir })} />
      </Row>
    </Section>

    {/* ---------- Rest Timer Alerts ---------- */}
    <Section
      title={t('Rest Timer Alerts')}
      footer={t('A strong audio alarm and vibration notify you when your rest countdown ends so you can focus on your sets.')}
    >
      <Row
        icon="speakerWave"
        iconTint="var(--theme-accent, #F5F5F5)"
        title={t('Rest timer alert sound')}
        subtitle={t('Audible workout alarm when countdown reaches zero (plays in headphones)')}
      >
        <Switch
          checked={S.restAlertEnabled !== false}
          onChange={v => {
            if (v) unlockAudio()
            update(s => { s.restAlertEnabled = v })
          }}
        />
      </Row>

      {S.restAlertEnabled !== false && (
        <>
          <SelectRow
            icon="musicNote"
            iconTint="var(--theme-accent, #F5F5F5)"
            title={t('Alert tone')}
            value={S.restAlertTone || 'alarm'}
            onChange={v => update(s => { s.restAlertTone = v })}
            options={ALERT_TONES.map(tInfo => ({
              value: tInfo.id,
              label: tInfo.name,
              subtitle: tInfo.description
            }))}
          />

          <Row
            icon="speakerWave"
            iconTint="var(--theme-accent, #F5F5F5)"
            title={t('Alert volume')}
            subtitle={`${Math.round((S.restAlertVolume !== undefined ? S.restAlertVolume : 1.0) * 100)}%`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 220 }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={S.restAlertVolume !== undefined ? S.restAlertVolume : 1.0}
                onChange={e => update(s => { s.restAlertVolume = parseFloat(e.target.value) })}
                style={{ flex: 1, accentColor: 'var(--theme-accent, #F5F5F5)', cursor: 'pointer' }}
                aria-label={t('Alert volume')}
              />
              <Button
                size="sm"
                variant="tinted"
                icon="play"
                onClick={() => {
                  unlockAudio()
                  previewAlertTone(S.restAlertTone || 'alarm', S.restAlertVolume !== undefined ? S.restAlertVolume : 1.0)
                  toast(t('Playing alert sound'))
                }}
                title={t('Test Sound')}
              >
                {t('Test Sound')}
              </Button>
            </div>
          </Row>
        </>
      )}

      <Row
        icon="target"
        iconTint="var(--theme-accent, #F5F5F5)"
        title={t('Vibration')}
        subtitle={t('Haptic pulse on rest completion (where supported)')}
      >
        <Switch
          checked={S.restVibrationEnabled !== false}
          onChange={v => update(s => { s.restVibrationEnabled = v })}
        />
      </Row>

      <Row
        icon="bell"
        iconTint="var(--theme-accent, #F5F5F5)"
        title={t('Browser notifications')}
        subtitle={t('System notification when timer ends, even in background tabs')}
      >
        <Switch
          checked={!!S.restNotifications}
          onChange={async (v) => {
            if (v) {
              const res = await requestNotificationPermission()
              if (res === 'granted') {
                unlockAudio()
                update(s => { s.restNotifications = true })
                toast(t('Rest notifications enabled!'))
              } else {
                toast(t('Notification permission not granted by browser.'))
              }
            } else {
              update(s => { s.restNotifications = false })
            }
          }}
        />
      </Row>

      {/* Test Notification and Sound Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 12px 12px 12px' }}>
        <Button
          size="sm"
          variant="tinted"
          icon="bell"
          onClick={() => {
            unlockAudio()
            const tone = S.restAlertTone || 'alarm'
            const vol = S.restAlertVolume !== undefined ? S.restAlertVolume : 1.0
            triggerRestNotification(
              t('REST COMPLETED — START NEXT SET'),
              t('Rest timer alert test: audio playing through your active output.'),
              {
                playSound: S.restAlertEnabled !== false && S.sound !== false,
                tone,
                volume: vol,
                vibratePattern: S.restVibrationEnabled !== false ? [300, 150, 300] : []
              }
            )
            toast(t('Test alert triggered (sound & notification)'))
          }}
          title={t('Test rest alert notification with sound')}
        >
          {t('Test Rest Alert & Sound')}
        </Button>
      </div>

      {/* iOS Safari / iPhone PWA Audio Compatibility Note */}
      <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 12, margin: '8px 12px 14px 12px', border: '1px solid var(--sep)' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <Icon name="info" style={{ color: 'var(--theme-accent, #F5F5F5)', fontSize: 16 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
            {t('iPhone / Safari Audio Tips')}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--label-2)', lineHeight: 1.45 }}>
          {t('• Connected Headphones: Alert sounds route automatically through your active Bluetooth or wired headphones at the volume set above.')}
          <br />
          {t('• Silent Switch: When headphones are connected, audio plays through headphones even in Silent mode. On phone speakers, the hardware Silent switch mutes browser audio.')}
          <br />
          {t('• Background Limitation: When your iPhone is locked or Safari is backgrounded, iOS suspends browser JavaScript and WebAudio. IRONX recalculates elapsed time immediately upon returning so your workout timer stays 100% accurate.')}
        </div>
      </div>
    </Section>

    {/* ---------- gym stealth mode ---------- */}
    <Section title={t('Gym Stealth Mode')} footer={t('Optimized for gym sessions: silences sound alerts, enables tactile vibration cues, and activates low-glare OLED styling.')}>
      <Row icon="bellSlash" iconTint="var(--acc)" title={t('Stealth mode')} subtitle={t('Silences sound effects and suppresses intrusive mid-workout popups')}>
        <Switch checked={!!S.stealthMode} onChange={v => update(s => { s.stealthMode = v })} />
      </Row>
      <Row icon="bolt" iconTint="var(--teal)" title={t('Feedback profile')}>
        <Segmented className="seg-inline"
          options={[
            { value: 'normal', label: t('Normal') },
            { value: 'haptic', label: t('Haptic') },
            { value: 'visual', label: t('Visual') },
            { value: 'silent', label: t('Silent') }
          ]}
          value={S.feedbackMode || 'normal'}
          onChange={v => update(s => { s.feedbackMode = v })}
        />
      </Row>
      <Row icon="moon" iconTint="var(--purple)" title={t('Low-glare OLED dimming')} subtitle={t('Ultra-deep black background to reduce gym lighting glare and save battery')}>
        <Switch checked={!!S.stealthDim} onChange={v => update(s => { s.stealthDim = v })} />
      </Row>
    </Section>

    {(user || MOBILE) && <NotificationsCard S={S} update={update} toast={toast} />}

    {/* ---------- Appearance: Dark Mode & Light Mode ONLY ---------- */}
    <Section title={t('Appearance')} footer={t('Choose between clean minimal Dark Mode or Light Mode.')}>
      {/* Dark Mode / Light Mode Switch */}
      <Row
        icon="sparkles"
        iconTint="var(--theme-accent, #F5F5F5)"
        title={t('Theme')}
        subtitle={S.theme === 'light' ? t('Clean light surfaces & dark typography') : t('Minimal dark charcoal & high contrast')}
      >
        <Segmented
          className="seg-inline"
          options={[
            { value: 'dark', label: t('Dark Mode') },
            { value: 'light', label: t('Light Mode') }
          ]}
          value={S.theme === 'light' ? 'light' : 'dark'}
          onChange={v => {
            update(s => { s.theme = v })
            syncSettingToServer({ theme: v })
          }}
        />
      </Row>

      {/* Anatomical Body Diagram Model */}
      <Row icon="figureStrength" iconTint="var(--theme-accent, #F5F5F5)" title={t('Body diagram')} subtitle={t('Anatomical muscle chart model')}>
        <Segmented
          className="seg-inline"
          options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]}
          value={S.body === 'female' ? 'female' : 'male'}
          onChange={v => update(s => { s.body = v })}
        />
      </Row>
    </Section>

    {/* ---------- data: fill it, bring things over, back it up, wipe it ---------- */}
    <Section title={t('Data')}>
      <Row icon="sparkles" iconTint="var(--theme-accent, #F5F5F5)" title={t('Load starter plan (PPL)')} accessory="chevron" onClick={loadStarterPlan} />
      <Row icon="shuffle" iconTint="var(--theme-accent, #F5F5F5)" title={t('Import from another app')}
        subtitle={t('FitNotes, Strong, Hevy — or body weight from Apple Health')}
        accessory="chevron" onClick={() => importRef.current.click()} />
      <Row icon="upload" iconTint="var(--theme-accent, #F5F5F5)" title={t('Import backup')} accessory="chevron" onClick={() => fileRef.current.click()} />
      <Row icon="download" iconTint="var(--theme-accent, #F5F5F5)" title={t('Export backup (JSON)')} accessory="chevron" onClick={doExport} />
      {/* Also drops anything the Coach is holding server-side: a wipe that leaves a pending
          proposal on the server behind would be a wipe in name only. */}
      <Row icon="trash" iconTint="var(--red)" title={t('Reset everything')} danger onClick={() => setResetModalOpen(true)} />
    </Section>
    <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={doImport} />
    {/* Reset after reading so picking the same file twice still fires onChange. */}
    <input ref={importRef} type="file" accept=".csv,.xml,text/csv,text/xml" style={{ display: 'none' }}
      onChange={ev => { const f = ev.target.files[0]; if (f) importFromApp(f); ev.target.value = '' }} />

    {/* "Add to Home screen" makes no sense inside the native app */}
    {!MOBILE && <Section title={t('Tip')}>
      <Row icon="lightbulb" iconTint="var(--theme-accent, #F5F5F5)"
        title={IS_ANDROID ? t('In Chrome: ⋮ menu → Add to Home screen') : t('In Safari: Share → Add to Home Screen')}
        subtitle={t('to install IRONX as a full-screen app.') + ' ' + (user ? t('Your data syncs with your profile — sign in anywhere to see it.') : t('Guest data stays on this device — export a backup now and then!'))} />
    </Section>}

    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, marginBottom: 8 }}>
      <IronXLogo size={32} />
    </div>
    <div className="dim small" style={{ textAlign: 'center', marginTop: 4, lineHeight: 1.6 }}>
      IRONX · {t('Elite Strength & Conditioning')}<br />
      exercise data: hasaneyldrm/exercises-dataset (CC)
    </div>

    {/* Complete Reset Modal */}
    {resetModalOpen && (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.78)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}
        onClick={() => setResetModalOpen(false)}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 440,
            borderRadius: 24,
            background: 'var(--surface)',
            backgroundImage: 'var(--grad-glass-surface)',
            border: '1px solid var(--theme-accent-border, var(--borders, #303036))',
            boxShadow: 'var(--card-shadow), 0 0 30px rgba(0, 0, 0, 0.8)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icon name="trash" size={22} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)' }}>
                {t('Reset Account Data')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--label-2)' }}>
                {t('Choose how much data you want to clear')}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: 'var(--label-2)', lineHeight: 1.5 }}>
            {t('This permanently clears saved data from your account and this device. This action cannot be undone.')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Option 1: Fitness Data Only */}
            <button
              type="button"
              onClick={async () => {
                setResetModalOpen(false)
                if (user) forgetCoach().catch(() => {})
                await resetAccount('fitness_only')
                nav('/home')
                toast(t('Fitness data reset successfully'))
              }}
              style={{
                padding: '14px 16px',
                borderRadius: 16,
                background: 'var(--surface-2)',
                border: '1px solid var(--theme-accent-border, var(--borders, #303036))',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                transition: 'background 0.15s ease'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-accent, #F5F5F5)' }}>
                {t('Reset Fitness Data Only')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--label-2)', lineHeight: 1.4 }}>
                {t('Clears templates, weekly schedule, workout sessions, cardio logs, meals, and weight history. Preserves your user profile and theme settings.')}
              </div>
            </button>

            {/* Option 2: Reset Everything */}
            <button
              type="button"
              onClick={async () => {
                setResetModalOpen(false)
                if (user) forgetCoach().catch(() => {})
                await resetAccount('everything')
                nav('/home')
                toast(t('All data and settings reset successfully'))
              }}
              style={{
                padding: '14px 16px',
                borderRadius: 16,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                transition: 'background 0.15s ease'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: '#EF4444' }}>
                {t('Reset Everything (Including Settings)')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--label-2)', lineHeight: 1.4 }}>
                {t('Completely wipes all fitness data, workout logs, schedules, and resets theme and appearance preferences back to default Warm Gold.')}
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setResetModalOpen(false)}
            style={{
              marginTop: 4,
              padding: '11px',
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid var(--sep)',
              color: 'var(--label-2)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {t('Cancel')}
          </button>
        </div>
      </div>
    )}
  </div>
}

// The whole point is that the two scales are one judgement counted from opposite ends, and a
// paragraph is a bad way to say that — the conversion table shows it in one look. Reading down
// a column is the answer to "what do I put here", so the numbers get their own aligned columns.
const EFFORT_ROWS = [
  ['0', '10', 'Nothing left — went to failure'],
  ['1', '9', 'One more rep in the tank'],
  ['2', '8', 'Two more reps'],
  ['3', '7', 'Three more reps'],
  ['4+', '≤6', 'Easy — warm-up territory'],
]
// RIR 2 / RPE 8: the row a working set usually lands on — the anchor the others are read
// against. Not where the stepper starts; + walks up from the bottom of the scale.
const EFFORT_TYPICAL = 2

function effortHelpSheet() {
  useUI.getState().openSheet(close => <>
    <h3>{t('Effort per set')}</h3>
    <div className="muted small" style={{ lineHeight: 1.5 }}>
      {t('How hard a set was, logged next to weight and reps. Two scales for the same judgement, counted from opposite ends.')}
    </div>
    <div className="efftbl">
      <div className="r hd"><span className="n">{t('RIR')}</span><span className="n">{t('RPE')}</span><span className="f">{t('How it felt')}</span></div>
      {EFFORT_ROWS.map(([rir, rpe, feel], i) => (
        <div key={rir} className={'r' + (i === EFFORT_TYPICAL ? ' on' : '')}>
          <span className="n">{rir}</span><span className="n">{rpe}</span><span className="f">{t(feel)}</span>
        </div>
      ))}
    </div>
    <div className="dim small" style={{ lineHeight: 1.5, display: 'grid', gap: 8 }}>
      <div>{t('RIR counts the reps you left; RPE reads the same effort off a 10-point scale — so RPE ≈ 10 − RIR. Pick the one you already think in.')}</div>
      <div>{t('The highlighted row is where most working sets land. Sets you have already logged keep their own scale, and nothing else reads the value — progression and estimated 1RM are unaffected.')}</div>
    </div>
    <div style={{ height: 8 }} />
  </>)
}

function NotificationsCard({ S, update, toast }) {
  if (MOBILE) return <MobileReminderCard S={S} update={update} toast={toast} />
  return <PushCard S={S} update={update} toast={toast} />
}

// Mobile build: the reminder is a native local notification scheduled on planned weekdays —
// no push server involved. The schedule itself is (re)synced by the store on every persist;
// this card only owns the OS permission prompt when the switch turns on.
function MobileReminderCard({ S, update, toast }) {
  const setReminder = patch => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), ...patch, tz: localTZ() } })
  const toggle = async () => {
    const on = !S.reminder?.on
    if (on) {
      const ok = await syncReminder({ ...S, reminder: { ...(S.reminder || DEF.reminder), on: true } }, true)
      if (!ok) { toast(t('Could not change notification settings')); return }
    }
    setReminder({ on })
  }
  return (
    <Section title={t('Notifications')}
      footer={S.reminder?.on ? t('Reminds you at this time on days that have a routine planned.') : null}>
      <Row icon="calendar" iconTint="var(--orange)" title={t('Workout day reminder')}>
        <Switch checked={!!S.reminder?.on} onChange={toggle} />
      </Row>
      {S.reminder?.on && (
        <Row icon="clock" iconTint="var(--purple)" title={t('Reminder time')}>
          <input type="time" className="timef" value={S.reminder?.time || DEF.reminder.time}
            onChange={e => setReminder({ time: e.target.value })} />
        </Row>
      )}
    </Section>
  )
}

function PushCard({ S, update, toast }) {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const supported = pushSupported()

  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => setOn(!!sub)).catch(() => {})
  }, [supported])

  const toggle = async v => {
    setBusy(true)
    try {
      if (!v) { await disablePush(); setOn(false); toast(t('Notifications off')) }
      else { await enablePush(); setOn(true); toast(t('Notifications on')) }
    } catch (e) { toast(e.message || t('Could not change notification settings')) }
    setBusy(false)
  }
  const test = async () => {
    try { await sendTestPush(); toast(t('Test sent — should arrive any second')) }
    catch (e) { toast(e.message || t('Test failed')) }
  }

  if (!supported) return (
    <Section title={t('Notifications')}>
      <Row icon="bellSlash" iconTint="var(--grey)" title={t('Not supported in this browser.')} />
    </Section>
  )

  return <>
    <Section
      title={t('Notifications')}
      footer={on && S.reminder?.on
        ? t("Only sent on days you have a routine planned and haven't logged a workout yet.") +
          (S.reminder?.tz ? ' ' + t('Timezone: {0} (auto-detected, updates if you travel).', S.reminder.tz) : '')
        : null}
    >
      <Row icon="bell" iconTint="var(--red)" title={t('Push notifications')} subtitle={t('Rest-timer alerts, even if IRONX is closed.')}>
        <Switch checked={on} disabled={busy} onChange={toggle} />
      </Row>
      {on && (
        <Row icon="calendar" iconTint="var(--orange)" title={t('Workout day reminder')}>
          <Switch checked={!!S.reminder?.on} onChange={() => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), on: !s.reminder?.on, tz: localTZ() } })} />
        </Row>
      )}
      {on && S.reminder?.on && (
        <Row icon="clock" iconTint="var(--purple)" title={t('Reminder time')}>
          <input type="time" className="timef" value={S.reminder?.time || DEF.reminder.time}
            onChange={e => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), time: e.target.value, tz: localTZ() } })} />
        </Row>
      )}
    </Section>
    {on && <div style={{ marginTop: -12, marginBottom: 22 }}><Button size="sm" icon="bell" onClick={test}>{t('Send test notification')}</Button></div>}
  </>
}
