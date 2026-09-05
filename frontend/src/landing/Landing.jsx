import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, useReducedMotion, useScroll } from 'framer-motion'
import Preloader from './Preloader.jsx'
import Cursor from './Cursor.jsx'
import Header from './Header.jsx'
import Hero from './Hero.jsx'
import About from './About.jsx'
import Work from './Work.jsx'
import Contact from './Contact.jsx'
import Footer from './Footer.jsx'
import { useLandingStats } from './useLandingStats.js'
import { useTheme } from '../theme.jsx'

const PRE_KEY = 'iris.nex.preloader'

export default function Landing() {
  const reduced = useReducedMotion()
  // decide BEFORE first render — re-entering the landing from the console
  // must never flash or replay the preloader curtain
  const [preVisible, setPreVisible] = useState(() => {
    if (reduced) return false
    if (new URLSearchParams(location.search).has('preloader')) return true
    return !sessionStorage.getItem(PRE_KEY)
  })
  const [ready, setReady] = useState(() => !preVisible)
  const heroRef = useRef(null)
  const stats = useLandingStats()
  const { theme } = useTheme()

  useEffect(() => {
    document.documentElement.classList.add('nex-smooth')
    const prevTitle = document.title
    document.title = 'IRIS — Railway Intelligence'
    window.scrollTo(0, 0)   // coming back from a scrolled console page lands on the hero
    return () => {
      document.documentElement.classList.remove('nex-smooth')
      document.title = prevTitle
    }
  }, [])

  const onPreDone = useCallback(() => { setPreVisible(false); setReady(true) }, [])

  // hero scroll progress drives the 3D rig + canvas fade
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })

  return (
    <>
      <AnimatePresence>{preVisible && <Preloader key="pre" onDone={onPreDone} />}</AnimatePresence>
      <Cursor tone={theme === 'dark' ? 'dark' : 'light'} />
      <Header ready={ready} />
      <main className="nex">
        <div ref={heroRef}>
          <Hero ready={ready} scrollYProgress={scrollYProgress} stats={stats} variant={theme} />
        </div>
        <About />
        <Work stats={stats} />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
