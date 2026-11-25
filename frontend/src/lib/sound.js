// IRONX Audio & Notification Subsystem
// Dual-engine architecture: Native HTML5 Audio (primary for iOS headphone routing & PWA reliability)
// + WebAudio Synthesizer (zero-latency in-memory fallback) + Haptics + Notification integration.

let audioCtx = null
let isUnlocked = false
const audioElementCache = new Map()

export const ALERT_TONES = [
  { id: 'alarm', name: 'Power Alarm (Recommended)', description: 'Loud, repeating 3-burst gym alarm — cuts through gym noise', file: '/sounds/alarm.wav' },
  { id: 'boxing_bell', name: 'Triple Boxing Bell', description: 'Authentic 3-strike round bell with rich brass resonance', file: '/sounds/boxing_bell.wav' },
  { id: 'digital_pulse', name: 'Digital Siren', description: 'Piercing high-energy electronic pulse for sports headphones', file: '/sounds/digital_pulse.wav' },
  { id: 'gong', name: 'Heavy Gym Gong', description: 'Deep, resonant acoustic gong with long decay', file: '/sounds/gong.wav' },
  { id: 'chime', name: 'Melodic Chime', description: 'Clean ascending 4-note harmonic chord', file: '/sounds/chime.wav' }
]

/**
 * Returns the cached or new AudioContext singleton.
 * Safely recreates the AudioContext if closed (e.g. after OS backgrounding or sleep).
 */
export function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx || audioCtx.state === 'closed') {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (AudioCtx) {
      try {
        audioCtx = new AudioCtx()
      } catch (e) {
        audioCtx = null
      }
    }
  }
  return audioCtx
}

/**
 * Retrieves or lazily creates a cached HTMLAudioElement for an audio file.
 * We rely on standard browser audio output routing so iOS naturally routes
 * sound to Bluetooth headphones (AirPods), wired headphones, or device speaker.
 */
function getAudioElement(fileUrl) {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
  if (!audioElementCache.has(fileUrl)) {
    try {
      const audio = new Audio(fileUrl)
      audio.preload = 'auto'
      audioElementCache.set(fileUrl, audio)
    } catch (e) {
      return null
    }
  }
  return audioElementCache.get(fileUrl)
}

const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown', 'pointerdown']

function cleanupUnlockListeners() {
  if (typeof window === 'undefined') return
  unlockEvents.forEach(evt => {
    try {
      window.removeEventListener(evt, onUserGesture, { capture: true })
    } catch (e) {}
  })
}

const onUserGesture = () => {
  unlockAudio()
}

/**
 * Initializes and unlocks browser audio after a genuine user interaction
 * (e.g. starting a workout, tapping the screen, testing sound, or toggling preferences).
 * Mobile Safari requires user gestures to unlock both Web Audio and HTML5 Audio.
 */
export function unlockAudio() {
  if (typeof window === 'undefined') return
  if (isUnlocked) return
  try {
    // 1. Resume Web Audio AudioContext if suspended
    const ctx = getAudioContext()
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      // Play a 1-sample silent buffer to satisfy iOS WebKit autoplay lock
      if (ctx.state !== 'closed') {
        try {
          const buffer = ctx.createBuffer(1, 1, 22050)
          const source = ctx.createBufferSource()
          source.buffer = buffer
          source.connect(ctx.destination)
          source.start(0)
        } catch (e) {}
      }
    }

    // 2. Prime HTML5 Audio elements during user gesture
    ALERT_TONES.forEach(tone => {
      const el = getAudioElement(tone.file)
      if (el && typeof el.load === 'function' && el.readyState < 2) {
        try { el.load() } catch (e) {}
      }
    })
    const notifEl = getAudioElement('/sounds/notification.wav')
    if (notifEl && typeof notifEl.load === 'function' && notifEl.readyState < 2) {
      try { notifEl.load() } catch (e) {}
    }

    isUnlocked = true
    cleanupUnlockListeners()
  } catch (e) {
    // Audio unlock is best-effort and non-fatal
  }
}

// Auto-register touch/click listeners to unlock audio on initial user activity
if (typeof window !== 'undefined') {
  unlockEvents.forEach(evt => window.addEventListener(evt, onUserGesture, { capture: true, passive: true }))
}

// Duplicate alert prevention guard (ensures rapid timer ticks do not fire overlapping audio)
let lastAlertAt = 0
let lastAlertToneId = ''
const DEDUPE_WINDOW_MS = 600

/**
 * Plays the chosen rest-completion alert with high acoustic power.
 * Primary: HTML5 Audio file playback (routes through connected headphones or speaker via iOS).
 * Fallback: Pure WebAudio harmonic synthesizer if audio file cannot be decoded or loaded.
 */
export function playRestAlert(toneName = 'alarm', volume = 1.0, force = false) {
  const now = Date.now()
  const selected = (toneName || 'alarm').toLowerCase()

  if (!force && lastAlertToneId === selected && (now - lastAlertAt < DEDUPE_WINDOW_MS)) {
    return Promise.resolve(false)
  }
  lastAlertAt = now
  lastAlertToneId = selected

  const vol = Math.max(0, Math.min(1, Number(volume) ?? 1.0))
  if (vol <= 0) return Promise.resolve(false)

  const toneObj = ALERT_TONES.find(t => t.id === selected) || ALERT_TONES[0]
  const fileUrl = toneObj?.file || `/sounds/${selected}.wav`

  // 1. Try HTML5 Audio playback (primary engine)
  const audio = getAudioElement(fileUrl)
  if (audio) {
    try {
      audio.volume = vol
      audio.currentTime = 0
      const playPromise = audio.play()
      if (playPromise !== undefined && typeof playPromise.then === 'function') {
        return playPromise
          .then(() => true)
          .catch(() => {
            // If HTML5 Audio was blocked by browser or failed, fallback to WebAudio
            return playSynthesizedAlert(selected, vol)
          })
      }
      return Promise.resolve(true)
    } catch (e) {
      return playSynthesizedAlert(selected, vol)
    }
  }

  // 2. Direct fallback to WebAudio synthesizer
  return playSynthesizedAlert(selected, vol)
}

/**
 * Plays a short, crisp in-app notification chime (used for general alerts, test pushes, etc.).
 */
export function playNotificationSound(volume = 1.0) {
  const vol = Math.max(0, Math.min(1, Number(volume) ?? 1.0))
  if (vol <= 0) return Promise.resolve(false)

  const audio = getAudioElement('/sounds/notification.wav')
  if (audio) {
    try {
      audio.volume = vol
      audio.currentTime = 0
      const playPromise = audio.play()
      if (playPromise !== undefined && typeof playPromise.then === 'function') {
        return playPromise
          .then(() => true)
          .catch(() => playNotificationBeep(vol))
      }
      return Promise.resolve(true)
    } catch (e) {
      return playNotificationBeep(vol)
    }
  }
  return playNotificationBeep(vol)
}

/**
 * Preview an alert tone (e.g. from Settings). Force flag bypasses dedupe window.
 */
export function previewAlertTone(toneName = 'alarm', volume = 1.0) {
  unlockAudio()
  return playRestAlert(toneName, volume, true)
}

/**
 * Notification permission requester.
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  try {
    const res = await Notification.requestPermission()
    return res
  } catch (e) {
    return 'denied'
  }
}

/**
 * Triggers a rest-completion notification:
 * 1. Plays in-app notification audio alert (audible through headphones or speaker).
 * 2. Triggers haptic vibration where supported.
 * 3. Shows system Notification banner if granted.
 */
export function triggerRestNotification(title, body, options = {}) {
  const {
    playSound = true,
    tone = 'alarm',
    volume = 1.0,
    vibratePattern = [300, 150, 300, 150, 500]
  } = options

  // 1. Play in-app audio alert
  if (playSound) {
    playRestAlert(tone, volume)
  }

  // 2. Haptic vibration
  if (vibratePattern && vibratePattern.length) {
    vibrate(vibratePattern)
  }

  // 3. System Notification banner
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false
  try {
    new Notification(title || 'REST COMPLETED — START NEXT SET', {
      body: body || 'Your rest period has ended. Time to crush the next set!',
      icon: '/icon-180.png',
      badge: '/icon-180.png',
      tag: 'ironx-rest-timer'
    })
    return true
  } catch (e) {
    return false
  }
}

/**
 * Short workout cue beep (for set completion, countdowns).
 */
export function beep(enabled, freq, dur, when) {
  if (!enabled) return
  try {
    const ctx = getAudioContext()
    if (!ctx || ctx.state === 'closed') return
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = freq || 880
    o.type = 'sine'
    const t0 = ctx.currentTime + (when || 0)
    g.gain.setValueAtTime(0.001, t0)
    g.gain.exponentialRampToValueAtTime(0.45, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (dur || 0.18))
    o.start(t0)
    o.stop(t0 + (dur || 0.18) + 0.05)
  } catch (e) {}
}

function playNotificationBeep(vol) {
  try {
    beep(true, 987, 0.15)
    setTimeout(() => beep(true, 1318, 0.25), 100)
    return Promise.resolve(true)
  } catch (e) {
    return Promise.resolve(false)
  }
}

/**
 * Haptic feedback helper.
 */
export function vibrate(p) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(p)
    }
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// WebAudio In-Memory Synthesizer Fallback Engine
// ---------------------------------------------------------------------------

function createLoudMasterChain(ctx, volume = 1.0) {
  const vol = Math.max(0, Math.min(1, Number(volume) ?? 1.0))
  const master = ctx.createGain()

  let compressor = null
  try {
    compressor = ctx.createDynamicsCompressor()
    compressor.threshold.setValueAtTime(-8, ctx.currentTime)
    compressor.knee.setValueAtTime(6, ctx.currentTime)
    compressor.ratio.setValueAtTime(12, ctx.currentTime)
    compressor.attack.setValueAtTime(0.003, ctx.currentTime)
    compressor.release.setValueAtTime(0.15, ctx.currentTime)

    master.connect(compressor)
    compressor.connect(ctx.destination)
  } catch (e) {
    master.connect(ctx.destination)
  }

  master.gain.setValueAtTime(vol * 0.95, ctx.currentTime)
  return master
}

function playSynthesizedAlert(selected, vol) {
  try {
    const ctx = getAudioContext()
    if (!ctx || ctx.state === 'closed') return Promise.resolve(false)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const now = ctx.currentTime
    const master = createLoudMasterChain(ctx, vol)

    switch (selected) {
    case 'boxing_bell': {
      const strikes = [0, 0.35, 0.70]
      const freqs = [659.25, 1318.5, 2637.0]

      strikes.forEach((startTime, strikeIdx) => {
        const isLast = strikeIdx === strikes.length - 1
        const decayTime = isLast ? 1.8 : 0.45
        const t0 = now + startTime

        freqs.forEach((freq, fIdx) => {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = fIdx === 0 ? 'sine' : 'triangle'
          osc.frequency.setValueAtTime(freq, t0)
          osc.connect(g)
          g.connect(master)

          const amp = fIdx === 0 ? 0.8 : (fIdx === 1 ? 0.4 : 0.2)
          g.gain.setValueAtTime(0.001, t0)
          g.gain.linearRampToValueAtTime(amp, t0 + 0.008)
          g.gain.exponentialRampToValueAtTime(0.001, t0 + decayTime)
          osc.start(t0)
          osc.stop(t0 + decayTime + 0.05)
        })
      })
      break
    }

    case 'digital_pulse': {
      const pulses = [
        { freq: 880, start: 0, dur: 0.12 },
        { freq: 1174, start: 0.15, dur: 0.12 },
        { freq: 880, start: 0.30, dur: 0.12 },
        { freq: 1174, start: 0.45, dur: 0.12 },
        { freq: 1396.9, start: 0.60, dur: 0.55 }
      ]

      pulses.forEach(p => {
        const t0 = now + p.start
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const g = ctx.createGain()

        osc1.type = 'square'
        osc1.frequency.setValueAtTime(p.freq, t0)
        osc2.type = 'sawtooth'
        osc2.frequency.setValueAtTime(p.freq * 1.005, t0)

        osc1.connect(g)
        osc2.connect(g)
        g.connect(master)

        g.gain.setValueAtTime(0.001, t0)
        g.gain.linearRampToValueAtTime(0.45, t0 + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, t0 + p.dur)

        osc1.start(t0)
        osc2.start(t0)
        osc1.stop(t0 + p.dur + 0.02)
        osc2.stop(t0 + p.dur + 0.02)
      })
      break
    }

    case 'gong': {
      const harmonics = [
        { f: 220, amp: 0.9, decay: 2.5, type: 'sine' },
        { f: 440, amp: 0.5, decay: 2.1, type: 'triangle' },
        { f: 880, amp: 0.3, decay: 1.5, type: 'sine' },
        { f: 1320, amp: 0.15, decay: 0.9, type: 'triangle' }
      ]

      harmonics.forEach(h => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = h.type
        osc.frequency.setValueAtTime(h.f, now)
        osc.connect(g)
        g.connect(master)

        g.gain.setValueAtTime(0.001, now)
        g.gain.linearRampToValueAtTime(h.amp, now + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, now + h.decay)
        osc.start(now)
        osc.stop(now + h.decay + 0.05)
      })
      break
    }

    case 'chime': {
      const notes = [
        { freq: 587.33, start: 0, dur: 0.55 },
        { freq: 739.99, start: 0.12, dur: 0.65 },
        { freq: 880.00, start: 0.24, dur: 0.75 },
        { freq: 1174.66, start: 0.36, dur: 1.20 }
      ]

      notes.forEach(n => {
        const t0 = now + n.start
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(n.freq, t0)
        osc.connect(g)
        g.connect(master)

        g.gain.setValueAtTime(0.001, t0)
        g.gain.linearRampToValueAtTime(0.7, t0 + 0.015)
        g.gain.exponentialRampToValueAtTime(0.001, t0 + n.dur)
        osc.start(t0)
        osc.stop(t0 + n.dur + 0.05)
      })
      break
    }

    case 'alarm':
    default: {
      const bursts = [
        { f1: 880, f2: 1760, start: 0, dur: 0.24 },
        { f1: 880, f2: 1760, start: 0.32, dur: 0.24 },
        { f1: 1046.5, f2: 2093, start: 0.64, dur: 0.75 }
      ]

      bursts.forEach(b => {
        const t0 = now + b.start
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const g = ctx.createGain()

        osc1.type = 'sawtooth'
        osc1.frequency.setValueAtTime(b.f1, t0)
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(b.f2, t0)

        try {
          const filter = ctx.createBiquadFilter()
          filter.type = 'lowpass'
          filter.frequency.setValueAtTime(3200, t0)
          osc1.connect(filter)
          osc2.connect(filter)
          filter.connect(g)
        } catch {
          osc1.connect(g)
          osc2.connect(g)
        }

        g.connect(master)

        g.gain.setValueAtTime(0.001, t0)
        g.gain.linearRampToValueAtTime(0.85, t0 + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, t0 + b.dur)

        osc1.start(t0)
        osc2.start(t0)
        osc1.stop(t0 + b.dur + 0.05)
        osc2.stop(t0 + b.dur + 0.05)
      })
      break
    }
  }

    return Promise.resolve(true)
  } catch (e) {
    return Promise.resolve(false)
  }
}

export function playHaptic(type = 'tap') {
  try {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return
    if (type === 'setDone') navigator.vibrate(30)
    else if (type === 'restOver') navigator.vibrate([60, 80, 60])
    else if (type === 'heavy') navigator.vibrate([40, 60, 40, 60, 80])
    else navigator.vibrate(20)
  } catch (e) { /* */ }
}
