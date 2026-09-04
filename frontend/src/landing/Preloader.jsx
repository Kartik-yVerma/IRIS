import React, { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const KEY = 'iris.nex.preloader'

// "Loading experience" — counter 000→100, then the curtain lifts.
// Plays once per session (sessionStorage); `?preloader=1` forces a replay.
export default function Preloader({ onDone }) {
  const reduced = useReducedMotion()
  const [count, setCount] = useState(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const forced = new URLSearchParams(location.search).has('preloader')
    if (reduced || (sessionStorage.getItem(KEY) && !forced)) {
      doneRef.current()
      return
    }
    document.documentElement.style.overflow = 'hidden'
    let raf
    const t0 = performance.now()
    const D = 1800
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / D)
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)   // easeOutExpo
      setCount(Math.floor(e * 100))
      if (p < 1) raf = requestAnimationFrame(tick)
      else {
        sessionStorage.setItem(KEY, '1')
        doneRef.current()
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      document.documentElement.style.overflow = ''
    }
  }, [reduced])

  return (
    <motion.div
      className="nex-preloader"
      initial={{ y: 0 }}
      exit={{ y: '-100%', transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }}
    >
      <span className="label">Loading experience</span>
      <div className="count">{String(count).padStart(3, '0')}</div>
      <div className="bar"><i style={{ transform: `scaleX(${count / 100})` }} /></div>
    </motion.div>
  )
}
