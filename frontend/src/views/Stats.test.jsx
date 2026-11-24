import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import Stats from './Stats.jsx'
import { useStore } from '../store/useStore.js'

describe('Stats View', () => {
  it('renders Stats view without throwing ReferenceError: fmtVol is not defined', () => {
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
      cardioLogs: [],
      bodyweight: [],
      prVault: []
    })

    expect(() => {
      renderToString(
        <MemoryRouter>
          <Stats />
        </MemoryRouter>
      )
    }).not.toThrow()
  })
})
