// OpenGym Black & Warm Gold Theme System
// Shared theme definitions, preset palettes, and DOM CSS property binder

export const THEME_PRESETS = {
  'imperial-gold': {
    id: 'imperial-gold',
    name: 'Imperial Gold',
    description: 'Warm champagne gold and soft bronze on deep black (Reference)',
    primary: '#E8B477',
    secondary: '#C58A53',
    highlight: '#FFD09A',
    dark: '#946338',
    bg: '#090909',
    glow1: '#E8B477',
    glow2: '#C58A53',
    glow3: '#8F5C2C',
    glow4: '#FFD09A',
    accent: 'gold',
    accentColor: '#E8B477',
    heroGradient: 'linear-gradient(135deg, #FFD09A 0%, #E8B477 50%, #C58A53 100%)',
    surfaceTint: 'rgba(20, 18, 16, 0.85)'
  },
  'champagne-elegance': {
    id: 'champagne-elegance',
    name: 'Champagne Elegance',
    description: 'Luminous light champagne and antique bronze',
    primary: '#F3C78B',
    secondary: '#B37D42',
    highlight: '#FFE0B2',
    dark: '#855726',
    bg: '#080808',
    glow1: '#F3C78B',
    glow2: '#B37D42',
    glow3: '#9E672F',
    glow4: '#FFE0B2',
    accent: 'champagne',
    accentColor: '#F3C78B',
    heroGradient: 'linear-gradient(135deg, #FFE0B2 0%, #F3C78B 50%, #B37D42 100%)',
    surfaceTint: 'rgba(18, 16, 14, 0.85)'
  },
  'bronze-armor': {
    id: 'bronze-armor',
    name: 'Bronze Armor',
    description: 'Deep rugged bronze, burnished gold and dark smoky charcoal',
    primary: '#D49B55',
    secondary: '#A86D33',
    highlight: '#F7C582',
    dark: '#7D4D20',
    bg: '#0A0908',
    glow1: '#D49B55',
    glow2: '#A86D33',
    glow3: '#7D4D20',
    glow4: '#F7C582',
    accent: 'bronze',
    accentColor: '#D49B55',
    heroGradient: 'linear-gradient(135deg, #F7C582 0%, #D49B55 50%, #A86D33 100%)',
    surfaceTint: 'rgba(22, 18, 14, 0.85)'
  },
  'royal-amber': {
    id: 'royal-amber',
    name: 'Royal Amber',
    description: 'Warm glowing amber and rich honey bronze',
    primary: '#E5A962',
    secondary: '#B87B3B',
    highlight: '#FFDCA8',
    dark: '#8F5A24',
    bg: '#0C0B0A',
    glow1: '#E5A962',
    glow2: '#B87B3B',
    glow3: '#8F5A24',
    glow4: '#FFDCA8',
    accent: 'amber',
    accentColor: '#E5A962',
    heroGradient: 'linear-gradient(135deg, #FFDCA8 0%, #E5A962 50%, #B87B3B 100%)',
    surfaceTint: 'rgba(24, 18, 15, 0.85)'
  },
  'midnight-gold': {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    description: 'Pure pitch black background with radiant gold highlights',
    primary: '#ECC085',
    secondary: '#9A6836',
    highlight: '#FFF2D6',
    dark: '#704921',
    bg: '#050505',
    glow1: '#ECC085',
    glow2: '#9A6836',
    glow3: '#5E3B17',
    glow4: '#FFF2D6',
    accent: 'midnight',
    accentColor: '#ECC085',
    heroGradient: 'linear-gradient(135deg, #FFF2D6 0%, #ECC085 50%, #9A6836 100%)',
    surfaceTint: 'rgba(14, 13, 12, 0.90)'
  }
}

export function getThemePreset(id) {
  return THEME_PRESETS[id] || THEME_PRESETS['imperial-gold']
}

export function applyThemeToDocument(S = {}) {
  if (typeof document === 'undefined') return
  const de = document.documentElement

  const themeId = S.bgTheme && THEME_PRESETS[S.bgTheme] ? S.bgTheme : 'imperial-gold'
  const preset = getThemePreset(themeId)

  const primaryGold = S.goldShade || preset.primary
  const bronzeShade = S.bronzeShade || preset.secondary
  const highlightGold = preset.highlight
  const bgDarkness = S.bgDarkness || preset.bg || '#090909'
  const glowInt = S.ambientGlow === false ? 0 : (S.glowIntensity !== undefined ? Number(S.glowIntensity) : 1.0)
  const blurInt = S.blurIntensity !== undefined ? Number(S.blurIntensity) : 1.0
  const animOn = S.bgAnimation !== false
  const glassOpacity = S.glassOpacity !== undefined ? Number(S.glassOpacity) : 0.80

  // 1. Root Color & Background Variables
  de.style.setProperty('--bg', bgDarkness)
  de.style.setProperty('--bg-el', '#151210')
  de.style.setProperty('--gold-primary', primaryGold)
  de.style.setProperty('--gold-secondary', bronzeShade)
  de.style.setProperty('--gold-highlight', highlightGold)
  de.style.setProperty('--gold-glow', `rgba(232, 180, 119, ${0.25 * glowInt})`)

  // Override --mint so all existing OpenGym components inherit warm champagne gold
  de.style.setProperty('--mint', primaryGold)
  de.style.setProperty('--mint-light', 'rgba(232, 180, 119, 0.12)')

  // Text Hierarchy
  de.style.setProperty('--label', '#F5F1EB')
  de.style.setProperty('--label-2', '#A9A19A')
  de.style.setProperty('--label-3', '#716B64')

  // Surfaces & Glassmorphism
  de.style.setProperty('--surface', `rgba(20, 20, 22, ${glassOpacity})`)
  de.style.setProperty('--surface-2', `rgba(26, 26, 30, ${glassOpacity})`)
  de.style.setProperty('--surface-3', `rgba(34, 34, 40, ${glassOpacity})`)
  de.style.setProperty('--border-gold', 'rgba(232, 180, 119, 0.16)')
  de.style.setProperty('--border-gold-hover', 'rgba(232, 180, 119, 0.38)')

  // Warm Gold Ambient Lighting
  de.style.setProperty('--glow-color-1', primaryGold)
  de.style.setProperty('--glow-color-2', bronzeShade)
  de.style.setProperty('--glow-color-3', preset.glow3 || '#8F5C2C')
  de.style.setProperty('--glow-color-4', highlightGold)
  de.style.setProperty('--glow-intensity', String(glowInt))
  de.style.setProperty('--blur-intensity', `${Math.round(26 * blurInt)}px`)
  de.style.setProperty('--bg-anim-state', animOn ? 'running' : 'paused')
  de.style.setProperty('--theme-accent-gradient', `linear-gradient(135deg, ${highlightGold} 0%, ${primaryGold} 50%, ${bronzeShade} 100%)`)
  de.style.setProperty('--theme-surface-tint', preset.surfaceTint)

  de.dataset.bgTheme = themeId
}
