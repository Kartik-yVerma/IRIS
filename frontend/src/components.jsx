import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  LayoutDashboard, Map as MapIcon, ScanEye, ClipboardList, BarChart3,
  Bot, Activity, AlertTriangle, Siren, Info, AlertOctagon, CheckCircle2,
  X, Clock, Gauge, Battery, Radio, Thermometer, Satellite, WifiOff, Play,
  Pause, OctagonX, ChevronRight, CircleDollarSign, Route, Zap,
} from 'lucide-react'
import { C, SEV, SEV_ORDER, CLASS_LABEL, CLASS_COLOR, STATUS_FLOW, fmt, titleCase } from './lib.js'

// ---------------------------------------------------------------- GlassCard
export function GlassCard({ title, icon, children, className = '', hover = true, style }) {
  return (
    <div className={`glass ${hover ? 'hover' : ''} ${className}`} style={style}>
      {(title || icon) && (
        <div className="card-title row" style={{ gap: 8 }}>
          {icon}
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------- KpiCard
export function KpiCard({ label, value, sub, icon, accent, spark = [] }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const target = typeof value === 'number' ? value : parseFloat(value) || 0
    let raf
    const t0 = performance.now()
    const dur = 900
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur)
      setN(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  const display = typeof value === 'number'
    ? (Number.isInteger(value) ? Math.round(n).toLocaleString() : n.toFixed(value < 10 ? 2 : 1))
    : value
  return (
    <GlassCard className="kpi" hover={false}>
      <div className="spread">
        <div className="row" style={{ gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, display: 'grid', placeItems: 'center', background: `${accent}30`, color: accent === C.ink ? '#fff' : accent }}>
            {icon}
          </div>
          {sub && <span className="delta" style={{ background: `${accent}22`, color: accent }}>{sub}</span>}
        </div>
        {spark.length > 1 && <Sparkline data={spark} color={accent} />}
      </div>
      <div className="kpi-num mono" style={{ marginTop: 14 }}>{display}</div>
      <div className="kpi-label">{label}</div>
    </GlassCard>
  )
}

// ---------------------------------------------------------------- Sparkline
export function Sparkline({ data, color = C.lavender, w = 74, h = 30 }) {
  const min = Math.min(...data), max = Math.max(...data)
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 3 - ((v - min) / (max - min || 1)) * (h - 6),
  ])
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')
  const area = d + ` L${w},${h} L0,${h} Z`
  return (
    <svg width={w} height={h} aria-hidden>
      <path d={area} fill={`${color}26`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ---------------------------------------------------------------- badges
export function SeverityBadge({ severity }) {
  const s = SEV[severity] || SEV.low
  const Icon = severity === 'critical' ? Siren : severity === 'high' ? AlertOctagon : severity === 'medium' ? AlertTriangle : Info
  return (
    <span className="badge" style={{ background: s.tint, color: s.color }}>
      <Icon size={13} /> {s.label}
    </span>
  )
}
export function StatusBadge({ status }) {
  const done = status === 'resolved'
  const off = status === 'dismissed'
  return (
    <span className="badge" style={{ background: done ? 'rgba(127,216,190,.25)' : off ? 'rgba(46,42,59,.08)' : 'rgba(167,156,240,.18)', color: done ? '#2E9C7C' : off ? C.muted : '#7A66D8' }}>
      {done ? <CheckCircle2 size={13} /> : <Activity size={13} />} {titleCase(status)}
    </span>
  )
}
export function ClassBadge({ cls }) {
  return (
    <span className="badge" style={{ background: `${CLASS_COLOR[cls]}22`, color: CLASS_COLOR[cls] }}>
      <span className="status-dot" style={{ background: CLASS_COLOR[cls] }} /> {CLASS_LABEL[cls] || titleCase(cls)}
    </span>
  )
}

// ---------------------------------------------------------------- Navbar
const NAV = [
  { to: '/', label: 'Home', icon: null, home: true },
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
  { to: '/map', label: 'Mission Map', icon: <MapIcon size={15} /> },
  { to: '/vision', label: 'Vision Lab', icon: <ScanEye size={15} /> },
  { to: '/defects', label: 'Defects', icon: <ClipboardList size={15} /> },
  { to: '/analytics', label: 'Analytics', icon: <BarChart3 size={15} /> },
  { to: '/fleet', label: 'Fleet', icon: <Bot size={15} /> },
]
export function Navbar() {
  const { pathname } = useLocation()
  return (
    <nav className="nav">
      <Link to="/" className="brand">
        <svg width="26" height="26" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill={C.lavender} />
          <circle cx="32" cy="32" r="13" fill={C.mint} />
          <circle cx="32" cy="32" r="5" fill={C.ink} />
          <rect x="8" y="46" width="48" height="5" rx="2.5" fill={C.ink} />
        </svg>
        IRIS
      </Link>
      {NAV.filter((n) => !n.home).map((n) => {
        const active = pathname.startsWith(n.to)
        return (
          <Link key={n.to} to={n.to} className={active ? 'active' : ''}>
            {active && <motion.span className="pill" layoutId="navpill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            {n.icon}
            <span style={{ position: 'relative', zIndex: 1 }}>{n.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

// -------------------------------------------------------- morph transition
const SHAPES = {
  '/': 'M0,0 C80,60 40,140 160,160 C260,176 300,80 420,90 C540,100 560,220 720,180 C880,140 860,40 1000,40 C1140,40 1180,140 1300,120 C1420,100 1440,20 1440,0 Z',
  default: 'M720,900 C500,860 300,700 240,480 C180,260 340,80 620,60 C900,40 1180,140 1260,380 C1340,620 1200,820 920,880 Z',
}
export function MorphTransition() {
  const { pathname } = useLocation()
  const [shape, setShape] = useState(SHAPES[pathname] || SHAPES.default)
  const [covering, setCovering] = useState(false)
  useEffect(() => {
    setCovering(true)
    const t1 = setTimeout(() => {
      setShape(SHAPES[pathname] || SHAPES.default)
      const t2 = setTimeout(() => setCovering(false), 380)
      return () => clearTimeout(t2)
    }, 140)
    return () => clearTimeout(t1)
  }, [pathname])
  return (
    <AnimatePresence>
      {covering && (
        <motion.div
          className="morph-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          key={pathname}
        >
          <svg width="100vw" height="100vh" viewBox="0 0 1440 900" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <linearGradient id="morphg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={C.mint} />
                <stop offset="55%" stopColor={C.lavender} />
                <stop offset="100%" stopColor={C.peach} />
              </linearGradient>
            </defs>
            <motion.path
              d={shape}
              fill="url(#morphg)"
              initial={false}
              animate={{ scale: [1, 3.4, 3.4, 0.1], rotate: [0, 8, 8, 0], opacity: [0.9, 1, 1, 0] }}
              transition={{ duration: 0.72, times: [0, 0.22, 0.78, 1], ease: 'easeInOut' }}
              style={{ originX: '720px', originY: '450px' }}
            />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------- alerts
export function AlertStack({ alerts, onOpen }) {
  return (
    <div className="alert-stack" role="log" aria-live="polite">
      <AnimatePresence>
        {alerts.map((a) => (
          <motion.div
            key={a.id + a.kind}
            className="alert-toast"
            initial={{ opacity: 0, x: 60, scale: .95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            onClick={() => onOpen(a)}
          >
            {a.severity === 'critical' || a.kind === 'health'
              ? <AlertTriangle size={20} style={{ color: C.rose, flex: 'none' }} />
              : <Siren size={20} style={{ color: SEV.high.color, flex: 'none' }} />}
            <div style={{ fontSize: 13 }}>
              <b>{a.title}</b>
              <div className="muted" style={{ fontSize: 12 }}>{a.message}</div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------- drawer
export function DefectDrawer({ event, onClose, onStatus, busy }) {
  const nav = useNavigate()
  if (!event) return null
  const e = event
  const s = SEV[e.severity] || SEV.low
  return (
    <>
      <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div className="drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
        <div className="spread" style={{ marginBottom: 18 }}>
          <div>
            <div className="row" style={{ gap: 8 }}>
              <ClassBadge cls={e.class} />
              <SeverityBadge severity={e.severity} />
              <StatusBadge status={e.status} />
            </div>
            <h2 style={{ fontSize: 20, marginTop: 10 }}>{e.id}</h2>
          </div>
          <button className="btn glass sm" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="glass" style={{ padding: 10, marginBottom: 16 }}>
          <div className="muted" style={{ fontSize: 11.5, margin: '2px 6px 8px' }}>
            Real-world reference — {CLASS_LABEL[e.class] || titleCase(e.class)}
          </div>
          <EvidenceImg cls={e.class} fallback={`/api/events/${e.id}/image`} />
          <div className="muted" style={{ fontSize: 11.5, margin: '10px 6px 8px' }}>
            Rover camera frame — edge-vision annotation
          </div>
          <img src={`/api/events/${e.id}/image`} alt="Annotated rover camera frame"
            style={{ width: '100%', borderRadius: 14, display: 'block' }} />
        </div>

        <div className="grid cols-2" style={{ marginBottom: 16 }}>
          <MiniStat icon={<Route size={14} />} label="Chainage" value={fmt.km(e.chainage_m)} />
          <MiniStat icon={<MapIcon size={14} />} label="Zone" value={e.zone} />
          <MiniStat icon={<Clock size={14} />} label="Detected" value={fmt.age(e.ts)} />
          <MiniStat icon={<Satellite size={14} />} label="Pos. uncertainty" value={`±${e.uncertainty_m} m`} />
          <MiniStat icon={<Zap size={14} />} label="Confidence" value={fmt.pct(e.confidence)} />
          <MiniStat icon={<Activity size={14} />} label="Fused score" value={e.fused_score.toFixed(2)} />
          <MiniStat icon={<Gauge size={14} />} label="Risk score" value={String(e.risk_score)} accent={fmt.riskTone(e.risk_score)} />
          <MiniStat icon={<Info size={14} />} label="Recurrence" value={`${e.recurrence}× · ${titleCase(e.trend)}`} />
        </div>

        {e.sensor && (
          <GlassCard title="Sensor evidence" icon={<Activity size={14} />} hover={false}>
            <div className="stack" style={{ gap: 10 }}>
              {[['Visual', e.sensor.visual?.score, e.sensor.visual?.quality],
                ['Vibration', e.sensor.vibration?.score, e.sensor.vibration?.anomaly ? 'anomaly' : 'normal'],
                ['Position', e.sensor.position?.consistency, `±${e.sensor.position?.uncertainty_m ?? '?'} m`]].map(([label, v, q]) => (
                <div key={label}>
                  <div className="spread" style={{ fontSize: 12 }}>
                    <span className="muted">{label}</span>
                    <span className="mono">{typeof v === 'number' ? v.toFixed(2) : v}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: 'rgba(46,42,59,.08)', marginTop: 4 }}>
                    <div style={{ width: `${(Number(v) || 0) * 100}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${C.mint}, ${C.lavender})` }} />
                  </div>
                  <div style={{ fontSize: 11 }} className="muted">{q}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        <div style={{ marginTop: 16 }}>
          <div className="card-title">Workflow — verify &amp; act</div>
          <div className="row wrap" style={{ gap: 8 }}>
            {STATUS_FLOW.filter((st) => st !== e.status && st !== 'open').map((st) => (
              <button key={st} className="btn glass sm" disabled={busy} onClick={() => onStatus(st)}>
                {titleCase(st)}
              </button>
            ))}
            {e.status !== 'dismissed' && (
              <button className="btn ghost sm" disabled={busy} onClick={() => onStatus('dismissed')}>Dismiss</button>
            )}
          </div>
        </div>

        {e.history?.length > 1 && (
          <div style={{ marginTop: 18 }}>
            <div className="card-title">History</div>
            <div className="stack">
              {[...e.history].reverse().map((h, i) => (
                <div key={i} className="row" style={{ fontSize: 12.5 }}>
                  <span className="status-dot" style={{ background: C.lavender }} />
                  <span><b>{titleCase(h.status)}</b> · {h.actor}</span>
                  <span className="muted" style={{ marginLeft: 'auto' }}>{fmt.age(h.ts)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </>
  )
}
function EvidenceImg({ cls, fallback }) {
  return (
    <img
      src={`/api/evidence/${cls}`}
      alt="Real-world reference"
      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallback }}
      style={{ width: '100%', borderRadius: 14, display: 'block', maxHeight: 300, objectFit: 'cover' }}
    />
  )
}

function MiniStat({ icon, label, value, accent }) {
  return (
    <div className="glass" style={{ padding: 12 }}>
      <div className="row" style={{ gap: 7, fontSize: 11.5, color: C.muted }}>
        {icon}{label}
      </div>
      <div className="mono" style={{ fontWeight: 700, fontSize: 14, marginTop: 4, color: accent }}>{value}</div>
    </div>
  )
}

// ---------------------------------------------------------------- mini map
function FlyTo({ pos, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (pos) map.flyTo(pos, zoom ?? map.getZoom(), { duration: 0.8 })
  }, [pos?.[0], pos?.[1]])
  return null
}
const roverIcon = L.divIcon({ className: '', html: '<div class="rover-pin"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="8" rx="3"/><circle cx="8.5" cy="19" r="1.6"/><circle cx="15.5" cy="19" r="1.6"/><path d="M8 10V7h8v3"/></svg></div>', iconSize: [30, 30], iconAnchor: [15, 15] })
function pinIcon(sev) {
  const s = SEV[sev] || SEV.low
  const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="pin-ico">${sev === 'critical' ? '<path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="5"/>' : '<path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5" fill="white"/></svg>'}`
  return L.divIcon({ className: '', html: `<div class="iris-pin ${sev === 'critical' ? 'pulse' : ''}" style="background:${s.color};width:26px;height:26px">${svg}</div>`, iconSize: [26, 26], iconAnchor: [13, 24] })
}
export function MiniMap({ points, rover, events = [], height = 300, flyTo, onEvent, zoom = 11, patrolStart, patrolEnd }) {
  if (!points?.length) return <div className="skeleton" style={{ height }} />
  const center = rover ? [rover.lat, rover.lng] : points[Math.floor(points.length / 2)]
  return (
    <MapContainer center={center} zoom={zoom} style={{ height, width: '100%' }} scrollWheelZoom={false} attributionControl={true}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>' />
      <Polyline positions={points} pathOptions={{ color: C.lavender, weight: 4, opacity: .85 }} />
      {patrolStart != null && patrolEnd != null && (() => {
        const seg = points.filter((p, i) => i >= patrolStart && i <= patrolEnd)
        return seg.length > 1 ? <Polyline positions={seg} pathOptions={{ color: C.mint, weight: 6, opacity: .95 }} /> : null
      })()}
      {rover && <Marker position={[rover.lat, rover.lng]} icon={roverIcon} />}
      {events.map((e) => (
        <Marker key={e.id} position={[e.lat, e.lng]} icon={pinIcon(e.severity)} eventHandlers={{ click: () => onEvent?.(e) }}>
          <Popup>
            <b>{CLASS_LABEL[e.class] || titleCase(e.class)}</b><br />
            <SeverityBadge severity={e.severity} /> · risk {e.risk_score}<br />
            <span className="muted">{fmt.km(e.chainage_m)} · {fmt.age(e.ts)}</span>
          </Popup>
        </Marker>
      ))}
      <FlyTo pos={flyTo} zoom={zoom} />
    </MapContainer>
  )
}
