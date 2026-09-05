import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTheme } from '../theme.jsx'

function useSession() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('iris.user') || 'null') } catch { return null }
  })
  useEffect(() => {
    const on = () => setUser(() => {
      try { return JSON.parse(localStorage.getItem('iris.user') || 'null') } catch { return null }
    })
    window.addEventListener('iris-auth', on)
    return () => window.removeEventListener('iris-auth', on)
  }, [])
  return user
}

export default function Header({ ready }) {
  const [scrolled, setScrolled] = useState(false)
  const user = useSession()
  const { theme, toggle } = useTheme()
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
      {/* the wordmark doubles as the theme switch */}
      <a
        href="#home"
        className="wordmark"
        data-hover
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={(e) => { e.preventDefault(); toggle() }}
      >
        IRIS<em>.</em>
      </a>
      <nav>
        <a href="#work" data-hover>Work</a>
        <a href="#about" data-hover>About</a>
        <a href="#contact" data-hover>Contact</a>
        {user ? (
          <span className="nex-header-user" title={user.email}>Hi, {user.name.split(' ')[0]}</span>
        ) : (
          <Link to="/login" className="cta" data-hover>Sign in ↗</Link>
        )}
        <Link to="/dashboard" className="cta" data-hover>Open Console ↗</Link>
      </nav>
    </motion.header>
  )
}
