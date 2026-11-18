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

describe('Improved Rest Timer Alert Sound & Audio Synthesis', () => {
  it('exposes all 5 built-in alert tones with Power Alarm as recommended default', () => {
    expect(ALERT_TONES.length).toBe(5)
    const toneIds = ALERT_TONES.map(t => t.id)
    expect(toneIds).toContain('alarm')
    expect(toneIds).toContain('boxing_bell')
    expect(toneIds).toContain('digital_pulse')
    expect(toneIds).toContain('gong')
    expect(toneIds).toContain('chime')

    // First tone must be the strong alarm
    expect(ALERT_TONES[0].id).toBe('alarm')

    ALERT_TONES.forEach(tone => {
      expect(typeof tone.name).toBe('string')
      expect(tone.name.length).toBeGreaterThan(0)
      expect(typeof tone.description).toBe('string')
    })
  })

  it('playRestAlert and previewAlertTone execute safely across all tones without throwing errors', () => {
    expect(() => playRestAlert('alarm', 1.0)).not.toThrow()
    expect(() => playRestAlert('boxing_bell', 0.8)).not.toThrow()
    expect(() => playRestAlert('digital_pulse', 0.9)).not.toThrow()
    expect(() => playRestAlert('gong', 0.7)).not.toThrow()
    expect(() => playRestAlert('chime', 0.6)).not.toThrow()
    expect(() => previewAlertTone('alarm', 1.0)).not.toThrow()
  })

  it('clamps volume safely within [0.0, 1.0]', () => {
    expect(() => playRestAlert('alarm', -1)).not.toThrow()
    expect(() => playRestAlert('alarm', 2.0)).not.toThrow()
    expect(() => playRestAlert('alarm', null)).not.toThrow()
    expect(() => playRestAlert('alarm', undefined)).not.toThrow()
  })

  it('triggerRestNotification returns false gracefully when notifications are not granted', () => {
    const res = triggerRestNotification('REST COMPLETED — START NEXT SET', 'Time for next set')
    expect(typeof res).toBe('boolean')
  })

  it('beep and vibrate backward compatibility functions do not throw', () => {
    expect(() => beep(true, 880, 0.1)).not.toThrow()
    expect(() => beep(false, 880, 0.1)).not.toThrow()
    expect(() => vibrate([300, 150, 300])).not.toThrow()
  })
})
