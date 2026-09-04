import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// boarding screen: the rover drives across a stretch of track while the
// progress bar fills, then hands off to the target route
export default function RoverTransition({ to = '/', message = 'Entering IRIS…' }) {
  const nav = useNavigate()
  useEffect(() => {
    // the boarding screen IS the preloader for this visit — don't replay the
    // landing curtain after login
    sessionStorage.setItem('iris.nex.preloader', '1')
    const t = setTimeout(() => nav(to, { replace: true }), 2100)
    return () => clearTimeout(t)
  }, [to, nav])
  return (
    <div className="rover-load">
      <div className="rl-scene">
        <div className="rl-track">
          <span className="rl-rail" />
          <span className="rl-rail" />
        </div>
        <div className="rl-rover">
          <svg viewBox="0 0 120 60">
            {/* side profile of the inspection rover */}
            <rect x="10" y="22" width="100" height="16" rx="7" fill="#2E2A3B" />
            <rect x="26" y="14" width="52" height="9" rx="4" fill="#8A77E8" />
            <rect x="18" y="4" width="4" height="11" rx="2" fill="#6B6780" />
            <circle cx="16" cy="1.5" r="2.5" fill="#E0608C" />
            <rect x="84" y="6" width="3" height="18" rx="1.5" fill="#6B6780" />
            <rect x="82" y="2.5" width="9" height="5" rx="2" fill="#4FBFA4" />
            <circle cx="32" cy="42" r="5.5" fill="#3A3547" stroke="rgba(244,241,234,.35)" strokeWidth="1.4" />
            <circle cx="88" cy="42" r="5.5" fill="#3A3547" stroke="rgba(244,241,234,.35)" strokeWidth="1.4" />
            <path d="M74 16 L74 38 L78 38 L78 16 Z" fill="rgba(127,216,190,.25)" />
          </svg>
        </div>
      </div>
      <div className="rl-label">{message}</div>
      <div className="rl-bar"><i /></div>
    </div>
  )
}
