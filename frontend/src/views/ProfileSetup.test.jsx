import { describe, it, expect, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ProfileSetup from './ProfileSetup.jsx'
import { useStore, DEF, getStorageKey } from '../store/useStore.js'

describe('ProfileSetup Onboarding Wizard & Multi-User Data Isolation', () => {
  beforeEach(() => {
    const s = useStore.getState()
    s.S = JSON.parse(JSON.stringify(DEF))
    s.user = {
      id: 'usr_test_alpha',
      name: 'John Doe',
      email: 'john@example.com',
      profile: null
    }
  })

  it('partitions storage key by user ID for multi-user isolation', () => {
    expect(getStorageKey('usr_test_alpha')).toBe('gym_state_user_usr_test_alpha')
    expect(getStorageKey('usr_test_beta')).toBe('gym_state_user_usr_test_beta')
    expect(getStorageKey(null)).toBe('gym_state_guest')
    expect(getStorageKey(undefined)).toBe('gym_state_guest')
  })

  it('renders Step 1 (Personal Info) with input fields and age calculation', () => {
    const html = renderToString(
      <MemoryRouter>
        <ProfileSetup />
      </MemoryRouter>
    )

    // Check step indicator and headers
    expect(html).toContain('Step 1 of 5')
    expect(html).toContain('Personal Information')
    expect(html).toContain('Full Name')
    expect(html).toContain('Date of Birth')
    expect(html).toContain('Calculated Age')
    expect(html).toContain('Biological Sex')
    expect(html).toContain('Height (cm)')
    expect(html).toContain('Current Weight (kg)')
    expect(html).toContain('Continue')
  })

  it('provides zero initial data when a new user starts onboarding', () => {
    const s = useStore.getState()
    expect(s.S.workoutTemplates || []).toHaveLength(0)
    expect(s.S.workouts || []).toHaveLength(0)
    expect(s.S.meals || []).toHaveLength(0)
    expect(s.S.bodyweight || []).toHaveLength(0)
  })
})
