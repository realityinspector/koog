// How the Dancer looks and moves during an easter egg (costumes and props, drawn in the same stick style as the rig).
// dancer.ts owns the rig and calls these hooks while it paints him:
//   behind (stage, before him)  back (before his legs)  body (over his shirt)  front (after arms, before head)
//   head (in the head's own frame)  top (after head)  over (stage, after him)
// Everything is allocation-free per frame: fixed particle arrays, constant colour strings, no arrays or gradients built in a draw.
// Photosensitivity: nothing flashes. Lights glow slowly (under 1 Hz), flames wobble in place, the earthquake is a few pixels of shake.
// Reduced motion: no shake, no spinning, smaller hops, fewer particles.
import { eggInfo, type EggId } from './eggs'

const TAU = Math.PI * 2
const PI = Math.PI
const INK = '#241634'
const sm = (x: number) => { const t = x <= 0 ? 0 : x >= 1 ? 1 : x; return t * t * (3 - 2 * t) }
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const pos = (v: number) => (v > 0 ? v : 0)

/** where things are on his body this frame (guy frame, pixels). dancer.ts fills it in drawGuy. */
export interface Anchor {
  u: number; R: number; hipX: number; hipY: number; nx: number; ny: number; ux: number; uy: number; rx: number; ry: number; tls: number
  lean: number; sx: number; tn: number; floorY: number; lhx: number; lhy: number; rhx: number; rhy: number; fyAvg: number
  headX: number; headY: number; px: number; py: number; t: number; k: number; a: number; jh: number
}
/** the stage on screen (CSS pixels) for the over/behind layers */
export interface Stage { X: number; gy: number; sk: number; U: number; w: number; h: number; hx: number; hy: number; hr: number }
type Pose = Record<string, number>

export const SAY: Record<EggId, string> = {
  shave: 'Two bits!', birthday: 'Happy birthday!', scales: 'Scales!', ode: 'Ode to Joy!', twinkle: 'Look at all the stars!', chromatic: 'Rainbow!',
  woodpecker: 'Peck peck peck!', quake: 'Rumble!', pogo: 'Boing boing!', crown: 'Hail the crown!', clock: 'BONG!', wig: 'Quite fancy!', sleepy: 'Zzz…',
  dizzy: 'Whoa…', ghost: 'Boo!', surf: 'Surf\'s up!', santa: 'Ho ho ho!', lights: 'Fa la la la la!', present: 'A present for you!', snow: 'Silent night…',
  tree: 'O Christmas tree!', antlers: 'Click click click!', sleigh: 'Over the river!', pilgrim: 'Thank you!', pie: 'Mmm, pie!', turkey: 'Gobble gobble!',
}

// ---- fixed particle pool: 0 bubble, 1 snow, 2 star, 3 puff, 4 Z, 5 foam
const NP = 56
const P_X = new Float32Array(NP), P_Y = new Float32Array(NP), P_VX = new Float32Array(NP), P_VY = new Float32Array(NP)
const P_T = new Float32Array(NP), P_L = new Float32Array(NP), P_K = new Uint8Array(NP), P_S = new Float32Array(NP)

// beard blobs in head radii: x, y, r (a ring of bubbles round the jaw, then a second row)
const BEARD = [
  [-0.98, 0.1, 0.24], [-0.96, 0.38, 0.27], [-0.82, 0.66, 0.29], [-0.6, 0.9, 0.3], [-0.32, 1.06, 0.3], [0, 1.12, 0.32], [0.32, 1.06, 0.3], [0.6, 0.9, 0.3], [0.82, 0.66, 0.29], [0.96, 0.38, 0.27], [0.98, 0.1, 0.24],
  [-0.62, 0.74, 0.24], [-0.34, 0.86, 0.25], [0, 0.9, 0.26], [0.34, 0.86, 0.25], [0.62, 0.74, 0.24],
]
const FEATHER = ['hsl(8,75%,48%)', 'hsl(26,85%,50%)', 'hsl(42,90%,52%)', 'hsl(26,85%,50%)', 'hsl(8,75%,48%)', 'hsl(32,80%,46%)', 'hsl(18,80%,44%)']
const LIGHTS = ['#ff4d5a', '#ffd23f', '#3ddc84', '#4da3ff', '#ff7ad9']
const RAINBOW = ['#ff4d4d', '#ff9f43', '#ffd93d', '#4cd964', '#4da3ff', '#8e5cf6']

export interface EggFx {
  id: EggId | null; t0: number; dur: number; A: Anchor; S: Stage
  start(id: EggId, now: number): void
  stop(): void
  tick(now: number, dt: number): void
  /** 0..1 progress, or -1 when no egg */
  k(now: number): number
  pose(q: Pose, now: number): number
  behind(ctx: CanvasRenderingContext2D, now: number): void
  back(ctx: CanvasRenderingContext2D): void
  body(ctx: CanvasRenderingContext2D): void
  front(ctx: CanvasRenderingContext2D): void
  head(ctx: CanvasRenderingContext2D): void
  top(ctx: CanvasRenderingContext2D): void
  over(ctx: CanvasRenderingContext2D, now: number): void
  /** fish takes the place of the whole dancer; returns false when he should be drawn normally */
  fish(ctx: CanvasRenderingContext2D, now: number): boolean
  /** sideways shake in px for the earthquake (0 when none or reduced) */
  shake(now: number): number
}

export function createEggFx(reduced: boolean): EggFx {
  const A: Anchor = { u: 25, R: 37, hipX: 0, hipY: 0, nx: 0, ny: 0, ux: 0, uy: -1, rx: 1, ry: 0, tls: 1, lean: 0, sx: 1, tn: 0, floorY: 0, lhx: 0, lhy: 0, rhx: 0, rhy: 0, fyAvg: 0, headX: 0, headY: 0, px: 0, py: 0, t: 0, k: 0, a: 1, jh: 0 }
  const S: Stage = { X: 0, gy: 0, sk: 1, U: 25, w: 800, h: 500, hx: 400, hy: 200, hr: 30 }
  const fx = { id: null as EggId | null, t0: 0, dur: 0, A, S } as EggFx & { id: EggId | null }
  let live = 0, spawnAt = 0, seed = 1
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const cap = reduced ? 0.4 : 1

  function spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number) {
    let i = -1
    for (let j = 0; j < NP; j++) if (P_L[j] <= 0) { i = j; break }
    if (i < 0 || (i > NP * cap)) return
    P_X[i] = x; P_Y[i] = y; P_VX[i] = vx; P_VY[i] = vy; P_T[i] = 0; P_L[i] = life; P_K[i] = kind; P_S[i] = size
    live++
  }
  const at = (a: number, b: number) => { A.px = A.hipX + A.rx * a * A.u + A.ux * b * A.u * A.tls; A.py = A.hipY + A.ry * a * A.u + A.uy * b * A.u * A.tls }
  const star = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0) => {
    ctx.beginPath()
    for (let i = 0; i < 10; i++) { const a = rot - PI / 2 + (i * PI) / 5, d = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) }
    ctx.closePath()
  }
  const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill() }

  fx.start = (id, now) => {
    fx.id = id; fx.t0 = now; fx.dur = eggInfo(id).dur; spawnAt = now; live = 0
    for (let i = 0; i < NP; i++) P_L[i] = 0
    // a little poof when the costume appears
    if (id !== 'sleepy') for (let i = 0; i < 5; i++) spawn(3, S.hx + (rnd() - 0.5) * S.hr * 2, S.hy + S.hr * 0.4, (rnd() - 0.5) * 40, -10 - rnd() * 20, 0.7, S.U * 0.5)
  }
  fx.stop = () => { fx.id = null; for (let i = 0; i < NP; i++) P_L[i] = 0; live = 0 }
  fx.k = (now) => (fx.id ? (now - fx.t0) / fx.dur : -1)

  fx.tick = (now, dt) => {
    const id = fx.id
    const ds = dt / 1000
    for (let i = 0; i < NP; i++) {
      if (P_L[i] <= 0) continue
      P_T[i] += ds
      if (P_T[i] >= P_L[i]) { P_L[i] = 0; live--; continue }
      P_X[i] += P_VX[i] * ds; P_Y[i] += P_VY[i] * ds
      if (P_K[i] === 1) P_X[i] += Math.sin(P_T[i] * 2 + i) * 14 * ds * cap
    }
    if (!id) return
    const U = S.U, since = now - spawnAt
    const every = (ms: number) => { if (since > ms) { spawnAt = now; return true } return false }
    switch (id) {
      case 'snow': if (every(reduced ? 200 : 60)) spawn(1, S.w * (0.1 + 0.8 * rnd()), -6, (rnd() - 0.5) * 12, 90 + rnd() * 50, (S.gy + 10) / 90, U * 0.16); break
      case 'twinkle': if (every(reduced ? 500 : 240)) spawn(2, S.hx + (rnd() - 0.5) * U * 9, S.gy - U * 1 + rnd() * U * 2, (rnd() - 0.5) * 10, -22 - rnd() * 18, 2.6, U * (0.3 + rnd() * 0.3)); break
      case 'sleepy': if (every(1100)) spawn(4, S.hx + S.hr * 0.9, S.hy - S.hr * 0.8, 14, -26, 2.2, U * 0.8); break
      case 'quake': if (every(reduced ? 300 : 120)) spawn(3, S.X + (rnd() - 0.5) * U * 10, S.gy + U * 0.3, (rnd() - 0.5) * 40, -30 - rnd() * 30, 1.0, U * 0.8); break
      case 'sleigh': if (every(140)) spawn(3, S.X - A.sx * U * 2.4, S.gy, -A.sx * 20, -8, 0.7, U * 0.4); break
      case 'woodpecker': if (every(400)) spawn(3, S.hx + S.hr, S.hy - S.hr * 0.4, 30, -30, 0.5, U * 0.2); break
      case 'chromatic': break
      default: break
    }
  }

  // ---- poses: write into the dancer's pose record (angles as in dancer.ts); weight is applied by the caller
  fx.pose = (q, now) => {
    const id = fx.id
    if (!id) return 0
    const t = (now - fx.t0) / 1000, k = (now - fx.t0) / fx.dur, c = reduced ? 0.5 : 1
    const env = sm(t / 0.3) * sm((fx.dur / 1000 - t) / 0.4)
    const s = Math.sin
    switch (id) {
      case 'shave': q.ra1 = 0.75; q.ra2 = -2.3 + 0.18 * s(t * 5) * c; q.la1 = 0.3; q.la2 = 0.2; q.nod = 0.1; break // a hand strokes the foam beard
      case 'birthday': {
        q.la1 = 0.95; q.la2 = -1.55; q.ra1 = 0.95; q.ra2 = -1.55; q.y -= 0.2
        const b = sm((k - 0.72) / 0.1) * (1 - sm((k - 0.92) / 0.06)) // a little bow, cake and all
        q.bow = b; q.nod = 0.9 * b; break
      }
      case 'ode': q.ra1 = 1.9 + 0.5 * s(t * 5.2) * c; q.ra2 = -0.7 + 0.3 * s(t * 5.2 + 1) * c; q.la1 = 1.2 + 0.4 * s(t * 5.2 + 2) * c; q.la2 = 0.3; q.lean = 0.05 * s(t * 2.6) * c; q.nod = -0.1; break
      case 'twinkle': q.la1 = 2.5; q.ra1 = 2.5; q.la2 = 0.2; q.ra2 = 0.2; q.y += 0.35 + 0.25 * s(t * 2) * c; q.lfy = 0.4; q.rfy = 0.4; q.tilt = 0.08 * s(t * 1.3) * c; break
      case 'chromatic': q.la1 = 1.7 + 0.6 * s(t * 4) * c; q.ra1 = 1.7 - 0.6 * s(t * 4) * c; q.la2 = 0.2; q.ra2 = 0.2; q.tilt = 0.1 * s(t * 4) * c; break
      case 'woodpecker': q.nod += 0.1 + 0.9 * pos(s(t * 14 * (reduced ? 0.5 : 1))); q.lean += 0.12 * pos(s(t * 14 * (reduced ? 0.5 : 1))); q.la1 = 0.5; q.ra1 = 0.5; q.la2 = 1.4; q.ra2 = 1.4; break
      case 'quake': q.la1 = 1.8 + 0.5 * s(t * 18) * c; q.ra1 = 1.8 - 0.5 * s(t * 18) * c; q.la2 = 0.3; q.ra2 = 0.3; q.knee = 1; q.y -= 0.35; q.lfx += 0.3; q.rfx += 0.3; break
      case 'pogo': q.la1 = 0.75; q.ra1 = 0.75; q.la2 = -1.6; q.ra2 = -1.6; q.lfx = 0.1; q.rfx = 0.1; q.nod = -0.1; break
      case 'crown': q.la1 = 0.8; q.ra1 = 0.8; q.la2 = 0.9; q.ra2 = 0.9; q.nod = -0.35; q.y += 0.1; q.lean = -0.04; break // chest out, chin up
      case 'clock': q.la1 = PI - 0.04; q.la2 = 0; q.ra1 = 1.6 + t * 0.9 * c; q.ra2 = 0; q.lfx = 0; q.rfx = 0; q.lean = 0; q.tilt = 0; q.nod = 0; break // his arms are the hands
      case 'wig': {
        const b = sm((k - 0.18) / 0.1) * (1 - sm((k - 0.42) / 0.1)) + sm((k - 0.7) / 0.08) * (1 - sm((k - 0.92) / 0.06)) * 0.7
        q.bow = b; q.nod = 0.7 * b; q.la1 = -0.4 * b + 0.3 * (1 - b); q.la2 = -1.0 * b + 0.2 * (1 - b); q.ra1 = 1.1 * b + 0.3 * (1 - b); q.ra2 = 0.25; break
      }
      case 'sleepy': q.nod = 1.1 * env; q.y -= 0.55 * env; q.la1 = 0.1; q.ra1 = 0.1; q.la2 = 0.15; q.ra2 = 0.15; q.lean = 0.07 * s(t * 1.1) * c * env; q.tilt = 0.12 * env; q.lfy = 0; q.rfy = 0; break
      case 'dizzy': q.lean = 0.28 * s(t * 6) * c; q.tilt = 0.25 * s(t * 6 + 1) * c; q.la1 = 1.5 + 0.8 * s(t * 5) * c; q.ra1 = 1.5 + 0.8 * s(t * 5 + 2) * c; q.la2 = 0.3; q.ra2 = 0.3; q.nod = 0.3; break
      case 'ghost': q.la1 = 2.3; q.ra1 = 2.3; q.la2 = -0.4; q.ra2 = -0.4; q.y += 0.5 + 0.3 * s(t * 2.4) * c; q.lfy = 0.5; q.rfy = 0.5; break
      case 'surf': q.y -= 1.0; q.la1 = 1.5 + 0.2 * s(t * 3) * c; q.ra1 = 1.5 - 0.2 * s(t * 3) * c; q.la2 = 0.2; q.ra2 = 0.2; q.lfx = 0.9; q.rfx = 0.9; q.lfy = 0; q.rfy = 0; q.lean = 0.12 + 0.05 * s(t * 3) * c; q.knee = 1; break
      case 'santa': q.la1 = 0.6; q.ra1 = 0.6; q.la2 = -1.3; q.ra2 = -1.3; q.y += 0.12 * s(t * 8) * c; q.nod = 0.15 + 0.15 * s(t * 8) * c; break // hands on his belly, ho ho ho
      case 'lights': q.la1 = 1.2 + 0.25 * s(t * 2) * c; q.ra1 = 1.2 - 0.25 * s(t * 2) * c; q.la2 = 0.4; q.ra2 = 0.4; q.tilt = 0.06 * s(t * 2) * c; break
      case 'present': q.ra1 = 1.35; q.ra2 = -0.15; q.la1 = 0.35; q.la2 = 0.25; q.bow = 0.35 * sm((k - 0.5) / 0.15) * (1 - sm((k - 0.85) / 0.1)); q.lean = 0.04; break
      case 'snow': q.ra1 = 0.95; q.ra2 = -1.85; q.la1 = 0.3; q.la2 = 0.3; q.nod = 0.35; q.lean = 0.05 * s(t * 1.2) * c; q.tilt = 0.08; break
      case 'tree': q.la1 = 2.1; q.ra1 = 2.1; q.la2 = 0.1; q.ra2 = 0.1; q.y -= 0.1; q.tilt = 0.05 * s(t * 1.5) * c; break
      case 'antlers': q.la1 = 0.9 + 0.5 * s(t * 8) * c; q.ra1 = 0.9 - 0.5 * s(t * 8) * c; q.la2 = 0.2; q.ra2 = 0.2; break
      case 'sleigh': q.y -= 0.9; q.la1 = 0.85; q.ra1 = 0.85; q.la2 = -1.2; q.ra2 = -1.2; q.lfx = 0.5; q.rfx = 0.5; q.lfy = 0; q.rfy = 0; q.knee = 1; q.lean = 0.1; break
      case 'pilgrim': q.la1 = 0.6; q.la2 = -2.0; q.ra1 = 0.25; q.ra2 = 0.2; q.bow = 0.6 * sm((k - 0.15) / 0.12) * (1 - sm((k - 0.4) / 0.12)); q.nod = 0.4 * q.bow; break
      case 'pie': {
        q.la1 = 0.95; q.la2 = -1.5; q.ra1 = 0.95; q.ra2 = -1.5
        q.nod = 0.35 * sm((k - 0.4) / 0.1) * (1 - sm((k - 0.6) / 0.1)); break
      }
      case 'turkey': q.la1 = 0.7 + 0.45 * pos(s(t * 7)) * c; q.ra1 = 0.7 + 0.45 * pos(-s(t * 7)) * c; q.la2 = 1.3; q.ra2 = 1.3; q.nod = 0.2 * s(t * 7) * c; q.lfx = 0.2; q.rfx = 0.2; q.y -= 0.15; break
      case 'scales': break
    }
    return 1
  }

  fx.shake = (now) => {
    if (fx.id !== 'quake' || reduced) return 0
    const t = (now - fx.t0) / fx.dur
    return t >= 1 ? 0 : Math.sin(now * 0.045) * 3.5 * (1 - t) * sm(t / 0.05)
  }

  // ---- stage layers
  fx.behind = (ctx, now) => {
    const id = fx.id
    if (!id) return
    const k = (now - fx.t0) / fx.dur, a = sm(k / 0.1) * sm((1 - k) / 0.15), U = S.U
    if (id === 'chromatic') {
      // a soft rainbow arc over the stage, drawn behind him
      ctx.save(); ctx.globalAlpha = 0.55 * a; ctx.lineCap = 'butt'; ctx.lineWidth = U * 0.42
      const cx = S.w / 2 + Math.sin((now - fx.t0) * 0.0012) * U * (reduced ? 0.3 : 1.2), cy = S.gy + U * 1.4, r0 = Math.min(S.w * 0.4, U * 14)
      for (let i = 0; i < 6; i++) { ctx.strokeStyle = RAINBOW[i]; ctx.beginPath(); ctx.arc(cx, cy, r0 - i * U * 0.42, PI, TAU); ctx.stroke() }
      ctx.restore()
    } else if (id === 'lights') {
      // a warm glow on the wall behind him that breathes slowly
      ctx.save(); ctx.globalAlpha = (0.1 + 0.04 * Math.sin((now - fx.t0) * 0.003)) * a; ctx.fillStyle = '#ffd7a0'
      ctx.beginPath(); ctx.ellipse(S.X, S.gy - U * 4, U * 6, U * 5, 0, 0, TAU); ctx.fill(); ctx.restore()
    } else if (id === 'quake') {
      ctx.save(); ctx.globalAlpha = 0.7 * a; ctx.strokeStyle = '#0d0818'; ctx.lineWidth = U * 0.12; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      for (let j = -1; j <= 1; j += 2) { ctx.beginPath(); ctx.moveTo(S.X, S.gy + U * 0.3); ctx.lineTo(S.X + j * U * 1.4, S.gy + U * 0.5); ctx.lineTo(S.X + j * U * 2.2, S.gy + U * 0.25); ctx.lineTo(S.X + j * U * 3.6, S.gy + U * 0.6); ctx.stroke() }
      ctx.restore()
    } else if (id === 'surf') {
      ctx.save(); ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = '#7fd3ff'; ctx.lineWidth = U * 0.18; ctx.lineCap = 'round'
      const ph = (now - fx.t0) * 0.004 * (reduced ? 0.3 : 1)
      for (let j = 0; j < 3; j++) { ctx.beginPath(); for (let i = 0; i <= 10; i++) { const x = S.X - U * 4.2 + i * U * 0.84, y = S.gy + U * (0.22 + 0.2 * j) + Math.sin(ph + i * 0.9 + j) * U * 0.16 * S.sk; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) } ctx.stroke() }
      ctx.restore()
    }
  }

  fx.over = (ctx, now) => {
    if (!fx.id && live <= 0) return
    const U = S.U
    ctx.save()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (let i = 0; i < NP; i++) {
      if (P_L[i] <= 0) continue
      const q = P_T[i] / P_L[i], a = q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85
      ctx.globalAlpha = Math.max(0, a)
      switch (P_K[i]) {
        case 1: ctx.fillStyle = '#fff'; dot(ctx, P_X[i], P_Y[i], P_S[i]); break
        case 2: ctx.fillStyle = '#ffe36b'; star(ctx, P_X[i], P_Y[i], P_S[i], P_T[i]); ctx.fill(); break
        case 3: ctx.fillStyle = 'rgba(235,230,255,0.8)'; dot(ctx, P_X[i], P_Y[i], P_S[i] * (0.5 + q)); break
        case 4: ctx.fillStyle = '#cfe0ff'; ctx.font = '800 ' + Math.round(P_S[i] * (0.7 + q * 0.5)) + 'px system-ui, sans-serif'; ctx.fillText('Z', P_X[i], P_Y[i]); break
        case 0: ctx.strokeStyle = 'rgba(190,235,255,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(P_X[i], P_Y[i], P_S[i], 0, TAU); ctx.stroke(); break
        default: ctx.fillStyle = '#fff'; dot(ctx, P_X[i], P_Y[i], P_S[i])
      }
    }
    ctx.restore()
    void now; void U
  }

  // ---- fish (the whole dancer, briefly)
  fx.fish = (ctx, now) => {
    if (fx.id !== 'scales') return false
    const k = (now - fx.t0) / fx.dur
    const grow = sm((k - 0.05) / 0.07) * sm((0.95 - k) / 0.07)
    if (grow <= 0.01) return false
    const u = A.u * (0.55 + 0.45 * grow)
    const swim = reduced ? 0.25 : 1
    const ox = Math.sin(k * TAU) * Math.min(S.w * 0.28, u * 7) * swim
    const dirn = Math.cos(k * TAU) >= 0 ? 1 : -1
    const t = (now - fx.t0) / 1000
    const cx = A.hipX + ox, cy = A.hipY - u * (1.6 + 0.35 * Math.sin(t * 2.6) * (reduced ? 0.3 : 1))
    const wag = Math.sin(t * 9) * (reduced ? 0.12 : 0.3)
    ctx.save()
    ctx.translate(cx, cy); ctx.scale(dirn, 1)
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 0.16 * u
    // tail
    ctx.fillStyle = '#ff9e3d'
    ctx.save(); ctx.translate(-1.7 * u, 0); ctx.rotate(wag)
    ctx.beginPath(); ctx.moveTo(0.2 * u, 0); ctx.lineTo(-1.5 * u, -1.15 * u); ctx.quadraticCurveTo(-1.0 * u, 0, -1.5 * u, 1.15 * u); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore()
    // top and bottom fins
    ctx.beginPath(); ctx.moveTo(-0.6 * u, -1.0 * u); ctx.quadraticCurveTo(0, -2.0 * u, 0.9 * u, -1.0 * u); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-0.2 * u, 1.0 * u); ctx.quadraticCurveTo(0.2 * u, 1.7 * u, 0.7 * u, 1.0 * u); ctx.closePath(); ctx.fill(); ctx.stroke()
    // body
    ctx.fillStyle = '#4fc3d9'
    ctx.beginPath(); ctx.ellipse(0, 0, 2.1 * u, 1.35 * u, 0, 0, TAU); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = 'rgba(36,22,52,0.35)'; ctx.lineWidth = 0.1 * u
    for (let i = 0; i < 3; i++) for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.arc(-0.9 * u + i * 0.75 * u, j * 0.5 * u + (i % 2) * 0.22 * u, 0.3 * u, -0.9, 0.9); ctx.stroke() }
    // side fin
    ctx.strokeStyle = INK; ctx.lineWidth = 0.14 * u; ctx.fillStyle = '#ff9e3d'
    ctx.beginPath(); ctx.moveTo(-0.1 * u, 0.15 * u); ctx.quadraticCurveTo(-0.7 * u, 0.7 * u + wag * u, -1.0 * u, 0.1 * u); ctx.closePath(); ctx.fill(); ctx.stroke()
    // eye and mouth (his cowlick stays)
    ctx.fillStyle = '#fff'; ctx.lineWidth = 0.12 * u
    ctx.beginPath(); ctx.arc(1.05 * u, -0.38 * u, 0.42 * u, 0, TAU); ctx.fill(); ctx.stroke()
    ctx.fillStyle = INK; dot(ctx, 1.15 * u, -0.36 * u, 0.2 * u)
    ctx.lineWidth = 0.12 * u; ctx.beginPath(); ctx.arc(1.55 * u, 0.28 * u, 0.28 * u, 0.2, 1.6); ctx.stroke()
    ctx.strokeStyle = 'hsl(24,48%,24%)'; ctx.lineWidth = 0.2 * u
    ctx.beginPath(); ctx.moveTo(0.5 * u, -1.3 * u); ctx.quadraticCurveTo(0.7 * u, -1.9 * u, 1.1 * u, -1.7 * u); ctx.stroke()
    ctx.restore()
    // blub blub
    if (!reduced && ((now * 0.01) | 0) % 9 === 0) spawn(0, cx + dirn * 2.2 * u, cy - 0.3 * u, 6, -26, 1.1, u * 0.18)
    // where his "head" is, for speech bubbles
    A.headX = cx + dirn * 1.1 * u; A.headY = cy - 0.3 * u
    return true
  }

  // ---- costume layers
  const hat = (ctx: CanvasRenderingContext2D) => { void ctx }
  void hat

  function beard(ctx: CanvasRenderingContext2D, R: number, grow: number, clearX: number, fill: string, edge: string, sc = 1) {
    ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineWidth = R * 0.04
    for (let i = 0; i < BEARD.length; i++) {
      const b = BEARD[i], x = b[0] * R * sc, y = b[1] * R * (0.8 + 0.2 * sc) * grow, r = b[2] * R * grow * (sc > 1 ? 1.1 : 1)
      if (x < clearX) continue
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke()
    }
  }

  fx.back = (ctx) => {
    const id = fx.id
    if (!id) return
    const u = A.u
    switch (id) {
      case 'surf': {
        ctx.fillStyle = '#ff6f59'; ctx.strokeStyle = INK; ctx.lineWidth = 0.14 * u
        ctx.beginPath(); ctx.moveTo(A.hipX - 3.6 * u, A.floorY - 0.1 * u); ctx.quadraticCurveTo(A.hipX, A.floorY - 0.95 * u, A.hipX + 3.8 * u, A.floorY - 0.4 * u)
        ctx.quadraticCurveTo(A.hipX, A.floorY + 0.55 * u, A.hipX - 3.6 * u, A.floorY - 0.1 * u); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 0.18 * u
        ctx.beginPath(); ctx.moveTo(A.hipX - 2.6 * u, A.floorY - 0.12 * u); ctx.quadraticCurveTo(A.hipX, A.floorY - 0.4 * u, A.hipX + 2.6 * u, A.floorY - 0.3 * u); ctx.stroke()
        break
      }
      case 'sleigh': {
        ctx.strokeStyle = '#7b4a2a'; ctx.lineWidth = 0.28 * u
        ctx.beginPath(); ctx.moveTo(A.hipX - 3.2 * u, A.floorY - 0.9 * u); ctx.quadraticCurveTo(A.hipX - 3.7 * u, A.floorY + 0.1 * u, A.hipX - 2.6 * u, A.floorY + 0.05 * u); ctx.lineTo(A.hipX + 3.2 * u, A.floorY + 0.05 * u); ctx.stroke()
        ctx.fillStyle = '#c93b3b'; ctx.strokeStyle = INK; ctx.lineWidth = 0.14 * u
        ctx.beginPath(); ctx.moveTo(A.hipX - 3.3 * u, A.floorY - 2.6 * u); ctx.lineTo(A.hipX + 3.0 * u, A.floorY - 2.6 * u); ctx.lineTo(A.hipX + 2.7 * u, A.floorY - 0.4 * u); ctx.lineTo(A.hipX - 2.9 * u, A.floorY - 0.4 * u); ctx.closePath(); ctx.fill(); ctx.stroke()
        break
      }
      case 'turkey': {
        const cx = A.hipX, cy = A.hipY - 2.6 * u * 0.95
        ctx.strokeStyle = INK; ctx.lineWidth = 0.12 * u
        for (let i = 0; i < 7; i++) {
          const a = -PI / 2 + (i - 3) * 0.42 + Math.sin(A.t * 6 + i) * 0.03 * (reduced ? 0 : 1)
          ctx.fillStyle = FEATHER[i]
          ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 2.6 * u, cy + Math.sin(a) * 2.6 * u, 1.5 * u, 0.62 * u, a, 0, TAU); ctx.fill(); ctx.stroke()
        }
        break
      }
    }
  }

  fx.body = (ctx) => {
    const id = fx.id
    if (!id) return
    const u = A.u
    ctx.lineWidth = 0.13 * u; ctx.strokeStyle = INK
    switch (id) {
      case 'ode': {
        ctx.fillStyle = '#1b1426'
        at(-1.2, 2.75); const ax = A.px, ay = A.py; at(1.2, 2.75); const bx = A.px, by = A.py
        at(0.95, 0.35); const cx = A.px, cy = A.py; at(-0.95, 0.35); const dx = A.px, dy = A.py
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill(); ctx.stroke()
        // tails
        at(-0.6, 0.4); const t1x = A.px, t1y = A.py; at(0.6, 0.4); const t2x = A.px, t2y = A.py
        ctx.beginPath(); ctx.moveTo(t1x, t1y); ctx.lineTo(t1x - A.rx * 0.2 * u, t1y + 1.6 * u); ctx.lineTo(t1x + A.rx * 0.6 * u, t1y + 0.3 * u); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(t2x, t2y); ctx.lineTo(t2x + A.rx * 0.2 * u, t2y + 1.6 * u); ctx.lineTo(t2x - A.rx * 0.6 * u, t2y + 0.3 * u); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#fff'; at(0, 2.3); ctx.beginPath(); ctx.moveTo(A.px, A.py - 0.2 * u); ctx.lineTo(A.px + 0.5 * u, A.py + 1.0 * u); ctx.lineTo(A.px - 0.5 * u, A.py + 1.0 * u); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#d33'; at(0, 2.55); ctx.beginPath(); ctx.moveTo(A.px, A.py); ctx.lineTo(A.px + 0.55 * u, A.py - 0.28 * u); ctx.lineTo(A.px + 0.55 * u, A.py + 0.28 * u); ctx.lineTo(A.px - 0.55 * u, A.py - 0.28 * u); ctx.lineTo(A.px - 0.55 * u, A.py + 0.28 * u); ctx.closePath(); ctx.fill()
        break
      }
      case 'twinkle': {
        ctx.fillStyle = '#f2f4ff'
        at(-1.25, 2.75); const ax = A.px, ay = A.py; at(1.25, 2.75); const bx = A.px, by = A.py; at(0.95, 0.35); const cx = A.px, cy = A.py; at(-0.95, 0.35)
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(A.px, A.py); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#4d6bff'; at(-0.55, 1.9); ctx.fillRect(A.px - 0.1 * u, A.py - 0.1 * u, 1.1 * u, 0.7 * u)
        ctx.fillStyle = '#ff5a5a'; dot(ctx, A.px + 0.15 * u, A.py + 0.25 * u, 0.13 * u)
        ctx.fillStyle = '#3ddc84'; dot(ctx, A.px + 0.55 * u, A.py + 0.25 * u, 0.13 * u)
        break
      }
      case 'santa': {
        ctx.fillStyle = '#d0312d'
        at(-1.25, 2.75); const ax = A.px, ay = A.py; at(1.25, 2.75); const bx = A.px, by = A.py; at(0.95, 0.35); const cx = A.px, cy = A.py; at(-0.95, 0.35)
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(A.px, A.py); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#fff'; at(-1.0, 0.7); const x0 = A.px, y0 = A.py; at(1.0, 0.7)
        ctx.fillRect(Math.min(x0, A.px), Math.min(y0, A.py) - 0.15 * u, Math.abs(A.px - x0) + 0.01, 0.4 * u)
        ctx.fillStyle = '#222'; at(-0.95, 1.35); const x1 = A.px, y1 = A.py; at(0.95, 1.35)
        ctx.fillRect(Math.min(x1, A.px), Math.min(y1, A.py), Math.abs(A.px - x1) + 0.01, 0.34 * u)
        ctx.fillStyle = '#ffd23f'; at(0, 1.35); ctx.fillRect(A.px - 0.22 * u, A.py - 0.05 * u, 0.44 * u, 0.44 * u)
        break
      }
      case 'pilgrim': {
        ctx.fillStyle = '#2a2433'
        at(-1.25, 2.75); const ax = A.px, ay = A.py; at(1.25, 2.75); const bx = A.px, by = A.py; at(0.95, 0.35); const cx = A.px, cy = A.py; at(-0.95, 0.35)
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(A.px, A.py); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#fff'; at(0, 3.0); const nx = A.px, ny = A.py; at(-1.15, 2.7); const lx = A.px, ly = A.py; at(1.15, 2.7)
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(nx, ny); ctx.lineTo(A.px, A.py); ctx.lineTo(nx, ny + 1.2 * u * A.tls); ctx.closePath(); ctx.fill(); ctx.stroke()
        break
      }
      case 'tree': {
        ctx.strokeStyle = INK
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i === 1 ? '#1f8f4a' : '#27a85a'
          const top = 3.2 - i * 0.75, w2 = 1.35 + i * 0.5, bot = 2.2 - i * 0.75 - 0.2
          at(0, top); const tx = A.px, ty = A.py; at(-w2, bot); const lx = A.px, ly = A.py; at(w2, bot)
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(lx, ly); ctx.lineTo(A.px, A.py); ctx.closePath(); ctx.fill(); ctx.stroke()
        }
        const orn = ['#ff4d5a', '#ffd23f', '#4da3ff', '#ff4d5a', '#ffd23f']
        const spots = [[-0.7, 1.9], [0.6, 1.4], [-0.9, 0.9], [0.9, 0.6], [0, 0.35]]
        for (let i = 0; i < 5; i++) { at(spots[i][0], spots[i][1]); ctx.fillStyle = orn[i]; dot(ctx, A.px, A.py, 0.17 * u) }
        break
      }
      case 'lights': {
        ctx.strokeStyle = '#1d5a3a'; ctx.lineWidth = 0.08 * u
        const glow = 0.28 + 0.1 * Math.sin(A.t * 2.2)
        for (let i = 0; i < 7; i++) {
          const a = i % 2 ? 1.3 : -1.3, b = 2.7 - i * 0.38
          if (i === 0) { at(-1.3, 2.8); ctx.beginPath(); ctx.moveTo(A.px, A.py) } else { at(a, b); ctx.lineTo(A.px, A.py) }
        }
        ctx.stroke()
        for (let i = 1; i < 7; i++) {
          const a = i % 2 ? 1.3 : -1.3, b = 2.7 - i * 0.38
          at(a, b)
          ctx.globalAlpha = glow; ctx.fillStyle = LIGHTS[i % 5]; dot(ctx, A.px, A.py, 0.6 * u)
          ctx.globalAlpha = 1; dot(ctx, A.px, A.py, 0.28 * u); ctx.stroke()
        }
        break
      }
      case 'clock': {
        at(0, 1.75)
        ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = INK; ctx.lineWidth = 0.16 * u
        dot(ctx, A.px, A.py, 1.3 * u); ctx.stroke()
        ctx.lineWidth = 0.1 * u
        for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; ctx.beginPath(); ctx.moveTo(A.px + Math.cos(a) * 1.0 * u, A.py + Math.sin(a) * 1.0 * u); ctx.lineTo(A.px + Math.cos(a) * 1.2 * u, A.py + Math.sin(a) * 1.2 * u); ctx.stroke() }
        ctx.fillStyle = INK; dot(ctx, A.px, A.py, 0.14 * u)
        break
      }
    }
  }

  fx.front = (ctx) => {
    const id = fx.id
    if (!id) return
    const u = A.u
    ctx.lineWidth = 0.13 * u; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'
    switch (id) {
      case 'birthday': {
        const x = (A.lhx + A.rhx) / 2, y = Math.min(A.lhy, A.rhy) + 0.25 * u, wd = 1.5 * u
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y + 0.15 * u, wd * 1.15, 0.28 * u, 0, 0, TAU); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#ff9ec7'; ctx.beginPath(); ctx.rect(x - wd, y - 0.75 * u, wd * 2, 0.9 * u); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.rect(x - wd * 0.68, y - 1.35 * u, wd * 1.36, 0.62 * u); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) dot(ctx, x + i * wd * 0.3, y - 0.75 * u, 0.2 * u)
        for (let i = -1; i <= 1; i++) {
          const cx = x + i * wd * 0.42
          ctx.fillStyle = i === 0 ? '#4da3ff' : '#ffd23f'; ctx.fillRect(cx - 0.07 * u, y - 1.9 * u, 0.14 * u, 0.58 * u)
          ctx.fillStyle = '#ff9f1c'; const wob = reduced ? 0 : Math.sin(A.t * 9 + i * 2) * 0.05 * u
          ctx.beginPath(); ctx.ellipse(cx + wob, y - 2.15 * u, 0.13 * u, 0.26 * u, 0, 0, TAU); ctx.fill()
        }
        break
      }
      case 'ode': {
        ctx.strokeStyle = '#f5efe0'; ctx.lineWidth = 0.1 * u
        ctx.beginPath(); ctx.moveTo(A.rhx, A.rhy); ctx.lineTo(A.rhx + 0.9 * u, A.rhy - 1.8 * u); ctx.stroke()
        ctx.strokeStyle = INK; ctx.lineWidth = 0.05 * u; ctx.beginPath(); ctx.moveTo(A.rhx, A.rhy); ctx.lineTo(A.rhx + 0.9 * u, A.rhy - 1.8 * u); ctx.stroke()
        break
      }
      case 'pogo': {
        const gx = (A.lhx + A.rhx) / 2, gy = (A.lhy + A.rhy) / 2
        ctx.strokeStyle = INK; ctx.lineWidth = 0.34 * u; ctx.beginPath(); ctx.moveTo(A.lhx - 0.25 * u, gy); ctx.lineTo(A.rhx + 0.25 * u, gy); ctx.stroke()
        ctx.strokeStyle = '#e24b4b'; ctx.lineWidth = 0.2 * u; ctx.beginPath(); ctx.moveTo(A.lhx - 0.25 * u, gy); ctx.lineTo(A.rhx + 0.25 * u, gy); ctx.stroke()
        const by = A.fyAvg + 0.25 * u
        ctx.strokeStyle = INK; ctx.lineWidth = 0.3 * u; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, by); ctx.stroke()
        ctx.strokeStyle = '#9aa4b2'; ctx.lineWidth = 0.18 * u; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, by); ctx.stroke()
        ctx.strokeStyle = INK; ctx.lineWidth = 0.1 * u
        const sp = by - gy
        ctx.beginPath(); ctx.moveTo(gx - 0.32 * u, by - sp * 0.55)
        for (let i = 0; i < 5; i++) ctx.lineTo(gx + (i % 2 ? -0.32 : 0.32) * u, by - sp * 0.55 + (i + 1) * sp * 0.08)
        ctx.stroke()
        ctx.fillStyle = INK; ctx.fillRect(gx - 0.5 * u, by - 0.05 * u, 1.0 * u, 0.2 * u)
        break
      }
      case 'present': {
        const x = A.rhx + 0.15 * u, y = A.rhy - 0.55 * u, s = 1.15 * u
        ctx.fillStyle = '#4da3ff'; ctx.beginPath(); ctx.rect(x - s / 2, y - s / 2, s, s); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 0.1 * u, y - s / 2, 0.2 * u, s); ctx.fillRect(x - s / 2, y - 0.1 * u, s, 0.2 * u)
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 0.14 * u
        ctx.beginPath(); ctx.ellipse(x - 0.28 * u, y - s / 2 - 0.2 * u, 0.28 * u, 0.2 * u, -0.5, 0, TAU); ctx.ellipse(x + 0.28 * u, y - s / 2 - 0.2 * u, 0.28 * u, 0.2 * u, 0.5, 0, TAU); ctx.stroke()
        break
      }
      case 'snow': {
        const x = A.rhx, y = A.rhy - 0.2 * u
        ctx.fillStyle = '#f7f1dd'; ctx.beginPath(); ctx.rect(x - 0.17 * u, y - 0.9 * u, 0.34 * u, 0.9 * u); ctx.fill(); ctx.stroke()
        const wob = reduced ? 0 : Math.sin(A.t * 7) * 0.05 * u
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffd37a'; dot(ctx, x + wob, y - 1.25 * u, 0.7 * u)
        ctx.globalAlpha = 1; ctx.fillStyle = '#ff9f1c'; ctx.beginPath(); ctx.ellipse(x + wob, y - 1.25 * u, 0.13 * u, 0.3 * u, 0, 0, TAU); ctx.fill()
        break
      }
      case 'pie': {
        const x = (A.lhx + A.rhx) / 2, y = Math.min(A.lhy, A.rhy) + 0.2 * u, wd = 1.5 * u
        ctx.fillStyle = '#d9a35a'; ctx.beginPath(); ctx.moveTo(x - wd, y - 0.1 * u); ctx.lineTo(x + wd, y - 0.1 * u); ctx.lineTo(x + wd * 0.85, y + 0.4 * u); ctx.lineTo(x - wd * 0.85, y + 0.4 * u); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#e88a2d'; ctx.beginPath(); ctx.ellipse(x, y - 0.1 * u, wd, 0.7 * u, 0, PI, TAU); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#fff'; dot(ctx, x, y - 0.55 * u, 0.2 * u)
        const k = A.k
        if (k > 0.3 && k < 0.62) { // a slice goes up for a bite
          const q = sm((k - 0.3) / 0.14) * (1 - sm((k - 0.52) / 0.1))
          const sx2 = lerp(x + wd * 0.4, A.headX, q), sy2 = lerp(y - 0.2 * u, A.headY + A.R * 0.9, q)
          ctx.fillStyle = '#e88a2d'; ctx.beginPath(); ctx.moveTo(sx2, sy2 - 0.45 * u); ctx.lineTo(sx2 + 0.7 * u, sy2 + 0.2 * u); ctx.lineTo(sx2 - 0.7 * u, sy2 + 0.2 * u); ctx.closePath(); ctx.fill(); ctx.stroke()
        } else if (k >= 0.3) { ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(x + wd * 0.4, y - 0.1 * u); ctx.lineTo(x + wd * 0.75, y - 0.1 * u); ctx.lineTo(x + wd * 0.55, y - 0.6 * u); ctx.closePath(); ctx.fill() }
        break
      }
      case 'sleigh': {
        ctx.fillStyle = '#e04646'; ctx.beginPath(); ctx.moveTo(A.hipX - 3.3 * u, A.floorY - 1.55 * u); ctx.lineTo(A.hipX + 3.0 * u, A.floorY - 1.55 * u); ctx.lineTo(A.hipX + 2.7 * u, A.floorY - 0.4 * u); ctx.lineTo(A.hipX - 2.9 * u, A.floorY - 0.4 * u); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 0.16 * u; ctx.beginPath(); ctx.moveTo(A.hipX - 3.1 * u, A.floorY - 1.2 * u); ctx.lineTo(A.hipX + 2.85 * u, A.floorY - 1.2 * u); ctx.stroke()
        break
      }
    }
  }

  fx.head = (ctx) => {
    const id = fx.id
    if (!id) return
    const R = A.R, u = A.u, t = A.t, k = A.k
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 0.1 * u
    switch (id) {
      case 'shave': {
        const grow = sm(t / 0.35), sw = sm((t - (fx.dur / 1000 - 0.95)) / 0.6)
        const rx = lerp(-1.5 * R, 1.5 * R, sw)
        beard(ctx, R, grow, sw > 0 ? rx : -9 * R, '#fbfdff', '#b9cde0')
        if (sw > 0 && sw < 1) { // the razor swoosh
          ctx.save(); ctx.translate(rx, R * 0.55); ctx.rotate(-0.4)
          ctx.fillStyle = '#c9d3df'; ctx.beginPath(); ctx.rect(-0.5 * R, -0.12 * R, R, 0.24 * R); ctx.fill(); ctx.stroke()
          ctx.fillStyle = '#2f3b52'; ctx.fillRect(0.5 * R, -0.1 * R, 0.8 * R, 0.2 * R)
          ctx.restore()
        }
        break
      }
      case 'birthday': {
        ctx.fillStyle = '#ff6fb1'; ctx.beginPath(); ctx.moveTo(-0.5 * R, -0.95 * R); ctx.lineTo(0.05 * R, -2.0 * R); ctx.lineTo(0.55 * R, -0.95 * R); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#ffd23f'; dot(ctx, 0.05 * R, -2.02 * R, 0.14 * R)
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.08 * u; ctx.beginPath(); ctx.moveTo(-0.28 * R, -1.3 * R); ctx.lineTo(0.3 * R, -1.3 * R); ctx.stroke()
        break
      }
      case 'twinkle': {
        ctx.fillStyle = 'rgba(160,210,255,0.2)'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.12 * u
        dot(ctx, 0, -0.02 * R, 1.3 * R); ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.1 * u; ctx.beginPath(); ctx.arc(0, -0.02 * R, 1.08 * R, PI * 1.15, PI * 1.45); ctx.stroke()
        ctx.strokeStyle = INK; ctx.fillStyle = '#e8ecff'; ctx.beginPath(); ctx.rect(-0.9 * R, 1.12 * R, 1.8 * R, 0.3 * R); ctx.fill(); ctx.stroke()
        ctx.strokeStyle = '#c9d3df'; ctx.lineWidth = 0.1 * u; ctx.beginPath(); ctx.moveTo(1.0 * R, -1.0 * R); ctx.lineTo(1.25 * R, -1.65 * R); ctx.stroke()
        ctx.fillStyle = '#ff5a5a'; dot(ctx, 1.25 * R, -1.7 * R, 0.14 * R)
        break
      }
      case 'woodpecker': {
        ctx.fillStyle = '#e03c3c'
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo((-0.4 + i * 0.35) * R, -1.0 * R); ctx.quadraticCurveTo((-0.6 + i * 0.35) * R, -1.7 * R, (-0.9 + i * 0.5) * R, -1.8 * R + i * 0.12 * R); ctx.quadraticCurveTo((-0.1 + i * 0.3) * R, -1.45 * R, (0.0 + i * 0.35) * R, -0.98 * R); ctx.closePath(); ctx.fill(); ctx.stroke() }
        ctx.fillStyle = '#ffb22e'; ctx.beginPath(); ctx.moveTo(0.8 * R, -0.85 * R); ctx.lineTo(1.9 * R, -0.62 * R); ctx.lineTo(0.9 * R, -0.5 * R); ctx.closePath(); ctx.fill(); ctx.stroke()
        break
      }
      case 'crown': {
        ctx.fillStyle = '#ffcf2e'; ctx.beginPath(); ctx.moveTo(-0.62 * R, -0.9 * R); ctx.lineTo(-0.7 * R, -1.6 * R); ctx.lineTo(-0.3 * R, -1.25 * R); ctx.lineTo(0, -1.75 * R); ctx.lineTo(0.3 * R, -1.25 * R); ctx.lineTo(0.7 * R, -1.6 * R); ctx.lineTo(0.62 * R, -0.9 * R); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#e63b5a'; dot(ctx, 0, -1.1 * R, 0.1 * R); ctx.fillStyle = '#4da3ff'; dot(ctx, -0.35 * R, -1.08 * R, 0.07 * R); dot(ctx, 0.35 * R, -1.08 * R, 0.07 * R)
        break
      }
      case 'wig': {
        ctx.fillStyle = '#f4f1ff'; ctx.strokeStyle = '#b9b3d6'; ctx.lineWidth = 0.06 * u
        for (let i = 0; i < 7; i++) { const a = PI + 0.15 + (i * (PI - 0.3)) / 6; dot(ctx, Math.cos(a) * 1.08 * R, Math.sin(a) * 1.08 * R, 0.27 * R); ctx.stroke() }
        for (const s of [-1, 1]) for (let j = 0; j < 3; j++) { dot(ctx, s * 1.12 * R, (-0.1 + j * 0.34) * R, 0.24 * R); ctx.stroke() }
        ctx.fillStyle = '#1b1426'; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(-1.1 * R, 0.62 * R); ctx.lineTo(-1.45 * R, 0.5 * R); ctx.lineTo(-1.45 * R, 0.85 * R); ctx.closePath(); ctx.fill()
        break
      }
      case 'sleepy': {
        ctx.fillStyle = '#4d6bff'; ctx.beginPath(); ctx.moveTo(-1.0 * R, -0.5 * R); ctx.quadraticCurveTo(-0.5 * R, -1.9 * R, 0.5 * R, -1.3 * R); ctx.quadraticCurveTo(1.4 * R, -1.0 * R, 1.55 * R, -0.1 * R + Math.sin(t * 1.5) * 0.04 * R); ctx.lineTo(1.05 * R, -0.5 * R); ctx.quadraticCurveTo(0.2 * R, -0.85 * R, -0.4 * R, -0.7 * R); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#fff'; dot(ctx, 1.58 * R, -0.05 * R, 0.2 * R); ctx.stroke()
        break
      }
      case 'dizzy': {
        ctx.fillStyle = '#ffe36b'
        for (let i = 0; i < 4; i++) { const a = t * (reduced ? 1.5 : 5) + (i * TAU) / 4; star(ctx, Math.cos(a) * 1.1 * R, -1.15 * R + Math.sin(a) * 0.3 * R, 0.24 * R, a); ctx.fill(); ctx.stroke() }
        break
      }
      case 'santa': {
        const grow = sm(t / 0.4)
        beard(ctx, R, grow, -9 * R, '#ffffff', '#c9d3df', 1.12)
        ctx.fillStyle = '#d0312d'; ctx.beginPath(); ctx.moveTo(-1.05 * R, -0.55 * R); ctx.quadraticCurveTo(-0.9 * R, -1.9 * R, 0.5 * R, -1.8 * R); ctx.quadraticCurveTo(1.3 * R, -1.6 * R, 1.55 * R, -0.9 * R + Math.sin(t * 3) * 0.05 * R); ctx.lineTo(1.05 * R, -0.55 * R); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.rect(-1.1 * R, -0.78 * R, 2.2 * R, 0.3 * R); ctx.fill(); ctx.stroke()
        dot(ctx, 1.6 * R, -0.9 * R + Math.sin(t * 3) * 0.05 * R, 0.24 * R); ctx.stroke()
        break
      }
      case 'tree': {
        ctx.fillStyle = '#ffd23f'; star(ctx, 0, -1.75 * R, 0.5 * R, Math.sin(t * 1.5) * 0.1); ctx.fill(); ctx.stroke()
        break
      }
      case 'antlers': {
        ctx.strokeStyle = INK; ctx.lineWidth = 0.34 * u
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.55 * R, -0.95 * R); ctx.lineTo(s * 0.85 * R, -1.6 * R); ctx.moveTo(s * 0.72 * R, -1.3 * R); ctx.lineTo(s * 1.25 * R, -1.45 * R); ctx.moveTo(s * 0.85 * R, -1.6 * R); ctx.lineTo(s * 0.7 * R, -2.0 * R); ctx.stroke() }
        ctx.strokeStyle = '#a86a3a'; ctx.lineWidth = 0.2 * u
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.55 * R, -0.95 * R); ctx.lineTo(s * 0.85 * R, -1.6 * R); ctx.moveTo(s * 0.72 * R, -1.3 * R); ctx.lineTo(s * 1.25 * R, -1.45 * R); ctx.moveTo(s * 0.85 * R, -1.6 * R); ctx.lineTo(s * 0.7 * R, -2.0 * R); ctx.stroke() }
        break
      }
      case 'pilgrim': {
        ctx.fillStyle = '#2a2433'
        ctx.beginPath(); ctx.ellipse(0, -0.9 * R, 1.35 * R, 0.24 * R, 0, 0, TAU); ctx.fill(); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(-0.8 * R, -0.95 * R); ctx.lineTo(-0.65 * R, -2.0 * R); ctx.lineTo(0.65 * R, -2.0 * R); ctx.lineTo(0.8 * R, -0.95 * R); ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#fff'; ctx.fillRect(-0.78 * R, -1.22 * R, 1.56 * R, 0.24 * R)
        ctx.fillStyle = '#ffcf2e'; ctx.fillRect(-0.2 * R, -1.27 * R, 0.4 * R, 0.34 * R)
        break
      }
      case 'turkey': {
        for (let i = 0; i < 3; i++) { ctx.fillStyle = FEATHER[i * 2]; ctx.beginPath(); ctx.ellipse((-0.45 + i * 0.45) * R, -1.35 * R + Math.abs(i - 1) * 0.12 * R, 0.17 * R, 0.55 * R, (i - 1) * 0.4, 0, TAU); ctx.fill(); ctx.stroke() }
        ctx.fillStyle = '#e03c3c'; ctx.beginPath(); ctx.ellipse(0.1 * R, 1.12 * R, 0.2 * R, 0.34 * R, 0, 0, TAU); ctx.fill(); ctx.stroke()
        break
      }
      case 'ghost': break
    }
    void k
  }

  fx.top = (ctx) => {
    const id = fx.id
    if (!id) return
    const u = A.u
    if (id === 'ghost') {
      const bob = reduced ? 0 : Math.sin(A.t * 3) * 0.12 * u
      const top = A.headY - A.R * 1.5 + bob, bot = A.floorY - 0.3 * u, wd = 2.7 * u
      const cx = A.hipX
      ctx.save()
      ctx.globalAlpha = 0.93; ctx.fillStyle = '#f8f6ff'; ctx.strokeStyle = INK; ctx.lineWidth = 0.14 * u; ctx.lineJoin = 'round'
      ctx.beginPath(); ctx.moveTo(cx - wd, bot)
      ctx.lineTo(cx - wd * 1.05, A.headY); ctx.quadraticCurveTo(cx - wd * 0.9, top, cx, top); ctx.quadraticCurveTo(cx + wd * 0.9, top, cx + wd * 1.05, A.headY); ctx.lineTo(cx + wd, bot)
      const n = 5
      for (let i = 0; i < n; i++) { const x1 = cx + wd - ((i + 0.5) * wd * 2) / n, x2 = cx + wd - ((i + 1) * wd * 2) / n; ctx.quadraticCurveTo(x1, bot + 0.55 * u + (reduced ? 0 : Math.sin(A.t * 4 + i) * 0.15 * u), x2, bot) }
      ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.globalAlpha = 1; ctx.fillStyle = INK
      ctx.beginPath(); ctx.ellipse(cx - 0.75 * u, A.headY - 0.1 * u, 0.3 * u, 0.45 * u, 0, 0, TAU); ctx.ellipse(cx + 0.75 * u, A.headY - 0.1 * u, 0.3 * u, 0.45 * u, 0, 0, TAU); ctx.fill()
      ctx.beginPath(); ctx.ellipse(cx, A.headY + 0.85 * u, 0.28 * u, 0.4 * u, 0, 0, TAU); ctx.fill()
      ctx.restore()
    } else if (id === 'shave') {
      // (the razor swoosh is drawn in head space; nothing here)
    }
  }

  return fx
}
