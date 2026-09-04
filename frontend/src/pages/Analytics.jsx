import React, { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts'
import { GlassCard, ClassBadge } from '../components.jsx'
import { C, CATEGORICAL, CLASSES, CLASS_COLOR, CLASS_LABEL, SEV, SEV_ORDER, usePoll, get, fmt, titleCase } from '../lib.js'

const AXIS = { fontSize: 11, fill: C.muted, fontFamily: 'Inter, sans-serif' }
function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass" style={{ padding: '10px 14px', borderRadius: 14, fontSize: 12.5 }}>
      <b>{label}</b>
      {payload.map((p) => (
        <div key={p.name} className="row" style={{ gap: 7, marginTop: 3 }}>
          <span className="status-dot" style={{ background: p.color || p.fill }} />
          <span>{titleCase(p.name)}</span>
          <b className="mono" style={{ marginLeft: 6 }}>{p.value}</b>
        </div>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [days, setDays] = useState(14)
  const trend = usePoll(() => get(`/analytics/trend?days=${days}`), 15000, [days])
  const byClass = usePoll(() => get('/analytics/by-class'), 15000)
  const bySev = usePoll(() => get('/analytics/by-severity'), 15000)
  const zones = usePoll(() => get('/analytics/zones'), 15000)
  const [tableView, setTableView] = useState(false)

  const series = trend?.series || []
  const stacked = useMemo(() => {
    const out = []
    for (const s of series) {
      const row = { date: s.date }
      for (const c of CLASSES) row[c] = s.by_class?.[c] || 0
      out.push(row)
    }
    return out
  }, [series])
  const sevData = (bySev?.data || []).map((d) => ({ name: titleCase(d.severity), value: d.count, color: SEV[d.severity]?.color }))
  const classData = (byClass?.data || []).map((d) => ({ name: CLASS_LABEL[d.class] || d.class, count: d.count, color: CLASS_COLOR[d.class] }))

  return (
    <div className="page wide">
      <h1 className="page-title">Analytics</h1>
      <p className="page-sub">Trends, zone health and model quality across the last {days} days.</p>

      <div className="row" style={{ marginTop: 18, gap: 8 }}>
        {[7, 14, 30].map((d) => (
          <button key={d} className={`chip ${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>{d} days</button>
        ))}
        <button className={`chip ${tableView ? 'on' : ''}`} style={{ marginLeft: 'auto' }} onClick={() => setTableView(!tableView)}>
          {tableView ? 'Chart view' : 'Table view'}
        </button>
      </div>

      <div className="grid cols-2 section-gap">
        <GlassCard title="Events per day — by defect class" hover={false}>
          {tableView ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="air">
                <thead><tr><th>Date</th>{CLASSES.map((c) => <th key={c}>{CLASS_LABEL[c]}</th>)}<th>Total</th></tr></thead>
                <tbody>
                  {stacked.map((r) => (
                    <tr key={r.date}>
                      <td className="mono">{r.date.slice(5)}</td>
                      {CLASSES.map((c) => <td key={c} className="mono">{r[c]}</td>)}
                      <td className="mono"><b>{CLASSES.reduce((a, c) => a + r[c], 0)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={stacked} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  {CLASSES.map((c, i) => (
                    <linearGradient key={c} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CATEGORICAL[i]} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={CATEGORICAL[i]} stopOpacity={0.06} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="date" tick={AXIS} tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={AXIS} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => CLASS_LABEL[v]} />
                {CLASSES.map((c, i) => (
                  <Area key={c} type="monotone" dataKey={c} name={c} stackId="1" stroke={CATEGORICAL[i]} strokeWidth={1.8} fill={`url(#g${i})`} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </GlassCard>

        <GlassCard title="Severity distribution — all events" hover={false}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <ResponsiveContainer width="58%" height={280}>
              <PieChart>
                <Pie data={sevData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3} strokeWidth={2}>
                  {sevData.map((d, i) => <Cell key={i} fill={d.color} stroke="#fff" />)}
                </Pie>
                <Tooltip content={<Tip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="stack" style={{ gap: 10, flex: 1 }}>
              {sevData.map((d) => (
                <div key={d.name} className="row" style={{ fontSize: 13 }}>
                  <span className="status-dot" style={{ background: d.color }} />
                  <span>{d.name}</span>
                  <b className="mono" style={{ marginLeft: 'auto' }}>{d.value}</b>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard title="Total events by class" hover={false}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={classData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={C.line} vertical={false} />
              <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 10.5 }} interval={0} angle={-14} textAnchor="end" height={52} />
              <YAxis tick={AXIS} allowDecimals={false} />
              <Tooltip content={<Tip />} cursor={{ fill: 'rgba(46,42,59,.04)' }} />
              <Bar dataKey="count" name="events" radius={[6, 6, 0, 0]} maxBarSize={52}>
                {classData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="row wrap" style={{ gap: 12, marginTop: 10 }}>
            {classData.map((d) => (
              <span key={d.name} className="row" style={{ gap: 6, fontSize: 12 }}>
                <span className="status-dot" style={{ background: d.color }} />{d.name} <b className="mono">{d.count}</b>
              </span>
            ))}
          </div>
        </GlassCard>

        <GlassCard title="Zone health & workload" hover={false}>
          <div className="stack" style={{ gap: 16, paddingTop: 6 }}>
            {(zones?.data || []).map((z) => (
              <div key={z.zone}>
                <div className="spread" style={{ fontSize: 13.5 }}>
                  <b>{z.zone}</b>
                  <span className="muted mono" style={{ fontSize: 12 }}>{z.events_total} events · {z.events_open} open</span>
                </div>
                <div style={{ height: 10, borderRadius: 99, background: 'rgba(46,42,59,.07)', marginTop: 8 }}>
                  <div style={{ width: `${z.health}%`, height: '100%', borderRadius: 99, background: z.health > 70 ? `linear-gradient(90deg, ${C.mint}, ${C.sky})` : z.health > 45 ? `linear-gradient(90deg, ${C.butter}, ${C.peach})` : C.rose, transition: 'width .6s' }} />
                </div>
                <div className="row muted" style={{ fontSize: 11.5, marginTop: 5, justifyContent: 'space-between' }}>
                  <span>chainage {fmt.km(z.start_m)} → {fmt.km(z.end_m)}</span>
                  <span>health {z.health}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
