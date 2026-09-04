import React, { useEffect, useRef, useState } from 'react'
import { motion, useInView, useTransform } from 'framer-motion'

const EASE = [0.2, 0.8, 0.25, 1]

// fade + rise on first view
export function Reveal({ children, delay = 0, y = 30, className, style }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

// staggered line-reveal, one word at a time
export function WordReveal({ text, className, delay = 0, amount = 0.6 }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top' }}>
          <motion.span
            style={{ display: 'inline-block' }}
            initial={{ y: '110%' }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, amount }}
            transition={{ duration: 0.7, delay: delay + i * 0.05, ease: EASE }}
          >
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </span>
  )
}

// solid text with an outlined echo that drifts on scroll
export function EchoText({ text, progress = 0, className = '' }) {
  const x = useTransform(progress, [0, 1], ['0%', '-5%'])
  return (
    <div className={`nex-echo-wrap ${className}`}>
      <div>{text}</div>
      <motion.div className="nex-echo" style={{ x }} aria-hidden="true">{text}</motion.div>
    </div>
  )
}

export function SectionHead({ num, label }) {
  return (
    <div className="nex-section-head">
      <span className="num">{num}</span>
      <span className="nex-mono">{label}</span>
      <span className="rule" />
    </div>
  )
}

// eased count-up when scrolled into view
export function Counter({ value = 0, decimals = 0, duration = 1.4 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!inView) return
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / (duration * 1000))
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
      setN(value * e)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration])
  return <span ref={ref}>{decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString()}</span>
}

// seamless two-half marquee strip
export function Marquee({ text }) {
  const chunk = Array.from({ length: 4 }, (_, i) => <span key={i}>{text} — </span>)
  return (
    <div className="nex-marquee" aria-hidden="true">
      <div className="strip">
        {chunk}
        {chunk}
      </div>
    </div>
  )
}
