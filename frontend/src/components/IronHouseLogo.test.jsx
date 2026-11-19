import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import IronHouseLogo from './IronHouseLogo.jsx'
import { THEME_PRESETS } from '../lib/themes.js'

describe('Official IRON HOUSE Orange Glow Logo Component', () => {
  it('renders official brand logo with orange glow artwork', () => {
    const html = renderToString(<IronHouseLogo />)
    expect(html).toContain('iron-house-logo')
    expect(html).toContain('/iron-house-logo.png')
    expect(html).toContain('alt="IRON HOUSE"')
    expect(html).toContain('aria-label="IRON HOUSE"')
    expect(html).not.toContain('GYRA PRIME')
    expect(html).not.toContain('openGym')
  })

  it('applies natural organic orange glow drop-shadow filter', () => {
    const html = renderToString(<IronHouseLogo glow={true} variant="transparent" />)
    expect(html).toContain('iron-house-glow')
    expect(html).toContain('rgba(255, 122, 0')
  })

  it('supports variant="black" using solid black background asset', () => {
    const html = renderToString(<IronHouseLogo variant="black" glow />)
    expect(html).toContain('/iron-house-logo-black.png')
    expect(html).toContain('alt="IRON HOUSE"')
  })

  it('supports iconOnly mode displaying the orange Arc Reactor emblem', () => {
    const html = renderToString(<IronHouseLogo iconOnly size="md" />)
    expect(html).toContain('iron-house-emblem')
    expect(html).toContain('/iron-house-reactor.png')
    expect(html).toContain('alt="IRON HOUSE Arc Reactor"')
    expect(html).toContain('rgba(255, 122, 0')
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

  it('guarantees transparent background, no borders and no rectangular box shadows', () => {
    const html = renderToString(<IronHouseLogo />)
    expect(html).toContain('background:transparent')
    expect(html).toContain('border:none')
    expect(html).toContain('box-shadow:none')
  })

  it('keeps the orange logo artwork and glow consistent across all theme presets', () => {
    const themeIds = Object.keys(THEME_PRESETS)
    themeIds.forEach(id => {
      const preset = THEME_PRESETS[id]
      const html = renderToString(
        <div style={{ color: preset.primary, '--theme-accent': preset.primary }}>
          <IronHouseLogo glow />
        </div>
      )
      // Orange logo image source and orange glow filter remain strictly intact
      expect(html).toContain('/iron-house-logo.png')
      expect(html).toContain('rgba(255, 122, 0')
    })
  })
})
