// Liquid Glass & Dynamic Multi-Colour Fusion Theme System
// Shared theme definitions, preset palettes, and DOM CSS property binder

export const THEME_PRESETS = {
  'aurora-fusion': {
    id: 'aurora-fusion',
    name: 'Aurora Fusion',
    description: 'Crimson, violet and neon cyan ambient drift',
    glow1: '#e11d48',
    glow2: '#7c3aed',
    glow3: '#0284c7',
    glow4: '#00f2fe',
    accent: 'mint',
    accentColor: '#00f5d4',
    heroGradient: 'linear-gradient(135deg, #e11d48 0%, #7c3aed 52%, #00f2fe 100%)',
    surfaceTint: 'rgba(18, 21, 35, 0.72)'
  },
  'crimson-violet': {
    id: 'crimson-violet',
    name: 'Crimson Violet',
    description: 'Vivid crimson red, magenta and deep royal violet',
    glow1: '#ff2a5f',
    glow2: '#9333ea',
    glow3: '#e11d48',
    glow4: '#ec4899',
    accent: 'red',
    accentColor: '#ff2a5f',
    heroGradient: 'linear-gradient(135deg, #ff2a5f 0%, #9333ea 52%, #ec4899 100%)',
    surfaceTint: 'rgba(28, 16, 26, 0.72)'
  },
  'ocean-glow': {
    id: 'ocean-glow',
    name: 'Ocean Glow',
    description: 'Electric sapphire blue and radiant neon cyan',
    glow1: '#0284c7',
    glow2: '#00f2fe',
    glow3: '#3b82f6',
    glow4: '#06b6d4',
    accent: 'teal',
    accentColor: '#38bdf8',
    heroGradient: 'linear-gradient(135deg, #0284c7 0%, #3b82f6 52%, #00f2fe 100%)',
    surfaceTint: 'rgba(12, 22, 35, 0.72)'
  },
  'emerald-glass': {
    id: 'emerald-glass',
    name: 'Emerald Glass',
    description: 'Deep emerald, vibrant mint and rich jade reflections',
    glow1: '#059669',
    glow2: '#00f5d4',
    glow3: '#10b981',
    glow4: '#0d9488',
    accent: 'lime',
    accentColor: '#10b981',
    heroGradient: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #00f5d4 100%)',
    surfaceTint: 'rgba(14, 28, 24, 0.72)'
  },
  'sunset-fusion': {
    id: 'sunset-fusion',
    name: 'Sunset Fusion',
    description: 'Fiery coral, warm amber and fuchsia twilight',
    glow1: '#ff5722',
    glow2: '#ff2a5f',
    glow3: '#f59e0b',
    glow4: '#d946ef',
    accent: 'orange',
    accentColor: '#f97316',
    heroGradient: 'linear-gradient(135deg, #ff5722 0%, #ff2a5f 50%, #f59e0b 100%)',
    surfaceTint: 'rgba(28, 18, 22, 0.72)'
  },
  'midnight-blue': {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    description: 'Deep cosmic indigo, cobalt and electric sky',
    glow1: '#4f46e5',
    glow2: '#2563eb',
    glow3: '#7c3aed',
    glow4: '#38bdf8',
    accent: 'sky',
    accentColor: '#38bdf8',
    heroGradient: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 50%, #38bdf8 100%)',
    surfaceTint: 'rgba(15, 18, 32, 0.72)'
  }
}

export function getThemePreset(id) {
  return THEME_PRESETS[id] || THEME_PRESETS['aurora-fusion']
}

export function applyThemeToDocument(S = {}) {
  if (typeof document === 'undefined') return
  const de = document.documentElement

  const themeId = S.bgTheme || 'aurora-fusion'
  const preset = getThemePreset(themeId)

  const g1 = S.bgTheme === 'custom' && S.customGlow1 ? S.customGlow1 : preset.glow1
  const g2 = S.bgTheme === 'custom' && S.customGlow2 ? S.customGlow2 : preset.glow2
  const g3 = S.bgTheme === 'custom' && S.customGlow3 ? S.customGlow3 : preset.glow3
  const g4 = S.bgTheme === 'custom' && S.customGlow4 ? S.customGlow4 : preset.glow4

  const glowInt = S.glowIntensity !== undefined ? S.glowIntensity : 1.0
  const blurInt = S.blurIntensity !== undefined ? S.blurIntensity : 1.0
  const animOn = S.bgAnimation !== false

  // Set CSS variables on root
  de.style.setProperty('--glow-color-1', g1)
  de.style.setProperty('--glow-color-2', g2)
  de.style.setProperty('--glow-color-3', g3)
  de.style.setProperty('--glow-color-4', g4)
  de.style.setProperty('--glow-intensity', String(glowInt))
  de.style.setProperty('--blur-intensity', String(blurInt))
  de.style.setProperty('--bg-anim-state', animOn ? 'running' : 'paused')
  de.style.setProperty('--theme-accent-gradient', preset.heroGradient)
  de.style.setProperty('--theme-surface-tint', preset.surfaceTint)

  de.dataset.bgTheme = themeId
}
