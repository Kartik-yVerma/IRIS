import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Header({ ready }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <motion.header
      className={`nex-header${scrolled ? ' scrolled' : ''}`}
      initial={{ opacity: 0, y: -18 }}
      animate={ready ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.2, 0.8, 0.25, 1] }}
    >
      <a href="#home" className="wordmark" data-hover>IRIS<em>.</em></a>
      <nav>
        <a href="#work" data-hover>Work</a>
        <a href="#about" data-hover>About</a>
        <a href="#contact" data-hover>Contact</a>
        <Link to="/dashboard" className="cta" data-hover>Open Console ↗</Link>
      </nav>
    </motion.header>
  )
}
