import React from 'react'

/**
 * Official IRONX Logo Component
 * - Single official brand logo: Red dumbbell with yellow hand grip and yellow IRONX wordmark
 * - Transparent background, zero shadows, zero glow, zero borders
 * - Exact supplied artwork preserved with 100% proportional rendering
 */
export default function IronXLogo({
  size = 'md',
  variant = 'full', // 'full' (horizontal wordmark logo) | 'square' (square icon)
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
  const isSquare = variant === 'square'
  const logoSrc = isSquare ? '/ironx-logo-square.png?v=4' : '/ironx-logo.png?v=4'
  const aspectRatio = isSquare ? '1 / 1' : '1296 / 497'

  return (
    <span
      className={`ironx-logo iron-house-logo ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        padding: 0,
        margin: 0,
        ...style
      }}
      aria-label="IRONX"
    >
      <img
        src={logoSrc}
        alt="IRONX"
        style={{
          height: h,
          width: 'auto',
          aspectRatio,
          objectFit: 'contain',
          display: 'block',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          filter: 'none'
        }}
        loading="eager"
        decoding="async"
      />
    </span>
  )
}

export const IronHouseLogo = IronXLogo
