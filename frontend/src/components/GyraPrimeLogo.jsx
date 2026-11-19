import React from 'react'

/**
 * DumbbellPlateStack: Renders one symmetrical half of the Olympic barbell plate stack.
 * Modeled directly from the official GYRA PRIME reference logo:
 * - Outer sleeve bar
 * - Outer thin plate (rx 2.5)
 * - Spacer shaft
 * - Middle plate (rx 3)
 * - Spacer shaft
 * - Inner tall plate (rx 3.5)
 * - Inner collar stub
 */
export function DumbbellPlateHalf({ className = '', style = {} }) {
  return (
    <svg
      viewBox="0 0 65 76"
      className={className}
      style={{
        display: 'block',
        flexShrink: 0,
        height: '1em',
        width: 'auto',
        fill: 'currentColor',
        overflow: 'visible',
        transition: 'fill 0.25s ease',
        ...style
      }}
      aria-hidden="true"
    >
      {/* Outer sleeve extension */}
      <rect x="0" y="34" width="17" height="8" rx="2" />
      {/* Outer thin plate */}
      <rect x="17" y="19" width="8" height="38" rx="2.5" />
      {/* Shaft connector */}
      <rect x="25" y="34" width="5" height="8" />
      {/* Middle plate */}
      <rect x="30" y="9" width="10" height="58" rx="3" />
      {/* Shaft connector */}
      <rect x="40" y="34" width="5" height="8" />
      {/* Inner tall plate */}
      <rect x="45" y="1" width="12" height="74" rx="3.5" />
      {/* Inner collar stub connecting towards text */}
      <rect x="57" y="34" width="8" height="8" rx="2" />
    </svg>
  )
}

/**
 * DumbbellEmblem: Standalone symmetrical barbell icon for compact/collapsed views.
 */
export function DumbbellEmblem({ size = 24, glow = true, className = '', style = {} }) {
  return (
    <svg
      viewBox="0 0 130 76"
      width={size}
      height={(size * 76) / 130}
      className={`gyra-dumbbell-emblem ${glow ? 'gyra-glow' : ''} ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        fill: 'currentColor',
        color: 'var(--theme-accent, #E8B477)',
        overflow: 'visible',
        transition: 'color 0.25s ease, filter 0.25s ease, fill 0.25s ease',
        ...style
      }}
      aria-label="GYRA PRIME"
    >
      {/* Left Plate Stack */}
      <rect x="0" y="34" width="14" height="8" rx="2" />
      <rect x="14" y="19" width="8" height="38" rx="2.5" />
      <rect x="22" y="34" width="5" height="8" />
      <rect x="27" y="9" width="10" height="58" rx="3" />
      <rect x="37" y="34" width="5" height="8" />
      <rect x="42" y="1" width="11" height="74" rx="3.5" />

      {/* Center Handle Bar */}
      <rect x="53" y="34" width="24" height="8" rx="1.5" />

      {/* Right Plate Stack (Mirrored) */}
      <rect x="77" y="1" width="11" height="74" rx="3.5" />
      <rect x="88" y="34" width="5" height="8" />
      <rect x="93" y="9" width="10" height="58" rx="3" />
      <rect x="103" y="34" width="5" height="8" />
      <rect x="108" y="19" width="8" height="38" rx="2.5" />
      <rect x="116" y="34" width="14" height="8" rx="2" />
    </svg>
  )
}

/**
 * Official GYRA PRIME Logo Component
 * - Exact symmetrical barbell artwork (left & right)
 * - Bodoni Moda uppercase wordmark: "GYRA PRIME"
 * - Reactive to user's active theme accent & glow CSS variables
 * - Fully accessible, scalable, zero layout shift
 */
export default function GyraPrimeLogo({
  size = 'md',
  glow = true,
  iconOnly = false,
  className = '',
  style = {}
}) {
  if (iconOnly) {
    const emblemSizes = { xs: 16, sm: 20, md: 26, lg: 34, xl: 46 }
    const pxSize = typeof size === 'number' ? size : emblemSizes[size] || 26
    return <DumbbellEmblem size={pxSize} glow={glow} className={className} style={style} />
  }

  const sizeStyles = {
    xs: { fontSize: '13px', gap: '0.45em' },
    sm: { fontSize: '16px', gap: '0.50em' },
    md: { fontSize: '21px', gap: '0.55em' },
    lg: { fontSize: '32px', gap: '0.60em' },
    xl: { fontSize: '44px', gap: '0.65em' }
  }

  const currentSize = typeof size === 'number'
    ? { fontSize: `${size}px`, gap: '0.55em' }
    : sizeStyles[size] || sizeStyles.md

  return (
    <span
      className={`gyra-prime-logo ${glow ? 'gyra-glow' : ''} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--theme-accent, #E8B477)',
        fill: 'currentColor',
        userSelect: 'none',
        lineHeight: 1,
        verticalAlign: 'middle',
        transition: 'color 0.25s ease, filter 0.25s ease',
        ...currentSize,
        ...style
      }}
      role="img"
      aria-label="GYRA PRIME"
    >
      {/* Left Symmetrical Barbell */}
      <DumbbellPlateHalf className="gyra-dumbbell-left" />

      {/* Central Bodoni Moda Wordmark */}
      <span
        className="gyra-prime-wordmark"
        style={{
          fontFamily: "var(--font-brand, 'Bodoni Moda', 'Playfair Display', serif)",
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          lineHeight: 1,
          display: 'inline-block',
          color: 'inherit',
          padding: '0 0.05em'
        }}
      >
        GYRA PRIME
      </span>

      {/* Right Symmetrical Barbell (Mirrored) */}
      <DumbbellPlateHalf
        className="gyra-dumbbell-right"
        style={{ transform: 'scaleX(-1)' }}
      />
    </span>
  )
}
