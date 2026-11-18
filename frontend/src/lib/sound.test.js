import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  ALERT_TONES,
  playRestAlert,
  previewAlertTone,
  triggerRestNotification,
  requestNotificationPermission,
  playNotificationSound,
  unlockAudio,
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
      expect(typeof tone.file).toBe('string')
      expect(tone.file.startsWith('/sounds/')).toBe(true)
    })
  })

  it('has valid PCM audio files generated in public/sounds directory', () => {
    const soundsDir = path.resolve(__dirname, '../../public/sounds')
    expect(fs.existsSync(soundsDir)).toBe(true)

    const expectedFiles = [
      'alarm.wav',
      'boxing_bell.wav',
      'digital_pulse.wav',
      'gong.wav',
      'chime.wav',
      'notification.wav'
    ]

    expectedFiles.forEach(fileName => {
      const p = path.join(soundsDir, fileName)
      expect(fs.existsSync(p)).toBe(true)
      const stat = fs.statSync(p)
      expect(stat.size).toBeGreaterThan(1000) // Minimum valid audio file size
    })
  })

  it('unlockAudio executes safely without throwing', () => {
    expect(() => unlockAudio()).not.toThrow()
  })

  it('playRestAlert and previewAlertTone execute safely across all tones without throwing errors', () => {
    expect(() => playRestAlert('alarm', 1.0)).not.toThrow()
    expect(() => playRestAlert('boxing_bell', 0.8)).not.toThrow()
    expect(() => playRestAlert('digital_pulse', 0.9)).not.toThrow()
    expect(() => playRestAlert('gong', 0.7)).not.toThrow()
    expect(() => playRestAlert('chime', 0.6)).not.toThrow()
    expect(() => previewAlertTone('alarm', 1.0)).not.toThrow()
  })

  it('playNotificationSound executes safely without throwing', () => {
    expect(() => playNotificationSound(0.9)).not.toThrow()
    expect(() => playNotificationSound(0)).not.toThrow()
  })

  it('clamps volume safely within [0.0, 1.0]', () => {
    expect(() => playRestAlert('alarm', -1)).not.toThrow()
    expect(() => playRestAlert('alarm', 2.0)).not.toThrow()
    expect(() => playRestAlert('alarm', null)).not.toThrow()
    expect(() => playRestAlert('alarm', undefined)).not.toThrow()
  })

  it('triggerRestNotification executes safely with custom alert options and returns false when notifications are not granted', () => {
    const res = triggerRestNotification('REST COMPLETED — START NEXT SET', 'Time for next set', {
      playSound: true,
      tone: 'chime',
      volume: 0.8,
      vibratePattern: [200, 100, 200]
    })
    expect(typeof res).toBe('boolean')
  })

  it('beep and vibrate backward compatibility functions do not throw', () => {
    expect(() => beep(true, 880, 0.1)).not.toThrow()
    expect(() => beep(false, 880, 0.1)).not.toThrow()
    expect(() => vibrate([300, 150, 300])).not.toThrow()
  })
})
