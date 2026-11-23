// WebAudio beeps + haptics (ported from the vanilla app). `enabled` gates sound.
import { useStore } from '../store/useStore.js'

let audioCtx = null

export function beep(enabled, freq, dur, when) {
  const S = useStore.getState?.()?.S
  if (!enabled || S?.stealthMode || S?.feedbackMode === 'silent' || S?.feedbackMode === 'haptic' || S?.feedbackMode === 'visual') return
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const o = audioCtx.createOscillator(), g = audioCtx.createGain()
    o.connect(g); g.connect(audioCtx.destination)
    o.frequency.value = freq || 880; o.type = 'sine'
    const t0 = audioCtx.currentTime + (when || 0)
    g.gain.setValueAtTime(0.001, t0)
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (dur || 0.18))
    o.start(t0); o.stop(t0 + (dur || 0.18) + 0.05)
  } catch (e) { /* */ }
}

export function vibrate(p) {
  const S = useStore.getState?.()?.S
  if (S?.feedbackMode === 'silent' || S?.feedbackMode === 'visual') return
  try { navigator.vibrate && navigator.vibrate(p) } catch (e) { /* */ }
}

export function playHaptic(type = 'tap') {
  const S = useStore.getState?.()?.S
  if (S?.feedbackMode === 'silent' || S?.feedbackMode === 'visual') return
  try {
    if (!navigator.vibrate) return
    if (type === 'setDone') navigator.vibrate(30)
    else if (type === 'restOver') navigator.vibrate([60, 80, 60])
    else if (type === 'heavy') navigator.vibrate([40, 60, 40, 60, 80])
    else navigator.vibrate(20)
  } catch (e) { /* */ }
}
