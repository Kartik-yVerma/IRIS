import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import App from './App.jsx'

// surface runtime errors visibly instead of a silent blank page + report to backend
function reportError(kind, text, detail) {
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:99999;background:#2E2A3B;color:#fff;padding:12px 16px;border-radius:12px;font:12px monospace;max-width:80vw'
  el.textContent = `IRIS ${kind}: ${text}`
  document.body.appendChild(el)
  try {
    fetch('/api/client-error', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, text, detail: String(detail).slice(0, 2000) }),
    }).catch(() => {})
  } catch { /* noop */ }
}
window.addEventListener('error', (e) => {
  reportError('runtime error', e.message || String(e.error), (e.error && e.error.stack) || '')
})
window.addEventListener('unhandledrejection', (e) => {
  reportError('async error', e.reason?.message || String(e.reason), (e.reason && e.reason.stack) || '')
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
