import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Battery, Gauge, Radio, Thermometer, Camera, Play, Pause, OctagonX, RotateCcw, Satellite, HardDrive, Cpu } from 'lucide-react'
import { GlassCard } from '../components.jsx'
import { C, usePoll, get, post, titleCase } from '../lib.js'
import { RoverModel } from '../three.jsx'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

function MiniRover() {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [2.6, 1.9, 3.2], fov: 42 }} style={{ height: 170 }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 6, 3]} intensity={1.2} />
      <group>
        {/* ground + rails so the rover reads as riding a track */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
          <circleGeometry args={[6, 40]} />
          <meshStandardMaterial color="#EFE9E0" roughness={1} />
        </mesh>
        {[-0.55, 0.55].map((x) => (
          <mesh key={x} position={[x, 0.03, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 2.6, 10]} />
            <meshStandardMaterial color="#8B8795" roughness={0.35} metalness={0.5} />
          </mesh>
        ))}
        <RoverModel />
      </group>
      <OrbitControls enablePan={false} minPolarAngle={0.9} maxPolarAngle={1.5} enableZoom={false} target={[0, 0.25, 0]} />
    </Canvas>
  )
}

const STATUS_STYLE = {
  mission: { bg: 'rgba(127,216,190,.22)', color: '#2E9C7C' },
  paused: { bg: 'rgba(255,217,125,.28)', color: '#A07A10' },
  charging: { bg: 'rgba(142,202,230,.25)', color: '#33749A' },
  standby: { bg: 'rgba(46,42,59,.06)', color: C.muted },
  maintenance: { bg: 'rgba(167,156,240,.18)', color: '#7A66D8' },
  safe_stop: { bg: 'rgba(224,96,140,.18)', color: '#C04B74' },
}

export default function Fleet() {
  const rovers = usePoll(() => get('/rovers'), 2500)
  const [busy, setBusy] = useState(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const [flash, setFlash] = useState(null)

  const send = async (id, action) => {
    setBusy(action)
    try {
      await post(`/rovers/${id}/command`, { action })
      setFlash(`${action.replace(/_/g, ' ')} sent to ${id}`)
      setTimeout(() => setFlash(null), 2600)
    } catch { /* noop */ }
    finally { setBusy(null); setConfirmStop(false) }
  }

  return (
    <div className="page wide">
      <h1 className="page-title">Rover Fleet</h1>
      <p className="page-sub">Live telemetry, mission controls and health — with a guarded safe-stop.</p>

      <AnimatePresence>
        {flash && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="glass" style={{ marginTop: 18, background: 'rgba(127,216,190,.25)', padding: '12px 18px', borderRadius: 16, fontWeight: 600 }}>
            {flash}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid section-gap" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))' }}>
        {(rovers || []).map((r, idx) => {
          const st = STATUS_STYLE[r.status] || STATUS_STYLE.standby
          const live = r.status === 'mission'
          return (
            <GlassCard key={r.id} hover={false}>
              <div className="spread">
                <div className="row" style={{ gap: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 16, display: 'grid', placeItems: 'center', background: `${C.lavender}30`, color: C.lavender }}>
                    <Bot size={22} />
                  </div>
                  <div>
                    <b style={{ fontSize: 16 }}>{r.name}</b>
                    <div className="muted mono" style={{ fontSize: 12 }}>{r.id} · fw {r.firmware}</div>
                  </div>
                </div>
                <span className={`badge ${live ? 'pulse' : ''}`} style={st}>{titleCase(r.status)}</span>
              </div>

              {idx === 0 && <div style={{ margin: '14px -4px 4px' }}><MiniRover /></div>}

              <div className="grid cols-2" style={{ gap: 10, marginTop: 14 }}>
                {[[Battery, 'Battery', `${r.battery?.toFixed?.(0) ?? '—'}%`, r.battery < 30 ? C.rose : C.mint],
                  [Gauge, 'Speed', `${r.speed_mps} m/s`, C.sky],
                  [Radio, 'Link', `${r.signal_dbm} dBm`, r.signal_dbm < -85 ? C.rose : C.butter],
                  [Thermometer, 'Temperature', `${r.temp_c}°C`, C.peach]].map(([Icon, l, v, c]) => (
                  <div key={l} className="glass" style={{ padding: 10, borderRadius: 14, background: 'rgba(255,255,255,.55)' }}>
                    <div className="row muted" style={{ gap: 6, fontSize: 11.5 }}><Icon size={13} style={{ color: c }} />{l}</div>
                    <b className="mono" style={{ fontSize: 14, marginTop: 3 }}>{v}</b>
                  </div>
                ))}
              </div>

              <div className="stack" style={{ marginTop: 14, gap: 7, fontSize: 12.5 }}>
                <div className="spread"><span className="muted row" style={{ gap: 6 }}><Camera size={13} /> Camera</span><b>{r.camera_on ? 'on' : 'off'}</b></div>
                <div className="spread"><span className="muted row" style={{ gap: 6 }}><Satellite size={13} /> GNSS</span><b>{r.health?.gnss}</b></div>
                <div className="spread"><span className="muted row" style={{ gap: 6 }}><Cpu size={13} /> Compute</span><b>{r.health?.compute}</b></div>
                <div className="spread"><span className="muted row" style={{ gap: 6 }}><HardDrive size={13} /> Storage</span><b>{r.health?.storage}</b></div>
                {r.zone && <div className="spread"><span className="muted row" style={{ gap: 6 }}><Gauge size={13} /> Zone</span><b>{r.zone}</b></div>}
              </div>

              {r.mission_progress_pct > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="spread" style={{ fontSize: 12 }}><span className="muted">Mission progress</span><b className="mono">{r.mission_progress_pct}%</b></div>
                  <div style={{ height: 8, borderRadius: 99, background: 'rgba(46,42,59,.08)', marginTop: 6 }}>
                    <div style={{ width: `${r.mission_progress_pct}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${C.mint}, ${C.lavender})` }} />
                  </div>
                </div>
              )}

              {r.id === 'IRIS-R1' && (
                <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                  <button className="btn primary sm" disabled={busy || r.status === 'mission'} onClick={() => send(r.id, 'start')}>
                    <Play size={13} /> Start
                  </button>
                  <button className="btn glass sm" disabled={busy || r.status !== 'mission'} onClick={() => send(r.id, 'pause')}>
                    <Pause size={13} /> Pause
                  </button>
                  <button className="btn glass sm" disabled={busy || r.status !== 'paused'} onClick={() => send(r.id, 'resume')}>
                    <RotateCcw size={13} /> Resume
                  </button>
                  <button className="btn danger sm" disabled={busy || r.status === 'safe_stop'} onClick={() => setConfirmStop(true)}>
                    <OctagonX size={13} /> Safe Stop
                  </button>
                </div>
              )}
            </GlassCard>
          )
        })}
      </div>

      <AnimatePresence>
        {confirmStop && (
          <>
            <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmStop(false)} />
            <motion.div initial={{ opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .94 }}
              className="glass" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1400, width: 380, textAlign: 'center' }}>
              <div style={{ width: 54, height: 54, margin: '0 auto 12px', borderRadius: 18, display: 'grid', placeItems: 'center', background: 'rgba(224,96,140,.15)', color: C.rose }}>
                <OctagonX size={26} />
              </div>
              <h3 style={{ fontSize: 19 }}>Safe-stop IRIS-R1?</h3>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>
                The rover will halt immediately and hold, awaiting operator instruction. This is the fail-safe action.
              </p>
              <div className="row" style={{ justifyContent: 'center', marginTop: 18, gap: 10 }}>
                <button className="btn glass" onClick={() => setConfirmStop(false)}>Cancel</button>
                <button className="btn danger" disabled={busy} onClick={() => send('IRIS-R1', 'safe_stop')}>
                  <OctagonX size={15} /> Confirm safe-stop
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
