import React from 'react'
import { motion, useTransform } from 'framer-motion'
import { HeroScene } from '../three.jsx'
import { Counter } from './reveal.jsx'

const EASE = [0.2, 0.8, 0.25, 1]

export default function Hero({ ready, scrollYProgress, stats }) {
  const canvasOpacity = useTransform(scrollYProgress, [0.15, 0.85], [1, 0])
  const canvasScale = useTransform(scrollYProgress, [0.15, 0.85], [1, 0.96])
  const s = stats.summary
  const chips = s ? [
    [s.inspected_today_km / 1000, 1, 'km inspected today'],
    [s.open_events, 0, 'open defects'],
    [s.critical_open, 0, 'critical alerts'],
    [s.active_rovers, 0, 'rovers online'],
  ] : []
  return (
    <section id="home" className="nex-hero">
      <motion.div className="nex-hero-canvas" style={{ opacity: canvasOpacity, scale: canvasScale }}>
        <HeroScene variant="dark" scrollProgress={scrollYProgress} enableZoom={false} />
      </motion.div>
      <div className="nex-hero-scrim" />
      <div className="nex-hero-type">
        <motion.div
          className="nex-hero-label"
          initial={{ opacity: 0 }}
          animate={ready ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <span className="dot" />
          <span className="nex-mono">IRIS — Intelligent Railtrack Inspection System</span>
        </motion.div>
        <motion.h1
          className="nex-display"
          initial={{ opacity: 0, y: 70 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
        >
          Railway
        </motion.h1>
        <motion.h1
          className="nex-display line2"
          initial={{ opacity: 0, y: 70 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: EASE, delay: 0.4 }}
        >
          <span className="nex-echo-wrap">
            Intelligence
            <span className="nex-echo" aria-hidden="true">Intelligence</span>
          </span>
        </motion.h1>
      </div>
      {chips.length > 0 && (
        <motion.div
          className="nex-chips"
          initial={{ opacity: 0, y: 20 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.75 }}
        >
          {chips.map(([v, d, l]) => (
            <div key={l} className="nex-chip">
              <span className="dot" />
              <span className="v"><Counter value={v} decimals={d} /></span>
              <span className="l">{l}</span>
            </div>
          ))}
        </motion.div>
      )}
      <motion.div
        className="nex-scroll-cue"
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: 1 } : {}}
        transition={{ delay: 1.15 }}
      >
        <span>Scroll to explore</span>
        <motion.span className="arrow" animate={{ y: [0, 7, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>↓</motion.span>
      </motion.div>
      <div className="nex-hero-seam" />
    </section>
  )
}
