import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { MOBILE } from './lib/mobile.js'
import './index.css'

if (typeof window !== 'undefined') {
  window.__IH_TIMINGS = window.__IH_TIMINGS || {}
  const now = performance.now()
  const start = window.__IH_START || now
  window.__IH_TIMINGS.jsExecution = Math.round(now - start)
  window.__IH_TIMINGS.reactMountStart = Math.round(now - start)
}

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)

const isSecureOrLocalhost = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
if (!MOBILE && 'serviceWorker' in navigator && isSecureOrLocalhost) {
  const swStart = performance.now()
  navigator.serviceWorker.register('sw.js').then(() => {
    if (typeof window !== 'undefined' && window.__IH_TIMINGS) {
      window.__IH_TIMINGS.swRegistered = Math.round(performance.now() - (window.__IH_START || swStart))
    }
  }).catch(() => {})
}
