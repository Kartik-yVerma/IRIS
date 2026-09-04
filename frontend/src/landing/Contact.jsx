import React from 'react'
import { Link } from 'react-router-dom'
import { Reveal, WordReveal, SectionHead } from './reveal.jsx'

export default function Contact() {
  return (
    <section id="contact" className="nex-section">
      <SectionHead num="03" label="Contact" />
      <Reveal>
        <p className="nex-mono" style={{ marginBottom: '4vh' }}>Have a mission in mind?</p>
      </Reveal>
      <h2 className="nex-cta">
        <WordReveal text="Let's make something impossible to ignore." />
      </h2>
      <Reveal delay={0.25} y={20}>
        <div className="nex-contact-row">
          <a href="mailto:hello@iris-railway.dev" data-hover>Start a conversation ↗</a>
          <Link to="/dashboard" className="solid" data-hover>Open the console</Link>
        </div>
      </Reveal>
    </section>
  )
}
