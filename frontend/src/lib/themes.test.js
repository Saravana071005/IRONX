import { describe, it, expect } from 'vitest'
import { THEME_PRESETS, THEME_ALIASES, getThemePreset, applyThemeToDocument } from './themes.js'

describe('Dynamic Accent Theme System', () => {
  it('defines the 7 required distinct accent themes', () => {
    const requiredThemes = [
      'warm-gold',
      'silver',
      'electric-blue',
      'emerald-green',
      'orange',
      'crimson-red',
      'dark-teal'
    ]
    requiredThemes.forEach(id => {
      const preset = THEME_PRESETS[id]
      expect(preset).toBeDefined()
      expect(preset.id).toBe(id)
      expect(preset.primary).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(preset.rgb).toMatch(/^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/)
      expect(preset.glow1).toBeDefined()
      expect(preset.glow2).toBeDefined()
      expect(preset.glow3).toBeDefined()
      expect(preset.glow4).toBeDefined()
      expect(preset.heroGradient).toContain('linear-gradient')
    })
  })

  it('correctly resolves legacy theme IDs via aliases', () => {
    expect(getThemePreset('imperial-gold').id).toBe('warm-gold')
    expect(getThemePreset('champagne-elegance').id).toBe('warm-gold')
    expect(getThemePreset('bronze-armor').id).toBe('warm-gold')
    expect(getThemePreset('royal-amber').id).toBe('warm-gold')
    expect(getThemePreset('midnight-gold').id).toBe('warm-gold')
    expect(getThemePreset('electric-blue').id).toBe('electric-blue')
    expect(getThemePreset('unknown-id').id).toBe('warm-gold')
  })

  it('applyThemeToDocument safely executes without throwing', () => {
    expect(() => applyThemeToDocument({ bgTheme: 'electric-blue' })).not.toThrow()
    expect(() => applyThemeToDocument({})).not.toThrow()
    expect(() => applyThemeToDocument(null)).not.toThrow()
  })
})
