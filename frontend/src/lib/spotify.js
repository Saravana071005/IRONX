import { api } from './api.js'

// Track if Spotify playback was paused by OpenGym rest timer
let pausedByOpenGym = false

export function isSpotifyPausedByOpenGym() {
  return pausedByOpenGym
}

export function setSpotifyPausedByOpenGym(val) {
  pausedByOpenGym = !!val
}

// Check current connection and playback status
export async function getSpotifyStatus() {
  try {
    const res = await api('/api/spotify/status')
    return res || { configured: false, connected: false }
  } catch (err) {
    return { configured: false, connected: false, error: err.message }
  }
}

// Start Spotify OAuth connection flow
export async function startSpotifyConnect(returnUrl = '/settings') {
  try {
    const res = await api(`/api/spotify/auth?format=json&returnUrl=${encodeURIComponent(returnUrl)}`)
    if (res && res.url) {
      window.location.href = res.url
      return true
    }
    return false
  } catch (err) {
    console.error('Failed to initiate Spotify connection:', err)
    return false
  }
}

// Pause playback
export async function pauseSpotify() {
  try {
    const res = await api('/api/spotify/pause', { method: 'POST', body: '{}' })
    return res || { ok: false }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// Resume playback
export async function resumeSpotify() {
  try {
    const res = await api('/api/spotify/play', { method: 'POST', body: '{}' })
    return res || { ok: false }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// Disconnect Spotify
export async function disconnectSpotify() {
  try {
    const res = await api('/api/spotify/disconnect', { method: 'POST', body: '{}' })
    pausedByOpenGym = false
    return res || { ok: true, connected: false }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// Handle auto-pause when rest timer begins
export async function onRestTimerStart(S) {
  if (!S || S.spotifyAutoPause === false) return

  try {
    const status = await getSpotifyStatus()
    if (status && status.connected && status.isPlaying) {
      pausedByOpenGym = true
      await pauseSpotify()
    }
  } catch (e) {
    // Non-blocking: Spotify error should never interrupt workout flow
  }
}

// Handle auto-resume when rest timer ends
export async function onRestTimerComplete(S) {
  if (!pausedByOpenGym) return
  pausedByOpenGym = false

  if (!S || S.spotifyAutoPause === false) return

  try {
    await resumeSpotify()
  } catch (e) {
    // Non-blocking
  }
}

// Reset pause state if rest is stopped early
export function onRestTimerStop() {
  pausedByOpenGym = false
}
