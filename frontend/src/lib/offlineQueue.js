/**
 * Iron House - Offline-First Synchronization Queue
 *
 * Persists pending mutations locally, handles network reconnects,
 * enforces strict account isolation, and provides reactive sync status.
 */

import { api } from './api.js'

const QUEUE_STORAGE_KEY = 'gym_sync_queue'
const memStorage = new Map()
let listeners = new Set()

function getStorageItem(key) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      return localStorage.getItem(key)
    }
  } catch (e) {}
  return memStorage.get(key) || null
}

function setStorageItem(key, val) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(key, val)
      return
    }
  } catch (e) {}
  memStorage.set(key, val)
}

export function getStoredQueue() {
  try {
    const raw = getStorageItem(QUEUE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

export function saveStoredQueue(queue) {
  try {
    setStorageItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
    notifyListeners()
  } catch (e) { /* quota exceeded / storage disabled */ }
}

export function subscribeSyncStatus(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners() {
  const status = getSyncStatus()
  listeners.forEach(fn => {
    try { fn(status) } catch (e) { /* */ }
  })
}

/**
 * Appends an operation to the persistent sync queue.
 * Strict account isolation: every operation requires the current uid.
 */
export function enqueueOperation(uid, type, payload) {
  if (!uid) return null
  const queue = getStoredQueue()
  const op = {
    opId: 'op_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    uid: String(uid),
    type,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
    error: null
  }
  queue.push(op)
  saveStoredQueue(queue)
  return op
}

/**
 * Calculates current synchronization status.
 */
export function getSyncStatus(currentUid = null) {
  const isOnline = typeof navigator !== 'undefined' ? (navigator.onLine !== false) : true
  const queue = getStoredQueue()
  const userOps = currentUid ? queue.filter(q => q.uid === String(currentUid)) : queue
  const pendingCount = userOps.filter(q => q.status === 'pending' || q.status === 'failed').length
  const isSyncing = userOps.some(q => q.status === 'syncing')
  const hasFailed = userOps.some(q => q.status === 'failed')

  let state = 'synced'
  if (!isOnline) state = 'offline'
  else if (isSyncing) state = 'syncing'
  else if (hasFailed) state = 'error'
  else if (pendingCount > 0) state = 'pending'

  return {
    state,
    isOnline,
    pendingCount,
    totalQueued: userOps.length
  }
}

let isFlushing = false

/**
 * Flushes pending operations for the authenticated user only.
 * Operations belonging to other accounts are quarantined.
 */
export async function flushQueue(currentUid, pushStateFn) {
  if (isFlushing || !currentUid) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  isFlushing = true
  const queue = getStoredQueue()

  try {
    for (let i = 0; i < queue.length; i++) {
      const op = queue[i]
      // Strict account boundary: skip operations for other accounts
      if (op.uid !== String(currentUid)) continue
      if (op.status === 'synced') continue

      op.status = 'syncing'
      saveStoredQueue(queue)

      try {
        if (op.type === 'state_push') {
          if (pushStateFn) {
            await pushStateFn()
          } else {
            await api('/api/data', { method: 'PUT', body: JSON.stringify({ state: op.payload }) })
          }
        } else if (op.type === 'meal_log') {
          await api('/api/nutrition/log', { method: 'POST', body: JSON.stringify(op.payload) })
        } else if (op.type === 'meal_delete') {
          await api('/api/nutrition/log/delete', { method: 'POST', body: JSON.stringify(op.payload) })
        }
        op.status = 'synced'
        op.error = null
      } catch (err) {
        op.retryCount = (op.retryCount || 0) + 1
        op.status = 'failed'
        op.error = err.message || 'Network sync failed'
        // If server fails or offline, break and retry later
        break
      }
    }

    // Keep failed and pending, trim old synced
    const cleaned = queue.filter(q => q.status !== 'synced')
    saveStoredQueue(cleaned)
  } finally {
    isFlushing = false
    notifyListeners()
  }
}

// Background reconnect listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifyListeners()
  })
  window.addEventListener('offline', () => {
    notifyListeners()
  })
}
