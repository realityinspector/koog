// The Koreographer stick-man: a tiny rig (hips, torso, head, 2-bone arms, 2-bone legs solved with IK) and one pose function
// per move. Pure math, no DOM, so the stage and the tests share it. u = how far through the move (0..1), k = size (small .6, big 1.4).
// Reduced motion: no spins, small hops, gentler everything (see `calm`).
import type { Arg, MoveId } from './engine'

export interface Pose {
  /** hip offset: x sideways, y up (body units) */
  x: number; y: number
  /** turn around the vertical axis, radians (0 = facing us) */
  turn: number
  /** torso lean (radians, + = to his right on screen) and head roll */
  lean: number; tilt: number
  /** 0..1 how far he is bowing */
  bow: number
  /** arms: [upper angle from hanging down, elbow bend], + = outward */
  la: [number, number]; ra: [number, number]
  /** feet: [sideways offset, lift] */
  lf: [number, number]; rf: [number, number]
  face: 'smile' | 'grin' | 'oh'
}
export const REST: Pose = { x: 0, y: 0, turn: 0, lean: 0, tilt: 0, bow: 0, la: [0.22, 0.15], ra: [0.22, 0.15], lf: [0, 0], rf: [0, 0], face: 'smile' }
const TAU = Math.PI * 2, PI = Math.PI
const S = (x: number) => Math.sin(x)
const hump = (u: number) => Math.abs(Math.sin(u * PI)) // 0 -> 1 -> 0
export const sizeOf = (a: Arg) => (a === 's' ? 0.6 : a === 'l' ? 1.45 : 1)

/** `beat` is the music's beat phase 0..1, used for the little idle bounce */
export function poseFor(move: MoveId | null, u: number, a: Arg, beat: number, calm = false): Pose {
  const p: Pose = { ...REST, la: [...REST.la], ra: [...REST.ra], lf: [0, 0], rf: [0, 0] }
  const k = sizeOf(a) * (calm ? 0.55 : 1)
  // idle: a soft bob on every beat
  const bob = 0.5 + 0.5 * Math.cos(beat * TAU)
  p.y = -0.12 * bob; p.la = [0.25 + 0.05 * bob, 0.2]; p.ra = [0.25 + 0.05 * bob, 0.2]
  if (!move) return p
  switch (move) {
    case 'sway': {
      const s = S(u * TAU)
      p.x = 0.5 * k * s; p.lean = -0.1 * s * k; p.tilt = 0.15 * s; p.la = [0.4 + 0.3 * s * k, 0.3]; p.ra = [0.4 - 0.3 * s * k, 0.3]
      p.lf = [0, 0.25 * Math.max(0, s)]; p.rf = [0, 0.25 * Math.max(0, -s)]; break
    }
    case 'jump': {
      const h = Math.abs(S(u * TAU))
      p.y = 1.5 * k * (calm ? 0.5 : 1) * h - 0.1; p.la = [0.5 + 2.2 * h, -0.2]; p.ra = [0.5 + 2.2 * h, -0.2]
      p.lf = [0.1, 0.7 * h * k]; p.rf = [0.1, 0.7 * h * k]; p.face = h > 0.5 ? 'oh' : 'grin'; break
    }
    case 'spin': {
      p.turn = calm ? 0.5 * S(u * TAU) : u * TAU * (a === 'l' ? 2 : 1)
      p.y = 0.25 * hump(u) * k; p.la = [1.5, 0.05]; p.ra = [1.5, 0.05]; p.lf = [0.25, 0]; p.rf = [0.25, 0.1 * hump(u)]; p.face = 'grin'; break
    }
    case 'moonwalk': {
      const g = hump(u)
      p.x = -1.8 * k * S(u * PI); const sl = S(u * TAU * 2)
      p.lf = [-0.5 * sl, 0.25 * Math.max(0, sl)]; p.rf = [0.5 * sl, 0.25 * Math.max(0, -sl)]
      p.lean = 0.12 * g; p.la = [0.5, 0.9]; p.ra = [0.5, 0.9]; p.y = -0.15; p.face = 'grin'; break
    }
    case 'waveL': case 'waveR': {
      const w = S(u * TAU * 3), up: [number, number] = [2.5 * (0.8 + 0.2 * k), 0.5 * w], dn: [number, number] = [0.25, 0.2]
      if (move === 'waveL') { p.la = up; p.ra = dn; p.tilt = -0.15 } else { p.ra = up; p.la = dn; p.tilt = 0.15 }
      p.x = (move === 'waveL' ? -0.15 : 0.15); p.face = 'grin'; break
    }
    case 'robot': {
      const q = Math.floor(u * 8) / 8, o = Math.floor(u * 8) % 2
      p.la = [o ? 1.57 : 0.4 + (q > 0.5 ? 1.2 : 0), o ? -1.57 : 0]; p.ra = [o ? 0.4 : 1.57, o ? 0 : -1.57]
      p.tilt = o ? 0.12 : -0.12; p.y = -0.1; p.lf = [0.25, 0]; p.rf = [0.25, 0]; p.x = 0.18 * (q - 0.5) * k; break
    }
    case 'clap': {
      const c = 0.5 + 0.5 * S(u * TAU * 4)
      p.la = [0.5 + 0.1 * c, -2.2 + 0.9 * c]; p.ra = [0.5 + 0.1 * c, -2.2 + 0.9 * c]
      p.y = -0.1 - 0.15 * c; p.face = 'grin'; break
    }
    case 'bow': {
      const b = Math.min(1, hump(u) * 1.6)
      p.bow = b * Math.min(1.2, k); p.la = [0.1, 0.2]; p.ra = [0.1, 0.2]; p.y = -0.25 * b; break
    }
    case 'shimmy': {
      const s = S(u * TAU * 8)
      p.x = 0.15 * s * k; p.lean = 0.12 * -s; p.tilt = 0.1 * s; p.la = [0.8, -1.7]; p.ra = [0.8, -1.7]; p.y = -0.22
      p.lf = [0.1, 0]; p.rf = [0.1, 0]; p.face = 'grin'; break
    }
    case 'sprinkler': {
      const st = Math.floor(u * 6) / 6
      p.ra = [1.55 + 0.3 * S(st * TAU), 0.0]; p.la = [2.3, -2.1]; p.tilt = 0.12; p.lean = 0.05 * S(st * TAU * 2); p.y = -0.12; break
    }
    case 'kick': {
      const first = u < 0.5, v = hump(first ? u * 2 : (u - 0.5) * 2) * k
      p.la = [1.2, 0]; p.ra = [1.2, 0]
      if (first) p.lf = [-0.2, 1.3 * v]; else p.rf = [-0.2, 1.3 * v]
      p.lean = (first ? -1 : 1) * 0.1 * v; p.y = 0.05; p.face = 'oh'; break
    }
  }
  return p
}

// ---- rig geometry (body units; y up, floor at 0)
export const G = { thigh: 1.1, shin: 1.1, torso: 1.7, neck: 0.25, head: 0.52, upper: 0.9, fore: 0.85, hipW: 0.3, shW: 0.5 }
export const STAND_HIP = G.thigh + G.shin - 0.1

export interface Rig {
  head: [number, number]; headR: number
  neck: [number, number]; hip: [number, number]
  lsh: [number, number]; lel: [number, number]; lha: [number, number]
  rsh: [number, number]; rel: [number, number]; rha: [number, number]
  lhip: [number, number]; lkn: [number, number]; lft: [number, number]
  rhip: [number, number]; rkn: [number, number]; rft: [number, number]
  /** horizontal squash from turning (cos), and whether we see his back */
  sx: number; back: boolean
}
/** 2-bone IK: knee position for a leg from hip to foot, knee bending toward `dir` (+1/-1 sideways) */
function ik(hx: number, hy: number, fx: number, fy: number, a: number, b: number, dir: number): [number, number] {
  let dx = fx - hx, dy = fy - hy
  let d = Math.hypot(dx, dy)
  const max = a + b - 0.001
  if (d > max) { dx *= max / d; dy *= max / d; d = max }
  const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d || 1)))
  const ang = Math.acos(cosA), base = Math.atan2(dy, dx)
  const t = base + ang * (dir > 0 ? 1 : -1)
  return [hx + Math.cos(t) * a, hy + Math.sin(t) * a]
}
export function rigOf(p: Pose): Rig {
  const cs = Math.cos(p.turn), sx = Math.abs(cs) < 0.12 ? 0.12 : Math.abs(cs), back = cs < -0.05
  const hx = p.x, hy = STAND_HIP + p.y
  const tl = G.torso * (1 - 0.22 * p.bow)
  const lean = p.lean - 0.9 * p.bow * 0
  const nx = hx + Math.sin(lean) * tl * 0 + Math.sin(p.lean) * tl, ny = hy + Math.cos(p.lean) * tl
  const bowDrop = p.bow * 0.5
  const head: [number, number] = [nx + Math.sin(p.tilt) * 0.2, ny + G.neck + G.head * 0.9 - bowDrop]
  const shY = ny - 0.12 - bowDrop * 0.6
  const arm = (side: number, [a1, a2]: [number, number]) => {
    const sh: [number, number] = [nx + side * G.shW * sx, shY]
    const el: [number, number] = [sh[0] + side * Math.sin(a1) * G.upper * (side * (side) > 0 ? 1 : 1) * sx * 1, sh[1] - Math.cos(a1) * G.upper]
    const t = a1 + a2
    const ha: [number, number] = [el[0] + side * Math.sin(t) * G.fore * sx, el[1] - Math.cos(t) * G.fore]
    return { sh, el, ha }
  }
  const L = arm(-1, p.la), Rr = arm(1, p.ra)
  const leg = (side: number, f: [number, number]) => {
    const hip: [number, number] = [hx + side * G.hipW * sx, hy]
    const ft: [number, number] = [hx + side * (G.hipW + 0.1 + f[0]) * sx, f[1]]
    const kn = ik(hip[0], hip[1], ft[0], ft[1], G.thigh, G.shin, side)
    return { hip, kn, ft }
  }
  const Ll = leg(-1, p.lf), Rl = leg(1, p.rf)
  return {
    head, headR: G.head, neck: [nx, ny], hip: [hx, hy],
    lsh: L.sh, lel: L.el, lha: L.ha, rsh: Rr.sh, rel: Rr.el, rha: Rr.ha,
    lhip: Ll.hip, lkn: Ll.kn, lft: Ll.ft, rhip: Rl.hip, rkn: Rl.kn, rft: Rl.ft, sx, back,
  }
}
