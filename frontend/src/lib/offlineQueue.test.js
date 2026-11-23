import { describe, it, expect, beforeEach } from 'vitest'
import {
  enqueueOperation,
  getStoredQueue,
  saveStoredQueue,
  getSyncStatus,
  flushQueue
} from './offlineQueue.js'

describe('offline-first sync queue', () => {
  beforeEach(() => {
    let storage = {}
    globalThis.localStorage = {
      getItem: k => storage[k] || null,
      setItem: (k, v) => { storage[k] = String(v) },
      removeItem: k => { delete storage[k] },
      clear: () => { storage = {} }
    }
    saveStoredQueue([])
  })

  it('enqueues operations with unique IDs and initial pending status', () => {
    const op = enqueueOperation('user_123', 'state_push', { foo: 'bar' })
    expect(op).toBeDefined()
    expect(op.opId).toMatch(/^op_/)
    expect(op.uid).toBe('user_123')
    expect(op.status).toBe('pending')

    const stored = getStoredQueue()
    expect(stored.length).toBe(1)
    expect(stored[0].opId).toBe(op.opId)
  })

  it('reports sync status accurately based on queue count and user ID', () => {
    enqueueOperation('user_123', 'state_push', { a: 1 })
    enqueueOperation('user_456', 'meal_log', { b: 2 })

    const status123 = getSyncStatus('user_123')
    expect(status123.pendingCount).toBe(1)
    expect(status123.state).toBe('pending')

    const statusUnknown = getSyncStatus('user_789')
    expect(statusUnknown.pendingCount).toBe(0)
    expect(statusUnknown.state).toBe('synced')
  })

  it('preserves account isolation during queue flush', async () => {
    enqueueOperation('user_123', 'state_push', { data: 'u1' })
    enqueueOperation('user_456', 'state_push', { data: 'u2' })

    const processed = []
    const mockPush = async () => {
      processed.push('pushed')
    }

    // Flush for user_123 only
    await flushQueue('user_123', mockPush)

    // Only user_123's op should be flushed, user_456's op must remain quarantined in queue
    const remaining = getStoredQueue()
    expect(remaining.length).toBe(1)
    expect(remaining[0].uid).toBe('user_456')
    expect(processed.length).toBe(1)
  })
})
