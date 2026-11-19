import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import MuscleBalanceChart from './MuscleBalanceChart.jsx'
import { resolveExerciseMeta, musclesOf, loadOfWorkouts } from '../lib/muscles.js'
import { todayISO } from '../lib/format.js'

describe('MuscleBalanceChart Component', () => {
  it('renders correctly with empty workouts and shows empty state', () => {
    const emptyS = { workouts: [] }
    const html = renderToString(
      <MemoryRouter>
        <MuscleBalanceChart S={emptyS} />
      </MemoryRouter>
    )
    expect(html).toContain('Muscle Balance')
    expect(html).toContain('Day')
    expect(html).toContain('Week')
    expect(html).toContain('30 Days')
    expect(html).toContain('90 Days')
    expect(html).toContain('All')
    expect(html).toContain('No muscle activity recorded yet.')
  })

  it('renders trained muscle groups when completed workouts exist with dataset exercises', () => {
    const today = todayISO()
    const S = {
      workouts: [
        {
          id: 'w1',
          d: today,
          date: today,
          entries: [
            {
              id: '1254', // band bench press -> pectorals -> chest
              name: 'Band Bench Press',
              sets: [
                { done: true, w: 80, r: 8 },
                { done: true, w: 80, r: 8 },
                { done: true, w: 80, r: 8 }
              ]
            }
          ]
        }
      ]
    }

    const html = renderToString(
      <MemoryRouter>
        <MuscleBalanceChart S={S} />
      </MemoryRouter>
    )
    expect(html).toContain('Muscle Balance')
    expect(html).toContain('Trained Muscles')
    expect(html).toContain('Chest')
  })

  it('correctly resolves predefined custom planner exercises and computes muscle loads', () => {
    const shEx = resolveExerciseMeta('lib_sh_db_press', { name: 'Dumbbell Shoulder Press' })
    expect(shEx).toBeDefined()
    const shMuscles = musclesOf(shEx)
    expect(shMuscles.deltoids).toBeGreaterThan(0)

    const chEx = resolveExerciseMeta('lib_ch_bench_press', { name: 'Barbell Bench Press' })
    expect(chEx).toBeDefined()
    const chMuscles = musclesOf(chEx)
    expect(chMuscles.chest).toBeGreaterThan(0)
    expect(chMuscles.triceps).toBeGreaterThan(0)

    const bkEx = resolveExerciseMeta('lib_bk_lat_pulldown', { name: 'Lat Pulldown' })
    expect(bkEx).toBeDefined()
    const bkMuscles = musclesOf(bkEx)
    expect(bkMuscles['upper-back']).toBeGreaterThan(0)

    const legEx = resolveExerciseMeta('lib_leg_sq', { name: 'Barbell Squat' })
    expect(legEx).toBeDefined()
    const legMuscles = musclesOf(legEx)
    expect(legMuscles.quadriceps).toBeGreaterThan(0)
  })

  it('renders trained muscles on dashboard when completed workouts use custom planner templates', () => {
    const today = todayISO()
    const S = {
      workouts: [
        {
          id: 'w_custom_planner',
          d: today,
          date: today,
          entries: [
            {
              id: 'lib_sh_db_press',
              name: 'Dumbbell Shoulder Press',
              sets: [
                { done: true, w: 22.5, r: 12 },
                { done: true, w: 22.5, r: 10 }
              ]
            },
            {
              id: 'lib_ch_bench_press',
              name: 'Barbell Bench Press',
              sets: [
                { done: true, w: 75, r: 8 },
                { done: true, w: 75, r: 8 }
              ]
            }
          ]
        }
      ]
    }

    const load = loadOfWorkouts(S.workouts)
    expect(load.deltoids).toBeGreaterThanOrEqual(2)
    expect(load.chest).toBeGreaterThanOrEqual(2)

    const html = renderToString(
      <MemoryRouter>
        <MuscleBalanceChart S={S} />
      </MemoryRouter>
    )
    expect(html).toContain('Trained Muscles')
    expect(html).toContain('Shoulders')
    expect(html).toContain('Chest')
  })
})
