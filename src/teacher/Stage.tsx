import type { ReactNode } from 'react'
import './stage.css'

export const LOW = 48
export const HIGH = 84

/** Laptop screen rect in viewBox units (exact 16:10). The live app iframe sits over it. */
export const SCREEN = { x: 668, y: 76, w: 864, h: 540 }

export const CABLE_FROM = { x: 636, y: 704 }
export const CABLE_TO = { x: 790, y: 684 }
export const CABLE_D = 'M636 704 C 676 742, 720 736, 750 712 C 766 700, 776 690, 790 684'

const KB = { x: 30, y: 700, w: 620, h: 185 }
const KEYS = { x: 62, y: 772, w: 556, h: 100 }
const WHITE_PC = [0, 2, 4, 5, 7, 9, 11]
const NWHITE = 22
const KW = KEYS.w / NWHITE
const BW = 15.5
const BH = 62

export const ANCHORS = {
  keys: { x: Math.round(KEYS.x + 12.5 * KW), y: KEYS.y + 8 },
  cable: { x: 716, y: 728 },
  screen: { x: SCREEN.x + SCREEN.w * 0.5, y: SCREEN.y + 40 },
  student: { x: 262, y: 470 },
}

const COLORS = {
  in: { w: '#ffb347', b: '#ffd58f' },
  out: { w: '#ff6b8a', b: '#ffa3b7' },
  tonic: { w: '#5ef2c2', b: '#a4f8de' },
}

type Key = { note: number; x: number; black: boolean }
const KEYLIST: Key[] = (() => {
  const out: Key[] = []
  let wi = 0
  for (let n = LOW; n <= HIGH; n++) {
    const pc = n % 12
    if (WHITE_PC.includes(pc)) { out.push({ note: n, x: KEYS.x + wi * KW, black: false }); wi++ }
    else out.push({ note: n, x: KEYS.x + wi * KW - BW / 2, black: true })
  }
  return out
})()

function Speaker({ cx, cy }: { cx: number; cy: number }) {
  const dots: ReactNode[] = []
  const R = 27
  for (let r = 0; r <= 3; r++) {
    const rad = r * 7
    const count = r === 0 ? 1 : r * 6
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r * 0.3
      dots.push(<circle key={`${r}-${i}`} cx={cx + Math.cos(a) * rad} cy={cy + Math.sin(a) * rad} r={1.9} fill="#3a1015" opacity={0.75} />)
    }
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={R} fill="#a92f33" />
      <circle cx={cx} cy={cy} r={R - 3} fill="#c43a3d" />
      {dots}
    </g>
  )
}

export function Stage(props: { held: ReadonlySet<number>; lit?: 'in' | 'out' | 'tonic' | null; children?: ReactNode }) {
  const pal = COLORS[props.lit ?? 'in']
  const keyEl = (k: Key) => {
    const on = props.held.has(k.note)
    const fill = on ? (k.black ? pal.b : pal.w) : k.black ? '#241b33' : '#f6f0e6'
    return k.black ? (
      <rect key={k.note} className={'stage-key' + (on ? ' on' : '')} x={k.x} y={KEYS.y} width={BW} height={BH} rx={2.5} fill={fill} />
    ) : (
      <rect key={k.note} className={'stage-key' + (on ? ' on' : '')} x={k.x + 0.6} y={KEYS.y} width={KW - 1.2} height={KEYS.h} rx={3} fill={fill} />
    )
  }
  const bx = SCREEN.x - 24, by = SCREEN.y - 24, bw = SCREEN.w + 48, bh = SCREEN.h + 48
  return (
    <svg viewBox="0 0 1600 900" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="A student plays a small keyboard that is plugged into a laptop" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="stg-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#16122b" /><stop offset="1" stopColor="#221a40" /></linearGradient>
        <linearGradient id="stg-table" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2e2452" /><stop offset="1" stopColor="#1b1534" /></linearGradient>
        <linearGradient id="stg-wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#c58f58" /><stop offset="1" stopColor="#a97440" /></linearGradient>
        <linearGradient id="stg-lap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9c6d8" /><stop offset="1" stopColor="#9c99b2" /></linearGradient>
        <linearGradient id="stg-deck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dedbea" /><stop offset="1" stopColor="#b8b5cb" /></linearGradient>
      </defs>

      {/* backdrop */}
      <rect width="1600" height="900" fill="url(#stg-wall)" />
      <g opacity={0.55}>
        <rect x="50" y="60" width="270" height="230" rx="10" fill="#2a2150" />
        <rect x="64" y="74" width="116" height="202" rx="4" fill="#33295f" />
        <rect x="190" y="74" width="116" height="202" rx="4" fill="#33295f" />
        <circle cx="122" cy="130" r="26" fill="#3d3270" opacity={0.7} />
        <rect x="50" y="380" width="520" height="10" rx="3" fill="#2d2454" />
        {[[70, 40, '#3a2f6a'], [112, 52, '#4a3468'], [148, 34, '#2f3a6a'], [182, 46, '#45366e'], [240, 42, '#3a2f6a'], [284, 54, '#303a68']].map(([x, h, c], i) => (
          <rect key={i} x={Number(x) + 40} y={380 - Number(h)} width={30} height={Number(h)} rx={3} fill={String(c)} />
        ))}
      </g>

      {/* table */}
      <rect x="0" y="668" width="1600" height="232" fill="url(#stg-table)" />
      <rect x="0" y="668" width="1600" height="4" fill="#3a2f66" />

      {/* laptop */}
      <ellipse cx="1090" cy="696" rx="520" ry="13" fill="#000" opacity={0.28} />
      <path d="M628 640 H1572 L1588 688 Q1590 696 1580 696 H620 Q610 696 612 688 Z" fill="url(#stg-lap)" />
      <path d="M628 640 H1572 L1582 672 H618 Z" fill="url(#stg-deck)" />
      {[650, 656, 662].map((y, i) => <line key={y} x1={640 - i * 3} x2={1560 + i * 3} y1={y} y2={y} stroke="#9e9bb6" strokeWidth={1.5} opacity={0.5} />)}
      <rect x="1000" y="657" width="200" height="10" rx="4" fill="#aaa7c0" opacity={0.7} />
      <rect x="1000" y="640" width="200" height="8" rx="4" fill="#8e8ba6" />
      <rect x={bx} y={by} width={bw} height={bh} rx="24" fill="#2b2842" />
      <rect x={bx} y={by} width={bw} height={bh} rx="24" fill="none" stroke="#454264" strokeWidth="2" />
      <circle cx={SCREEN.x + SCREEN.w / 2} cy={by + 12} r="3.5" fill="#12101f" />
      <circle cx={SCREEN.x + SCREEN.w / 2} cy={by + 12} r="1.4" fill="#3d5a7a" />
      <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} fill="#0c0a18" />
      {/* laptop side port */}
      <rect x="786" y="676" width="22" height="12" rx="3" fill="#6d6a86" />

      {/* student: chair, body, head */}
      <rect x="120" y="590" width="280" height="130" rx="40" fill="#2d2456" />
      <path d="M150 710 L158 628 Q162 592 202 588 H322 Q362 592 366 628 L374 710 Z" fill="#37b3a4" />
      <path d="M232 586 Q262 612 292 586 Z" fill="#2d9488" />
      <rect x="244" y="552" width="36" height="44" rx="14" fill="#d79a6c" />
      <circle cx="262" cy="496" r="64" fill="#e8ae80" />
      <circle cx="204" cy="506" r="12" fill="#d79a6c" />
      <path d="M196 500 C190 420 262 408 300 426 C330 438 334 462 326 476 C300 462 262 456 238 474 C226 484 224 500 222 520 C212 520 204 514 196 500 Z" fill="#3a2a52" />
      <circle cx="288" cy="504" r="5.5" fill="#2a1f3d" />
      <circle cx="314" cy="504" r="5.5" fill="#2a1f3d" />
      <circle cx="290" cy="502" r="1.8" fill="#fff" />
      <circle cx="316" cy="502" r="1.8" fill="#fff" />
      <path d="M326 512 Q334 518 326 522" fill="none" stroke="#cf8e62" strokeWidth="3" strokeLinecap="round" />
      <path d="M288 526 Q302 542 318 526" fill="none" stroke="#9a4a3a" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="278" cy="522" rx="8" ry="5" fill="#f08c80" opacity={0.5} />

      {/* keyboard */}
      <ellipse cx="340" cy="888" rx="330" ry="12" fill="#000" opacity={0.3} />
      <rect x={KB.x} y={KB.y} width={KB.w} height={KB.h} rx="16" fill="url(#stg-wood)" />
      <rect x={KB.x + 30} y={KB.y} width={KB.w - 60} height={KB.h - 6} rx="10" fill="#d0403c" />
      <rect x={KB.x + 30} y={KB.y + KB.h - 22} width={KB.w - 60} height={16} rx="8" fill="#b23232" />
      <rect x={KB.x + 30} y={KB.y} width={KB.w - 60} height="6" rx="3" fill="#e5605a" />
      <Speaker cx={118} cy={735} />
      <Speaker cx={562} cy={735} />
      {/* tiny control area (no text) */}
      <rect x="262" y="718" width="116" height="36" rx="8" fill="#a92f33" />
      <rect x="272" y="726" width="40" height="12" rx="3" fill="#2a1a2e" />
      <rect x="276" y="729" width="18" height="6" rx="2" fill="#ffb347" opacity={0.75} />
      <circle cx="334" cy="732" r="7" fill="#f3d7c0" />
      <circle cx="334" cy="732" r="2" fill="#a92f33" />
      <circle cx="358" cy="732" r="7" fill="#f3d7c0" />
      <circle cx="358" cy="732" r="2" fill="#a92f33" />
      {[280, 296, 312, 328, 344, 360].map((x) => <rect key={x} x={x} y="745" width="10" height="5" rx="2.5" fill="#f3d7c0" opacity={0.85} />)}
      <rect x={KEYS.x - 4} y={KEYS.y - 5} width={KEYS.w + 8} height={KEYS.h + 9} rx="5" fill="#2a1a2e" />
      <g>{KEYLIST.filter((k) => !k.black).map(keyEl)}</g>
      <g>{KEYLIST.filter((k) => k.black).map(keyEl)}</g>

      {/* USB cable */}
      <path d={CABLE_D} fill="none" stroke="#14101f" strokeWidth="7" strokeLinecap="round" />
      <path d={CABLE_D} fill="none" stroke="#5b5878" strokeWidth="3.5" strokeLinecap="round" />

      {/* arms and hands (over keyboard) */}
      <path d="M182 622 L166 698" stroke="#37b3a4" strokeWidth="38" strokeLinecap="round" fill="none" />
      <path d="M166 698 L214 780" stroke="#e8ae80" strokeWidth="28" strokeLinecap="round" fill="none" />
      <path d="M342 622 L366 698" stroke="#2d9488" strokeWidth="38" strokeLinecap="round" fill="none" />
      <path d="M366 698 L318 780" stroke="#e8ae80" strokeWidth="28" strokeLinecap="round" fill="none" />
      <ellipse cx="216" cy="790" rx="24" ry="14" fill="#e8ae80" />
      <ellipse cx="316" cy="790" rx="24" ry="14" fill="#e8ae80" />
      {[-16, -8, 0, 8, 16].map((d) => <rect key={d} x={216 + d - 3} y={794} width={6} height={12} rx={3} fill="#e8ae80" />)}
      {[-16, -8, 0, 8, 16].map((d) => <rect key={d + 99} x={316 + d - 3} y={794} width={6} height={12} rx={3} fill="#e8ae80" />)}

      {props.children}
    </svg>
  )
}
