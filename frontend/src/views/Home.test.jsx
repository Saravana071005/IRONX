import { describe, it, expect, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home.jsx'
import { useStore, DEF } from '../store/useStore.js'

describe('Home View Rendering & Defensive Edge Cases', () => {
  beforeEach(() => {
    const s = useStore.getState()
    s.S = JSON.parse(JSON.stringify(DEF))
    s.user = { name: 'Alex Runner', email: 'alex@example.com' }
    s.config = {}
  })

  it('renders Home successfully with default fresh state without crashing', () => {
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).toContain('Hi,')
    expect(html).toContain('Weekly Activity')
    expect(html).toContain('Calories Overview')
    expect(html).toContain('Your Progress')
    expect(html).toContain('This Week Plan')
  })

  it('renders Home safely when bodyweight is completely empty or undefined', () => {
    useStore.getState().S.bodyweight = []
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).toContain('Weight')
    expect(html).toContain('Your Progress')
  })

  it('renders Home safely when bodyweight entries have missing or malformed values', () => {
    useStore.getState().S.bodyweight = [
      { d: '2026-11-10' },
      { d: '2026-11-11', w: null },
      { d: '2026-11-12', w: undefined },
      { d: '2026-11-13', w: 'not-a-number' },
      { d: '2026-11-14', w: 77.2 }
    ]
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).toContain('Weight')
    expect(html).toContain('77.2')
  })

  it('renders Home safely when workouts array is empty or undefined', () => {
    useStore.getState().S.workouts = []
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).toContain('Workouts')
    expect(html).toContain('Streak')
  })

  it('renders Home safely with logged workouts across multiple weeks', () => {
    useStore.getState().S.workouts = [
      { id: 'w1', d: '2026-11-18', entries: [] },
      { id: 'w2', d: '2026-11-11', entries: [] }
    ]
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).toContain('Workouts')
  })

  it('renders Home safely when meals array has missing food calorie properties', () => {
    useStore.getState().S.meals = [
      { d: '2026-11-18', calories: undefined, protein: null },
      { d: '2026-11-18', calories: 450, protein: 35, carb: 50, fat: 12 }
    ]
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).toContain('Calories Overview')
    expect(html).toContain('kcal')
  })
})
