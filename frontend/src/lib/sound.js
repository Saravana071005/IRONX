// WebAudio loud rest-completion alarm synthesizers + haptics + notification integration
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

// Auto-unlock WebAudio on user interaction anywhere on the window
if (typeof window !== 'undefined') {
  const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown']
  const onUserGesture = () => {
    unlockAudio()
  }
  unlockEvents.forEach(evt => window.addEventListener(evt, onUserGesture, { capture: true, passive: true }))
}

export const ALERT_TONES = [
  { id: 'alarm', name: 'Power Alarm (Recommended)', description: 'Loud, repeating 3-burst gym alarm — cuts through gym noise' },
  { id: 'boxing_bell', name: 'Triple Boxing Bell', description: 'Authentic 3-strike round bell with rich brass resonance' },
  { id: 'digital_pulse', name: 'Digital Siren', description: 'Piercing high-energy electronic pulse for sports headphones' },
  { id: 'gong', name: 'Heavy Gym Gong', description: 'Deep, resonant acoustic gong with long decay' },
  { id: 'chime', name: 'Melodic Chime', description: 'Clean ascending 4-note harmonic chord' }
]

/**
 * Creates a loud, saturated audio chain with dynamic compression to maximize
 * perceived loudness (RMS) while preventing harsh digital clipping.
 */
function createLoudMasterChain(ctx, volume = 1.0) {
  const vol = Math.max(0, Math.min(1, Number(volume) ?? 1.0))
  const master = ctx.createGain()

  // Dynamics compressor acts as a punchy limiter/maximizer for loud gym alerts
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

  // Master output level scaled by user volume
  master.gain.setValueAtTime(vol * 0.95, ctx.currentTime)

  return master
}

/**
 * Plays the chosen rest-completion alert with high acoustic power.
 */
export function playRestAlert(toneName = 'alarm', volume = 1.0) {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  const vol = Math.max(0, Math.min(1, Number(volume) ?? 1.0))
  if (vol <= 0) return

  const now = ctx.currentTime
  const master = createLoudMasterChain(ctx, vol)

  const selected = (toneName || '').toLowerCase()

  switch (selected) {
    case 'boxing_bell': {
      // Triple boxing ring bell: strikes at t=0, t=0.35, t=0.7s with metallic ring
      const strikes = [0, 0.35, 0.70]
      const freqs = [659.25, 1318.5, 2637.0] // E5 fundamental + octaves

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
      // Piercing alternating siren pulses: 4 rapid hits + high sustained burst
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
        osc2.frequency.setValueAtTime(p.freq * 1.005, t0) // slight detune for thickness

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
      // Heavy acoustic gym gong with fundamental 220Hz + thick harmonics
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
      // Bright 4-note ascending chord: 587 -> 740 -> 880 -> 1174 Hz
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
      // Power Gym Alarm (Strong default): 3 loud repeating dual-harmonic bursts
      // Pattern: BURST (0.24s) -> pause (0.08s) -> BURST (0.24s) -> pause (0.08s) -> SUSTAINED BURST (0.75s)
      const bursts = [
        { f1: 880, f2: 1760, start: 0, dur: 0.24 },
        { f1: 880, f2: 1760, start: 0.32, dur: 0.24 },
        { f1: 1046.5, f2: 2093, start: 0.64, dur: 0.75 }
      ]

      bursts.forEach(b => {
        const t0 = now + b.start
        // Dual oscillators: sine fundamental for body + band-shaped square for cutting bite
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const g = ctx.createGain()

        osc1.type = 'sawtooth'
        osc1.frequency.setValueAtTime(b.f1, t0)
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(b.f2, t0)

        // Low-pass filter to soften excessive harshness while preserving acoustic punch
        let filter = null
        try {
          filter = ctx.createBiquadFilter()
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
}

export function previewAlertTone(toneName = 'alarm', volume = 1.0) {
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
    new Notification(title || 'REST COMPLETED — START NEXT SET', {
      body: body || 'Your rest period has ended. Time to crush the next set!',
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
    g.gain.exponentialRampToValueAtTime(0.45, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (dur || 0.18))
    o.start(t0); o.stop(t0 + (dur || 0.18) + 0.05)
  } catch (e) { /* */ }
}

export function vibrate(p) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(p)
    }
  } catch (e) { /* */ }
}
