// IRONX Dynamic Accent Theme System
// Centralized theme presets, color ramps, ambient glow palettes, and DOM binder

export const THEME_PRESETS = {
  'apex-athletic-dark': {
    id: 'apex-athletic-dark',
    name: 'Apex Athletic Dark',
    label: 'Apex Athletic Dark',
    description: 'Electric emerald and deep graphite obsidian (Stitch Default)',
    primary: '#10B981',
    secondary: '#34D399',
    highlight: '#68DBA9',
    dark: '#059669',
    rgb: '16, 185, 129',
    bg: '#0F1115',
    glow1: '#10B981',
    glow2: '#34D399',
    glow3: '#059669',
    glow4: '#68DBA9',
    heroGradient: 'linear-gradient(135deg, #34D399 0%, #10B981 50%, #059669 100%)',
    surfaceTint: 'rgba(22, 25, 32, 0.85)'
  },
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
  },
  'warm-white': {
    id: 'warm-white',
    name: 'Warm White',
    label: 'Warm White',
    description: 'Crisp warm ivory & luminous pearl white on obsidian black',
    primary: '#FDFBF7',
    secondary: '#E2DFD8',
    highlight: '#FFFFFF',
    dark: '#78716C',
    rgb: '253, 251, 247',
    bg: '#0A0A0A',
    glow1: '#FDFBF7',
    glow2: '#E2DFD8',
    glow3: '#78716C',
    glow4: '#FFFFFF',
    heroGradient: 'linear-gradient(135deg, #FFFFFF 0%, #FDFBF7 50%, #E2DFD8 100%)',
    surfaceTint: 'rgba(22, 22, 22, 0.85)'
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
  'teal': 'dark-teal',
  'white': 'warm-white',
  'warm-ivory': 'warm-white'
}

export function getThemePreset(id) {
  const resolved = THEME_ALIASES[id] || id
  return THEME_PRESETS[resolved] || THEME_PRESETS['warm-gold']
}

export function applyThemeToDocument(S = {}) {
  if (typeof document === 'undefined') return
  const de = document.documentElement

  const isLight = S?.theme === 'light'
  const themeId = S?.bgTheme || 'warm-gold'
  const preset = getThemePreset(themeId)

  const primaryAccent = S?.goldShade && themeId === 'warm-gold' ? S.goldShade : preset.primary
  const secondaryAccent = S?.bronzeShade && themeId === 'warm-gold' ? S.bronzeShade : preset.secondary
  const highlightAccent = preset.highlight
  const bgDarkness = S?.bgDarkness || preset.bg || '#090909'
  const glowInt = S?.ambientGlow === false ? 0 : (S?.glowIntensity !== undefined ? Number(S.glowIntensity) : 1.0)
  const upperGlowInt = S?.upperGlowIntensity !== undefined ? Number(S.upperGlowIntensity) : 1.0
  const blurInt = S?.blurIntensity !== undefined ? Number(S.blurIntensity) : 1.0
  const animOn = S?.bgAnimation !== false
  const glassOpacity = S?.glassOpacity !== undefined ? Number(S.glassOpacity) : 0.80

  // Set data attributes on <html>
  de.dataset.theme = isLight ? 'light' : 'dark'
  de.setAttribute('data-theme', isLight ? 'light' : 'dark')
  de.dataset.bgTheme = preset.id
  de.setAttribute('data-bg-theme', preset.id)

  if (isLight) {
    // ---------------- Light Mode Surfaces & Hierarchy ----------------
    de.style.setProperty('--bg', '#F6F8FB')
    de.style.setProperty('--bg-el', '#FFFFFF')
    de.style.setProperty('--surface', 'rgba(255, 255, 255, 0.92)')
    de.style.setProperty('--surface-2', 'rgba(241, 245, 249, 0.95)')
    de.style.setProperty('--surface-3', 'rgba(226, 232, 240, 0.95)')

    // Text Hierarchy (High-contrast slate)
    de.style.setProperty('--label', '#0F172A')
    de.style.setProperty('--label-2', '#475569')
    de.style.setProperty('--label-3', '#64748B')
    de.style.setProperty('--label-4', 'rgba(15, 23, 42, 0.15)')

    // Borders & Glassmorphism
    de.style.setProperty('--sep', 'rgba(15, 23, 42, 0.08)')
    de.style.setProperty('--sep-op', 'rgba(15, 23, 42, 0.04)')
    de.style.setProperty('--border-gold', `rgba(${preset.rgb}, 0.22)`)
    de.style.setProperty('--border-gold-hover', `rgba(${preset.rgb}, 0.55)`)
    de.style.setProperty('--card-border', `1px solid rgba(${preset.rgb}, 0.20)`)
    de.style.setProperty('--card-shadow', '0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)')
    de.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.88)')
    de.style.setProperty('--glass-bg-hover', 'rgba(255, 255, 255, 0.96)')
    de.style.setProperty('--glass-border', `1px solid rgba(${preset.rgb}, 0.20)`)
    de.style.setProperty('--glass-shadow', '0 8px 24px -4px rgba(15, 23, 42, 0.08)')
    de.style.setProperty('--glass-highlight', '0 1px 2px rgba(0, 0, 0, 0.04), inset 0 1px 1px rgba(255, 255, 255, 0.9)')
    de.style.setProperty('--grad-glass-surface', 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)')
    de.style.setProperty('--grad-text-hero', `linear-gradient(135deg, #0F172A 20%, #1E293B 60%, ${primaryAccent} 100%)`)
    de.style.setProperty('--grad-text-glow', `linear-gradient(135deg, #0F172A 0%, ${primaryAccent} 100%)`)
    de.style.setProperty('--on-acc', '#FFFFFF')

    de.style.setProperty('--theme-accent-light', `rgba(${preset.rgb}, 0.12)`)
    de.style.setProperty('--theme-accent-border', `rgba(${preset.rgb}, 0.30)`)
    de.style.setProperty('--theme-accent-border-hover', `rgba(${preset.rgb}, 0.58)`)
    de.style.setProperty('--theme-accent-glow', `rgba(${preset.rgb}, ${0.18 * glowInt})`)
    de.style.setProperty('--gold-glow', `rgba(${preset.rgb}, ${0.18 * glowInt})`)
  } else {
    // ---------------- Dark Mode Surfaces & Hierarchy ----------------
    de.style.setProperty('--bg', preset.id === 'apex-athletic-dark' ? '#0F1115' : bgDarkness)
    de.style.setProperty('--bg-el', preset.id === 'apex-athletic-dark' ? '#161920' : '#151210')
    de.style.setProperty('--surface', preset.id === 'apex-athletic-dark' ? '#161920' : `rgba(20, 20, 22, ${glassOpacity})`)
    de.style.setProperty('--surface-2', preset.id === 'apex-athletic-dark' ? '#1E2024' : `rgba(26, 26, 30, ${glassOpacity})`)
    de.style.setProperty('--surface-3', preset.id === 'apex-athletic-dark' ? '#282A2E' : `rgba(34, 34, 40, ${glassOpacity})`)

    // Text Hierarchy (Warm white to smoky grey)
    de.style.setProperty('--label', preset.id === 'apex-athletic-dark' ? '#F9FAFB' : '#F5F1EB')
    de.style.setProperty('--label-2', preset.id === 'apex-athletic-dark' ? '#E5E7EB' : '#A9A19A')
    de.style.setProperty('--label-3', preset.id === 'apex-athletic-dark' ? '#9CA3AF' : '#716B64')
    de.style.setProperty('--label-4', preset.id === 'apex-athletic-dark' ? '#4B5563' : 'rgba(169, 161, 154, 0.22)')

    // Stitch Design Surfaces & Palette
    de.style.setProperty('--surface-base', '#0F1115')
    de.style.setProperty('--surface-raised', '#161920')
    de.style.setProperty('--surface-container', '#1E2024')
    de.style.setProperty('--surface-container-high', '#282A2E')
    de.style.setProperty('--surface-elevated', '#282A2E')
    de.style.setProperty('--surface-overlay', '#1E232E')
    de.style.setProperty('--primary-emerald', '#10B981')
    de.style.setProperty('--secondary-emerald', '#34D399')
    de.style.setProperty('--tertiary-emerald', '#059669')
    de.style.setProperty('--brand-gold', '#E8B477')
    de.style.setProperty('--text-primary', '#F9FAFB')
    de.style.setProperty('--text-secondary', '#E5E7EB')
    de.style.setProperty('--text-muted', '#9CA3AF')
    de.style.setProperty('--input-bg', '#0B0D10')

    // Borders & Glassmorphism
    de.style.setProperty('--sep', `rgba(${preset.rgb}, 0.12)`)
    de.style.setProperty('--sep-op', 'rgba(255, 255, 255, 0.05)')
    de.style.setProperty('--border-gold', `rgba(${preset.rgb}, 0.18)`)
    de.style.setProperty('--border-gold-hover', `rgba(${preset.rgb}, 0.45)`)
    de.style.setProperty('--card-border', `1px solid rgba(${preset.rgb}, 0.18)`)
    de.style.setProperty('--card-shadow', '0 16px 40px -4px rgba(0, 0, 0, 0.65), 0 4px 14px -2px rgba(0, 0, 0, 0.40)')
    de.style.setProperty('--glass-bg', 'rgba(20, 20, 22, 0.78)')
    de.style.setProperty('--glass-bg-hover', 'rgba(28, 28, 32, 0.88)')
    de.style.setProperty('--glass-border', `1px solid rgba(${preset.rgb}, 0.15)`)
    de.style.setProperty('--glass-shadow', '0 16px 40px -4px rgba(0, 0, 0, 0.65), 0 4px 14px -2px rgba(0, 0, 0, 0.40)')
    de.style.setProperty('--glass-highlight', 'inset 0 1px 1px 0 rgba(255, 208, 154, 0.15)')
    de.style.setProperty('--grad-glass-surface', 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)')
    de.style.setProperty('--grad-text-hero', `linear-gradient(135deg, #FFFFFF 15%, #F5F1EB 55%, ${primaryAccent} 100%)`)
    de.style.setProperty('--grad-text-glow', `linear-gradient(135deg, #FFFFFF 0%, ${highlightAccent} 50%, ${primaryAccent} 100%)`)
    de.style.setProperty('--on-acc', '#12100E')

    de.style.setProperty('--theme-accent-light', `rgba(${preset.rgb}, 0.14)`)
    de.style.setProperty('--theme-accent-border', `rgba(${preset.rgb}, 0.28)`)
    de.style.setProperty('--theme-accent-border-hover', `rgba(${preset.rgb}, 0.50)`)
    de.style.setProperty('--theme-accent-glow', `rgba(${preset.rgb}, ${0.35 * glowInt})`)
    de.style.setProperty('--gold-glow', `rgba(${preset.rgb}, ${0.30 * glowInt})`)
  }

  // Dynamic Accent Theme Custom Properties (Shared across both modes)
  de.style.setProperty('--theme-accent', primaryAccent)
  de.style.setProperty('--theme-accent-secondary', secondaryAccent)
  de.style.setProperty('--theme-accent-highlight', highlightAccent)
  de.style.setProperty('--theme-accent-rgb', preset.rgb)
  de.style.setProperty('--theme-accent-gradient', preset.heroGradient)
  de.style.setProperty('--theme-surface-tint', preset.surfaceTint)

  // System & Legacy mappings so all components dynamically adapt
  de.style.setProperty('--gold-primary', primaryAccent)
  de.style.setProperty('--gold-secondary', secondaryAccent)
  de.style.setProperty('--gold-highlight', highlightAccent)
  de.style.setProperty('--mint', primaryAccent)
  de.style.setProperty('--mint-light', `rgba(${preset.rgb}, 0.14)`)
  de.style.setProperty('--acc', primaryAccent)
  de.style.setProperty('--acc-light', `rgba(${preset.rgb}, 0.14)`)

  // Dynamic Ambient Lighting Glow
  de.style.setProperty('--glow-color-1', preset.glow1)
  de.style.setProperty('--glow-color-2', preset.glow2)
  de.style.setProperty('--glow-color-3', preset.glow3)
  de.style.setProperty('--glow-color-4', preset.glow4)
  de.style.setProperty('--glow-intensity', String(glowInt))
  de.style.setProperty('--upper-glow-intensity', String(upperGlowInt))
  de.style.setProperty('--blur-intensity', `${Math.round(26 * blurInt)}px`)
  de.style.setProperty('--bg-anim-state', animOn ? 'running' : 'paused')
}
