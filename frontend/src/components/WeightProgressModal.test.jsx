import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import WeightProgressModal from './WeightProgressModal.jsx'
import HomeMealTracker from './HomeMealTracker.jsx'
import { useStore } from '../store/useStore.js'

describe('WeightProgressModal & HomeMealTracker Components', () => {
  it('renders WeightProgressModal with starting weight, current weight, and progress calculation', () => {
    useStore.getState().update(s => {
      s.unit = 'kg'
      s.bodyweight = [
        { d: '2026-11-01', w: 75.0, u: 'kg', t: 1730419200000 },
        { d: '2026-11-24', w: 74.0, u: 'kg', t: 1732406400000 }
      ]
    })

    const html = renderToString(<WeightProgressModal close={() => {}} />)

    expect(html).toContain('Body Weight Progress')
    expect(html).toContain('75')
    expect(html).toContain('74')
    expect(html).toContain('1.0 kg reduction')
    expect(html).toContain('Weight Progression Curve')
    expect(html).toContain('Weight History')
  })

  it('renders HomeMealTracker with strictly 4 meal rows: Breakfast, Lunch, Snacks, Dinner', () => {
    const html = renderToString(<HomeMealTracker date="2026-11-24" />)

    // Note: react renderToString encodes apostrophe as &#x27;
    expect(html).toMatch(/Today(&#x27;|')s Meal Tracker/)
    expect(html).toContain('Breakfast')
    expect(html).toContain('Lunch')
    expect(html).toContain('Snacks')
    expect(html).toContain('Dinner')
    expect(html).toContain('Consumed')
    expect(html).not.toContain('Import PDF')
    expect(html).not.toContain('Cheat Meal')
    expect(html).not.toContain('Pantry Foods')
  })
})
