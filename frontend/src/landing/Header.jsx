import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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

function ProfileMenu({ user, onClose }) {
  const [mode, setMode] = useState('menu')   // menu | edit
  const [name, setName] = useState(user.name)
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('iris.token') },
        body: JSON.stringify({ name, current_password: cur || null, new_password: next || null }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(Array.isArray(d.detail) ? d.detail.map((x) => x.msg).join('; ') : (d.detail || 'Could not save changes'))
      localStorage.setItem('iris.user', JSON.stringify(d.user))
      window.dispatchEvent(new Event('iris-auth'))
      setFlash('Profile updated')
      setCur('')
      setNext('')
      setMode('menu')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + localStorage.getItem('iris.token') },
      })
    } catch { /* noop — local sign-out always succeeds */ }
    localStorage.removeItem('iris.token')
    localStorage.removeItem('iris.user')
    window.dispatchEvent(new Event('iris-auth'))
    onClose()
  }

  return (
    <motion.div
      className="nex-profile"
      initial={{ opacity: 0, y: -8, scale: .97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: .98 }}
      transition={{ duration: .22, ease: [.2, .8, .25, 1] }}
    >
      {mode === 'menu' ? (
        <>
          <div className="pp-head">
            <b>{user.name}</b>
            <span>{user.email}</span>
          </div>
          {flash && <div className="pp-flash">{flash}</div>}
          <button className="pp-btn" onClick={() => { setFlash(''); setMode('edit') }} data-hover>Edit profile</button>
          <button className="pp-btn danger" onClick={signOut} data-hover>Sign out</button>
        </>
      ) : (
        <form className="pp-edit" onSubmit={save}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <label>New password <i>(optional)</i></label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Leave blank to keep" />
          <label>Current password <i>(required to change)</i></label>
          <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="••••••••" />
          {error && <div className="pp-error">{error}</div>}
          <div className="pp-row">
            <button type="button" className="pp-btn" onClick={() => { setError(''); setMode('menu') }}>Back</button>
            <button className="pp-btn solid" disabled={busy} data-hover>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}
    </motion.div>
  )
}

export default function Header({ ready }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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
          <div className="nex-user-wrap">
            <button className="nex-header-user" onClick={() => setMenuOpen((o) => !o)} data-hover>
              Hi, {user.name.split(' ')[0]} ▾
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="nex-menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <ProfileMenu user={user} onClose={() => setMenuOpen(false)} />
                </>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <Link to="/login" className="cta" data-hover>Sign in ↗</Link>
        )}
        <Link to="/dashboard" className="cta" data-hover>Open Console ↗</Link>
      </nav>
    </motion.header>
  )
}
