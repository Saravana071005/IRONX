import { describe, it, expect, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import MuscleBalanceChart from './MuscleBalanceChart.jsx'
import { todayISO } from '../lib/format.js'

describe('MuscleBalanceChart Component', () => {
  it('renders correctly with empty workouts and shows empty state for Day filter', () => {
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
    expect(html).toContain('No muscle activity recorded')
  })

  it('renders trained muscle groups when completed workouts exist', () => {
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
})
