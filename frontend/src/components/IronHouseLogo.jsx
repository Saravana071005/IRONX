import React from 'react'

/**
 * Official IRON HOUSE Logo Component
 * - Exact official artwork from the user-uploaded reference
 * - Preserves the symmetrical dumbbells on both sides
 * - Preserves the Arc Reactor symbol replacing the letter 'O' in 'IRON'
 * - Preserves the exact original lettering and proportions
 * - Stays crisp luminous white across all theme presets
 */
export default function IronHouseLogo({
  size = 'md',
  glow = true,
  iconOnly = false,
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

  // Icon-only view: Renders the glowing Arc Reactor emblem
  if (iconOnly) {
    const emblemH = Math.round(h * 0.95)
    return (
      <span
        className={`iron-house-emblem ${glow ? 'iron-house-glow' : ''} ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
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
            filter: glow
              ? 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.45)) drop-shadow(0 0 16px rgba(255, 255, 255, 0.20))'
              : 'none',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
        />
      </span>
    )
  }

  return (
    <span
      className={`iron-house-logo ${glow ? 'iron-house-glow' : ''} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        verticalAlign: 'middle',
        userSelect: 'none',
        ...style
      }}
      role="img"
      aria-label="IRON HOUSE"
    >
      <img
        src="/iron-house-logo.png"
        alt="IRON HOUSE"
        style={{
          height: `${h}px`,
          width: 'auto',
          maxWidth: '100%',
          display: 'block',
          objectFit: 'contain',
          filter: glow
            ? 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.45)) drop-shadow(0 0 20px rgba(255, 255, 255, 0.20))'
            : 'none',
          userSelect: 'none',
          pointerEvents: 'none'
        }}
      />
    </span>
  )
}
