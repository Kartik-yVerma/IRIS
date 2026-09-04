import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, useScroll } from 'framer-motion'
import Preloader from './Preloader.jsx'
import Cursor from './Cursor.jsx'
import Header from './Header.jsx'
import Hero from './Hero.jsx'
import About from './About.jsx'
import Work from './Work.jsx'
import Contact from './Contact.jsx'
import Footer from './Footer.jsx'
import { useLandingStats } from './useLandingStats.js'

export default function Landing() {
  const [ready, setReady] = useState(false)
  const [preVisible, setPreVisible] = useState(true)
  const heroRef = useRef(null)
  const stats = useLandingStats()

  useEffect(() => {
    document.documentElement.classList.add('nex-smooth')
    const prevTitle = document.title
    document.title = 'IRIS — Railway Intelligence'
    return () => {
      document.documentElement.classList.remove('nex-smooth')
      document.title = prevTitle
    }
  }, [])

  const onPreDone = useCallback(() => setPreVisible(false), [])
  useEffect(() => { if (!preVisible) setReady(true) }, [preVisible])

  // hero scroll progress drives the 3D rig + canvas fade
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })

  return (
    <>
      <AnimatePresence>{preVisible && <Preloader key="pre" onDone={onPreDone} />}</AnimatePresence>
      <Cursor />
      <Header ready={ready} />
      <main className="nex">
        <div ref={heroRef}>
          <Hero ready={ready} scrollYProgress={scrollYProgress} stats={stats} />
        </div>
        <About />
        <Work stats={stats} />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
