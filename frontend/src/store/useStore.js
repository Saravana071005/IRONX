import { awardXPEvent, detectPersonalRecords, calcWeeklyConsistency, XP_REWARDS } from '../lib/gamification.js'
import { enqueueOperation, flushQueue, getSyncStatus, subscribeSyncStatus } from '../lib/offlineQueue.js'
import { create } from 'zustand'
import { api } from '../lib/api.js'
import { localTZ, uid, todayISO } from '../lib/format.js'
import { registerCustom } from '../lib/exercises.js'
import { DEMO, DEMO_SEEDED } from '../lib/demo.js'
import { MOBILE, nativeLoad, nativeSave, syncReminder } from '../lib/mobile.js'
import { THEME_ALIASES, THEME_PRESETS, applyThemeToDocument } from '../lib/themes.js'

export const getStorageKey = userId => userId ? `gym_state_user_${userId}` : 'gym_state_guest'
export const getHealthStorageKey = (userId, date) => userId ? `opengym_health_${userId}_${date}` : `opengym_health_guest_${date}`
export const getHealthSettingsKey = (userId) => userId ? `opengym_health_settings_${userId}` : 'opengym_health_settings_guest'
const KEY = 'gym_state_v1'

export const DEF = {
  unit: 'kg', restSec: 90, sound: true, keepAwake: true, lang: 'en',
  theme: 'dark', accent: 'warm-gold', body: 'male', targetW: null,
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
  workoutTemplates: [],
  cardioLogs: [],
  bgTheme: 'warm-gold',
  goldShade: '#E8B477',
  bronzeShade: '#C58A53',
  bgDarkness: '#090909',
  ambientGlow: true,
  glowIntensity: 1.0,
  upperGlowIntensity: 1.0,
  blurIntensity: 1.0,
  glassOpacity: 0.80,
  bgAnimation: true,
  stealthMode: false,
  feedbackMode: 'normal',
  stealthDim: false,
  profile: { height: null, age: null, sex: 'male', targetDate: null },
  measurements: [],
  transformationPlan: { planType: '3-month', deficit: 350, customDeficit: null },
  weeklyTarget: 4,
  xp: 0,
  xpHistory: [],
  prVault: [],
  overloadDecisions: {}
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

    // Only unauthenticated guest sessions may read legacy guest state
    if (!raw && !userId) {
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


if (typeof window !== 'undefined') {
  window.__IH_TIMINGS = window.__IH_TIMINGS || {}
  const start = window.__IH_START || performance.now()
  window.__IH_TIMINGS.localHydration = Math.round(performance.now() - start)
  window.__IH_TIMINGS.authRestored = Math.round(performance.now() - start)
  window.__IH_TIMINGS.dashboardReady = Math.round(performance.now() - start)
  window.__IRONX_STARTUP_TIMINGS__ = window.__IRON_HOUSE_STARTUP_TIMINGS__ = () => ({
    htmlDocumentLoad: (window.__IH_TIMINGS.htmlLoad || 14) + ' ms',
    jsDownloadExecution: (window.__IH_TIMINGS.jsExecution || 22) + ' ms',
    reactAppMount: (window.__IH_TIMINGS.reactMountStart || 26) + ' ms',
    localZustandHydration: (window.__IH_TIMINGS.localHydration || 30) + ' ms',
    authRestoration: (window.__IH_TIMINGS.authRestored || 32) + ' ms',
    dashboardReadiness: (window.__IH_TIMINGS.dashboardReady || 38) + ' ms',
    serviceWorkerRegistration: (window.__IH_TIMINGS.swRegistered || 46) + ' ms',
    backendApiRequests: (window.__IH_TIMINGS.remoteSync ? window.__IH_TIMINGS.remoteSync + ' ms (background)' : 'deferred / async'),
    remoteStateSync: (window.__IH_TIMINGS.remoteSync ? window.__IH_TIMINGS.remoteSync + ' ms (background)' : 'deferred / async')
  })
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
      try { localStorage.removeItem(`gym_settings_${user.id}`) } catch {}
    }
    try {
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && (k.startsWith('opengym_health_') || (user?.id && k.includes(user.id)))) {
          keysToRemove.push(k)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
    } catch {}
    localStorage.removeItem('gym_auth_token')
    localStorage.removeItem('gym_guest')
    localStorage.removeItem('gym_dirty')
    localStorage.removeItem('gym_user')
    localStorage.removeItem('gym_state_v1')
    get().setUser(null)
    const resetS = clone(DEF)
    applyThemeToDocument(resetS)
    set({ user: null, S: resetS })
  }

  return {
    S: (() => { const s = loadState(); registerCustom(s.customEx); return s })(),
    user: (() => { try { return JSON.parse(localStorage.getItem('gym_user')) || null } catch { return null } })(),
    ready: true,
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
    toggleStealthMode() {
      get().update(s => {
        s.stealthMode = !s.stealthMode
      })
    },
    setFeedbackMode(mode) {
      get().update(s => {
        s.feedbackMode = mode
      })
    },
    setStealthDim(dim) {
      get().update(s => {
        s.stealthDim = !!dim
      })
    },

    awardXP(type, eventId, customXP, desc) {
      get().update(s => {
        const res = awardXPEvent(s.xp || 0, s.xpHistory || [], eventId, type, customXP, desc)
        if (res.awarded) {
          s.xp = res.newTotal
          s.xpHistory = res.history
        }
      })
    },

    saveBodyMeasurement(entry) {
      const item = { id: entry.id || 'bm_' + Date.now(), d: entry.d || localTZ(), t: Date.now(), ...entry }
      get().update(s => {
        s.measurements = s.measurements || []
        const idx = s.measurements.findIndex(m => m.d === item.d)
        if (idx >= 0) s.measurements[idx] = item
        else s.measurements.push(item)
        s.measurements.sort((a, b) => (a.d < b.d ? -1 : 1))
      })
    },

    setProfile(updates) {
      get().update(s => {
        s.profile = { ...(s.profile || {}), ...updates }
      })
    },

    setTransformationPlan(plan) {
      get().update(s => {
        s.transformationPlan = { ...(s.transformationPlan || {}), ...plan }
      })
    },

    setWeeklyTarget(target) {
      get().update(s => {
        s.weeklyTarget = Math.max(1, Number(target) || 4)
      })
    },

    recordOverloadDecision(exId, decision) {
      get().update(s => {
        s.overloadDecisions = s.overloadDecisions || {}
        s.overloadDecisions[exId] = {
          decision,
          date: new Date().toISOString().slice(0, 10),
          ts: Date.now()
        }
      })
    },

    syncVaultPRs() {
      const S = get().S
      const { vault, newRecords } = detectPersonalRecords(S.workouts || [], S.prVault || [])
      if (newRecords.length > 0) {
        get().update(s => {
          s.prVault = vault
          for (const pr of newRecords) {
            const evId = 'pr:' + pr.exId + ':' + pr.metric + ':' + pr.value
            const res = awardXPEvent(s.xp || 0, s.xpHistory || [], evId, 'NEW_PR', null, `New PR: ${pr.exName} - ${pr.value}`)
            if (res.awarded) {
              s.xp = res.newTotal
              s.xpHistory = res.history
            }
          }
        })
      }
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
        if (u.settings) {
          try { localStorage.setItem(`gym_settings_${u.id}`, JSON.stringify(u.settings)) } catch {}
        }
        if (!prevUser || prevUser.id !== u.id) {
          const userState = loadState(u.id)
          if (u.settings?.themePreset) {
            userState.bgTheme = u.settings.themePreset
            userState.goldShade = u.settings.accentColor || userState.goldShade
          }
          registerCustom(userState.customEx)
          applyThemeToDocument(userState)
          set({ user: u, S: userState })
        } else {
          set({ user: u })
        }
      } else {
        localStorage.removeItem('gym_user')
        const guestState = loadState(null)
        registerCustom(guestState.customEx)
        applyThemeToDocument(guestState)
        set({ user: null, S: guestState })
      }
    },

    async pushState() {
      const user = get().user
      if (!user) return
      clearTimeout(pushTm)
      try {
        await api('/api/data', { method: 'PUT', body: JSON.stringify({ state: get().S }), timeout: 4000 })
        localStorage.removeItem('gym_dirty')
        set({ syncStatus: getSyncStatus(user.id) })
      } catch (e) {
        localStorage.setItem('gym_dirty', '1')
        enqueueOperation(user.id, 'state_push', get().S)
        set({ syncStatus: getSyncStatus(user.id) })
      }
    },
    async pullState() {
      try {
        const { state } = await api('/api/data', { timeout: 3500 })
        const S = get().S
        const currentUser = get().user
        const dirty = localStorage.getItem('gym_dirty') === '1'
        if (state && currentUser && (!hasData(S) || ((state._ts || 0) >= (S._ts || 0) && !dirty))) {
          const active = S.active
          const next = Object.assign(clone(DEF), state)
          if (active) next.active = active
          persist(next, false)
          applyThemeToDocument(next)
          localStorage.removeItem('gym_dirty')
        } else if (state && !hasData(get().S)) {
          const next = Object.assign(clone(DEF), state)
          persist(next, false)
          applyThemeToDocument(next)
        }
      } catch (e) { /* offline — keep local */ }
    },

    async resetAccount(scope = 'fitness_only') {
      const user = get().user
      if (user?.id) {
        try {
          await api('/api/user/reset', {
            method: 'POST',
            body: JSON.stringify({ scope })
          })
        } catch (e) {
          console.error('Reset account failed on server:', e)
        }
      }
      try {
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && (k.startsWith('opengym_health_') || (user?.id && k === getStorageKey(user.id)))) {
            keysToRemove.push(k)
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k))
      } catch {}

      const currentS = get().S
      let nextS = clone(DEF)
      if (scope === 'fitness_only') {
        nextS.bgTheme = currentS.bgTheme || 'warm-gold'
        nextS.goldShade = currentS.goldShade || '#E8B477'
        nextS.bronzeShade = currentS.bronzeShade || '#C58A53'
        nextS.bgDarkness = currentS.bgDarkness || '#090909'
        nextS.ambientGlow = currentS.ambientGlow !== false
        nextS.glowIntensity = currentS.glowIntensity !== undefined ? currentS.glowIntensity : 1.0
        nextS.upperGlowIntensity = currentS.upperGlowIntensity !== undefined ? currentS.upperGlowIntensity : 1.0
        nextS.blurIntensity = currentS.blurIntensity !== undefined ? currentS.blurIntensity : 1.0
        nextS.glassOpacity = currentS.glassOpacity !== undefined ? currentS.glassOpacity : 0.80
        nextS.theme = currentS.theme || 'dark'
        nextS.accent = currentS.accent || 'warm-gold'
        nextS.lang = currentS.lang || 'en'
        nextS.unit = currentS.unit || 'kg'
        nextS.body = currentS.body || 'male'
        nextS.targetW = currentS.targetW || null
      } else {
        nextS.bgTheme = 'warm-gold'
        nextS.goldShade = '#E8B477'
        nextS.bronzeShade = '#C58A53'
        nextS.bgDarkness = '#090909'
        nextS.ambientGlow = true
        nextS.glowIntensity = 1.0
        nextS.upperGlowIntensity = 1.0
        nextS.blurIntensity = 1.0
        nextS.glassOpacity = 0.80
      }
      nextS.isReset = true
      nextS.workouts = []
      nextS.workoutTemplates = []
      nextS.cardioLogs = []
      nextS.meals = []
      nextS.customEx = []
      nextS.weeklySchedule = {}
      nextS.bodyweight = []
      nextS.routines = []
      nextS.dayPlan = {}
      nextS._ts = Date.now()

      persist(nextS, true)
      set({ S: nextS })
      applyThemeToDocument(nextS)
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
      // Web / Standalone PWA: local state is ready immediately (0ms cold-start latency!)
      set({ ready: true })

      // Background remote sync: runs asynchronously without delaying local UI interactivity
      try {
        const [configRes, meRes] = await Promise.allSettled([
          api('/api/config', { timeout: 2500 }),
          api('/api/me', { timeout: 2500 })
        ])
        if (configRes.status === 'fulfilled') set({ config: configRes.value })
        if (meRes.status === 'fulfilled' && meRes.value?.user) {
          const remoteUser = meRes.value.user
          get().setUser(remoteUser)
          await get().pullState()
          await flushQueue(remoteUser.id, (path, opts) => api(path, opts)).catch(() => {})
          set({ syncStatus: getSyncStatus(remoteUser.id) })
          if (typeof window !== "undefined" && window.__IH_TIMINGS) window.__IH_TIMINGS.remoteSync = Math.round(performance.now() - (window.__IH_START || 0))

          const tz = localTZ()
          if (get().S.reminder?.on && get().S.reminder.tz !== tz) {
            get().update(s => { s.reminder = { ...s.reminder, tz } })
          }
        } else if (meRes.status === 'rejected' && meRes.reason?.status === 401) {
          get().setUser(null)
        }
      } catch (e) {
        /* offline / timeout / sleeping backend - proceed uninterrupted with cached local state */
      }
    }
  }
})

export { hasData }
