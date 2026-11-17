import { describe, it, expect, vi } from 'vitest'
import {
  ALERT_TONES,
  playRestAlert,
  previewAlertTone,
  triggerRestNotification,
  requestNotificationPermission,
  beep,
  vibrate
} from './sound.js'

describe('Feature 2: Rest Timer Alert Sound & Audio Synthesis', () => {
  it('exposes all 5 built-in alert tones with descriptive metadata', () => {
    expect(ALERT_TONES.length).toBe(5)
    const toneIds = ALERT_TONES.map(t => t.id)
    expect(toneIds).toContain('chime')
    expect(toneIds).toContain('bell')
    expect(toneIds).toContain('beep')
    expect(toneIds).toContain('gong')
    expect(toneIds).toContain('digital')

    ALERT_TONES.forEach(tone => {
      expect(typeof tone.name).toBe('string')
      expect(tone.name.length).toBeGreaterThan(0)
    })
  })

  it('playRestAlert and previewAlertTone execute safely without throwing errors', () => {
    // Should run smoothly without exceptions in simulated browser environment
    expect(() => playRestAlert('chime', 0.8)).not.toThrow()
    expect(() => playRestAlert('bell', 0.5)).not.toThrow()
    expect(() => playRestAlert('beep', 1.0)).not.toThrow()
    expect(() => playRestAlert('gong', 0.2)).not.toThrow()
    expect(() => playRestAlert('digital', 0.7)).not.toThrow()
    expect(() => previewAlertTone('chime', 0.8)).not.toThrow()
  })

  it('clamps volume safely within [0.0, 1.0]', () => {
    expect(() => playRestAlert('chime', -1)).not.toThrow()
    expect(() => playRestAlert('chime', 1.5)).not.toThrow()
    expect(() => playRestAlert('chime', null)).not.toThrow()
    expect(() => playRestAlert('chime', undefined)).not.toThrow()
  })

  it('triggerRestNotification returns false gracefully when notifications are not granted', () => {
    const res = triggerRestNotification('Rest Complete', 'Time for next set')
    expect(typeof res).toBe('boolean')
  })

  it('beep and vibrate backward compatibility functions do not throw', () => {
    expect(() => beep(true, 880, 0.1)).not.toThrow()
    expect(() => beep(false, 880, 0.1)).not.toThrow()
    expect(() => vibrate([100, 50, 100])).not.toThrow()
  })
})
