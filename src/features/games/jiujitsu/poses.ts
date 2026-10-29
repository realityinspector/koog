// Stick-skeleton figures (forward kinematics) and hand-made poses for the two grapplers.
// World units: a standing grappler is about 1.45 tall. x runs left-right, y runs up from the mat.
// Angles are in degrees, 0 = +x, 90 = up, -90 = down. A pose is tweened by lerping its numbers.
export type V = [number, number]
export interface Fig {
  /** hip position (y is ignored when g is true: the figure is dropped onto the mat) */
  x: number; y: number
  /** torso angle (hip to neck) and head tilt */
  t: number; hd: number
  /** arms: [near upper, near lower, far upper, far lower] */
  a: [number, number, number, number]
  /** legs: [near thigh, near shin, far thigh, far shin] */
  l: [number, number, number, number]
  /** which way the face points in the head's own frame (1 = right when upright) */
  f: 1 | -1
  g?: boolean
}
export interface Pair { k: Fig; p: Fig }

export const LEN = { torso: 0.5, ua: 0.25, fa: 0.23, th: 0.32, sh: 0.31, head: 0.18 }
export interface Joints { hip: V; neck: V; head: V; e: [V, V]; h: [V, V]; kn: [V, V]; ft: [V, V] }

const rad = (d: number) => (d * Math.PI) / 180
const add = (p: V, deg: number, len: number): V => [p[0] + Math.cos(rad(deg)) * len, p[1] + Math.sin(rad(deg)) * len]

export function joints(f: Fig): Joints {
  const hip: V = [f.x, f.y]
  const neck = add(hip, f.t, LEN.torso)
  const head = add(neck, f.t + f.hd, LEN.head)
  const e0 = add(neck, f.a[0], LEN.ua), e1 = add(neck, f.a[2], LEN.ua)
  const k0 = add(hip, f.l[0], LEN.th), k1 = add(hip, f.l[2], LEN.th)
  return { hip, neck, head, e: [e0, e1], h: [add(e0, f.a[1], LEN.fa), add(e1, f.a[3], LEN.fa)], kn: [k0, k1], ft: [add(k0, f.l[1], LEN.sh), add(k1, f.l[3], LEN.sh)] }
}

/** Drop a figure onto the mat (so its lowest point just touches) and return it with fixed numbers. */
export function resolve(f: Fig): Fig {
  if (!f.g) return f
  const j = joints({ ...f, y: 0 })
  let lo = Math.min(j.hip[1] - 0.1, j.neck[1] - 0.1, j.head[1] - 0.13)
  for (let i = 0; i < 2; i++) lo = Math.min(lo, j.h[i][1] - 0.05, j.e[i][1] - 0.06, j.kn[i][1] - 0.08, j.ft[i][1] - 0.05)
  return { ...f, y: -lo, g: false }
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const lerpAng = (a: number, b: number, u: number) => {
  let d = (b - a) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return a + d * u
}
const lerp4 = (a: Fig['a'], b: Fig['a'], u: number): Fig['a'] => [lerpAng(a[0], b[0], u), lerpAng(a[1], b[1], u), lerpAng(a[2], b[2], u), lerpAng(a[3], b[3], u)]
export function lerpFig(a0: Fig, b0: Fig, u: number): Fig {
  const a = resolve(a0), b = resolve(b0)
  const f = {
    x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), t: lerpAng(a.t, b.t, u), hd: lerpAng(a.hd, b.hd, u),
    a: lerp4(a.a, b.a, u), l: lerp4(a.l, b.l, u), f: u < 0.5 ? a.f : b.f,
  }
  return f
}
export const lerpPair = (a: Pair, b: Pair, u: number): Pair => ({ k: lerpFig(a.k, b.k, u), p: lerpFig(a.p, b.p, u) })

export function mirror(f: Fig): Fig {
  const m = (v: number) => 180 - v
  return { x: -f.x, y: f.y, t: m(f.t), hd: -f.hd, a: f.a.map(m) as Fig['a'], l: f.l.map(m) as Fig['l'], f: (f.f === 1 ? -1 : 1) as 1 | -1, g: f.g }
}
const F = (x: number, y: number, t: number, hd: number, a: Fig['a'], l: Fig['l'], f: 1 | -1, g = true): Fig => ({ x, y, t, hd, a, l, f, g })

// ---- keyframes. K = the kid (white gi, faces right when standing), P = the partner. ----
export const READY: Pair = (() => {
  const k = F(-0.55, 0, 86, 0, [-45, 15, -30, 40], [-70, -100, -110, -85], 1)
  return { k, p: mirror({ ...k, x: -0.55, a: [-40, 25, -25, 50] }) }
})()
export const BOW: Pair = (() => {
  const k = F(-0.6, 0, 58, -14, [-80, -85, -78, -84], [-88, -92, -92, -88], 1)
  return { k, p: mirror({ ...k, x: -0.6 }) }
})()
const SHOT: Pair = {
  k: F(-0.1, 0, 38, -8, [-12, 8, 0, 25], [-15, -105, -140, -170], 1),
  p: F(0.55, 0, 52, 6, [35, 70, 60, 100], [-60, -120, -100, -70], -1),
}
const GUARD: Pair = {
  k: F(-0.34, 0, 82, 0, [-25, -10, -40, -20], [-60, -170, -65, -175], 1),
  p: F(0.26, 0, 0, 12, [20, 70, 30, 80], [128, 200, 138, 205], -1),
}
const PASS: Pair = {
  k: F(0.02, 0, 40, -6, [-15, -50, -5, -35], [-25, -115, -75, -165], 1),
  p: F(0.34, 0, 0, 10, [30, 80, 40, 90], [100, 178, 110, 182], -1),
}
const SIDE: Pair = {
  k: F(-0.05, 0.36, 12, -4, [-20, 30, 20, 80], [186, 190, 192, 195], 1, false),
  p: F(0.16, 0, 0, 8, [45, 100, 35, 120], [184, 188, 178, 184], -1),
}
const KOB: Pair = {
  k: F(0.22, 0.64, 84, 0, [-70, -20, -20, 10], [-100, -170, -50, -100], 1, false),
  p: F(0.14, 0, 0, 8, [50, 110, 40, 100], [184, 188, 178, 184], -1),
}
const MOUNT: Pair = {
  k: F(0.46, 0.34, 92, 0, [-60, -10, -40, 10], [-20, -100, -160, -80], 1, false),
  p: F(0.18, 0, 0, 10, [70, 100, 80, 110], [182, 184, 178, 180], -1),
}
const BACK: Pair = (() => {
  const p = mirror(F(-0.05, 0, 92, 4, [-45, 10, -30, 20], [-60, -170, -65, -175], 1))
  const k = F(0.5, 0, 76, 0, [165, 190, 150, 200], [190, 160, 183, 150], 1)
  return { k: { ...k, x: 0.46 }, p: { ...p, x: 0.02 } }
})()
const ROLL: Pair = {
  k: F(0.4, 0, 60, 0, [170, 185, 160, 190], [215, 170, 205, 160], 1),
  p: F(0.15, 0, 70, 5, [60, 110, 70, 100], [-100, -20, -120, -30], -1),
}
const CLIMB: Pair = {
  k: F(0.34, 0.5, 78, 0, [-45, -10, -30, 15], [-60, -130, -10, -90], 1, false),
  p: F(0.16, 0, 0, 8, [60, 105, 50, 105], [184, 188, 178, 184], -1),
}
const ARMBAR: Pair = {
  k: F(0.1, 0.22, 175, 5, [35, 80, 20, 70], [85, 115, 100, 130], 1, false),
  p: F(0.4, 0, 0, 8, [100, 85, 40, 90], [186, 188, 180, 186], -1),
}
const LEAP: Pair = {
  k: F(0.1, 0.9, 135, 5, [40, 70, 30, 60], [-20, -80, 10, -60], 1, false),
  p: F(0.5, 0, 70, 6, [60, 100, 50, 95], [-70, -110, -95, -75], -1),
}

/** The pose at the end of each rung, and the in-between pose a move passes through. */
export const RUNG_POSE: Pair[] = [READY, GUARD, SIDE, KOB, MOUNT, BACK, BACK]
export const VIA: Pair[][] = [[SHOT], [PASS], [CLIMB], [CLIMB], [ROLL], []]
export const POSES = { READY, BOW, SHOT, GUARD, PASS, SIDE, KOB, MOUNT, BACK, ROLL, CLIMB, ARMBAR, LEAP }
export const FLY: Pair[] = [LEAP]
export const ARMBAR_POSE = ARMBAR
