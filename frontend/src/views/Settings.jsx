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
  const { update, replaceState, setUser, pullState, pushState, signOut, signOutAll, resetDemo } = useStore()
  const toast = useUI(s => s.toast)
  const fileRef = useRef(null)
  const importRef = useRef(null)
  const wakeOK = wakeLockSupported()

  const doExport = async () => {
    const json = JSON.stringify(S, null, 2)
    const name = 'opengym-backup-' + todayISO() + '.json'
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
        if (!data.workouts || !data.routines) throw new Error('not an openGym backup')
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
        <Row icon="rocket" iconTint="var(--indigo)" title={t('Self-host openGym')} subtitle={t('Google sign-in, sync across your devices, your own data.')} accessory="chevron"
          onClick={() => window.open(REPO, '_blank', 'noopener')} />
      </> : DEMO ? <>
        <Row icon="sparkles" iconTint="var(--theme-accent, #E8B477)" title={t('You’re in the demo')} subtitle={t('Example data, stored only in this browser — change anything you like.')} />
        <Row icon="reset" iconTint="var(--theme-accent, #E8B477)" title={t('Reset demo data')} accessory="chevron"
          onClick={() => confirmSheet({ title: t('Reset demo data?'), message: t('Puts the example plan, workouts and weigh-ins back the way they started.'), confirmText: t('Reset'), onConfirm: () => { resetDemo(); nav('/home'); toast(t('Demo data reset')) } })} />
        <Row icon="rocket" iconTint="var(--theme-accent, #E8B477)" title={t('Self-host openGym')} subtitle={t('Google sign-in, sync across your devices, your own data.')} accessory="chevron"
          onClick={() => window.open(REPO, '_blank', 'noopener')} />
      </> : user ? <>
        <Row
          icon={user.picture ? null : "personCircle"}
          iconTint="var(--theme-accent, #E8B477)"
          title={user.name}
          subtitle={user.email ? `${user.email} · Google Account` : t('Signed in with Google')}
        >
          {user.picture && (
            <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%', marginRight: 10, flexShrink: 0 }} />
          )}
        </Row>
        <Row
          icon="heart"
          iconTint="var(--theme-accent, #E8B477)"
          title={t('Personal Fitness Profile')}
          subtitle={user.profile?.fitnessGoal ? t('Goal: {0}', user.profile.fitnessGoal.replace(/_/g, ' ')) : t('Set height, weight, and fitness goals')}
          accessory="chevron"
          onClick={() => nav('/profile-setup')}
        />
        {user.admin && <Row icon="wrench" iconTint="var(--theme-accent, #E8B477)" title={t('Admin dashboard')} accessory="chevron" onClick={() => nav('/admin')} />}
        <Row icon="signOut" iconTint="var(--red)" title={t('Sign out')} danger onClick={() => confirmSheet({ title: t('Sign out?'), message: t('Your data is synced to your profile first, then cleared from this device.'), confirmText: t('Sign out'), danger: true, onConfirm: () => { signOut(); nav('/home') } })} />
        <Row icon="shield" iconTint="var(--red)" title={t('Sign out everywhere')} subtitle={t('Ends this profile’s sessions on all your devices.')} danger onClick={signOutEverywhere} />
      </> : (
        <>
          <Row
            icon="lock"
            iconTint="var(--theme-accent, #E8B477)"
            title={t('Guest Mode (Local Only)')}
            subtitle={t('Workouts and health logs live only on this browser.')}
          />
          <Row
            icon="sparkles"
            iconTint="var(--theme-accent, #E8B477)"
            title={t('Save My Progress with Google')}
            subtitle={t('Back up workouts, custom exercises, and health logs to your Google profile.')}
            accessory="chevron"
            onClick={() => startGoogleLogin('/settings', 'import_guest')}
          />
        </>
      )}
    </Section>

    {/* ---------- general ---------- */}
    <Section title={t('General')} footer={t('Note: switching units only changes the label — logged numbers are not converted.')}>
      <SelectRow
        icon="globe" iconTint="var(--theme-accent, #E8B477)" title={t('Language')}
        value={S.lang || 'en'} onChange={v => update(s => { s.lang = v })}
        options={Object.entries(LANGS).map(([k, name]) => ({
          value: k, label: name,
          subtitle: INSTR_LANGS.includes(k) ? null : t("Exercise instructions aren't available in this language yet — they stay in English."),
        }))}
      />
      <Row icon="scale" iconTint="var(--theme-accent, #E8B477)" title={t('Weight unit')}>
        <Segmented className="seg-inline"
          options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
          value={S.unit} onChange={v => update(s => { s.unit = v })} />
      </Row>
    </Section>

    {/* ---------- during a workout ---------- */}
    <Section title={t('During a workout')} footer={wakeOK ? t('The screen stays on while a workout is running, so you don’t have to unlock your phone between sets.') : null}>
      <SelectRow icon="timer" iconTint="var(--theme-accent, #E8B477)" title={t('Rest timer')}
        value={S.restSec} onChange={v => update(s => { s.restSec = v })}
        options={[60, 90, 120, 150, 180].map(v => ({ value: v, label: v + 's' }))} />
      {(wakeOK || !MOBILE) && (
        <Row icon="sun" iconTint="var(--theme-accent, #E8B477)" title={t('Keep screen awake')}
          subtitle={wakeOK ? null : t('Not supported in this browser.')}>
          <Switch checked={wakeOK && S.keepAwake !== false} disabled={!wakeOK}
            onChange={v => update(s => { s.keepAwake = v })} />
        </Row>
      )}
      <Row
        icon="bell"
        iconTint="var(--theme-accent, #E8B477)"
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
      <Row icon="target" iconTint="var(--theme-accent, #E8B477)" title={t('Effort per set')}>
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
        iconTint="var(--theme-accent, #E8B477)"
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
            iconTint="var(--theme-accent, #E8B477)"
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
            iconTint="var(--theme-accent, #E8B477)"
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
                style={{ flex: 1, accentColor: 'var(--theme-accent, #E8B477)', cursor: 'pointer' }}
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
        iconTint="var(--theme-accent, #E8B477)"
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
        iconTint="var(--theme-accent, #E8B477)"
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
          <Icon name="info" style={{ color: 'var(--theme-accent, #E8B477)', fontSize: 16 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
            {t('iPhone / Safari Audio Tips')}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--label-2)', lineHeight: 1.45 }}>
          {t('• Connected Headphones: Alert sounds route automatically through your active Bluetooth or wired headphones at the volume set above.')}
          <br />
          {t('• Silent Switch: When headphones are connected, audio plays through headphones even in Silent mode. On phone speakers, the hardware Silent switch mutes browser audio.')}
          <br />
          {t('• Background Limitation: When your iPhone is locked or Safari is backgrounded, iOS suspends browser JavaScript and WebAudio. OpenGym recalculates elapsed time immediately upon returning so your workout timer stays 100% accurate.')}
        </div>
      </div>
    </Section>

    {coachAvailable(config, user, { demo: DEMO, mobile: MOBILE }) && (
      <Section title={t('Coach')} footer={hasConsent(S)
        ? t('The Coach designs and adjusts your plan; it never changes anything without your say-so.')
        : t('An AI coach that can build your plan and adjust it from what you log. Off until you turn it on.')}>
        <Row icon="sparkles" iconTint="var(--theme-accent, #E8B477)" title={hasConsent(S) ? t('Open the Coach') : t('Meet the Coach')}
          subtitle={hasConsent(S) ? t('Reviews, plan design, history and controls') : t('See what it would use, then decide')}
          accessory="chevron" onClick={() => nav('/coach')} />
      </Section>
    )}

    {(user || MOBILE) && <NotificationsCard S={S} update={update} toast={toast} />}

    {/* ---------- dynamic accent theme & ambient glow ---------- */}
    <Section title={t('Accent Theme & Ambient Glow')} footer={DEMO || MOBILE ? undefined : t('Selected accent and ambient lighting dynamically sync live across all pages.')}>
      {/* Dark Mode / Light Mode Switch */}
      <Row
        icon="sparkles"
        iconTint="var(--theme-accent, #E8B477)"
        title={t('Appearance')}
        subtitle={S.theme === 'light' ? t('Clean light surfaces & dark typography') : t('Deep black smoky glass & golden glow')}
      >
        <Segmented
          className="seg-inline"
          options={[
            { value: 'dark', label: t('Dark Mode') },
            { value: 'light', label: t('Light Mode') }
          ]}
          value={S.theme === 'light' ? 'light' : 'dark'}
          onChange={v => update(s => { s.theme = v })}
        />
      </Row>

      {/* 7 Distinguishable Accent Themes */}
      <div className="lrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14, paddingTop: 14, paddingBottom: 16 }}>
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <span className="lrow-t" style={{ fontWeight: 700 }}>{t('Accent Theme Presets')}</span>
          <span className="dim small">{t('Dynamic glow & UI adaptation')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10 }}>
          {Object.values(THEME_PRESETS).map(preset => {
            const currentThemeId = S.bgTheme || 'warm-gold'
            const isSelected = currentThemeId === preset.id || (currentThemeId.includes('gold') && preset.id === 'warm-gold')
            return (
              <div
                key={preset.id}
                onClick={() => update(s => {
                  s.bgTheme = preset.id
                  s.goldShade = preset.primary
                  s.bronzeShade = preset.secondary
                  s.bgDarkness = preset.bg
                })}
                style={{
                  padding: '12px 10px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: isSelected ? `rgba(${preset.rgb}, 0.14)` : 'var(--surface-2)',
                  border: isSelected ? `2px solid ${preset.primary}` : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: isSelected ? `0 0 16px rgba(${preset.rgb}, 0.35), var(--glass-highlight)` : 'var(--glass-highlight)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'transform var(--fast) var(--ease), border-color var(--fast), box-shadow var(--fast)'
                }}
              >
                {/* Visual gradient swatch preview */}
                <div
                  style={{
                    height: 38,
                    borderRadius: 8,
                    background: preset.heroGradient,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {isSelected && <span style={{ color: '#12100E', fontSize: 16, fontWeight: 900 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
                    {preset.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--label-2)', marginTop: 2, lineHeight: 1.25 }}>
                    {preset.description}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Accent Color Selector */}
      <div className="lrow" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, paddingTop: 6, paddingBottom: 14 }}>
        <div className="row between">
          <span className="lrow-t">{t('Quick Accent Palette')}</span>
          <span style={{ fontSize: 12, color: 'var(--theme-accent, #E8B477)', fontWeight: 700 }}>
            {THEME_PRESETS[S.bgTheme]?.name || 'Warm Gold'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.values(THEME_PRESETS).map(preset => {
            const currentThemeId = S.bgTheme || 'warm-gold'
            const active = currentThemeId === preset.id || (currentThemeId.includes('gold') && preset.id === 'warm-gold')
            return (
              <button
                key={preset.id}
                onClick={() => update(s => {
                  s.bgTheme = preset.id
                  s.goldShade = preset.primary
                  s.bronzeShade = preset.secondary
                  s.bgDarkness = preset.bg
                })}
                title={preset.name}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: preset.primary,
                  border: active ? '3px solid #FFFFFF' : '1px solid rgba(255,255,255,0.2)',
                  boxShadow: active ? `0 0 14px ${preset.primary}` : '0 2px 8px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                  transform: active ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.15s ease'
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Background Darkness */}
      <Row
        icon="moon"
        iconTint="var(--theme-accent, #E8B477)"
        title={t('Background Darkness')}
        subtitle={S.bgDarkness === '#050505' ? t('Pitch Black') : S.bgDarkness === '#111111' ? t('Dark Charcoal') : t('Deep Black (Default)')}
      >
        <Segmented
          className="seg-inline"
          options={[
            { value: '#090909', label: t('Deep Black') },
            { value: '#050505', label: t('Pitch') },
            { value: '#111111', label: t('Charcoal') }
          ]}
          value={S.bgDarkness || '#090909'}
          onChange={v => update(s => { s.bgDarkness = v })}
        />
      </Row>

      {/* Ambient Accent Glow Toggle */}
      <Row
        icon="sparkles"
        iconTint="var(--theme-accent, #E8B477)"
        title={t('Dynamic Ambient Glow')}
        subtitle={t('Ambient lighting behind dashboard cards matching your active accent')}
      >
        <Switch
          checked={S.ambientGlow !== false}
          onChange={v => update(s => { s.ambientGlow = v })}
        />
      </Row>

      {/* Ambient Glow Intensity Slider */}
      {S.ambientGlow !== false && (
        <Row
          icon="sun"
          iconTint="var(--theme-accent, #E8B477)"
          title={t('Ambient Glow Intensity')}
          subtitle={`${Math.round((S.glowIntensity !== undefined ? S.glowIntensity : 1.0) * 100)}%`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 180 }}>
            <input
              type="range"
              min="0.2"
              max="1.8"
              step="0.1"
              value={S.glowIntensity !== undefined ? S.glowIntensity : 1.0}
              onChange={e => update(s => { s.glowIntensity = parseFloat(e.target.value) })}
              style={{ flex: 1, accentColor: 'var(--theme-accent, #E8B477)', cursor: 'pointer' }}
              aria-label={t('Glow Intensity')}
            />
          </div>
        </Row>
      )}

      {/* Glass Transparency / Opacity Slider */}
      <Row
        icon="eye"
        iconTint="var(--theme-accent, #E8B477)"
        title={t('Glass Card Opacity')}
        subtitle={`${Math.round((S.glassOpacity !== undefined ? S.glassOpacity : 0.80) * 100)}%`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 180 }}>
          <input
            type="range"
            min="0.5"
            max="0.95"
            step="0.05"
            value={S.glassOpacity !== undefined ? S.glassOpacity : 0.80}
            onChange={e => update(s => { s.glassOpacity = parseFloat(e.target.value) })}
            style={{ flex: 1, accentColor: 'var(--theme-accent, #E8B477)', cursor: 'pointer' }}
            aria-label={t('Glass Opacity')}
          />
        </div>
      </Row>

      {/* Background Blur Intensity Slider */}
      <Row
        icon="camera"
        iconTint="var(--theme-accent, #E8B477)"
        title={t('Glass Blur Intensity')}
        subtitle={`${Math.round((S.blurIntensity !== undefined ? S.blurIntensity : 1.0) * 100)}%`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 180 }}>
          <input
            type="range"
            min="0.5"
            max="1.8"
            step="0.1"
            value={S.blurIntensity !== undefined ? S.blurIntensity : 1.0}
            onChange={e => update(s => { s.blurIntensity = parseFloat(e.target.value) })}
            style={{ flex: 1, accentColor: 'var(--theme-accent, #E8B477)', cursor: 'pointer' }}
            aria-label={t('Glass Blur Intensity')}
          />
        </div>
      </Row>

      {/* Background Glow Animation Toggle */}
      <Row
        icon="bolt"
        iconTint="var(--theme-accent, #E8B477)"
        title={t('Subtle Drift Animation')}
        subtitle={t('Gentle organic movement of ambient lighting')}
      >
        <Switch
          checked={S.bgAnimation !== false}
          onChange={v => update(s => { s.bgAnimation = v })}
        />
      </Row>

      {/* Body diagram */}
      <Row icon="figureStrength" iconTint="var(--theme-accent, #E8B477)" title={t('Body diagram')}>
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
      <Row icon="sparkles" iconTint="var(--theme-accent, #E8B477)" title={t('Load starter plan (PPL)')} accessory="chevron" onClick={loadStarterPlan} />
      <Row icon="shuffle" iconTint="var(--theme-accent, #E8B477)" title={t('Import from another app')}
        subtitle={t('FitNotes, Strong, Hevy — or body weight from Apple Health')}
        accessory="chevron" onClick={() => importRef.current.click()} />
      <Row icon="upload" iconTint="var(--theme-accent, #E8B477)" title={t('Import backup')} accessory="chevron" onClick={() => fileRef.current.click()} />
      <Row icon="download" iconTint="var(--theme-accent, #E8B477)" title={t('Export backup (JSON)')} accessory="chevron" onClick={doExport} />
      {/* Also drops anything the Coach is holding server-side: a wipe that leaves a pending
          proposal on the server behind would be a wipe in name only. */}
      <Row icon="trash" iconTint="var(--red)" title={t('Reset everything')} danger onClick={() => confirmSheet({ title: t('Reset everything?'), message: t('Deletes your plan, workouts and body weight on this device. This cannot be undone.'), confirmText: t('Delete everything'), danger: true, onConfirm: () => { if (user) forgetCoach().catch(() => {}); replaceState(JSON.parse(JSON.stringify(DEF)), true); nav('/home'); toast(t('All data reset')) } })} />
    </Section>
    <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={doImport} />
    {/* Reset after reading so picking the same file twice still fires onChange. */}
    <input ref={importRef} type="file" accept=".csv,.xml,text/csv,text/xml" style={{ display: 'none' }}
      onChange={ev => { const f = ev.target.files[0]; if (f) importFromApp(f); ev.target.value = '' }} />

    {/* "Add to Home screen" makes no sense inside the native app */}
    {!MOBILE && <Section title={t('Tip')}>
      <Row icon="lightbulb" iconTint="var(--theme-accent, #E8B477)"
        title={IS_ANDROID ? t('In Chrome: ⋮ menu → Add to Home screen') : t('In Safari: Share → Add to Home Screen')}
        subtitle={t('to install openGym as a full-screen app.') + ' ' + (user ? t('Your data syncs with your profile — sign in anywhere to see it.') : t('Guest data stays on this device — export a backup now and then!'))} />
    </Section>}

    <div className="dim small" style={{ textAlign: 'center', marginTop: 4, lineHeight: 1.6 }}>
      openGym · {t('free & open source (AGPL v3)')}<br />
      <a href="https://github.com/DuarteSantos8/openGym" target="_blank" rel="noopener">source code</a> · exercise data: hasaneyldrm/exercises-dataset (CC)
    </div>
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
      <Row icon="bell" iconTint="var(--red)" title={t('Push notifications')} subtitle={t('Rest-timer alerts, even if openGym is closed.')}>
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
