import React, { useEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'

// Ambient BGM. Two sources:
//   1. Your own loop — drop a file at frontend/public/audio/bgm.mp3 and it
//      plays on loop (volume-faded in/out with the toggle).
//   2. Fallback — a calming generative pad (slow Am → F → G → C), synthesized
//      live with the Web Audio API when no file is present.
// Browsers gate autoplay behind a user gesture, so it fades in on the first
// click/keypress of the visit; the preference is remembered per browser.
const TRACK_VOL = 0.5
const CHORDS = [
  [110.0, 164.81, 220.0, 329.63],   // Am
  [87.31, 130.81, 174.61, 261.63],  // F
  [98.0, 146.83, 196.0, 293.66],    // G
  [130.81, 196.0, 261.63, 392.0],   // C
]
const CHORD_SECS = 9
const CROSSFADE = 2.2
const VOL = 0.055   // quiet — background, not foreground

export default function AmbientAudio() {
  const [playing, setPlaying] = useState(false)
  const [hasTrack, setHasTrack] = useState(null)   // null = still checking
  const audioRef = useRef(null)
  const fadeRef = useRef(null)
  const ctxRef = useRef(null)
  const gainRef = useRef(null)
  const voicesRef = useRef([])
  const chordRef = useRef(0)
  const timerRef = useRef(null)
  const startedRef = useRef(false)
  const playingRef = useRef(playing)
  playingRef.current = playing

  // ---------------- user-provided loop file ----------------
  useEffect(() => {
    const a = new Audio('/audio/bgm.mp3')
    a.loop = true
    a.preload = 'auto'
    const ok = () => {
      setHasTrack(true)
      // file arrived while the synth was already playing → crossfade to it
      if (startedRef.current && playingRef.current) {
        fadeSynth(0)
        startTrack()
      }
    }
    const bad = () => { setHasTrack(false); a.src = '' }
    a.addEventListener('canplaythrough', ok, { once: true })
    a.addEventListener('error', bad, { once: true })
    audioRef.current = a
    return () => { a.pause(); a.src = '' }
  }, [])

  const fadeAudio = (target, ms, done) => {
    const a = audioRef.current
    if (!a) return
    cancelAnimationFrame(fadeRef.current)
    const t0 = performance.now()
    const from = a.volume
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms)
      a.volume = from + (target - from) * p
      if (p < 1) fadeRef.current = requestAnimationFrame(step)
      else if (target === 0) { a.pause(); done && done() }
    }
    fadeRef.current = requestAnimationFrame(step)
  }

  const startTrack = () => {
    const a = audioRef.current
    if (!a) return
    a.volume = 0
    a.play().then(() => fadeAudio(TRACK_VOL, 1200)).catch(() => startSynth())
  }

  // ---------------- generative synth fallback ----------------
  const buildSynth = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = VOL * 0.18
    lfo.connect(lfoGain)
    lfoGain.connect(master.gain)
    lfo.start()
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 950
    filter.Q.value = 0.6
    filter.connect(master)
    const voices = CHORDS[0].map((f) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = 0.5
      osc.connect(g)
      g.connect(filter)
      osc.start()
      return { osc, g }
    })
    ctxRef.current = ctx
    gainRef.current = master
    voicesRef.current = voices
    return ctx
  }

  const fadeSynth = (target) => {
    const ctx = ctxRef.current
    if (ctx && gainRef.current) gainRef.current.gain.setTargetAtTime(target, ctx.currentTime, target === 0 ? 0.4 : 1.2)
  }

  const startSynth = () => {
    if (!ctxRef.current) buildSynth()
    ctxRef.current.resume()
    fadeSynth(VOL)
    if (!timerRef.current) timerRef.current = setTimeout(function tick() {
      const voices = voicesRef.current
      if (voices?.length) {
        chordRef.current = (chordRef.current + 1) % CHORDS.length
        const now = voices[0].osc.context.currentTime
        CHORDS[chordRef.current].forEach((f, i) => {
          voices[i].osc.frequency.setTargetAtTime(f, now, CROSSFADE / 3)
        })
      }
      timerRef.current = setTimeout(tick, CHORD_SECS * 1000)
    }, CHORD_SECS * 1000)
  }

  // ---------------- shared control ----------------
  const start = () => {
    startedRef.current = true
    setPlaying(true)
    localStorage.setItem('iris.bgm', 'on')
    if (hasTrack && audioRef.current) startTrack()
    else startSynth()
  }

  const stop = () => {
    if (hasTrack && audioRef.current) fadeAudio(0, 500)
    fadeSynth(0)
    clearTimeout(timerRef.current)
    timerRef.current = null
    setPlaying(false)
    localStorage.setItem('iris.bgm', 'off')
  }

  // autoplay policy: begin on the first user gesture (unless muted before)
  useEffect(() => {
    const onFirst = (e) => {
      if (e.target.closest && e.target.closest('.bgm-toggle')) return
      if (playingRef.current || startedRef.current) return
      if (localStorage.getItem('iris.bgm') !== 'off') start()
    }
    window.addEventListener('pointerdown', onFirst, { once: true })
    window.addEventListener('keydown', onFirst, { once: true })
    return () => {
      window.removeEventListener('pointerdown', onFirst)
      window.removeEventListener('keydown', onFirst)
      clearTimeout(timerRef.current)
      cancelAnimationFrame(fadeRef.current)
      voicesRef.current.forEach((v) => { try { v.osc.stop() } catch { /* noop */ } })
      ctxRef.current?.close?.()
    }
  }, [])

  return (
    <button
      className={`bgm-toggle${playing ? ' on' : ''}`}
      onClick={() => (playing ? stop() : start())}
      data-hover
      data-src={hasTrack ? 'file' : 'synth'}
      aria-label={playing ? 'Mute background music' : 'Play background music'}
      title={playing ? 'Mute ambient music' : 'Play calming ambient music'}
    >
      <Volume2 size={15} />
      <span className="bgm-bars" aria-hidden="true"><i /><i /><i /><i /></span>
    </button>
  )
}
