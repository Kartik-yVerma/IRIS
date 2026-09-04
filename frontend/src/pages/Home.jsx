import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ScanEye, MapPin, Layers, Gauge, History, ShieldCheck, BrainCircuit, Route } from 'lucide-react'
import { HeroScene } from '../three.jsx'
import { GlassCard } from '../components.jsx'
import { C, usePoll, get, fmt } from '../lib.js'

const PILLARS = [
  { icon: <ScanEye size={20} />, color: C.lavender, title: 'Detect', text: 'Edge vision (OpenCV + YOLO) finds cracks, broken rails, missing fasteners, foreign objects and vegetation from rover camera frames.' },
  { icon: <MapPin size={20} />, color: C.mint, title: 'Localize', text: 'GNSS + wheel odometry + track-map projection pins every defect to an exact chainage and coordinate, with an uncertainty estimate.' },
  { icon: <Layers size={20} />, color: C.peach, title: 'Fuse', text: 'Visual, vibration and position evidence combine into one fused score — a crack plus an impact signature is stronger than either alone.' },
  { icon: <Gauge size={20} />, color: C.sky, title: 'Prioritize', text: 'Severity, confidence, recurrence and operational context become a transparent risk score, so engineers see what matters first.' },
  { icon: <History size={20} />, color: C.butter, title: 'Track', text: 'Every detection becomes a traceable inspection event with evidence, workflow history and longitudinal trend per segment.' },
]

export default function Home() {
  const summary = usePoll(() => get('/analytics/summary'), 5000)
  return (
    <div>
      {/* hero */}
      <div style={{ position: 'relative', height: 'min(92vh, 780px)', minHeight: 560 }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <HeroScene />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
          <div className="page" style={{ width: '100%', paddingTop: 40 }}>
            <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, ease: [.2, .8, .25, 1] }} style={{ maxWidth: 620 }}>
              <div className="badge" style={{ background: 'rgba(255,255,255,.8)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 16px rgba(46,42,59,.08)' }}>
                <BrainCircuit size={14} style={{ color: C.lavender }} /> Intelligent Railtrack Inspection System
              </div>
              <h1 className="display" style={{ fontSize: 'clamp(38px, 5.6vw, 64px)', lineHeight: 1.06, fontWeight: 800, letterSpacing: '-1.5px', marginTop: 18 }}>
                Rails, watched by an<br />intelligent <span style={{ background: `linear-gradient(100deg, ${C.lavender}, ${C.mint})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>rover eye</span>.
              </h1>
              <p style={{ color: C.muted, fontSize: 16.5, marginTop: 16, maxWidth: 480 }}>
                IRIS fuses rover vision, vibration and position data to detect, localize,
                prioritize and track railway defects — turning inspection data into
                decisions, not just detections.
              </p>
              <div className="row" style={{ gap: 12, marginTop: 26, pointerEvents: 'auto' }}>
                <Link to="/dashboard" className="btn primary">Open Dashboard <ArrowRight size={16} /></Link>
                <Link to="/map" className="btn glass">Live Mission Map</Link>
              </div>
              {summary && (
                <div className="row wrap" style={{ gap: 10, marginTop: 30, pointerEvents: 'auto' }}>
                  {[[fmt.km(summary.inspected_today_km), 'track inspected today'],
                    [summary.open_events, 'open defect events'],
                    [summary.critical_open, 'critical alerts']].map(([v, l]) => (
                    <div key={l} className="glass" style={{ padding: '12px 18px', borderRadius: 18 }}>
                      <div className="display mono" style={{ fontWeight: 700, fontSize: 21 }}>{v}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{l}</div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* pillars */}
      <div className="page">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.8px' }}>The five-stage intelligence loop</h2>
          <p className="muted" style={{ marginTop: 6 }}>Detect · Localize · Fuse · Prioritize · Track — a closed loop from observation to maintenance action.</p>
        </motion.div>
        <div className="grid cols-3 section-gap" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {PILLARS.map((p, i) => (
            <motion.div key={p.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
              <GlassCard>
                <div style={{ width: 46, height: 46, borderRadius: 16, display: 'grid', placeItems: 'center', background: `${p.color}30`, color: p.color, marginBottom: 14 }}>{p.icon}</div>
                <h3 style={{ fontSize: 19 }}>{p.title}</h3>
                <p className="muted" style={{ marginTop: 8, fontSize: 13.5 }}>{p.text}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
        <div className="grid cols-2 section-gap">
          <GlassCard title="Built for engineering trust" icon={<ShieldCheck size={14} />}>
            <p className="muted" style={{ fontSize: 13.5 }}>
              IRIS is inspection decision support — not a replacement for railway expertise. Every event
              carries image evidence, sensor summaries, confidence and localization uncertainty, and every
              critical action passes through human verification.
            </p>
          </GlassCard>
          <GlassCard title="Edge-first by design" icon={<Route size={14} />}>
            <p className="muted" style={{ fontSize: 13.5 }}>
              Detection runs on the rover itself. Only structured events and evidence thumbnails leave the
              edge — the system keeps working through weak links, buffers offline, and re-syncs when the
              network returns.
            </p>
          </GlassCard>
        </div>
      </div>

      <footer style={{ borderTop: `1px solid ${C.line}`, marginTop: 40, padding: '30px 24px' }}>
        <div className="page spread" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="row" style={{ gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill={C.lavender} /><circle cx="32" cy="32" r="13" fill={C.mint} /><circle cx="32" cy="32" r="5" fill={C.ink} /><rect x="8" y="46" width="48" height="5" rx="2.5" fill={C.ink} /></svg>
            <b className="display">IRIS</b>
            <span className="muted" style={{ fontSize: 13 }}>Intelligent Railtrack Inspection System · prototype v1.0</span>
          </div>
          <span className="muted" style={{ fontSize: 12.5 }}>Detect. Localize. Fuse. Prioritize. Track.</span>
        </div>
      </footer>
    </div>
  )
}
