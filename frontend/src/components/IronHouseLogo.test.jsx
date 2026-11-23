import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import IronHouseLogo, { IronXLogo } from './IronHouseLogo.jsx'
import { THEME_PRESETS } from '../lib/themes.js'

describe('Official IRONX Brand Logo Component', () => {
  it('renders official brand logo with transparent artwork source', () => {
    const html = renderToString(<IronHouseLogo />)
    expect(html).toContain('ironx-logo')
    expect(html).toContain('/ironx-logo.png?v=4')
    expect(html).toContain('alt="IRONX"')
    expect(html).toContain('aria-label="IRONX"')
    expect(html).not.toContain('GYRA PRIME')
    expect(html).not.toContain('openGym')
  })

  it('enforces strict zero-glow, zero-shadow, and filter: none', () => {
    const html = renderToString(<IronHouseLogo />)
    expect(html).toContain('filter:none')
    expect(html).not.toContain('drop-shadow')
    expect(html).not.toContain('box-shadow: 0')
  })

  it('renders correctly across sizes (xs, sm, md, lg, xl, numeric)', () => {
    const htmlXs = renderToString(<IronHouseLogo size="xs" />)
    const htmlSm = renderToString(<IronHouseLogo size="sm" />)
    const htmlMd = renderToString(<IronHouseLogo size="md" />)
    const htmlLg = renderToString(<IronHouseLogo size="lg" />)
    const htmlCustom = renderToString(<IronHouseLogo size={50} />)

    for (const h of [htmlXs, htmlSm, htmlMd, htmlLg, htmlCustom]) {
      expect(h).toContain('/ironx-logo.png?v=4')
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

  it('also works when imported as IronXLogo', () => {
    const html = renderToString(<IronXLogo size="md" />)
    expect(html).toContain('alt="IRONX"')
    expect(html).toContain('/ironx-logo.png?v=4')
  })
})
