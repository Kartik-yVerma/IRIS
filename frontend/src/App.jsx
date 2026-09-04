import React, { useState } from 'react'
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

function Page({ children }) {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 14, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.2, 0.8, 0.25, 1] } }}
        exit={{ opacity: 0, y: -10, transition: { duration: 0.18 } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
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
  return (
    <>
      {!location.pathname.startsWith('/map') && <Navbar />}
      <MorphTransition />
      <Cursor tone="light" />
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
    </>
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
