import React from 'react'

/**
 * Official IRON HOUSE Orange Glow Logo Component
 * - Bright shining orange with warm amber highlights
 * - Arc Reactor symbol replacing the letter 'O' in 'IRON'
 * - Symmetrical dumbbells on both sides
 * - Natural organic contour glow following the exact artwork shape
 * - ZERO rectangular glow, ZERO grey patches, ZERO background cards
 * - Supports transparent-background and solid-black-background variants
 */
export default function IronHouseLogo({
  size = 'md',
  glow = true,
  iconOnly = false,
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

  // Icon-only view: Renders the glowing orange Arc Reactor emblem
  if (iconOnly) {
    const emblemH = Math.round(h * 0.95)
    return (
      <span
        className={`iron-house-emblem ${glow ? 'iron-house-glow' : ''} ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          lineHeight: 1,
          verticalAlign: 'middle',
          ...style
        }}
        role="img"
        aria-label="IRON HOUSE"
      >
        <img
          src="/iron-house-reactor.png"
          alt="IRON HOUSE Arc Reactor"
          style={{
            height: `${emblemH}px`,
            width: 'auto',
            display: 'block',
            objectFit: 'contain',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            filter: glow
              ? 'drop-shadow(0 0 8px rgba(255, 122, 0, 0.55)) drop-shadow(0 0 18px rgba(255, 122, 0, 0.28))'
              : 'none',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
        />
      </span>
    )
  }

  const logoSrc = variant === 'black' ? '/iron-house-logo-black.png' : '/iron-house-logo.png'

  return (
    <span
      className={`iron-house-logo ${glow ? 'iron-house-glow' : ''} ${className}`}
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
          filter: glow && variant === 'transparent'
            ? 'drop-shadow(0 0 10px rgba(255, 122, 0, 0.50)) drop-shadow(0 0 24px rgba(255, 122, 0, 0.25))'
            : 'none',
          userSelect: 'none',
          pointerEvents: 'none'
        }}
      />
    </span>
  )
}
