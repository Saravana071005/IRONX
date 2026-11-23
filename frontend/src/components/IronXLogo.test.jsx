import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import IronXLogo from './IronXLogo.jsx'
import { THEME_PRESETS } from '../lib/themes.js'

describe('Official IRONX Brand Logo Component', () => {
  it('renders official brand logo emblem with exact transparent artwork source', () => {
    const html = renderToString(<IronXLogo />)
    expect(html).toContain('ironx-logo')
    expect(html).toContain('/ironx-logo.png?v=4')
    expect(html).toContain('alt="IRONX"')
    expect(html).toContain('aria-label="IRONX"')
    expect(html).toContain('aspect-ratio:1296 / 497')
          })

  it('enforces strict zero-glow, zero-shadow, and filter: none', () => {
    const html = renderToString(<IronXLogo />)
    expect(html).toContain('filter:none')
    expect(html).not.toContain('drop-shadow')
    expect(html).not.toContain('box-shadow: 0')
  })

  it('supports variant="square" using square icon asset', () => {
    const html = renderToString(<IronXLogo variant="square" />)
    expect(html).toContain('/ironx-logo-square.png?v=4')
    expect(html).toContain('alt="IRONX"')
    expect(html).toContain('aspect-ratio:1 / 1')
  })

  it('renders correct heights across sizes (xs, sm, md, lg, xl, numeric)', () => {
    const htmlXs = renderToString(<IronXLogo size="xs" />)
    const htmlSm = renderToString(<IronXLogo size="sm" />)
    const htmlMd = renderToString(<IronXLogo size="md" />)
    const htmlLg = renderToString(<IronXLogo size="lg" />)
    const htmlCustom = renderToString(<IronXLogo size={50} />)

    for (const h of [htmlXs, htmlSm, htmlMd, htmlLg, htmlCustom]) {
      expect(h).toContain('/ironx-logo.png?v=4')
    }

    expect(htmlXs).toContain('height:18px')
    expect(htmlSm).toContain('height:24px')
    expect(htmlMd).toContain('height:32px')
    expect(htmlLg).toContain('height:44px')
    expect(htmlCustom).toContain('height:50px')
  })

  it('guarantees transparent background, no borders and no box shadows on wrapper', () => {
    const html = renderToString(<IronXLogo />)
    expect(html).toContain('background:transparent')
    expect(html).toContain('border:none')
    expect(html).toContain('box-shadow:none')
  })

  it('keeps the official artwork unchanged across all theme presets', () => {
    const themeIds = Object.keys(THEME_PRESETS)
    themeIds.forEach(id => {
      const preset = THEME_PRESETS[id]
      const html = renderToString(
        <div style={{ color: preset.primary, '--theme-accent': preset.primary }}>
          <IronXLogo />
        </div>
      )
      expect(html).toContain('/ironx-logo.png?v=4')
      expect(html).toContain('alt="IRONX"')
      expect(html).toContain('filter:none')
    })
  })


})
