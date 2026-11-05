// Data and helpers for the Koog Alien mascot (components live in KoogAlien.tsx).
export type KoogAlienPose = 'wave' | 'cheer' | 'think' | 'sing' | 'dance' | 'sleep' | 'listen' | 'oops'
export type KoogAlienMood = 'happy' | 'excited' | 'curious' | 'proud' | 'sad'

export const POSES: KoogAlienPose[] = ['wave', 'cheer', 'think', 'sing', 'dance', 'sleep', 'listen', 'oops']
export const MOODS: KoogAlienMood[] = ['happy', 'excited', 'curious', 'proud', 'sad']

/** Brand tokens (same family as the Koog logo and favicon). */
export const KOOG_ALIEN_COLORS = {
  cream: '#fff4d8', gold: '#ffc35a', coral: '#ff6f61', purple: '#b44cff',
  navy: '#16122b', plum: '#2b1a40', knob: '#3a3160', mint: '#5fffd0', arm: '#ff8a6b',
} as const

/** An arm is a quadratic curve from the shoulder to the hand. */
export interface Arm { x1: number; y1: number; cx: number; cy: number; x2: number; y2: number }
export type Extra = 'none' | 'sparkles' | 'notes' | 'bubble' | 'zzz' | 'waves' | 'drop'
export type EyeStyle = 'open' | 'closed'

export interface PoseSpec {
  label: string; tilt: number; armL: Arm; armR: Arm
  antL: [number, number]; antR: [number, number]
  eyes: EyeStyle; extra: Extra; mouth?: 'open' | 'o' | 'sleep'
}

const restL: Arm = { x1: 46, y1: 138, cx: 26, cy: 150, x2: 26, y2: 172 }
const restR: Arm = { x1: 154, y1: 138, cx: 174, cy: 150, x2: 174, y2: 172 }

export const POSE_SPECS: Record<KoogAlienPose, PoseSpec> = {
  wave: { label: 'waving', tilt: 0, armL: restL, armR: { x1: 154, y1: 135, cx: 188, cy: 120, x2: 178, y2: 82 }, antL: [60, 26], antR: [140, 26], eyes: 'open', extra: 'none' },
  cheer: { label: 'cheering', tilt: 0, armL: { x1: 46, y1: 135, cx: 14, cy: 112, x2: 24, y2: 70 }, armR: { x1: 154, y1: 135, cx: 186, cy: 112, x2: 176, y2: 70 }, antL: [56, 24], antR: [144, 24], eyes: 'open', extra: 'sparkles', mouth: 'open' },
  think: { label: 'thinking', tilt: -3, armL: restL, armR: { x1: 154, y1: 138, cx: 150, cy: 176, x2: 126, y2: 152 }, antL: [60, 26], antR: [152, 34], eyes: 'open', extra: 'bubble' },
  sing: { label: 'singing', tilt: 0, armL: { x1: 46, y1: 135, cx: 20, cy: 135, x2: 20, y2: 112 }, armR: { x1: 154, y1: 135, cx: 180, cy: 135, x2: 180, y2: 112 }, antL: [58, 26], antR: [142, 26], eyes: 'open', extra: 'notes', mouth: 'o' },
  dance: { label: 'dancing', tilt: -8, armL: { x1: 46, y1: 135, cx: 18, cy: 118, x2: 28, y2: 84 }, armR: { x1: 154, y1: 138, cx: 178, cy: 150, x2: 178, y2: 168 }, antL: [54, 28], antR: [146, 22], eyes: 'open', extra: 'notes', mouth: 'open' },
  sleep: { label: 'sleeping', tilt: 0, armL: { x1: 46, y1: 138, cx: 52, cy: 176, x2: 84, y2: 172 }, armR: { x1: 154, y1: 138, cx: 148, cy: 176, x2: 116, y2: 172 }, antL: [64, 36], antR: [136, 36], eyes: 'closed', extra: 'zzz', mouth: 'sleep' },
  listen: { label: 'listening', tilt: 3, armL: restL, armR: { x1: 154, y1: 135, cx: 190, cy: 132, x2: 170, y2: 96 }, antL: [54, 28], antR: [150, 22], eyes: 'open', extra: 'waves' },
  oops: { label: 'saying oops', tilt: 0, armL: { x1: 46, y1: 135, cx: 18, cy: 110, x2: 62, y2: 70 }, armR: restR, antL: [66, 34], antR: [134, 34], eyes: 'open', extra: 'drop' },
}

export function poseLabel(pose: KoogAlienPose): string { return POSE_SPECS[pose].label }
export function altText(pose: KoogAlienPose): string { return `the Koog Alien, ${POSE_SPECS[pose].label}` }

/** Quadratic arm path string. */
export function armPath(a: Arm): string { return `M${a.x1} ${a.y1}Q${a.cx} ${a.cy} ${a.x2} ${a.y2}` }

/** Antenna stem: from the head to the knob, with a little curve. */
export function antennaPath(side: 'L' | 'R', tip: [number, number]): string {
  const bx = side === 'L' ? 80 : 120
  return `M${bx} 66Q${(bx + tip[0]) / 2 + (side === 'L' ? -4 : 4)} ${(66 + tip[1]) / 2 + 6} ${tip[0]} ${tip[1] + 6}`
}

/** Mouth variants. Stroke paths use navy; 'open' shapes are filled. */
export const MOUTH_PATHS = {
  smile: 'M84 134Q100 152 116 134',
  proud: 'M82 134Q100 150 118 134',
  sad: 'M88 145Q100 134 112 145',
  sleep: 'M92 138Q100 143 108 138',
  open: 'M82 131Q100 162 118 131Z',
} as const

export const BROW_PATHS: Partial<Record<KoogAlienMood, [string, string]>> = {
  curious: ['M60 80Q75 68 90 78', 'M110 88L138 88'],
  proud: ['M62 80Q76 73 90 80', 'M110 80Q124 73 138 80'],
  sad: ['M60 90L90 79', 'M110 79L140 90'],
}

/** Animation CSS, inlined in the SVG so the file works on its own. Everything stops under reduced motion. */
export const ANIM_CSS = `
.kal-bob{animation:kal-bob 3.6s ease-in-out infinite}
.kal-glow{animation:kal-glow 3.2s ease-in-out infinite}
.kal-eyes{animation:kal-blink 5.5s infinite;transform-box:fill-box;transform-origin:center}
.kal-wave{animation:kal-wave 1.6s ease-in-out infinite}
.kal-sway{animation:kal-sway 1.8s ease-in-out infinite}
.kal-cheer{animation:kal-cheer 1.4s ease-in-out infinite}
.kal-talk{animation:kal-talk .34s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes kal-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes kal-glow{0%,100%{opacity:.25}50%{opacity:.6}}
@keyframes kal-blink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
@keyframes kal-wave{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}
@keyframes kal-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes kal-cheer{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes kal-talk{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){.kal-bob,.kal-glow,.kal-eyes,.kal-wave,.kal-sway,.kal-cheer,.kal-talk{animation:none !important}}
`
