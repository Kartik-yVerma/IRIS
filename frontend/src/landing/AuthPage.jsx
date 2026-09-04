import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import TrainBackdrop from './TrainBackdrop.jsx'
import RoverTransition from './RoverTransition.jsx'

export default function AuthPage() {
  const { pathname } = useLocation()
  const isLogin = pathname === '/login'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [entering, setEntering] = useState(false)

  useEffect(() => {
    document.body.classList.add('nex-body-dark')
    return () => document.body.classList.remove('nex-body-dark')
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await fetch(`/api/auth/${isLogin ? 'login' : 'signup'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLogin ? { email, password } : { name, email, password }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.detail || 'Something went wrong — try again')
      localStorage.setItem('iris.token', d.token)
      localStorage.setItem('iris.user', JSON.stringify(d.user))
      window.dispatchEvent(new Event('iris-auth'))
      setEntering(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (entering) return <RoverTransition to="/" message="Welcome aboard — entering IRIS" />

  return (
    <div className="auth-page">
      <TrainBackdrop />
      <Link to="/" className="auth-back" data-hover>← Back to IRIS</Link>
      <div className="auth-shell">
        <motion.form
          className="auth-card"
          onSubmit={submit}
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.25, 1] }}
        >
          <div className="auth-logo">IRIS<span>.</span></div>
          <h1>{isLogin ? 'Sign in' : 'Create your account'}</h1>
          <p className="auth-sub">{isLogin ? 'Welcome back to the corridor.' : 'Join the railway inspection network.'}</p>
          {!isLogin && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            autoComplete="email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password — at least 6 characters"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" disabled={busy} data-hover>
            {busy ? 'Working…' : isLogin ? 'Sign in →' : 'Create account →'}
          </button>
          <div className="auth-alt">
            {isLogin
              ? <>New to IRIS? <Link to="/signup" data-hover>Create an account</Link></>
              : <>Already on board? <Link to="/login" data-hover>Sign in</Link></>}
          </div>
        </motion.form>
      </div>
    </div>
  )
}
