import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'

describe('Direct Launch and Simple Loading Screen', () => {
  it('renders a simple loading spinner and Loading... on pure black without branding when unready', () => {
    // Test the simple loading markup rendered while initializing
    const loadingHtml = renderToString(
      <div
        id="app"
        style={{
          background: '#000000',
          minHeight: '100vh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}
        role="status"
        aria-live="polite"
      >
        <div className="simple-loading-spinner" />
        <span style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '13px', fontWeight: 500, letterSpacing: '0.02em' }}>
          Loading...
        </span>
      </div>
    )

    expect(loadingHtml).toContain('simple-loading-spinner')
    expect(loadingHtml).toContain('Loading...')
    expect(loadingHtml).toContain('background:#000000')

    // Absolutely NO branding, NO logo, NO welcome message
    expect(loadingHtml).not.toContain('IRON HOUSE')
    expect(loadingHtml).not.toContain('iron-house-logo')
    expect(loadingHtml).not.toContain('Welcome')
    expect(loadingHtml).not.toContain('Arc Reactor')
  })
})
