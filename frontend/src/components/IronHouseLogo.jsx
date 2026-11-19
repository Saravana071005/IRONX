import React from 'react'

/**
 * Official IRON HOUSE Brand Logo Component
 * - Full complete wordmark containing:
 *   - The full text "IRON HOUSE"
 *   - Symmetrical barbell plate stacks on both sides
 *   - Central Arc Reactor symbol replacing the letter 'O' in 'IRON'
 *   - Original proportions, spacing, and typography
 * - Clean pure black background (#000000) on black viewports
 * - STRICT RULES:
 *   - NO CSS glow
 *   - NO drop-shadow
 *   - NO gradient
 *   - NO rectangular card or glowing container
 *   - NO borders or additional decorative elements
 * - Always displays the COMPLETE IRON HOUSE logo (never Arc Reactor alone)
 */
export default function IronHouseLogo({
  size = 'md',
  variant = 'transparent', // 'transparent' | 'black'
  className = '',
  style = {}
}) {
  const heights = {
    xs: 18,
    sm: 24,
    md: 32,
    lg: 44,
    xl: 60
  }

  const h = typeof size === 'number' ? size : heights[size] || heights.md
  const logoSrc = variant === 'black' ? '/iron-house-logo-black.png?v=2' : '/iron-house-logo.png?v=2'

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
          width: 'auto',
          maxWidth: '100%',
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
