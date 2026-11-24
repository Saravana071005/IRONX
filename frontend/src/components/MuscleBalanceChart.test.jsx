import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import MuscleBalanceChart from './MuscleBalanceChart.jsx'
import {
  resolveExerciseMeta,
  musclesOf,
  loadOfWorkouts,
  getExerciseMuscleBreakdown
} from '../lib/muscles.js'
import { todayISO } from '../lib/format.js'

describe('MuscleBalanceChart & Anatomical Muscle Body Map', () => {
  it('always renders the anatomical body map with Anterior and Posterior views even with 0 workouts', () => {
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
    // Both views must always be rendered in the body map
    expect(html).toContain('Anterior (Front)')
    expect(html).toContain('Posterior (Back)')
    expect(html).toContain('bodymap')
    // Textual list chips below the chart are removed per UI cleanup specification
    expect(html).not.toContain('Anterior / Front Muscles')
    expect(html).not.toContain('Posterior / Back Muscles')
  })

  it('accurately maps standard exercises to primary and secondary muscle groups', () => {
    // 1. Bench Press → Chest (primary), Triceps & Front Delts (secondary)
    const bp = getExerciseMuscleBreakdown(null, { name: 'Barbell Bench Press' })
    expect(bp.primary).toContain('chest')
    expect(bp.secondary).toContain('triceps')
    expect(bp.secondary).toContain('deltoids')

    // 2. Lat Pulldown → Lats / Upper Back (primary), Biceps (secondary)
    const lp = getExerciseMuscleBreakdown(null, { name: 'Lat Pulldown' })
    expect(lp.primary).toContain('upper-back')
    expect(lp.secondary).toContain('biceps')

    // 3. Barbell Row → Back (primary), Biceps (secondary)
    const row = getExerciseMuscleBreakdown(null, { name: 'Barbell Row' })
    expect(row.primary).toContain('upper-back')
    expect(row.secondary).toContain('biceps')

    // 4. Shoulder Press → Shoulders (primary), Triceps (secondary)
    const sp = getExerciseMuscleBreakdown(null, { name: 'Overhead Shoulder Press' })
    expect(sp.primary).toContain('deltoids')
    expect(sp.secondary).toContain('triceps')

    // 5. Squats → Quadriceps (primary), Glutes (secondary)
    const sq = getExerciseMuscleBreakdown(null, { name: 'Barbell Squat' })
    expect(sq.primary).toContain('quadriceps')
    expect(sq.secondary).toContain('gluteal')

    // 6. Romanian Deadlift → Hamstrings (primary), Glutes (secondary)
    const rdl = getExerciseMuscleBreakdown(null, { name: 'Romanian Deadlift' })
    expect(rdl.primary).toContain('hamstring')
    expect(rdl.secondary).toContain('gluteal')

    // 7. Biceps Curl → Biceps (primary)
    const curl = getExerciseMuscleBreakdown(null, { name: 'Dumbbell Biceps Curl' })
    expect(curl.primary).toContain('biceps')

    // 8. Triceps Extension → Triceps (primary)
    const tri = getExerciseMuscleBreakdown(null, { name: 'Cable Triceps Extension' })
    expect(tri.primary).toContain('triceps')
  })

  it('renders trained primary and secondary muscles on dashboard with stimulation status', () => {
    const today = todayISO()
    const S = {
      workouts: [
        {
          id: 'w_chest_day',
          name: 'Chest & Back Power',
          d: today,
          date: today,
          dur: 3600000,
          entries: [
            {
              id: 'bench_1',
              name: 'Barbell Bench Press',
              sets: [
                { done: true, w: 80, r: 8 },
                { done: true, w: 85, r: 6 }
              ]
            },
            {
              id: 'lat_1',
              name: 'Lat Pulldown',
              sets: [
                { done: true, w: 60, r: 10 },
                { done: true, w: 65, r: 8 }
              ]
            }
          ]
        }
      ]
    }

    const load = loadOfWorkouts(S.workouts)
    expect(load.chest).toBeGreaterThanOrEqual(2)
    expect(load['upper-back']).toBeGreaterThanOrEqual(2)
    expect(load.triceps).toBeGreaterThan(0)
    expect(load.biceps).toBeGreaterThan(0)

    const html = renderToString(
      <MemoryRouter>
        <MuscleBalanceChart S={S} />
      </MemoryRouter>
    )

    expect(html).toContain('Muscle Balance')
    expect(html).toContain('Muscle Groups Stimulated')
    expect(html).toContain('Anterior (Front)')
    expect(html).toContain('Posterior (Back)')
    expect(html).not.toContain('Anterior / Front Muscles')
    expect(html).not.toContain('Posterior / Back Muscles')
  })

  it('correctly handles ISO timestamps in workout dates without dropping entries', () => {
    const isoDateWithTime = `${todayISO()}T08:30:00.000Z`
    const S = {
      workouts: [
        {
          id: 'w_iso',
          name: 'Leg Day Session',
          d: isoDateWithTime,
          date: isoDateWithTime,
          entries: [
            {
              id: 'sq_1',
              name: 'Barbell Squat',
              sets: [
                { done: true, w: 100, r: 5 },
                { done: true, w: 105, r: 5 }
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
    expect(html).toContain('Muscle Groups Stimulated')
    expect(html).toContain('Quads')
  })

  it('does not count planned, cancelled, or 0-completed-set workouts towards muscle balance', () => {
    const today = todayISO()
    const S = {
      workouts: [
        {
          id: 'w_uncompleted',
          name: 'Uncompleted Plan',
          d: today,
          date: today,
          entries: [
            {
              id: 'bench_uncompleted',
              name: 'Barbell Bench Press',
              sets: [
                { done: false, w: 80, r: 8 },
                { done: false, w: 80, r: 8 }
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

    // Should indicate no muscle activity in this period while still showing the body diagrams
    expect(html).toContain('No muscle activity recorded in this period')
    expect(html).toContain('Anterior (Front)')
    expect(html).toContain('Posterior (Back)')
  })
})
