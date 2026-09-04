import React, { useEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'

// calming generative BGM — a slow Am → F → G → C pad, synthesized live with
// the Web Audio API: no assets, no downloads. Browsers gate autoplay behind
// a user gesture, so it fades in on the first click/keypress of the visit
// and can be toggled any time (preference remembered per browser).
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
  const ctxRef = useRef(null)
  const gainRef = useRef(null)
  const voicesRef = useRef([])
  const chordRef = useRef(0)
  const timerRef = useRef(null)
  const startedRef = useRef(false)
  const playingRef = useRef(playing)
  playingRef.current = playing

  const build = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)

    // slow "breathing" LFO on the master gain
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = VOL * 0.18
    lfo.connect(lfoGain)
    lfoGain.connect(master.gain)
    lfo.start()

    // soft low-pass keeps the pad airy
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

  const nextChord = () => {
    const voices = voicesRef.current
    if (!voices?.length) return
    chordRef.current = (chordRef.current + 1) % CHORDS.length
    const now = voices[0].osc.context.currentTime
    // setTargetAtTime glides each voice to the next chord — seamless
    CHORDS[chordRef.current].forEach((f, i) => {
      voices[i].osc.frequency.setTargetAtTime(f, now, CROSSFADE / 3)
    })
  }

  const start = () => {
    if (!ctxRef.current) build()
    const ctx = ctxRef.current
    ctx.resume()
    gainRef.current.gain.setTargetAtTime(VOL, ctx.currentTime, 1.2)
    if (!timerRef.current) timerRef.current = setTimeout(function tick() {
      nextChord()
      timerRef.current = setTimeout(tick, CHORD_SECS * 1000)
    }, CHORD_SECS * 1000)
    startedRef.current = true
    setPlaying(true)
    localStorage.setItem('iris.bgm', 'on')
  }

  const stop = () => {
    const ctx = ctxRef.current
    if (ctx && gainRef.current) gainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
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
      voicesRef.current.forEach((v) => { try { v.osc.stop() } catch { /* noop */ } })
      ctxRef.current?.close?.()
    }
  }, [])

  return (
    <button
      className={`bgm-toggle${playing ? ' on' : ''}`}
      onClick={() => (playing ? stop() : start())}
      data-hover
      aria-label={playing ? 'Mute background music' : 'Play calming background music'}
      title={playing ? 'Mute ambient music' : 'Play calming ambient music'}
    >
      <Volume2 size={15} />
      <span className="bgm-bars" aria-hidden="true"><i /><i /><i /><i /></span>
    </button>
  )
}
