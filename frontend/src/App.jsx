import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Navbar, MorphTransition, AlertStack } from './components.jsx'
import { CLASS_LABEL, useEvents, fmt, titleCase } from './lib.js'
import Landing from './landing/Landing.jsx'
import Cursor from './landing/Cursor.jsx'
import Dashboard from './pages/Dashboard.jsx'
import MapPage from './pages/MapPage.jsx'
import VisionLab from './pages/VisionLab.jsx'
import Defects from './pages/Defects.jsx'
import Analytics from './pages/Analytics.jsx'
import Fleet from './pages/Fleet.jsx'

// light crossfade — no exit wait, no transforms: snappy and cheap
function Page({ children }) {
  const location = useLocation()
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } }}
    >
      {children}
    </motion.div>
  )
}

// the operational console — old chrome (nav pill, morph, alerts, SSE) lives
// here so the immersive landing mounts with none of it
function Console() {
  const location = useLocation()
  const nav = useNavigate()
  const [alerts, setAlerts] = useState([])
  useEvents((msg) => {
    if (msg.type === 'alert') {
      setAlerts((s) => [{
        id: msg.payload.id, kind: 'alert', severity: msg.payload.severity,
        title: `${CLASS_LABEL[msg.payload.class] || titleCase(msg.payload.class)} — ${msg.payload.severity}`,
        message: `Chainage ${fmt.km(msg.payload.chainage_m)} · tap to open`,
      }, ...s].slice(0, 4))
    }
    if (msg.type === 'health_flag') {
      setAlerts((s) => [{ id: Date.now() + '', kind: 'health', title: 'Rover health flag', message: msg.payload.message }, ...s].slice(0, 4))
    }
  })
  // the whole console runs the dark NexStudio theme now
  useEffect(() => {
    document.body.classList.add('nex-body-dark')
    return () => document.body.classList.remove('nex-body-dark')
  }, [])
  return (
    <div className="console-dark" style={{ minHeight: '100vh' }}>
      {!location.pathname.startsWith('/map') && <Navbar />}
      <MorphTransition />
      <Cursor tone="dark" />
      <AlertStack alerts={alerts} onOpen={(a) => { setAlerts((s) => s.filter((x) => x.id !== a.id)); if (a.kind === 'alert') nav(`/defects?event=${a.id}`); else nav('/dashboard') }} />
      <Page key={location.pathname}>
        <Routes location={location}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/vision" element={<VisionLab />} />
          <Route path="/defects" element={<Defects />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Page>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const isLanding = location.pathname === '/'
  return (
    <AnimatePresence mode="wait">
      {isLanding ? (
        <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}>
          <Landing />
        </motion.div>
      ) : (
        <motion.div key="console" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.35 } }} exit={{ opacity: 0 }}>
          <Console />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
