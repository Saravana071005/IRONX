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
    expect(html).toContain('Muscle Balance')
  })

  it('renders reorganized layout order with Quick Actions above Weekly Activity without duplicates', () => {
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    // Layout sequence: Greeting -> Quick Actions -> Weekly Activity -> Your Progress -> Muscle Balance
    const posGreeting = html.indexOf('Hi,')
    const posQuickActions = html.indexOf('Quick Actions')
    const posWeeklyActivity = html.indexOf('Weekly Activity')
    const posProgress = html.indexOf('Your Progress')
    const posMuscleBalance = html.indexOf('Muscle Balance')

    expect(posGreeting).toBeGreaterThan(-1)
    expect(posQuickActions).toBeGreaterThan(posGreeting)
    expect(posWeeklyActivity).toBeGreaterThan(posQuickActions)
    expect(posProgress).toBeGreaterThan(posWeeklyActivity)
    expect(posMuscleBalance).toBeGreaterThan(posProgress)

    // Quick Actions must not be duplicated
    const quickActionsCount = (html.match(/Quick Actions/g) || []).length
    expect(quickActionsCount).toBe(1)

    // All 4 quick action buttons must be present
    expect(html).toContain('Log Workout')
    expect(html).toContain('Log Food')
    expect(html).toContain('Log Cardio')
    expect(html).toContain('Body Stats')
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

  it('does NOT contain promotional hero marketing slogans', () => {
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).not.toContain('Plan. Train. Track.')
    expect(html).not.toContain('Get Stronger.')
    expect(html).not.toContain('Your personal fitness companion')
    expect(html).not.toContain('Track workouts, visualize muscle recovery')
  })

  it('renders Set Up Your First Workout Template when no templates exist for new user', () => {
    useStore.getState().S.workoutTemplates = []
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).toContain('Set Up Your First Workout Template')
    expect(html).toContain('Create Template')
    expect(html).not.toContain('Back + Biceps')
    expect(html).not.toContain('1,368')
  })

  it('renders No weight records yet and Add Weight action when weight history is empty', () => {
    useStore.getState().S.bodyweight = []
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).toContain('No weight records yet')
    expect(html).toContain('Add Weight')
  })

  it('renders single data point for manual weight entry without fabricating curves', () => {
    useStore.getState().S.bodyweight = [{ d: '2026-11-19', w: 79.5 }]
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).toContain('79.5 kg')
    expect(html).not.toContain('No weight records yet')
  })

  it('renders No Workout Scheduled and Open Weekly Planner when templates exist but none assigned today', () => {
    useStore.getState().S.workoutTemplates = [
      { id: 'tpl_chest', name: 'Chest Blast', exercises: [] }
    ]
    useStore.getState().S.weeklySchedule = {}
    useStore.getState().S.dayPlan = {}
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).toContain('No Workout Scheduled')
    expect(html).toContain('Open Weekly Planner')
    expect(html).not.toContain('Start Workout')
  })

  it('renders Rest & Recovery when today is explicitly marked as rest day', () => {
    useStore.getState().S.workoutTemplates = [
      { id: 'tpl_chest', name: 'Chest Blast', exercises: [] }
    ]
    const today = new Date().getDay()
    useStore.getState().S.weeklySchedule = { [today]: 'rest' }
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).toContain('Rest &amp; Recovery')
    expect(html).not.toContain('Start Workout')
  })

  it('renders assigned template and Start Workout when template is scheduled for today', () => {
    const today = new Date().getDay()
    useStore.getState().S.workoutTemplates = [
      { id: 'tpl_leg', name: 'Leg Destroyer', exercises: [{ id: 'ex1', name: 'Squat', sets: 4, reps: 10 }] }
    ]
    useStore.getState().S.weeklySchedule = { [today]: 'tpl_leg' }
    const html = renderToString(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(html).toContain('Leg Destroyer')
    expect(html).toContain('Start Workout')
  })
})
