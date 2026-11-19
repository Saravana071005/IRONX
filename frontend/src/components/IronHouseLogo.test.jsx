import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import IronHouseLogo from './IronHouseLogo.jsx'
import { THEME_PRESETS } from '../lib/themes.js'

describe('Official IRON HOUSE Arc Reactor Logo Component', () => {
  it('renders official brand logo with official white artwork', () => {
    const html = renderToString(<IronHouseLogo />)
    expect(html).toContain('iron-house-logo')
    expect(html).toContain('/iron-house-logo.png')
    expect(html).toContain('alt="IRON HOUSE"')
    expect(html).toContain('aria-label="IRON HOUSE"')
    expect(html).not.toContain('GYRA PRIME')
    expect(html).not.toContain('openGym')
  })

  it('preserves the original white luminous glow filter', () => {
    const html = renderToString(<IronHouseLogo glow={true} />)
    expect(html).toContain('iron-house-glow')
    expect(html).toContain('rgba(255, 255, 255')
  })

  it('supports iconOnly mode displaying the Arc Reactor emblem', () => {
    const html = renderToString(<IronHouseLogo iconOnly size="md" />)
    expect(html).toContain('iron-house-emblem')
    expect(html).toContain('/iron-house-reactor.png')
    expect(html).toContain('alt="IRON HOUSE Arc Reactor"')
    expect(html).not.toContain('/iron-house-logo.png')
  })

  it('renders required height scales (xs, sm, md, lg, xl, numeric)', () => {
    const htmlXs = renderToString(<IronHouseLogo size="xs" />)
    const htmlLg = renderToString(<IronHouseLogo size="lg" />)
    const htmlCustom = renderToString(<IronHouseLogo size={50} />)

    expect(htmlXs).toContain('height:18px')
    expect(htmlLg).toContain('height:44px')
    expect(htmlCustom).toContain('height:50px')
  })

  it('keeps the uploaded logo artwork white and unchanged across all theme presets', () => {
    const themeIds = Object.keys(THEME_PRESETS)
    themeIds.forEach(id => {
      const preset = THEME_PRESETS[id]
      const html = renderToString(
        <div style={{ color: preset.primary, '--theme-accent': preset.primary }}>
          <IronHouseLogo />
        </div>
      )
      // Logo image source and white glow remain strictly unchanged
      expect(html).toContain('/iron-house-logo.png')
      expect(html).toContain('rgba(255, 255, 255')
    })
  })
})
