// WebAudio alert tones + haptics + browser notification integration
let audioCtx = null

export function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (AudioCtx) audioCtx = new AudioCtx()
  }
  return audioCtx
}

export function unlockAudio() {
  try {
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
  } catch (e) {}
}

// Auto-unlock WebAudio on first user interaction anywhere on the window
if (typeof window !== 'undefined') {
  const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown']
  const onUserGesture = () => {
    unlockAudio()
    unlockEvents.forEach(evt => window.removeEventListener(evt, onUserGesture, true))
  }
  unlockEvents.forEach(evt => window.addEventListener(evt, onUserGesture, { capture: true, passive: true }))
}

export const ALERT_TONES = [
  { id: 'chime', name: 'Chime', description: 'Harmonic ascending triad' },
  { id: 'bell', name: 'Bell', description: 'Dual frequency gym bell' },
  { id: 'beep', name: 'Beep', description: 'Double crisp interval beep' },
  { id: 'gong', name: 'Gong', description: 'Deep resonant warm decay' },
  { id: 'digital', name: 'Digital', description: 'High-energy retro synth' }
]

export function playRestAlert(toneName = 'chime', volume = 0.8) {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  const vol = Math.max(0, Math.min(1, Number(volume) ?? 0.8))
  if (vol <= 0) return

  const now = ctx.currentTime

  switch ((toneName || '').toLowerCase()) {
    case 'bell': {
      // Harmonic dual frequency: 830Hz + 1660Hz with rich decay
      const master = ctx.createGain()
      master.connect(ctx.destination)
      master.gain.setValueAtTime(vol * 0.45, now)

      const f1 = 830, f2 = 1660
      ;[f1, f2].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)
        osc.connect(g)
        g.connect(master)

        g.gain.setValueAtTime(i === 0 ? 0.7 : 0.3, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + (i === 0 ? 1.6 : 1.1))
        osc.start(now)
        osc.stop(now + 1.7)
      })
      break
    }
    case 'beep': {
      // Crisp two-tone beep: 880Hz then 1174Hz
      const master = ctx.createGain()
      master.connect(ctx.destination)
      master.gain.setValueAtTime(vol * 0.4, now)

      const notes = [
        { freq: 880, start: 0, dur: 0.12 },
        { freq: 1174, start: 0.16, dur: 0.22 }
      ]
      notes.forEach(n => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(n.freq, now + n.start)
        osc.connect(g)
        g.connect(master)

        const t0 = now + n.start
        g.gain.setValueAtTime(0.001, t0)
        g.gain.exponentialRampToValueAtTime(0.6, t0 + 0.015)
        g.gain.exponentialRampToValueAtTime(0.001, t0 + n.dur)
        osc.start(t0)
        osc.stop(t0 + n.dur + 0.02)
      })
      break
    }
    case 'gong': {
      // Deep warm gong: fundamental 220Hz + 440Hz warm decay
      const master = ctx.createGain()
      master.connect(ctx.destination)
      master.gain.setValueAtTime(vol * 0.5, now)

      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const g1 = ctx.createGain()
      const g2 = ctx.createGain()

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(220, now)
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(440, now)

      osc1.connect(g1)
      g1.connect(master)
      osc2.connect(g2)
      g2.connect(master)

      g1.gain.setValueAtTime(0.8, now)
      g1.gain.exponentialRampToValueAtTime(0.001, now + 2.2)

      g2.gain.setValueAtTime(0.3, now)
      g2.gain.exponentialRampToValueAtTime(0.001, now + 1.6)

      osc1.start(now)
      osc1.stop(now + 2.3)
      osc2.start(now)
      osc2.stop(now + 1.7)
      break
    }
    case 'digital': {
      // Energetic retro digital arpeggio: 523 -> 659 -> 784 -> 1046
      const master = ctx.createGain()
      master.connect(ctx.destination)
      master.gain.setValueAtTime(vol * 0.35, now)

      const freqs = [523.25, 659.25, 783.99, 1046.50]
      freqs.forEach((freq, idx) => {
        const t0 = now + idx * 0.08
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, t0)
        osc.connect(g)
        g.connect(master)

        g.gain.setValueAtTime(0.001, t0)
        g.gain.linearRampToValueAtTime(0.5, t0 + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18)
        osc.start(t0)
        osc.stop(t0 + 0.2)
      })
      break
    }
    case 'chime':
    default: {
      // Warm uplifting 3-note chime: 587.33 (D5), 880 (A5), 1174.66 (D6)
      const master = ctx.createGain()
      master.connect(ctx.destination)
      master.gain.setValueAtTime(vol * 0.45, now)

      const notes = [
        { freq: 587.33, start: 0, dur: 0.6 },
        { freq: 880.00, start: 0.12, dur: 0.7 },
        { freq: 1174.66, start: 0.24, dur: 1.1 }
      ]
      notes.forEach(n => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(n.freq, now + n.start)
        osc.connect(g)
        g.connect(master)

        const t0 = now + n.start
        g.gain.setValueAtTime(0.001, t0)
        g.gain.linearRampToValueAtTime(0.6, t0 + 0.02)
        g.gain.exponentialRampToValueAtTime(0.001, t0 + n.dur)
        osc.start(t0)
        osc.stop(t0 + n.dur + 0.05)
      })
      break
    }
  }
}

export function previewAlertTone(toneName = 'chime', volume = 0.8) {
  unlockAudio()
  playRestAlert(toneName, volume)
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  try {
    const res = await Notification.requestPermission()
    return res
  } catch (e) {
    return 'denied'
  }
}

export function triggerRestNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false
  try {
    new Notification(title || 'Rest Timer Complete!', {
      body: body || 'Time for your next set. Let’s crush it!',
      icon: '/favicon.ico',
      badge: '/favicon.ico'
    })
    return true
  } catch (e) {
    return false
  }
}

export function beep(enabled, freq, dur, when) {
  if (!enabled) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = freq || 880; o.type = 'sine'
    const t0 = ctx.currentTime + (when || 0)
    g.gain.setValueAtTime(0.001, t0)
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (dur || 0.18))
    o.start(t0); o.stop(t0 + (dur || 0.18) + 0.05)
  } catch (e) { /* */ }
}

export function vibrate(p) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(p)
    }
  } catch (e) { /* */ }
}
