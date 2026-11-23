import React from 'react'

/**
 * Official IRONX Logo Component
 * - Displays the official transparent brand logo (ironx-logo.png)
 * - Transparent background, zero glow, no drop-shadow, no border
 */
export default function IronHouseLogo({
  size = 'md',
  variant = 'transparent',
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
  const logoSrc = '/ironx-logo.png?v=4'

  return (
    <span
      className={`ironx-logo iron-house-logo ${className}`}
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
      aria-label="IRONX"
    >
      <img
        src={logoSrc}
        alt="IRONX"
        style={{
          height: `${h}px`,
          width: 'auto',
          maxWidth: '100%',
          display: 'block',
          objectFit: 'contain',
          background: 'transparent',
          filter: 'none',
          boxShadow: 'none',
          border: 'none'
        }}
        loading="eager"
        decoding="async"
      />
    </span>
  )
}

export { IronHouseLogo as IronXLogo }
