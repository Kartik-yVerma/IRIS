import React from 'react'

export default function Footer() {
  return (
    <footer className="nex-footer">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="mark">IRIS</span>
        <span>Intelligent Railtrack Inspection System · prototype v1.0</span>
      </div>
      <span>Detect. Localize. Fuse. Prioritize. Track.</span>
      <a href="#home" data-hover>Back to top ↑</a>
    </footer>
  )
}
