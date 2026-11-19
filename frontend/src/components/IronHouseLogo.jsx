import React from 'react'

/**
 * Official IRON HOUSE Logo Symbol Component
 * - Single official website logo: Glowing Orange Arc Reactor Emblem
 * - Exact supplied artwork preserved (original orange color, circular proportions)
 * - Displayed cleanly against black background
 * - STRICT RULES:
 *   - NO CSS glow
 *   - NO drop-shadow
 *   - NO gradient
 *   - NO borders or box-shadow
 *   - NO extra graphics or modifications
 */
export default function IronHouseLogo({
  size = 'md',
  variant = 'transparent', // 'transparent' | 'black'
  className = '',
  style = {}
}) {
  const heights = {
    xs: 20,
    sm: 28,
    md: 36,
    lg: 48,
    xl: 64
  }

  const h = typeof size === 'number' ? size : heights[size] || heights.md
  const logoSrc = variant === 'black' ? '/iron-house-logo-black.png?v=3' : '/iron-house-logo.png?v=3'

  return (
    <span
      className={`iron-house-logo ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        lineHeight: 1,
        verticalAlign: 'middle',
        userSelect: 'none',
        ...style
      }}
      role="img"
      aria-label="IRON HOUSE"
    >
      <img
        src={logoSrc}
        alt="IRON HOUSE"
        style={{
          height: `${h}px`,
          width: `${h}px`,
          maxWidth: '100%',
          aspectRatio: '1 / 1',
          display: 'block',
          objectFit: 'contain',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          filter: 'none',
          userSelect: 'none',
          pointerEvents: 'none'
        }}
      />
    </span>
  )
}
