import { create } from 'zustand'
import { api } from '../lib/api.js'
import { localTZ, uid, todayISO } from '../lib/format.js'
import { registerCustom } from '../lib/exercises.js'
import { DEMO, DEMO_SEEDED } from '../lib/demo.js'
import { MOBILE, nativeLoad, nativeSave, syncReminder } from '../lib/mobile.js'
import { THEME_ALIASES, THEME_PRESETS } from '../lib/themes.js'

export const getStorageKey = userId => userId ? `gym_state_user_${userId}` : 'gym_state_guest'
const KEY = 'gym_state_v1'

export const DEF = {
  unit: 'kg', restSec: 90, sound: true, keepAwake: true, lang: 'en',
  theme: 'dark', accent: 'mint', body: 'male', targetW: null,
  bodyweight: [], routines: [], week: {}, dayPlan: {},
  exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',
  // effort: which per-set effort scale is logged — 'none' | 'rir' | 'rpe'. null, not 'none', so
  // that a profile which never chose (loaded state is overlaid on DEF, on every path: local,
  // server pull, backup import) still falls back to the `showRir` boolean this replaced and
  // keeps the column it had. See effortOf.
  reminder: { on: false, time: '08:00', tz: null }, effort: null,
  coach: null,
  favorites: [],
  restAlertEnabled: true,
  restAlertTone: 'alarm',
  restAlertVolume: 1.0,
  restVibrationEnabled: true,
  restNotifications: false,
  nutritionTargets: { calorie: 1900, calories: 1900, protein: 140, carb: 220, carbs: 220, fat: 65, fibre: 30, diet: 'all', waterGoal: 2.5 },
  meals: [],
  workoutTemplates: null,
  cardioLogs: [],
  bgTheme: 'warm-gold',
  goldShade: '#E8B477',
  bronzeShade: '#C58A53',
  bgDarkness: '#090909',
  ambientGlow: true,
  glowIntensity: 1.0,
  blurIntensity: 1.0,
  glassOpacity: 0.80,
  bgAnimation: true
}
const clone = o => JSON.parse(JSON.stringify(o))

function loadState(userId = null) {
  try {
    if (typeof localStorage === 'undefined') return clone(DEF)
    if (!userId) {
      try {
        const u = JSON.parse(localStorage.getItem('gym_user'))
        if (u?.id) userId = u.id
      } catch {}
    }
    const key = getStorageKey(userId)
    let raw = localStorage.getItem(key)

    // Legacy migration check: if user key has no data, check legacy key
    if (!raw && userId) {
      const legacy = localStorage.getItem('gym_state_v1')
      if (legacy) {
        raw = legacy
        try { localStorage.setItem(key, legacy) } catch {}
      }
    } else if (!raw && !userId) {
      const legacy = localStorage.getItem('gym_state_v1')
      if (legacy) raw = legacy
    }

    if (raw) {
      const parsed = JSON.parse(raw)
      // Upgrade any legacy themes or old colors to the Dynamic Accent Theme System
      if (parsed.bgTheme && THEME_ALIASES[parsed.bgTheme]) {
        parsed.bgTheme = THEME_ALIASES[parsed.bgTheme]
      }
      if (!parsed.bgTheme || !THEME_PRESETS[parsed.bgTheme]) {
        parsed.bgTheme = 'warm-gold'
        parsed.goldShade = '#E8B477'
        parsed.bronzeShade = '#C58A53'
        parsed.bgDarkness = '#090909'
      }
      return Object.assign(clone(DEF), parsed)
    }
  } catch (e) { /* ignore */ }
  return clone(DEF)
}

const hasData = st => {
  if (!st || typeof st !== 'object') return false
  const tpls = Array.isArray(st.workoutTemplates) ? st.workoutTemplates : (st.workoutTemplates && typeof st.workoutTemplates === 'object' ? Object.keys(st.workoutTemplates) : [])
  return !!(
    (st.workouts || []).length ||
    (st.routines || []).length ||
    (st.bodyweight || []).length ||
    tpls.length ||
    (st.meals || []).length ||
    (st.cardioLogs || []).length
  )
}

export const useStore = create((set, get) => {
  let pushTm = null
  let saveTm = null

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction) and keep the native reminder schedule in step with the weekly plan.
  const nativePersist = () => {
    clearTimeout(saveTm)
    saveTm = setTimeout(() => { saveTm = null; nativeSave(get().S); syncReminder(get().S) }, 800)
  }

  const persist = (S, push = true) => {
    S._ts = Date.now()
    registerCustom(S.customEx)
    const user = get().user
    const storageKey = getStorageKey(user?.id)
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(S))
      }
    } catch (e) {}
    set({ S })
    if (MOBILE) nativePersist()
    if (push && user) {
      clearTimeout(pushTm)
      pushTm = setTimeout(() => get().pushState(), 1500)
    }
  }

  // A setting changed right before switching away/closing the tab must not get lost mid-debounce
  // (e.g. setting the reminder time then immediately backgrounding to test it). On mobile the
  // same applies to the file mirror — backgrounding is often the last thing before the OS
  // kills the app.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return
      if (MOBILE && saveTm) {
        clearTimeout(saveTm)
        saveTm = null
        nativeSave(get().S)
      }
      if (pushTm) {
        clearTimeout(pushTm)
        pushTm = null
        get().pushState()
      }
    })
  }

  // Everything a sign-out leaves behind on this device, whichever way it was triggered.
  const clearLocalSession = () => {
    const user = get().user
    if (user?.id) {
      try { localStorage.removeItem(getStorageKey(user.id)) } catch {}
    }
    localStorage.removeItem('gym_auth_token')
    localStorage.removeItem('gym_guest')
    localStorage.removeItem('gym_dirty')
    localStorage.removeItem('gym_user')
    localStorage.removeItem('gym_state_v1')
    get().setUser(null)
    set({ user: null, S: clone(DEF) })
  }

  return {
    S: (() => { const s = loadState(); registerCustom(s.customEx); return s })(),
    user: (() => { try { return JSON.parse(localStorage.getItem('gym_user')) || null } catch { return null } })(),
    ready: false,
    // Instance capabilities from GET /api/config. `config.coach` is present only when the
    // owner has both enabled the Coach and connected a provider — every Coach entry point in
    // the app hangs off it, so an unconfigured instance renders exactly what it always did.
    config: null,

    // Mutate a draft of S via producer fn, then persist + schedule sync.
    update(mut, push = true) {
      const S = clone(get().S)
      mut(S)
      persist(S, push)
    },
    replaceState(S, push = false) { persist(clone(S), push) },

    toggleFavorite(id) {
      get().update(s => {
        s.favorites = s.favorites || []
        const idx = s.favorites.indexOf(id)
        if (idx >= 0) s.favorites.splice(idx, 1)
        else s.favorites.push(id)
      })
    },
    isFavorite: id => (get().S.favorites || []).includes(id),

    logMeal(meal) {
      const item = { id: meal.id || 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), ...meal, t: Date.now() }
      get().update(s => {
        s.meals = s.meals || []
        s.meals.push(item)
      })
      return item
    },
    updateMeal(id, updates) {
      get().update(s => {
        s.meals = s.meals || []
        const idx = s.meals.findIndex(m => m.id === id)
        if (idx >= 0) s.meals[idx] = { ...s.meals[idx], ...updates }
      })
    },
    deleteMeal(id) {
      get().update(s => {
        s.meals = (s.meals || []).filter(m => m.id !== id)
      })
    },
    setNutritionTargets(targets) {
      get().update(s => {
        s.nutritionTargets = { ...(s.nutritionTargets || {}), ...targets }
      })
    },

    logCardio(entry) {
      const item = {
        id: entry.id || 'cardio_' + uid(),
        d: entry.d || todayISO(),
        activity: entry.activity || 'Walking',
        durationHours: Number(entry.durationHours) || 0,
        durationMinutes: Number(entry.durationMinutes) || 0,
        totalDurationMinutes: entry.totalDurationMinutes != null
          ? Number(entry.totalDurationMinutes)
          : ((Number(entry.durationHours) || 0) * 60 + (Number(entry.durationMinutes) || 0)),
        distanceKm: entry.distanceKm != null ? Number(entry.distanceKm) : 0,
        createdAt: entry.createdAt || new Date().toISOString()
      }
      get().update(s => {
        s.cardioLogs = s.cardioLogs || []
        const idx = s.cardioLogs.findIndex(c => c.id === item.id)
        if (idx >= 0) s.cardioLogs[idx] = item
        else s.cardioLogs.push(item)
      })
      return item
    },
    deleteCardio(id) {
      get().update(s => {
        s.cardioLogs = (s.cardioLogs || []).filter(c => c.id !== id)
      })
    },

    isGuest: () => localStorage.getItem('gym_guest') === '1',
    setGuest(v) { if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest'); set({}) },

    setUser(u) {
      const prevUser = get().user
      if (u) {
        localStorage.setItem('gym_user', JSON.stringify(u))
        localStorage.removeItem('gym_guest')
        if (!prevUser || prevUser.id !== u.id) {
          const userState = loadState(u.id)
          registerCustom(userState.customEx)
          set({ user: u, S: userState })
        } else {
          set({ user: u })
        }
      } else {
        localStorage.removeItem('gym_user')
        const guestState = loadState(null)
        registerCustom(guestState.customEx)
        set({ user: null, S: guestState })
      }
    },

    async pushState() {
      if (!get().user) return
      clearTimeout(pushTm)
      try { await api('/api/data', { method: 'PUT', body: JSON.stringify({ state: get().S }) }); localStorage.removeItem('gym_dirty') }
      catch (e) { localStorage.setItem('gym_dirty', '1') }
    },
    async pullState() {
      try {
        const { state } = await api('/api/data')
        const currentUser = get().user
        if (state && currentUser) {
          const active = get().S?.active
          const next = Object.assign(clone(DEF), state)
          if (active) next.active = active
          persist(next, false)
          localStorage.removeItem('gym_dirty')
        } else if (state && !hasData(get().S)) {
          persist(Object.assign(clone(DEF), state), false)
        }
      } catch (e) { /* offline — keep local */ }
    },

    async signOut() {
      try { await get().pushState(); await api('/api/logout', { method: 'POST', body: '{}' }) } catch (e) { /* */ }
      clearLocalSession()
    },

    // "Sign out everywhere": the server bumps this profile's session version, which kills every
    // session it has on any device — this browser included, so the app has to end up exactly
    // where a normal signOut leaves it. Unlike signOut the request is NOT swallowed: if it fails
    // the sessions elsewhere are all still valid, and wiping this device's copy of the data
    // would sign the user out of the one place the bump didn't reach. Caller reports the error.
    async signOutAll() {
      await get().pushState()   // never throws — stores gym_dirty and moves on when offline
      await api('/api/logout/all', { method: 'POST', body: '{}' })
      clearLocalSession()
    },

    // Demo build only: drop the seeded example profile back in (Settings → "Reset demo data").
    // Dynamic import so the generator never ships in a self-hosted bundle.
    async resetDemo() {
      const { buildDemoState } = await import('../lib/demoSeed.js')
      localStorage.removeItem('gym_dirty')
      persist(Object.assign(clone(DEF), buildDemoState()), false)
    },

    // Boot: ask the server who we are, then pull.
    async boot() {
      // Mobile build: no backend either — restore from the file mirror (the durable copy;
      // localStorage may have been evicted since the last run) and go straight in.
      if (MOBILE) {
        const saved = await nativeLoad()
        const S = get().S
        if (saved && (!hasData(S) || (saved._ts || 0) >= (S._ts || 0))) {
          persist(Object.assign(clone(DEF), saved), false)
        } else if (hasData(S)) {
          nativeSave(S)   // first run after an update from a file-less version: seed the mirror
        }
        get().setGuest(true)
        syncReminder(get().S)
        set({ ready: true })
        return
      }
      // Demo build (GitHub Pages): no backend at all — seed once, stay in guest mode.
      if (DEMO) {
        if (!localStorage.getItem(DEMO_SEEDED)) {
          localStorage.setItem(DEMO_SEEDED, '1')
          await get().resetDemo()
        }
        get().setGuest(true)
        set({ ready: true })
        return
      }
      // Instance capabilities are public and needed whether or not anyone is signed in.
      try { set({ config: await api('/api/config') }) } catch (e) { /* offline — assume nothing extra */ }
      try {
        const me = await api('/api/me')
        get().setUser(me.user)
        await get().pullState()
        // Re-stamp the reminder's timezone on every load — keeps it correct if you're travelling,
        // without needing to revisit Settings.
        const tz = localTZ()
        if (get().S.reminder?.on && get().S.reminder.tz !== tz) {
          get().update(s => { s.reminder = { ...s.reminder, tz } })
        }
      } catch (e) {
        if (e.status === 401) get().setUser(null)
      }
      set({ ready: true })
    }
  }
})

export { hasData }
