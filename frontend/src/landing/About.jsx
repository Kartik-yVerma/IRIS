import React from 'react'
import { Reveal, WordReveal, SectionHead } from './reveal.jsx'

const PILLARS = [
  { title: 'Detect', text: 'Edge vision (OpenCV + YOLO) finds cracks, broken rails, missing fasteners, foreign objects and vegetation from rover camera frames.' },
  { title: 'Localize', text: 'GNSS + wheel odometry + track-map projection pins every defect to an exact chainage and coordinate, with an uncertainty estimate.' },
  { title: 'Fuse', text: 'Visual, vibration and position evidence combine into one fused score — a crack plus an impact signature is stronger than either alone.' },
  { title: 'Prioritize', text: 'Severity, confidence, recurrence and operational context become a transparent risk score, so engineers see what matters first.' },
  { title: 'Track', text: 'Every detection becomes a traceable inspection event with evidence, workflow history and longitudinal trend per segment.' },
]

export default function About() {
  return (
    <section id="about" className="nex-section">
      <SectionHead num="01" label="About" />
      <h2 className="nex-about-headline">
        <WordReveal text="Rails, watched by an intelligent rover eye." />
      </h2>
      <Reveal delay={0.15} y={16}>
        <p className="nex-about-copy">
          IRIS is an intelligent rail inspection system. Rover-mounted cameras scan the track,
          edge vision detects defects in real time, and every finding is fused, localized,
          prioritized and tracked — turning inspection data into engineering decisions.
        </p>
      </Reveal>
      <div className="nex-pillars">
        {PILLARS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.05} y={22}>
            <div className="nex-pillar" data-hover>
              <span className="idx">0{i + 1}</span>
              <span className="title">{p.title}</span>
              <span className="text">{p.text}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
