import React, { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Sparkles, OrbitControls, RoundedBox, Cloud } from '@react-three/drei'
import * as THREE from 'three'

// ------------------------------------------------------------- railway line
// One long straight track: it starts behind the camera and runs far beyond
// the fog line, so the rails + sleepers read as "stretched to infinity".
const TRACK_CURVE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 6),
  new THREE.Vector3(0, 0, -70),
])

// ------------------------------------------------------- track dimensions
const RAIL_GAUGE = 0.55          // rail centres at x = ±0.55 (broad, uniform)
const RAIL_R = 0.045             // rail tube radius → rail top at y = 0.075
const RAIL_Y = 0.03
const RAIL_TOP = RAIL_Y + RAIL_R
const SLEEPER_SPACING = 0.3      // world units between sleepers
const BELT_SPEED = 0.22          // track slides toward the viewer, units/s
const WHEEL_R = 0.062
const WHEEL_Y = RAIL_TOP + WHEEL_R
const ROLL_SPEED = BELT_SPEED / WHEEL_R   // rolling without slipping

// deterministic pseudo-random (scenery stays put between renders)
const hash = (i) => {
  const x = Math.sin(i * 127.1) * 43758.5453
  return x - Math.floor(x)
}
const pick = (arr, n) => arr[Math.floor(hash(n) * arr.length)]
const CAM = { x: 3.2, y: 1.6, z: 4.3 }   // mirrors the HeroScene camera

// ---------------------------------------------------------- scene themes
// `light` is the original pastel-day scene verbatim; `dark` restyles the same
// world for the NexStudio-style landing (near-black ground, mint accent).
const THEMES = {
  light: {
    fog: '#F6F1EA', fogNear: 6, fogFar: 22,
    ground: '#EFE9E0',
    ballast: '#D9CFC0', sleeper: '#9C8A78',
    rail: '#8B8795', railMetal: 0.5, glint: '#FDFDFD',
    ambient: 0.75,
    key: '#FFF6E8', keyI: 1.3,
    rim: '#A79CF0', rimI: 0.35,
    hemiSky: '#FFF6E8', hemiGround: '#CBB8A8', hemiI: 0.5,
    sweep: '#8FE8D0', sweepI: 6,
    sparkA: '#A79CF0', sparkAI: 0.55, sparkB: '#7FD8BE', sparkBI: 0.5,
    cloudA: 0.85, cloudB: 0.7,
    walls: ['#F2E8DA', '#F7F0E6', '#EFE3F4', '#FDF3E3'],
    roofs: ['#E8A0A6', '#B9A8E8', '#8FD0C0', '#F0B98A'],
    door: '#B89B7E', trunk: '#C9A984',
    window: '#7FA8C9', windowEmissive: null, windowEmissiveI: 0,
    leaves: ['#A8D8B9', '#8FC9A8', '#B7E0C0', '#9AD0A8'],
    bushLeaves: ['#A8D8B9', '#8FC9A8', '#C4E3C8'],
  },
  dark: {
    fog: '#0E0D10', fogNear: 7, fogFar: 24,
    ground: '#141217',
    ballast: '#1C1922', sleeper: '#26222E',
    rail: '#4A4556', railMetal: 0.6, glint: '#F4F1EA',
    ambient: 0.35,
    key: '#EDE8FF', keyI: 0.9,
    rim: '#7FD8BE', rimI: 0.5,
    hemiSky: '#26223A', hemiGround: '#0C0B0F', hemiI: 0.4,
    sweep: '#7FD8BE', sweepI: 8,
    sparkA: '#7FD8BE', sparkAI: 0.5, sparkB: '#F4F1EA', sparkBI: 0.3,
    cloudA: 0.35, cloudB: 0.3,
    walls: ['#232028', '#1D1B23', '#26222E', '#201E26'],
    roofs: ['#3A3444', '#2E2A3B', '#353046', '#2C2836'],
    door: '#3A3444', trunk: '#4A4456',
    window: '#7FD8BE', windowEmissive: '#7FD8BE', windowEmissiveI: 0.5,
    leaves: ['#20332B', '#1B2E27', '#243A30'],
    bushLeaves: ['#1B2A24', '#17241F'],
  },
}

// ------------------------------------------------------------ rover model
// Small inspection rover centred BETWEEN the rails; wheels sit exactly on
// the rail heads. Faces −Z (down-track), camera mast looks ahead.
export function RoverModel({ running = true, scale = 1 }) {
  const grp = useRef()
  const wheels = useRef([])
  useFrame((state, dt) => {
    if (!grp.current) return
    // rolling speed matches the ground speed under the wheels
    wheels.current.forEach((w) => w && (w.rotation.x += ROLL_SPEED * dt * (running ? 1 : 0)))
  })
  return (
    <group ref={grp} scale={scale}>
      {/* body — narrow enough to sit inside the gauge */}
      <RoundedBox args={[0.5, 0.15, 0.66]} radius={0.045} smoothness={4} position={[0, 0.235, 0]}>
        <meshStandardMaterial color="#2E2A3B" roughness={0.35} metalness={0.15} />
      </RoundedBox>
      {/* top deck */}
      <RoundedBox args={[0.38, 0.06, 0.3]} radius={0.025} position={[0, 0.34, -0.02]}>
        <meshStandardMaterial color="#8A77E8" roughness={0.4} />
      </RoundedBox>
      {/* camera mast + camera (facing down-track) */}
      <mesh position={[0.12, 0.44, -0.16]}>
        <cylinderGeometry args={[0.014, 0.014, 0.15, 8]} />
        <meshStandardMaterial color="#6B6780" />
      </mesh>
      <RoundedBox args={[0.09, 0.05, 0.05]} radius={0.015} position={[0.13, 0.52, -0.22]} rotation={[0.25, 0, 0]}>
        <meshStandardMaterial color="#4FBFA4" roughness={0.25} />
      </RoundedBox>
      {/* antenna (rear) */}
      <mesh position={[-0.12, 0.44, 0.19]}>
        <cylinderGeometry args={[0.006, 0.006, 0.13, 6]} />
        <meshStandardMaterial color="#E0608C" />
      </mesh>
      {/* solar panel */}
      <RoundedBox args={[0.34, 0.016, 0.18]} radius={0.008} position={[0, 0.385, -0.06]} rotation={[-0.25, 0, 0]}>
        <meshStandardMaterial color="#3D7E9A" roughness={0.2} metalness={0.5} />
      </RoundedBox>
      {/* wheels — centred on the rails, bottom edge exactly on the rail head */}
      {[[-RAIL_GAUGE, 0.22], [-RAIL_GAUGE, -0.22], [RAIL_GAUGE, 0.22], [RAIL_GAUGE, -0.22]].map(([x, z], i) => (
        <mesh key={i} position={[x, WHEEL_Y, z]} rotation={[0, 0, Math.PI / 2]} ref={(el) => (wheels.current[i] = el)}>
          <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.05, 20]} />
          <meshStandardMaterial color="#3A3547" roughness={0.6} />
        </mesh>
      ))}
      {/* soft shadow on the ballast */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color="#2E2A3B" transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ----------------------- rover parked on the line, idling with a soft wobble
// Holds its spot but shivers subtly — suspension settling + idling motor —
// so it reads as alive while the world streams past it. Turned 180° so its
// face (camera mast + light) looks at the audience.
function ParkedRover() {
  const grp = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const m = grp.current
    if (!m) return
    m.position.y = Math.sin(t * 6.3) * 0.006 + Math.sin(t * 11.7 + 1.3) * 0.003
    m.rotation.x = Math.sin(t * 4.1 + 0.6) * 0.006
    m.rotation.z = Math.sin(t * 3.3 + 2.0) * 0.005
  })
  return (
    <group ref={grp} position={[0, 0, -0.4]} rotation={[0, Math.PI, 0]}>
      <RoverModel running />
    </group>
  )
}

// ------------------------------------------------ camera light, left ⇄ right
// The rover's searchlight pans continuously side to side, sweeping its pool
// of light across the near rails (between the rover and the viewer) —
// "to and fro" along the track, facing the screen.
function SweepLight({ t }) {
  const grp = useRef()
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame((state) => {
    if (!grp.current) return
    grp.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.85) * 0.58
  })
  return (
    <group ref={grp} position={[-0.13, 0.52, -0.18]}>
      <primitive object={target} position={[0, -0.58, 2.8]} />
      <spotLight target={target} angle={0.4} penumbra={0.6} intensity={t.sweepI} distance={14} decay={1.2} color={t.sweep} />
      {/* small glow at the lamp itself */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.11, 0.34, 20, 1, true]} />
        <meshBasicMaterial color={t.sweep} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* hot pool of light riding the beam on the ballast */}
      <mesh position={[0, -0.55, 2.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.4, 26]} />
        <meshBasicMaterial color={t.sweep} transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ------------------------------------------------------------- moving track
// The rover stays parked; the belt streams toward the viewer (wrapping
// modulo the sleeper spacing) so the scene reads as constant forward travel.
function MovingTrack({ t }) {
  const sleepers = useRef([])
  const glints = useRef([])
  const offset = useRef(0)
  const railGeo = useMemo(() => new THREE.TubeGeometry(TRACK_CURVE, 64, RAIL_R, 8, false), [])
  const sleeperGeo = useMemo(() => new THREE.BoxGeometry(1.42, 0.05, 0.16), [])
  const glintGeo = useMemo(() => new THREE.BoxGeometry(0.06, 0.015, 0.1), [])
  const conf = useMemo(() => {
    const length = TRACK_CURVE.getLength()
    const bases = Array.from({ length: Math.floor(length / SLEEPER_SPACING) }, (_, i) => i * SLEEPER_SPACING)
    const glints = Array.from({ length: 16 }, (_, i) => ({
      arc: (i + 0.5) * (length / 16), rail: i % 2 ? 1 : -1, w: 0.5 + (i % 3) * 0.2,
    }))
    return { bases, spacing: SLEEPER_SPACING, length, glints }
  }, [])

  useFrame((state, dt) => {
    offset.current += BELT_SPEED * dt
    const off = ((offset.current % conf.spacing) + conf.spacing) % conf.spacing
    conf.bases.forEach((b, i) => {
      const m = sleepers.current[i]
      if (!m) return
      const u = (((b - off) % conf.length) + conf.length) % conf.length / conf.length
      const p = TRACK_CURVE.getPointAt(u)
      m.position.set(p.x, -0.05, p.z)
    })
    conf.glints.forEach((g, i) => {
      const m = glints.current[i]
      if (!m) return
      const u = (((g.arc - off) % conf.length) + conf.length) % conf.length / conf.length
      const p = TRACK_CURVE.getPointAt(u)
      m.position.set(p.x + g.rail * RAIL_GAUGE, RAIL_TOP + 0.007, p.z)
      m.scale.set(g.w, 1, 0.9 + (i % 2) * 0.12)
    })
  })

  return (
    <group>
      {/* ballast bed — same infinite stretch as the rails */}
      <mesh position={[0, -0.075, -32]}>
        <boxGeometry args={[2.05, 0.07, 77]} />
        <meshStandardMaterial color={t.ballast} roughness={1} />
      </mesh>
      {/* rails — continuous, fading into the fog */}
      <mesh geometry={railGeo} position={[-RAIL_GAUGE, RAIL_Y, 0]}>
        <meshStandardMaterial color={t.rail} roughness={0.35} metalness={t.railMetal} />
      </mesh>
      <mesh geometry={railGeo} position={[RAIL_GAUGE, RAIL_Y, 0]}>
        <meshStandardMaterial color={t.rail} roughness={0.35} metalness={t.railMetal} />
      </mesh>
      {/* sleepers streaming toward the viewer, seamless modulo wrap */}
      {conf.bases.map((b, i) => (
        <mesh key={i} ref={(el) => (sleepers.current[i] = el)} geometry={sleeperGeo} position={[0, -0.05, 0]}>
          <meshStandardMaterial color={t.sleeper} roughness={0.85} />
        </mesh>
      ))}
      {/* bright glints on the rail heads — motion cue */}
      {conf.glints.map((g, i) => (
        <mesh key={`g${i}`} ref={(el) => (glints.current[i] = el)} geometry={glintGeo} position={[0, RAIL_TOP + 0.007, 0]}>
          <meshStandardMaterial color={t.glint} roughness={0.2} />
        </mesh>
      ))}
    </group>
  )
}

// ------------------------------------------------- houses & greenery
// Pastel houses, low-poly trees and bushes scattered along both sides of the
// line, denser near the camera and swallowed by the fog in the distance.
function House({ x, z, i, s, face, t }) {
  const wall = pick(t.walls, i + 200)
  const roof = pick(t.roofs, i + 300)
  return (
    <group position={[x, 0, z]} scale={s} rotation={[0, face, 0]}>
      <RoundedBox args={[0.55, 0.4, 0.48]} radius={0.03} smoothness={2} position={[0, 0.2, 0]}>
        <meshStandardMaterial color={wall} roughness={0.9} />
      </RoundedBox>
      {/* gabled roof: box tipped 45° makes a diamond peak */}
      <mesh position={[0, 0.45, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.6, 0.6, 0.5]} />
        <meshStandardMaterial color={roof} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.11, 0.245]}>
        <boxGeometry args={[0.13, 0.2, 0.02]} />
        <meshStandardMaterial color={t.door} roughness={0.9} />
      </mesh>
      <mesh position={[-0.15, 0.27, 0.245]}>
        <boxGeometry args={[0.12, 0.1, 0.02]} />
        <meshStandardMaterial color={t.window} emissive={t.windowEmissive || undefined} emissiveIntensity={t.windowEmissiveI} roughness={0.6} />
      </mesh>
    </group>
  )
}

function Tree({ x, z, i, s, face, t }) {
  const leaf = pick(t.leaves, i + 400)
  return (
    <group position={[x, 0, z]} scale={s} rotation={[0, face, 0]}>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.045, 0.07, 0.32, 7]} />
        <meshStandardMaterial color={t.trunk} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.44, 0]}>
        <icosahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color={leaf} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0.1, 0.34, 0.05]}>
        <icosahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial color={leaf} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[-0.09, 0.36, -0.04]}>
        <icosahedronGeometry args={[0.13, 0]} />
        <meshStandardMaterial color={leaf} roughness={0.95} flatShading />
      </mesh>
    </group>
  )
}

function Bush({ x, z, i, s, face, t }) {
  const leaf = pick(t.bushLeaves, i + 500)
  return (
    <group position={[x, 0, z]} scale={s} rotation={[0, face, 0]}>
      <mesh position={[0, 0.13, 0]}>
        <icosahedronGeometry args={[0.17, 0]} />
        <meshStandardMaterial color={leaf} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0.13, 0.1, 0.04]}>
        <icosahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial color={leaf} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[-0.11, 0.1, -0.05]}>
        <icosahedronGeometry args={[0.11, 0]} />
        <meshStandardMaterial color={leaf} roughness={0.95} flatShading />
      </mesh>
    </group>
  )
}

function Scenery({ t }) {
  const items = useMemo(() => {
    const out = []
    for (let i = 0; i < 30; i++) {
      const r = hash(i)
      const x = (i % 2 ? 1 : -1) * (1.8 + hash(i + 80) * 5.2)
      const z = -(2.3 + i * 0.75 + hash(i + 90) * 0.5)
      const s = 0.7 + hash(i + 50) * 0.7
      // every item turns to face the audience (diorama staging)
      const face = Math.atan2(CAM.x - x, CAM.z - z)
      out.push({ i, x, z, s, face, kind: r < 0.3 ? 'house' : r < 0.62 ? 'tree' : 'bush' })
    }
    return out
  }, [])
  return (
    <group>
      {items.map((it) =>
        it.kind === 'house' ? <House key={it.i} {...it} t={t} /> : it.kind === 'tree' ? <Tree key={it.i} {...it} t={t} /> : <Bush key={it.i} {...it} t={t} />
      )}
    </group>
  )
}

function Ground({ t }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, -26]}>
      <circleGeometry args={[62, 48]} />
      <meshStandardMaterial color={t.ground} roughness={1} />
    </mesh>
  )
}

// ------------------------------------------------------- scroll rig
// Framer-motion scroll progress (0 → 1 while the hero scrolls off) moves the
// WORLD, never the camera — OrbitControls keeps owning the camera safely.
function ScrollRig({ progress, children }) {
  const grp = useRef()
  useFrame((_, dt) => {
    const g = grp.current
    if (!g) return
    const p = progress ? (typeof progress.get === 'function' ? progress.get() : progress) : 0
    const k = 1 - Math.pow(0.001, dt)   // frame-rate-independent damping
    g.position.z += (-p * 2.2 - g.position.z) * k
    g.rotation.x += (p * 0.06 - g.rotation.x) * k
    g.position.y += (-p * 0.4 - g.position.y) * k
  })
  return <group ref={grp}>{children}</group>
}

// ------------------------------------------------------------ hero scene
export function HeroScene({ mini = false, variant = 'light', scrollProgress = null, enableZoom = true }) {
  const t = THEMES[variant] || THEMES.light
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [3.2, 1.6, 4.3], fov: 42 }} gl={{ antialias: true, alpha: true }}>
      <Suspense fallback={null}>
        <ambientLight intensity={t.ambient} />
        <directionalLight position={[6, 8, 4]} intensity={t.keyI} color={t.key} />
        <directionalLight position={[-5, 3, -3]} intensity={t.rimI} color={t.rim} />
        <fog attach="fog" args={[t.fog, t.fogNear, t.fogFar]} />
        <ScrollRig progress={scrollProgress}>
          <Ground t={t} />
          <MovingTrack t={t} />
          <Scenery t={t} />
          {/* the rover holds its spot; only the world streams past it */}
          <ParkedRover />
          <SweepLight t={t} />
          <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.4}>
            <Cloud position={[-3.4, 2.6, -3]} scale={1.4} opacity={t.cloudA} speed={0.25} />
            <Cloud position={[3.6, 3.1, -4.5]} scale={1.7} opacity={t.cloudB} speed={0.22} />
          </Float>
          <Sparkles count={46} scale={[10, 4, 8]} size={2.4} speed={0.32} color={t.sparkA} opacity={t.sparkAI} />
          <Sparkles count={26} scale={[8, 3, 6]} size={3.2} speed={0.26} color={t.sparkB} opacity={t.sparkBI} />
        </ScrollRig>
        {!mini && <OrbitControls enablePan={false} minDistance={2.4} maxDistance={9} minPolarAngle={1.05} maxPolarAngle={1.45} target={[0, 0.28, -0.3]} enableDamping enableZoom={enableZoom} />}
        <hemisphereLight args={[t.hemiSky, t.hemiGround, t.hemiI]} />
      </Suspense>
    </Canvas>
  )
}
