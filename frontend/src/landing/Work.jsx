import React from 'react'
import { Link } from 'react-router-dom'
import { Reveal, SectionHead, Marquee } from './reveal.jsx'
import { fmt, titleCase } from '../lib.js'

export default function Work({ stats }) {
  const s = stats.summary
  const r1 = stats.rovers && stats.rovers[0]
  const vis = stats.visionLatest
  const cards = [
    {
      num: '01', title: 'Live Command', route: '/dashboard', url: 'iris.local/dashboard',
      one: 'The mission-control overview — live KPIs, zone health and the defect ticker on one command surface.',
      tags: ['3D', 'Live Telemetry', 'SSE'],
      stat: r1 ? `IRIS-R1 · ${titleCase(r1.status)} · ${Math.round(r1.mission_progress_pct || 0)}% mission` : 'IRIS-R1 · awaiting telemetry',
    },
    {
      num: '02', title: 'Live Map', route: '/map', url: 'iris.local/map',
      one: 'The corridor in motion — rover position, patrol progress and defect pins along the track.',
      tags: ['GIS', 'Chainage', 'Zones'],
      stat: '18 km corridor · 4 zones',
    },
    {
      num: '03', title: 'Vision Lab', route: '/vision', url: 'iris.local/vision',
      one: 'The edge pipeline, stage by stage — raw frame to annotated detection, with model metrics alongside.',
      tags: ['Edge Vision', 'YOLO', 'Staging'],
      stat: vis ? `${(vis.detections || []).length} detections · frame ${vis.frame_id}` : 'awaiting first frame',
    },
    {
      num: '04', title: 'Fleet', route: '/fleet', url: 'iris.local/fleet',
      one: 'Every rover in the swarm — telemetry tiles, mission progress and guarded controls.',
      tags: ['Telemetry', 'Guarded Controls'],
      stat: 'IRIS-R1 … R4 · guarded safe-stop',
    },
    {
      num: '05', title: 'Analytics', route: '/analytics', url: 'iris.local/analytics',
      one: 'Trends, severities and zone health over time — the longitudinal picture of the corridor.',
      tags: ['Trends', 'Severity', 'Zones'],
      stat: s ? `${s.events_14d} events / 14d · ${fmt.pct(s.avg_confidence)} avg confidence` : 'trend data · 14 days',
    },
    {
      num: '06', title: 'Defects', route: '/defects', url: 'iris.local/defects',
      one: 'Every detection with evidence, sensor fusion and workflow — from open ticket to verified fix.',
      tags: ['Evidence', 'Workflow', 'Risk'],
      stat: s ? `${s.open_events} open · ${s.critical_open} critical` : 'defect register',
    },
  ]
  return (
    <section id="work" className="nex-section">
      <SectionHead num="02" label="Selected Work" />
      <Reveal>
        <h2 className="nex-display" style={{ fontSize: 'clamp(44px, 8vw, 104px)' }}>The System</h2>
      </Reveal>
      <div className="nex-work-grid" style={{ marginTop: '9vh' }}>
        {cards.map((c, i) => (
          <Reveal key={c.route} delay={(i % 2) * 0.08} y={36}>
            <div className="nex-frame" data-hover>
              <div className="chrome"><i /><i /><i /><span className="url">{c.url}</span></div>
              <div className="body">
                <span className="num">{c.num}</span>
                <h3 className="title">{c.title}</h3>
                <p className="one">{c.one}</p>
                <div className="tags">{c.tags.map((tg) => <span key={tg}>{tg}</span>)}</div>
                <div className="stat">{c.stat}</div>
                <div className="foot">
                  <Link to={c.route} data-hover>View →</Link>
                  <span className="ext">↗</span>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <Marquee text="Detect — Localize — Fuse — Prioritize — Track" />
    </section>
  )
}
