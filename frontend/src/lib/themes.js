// IRONX Dynamic Accent Theme System
// Centralized theme presets, color ramps, ambient glow palettes, and DOM binder

export const THEME_PRESETS = {
  'liquid-glass': {
    id: 'liquid-glass',
    name: 'Liquid Glass Dark',
    label: 'Liquid Glass Dark',
    description: 'Deep black background with frosted liquid-glass panels and monochrome elegance',
    primary: '#F5F5F5',
    secondary: '#A5A5A5',
    highlight: '#FFFFFF',
    dark: '#737373',
    rgb: '245, 245, 245',
    bg: '#050505',
    glow1: 'rgba(255, 255, 255, 0.04)',
    glow2: 'rgba(255, 255, 255, 0.02)',
    glow3: 'rgba(20, 22, 28, 0.03)',
    glow4: 'rgba(255, 255, 255, 0.03)',
    heroGradient: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.04) 100%)',
    surfaceTint: 'rgba(255, 255, 255, 0.07)'
  },
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

  // Primary design token palette from reference screenshots:
  // Dark: #09090B background, #1C1C20 cards, #242429 elevated, #F5F5F5 text, #A1A1AA secondary, #303036 borders, #18181B inputs
  // Light: #F4F4F5 background, #FFFFFF cards, #09090B text, #52525B secondary, #E4E4E7 borders, #FFFFFF inputs

  de.dataset.theme = isLight ? 'light' : 'dark'
  de.setAttribute('data-theme', isLight ? 'light' : 'dark')
  de.dataset.bgTheme = preset.id
  de.setAttribute('data-bg-theme', preset.id)
  de.style.colorScheme = isLight ? 'light' : 'dark'

  if (isLight) {
    // ---------------- Light Mode Surfaces & Hierarchy ----------------
    de.style.setProperty('--bg', '#F5F5F5')
    de.style.setProperty('--bg-secondary', '#FFFFFF')
    de.style.setProperty('--bg-el', '#FFFFFF')
    de.style.setProperty('--surface', '#FFFFFF')
    de.style.setProperty('--surface-2', '#EEEEF0')
    de.style.setProperty('--surface-3', '#E5E5E8')
    de.style.setProperty('--surface-base', '#F5F5F5')
    de.style.setProperty('--surface-raised', '#FFFFFF')
    de.style.setProperty('--surface-container', '#F5F5F5')
    de.style.setProperty('--surface-container-high', '#EEEEF0')
    de.style.setProperty('--surface-overlay', '#FFFFFF')
    de.style.setProperty('--card-bg', '#FFFFFF')
    de.style.setProperty('--elevated-card', '#FFFFFF')

    // Text Hierarchy (Crisp high-contrast dark typography: #111111, #444444, #666666)
    de.style.setProperty('--label', '#111111')
    de.style.setProperty('--label-2', '#444444')
    de.style.setProperty('--label-3', '#666666')
    de.style.setProperty('--label-4', '#888888')
    de.style.setProperty('--muted-text', '#666666')
    de.style.setProperty('--placeholder-text', '#777777')
    de.style.setProperty('--disabled-text', '#888888')

    // Borders & Separators (#D6D6D9)
    de.style.setProperty('--borders', '#D6D6D9')
    de.style.setProperty('--sep', '#D6D6D9')
    de.style.setProperty('--sep-op', 'rgba(0, 0, 0, 0.08)')
    de.style.setProperty('--card-border', '1px solid #D6D6D9')
    de.style.setProperty('--card-shadow', '0 2px 8px rgba(0, 0, 0, 0.04)')

    // Global Input Styling Tokens (#F0F0F2, #111111, #D6D6D9, #777777)
    de.style.setProperty('--input-bg', '#F0F0F2')
    de.style.setProperty('--input-bg-alt', '#FFFFFF')
    de.style.setProperty('--input-text', '#111111')
    de.style.setProperty('--input-border', '#D6D6D9')
    de.style.setProperty('--focus-border', '#111111')

    // Accent & Interactive Elements (#E5E5E8, #111111)
    de.style.setProperty('--theme-accent', '#111111')
    de.style.setProperty('--theme-accent-secondary', '#444444')
    de.style.setProperty('--theme-accent-highlight', '#111111')
    de.style.setProperty('--theme-accent-rgb', '17, 17, 17')
    de.style.setProperty('--acc', '#111111')
    de.style.setProperty('--acc-2', '#E5E5E8')
    de.style.setProperty('--mint', '#111111')
    de.style.setProperty('--gold-primary', '#111111')
    de.style.setProperty('--on-acc', '#FFFFFF')
    de.style.setProperty('--active-ctrl-bg', '#E5E5E8')
    de.style.setProperty('--active-ctrl-text', '#111111')
    de.style.setProperty('--theme-accent-light', '#EEEEF0')
    de.style.setProperty('--theme-accent-border', '#D6D6D9')
    de.style.setProperty('--theme-accent-border-hover', '#BDBDC2')
    de.style.setProperty('--theme-accent-glow', 'rgba(0, 0, 0, 0.08)')
    de.style.setProperty('--theme-accent-gradient', 'linear-gradient(135deg, #111111 0%, #333333 100%)')

    // Muscle Balance Anatomical Map Tokens (Peach skin-tone on white surface)
    de.style.setProperty('--bm-base', '#98624F')
    de.style.setProperty('--bm-stroke', '#775344')
    de.style.setProperty('--bm-inert', '#D9A58D')
    de.style.setProperty('--bm-l1', '#BD806A')
    de.style.setProperty('--bm-l2', '#DFA88E')
    de.style.setProperty('--bm-l3', '#DFA88E')
  } else {
    // ---------------- Dark Mode Surfaces & Hierarchy (Athletic Minimal Dark) ----------------
    de.style.setProperty('--bg', '#09090B')
    de.style.setProperty('--bg-secondary', '#111114')
    de.style.setProperty('--bg-el', '#111114')
    de.style.setProperty('--surface', '#1C1C20')
    de.style.setProperty('--surface-2', '#242429')
    de.style.setProperty('--surface-3', '#2E2E36')
    de.style.setProperty('--card-bg', '#1C1C20')
    de.style.setProperty('--elevated-card', '#242429')

    // Text Hierarchy (Crisp white & clean grey typography)
    de.style.setProperty('--label', '#F5F5F5')
    de.style.setProperty('--label-2', '#A1A1AA')
    de.style.setProperty('--label-3', '#71717A')
    de.style.setProperty('--label-4', '#52525B')
    de.style.setProperty('--muted-text', '#71717A')

    // Borders & Separators
    de.style.setProperty('--borders', '#303036')
    de.style.setProperty('--sep', '#303036')
    de.style.setProperty('--sep-op', 'rgba(255, 255, 255, 0.05)')
    de.style.setProperty('--card-border', '1px solid #303036')
    de.style.setProperty('--card-shadow', '0 4px 20px rgba(0, 0, 0, 0.45)')

    // Global Input Styling Tokens
    de.style.setProperty('--input-bg', '#18181B')
    de.style.setProperty('--input-text', '#FFFFFF')
    de.style.setProperty('--input-border', '#303036')
    de.style.setProperty('--focus-border', '#A1A1AA')

    // Accent & Interactive Elements
    de.style.setProperty('--theme-accent', preset.primary || '#F5F5F5')
    de.style.setProperty('--theme-accent-secondary', '#D4D4D8')
    de.style.setProperty('--theme-accent-highlight', '#FFFFFF')
    de.style.setProperty('--theme-accent-rgb', preset.rgb || '245, 245, 245')
    de.style.setProperty('--acc', '#F5F5F5')
    de.style.setProperty('--mint', '#F5F5F5')
    de.style.setProperty('--gold-primary', '#F5F5F5')
    de.style.setProperty('--on-acc', '#09090B')
    de.style.setProperty('--theme-accent-light', '#242429')
    de.style.setProperty('--theme-accent-border', '#303036')
    de.style.setProperty('--theme-accent-border-hover', '#414149')
    de.style.setProperty('--theme-accent-glow', 'rgba(0, 0, 0, 0.5)')
    de.style.setProperty('--theme-accent-gradient', 'linear-gradient(135deg, #FFFFFF 0%, #D4D4D8 100%)')

    // Muscle Balance Anatomical Map Tokens (high-contrast visible charcoal & stroke)
    de.style.setProperty('--bm-base', '#22222A')
    de.style.setProperty('--bm-stroke', '#3E3E4C')
    de.style.setProperty('--bm-inert', '#2E2E38')
  }

  // Disable decorative ambient glows, animations and blur
  de.style.setProperty('--glow-intensity', '0')
  de.style.setProperty('--upper-glow-intensity', '0')
  de.style.setProperty('--blur-intensity', '0px')
  de.style.setProperty('--bg-anim-state', 'paused')
}
