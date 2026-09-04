import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Search, Filter } from 'lucide-react'
import { GlassCard, ClassBadge, SeverityBadge, StatusBadge, DefectDrawer } from '../components.jsx'
import { C, SEV_ORDER, CLASS_LABEL, usePoll, get, patch, fmt, titleCase } from '../lib.js'

const STATUSES = ['open', 'acknowledged', 'verified', 'assigned', 'in_repair', 'resolved', 'dismissed']

export default function Defects() {
  const [params, setParams] = useSearchParams()
  const events = usePoll(() => get('/events?limit=400'), 6000)
  const [filters, setFilters] = useState({ cls: '', severity: '', status: '', zone: '' })
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [deepLink, setDeepLink] = useState(params.get('event'))
  const [busy, setBusy] = useState(false)

  // deep-link: open a specific event from ?event=EV-…
  useEffect(() => {
    if (!deepLink || !events?.events) return
    const ev = events.events.find((e) => e.id === deepLink)
    if (ev) {
      setSelected(ev)
      setDeepLink(null)
      params.delete('event')
      setParams(params, { replace: true })
    }
  }, [deepLink, events])

  const list = useMemo(() => {
    let l = events?.events || []
    if (filters.cls) l = l.filter((e) => e.class === filters.cls)
    if (filters.severity) l = l.filter((e) => e.severity === filters.severity)
    if (filters.status) l = l.filter((e) => e.status === filters.status)
    if (filters.zone) l = l.filter((e) => e.zone === filters.zone)
    if (q) l = l.filter((e) => (e.id + e.zone + e.segment + e.class).toLowerCase().includes(q.toLowerCase()))
    return l
  }, [events, filters, q])

  const zones = useMemo(() => [...new Set((events?.events || []).map((e) => e.zone))], [events])

  const onStatus = async (st) => {
    setBusy(true)
    try {
      const updated = await patch(`/events/${selected.id}/status`, { status: st, actor: 'operator', note: '' })
      setSelected(updated)
    } finally { setBusy(false) }
  }

  return (
    <div className="page wide">
      <h1 className="page-title">Defect Registry</h1>
      <p className="page-sub">Every inspection event with evidence, risk and workflow — one physical defect, one record.</p>

      <GlassCard hover={false} className="section-gap" style={{ padding: 16 }}>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="row" style={{ flex: 1, minWidth: 220, background: 'rgba(46,42,59,.05)', borderRadius: 999, padding: '4px 14px' }}>
            <Search size={15} style={{ color: C.muted }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, zone, segment…"
              style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', padding: '7px 0', fontSize: 13.5 }} />
          </div>
          <Filter size={15} style={{ color: C.muted }} />
          <select className="chip" value={filters.cls} onChange={(e) => setFilters({ ...filters, cls: e.target.value })} style={{ outline: 'none' }}>
            <option value="">All classes</option>
            {Object.entries(CLASS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="chip" value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })} style={{ outline: 'none' }}>
            <option value="">All severities</option>
            {SEV_ORDER.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <select className="chip" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={{ outline: 'none' }}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <select className="chip" value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })} style={{ outline: 'none' }}>
            <option value="">All zones</option>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
      </GlassCard>

      <GlassCard hover={false} className="section-gap" style={{ padding: 8 }}>
        {!events && <div className="skeleton" style={{ height: 300, margin: 12 }} />}
        {events && (
          <div style={{ overflowX: 'auto' }}>
            <table className="air">
              <thead>
                <tr>
                  <th>Event</th><th>Class</th><th>Severity</th><th>Zone · Chainage</th>
                  <th>Confidence</th><th>Risk</th><th>Detected</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="clickable" onClick={() => setSelected(e)}>
                    <td className="mono" style={{ fontWeight: 600 }}>{e.id}</td>
                    <td><ClassBadge cls={e.class} /></td>
                    <td><SeverityBadge severity={e.severity} /></td>
                    <td>{e.zone}<br /><span className="muted" style={{ fontSize: 11.5 }}>{fmt.km(e.chainage_m)} · {e.segment}</span></td>
                    <td className="mono">{fmt.pct(e.confidence)}</td>
                    <td className="mono" style={{ fontWeight: 700, color: fmt.riskTone(e.risk_score) }}>{e.risk_score}</td>
                    <td className="muted">{fmt.age(e.ts)}</td>
                    <td><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <div className="muted" style={{ padding: 40, textAlign: 'center' }}>No events match the filters.</div>}
          </div>
        )}
      </GlassCard>

      <AnimatePresence>
        {selected && <DefectDrawer event={selected} onClose={() => setSelected(null)} onStatus={onStatus} busy={busy} />}
      </AnimatePresence>
    </div>
  )
}
