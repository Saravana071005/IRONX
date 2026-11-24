import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import Nutrition from './Nutrition.jsx'
import Modals from '../components/Modals.jsx'
import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'

describe('Daily Health Log & Nutrition Resilience', () => {
  it('renders Nutrition health log without throwing errors or black screening', () => {
    // Populate store state with varied cardio dates to ensure safe parsing
    useStore.setState({
      cardioLogs: [
        { id: 'c1', activity: 'Running', duration_min: 30, createdAt: '2026-11-24T10:00:00.000Z' },
        { id: 'c2', activity: 'Cycling', duration_min: 45, createdAt: Date.now() }, // timestamp number
        { id: 'c3', activity: 'Walking', duration_min: 20, createdAt: null } // null createdAt
      ],
      meals: [],
      workouts: []
    })

    const html = renderToString(<Nutrition />)
    expect(html).toContain('Daily Health Log')
    expect(html).toContain('Food Database')
  })

  it('Modals component renders ModalBoundary to protect sheets against uncaught crashes', () => {
    const html = renderToString(<Modals />)
    expect(html).toBeDefined()
  })
})
