import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import Stats from './Stats.jsx'
import { useStore } from '../store/useStore.js'

describe('Stats View', () => {
  it('renders Stats view without errors and verifies modules 2, 8, 9, 10', () => {
    useStore.setState({
      workouts: [
        {
          id: 'w1',
          d: '2026-11-24',
          start: Date.now() - 3600000,
          entries: [
            {
              id: 'bench-press',
              sets: [{ done: true, w: 80, r: 10 }]
            }
          ]
        }
      ],
      cardioLogs: [
        {
          id: 'c1',
          d: '2026-11-24',
          type: 'outdoor_run',
          distanceKm: 5.2,
          totalDurationMinutes: 30
        }
      ],
      bodyweight: [{ d: '2026-11-24', w: 75 }],
      prVault: []
    })

    let html = ''
    expect(() => {
      html = renderToString(
        <MemoryRouter>
          <Stats />
        </MemoryRouter>
      )
    }).not.toThrow()

    // Module 2: Volume lifted removed
    expect(html).not.toContain('Total Volume Lifted')

    // Module 9: Cardio Progress & Performance Insights
    expect(html).toContain('Cardio Progress &amp; Performance Insights')
    expect(html).toContain('GPS Live')

    // Module 10: Muscle Balance in Body Stats
    expect(html).toContain('Body Stats &amp; Muscle Balance')
    expect(html).toContain('Muscle Balance')
    expect(html).toContain('Both Views')
    expect(html).toContain('Anterior (Front)')
    expect(html).toContain('Posterior (Back)')
    expect(html).toContain('bodymap')
  })
})
