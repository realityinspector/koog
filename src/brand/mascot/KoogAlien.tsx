import { useId, type CSSProperties } from 'react'
import {
  ANIM_CSS, BROW_PATHS, KOOG_ALIEN_COLORS as C, MOUTH_PATHS, POSE_SPECS, altText, antennaPath, armPath,
  type Arm, type Extra, type KoogAlienMood, type KoogAlienPose,
} from './alienData'

export interface KoogAlienProps {
  pose?: KoogAlienPose
  mood?: KoogAlienMood
  /** Pixel size (width; height follows) or any CSS length. */
  size?: number | string
  /** Gentle idle: bob, slow antenna glow, blink. Off under prefers-reduced-motion. */
  animated?: boolean
  /** Mouth flaps, as if speaking Koogalien. */
  talking?: boolean
  className?: string
  style?: CSSProperties
  /** Set false when the figure is purely decorative next to text. */
  labelled?: boolean
  title?: string
}

const OUT = C.plum

function ArmShape({ a, cls, origin }: { a: Arm; cls?: string; origin?: string }) {
  const g = (
    <g>
      <path d={armPath(a)} stroke={OUT} strokeWidth="16" strokeLinecap="round" fill="none" />
      <path d={armPath(a)} stroke={C.arm} strokeWidth="10" strokeLinecap="round" fill="none" />
      <circle cx={a.x2} cy={a.y2} r="9.5" fill={C.gold} stroke={OUT} strokeWidth="3" />
    </g>
  )
  return cls ? <g className={cls} style={{ transformOrigin: origin }}>{g}</g> : g
}

function Knob({ cx, cy, side }: { cx: number; cy: number; side: 'L' | 'R' }) {
  const ang = side === 'L' ? -135 : -45
  const r = (ang * Math.PI) / 180
  return (
    <g>
      <circle className="kal-glow" cx={cx} cy={cy} r="17" fill={C.mint} opacity=".35" />
      <circle cx={cx} cy={cy} r="9" fill={C.knob} stroke={C.cream} strokeWidth="2.2" />
      <path d={`M${cx} ${cy}L${cx + Math.cos(r) * 6.5} ${cy + Math.sin(r) * 6.5}`} stroke={C.mint} strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}

function Note({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={C.gold} stroke={OUT} strokeWidth="1.5" strokeLinejoin="round">
      <ellipse cx="0" cy="0" rx="5" ry="3.8" transform="rotate(-20)" />
      <path d="M4 -1V-16L11 -13" fill="none" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  )
}

function Star({ x, y, r, fill = C.gold }: { x: number; y: number; r: number; fill?: string }) {
  const d = `M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`
  return <path d={d} fill={fill} stroke={OUT} strokeWidth="1.4" strokeLinejoin="round" />
}

function Extras({ kind }: { kind: Extra }) {
  switch (kind) {
    case 'sparkles': return <g><Star x={30} y={44} r={9} /><Star x={172} y={46} r={8} fill={C.mint} /><Star x={100} y={10} r={7} fill={C.cream} /></g>
    case 'notes': return <g><Note x={34} y={60} s={1.1} /><Note x={168} y={50} /></g>
    case 'bubble': return (
      <g>
        <circle cx="160" cy="62" r="3.5" fill={C.cream} /><circle cx="168" cy="48" r="5" fill={C.cream} />
        <ellipse cx="176" cy="26" rx="20" ry="15" fill={C.cream} stroke={OUT} strokeWidth="2" />
        <text x="176" y="33" textAnchor="middle" fontSize="20" fontWeight="800" fill={C.plum} fontFamily="system-ui,sans-serif">?</text>
      </g>
    )
    case 'zzz': return (
      <g fill={C.cream} stroke={OUT} strokeWidth="3" paintOrder="stroke" fontFamily="system-ui,sans-serif" fontWeight="800">
        <text x="150" y="58" fontSize="16">z</text><text x="162" y="42" fontSize="21">z</text><text x="176" y="24" fontSize="26">z</text>
      </g>
    )
    case 'waves': return (
      <g fill="none" stroke={C.mint} strokeWidth="3" strokeLinecap="round" opacity=".9">
        <path d="M186 74Q194 84 186 94" /><path d="M192 66Q204 84 192 102" opacity=".6" />
      </g>
    )
    case 'drop': return <path d="M146 62Q140 74 146 80Q153 74 146 62Z" fill="#7fd8ff" stroke={OUT} strokeWidth="1.8" />
    default: return null
  }
}

/** The Koog Alien: Koog's mascot. Inline SVG, no external assets. */
export function KoogAlien({ pose = 'wave', mood = 'happy', size = 160, animated = false, talking = false, className, style, labelled = true, title }: KoogAlienProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const spec = POSE_SPECS[pose]
  const closed = spec.eyes === 'closed'
  const excited = mood === 'excited'
  const mouthKind = spec.mouth ?? (mood === 'excited' ? 'open' : mood === 'sad' ? 'sad' : mood === 'proud' ? 'proud' : 'smile')
  const brows = closed ? undefined : BROW_PATHS[mood]
  const label = title ?? altText(pose) + (mood === 'happy' ? '' : `, looking ${mood}`)
  const wid = typeof size === 'number' ? size : undefined
  const armCls = (side: 'L' | 'R') => {
    if (!animated) return undefined
    if (pose === 'wave' && side === 'R') return 'kal-wave'
    if (pose === 'cheer') return 'kal-cheer'
    return undefined
  }
  const eyeCx = [76, 124]
  const front = pose === 'sleep' || pose === 'think' || pose === 'oops'
  const arms = (<>
    <ArmShape a={spec.armL} cls={armCls('L')} origin="46px 135px" />
    <ArmShape a={spec.armR} cls={armCls('R')} origin="154px 135px" />
  </>)

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" width={wid ?? size} height={wid ? Math.round(wid * 1.1) : undefined}
      className={className} style={{ display: 'inline-block', overflow: 'visible', ...(wid ? null : { aspectRatio: '200 / 220' }), ...style }}
      role={labelled ? 'img' : undefined} aria-label={labelled ? label : undefined} aria-hidden={labelled ? undefined : true}
      data-pose={pose} data-mood={mood}
    >
      {(animated || talking) && <style>{ANIM_CSS}</style>}
      <defs>
        <linearGradient id={`b${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.cream} /><stop offset=".22" stopColor={C.gold} /><stop offset=".62" stopColor={C.coral} /><stop offset="1" stopColor={C.purple} />
        </linearGradient>
        <clipPath id={`k${uid}`}><rect x="72" y="152" width="56" height="30" rx="6" /></clipPath>
      </defs>
      <ellipse cx="100" cy="209" rx="40" ry="6" fill="#000" opacity=".28" />
      <g className={animated ? 'kal-bob' : undefined}>
        <g transform={`rotate(${spec.tilt} 100 196)`}>
          <g className={animated && pose === 'dance' ? 'kal-sway' : undefined} style={{ transformOrigin: '100px 196px' }}>
            <Extras kind={spec.extra} />
            {/* antennae */}
            <path d={antennaPath('L', spec.antL)} stroke={OUT} strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path d={antennaPath('L', spec.antL)} stroke={C.gold} strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d={antennaPath('R', spec.antR)} stroke={OUT} strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path d={antennaPath('R', spec.antR)} stroke={C.gold} strokeWidth="2" strokeLinecap="round" fill="none" />
            <Knob cx={spec.antL[0]} cy={spec.antL[1]} side="L" />
            <Knob cx={spec.antR[0]} cy={spec.antR[1]} side="R" />
            {/* arm behind body for the resting side */}
            {!front && arms}
            {/* feet */}
            <ellipse cx="80" cy="194" rx="13" ry="8" fill={C.purple} stroke={OUT} strokeWidth="3" />
            <ellipse cx="120" cy="194" rx="13" ry="8" fill={C.purple} stroke={OUT} strokeWidth="3" />
            {/* body */}
            <ellipse cx="100" cy="128" rx="64" ry="68" fill={`url(#b${uid})`} stroke={OUT} strokeWidth="4" />
            <ellipse cx="74" cy="84" rx="22" ry="12" fill="#fff" opacity=".28" transform="rotate(-24 74 84)" />
            {/* piano-key belly */}
            <g clipPath={`url(#k${uid})`}>
              <rect x="72" y="152" width="56" height="30" fill={C.cream} />
              {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${72 + i * 11.2} 152V182`} stroke={OUT} strokeWidth="1.3" opacity=".55" />)}
              {[1, 2, 4].map((i) => <rect key={i} x={72 + i * 11.2 - 3.4} y="152" width="6.8" height="17" rx="1.6" fill={C.navy} />)}
            </g>
            <rect x="72" y="152" width="56" height="30" rx="6" fill="none" stroke={OUT} strokeWidth="2.5" />
            {/* cheeks */}
            <ellipse cx="54" cy="128" rx="9" ry="6" fill={C.coral} opacity=".55" />
            <ellipse cx="146" cy="128" rx="9" ry="6" fill={C.coral} opacity=".55" />
            {/* eyes */}
            <g className={animated && !closed ? 'kal-eyes' : undefined}>
              {closed
                ? eyeCx.map((x) => <path key={x} d={`M${x - 14} 106Q${x} 118 ${x + 14} 106`} stroke={C.navy} strokeWidth="4.5" strokeLinecap="round" fill="none" />)
                : eyeCx.map((x, i) => (
                  <g key={x}>
                    <ellipse cx={x} cy="106" rx={excited ? 16 : 14} ry={excited ? 19 : 17} fill={C.navy} />
                    <ellipse cx={x} cy="114" rx="9" ry="6" fill={C.mint} opacity=".4" />
                    <circle cx={x + 4} cy="98" r={excited ? 6.5 : 5.5} fill="#fff" />
                    <circle cx={x - 5} cy="112" r="2.6" fill="#fff" />
                    {mood === 'sad' && <ellipse cx={x + (i ? 6 : -6)} cy="120" rx="3" ry="2" fill="#fff" opacity=".7" />}
                  </g>
                ))}
            </g>
            {brows && brows.map((d, i) => <path key={i} d={d} stroke={C.navy} strokeWidth="4" strokeLinecap="round" fill="none" />)}
            {front && arms}
            {/* mouth */}
            {talking ? (
              <g transform="translate(0 0)"><g className="kal-talk"><ellipse cx="100" cy="140" rx="12" ry="9" fill="#3a1030" stroke={C.navy} strokeWidth="2.5" /><ellipse cx="100" cy="145" rx="6" ry="3" fill={C.coral} /></g></g>
            ) : mouthKind === 'open' ? (
              <g><path d={MOUTH_PATHS.open} fill="#3a1030" stroke={C.navy} strokeWidth="3" strokeLinejoin="round" /><ellipse cx="100" cy="150" rx="8" ry="4" fill={C.coral} /></g>
            ) : mouthKind === 'o' ? (
              <ellipse cx={mood === 'curious' ? 104 : 100} cy="141" rx="8" ry="10" fill="#3a1030" stroke={C.navy} strokeWidth="3" />
            ) : (
              <path d={MOUTH_PATHS[mouthKind]} stroke={C.navy} strokeWidth="4.5" strokeLinecap="round" fill="none" />
            )}
          </g>
        </g>
      </g>
    </svg>
  )
}

/** One-colour mark for tiny sizes (16-32 px). Uses currentColor. */
export function KoogAlienIcon({ size = 24, className, style, title = 'the Koog Alien' }: { size?: number | string; className?: string; style?: CSSProperties; title?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size} className={className} style={{ display: 'inline-block', ...style }} role="img" aria-label={title} fill="currentColor">
      <path d="M22 17L16 6M42 17L48 6" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <circle cx="15" cy="5.5" r="4.3" /><circle cx="49" cy="5.5" r="4.3" />
      <path fillRule="evenodd" d="M32 14C47 14 57 25 57 38C57 51 47 58 32 58C17 58 7 51 7 38C7 25 17 14 32 14ZM22 31C18.7 31 17 33.7 17 36.5S18.7 42 22 42S27 39.3 27 36.5S25.3 31 22 31ZM42 31C38.7 31 37 33.7 37 36.5S38.7 42 42 42S47 39.3 47 36.5S45.3 31 42 31ZM24 47Q32 53 40 47Q32 49.5 24 47Z" />
    </svg>
  )
}
