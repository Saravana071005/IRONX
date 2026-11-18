// OpenGym Dynamic Accent Theme System
// Centralized theme presets, color ramps, ambient glow palettes, and DOM binder

export const THEME_PRESETS = {
  'warm-gold': {
    id: 'warm-gold',
    name: 'Warm Gold',
    label: 'Warm Gold',
    description: 'Champagne gold and soft bronze on deep black (Default)',
    primary: '#E8B477',
    secondary: '#C58A53',
    highlight: '#FFD09A',
    dark: '#946338',
    rgb: '232, 180, 119',
    bg: '#090909',
    glow1: '#E8B477',
    glow2: '#C58A53',
    glow3: '#8F5C2C',
    glow4: '#FFD09A',
    heroGradient: 'linear-gradient(135deg, #FFD09A 0%, #E8B477 50%, #C58A53 100%)',
    surfaceTint: 'rgba(20, 18, 16, 0.85)'
  },
  'silver': {
    id: 'silver',
    name: 'Silver',
    label: 'Silver',
    description: 'Clean metallic silver, chrome & white on deep black',
    primary: '#E2E8F0',
    secondary: '#94A3B8',
    highlight: '#FFFFFF',
    dark: '#64748B',
    rgb: '226, 232, 240',
    bg: '#090909',
    glow1: '#E2E8F0',
    glow2: '#94A3B8',
    glow3: '#475569',
    glow4: '#FFFFFF',
    heroGradient: 'linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 50%, #94A3B8 100%)',
    surfaceTint: 'rgba(20, 22, 24, 0.85)'
  },
  'electric-blue': {
    id: 'electric-blue',
    name: 'Electric Blue',
    label: 'Electric Blue',
    description: 'Vibrant electric azure & luminous sapphire on deep black',
    primary: '#38BDF8',
    secondary: '#0284C7',
    highlight: '#7DD3FC',
    dark: '#0369A1',
    rgb: '56, 189, 248',
    bg: '#080A0E',
    glow1: '#38BDF8',
    glow2: '#0284C7',
    glow3: '#0369A1',
    glow4: '#7DD3FC',
    heroGradient: 'linear-gradient(135deg, #7DD3FC 0%, #38BDF8 50%, #0284C7 100%)',
    surfaceTint: 'rgba(16, 22, 28, 0.85)'
  },
  'emerald-green': {
    id: 'emerald-green',
    name: 'Emerald Green',
    label: 'Emerald Green',
    description: 'Rich botanical jade & mint on deep smoky black',
    primary: '#10B981',
    secondary: '#059669',
    highlight: '#34D399',
    dark: '#047857',
    rgb: '16, 185, 129',
    bg: '#080C0A',
    glow1: '#10B981',
    glow2: '#059669',
    glow3: '#047857',
    glow4: '#34D399',
    heroGradient: 'linear-gradient(135deg, #34D399 0%, #10B981 50%, #059669 100%)',
    surfaceTint: 'rgba(16, 26, 20, 0.85)'
  },
  'orange': {
    id: 'orange',
    name: 'Orange',
    label: 'Orange',
    description: 'Warm energetic sunburst & tangerine on deep black',
    primary: '#F97316',
    secondary: '#EA580C',
    highlight: '#FB923C',
    dark: '#C2410C',
    rgb: '249, 115, 22',
    bg: '#0C0A08',
    glow1: '#F97316',
    glow2: '#EA580C',
    glow3: '#C2410C',
    glow4: '#FB923C',
    heroGradient: 'linear-gradient(135deg, #FB923C 0%, #F97316 50%, #EA580C 100%)',
    surfaceTint: 'rgba(26, 18, 14, 0.85)'
  },
  'crimson-red': {
    id: 'crimson-red',
    name: 'Crimson Red',
    label: 'Crimson Red',
    description: 'Deep ruby crimson & scarlet on deep black',
    primary: '#EF4444',
    secondary: '#DC2626',
    highlight: '#F87171',
    dark: '#B91C1C',
    rgb: '239, 68, 68',
    bg: '#0D0808',
    glow1: '#EF4444',
    glow2: '#DC2626',
    glow3: '#B91C1C',
    glow4: '#F87171',
    heroGradient: 'linear-gradient(135deg, #F87171 0%, #EF4444 50%, #DC2626 100%)',
    surfaceTint: 'rgba(28, 16, 16, 0.85)'
  },
  'dark-teal': {
    id: 'dark-teal',
    name: 'Dark Teal',
    label: 'Dark Teal',
    description: 'Sophisticated deep oceanic teal & cyan on black',
    primary: '#14B8A6',
    secondary: '#0F766E',
    highlight: '#2DD4BF',
    dark: '#115E59',
    rgb: '20, 184, 166',
    bg: '#080C0C',
    glow1: '#14B8A6',
    glow2: '#0F766E',
    glow3: '#115E59',
    glow4: '#2DD4BF',
    heroGradient: 'linear-gradient(135deg, #2DD4BF 0%, #14B8A6 50%, #0F766E 100%)',
    surfaceTint: 'rgba(16, 24, 24, 0.85)'
  }
}

// Aliases for backwards compatibility with any existing saved state
export const THEME_ALIASES = {
  'imperial-gold': 'warm-gold',
  'champagne-elegance': 'warm-gold',
  'bronze-armor': 'warm-gold',
  'royal-amber': 'warm-gold',
  'midnight-gold': 'warm-gold',
  'gold': 'warm-gold',
  'blue': 'electric-blue',
  'green': 'emerald-green',
  'red': 'crimson-red',
  'teal': 'dark-teal'
}

export function getThemePreset(id) {
  const resolved = THEME_ALIASES[id] || id
  return THEME_PRESETS[resolved] || THEME_PRESETS['warm-gold']
}

export function applyThemeToDocument(S = {}) {
  if (typeof document === 'undefined') return
  const de = document.documentElement

  const themeId = S.bgTheme || 'warm-gold'
  const preset = getThemePreset(themeId)

  const primaryAccent = S.goldShade && themeId === 'warm-gold' ? S.goldShade : preset.primary
  const secondaryAccent = S.bronzeShade && themeId === 'warm-gold' ? S.bronzeShade : preset.secondary
  const highlightAccent = preset.highlight
  const bgDarkness = S.bgDarkness || preset.bg || '#090909'
  const glowInt = S.ambientGlow === false ? 0 : (S.glowIntensity !== undefined ? Number(S.glowIntensity) : 1.0)
  const blurInt = S.blurIntensity !== undefined ? Number(S.blurIntensity) : 1.0
  const animOn = S.bgAnimation !== false
  const glassOpacity = S.glassOpacity !== undefined ? Number(S.glassOpacity) : 0.80

  // 1. Root Color & Background Variables
  de.style.setProperty('--bg', bgDarkness)
  de.style.setProperty('--bg-el', '#151210')

  // Dynamic Accent Theme Custom Properties
  de.style.setProperty('--theme-accent', primaryAccent)
  de.style.setProperty('--theme-accent-secondary', secondaryAccent)
  de.style.setProperty('--theme-accent-highlight', highlightAccent)
  de.style.setProperty('--theme-accent-rgb', preset.rgb)
  de.style.setProperty('--theme-accent-light', `rgba(${preset.rgb}, 0.14)`)
  de.style.setProperty('--theme-accent-border', `rgba(${preset.rgb}, 0.28)`)
  de.style.setProperty('--theme-accent-border-hover', `rgba(${preset.rgb}, 0.5)`)
  de.style.setProperty('--theme-accent-glow', `rgba(${preset.rgb}, ${0.35 * glowInt})`)
  de.style.setProperty('--theme-accent-gradient', preset.heroGradient)
  de.style.setProperty('--theme-surface-tint', preset.surfaceTint)

  // Legacy mappings so existing components throughout OpenGym dynamically adapt:
  de.style.setProperty('--gold-primary', primaryAccent)
  de.style.setProperty('--gold-secondary', secondaryAccent)
  de.style.setProperty('--gold-highlight', highlightAccent)
  de.style.setProperty('--gold-glow', `rgba(${preset.rgb}, ${0.30 * glowInt})`)
  de.style.setProperty('--mint', primaryAccent)
  de.style.setProperty('--mint-light', `rgba(${preset.rgb}, 0.14)`)
  de.style.setProperty('--acc', primaryAccent)
  de.style.setProperty('--acc-light', `rgba(${preset.rgb}, 0.14)`)
  de.style.setProperty('--border-gold', `rgba(${preset.rgb}, 0.18)`)
  de.style.setProperty('--border-gold-hover', `rgba(${preset.rgb}, 0.45)`)

  // Text Hierarchy
  de.style.setProperty('--label', '#F5F1EB')
  de.style.setProperty('--label-2', '#A9A19A')
  de.style.setProperty('--label-3', '#716B64')

  // Surfaces & Glassmorphism
  de.style.setProperty('--surface', `rgba(20, 20, 22, ${glassOpacity})`)
  de.style.setProperty('--surface-2', `rgba(26, 26, 30, ${glassOpacity})`)
  de.style.setProperty('--surface-3', `rgba(34, 34, 40, ${glassOpacity})`)

  // Dynamic Ambient Lighting Glow
  de.style.setProperty('--glow-color-1', preset.glow1)
  de.style.setProperty('--glow-color-2', preset.glow2)
  de.style.setProperty('--glow-color-3', preset.glow3)
  de.style.setProperty('--glow-color-4', preset.glow4)
  de.style.setProperty('--glow-intensity', String(glowInt))
  de.style.setProperty('--blur-intensity', `${Math.round(26 * blurInt)}px`)
  de.style.setProperty('--bg-anim-state', animOn ? 'running' : 'paused')

  de.dataset.bgTheme = preset.id
}
