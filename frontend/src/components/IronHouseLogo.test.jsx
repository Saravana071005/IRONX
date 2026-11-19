import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import IronHouseLogo from './IronHouseLogo.jsx'
import { THEME_PRESETS } from '../lib/themes.js'

describe('Official IRON HOUSE Brand Logo Component', () => {
  it('renders official brand logo with full IRON HOUSE wordmark', () => {
    const html = renderToString(<IronHouseLogo />)
    expect(html).toContain('iron-house-logo')
    expect(html).toContain('/iron-house-logo.png?v=2')
    expect(html).toContain('alt="IRON HOUSE"')
    expect(html).toContain('aria-label="IRON HOUSE"')
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
    expect(html).toContain('/iron-house-logo-black.png?v=2')
    expect(html).toContain('alt="IRON HOUSE"')
    expect(html).toContain('filter:none')
  })

  it('always renders complete full logo in any size (never only the Arc Reactor)', () => {
    const htmlXs = renderToString(<IronHouseLogo size="xs" />)
    const htmlSm = renderToString(<IronHouseLogo size="sm" />)
    const htmlMd = renderToString(<IronHouseLogo size="md" />)
    const htmlLg = renderToString(<IronHouseLogo size="lg" />)
    const htmlCustom = renderToString(<IronHouseLogo size={50} />)

    // All sizes must render the complete full logo
    for (const h of [htmlXs, htmlSm, htmlMd, htmlLg, htmlCustom]) {
      expect(h).toContain('/iron-house-logo.png')
      expect(h).toContain('alt="IRON HOUSE"')
      expect(h).not.toContain('iron-house-reactor.png')
    }

    expect(htmlXs).toContain('height:18px')
    expect(htmlSm).toContain('height:24px')
    expect(htmlMd).toContain('height:32px')
    expect(htmlLg).toContain('height:44px')
    expect(htmlCustom).toContain('height:50px')
  })

  it('guarantees transparent background, no borders and no box shadows on wrapper', () => {
    const html = renderToString(<IronHouseLogo />)
    expect(html).toContain('background:transparent')
    expect(html).toContain('border:none')
    expect(html).toContain('box-shadow:none')
  })

  it('keeps the official logo artwork unchanged and intact across all theme presets', () => {
    const themeIds = Object.keys(THEME_PRESETS)
    themeIds.forEach(id => {
      const preset = THEME_PRESETS[id]
      const html = renderToString(
        <div style={{ color: preset.primary, '--theme-accent': preset.primary }}>
          <IronHouseLogo />
        </div>
      )
      expect(html).toContain('/iron-house-logo.png?v=2')
      expect(html).toContain('alt="IRON HOUSE"')
      expect(html).toContain('filter:none')
    })
  })
})
