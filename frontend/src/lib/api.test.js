import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from './api.js'

describe('api client with AbortController timeout', () => {
  const origFetch = globalThis.fetch

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    globalThis.fetch = origFetch
    vi.useRealTimers()
  })

  it('resolves JSON on successful request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 'u1', name: 'Alex' } })
    })

    const res = await api('/api/me')
    expect(res).toEqual({ user: { id: 'u1', name: 'Alex' } })
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({
      headers: { 'Content-Type': 'application/json' },
      signal: expect.any(AbortSignal)
    }))
  })

  it('rejects with error and status on HTTP failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' })
    })

    await expect(api('/api/me')).rejects.toThrow('Unauthorized')
  })

  it('aborts and throws TimeoutError when request exceeds timeout', async () => {
    globalThis.fetch = vi.fn().mockImplementation((path, opts) => {
      return new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    })

    const apiPromise = api('/api/config', { timeout: 1000 })
    
    // Fast forward timer past 1000ms
    vi.advanceTimersByTime(1100)

    await expect(apiPromise).rejects.toThrow(/timeout/i)
  })
})
