import React, { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ScanEye, RefreshCw, Upload, Image as ImageIcon, Gauge, Zap, CheckCircle2, AlertTriangle } from 'lucide-react'
import { GlassCard, ClassBadge } from '../components.jsx'
import { C, usePoll, get, post, fmt } from '../lib.js'

const STAGES = [
  ['raw', 'Raw frame'],
  ['preprocessed', 'Pre-processed (CLAHE)'],
  ['edges', 'Edge map (Canny)'],
  ['rails', 'Rail geometry'],
  ['result', 'Detections'],
]

export default function VisionLab() {
  const latest = usePoll(() => get('/vision/latest'), 3500)
  const model = usePoll(() => get('/analytics/model'), 30000)
  const [reanalyze, setReanalyze] = useState(null)
  const [busy, setBusy] = useState(false)
  const [upload, setUpload] = useState(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef()

  const runReanalyze = useCallback(async () => {
    if (!latest?.frame_id) return
    setBusy(true)
    try { setReanalyze(await post(`/vision/reanalyze/${latest.frame_id}`)) }
    finally { setBusy(false) }
  }, [latest?.frame_id])

  const onFile = useCallback(async (file) => {
    if (!file) return
    setUploadBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await fetch('/api/vision/analyze', { method: 'POST', body: fd })
      setUpload(await r.json())
    } finally { setUploadBusy(false) }
  }, [])

  const dets = reanalyze?.detections || latest?.detections || []
  const quality = latest?.quality
  const frame = latest?.frame_id

  return (
    <div className="page wide">
      <h1 className="page-title">Vision Lab</h1>
      <p className="page-sub">The edge pipeline, stage by stage — live frame, pipeline internals, and your own test images.</p>

      <div className="grid section-gap" style={{ gridTemplateColumns: '1.6fr 1fr', gap: 18 }}>
        <div className="stack" style={{ gap: 18 }}>
          {/* live frame */}
          <GlassCard
            title={`Live camera feed — frame ${frame || '…'}`}
            icon={<ScanEye size={14} />}
            hover={false}
          >
            {latest ? (
              <img src={`${latest.urls.annotated}?t=${latest.timestamp}`} alt="Annotated rover camera frame"
                style={{ width: '100%', borderRadius: 16, display: 'block', background: '#111' }} />
            ) : <div className="skeleton" style={{ height: 320 }} />}
            <div className="row wrap" style={{ marginTop: 12, fontSize: 12.5, gap: 10 }}>
              {latest && (
                <>
                  <span className="badge" style={{ background: quality?.degraded ? 'rgba(255,217,125,.3)' : 'rgba(127,216,190,.22)', color: quality?.degraded ? '#A07A10' : '#2E9C7C' }}>
                    {quality?.degraded ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                    {quality?.degraded ? 'Image degraded — evidence flagged' : 'Image quality OK'}
                  </span>
                  <span className="badge"><Zap size={12} /> {latest.latency_ms} ms edge latency</span>
                  <span className="badge"><Gauge size={12} /> vibration {latest.vibration?.score?.toFixed?.(2)} {latest.vibration?.anomaly ? '· anomaly' : ''}</span>
                  <span className="muted mono">chainage {fmt.km(latest.chainage_m)}</span>
                </>
              )}
              <button className="btn primary sm" style={{ marginLeft: 'auto' }} disabled={busy || !frame} onClick={runReanalyze}>
                <RefreshCw size={14} /> {busy ? 'Running…' : 'Re-analyze frame'}
              </button>
            </div>
            {(reanalyze || latest)?.ground_truth && (
              <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                Lab ground truth on this frame: {(reanalyze || latest).ground_truth.join(', ') || 'clean'} — compare against the detections.
              </div>
            )}
          </GlassCard>

          {/* detections */}
          <GlassCard title={`Detections — ${dets.length}`} icon={<ScanEye size={14} />} hover={false}>
            {dets.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No detections above confidence floor on this frame.</div>}
            {dets.map((d, i) => (
              <div key={i} className="row" style={{ padding: '8px 0', borderBottom: i < dets.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <img src={`/api/evidence/${d.class}`} alt="real-world reference"
                  style={{ width: 58, height: 42, objectFit: 'cover', borderRadius: 10, flex: 'none' }} />
                <ClassBadge cls={d.class} />
                <span className="mono muted" style={{ marginLeft: 'auto', fontSize: 12.5 }}>
                  bbox [{d.bbox.map((b) => Math.round(b)).join(', ')}]
                </span>
                <div style={{ width: 84, height: 7, borderRadius: 99, background: 'var(--line)' }}>
                  <div style={{ width: `${d.confidence * 100}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${C.mint}, ${C.lavender})` }} />
                </div>
                <b className="mono" style={{ fontSize: 13 }}>{fmt.pct(d.confidence)}</b>
              </div>
            ))}
          </GlassCard>

          {/* pipeline stages */}
          <GlassCard title="Pipeline stages" icon={<RefreshCw size={14} />} hover={false}>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              {STAGES.map(([key, label]) => (
                <div key={key}>
                  <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{label}</div>
                  {latest ? (
                    <img src={`${latest.urls.stages[key]}?t=${latest.timestamp}`} alt={label}
                      style={{ width: '100%', borderRadius: 12, display: 'block', background: '#111' }} />
                  ) : <div className="skeleton" style={{ height: 84 }} />}
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          {/* upload */}
          <GlassCard title="Test the pipeline on your image" icon={<Upload size={14} />}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]) }}
              onClick={() => fileRef.current?.click()}
              className="glass"
              style={{ border: `2px dashed ${drag ? C.lavender : 'var(--line)'}`, borderRadius: 18, padding: 26, textAlign: 'center', cursor: 'pointer', background: drag ? 'rgba(167,156,240,.08)' : undefined }}
            >
              <ImageIcon size={26} style={{ color: C.lavender, marginBottom: 8 }} />
              <div style={{ fontSize: 13.5 }}><b>{uploadBusy ? 'Analyzing…' : 'Drop an image or click to upload'}</b></div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>JPEG / PNG · any track or track-side photo · max 8 MB</div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            {upload && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 14 }}>
                <img src={upload.annotated} alt="Analysis result" style={{ width: '100%', borderRadius: 14, display: 'block' }} />
                <div style={{ marginTop: 10 }}>
                  {upload.detections.length === 0
                    ? <div className="muted" style={{ fontSize: 12.5 }}>No defects above the confidence floor.</div>
                    : upload.detections.map((d, i) => (
                      <div key={i} className="row" style={{ padding: '5px 0', fontSize: 12.5 }}>
                        <ClassBadge cls={d.class} />
                        <span className="mono muted" style={{ marginLeft: 'auto' }}>{fmt.pct(d.confidence)}</span>
                      </div>
                    ))}
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{upload.note}</div>
              </motion.div>
            )}
          </GlassCard>

          {/* model metrics */}
          <GlassCard title="Model metrics — measured, not estimated" icon={<Gauge size={14} />} hover={false}>
            <div className="muted" style={{ fontSize: 11.5, marginBottom: 10 }}>
              {model?.measured_on} · {model?.frames} frames · classical OpenCV baseline
            </div>
            {(model?.per_class || []).map((m) => (
              <div key={m.class} style={{ marginBottom: 12 }}>
                <div className="spread" style={{ fontSize: 12.5 }}>
                  <ClassBadge cls={m.class} />
                  <span className="mono muted">F1 {m.f1 == null ? '—' : m.f1.toFixed(2)}</span>
                </div>
                <div className="row mono muted" style={{ fontSize: 11, marginTop: 5, gap: 14 }}>
                  <span>P {m.precision == null ? '—' : m.precision.toFixed(2)}</span>
                  <span>R {m.recall == null ? '—' : m.recall.toFixed(2)}</span>
                  <span>n={m.samples}</span>
                  <span>FP {m.false_positives}</span>
                </div>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 11.5 }}>{model?.note}</div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
