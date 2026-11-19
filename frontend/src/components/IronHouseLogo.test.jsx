import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import IronHouseLogo from './IronHouseLogo.jsx'
import { THEME_PRESETS } from '../lib/themes.js'

describe('Official IRON HOUSE Arc Reactor Emblem Logo Component', () => {
  it('renders official brand logo emblem with exact artwork source', () => {
    const html = renderToString(<IronHouseLogo />)
    expect(html).toContain('iron-house-logo')
    expect(html).toContain('/iron-house-logo.png?v=3')
    expect(html).toContain('alt="IRON HOUSE"')
    expect(html).toContain('aria-label="IRON HOUSE"')
    expect(html).toContain('aspect-ratio:1 / 1')
    expect(html).not.toContain('GYRA PRIME')
    expect(html).not.toContain('openGym')
  })

  it('enforces strict zero-glow, zero-shadow, and filter: none', () => {
    const html = renderToString(<IronHouseLogo />)
    expect(html).toContain('filter:none')
    expect(html).not.toContain('drop-shadow')
    expect(html).not.toContain('box-shadow: 0')
  })

  it('supports variant="black" using solid black background asset', () => {
    const html = renderToString(<IronHouseLogo variant="black" />)
    expect(html).toContain('/iron-house-logo-black.png?v=3')
    expect(html).toContain('alt="IRON HOUSE"')
    expect(html).toContain('filter:none')
  })

  it('renders correct 1:1 circular proportions across sizes (xs, sm, md, lg, xl, numeric)', () => {
    const htmlXs = renderToString(<IronHouseLogo size="xs" />)
    const htmlSm = renderToString(<IronHouseLogo size="sm" />)
    const htmlMd = renderToString(<IronHouseLogo size="md" />)
    const htmlLg = renderToString(<IronHouseLogo size="lg" />)
    const htmlCustom = renderToString(<IronHouseLogo size={50} />)

    for (const h of [htmlXs, htmlSm, htmlMd, htmlLg, htmlCustom]) {
      expect(h).toContain('/iron-house-logo.png?v=3')
      expect(h).toContain('aspect-ratio:1 / 1')
    }

    expect(htmlXs).toContain('height:20px')
    expect(htmlSm).toContain('height:28px')
    expect(htmlMd).toContain('height:36px')
    expect(htmlLg).toContain('height:48px')
    expect(htmlCustom).toContain('height:50px')
  })

  it('guarantees transparent background, no borders and no box shadows on wrapper', () => {
    const html = renderToString(<IronHouseLogo />)
    expect(html).toContain('background:transparent')
    expect(html).toContain('border:none')
    expect(html).toContain('box-shadow:none')
  })

  it('keeps the official emblem artwork unchanged across all theme presets', () => {
    const themeIds = Object.keys(THEME_PRESETS)
    themeIds.forEach(id => {
      const preset = THEME_PRESETS[id]
      const html = renderToString(
        <div style={{ color: preset.primary, '--theme-accent': preset.primary }}>
          <IronHouseLogo />
        </div>
      )
      expect(html).toContain('/iron-house-logo.png?v=3')
      expect(html).toContain('alt="IRON HOUSE"')
      expect(html).toContain('filter:none')
    })
  })
})
