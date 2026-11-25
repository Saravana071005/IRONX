/**
 * IRONX High-Performance Media Cache & Preloader
 *
 * Provides:
 * 1. Zero-latency in-memory tracking of resolved image and gif URLs.
 * 2. Background preloading of adjacent workout exercises so switching exercises is instant.
 * 3. Request deduplication to eliminate redundant network fetches.
 * 4. Safe bounded LRU caching to avoid memory pressure on mobile devices.
 */

import { imgSrc, gifSrc } from './exercises.js'

const loadedUrls = new Set()
const pendingPromises = new Map()
const MAX_CACHE_SIZE = 400

/**
 * Checks if a media URL has already loaded in the current app session.
 * @param {string} url
 * @returns {boolean}
 */
export function isMediaLoaded(url) {
  if (!url) return false
  return loadedUrls.has(url)
}

/**
 * Marks a media URL as loaded.
 * @param {string} url
 */
export function markMediaLoaded(url) {
  if (!url) return
  if (loadedUrls.size >= MAX_CACHE_SIZE) {
    // Evict oldest entries when cache reaches limit
    const firstKey = loadedUrls.values().next().value
    if (firstKey) loadedUrls.delete(firstKey)
  }
  loadedUrls.add(url)
}

/**
 * Preloads a single media URL using browser image element.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export function preloadMediaUrl(url) {
  if (!url || typeof window === 'undefined') return Promise.resolve(false)
  if (loadedUrls.has(url)) return Promise.resolve(true)
  if (pendingPromises.has(url)) return pendingPromises.get(url)

  const promise = new Promise(resolve => {
    try {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        markMediaLoaded(url)
        pendingPromises.delete(url)
        resolve(true)
      }
      img.onerror = () => {
        pendingPromises.delete(url)
        resolve(false)
      }
      img.src = url
    } catch {
      pendingPromises.delete(url)
      resolve(false)
    }
  })

  pendingPromises.set(url, promise)
  return promise
}

/**
 * Preloads demonstration media (both static still and animation) for an exercise.
 * @param {Object} ex Exercise record
 * @returns {Promise<boolean>}
 */
export function preloadExercise(ex) {
  if (!ex) return Promise.resolve(false)
  const still = imgSrc(ex)
  const anim = gifSrc(ex)
  const promises = []
  if (still) promises.push(preloadMediaUrl(still))
  if (anim && anim !== still) promises.push(preloadMediaUrl(anim))
  return Promise.all(promises).then(() => true)
}

/**
 * Preloads upcoming exercises in a workout sequence.
 * @param {Array} entries Active workout entries
 * @param {number} currentIndex Current exercise index being displayed
 * @param {number} count Number of upcoming exercises to preload (default: 3)
 */
export function preloadUpcomingExercises(entries, currentIndex = 0, count = 3) {
  if (!Array.isArray(entries) || !entries.length) return
  const slice = entries.slice(currentIndex + 1, currentIndex + 1 + count)
  slice.forEach(e => {
    if (!e || !e.id) return
    preloadExercise(e)
  })
}
