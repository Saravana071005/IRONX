import { describe, it, expect, beforeEach } from 'vitest'
import { applyThemeToDocument } from '../lib/themes.js'

describe('IRONX Light Mode & Workout Alignment Verification', () => {
  let mockStyle = {}
  let mockDataset = {}

  beforeEach(() => {
    mockStyle = {}
    mockDataset = {}
    globalThis.document = {
      documentElement: {
        dataset: mockDataset,
        setAttribute: (k, v) => { mockDataset[k] = v },
        style: {
          setProperty: (k, v) => { mockStyle[k] = v },
          getPropertyValue: (k) => mockStyle[k] || ''
        }
      }
    }
  })

  it('applies crisp, high-contrast Light Mode design tokens', () => {
    applyThemeToDocument({ theme: 'light' })

    expect(mockDataset.theme).toBe('light')
    expect(mockStyle['--bg']).toBe('#F5F5F5')
    expect(mockStyle['--surface']).toBe('#FFFFFF')
    expect(mockStyle['--surface-2']).toBe('#EEEEF0')
    expect(mockStyle['--surface-3']).toBe('#E5E5E8')
    expect(mockStyle['--label']).toBe('#111111')
    expect(mockStyle['--label-2']).toBe('#444444')
    expect(mockStyle['--label-3']).toBe('#666666')
    expect(mockStyle['--borders']).toBe('#D6D6D9')
    expect(mockStyle['--input-bg']).toBe('#F0F0F2')
    expect(mockStyle['--input-text']).toBe('#111111')
    expect(mockStyle['--placeholder-text']).toBe('#777777')
    expect(mockStyle['--active-ctrl-bg']).toBe('#E5E5E8')
    expect(mockStyle['--active-ctrl-text']).toBe('#111111')
  })

  it('applies natural peach skin-tone Anatomical Map tokens in Light Mode', () => {
    applyThemeToDocument({ theme: 'light' })

    expect(mockStyle['--bm-base']).toBe('#98624F')
    expect(mockStyle['--bm-stroke']).toBe('#775344')
    expect(mockStyle['--bm-inert']).toBe('#D9A58D')
    expect(mockStyle['--bm-l1']).toBe('#BD806A')
    expect(mockStyle['--bm-l2']).toBe('#DFA88E')
    expect(mockStyle['--bm-l3']).toBe('#DFA88E')
  })

  it('preserves approved Dark Mode tokens without any regression', () => {
    applyThemeToDocument({ theme: 'dark' })

    expect(mockDataset.theme).toBe('dark')
    expect(mockStyle['--bg']).toBe('#09090B')
    expect(mockStyle['--surface']).toBe('#1C1C20')
    expect(mockStyle['--surface-2']).toBe('#242429')
    expect(mockStyle['--label']).toBe('#F5F5F5')
    expect(mockStyle['--borders']).toBe('#303036')
    expect(mockStyle['--input-bg']).toBe('#18181B')
    expect(mockStyle['--input-text']).toBe('#FFFFFF')
    expect(mockStyle['--bm-base']).toBe('#22222A')
  })
})
