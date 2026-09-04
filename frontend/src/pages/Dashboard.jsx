import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Route, ClipboardList, Siren, ShieldCheck, Bot, ScanEye, ChevronRight, AlertTriangle } from 'lucide-react'
import { GlassCard, KpiCard, ClassBadge, SeverityBadge, MiniMap, DefectDrawer } from '../components.jsx'
import { C, SEV, CLASS_LABEL, usePoll, get, useEvents, fmt, titleCase } from '../lib.js'

export default function Dashboard() {
  const nav = useNavigate()
  const [liveEvents, setLiveEvents] = useState([])
  const [alerts, setAlerts] = useState([])
  const [selected, setSelected] = useState(null)
  useEvents((msg) => {
    if (msg.type === 'event_created') setLiveEvents((s) => [msg.payload, ...s].slice(0, 8))
    if (msg.type === 'alert') setAlerts((s) => [{ ...msg.payload, kind: 'alert', title: `${CLASS_LABEL[msg.payload.class] || titleCase(msg.payload.class)} — ${msg.payload.severity}`, message: `Chainage ${fmt.km(msg.payload.chainage_m)} · tap to open` }, ...s].slice(0, 4))
    if (msg.type === 'health_flag') setAlerts((s) => [{ ...msg.payload, kind: 'health', id: Date.now() + '', title: 'Rover health flag', message: msg.payload.message }, ...s].slice(0, 4))
  })
  const summary = usePoll(() => get('/analytics/summary'), 3000)
  const track = usePoll(() => get('/track'), 30000)
  const rovers = usePoll(() => get('/rovers'), 3000)
  const events = usePoll(() => get('/events?limit=80'), 5000)
  const mission = usePoll(() => get('/missions/current'), 3000)
  const zones = usePoll(() => get('/analytics/zones'), 10000)
  const rover = rovers?.[0]
  const allEvents = (events?.events || [])
  const openEvents = allEvents.filter((e) => !['resolved', 'dismissed'].includes(e.status))
  const recent = [...liveEvents.filter((l) => !allEvents.some((e) => e.id === l.id)), ...allEvents].slice(0, 7)
  const spark = zones?.data?.map((z) => z.health) || []
  const healthFlag = alerts.find((a) => a.kind === 'health')

  return (
    <div className="page wide">
      <div className="spread wrap">
        <div>
          <h1 className="page-title">Command Overview</h1>
          <p className="page-sub">Live inspection status across the corridor · updates every 3 s</p>
        </div>
        {rover && (
          <div className="row" style={{ gap: 8 }}>
            <span className={`badge ${rover.status === 'mission' ? 'pulse' : ''}`} style={{ background: rover.status === 'mission' ? 'rgba(127,216,190,.22)' : 'rgba(255,217,125,.28)', color: rover.status === 'mission' ? '#2E9C7C' : '#A07A10' }}>
              <Bot size={13} /> {titleCase(rover.status)}
            </span>
          </div>
        )}
      </div>

      {healthFlag && (
        <div className="glass section-gap" style={{ background: 'rgba(255,217,125,.25)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <AlertTriangle size={18} style={{ color: '#A07A10', flex: 'none' }} />
          <div style={{ fontSize: 13.5 }}><b>Degraded mode</b> — <span className="muted">{healthFlag.message}</span></div>
        </div>
      )}

      <div className="grid cols-4 section-gap">
        <KpiCard label="Track inspected today" value={summary?.inspected_today_km ?? 0} sub="live" icon={<Route size={18} />} accent={C.lavender} />
        <KpiCard label="Open defect events" value={summary?.open_events ?? 0} icon={<ClipboardList size={18} />} accent={C.sky} />
        <KpiCard label="Critical alerts" value={summary?.critical_open ?? 0} icon={<Siren size={18} />} accent={C.rose} />
        <KpiCard label="Model confidence (14 d avg)" value={summary?.avg_confidence ?? 0} sub="evidence" icon={<ShieldCheck size={18} />} accent={C.mint} />
      </div>

      <div className="grid cols-3 section-gap" style={{ gridTemplateColumns: '1.5fr 1fr 1fr', gap: 18 }}>
        {/* live map */}
        <GlassCard title="Live mission map" icon={<Route size={14} />} className="glass" hover={false} style={{ padding: 12 }}>
          <MiniMap
            points={track?.points || []}
            rover={rover?.lat ? rover : null}
            events={openEvents.slice(0, 60)}
            height={330}
            zoom={11}
            patrolStart={track?.patrol?.start_m ? Math.floor(track.patrol.start_m / 30) : null}
            patrolEnd={track?.patrol?.end_m ? Math.floor(track.patrol.end_m / 30) : null}
            onEvent={(e) => setSelected(e)}
          />
          <div className="row" style={{ marginTop: 10, fontSize: 12.5, color: C.muted }}>
            <span className="row" style={{ gap: 5 }}><span className="status-dot" style={{ background: C.lavender }} /> full route</span>
            <span className="row" style={{ gap: 5 }}><span className="status-dot" style={{ background: C.mint }} /> patrol zone</span>
            <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => nav('/map')}>Open Mission Map <ChevronRight size={14} /></button>
          </div>
        </GlassCard>

        {/* latest detections */}
        <GlassCard title="Latest detections" icon={<ScanEye size={14} />}>
          <div className="ticker" style={{ maxHeight: 330 }}>
            {recent.length === 0 && <div className="skeleton" style={{ height: 200 }} />}
            {recent.map((e) => (
              <div key={e.id} className="ticker-item" onClick={() => setSelected(e)}>
                <span className="status-dot" style={{ background: SEV[e.severity]?.color, marginTop: 5, flex: 'none' }} />
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 13 }}>{CLASS_LABEL[e.class] || titleCase(e.class)}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{fmt.km(e.chainage_m)} · {e.zone} · {fmt.age(e.ts)}</div>
                </div>
                <span className="mono muted" style={{ marginLeft: 'auto', fontSize: 12.5, flex: 'none' }}>risk {e.risk_score}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* zones + fleet */}
        <div className="stack" style={{ gap: 18 }}>
          <GlassCard title="Zone health" icon={<ShieldCheck size={14} />} hover={false}>
            {(zones?.data || []).map((z) => (
              <div key={z.zone} style={{ marginBottom: 12 }}>
                <div className="spread" style={{ fontSize: 12.5 }}>
                  <span>{z.zone}</span>
                  <span className="mono muted">{z.events_total} evt · {z.events_open} open</span>
                </div>
                <div style={{ height: 7, borderRadius: 99, background: 'rgba(46,42,59,.07)', marginTop: 5 }}>
                  <div style={{ width: `${z.health}%`, height: '100%', borderRadius: 99, background: z.health > 70 ? `linear-gradient(90deg, ${C.mint}, ${C.sky})` : z.health > 45 ? `linear-gradient(90deg, ${C.butter}, ${C.peach})` : C.rose }} />
                </div>
              </div>
            ))}
          </GlassCard>
          <GlassCard title="Fleet snapshot" icon={<Bot size={14} />} hover={false}>
            {(rovers || []).map((r) => (
              <div key={r.id} className="row" style={{ padding: '7px 0', fontSize: 13 }}>
                <span className="status-dot" style={{ background: r.status === 'mission' ? C.mint : r.status === 'safe_stop' ? C.rose : C.butter, flex: 'none' }} />
                <b>{r.name}</b>
                <span className="muted" style={{ marginLeft: 'auto' }}>{r.battery?.toFixed?.(0)}%</span>
                <button className="btn ghost sm" onClick={() => nav('/fleet')}>View</button>
              </div>
            ))}
          </GlassCard>
        </div>
      </div>

      <DefectDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
