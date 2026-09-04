import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Gauge, Battery, Radio, Satellite, Layers, Route, ScanEye, Activity, Pause, Play, RotateCcw, OctagonX, Compass } from 'lucide-react'
import { SeverityBadge, ClassBadge, DefectDrawer } from '../components.jsx'
import { C, SEV, CLASS_LABEL, usePoll, get, useEvents, patch, post, fmt, titleCase } from '../lib.js'

function roverIcon(heading, status) {
  const col = status === 'safe_stop' ? C.rose : status === 'paused' ? C.butter : C.mint
  return L.divIcon({
    className: '',
    html: `<div class="rover-pin" style="color:${col}">
      <div style="position:absolute;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:14px solid ${col};transform:rotate(${heading}deg);transform-origin:50% 50%;margin-top:-4px;opacity:.95"></div>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="position:relative;z-index:1"><circle cx="12" cy="12" r="8.5"/></svg>
    </div>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
  })
}
function pinIcon(sev) {
  const s = SEV[sev] || SEV.low
  const stroke = sev === 'critical' ? '<path d="M12 3v5M12 16v5M3 12h5M16 12h5"/><circle cx="12" cy="12" r="4.5"/>' : '<path d="M12 22s-7-6.4-7-11.2a7 7 0 1 1 14 0C19 15.6 12 22 12 22z"/><circle cx="12" cy="10.6" r="2.6" fill="white"/>'
  return L.divIcon({ className: '', html: `<div class="iris-pin ${sev === 'critical' ? 'pulse' : ''}" style="background:${s.color};width:30px;height:30px;border-width:2.5px"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" class="pin-ico">${stroke}</svg></div>`, iconSize: [30, 30], iconAnchor: [15, 26] })
}
function FollowRover({ pos }) {
  const map = useMap()
  const last = useRef(null)
  useEffect(() => {
    if (!pos) return
    const key = `${pos.lat.toFixed(5)},${pos.lng.toFixed(5)}`
    if (key === last.current) return
    last.current = key
    map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.9 })
  }, [pos])
  return null
}
// animated dash along the patrol route — the "loop in motion" feel
function AnimatedPatrol({ positions }) {
  const ref = useRef()
  useEffect(() => {
    let raf
    const step = () => {
      if (ref.current?._path) {
        const off = (parseFloat(ref.current._path.style.strokeDashoffset || 0) || 0) - 0.6
        ref.current._path.style.strokeDashoffset = String(off)
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (!positions?.length) return null
  return <Polyline ref={ref} positions={positions} pathOptions={{ color: '#2E9C7C', weight: 4, opacity: 0.95, dashArray: '14 12', lineCap: 'round' }} />
}

export default function MapPage() {
  const [params, setParams] = useSearchParams()
  const track = usePoll(() => get('/track'), 30000)
  const events = usePoll(() => get('/events?limit=300'), 6000)
  const vision = usePoll(() => get('/vision/latest'), 4000)
  const [rover, setRover] = useState(null)
  const [trail, setTrail] = useState([])
  const [ticker, setTicker] = useState([])
  const [selected, setSelected] = useState(null)
  const [deepLink, setDeepLink] = useState(params.get('event'))
  const [layers, setLayers] = useState({ track: true, patrol: true, defects: true, zones: true, stations: true })
  const [busy, setBusy] = useState(false)

  useEvents((msg) => {
    if (msg.type === 'rover_telemetry') {
      const r = msg.payload
      setRover(r)
      if (r.lat != null) {
        setTrail((t) => {
          const next = [...t, [r.lat, r.lng]]
          if (next.length > 1) {
            const [a, b] = [next[next.length - 2], next[next.length - 1]]
            if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) next.pop()
          }
          return next.length > 240 ? next.slice(-240) : next
        })
      }
    }
    if (msg.type === 'event_created') setTicker((s) => [msg.payload, ...s].slice(0, 6))
    if (msg.type === 'rover_event') setTicker((s) => [{ id: Date.now(), kind: msg.payload.kind, message: msg.payload.message || `Lap ${msg.payload.lap} complete — patrol continuing` }, ...s].slice(0, 6))
  })

  // deep-link: open a specific event from ?event=EV-…
  useEffect(() => {
    if (!deepLink || !events?.events) return
    const ev = events.events.find((e) => e.id === deepLink)
    if (ev) { setSelected(ev); setDeepLink(null); params.delete('event'); setParams(params, { replace: true }) }
  }, [deepLink, events])

  const allEvents = events?.events || []
  const defectEvents = useMemo(
    () => allEvents.filter((e) => !['resolved', 'dismissed'].includes(e.status)),
    [allEvents])

  const onStatus = async (st) => {
    setBusy(true)
    try {
      const updated = await patch(`/events/${selected.id}/status`, { status: st, actor: 'operator', note: '' })
      setSelected(updated)
    } finally { setBusy(false) }
  }
  const send = async (action) => { setBusy(action); try { await post('/rovers/IRIS-R1/command', { action }) } finally { setBusy(null) } }

  if (!track?.points?.length) return <div className="page"><div className="skeleton" style={{ height: '70vh' }} /></div>

  const patrol = track.patrol
  const pointAt = (m) => Math.floor(m / 30)
  const zonePts = track.zones.map((z) => ({ name: z.name, pts: track.points.slice(pointAt(z.start_m), pointAt(z.end_m) + 1) }))
  const patrolPts = track.points.slice(pointAt(patrol.start_m), pointAt(patrol.end_m) + 1)

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <MapContainer center={[18.755, 73.34]} zoom={11} style={{ height: '100%', width: '100%' }} attributionControl={true}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>' />
        {layers.zones && zonePts.map((z) => (
          <Polyline key={z.name} positions={z.pts} pathOptions={{ color: C.lavender, weight: 7, opacity: 0.16 }} />
        ))}
        {layers.track && <Polyline positions={track.points} pathOptions={{ color: '#8A77E8', weight: 3.5, opacity: 0.9 }} />}
        {layers.patrol && patrolPts.length > 1 && <AnimatedPatrol positions={patrolPts} />}
        {trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: '#4FBFA4', weight: 5, opacity: 0.75 }} />}
        {layers.stations && track.stations.map((s) => (
          <CircleMarker key={s.name} center={[s.lat, s.lng]} radius={5} pathOptions={{ color: C.ink, weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -6]}><b>{s.name}</b></Tooltip>
          </CircleMarker>
        ))}
        {layers.defects && defectEvents.map((e) => (
          <Marker key={e.id} position={[e.lat, e.lng]} icon={pinIcon(e.severity)} eventHandlers={{ click: () => setSelected(e) }}>
            <Tooltip direction="top" offset={[0, -10]}>
              <b>{CLASS_LABEL[e.class] || titleCase(e.class)}</b> · risk {e.risk_score}<br />
              <span className="muted">{fmt.km(e.chainage_m)} · {fmt.age(e.ts)}</span>
            </Tooltip>
          </Marker>
        ))}
        {rover?.lat && <Marker position={[rover.lat, rover.lng]} icon={roverIcon(rover.heading_deg ?? 0, rover.status)} zIndexOffset={1000} />}
        <FollowRover pos={rover ? { lat: rover.lat, lng: rover.lng } : null} />
      </MapContainer>

      {/* left control panel */}
      <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .5, delay: .15 }}
        className="glass" style={{ position: 'absolute', top: 92, left: 20, width: 300, zIndex: 1100, maxHeight: 'calc(100vh - 130px)', overflowY: 'auto' }}>
        <div className="spread">
          <div className="card-title" style={{ marginBottom: 0 }}>Mission — Ghat Patrol</div>
          <span className="badge" style={{ background: 'rgba(127,216,190,.22)', color: '#2E9C7C' }}>
            {rover?.direction === -1 ? '◀ return leg' : 'outbound ▶'}
          </span>
        </div>
        {rover && (
          <div className="stack" style={{ gap: 12, marginTop: 12 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge" style={{ background: 'rgba(127,216,190,.22)', color: '#2E9C7C' }}><Bot size={13} /> {titleCase(rover.status)}</span>
              <span className="badge" style={{ background: 'rgba(167,156,240,.15)', color: '#7A66D8' }}><Route size={13} /> {fmt.km(rover.chainage_m)}</span>
            </div>
            {[
              [Gauge, 'Ground speed', `${rover.speed_mps} m/s`],
              [Compass, 'Heading', `${Math.round(rover.heading_deg ?? 0)}°`],
              [Battery, 'Battery', `${rover.battery.toFixed(0)}%`],
              [Radio, 'Link', `${rover.signal_dbm} dBm`],
              [Satellite, 'Position uncertainty', `±${rover.uncertainty_m} m`],
              [Activity, 'Camera frame', `${vision?.frame_id ?? '—'}`],
            ].map(([Icon, l, v]) => (
              <div key={l} className="spread" style={{ fontSize: 13 }}>
                <span className="row muted" style={{ gap: 7 }}><Icon size={14} />{l}</span>
                <b className="mono">{v}</b>
              </div>
            ))}
            <div>
              <div className="spread" style={{ fontSize: 12.5 }}><span className="muted">Patrol progress</span><span className="mono">{rover.mission_progress_pct}%</span></div>
              <div style={{ height: 8, borderRadius: 99, background: 'rgba(46,42,59,.08)', marginTop: 6 }}>
                <div style={{ width: `${rover.mission_progress_pct}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${C.mint}, ${C.lavender})` }} />
              </div>
            </div>

            <div className="row" style={{ gap: 7, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
              <button className="btn primary sm" disabled={busy || rover.status === 'mission'} onClick={() => send('start')}><Play size={13} /> Start</button>
              <button className="btn glass sm" disabled={busy || rover.status !== 'mission'} onClick={() => send('pause')}><Pause size={13} /> Pause</button>
              <button className="btn glass sm" disabled={busy || rover.status !== 'paused'} onClick={() => send('resume')}><RotateCcw size={13} /> Resume</button>
              <button className="btn danger sm" disabled={busy || rover.status === 'safe_stop'} onClick={() => send('safe_stop')}><OctagonX size={13} /></button>
            </div>

            {vision?.detections?.length > 0 && (
              <div className="glass" style={{ background: 'rgba(255,255,255,.65)', padding: 12, borderRadius: 16 }}>
                <div className="row" style={{ fontSize: 12.5 }}><ScanEye size={14} style={{ color: C.lavender }} /><b>Latest vision detection</b></div>
                {vision.detections.map((d, i) => (
                  <div key={i} className="row" style={{ fontSize: 12, marginTop: 6 }}>
                    <ClassBadge cls={d.class} />
                    <span className="mono muted" style={{ marginLeft: 'auto' }}>{fmt.pct(d.confidence)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="card-title" style={{ marginTop: 16 }}>Layers</div>
        <div className="row wrap" style={{ gap: 8 }}>
          {Object.entries(layers).map(([k, on]) => (
            <button key={k} className={`chip ${on ? 'on' : ''}`} onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}>
              <Layers size={12} /> {titleCase(k)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* live ticker */}
      <div className="glass" style={{ position: 'absolute', bottom: 24, left: 20, width: 300, zIndex: 1100 }}>
        <div className="card-title">Live event ticker</div>
        <AnimatePresence>
          {ticker.length === 0 && <div className="muted" style={{ fontSize: 12.5 }}>Waiting for edge detections…</div>}
          {ticker.map((e) => (
            <motion.div key={e.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="ticker-item" onClick={() => e.class && setSelected(e)}>
              {e.class ? (
                <>
                  <span className="status-dot pulse" style={{ background: SEV[e.severity]?.color, marginTop: 5, flex: 'none' }} />
                  <div style={{ fontSize: 12.5 }}>
                    <b>{CLASS_LABEL[e.class] || titleCase(e.class)}</b> — {fmt.km(e.chainage_m)}
                    <div className="muted" style={{ fontSize: 11.5 }}>risk {e.risk_score} · {e.severity}</div>
                  </div>
                </>
              ) : (
                <div className="row" style={{ fontSize: 12.5, gap: 8 }}>
                  <RotateCcw size={13} style={{ color: C.lavender, flex: 'none' }} />
                  <span className="muted">{e.message}</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selected && <DefectDrawer event={selected} onClose={() => setSelected(null)} onStatus={onStatus} busy={busy} />}
      </AnimatePresence>
    </div>
  )
}
