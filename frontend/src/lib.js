import { useEffect, useRef, useState } from 'react'

// ---------------- design tokens (PRD §13) ----------------
export const C = {
  bg: '#FAF9F7', surface: 'rgba(255,255,255,.72)', ink: '#2E2A3B',
  muted: '#6B6780', mint: '#7FD8BE', lavender: '#A79CF0', peach: '#FFB997',
  sky: '#8ECAE6', butter: '#FFD97D', rose: '#F4A6C0',
  line: 'rgba(46,42,59,.08)',
}
// validated categorical series palette (fixed order — never re-ranked)
export const CATEGORICAL = ['#8A77E8', '#4FBFA4', '#F2855E', '#4FA3D9', '#D9A627', '#E0608C']
export const CLASSES = ['surface_crack', 'broken_rail', 'missing_fastener', 'joint_anomaly', 'foreign_object', 'vegetation']
export const CLASS_COLOR = Object.fromEntries(CLASSES.map((c, i) => [c, CATEGORICAL[i]]))
export const CLASS_LABEL = {
  surface_crack: 'Surface Crack', broken_rail: 'Broken Rail',
  missing_fastener: 'Missing Fastener', joint_anomaly: 'Joint Anomaly',
  foreign_object: 'Foreign Object', vegetation: 'Vegetation',
}
export const SEV = {
  low: { color: '#4FA3D9', tint: '#E3F1F9', label: 'Low' },
  medium: { color: '#D9A627', tint: '#FBF2D9', label: 'Medium' },
  high: { color: '#F2855E', tint: '#FDE8DE', label: 'High' },
  critical: { color: '#E0608C', tint: '#FBE0EA', label: 'Critical' },
}
export const SEV_ORDER = ['low', 'medium', 'high', 'critical']
export const STATUS_FLOW = ['open', 'acknowledged', 'verified', 'assigned', 'in_repair', 'resolved']

// ---------------- api ----------------
const API = '/api'
export async function get(path) {
  const r = await fetch(API + path)
  if (!r.ok) throw new Error(r.statusText)
  return r.json()
}
export async function post(path, body) {
  const r = await fetch(API + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(r.statusText)
  return r.json()
}
export async function patch(path, body) {
  const r = await fetch(API + path, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(r.statusText)
  return r.json()
}

export function useEvents(onEvent) {
  const cb = useRef(onEvent)
  cb.current = onEvent
  useEffect(() => {
    let alive = true
    const es = new EventSource(API + '/stream')
    es.onmessage = (e) => {
      try { if (alive) cb.current(JSON.parse(e.data)) } catch { /* noop */ }
    }
    es.onerror = () => { /* EventSource auto-reconnects */ }
    return () => { alive = false; es.close() }
  }, [])
}

export function usePoll(fn, ms, deps = []) {
  const [data, setData] = useState(null)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try { const d = await fn(); if (alive) setData(d) } catch { /* noop */ }
    }
    load()
    const t = setInterval(load, ms)
    return () => { alive = false; clearInterval(t) }
  }, deps)
  return data
}

// ---------------- format ----------------
export const fmt = {
  km: (m) => (m / 1000).toFixed(1) + ' km',
  pct: (x) => Math.round(x * 100) + '%',
  age: (ts) => {
    const s = (Date.now() - new Date(ts).getTime()) / 1000
    if (s < 60) return Math.round(s) + 's ago'
    if (s < 3600) return Math.round(s / 60) + 'm ago'
    if (s < 86400) return Math.round(s / 3600) + 'h ago'
    return Math.round(s / 86400) + 'd ago'
  },
  time: (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  date: (ts) => new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' }),
  riskTone: (r) => (r >= 70 ? '#E0608C' : r >= 50 ? '#F2855E' : r >= 30 ? '#D9A627' : '#4FBFA4'),
}

export function titleCase(s) { return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }
