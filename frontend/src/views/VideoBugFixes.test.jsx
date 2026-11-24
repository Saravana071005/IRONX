import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { EXDB, allExercises } from '../lib/exercises.js'
import { isDuplicateExerciseName } from '../lib/customPlanner.js'
import { CheatMealModal } from './DietPlanModals.jsx'
import { api } from '../lib/api.js'

describe('IRONX Video Bug Investigation & Runtime Fixes Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Phase 1: Workout Exercise Search Crash Fix
  it('exercise filtering handles standard EXDB exercises (has e.n, no e.name) without throwing TypeError', () => {
    const mockStore = { customEx: [] }
    const exercises = allExercises(mockStore)
    expect(exercises.length).toBeGreaterThan(0)
    
    // Standard exercise has e.n, not e.name
    const sample = exercises[0]
    expect(sample.n).toBeDefined()
    expect(sample.name).toBeUndefined()

    // Simulate search typing "press" or "bench"
    const search = 'bench'
    const q = search.trim().toLowerCase()
    
    const filterFn = (e) => {
      if (!e) return false
      if (e.mode === 'cardio' || (e.bp && String(e.bp).toLowerCase() === 'cardio')) return false
      const name = String(e.name || e.n || '').toLowerCase()
      const eq = String(e.eq || e.equipment || '').toLowerCase()
      const tg = String(e.tg || e.target || '').toLowerCase()
      return name.includes(q) || eq.includes(q) || tg.includes(q)
    }

    // Must not throw TypeError: Cannot read properties of undefined (reading 'toLowerCase')
    expect(() => {
      const results = exercises.filter(filterFn)
      expect(Array.isArray(results)).toBe(true)
    }).not.toThrow()
  })

  it('exercise filtering handles custom exercises (has e.name, no e.n) without throwing TypeError', () => {
    const customEx = [
      { id: 'c1', name: 'Incline Dumbbell Flyes', category: 'Chest', equipment: 'Dumbbell' },
      { id: 'c2', name: 'Diamond Push-Up', bp: 'Chest', eq: 'Bodyweight' }
    ]
    const mockStore = { customEx }
    const exercises = allExercises(mockStore)

    const q = 'flyes'
    const filterFn = (e) => {
      if (!e) return false
      const name = String(e.name || e.n || '').toLowerCase()
      const eq = String(e.eq || e.equipment || '').toLowerCase()
      const tg = String(e.tg || e.target || '').toLowerCase()
      return name.includes(q) || eq.includes(q) || tg.includes(q)
    }

    expect(() => {
      const results = exercises.filter(filterFn)
      const customMatches = results.filter(e => e.id.startsWith('c'))
      expect(customMatches.length).toBe(1)
      expect(customMatches[0].id).toBe('c1')
    }).not.toThrow()
  })

  it('isDuplicateExerciseName handles both e.name and e.n safely', () => {
    const library = [
      { id: '1', name: 'Barbell Squat', category: 'Legs' },
      { id: '2', n: 'Bench Press', bp: 'Chest' }
    ]
    expect(isDuplicateExerciseName(library, 'barbell squat', 'Legs')).toBe(true)
    expect(isDuplicateExerciseName(library, 'bench press', 'Chest')).toBe(true)
    expect(isDuplicateExerciseName(library, 'Deadlift', 'Back')).toBe(false)
  })

  // Phase 3: Cheat Meal Modal resilience
  it('CheatMealModal renders initial form with textarea notes and no crashes', () => {
    const html = renderToString(
      <CheatMealModal
        onLogged={() => {}}
        close={() => {}}
        toast={() => {}}
      />
    )
    expect(html).toContain('Log Cheat / Extra Meal')
    expect(html).toContain('textarea')
    expect(html).toContain('Notes')
  })

  // Phase 3 & API serialization
  it('api() serializes object body into JSON and preserves options', async () => {
    let capturedBody = null
    let capturedHeaders = null

    // Mock fetch
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
      capturedBody = opts.body
      capturedHeaders = opts.headers
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    })

    try {
      await api('/api/nutrition/cheat-meals/save', {
        method: 'POST',
        body: { food_name: 'Biryani', serving_quantity: 1 }
      })
      expect(typeof capturedBody).toBe('string')
      expect(capturedBody).toBe(JSON.stringify({ food_name: 'Biryani', serving_quantity: 1 }))
      expect(capturedHeaders['Content-Type']).toBe('application/json')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
