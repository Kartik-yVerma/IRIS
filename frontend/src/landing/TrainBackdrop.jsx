import React from 'react'

// dark backdrop for the auth pages: rails along the bottom and a stylized
// high-speed train that periodically blasts from right to left with speed
// streaks — pure CSS animation, zero runtime cost
export default function TrainBackdrop() {
  return (
    <div className="auth-backdrop" aria-hidden="true">
      <svg className="ab-rails" viewBox="0 0 1440 140" preserveAspectRatio="none">
        {Array.from({ length: 26 }).map((_, i) => (
          <rect key={i} x={i * 56 + 10} y={112} width={30} height={7} rx={2} fill="rgba(255,255,255,.09)" />
        ))}
        <rect x="0" y="126" width="1440" height="3" rx="1.5" fill="rgba(244,241,234,.26)" />
        <rect x="0" y="134" width="1440" height="3" rx="1.5" fill="rgba(244,241,234,.26)" />
      </svg>
      <div className="ab-train">
        <svg viewBox="0 0 320 96">
          <defs>
            <linearGradient id="ab-beam" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(127,216,190,0)" />
              <stop offset="100%" stopColor="rgba(127,216,190,.55)" />
            </linearGradient>
          </defs>
          {/* headlight beam ahead of the nose */}
          <rect x="2" y="36" width="46" height="8" rx="4" fill="url(#ab-beam)" />
          {/* body — bullet nose on the left (direction of travel) */}
          <path
            d="M50 22 L300 22 Q312 22 312 34 L312 62 Q312 74 300 74 L62 74 Q50 74 46 64 L38 34 Q36 22 50 22 Z"
            fill="#2E2A3B"
          />
          {/* windshield + cabin */}
          <path d="M60 30 L96 30 L96 66 L60 66 Q52 66 50 56 L50 40 Q50 30 60 30 Z" fill="#1D1B23" />
          <rect x="52" y="40" width="14" height="18" rx="2" fill="rgba(127,216,190,.35)" />
          {/* glowing window strip */}
          <rect x="104" y="34" width="196" height="14" rx="7" fill="rgba(127,216,190,.85)" />
          <rect x="104" y="52" width="196" height="4" rx="2" fill="rgba(127,216,190,.25)" />
          {/* speed skirt + wheels */}
          <rect x="58" y="74" width="248" height="10" rx="4" fill="#201E26" />
          {[84, 148, 232, 288].map((x) => (
            <circle key={x} cx={x} cy="88" r="7" fill="#141217" stroke="rgba(244,241,234,.35)" strokeWidth="2" />
          ))}
        </svg>
      </div>
      <div className="ab-streaks">
        <i style={{ top: '38%', animationDelay: '0s' }} />
        <i style={{ top: '48%', animationDelay: '.35s' }} />
        <i style={{ top: '58%', animationDelay: '.7s' }} />
      </div>
    </div>
  )
}
