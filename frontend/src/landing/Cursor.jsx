import React, { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

const HOVER_SEL = '[data-hover], a, button, [role="button"], .nex-frame'

// custom dot + ring cursor; only mounts on fine pointers, and the native
// cursor is only hidden once a real pointermove proves the custom one alive
export default function Cursor() {
  const reduced = useReducedMotion()
  const [enabled, setEnabled] = useState(false)
  const dotRef = useRef(null)
  const ringRef = useRef(null)

  useEffect(() => {
    if (reduced) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    setEnabled(true)
  }, [reduced])

  useEffect(() => {
    if (!enabled) return
    const dot = dotRef.current
    const ring = ringRef.current
    let mx = 0, my = 0, dx = 0, dy = 0, rx = 0, ry = 0, raf
    let nativeHidden = false
    const onMove = (e) => {
      mx = e.clientX; my = e.clientY
      dot.style.opacity = ring.style.opacity = '1'
      if (!nativeHidden) {
        document.documentElement.classList.add('nex-cursor-active')
        nativeHidden = true
      }
    }
    const loop = () => {
      dx += (mx - dx) * 0.35; dy += (my - dy) * 0.35
      rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12
      dot.style.transform = `translate3d(${dx}px,${dy}px,0) translate(-50%,-50%)`
      ring.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`
      raf = requestAnimationFrame(loop)
    }
    const over = (e) => { if (e.target.closest && e.target.closest(HOVER_SEL)) ring.classList.add('hover') }
    const out = (e) => { if (e.target.closest && e.target.closest(HOVER_SEL)) ring.classList.remove('hover') }
    const down = () => ring.classList.add('press')
    const up = () => ring.classList.remove('press')
    const leave = () => { dot.style.opacity = ring.style.opacity = '0' }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    document.documentElement.addEventListener('pointerleave', leave)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      document.documentElement.removeEventListener('pointerleave', leave)
      document.documentElement.classList.remove('nex-cursor-active')
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <>
      <div ref={dotRef} className="nex-cursor-dot" style={{ opacity: 0 }} />
      <div ref={ringRef} className="nex-cursor-ring" style={{ opacity: 0 }} />
    </>
  )
}
