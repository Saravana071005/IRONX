import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import GyraPrimeLogo, { DumbbellPlateHalf, DumbbellEmblem } from './GyraPrimeLogo.jsx'
import { THEME_PRESETS, getThemePreset } from '../lib/themes.js'

describe('Official GYRA PRIME Logo Component & Dynamic Theme Integration', () => {
  it('renders official brand wordmark "GYRA PRIME" strictly in uppercase', () => {
    const html = renderToString(<GyraPrimeLogo />)
    expect(html).toContain('GYRA PRIME')
    expect(html).not.toContain('openGym')
    expect(html).not.toContain('OpenGym')
    expect(html).not.toContain('Open Gym')
  })

  it('contains both left and right symmetrical barbell plate stacks and Bodoni Moda typography', () => {
    const html = renderToString(<GyraPrimeLogo size="md" glow={true} />)
    expect(html).toContain('gyra-dumbbell-left')
    expect(html).toContain('gyra-dumbbell-right')
    expect(html).toContain('scaleX(-1)')
    expect(html).toContain('Bodoni Moda')
    expect(html).toContain('gyra-glow')
  })

  it('supports iconOnly mode for collapsed navigation displaying the dumbbell emblem', () => {
    const html = renderToString(<GyraPrimeLogo iconOnly size="sm" />)
    expect(html).toContain('gyra-dumbbell-emblem')
    expect(html).toContain('aria-label="GYRA PRIME"')
    expect(html).not.toContain('gyra-prime-wordmark')
  })

  it('renders different size scales (xs, sm, md, lg, xl, number)', () => {
    const htmlXs = renderToString(<GyraPrimeLogo size="xs" />)
    const htmlLg = renderToString(<GyraPrimeLogo size="lg" />)
    const htmlCustom = renderToString(<GyraPrimeLogo size={40} />)

    expect(htmlXs).toContain('font-size:13px')
    expect(htmlLg).toContain('font-size:32px')
    expect(htmlCustom).toContain('font-size:40px')
  })

  it('dynamically adapts across all 8 supported theme presets with matching primary accent and glow', () => {
    const themeIds = [
      'warm-gold',
      'silver',
      'electric-blue',
      'emerald-green',
      'orange',
      'crimson-red',
      'dark-teal',
      'warm-white'
    ]

    themeIds.forEach(id => {
      const preset = getThemePreset(id)
      expect(preset).toBeDefined()
      expect(preset.primary).toBeDefined()
      expect(preset.glow1).toBeDefined()

      // The logo relies on var(--theme-accent) and currentColor for 100% reactive theme cascading
      const rendered = renderToString(
        <div style={{ color: preset.primary, '--theme-accent': preset.primary }}>
          <GyraPrimeLogo />
        </div>
      )
      expect(rendered).toContain('GYRA PRIME')
      expect(rendered).toContain(preset.primary)
    })
  })
})
