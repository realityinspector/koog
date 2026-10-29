// Confetti mode: every note fires a confetti cannon from its key. Pieces are pooled, drawn as
// colour-batched filled paths (no gradients / shadows per piece), and land into a cached, slowly
// fading "floor" canvas so the pile never fills the screen.
import type { Scene, SceneFactory, SceneKind } from './scenes'

const MAXP = 700
const HUES = 24
// special base colours after the 24 hue buckets: [front, back]
const SPECIAL: [string, string][] = [
  ['#ffd23a', '#d99a10'], // gold
  ['#ffe98a', '#e0b84a'], // light gold
  ['#ffffff', '#cdd5e6'], // white
  ['#d9dee8', '#9aa2b0'], // silver
  ['#9ba0aa', '#70757f'], // gray
  ['#6f747e', '#4d515a'], // dark gray
]
const GOLD = HUES, GOLD2 = HUES + 1, WHITE = HUES + 2, SILVER = HUES + 3, GRAY = HUES + 4, DGRAY = HUES + 5
const NB = HUES + SPECIAL.length
const COLORS: string[] = [] // index = base*2 + (back ? 1 : 0)
for (let i = 0; i < NB; i++) {
  if (i < HUES) {
    const h = i * (360 / HUES) + 7
    COLORS.push(`hsl(${h},95%,58%)`, `hsl(${h},88%,41%)`)
  } else COLORS.push(SPECIAL[i - HUES][0], SPECIAL[i - HUES][1])
}
const hueIdx = (h: number) => Math.floor((((h % 360) + 360) % 360) / (360 / HUES)) % HUES
const OFFS = [0, 0, 0, 30, -30, 60, -60, 150, 180, 210]

const R_RECT = 0, R_CIRCLE = 1, R_RIBBON = 2, R_STAR = 3
const STAR_X: number[] = [], STAR_Y: number[] = []
for (let i = 0; i < 10; i++) {
  const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.42 : 1
  STAR_X.push(Math.cos(a) * r)
  STAR_Y.push(Math.sin(a) * r)
}
const TAU = 6.283185307

interface Piece {
  x: number; y: number; vx: number; vy: number
  rot: number; vr: number; ph: number; vph: number
  size: number; age: number; max: number
  col: number; shape: number; drag: number
  sway: number; swf: number; swp: number; lo: number
  wv: number; len: number; c: number
}
interface Puff { x: number; y: number; vx: number; vy: number; r: number; age: number; max: number }
interface Held { x: number; kind: SceneKind; hue: number; v: number; acc: number; t: number }

let smokeSprite: HTMLCanvasElement | null = null
function smoke() {
  if (smokeSprite) return smokeSprite
  const c = document.createElement('canvas')
  c.width = c.height = 48
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(24, 24, 2, 24, 24, 24)
  gr.addColorStop(0, 'rgba(190,195,205,0.9)')
  gr.addColorStop(0.6, 'rgba(160,165,175,0.4)')
  gr.addColorStop(1, 'rgba(150,155,165,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 48, 48)
  smokeSprite = c
  return c
}

export const createConfetti: SceneFactory = (reduced): Scene => {
  const calm = reduced ? 0.5 : 1
  const spinK = reduced ? 0.15 : 1 // rotation speed
  const flipK = reduced ? 0.3 : 1 // 3D flip speed
  const G = 380 * (reduced ? 0.6 : 1)

  const pool: Piece[] = []
  for (let i = 0; i < MAXP; i++) {
    pool.push({ x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, ph: 0, vph: 0, size: 8, age: 0, max: 10, col: 0, shape: 0, drag: 4, sway: 0, swf: 1, swp: 0, lo: 0, wv: 8, len: 1, c: 1 })
  }
  let n = 0
  const puffs: Puff[] = []
  const held = new Map<number, Held>()
  const keys = new Uint8Array(MAXP)
  const order = new Int16Array(MAXP)
  const counts = new Int16Array(NB * 2 + 1)

  let W = 0, H = 0, curQ = 1, last = 0
  let floor: HTMLCanvasElement | null = null
  let fg: CanvasRenderingContext2D | null = null
  let floorT = 0

  const scale = () => Math.max(0.8, Math.min(1.4, Math.min(W, H) / 700))
  const cap = () => Math.min(MAXP, Math.floor(MAXP * Math.max(0.35, Math.min(1, curQ))))
  const qf = () => Math.max(0.5, Math.min(1, curQ))

  function buildFloor() {
    if (W <= 0 || H <= 0) { floor = null; fg = null; return }
    const fs = Math.min(1.5, window.devicePixelRatio || 1)
    floor = document.createElement('canvas')
    floor.width = Math.max(1, Math.round(W * fs))
    floor.height = Math.max(1, Math.round(H * fs))
    fg = floor.getContext('2d')
    if (fg) fg.scale(fs, fs)
  }

  function pickColor(kind: SceneKind, hue: number, shape: number): number {
    const r = Math.random()
    if (kind === 'tonic') {
      if (shape === R_STAR) return r < 0.7 ? GOLD : GOLD2
      if (r < 0.45) return GOLD
      if (r < 0.8) return WHITE
      if (r < 0.92) return GOLD2
      return hueIdx(hue + OFFS[Math.floor(Math.random() * OFFS.length)])
    }
    if (kind === 'spicy') {
      if (r < 0.4) return SILVER
      if (r < 0.7) return GRAY
      if (r < 0.88) return DGRAY
      return hueIdx(hue)
    }
    if (r < 0.08) return WHITE
    return hueIdx(hue + OFFS[Math.floor(Math.random() * OFFS.length)])
  }

  function pickShape(kind: SceneKind): number {
    const r = Math.random()
    if (kind === 'tonic') return r < 0.3 ? R_RECT : r < 0.4 ? R_CIRCLE : r < 0.75 ? R_RIBBON : R_STAR
    if (kind === 'spicy') return r < 0.6 ? R_RECT : r < 0.9 ? R_CIRCLE : R_RIBBON
    return r < 0.5 ? R_RECT : r < 0.7 ? R_CIRCLE : r < 0.9 ? R_RIBBON : R_STAR
  }

  /** one piece launched from (x,y) at angle a (0 = straight up), reaching ~frac*H high */
  function launch(x: number, y: number, a: number, frac: number, kind: SceneKind, hue: number) {
    if (n >= cap()) return
    const shape = pickShape(kind)
    const p = pool[n++]
    const d = 3.2 + Math.random() * 2.3
    const v0 = d * H * frac * (0.5 + Math.random() * 0.5)
    p.x = x; p.y = y
    p.vx = Math.sin(a) * v0
    p.vy = -Math.cos(a) * v0
    p.drag = d
    fill(p, kind, hue, shape)
  }

  function fill(p: Piece, kind: SceneKind, hue: number, shape: number) {
    const s = scale()
    p.shape = shape
    p.col = pickColor(kind, hue, shape)
    p.size = (6.5 + Math.random() * 5) * s * (kind === 'tonic' ? 1.2 : kind === 'spicy' ? 0.9 : 1)
    p.rot = Math.random() * TAU
    p.vr = (Math.random() - 0.5) * (shape === R_STAR ? 14 : 8) * spinK
    p.ph = Math.random() * TAU
    p.vph = (6 + Math.random() * 10) * flipK
    p.age = 0
    p.max = 11 + Math.random() * 3
    p.sway = (14 + Math.random() * 26) * calm
    p.swf = 2 + Math.random() * 2.5
    p.swp = Math.random() * TAU
    p.lo = 2 + Math.random() * 14
    p.wv = kind === 'tonic' ? 12 + Math.random() * 4 : 7 + Math.random() * 3
    p.len = kind === 'tonic' ? 1.7 : 1
    p.c = 1
  }

  function burst(x: number, y: number, count: number, a0: number, spread: number, frac: number, kind: SceneKind, hue: number) {
    for (let i = 0; i < count; i++) launch(x, y, a0 + (Math.random() - 0.5) * 2 * spread, frac, kind, hue)
  }

  function addPuff(x: number, y: number) {
    if (puffs.length >= 16) return
    puffs.push({ x: x + (Math.random() - 0.5) * 20, y: y - 4, vx: (Math.random() - 0.5) * 24, vy: -(24 + Math.random() * 30) * calm, r: 14 + Math.random() * 12, age: 0, max: 1.3 + Math.random() * 0.5 })
  }

  function rain(count: number, W0: number) {
    for (let i = 0; i < count && n < cap(); i++) {
      const p = pool[n++]
      p.x = Math.random() * W0
      p.y = -10 - Math.random() * 50
      p.vx = (Math.random() - 0.5) * 30
      p.vy = 30 + Math.random() * 60
      p.drag = 3 + Math.random() * 2
      fill(p, 'in', Math.random() * 360, pickShape('in'))
    }
  }

  function stamp(p: Piece) {
    if (!fg) return
    fg.fillStyle = COLORS[p.col * 2]
    const w = p.shape === R_RIBBON ? p.size * 1.8 : p.size * 0.9
    const h = p.shape === R_RIBBON ? p.size * 0.28 : p.size * 0.4
    fg.fillRect(p.x - w / 2, p.y - h / 2, w, h)
  }

  function step(dt: number) {
    // held-key trickle
    if (held.size) {
      const tNow = last / 1000
      for (const [k, hd] of held) {
        if (tNow - hd.t > 12) { held.delete(k); continue }
        const rate = (hd.kind === 'tonic' ? 11 : hd.kind === 'spicy' ? 2.5 : 7) * calm * qf()
        hd.acc += rate * dt
        while (hd.acc >= 1) {
          hd.acc -= 1
          launch(hd.x, H, (Math.random() - 0.5) * 0.6, 0.1 + 0.12 * hd.v, hd.kind, hd.hue)
        }
        if (hd.kind === 'spicy' && Math.random() < dt * 1.2) addPuff(hd.x, H)
      }
    }
    // pieces
    for (let i = n - 1; i >= 0; i--) {
      const p = pool[i]
      p.age += dt
      const e = Math.exp(-p.drag * dt)
      p.vx *= e
      p.vy = p.vy * e + G * dt
      p.ph += p.vph * dt
      p.rot += p.vr * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.vy > 0) p.x += Math.sin(p.age * p.swf + p.swp) * p.sway * dt
      p.c = Math.cos(p.ph)
      let dead = false
      if (p.vy > 0 && p.y >= H - p.lo) { stamp(p); dead = true }
      else if (p.age > p.max || p.x < -60 || p.x > W + 60) dead = true
      if (dead) {
        const t = pool[n - 1]
        pool[n - 1] = p
        pool[i] = t
        n--
      }
    }
    // smoke
    for (let i = puffs.length - 1; i >= 0; i--) {
      const s = puffs[i]
      s.age += dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.r += 14 * dt
      if (s.age >= s.max) { puffs[i] = puffs[puffs.length - 1]; puffs.pop() }
    }
    // floor fade
    floorT += dt
    if (floorT > 0.4 && fg) {
      floorT = 0
      fg.globalCompositeOperation = 'destination-out'
      fg.fillStyle = 'rgba(0,0,0,0.04)'
      fg.fillRect(0, H - 40, W, 40)
      fg.globalCompositeOperation = 'source-over'
    }
  }

  return {
    ownBackdrop: false,
    resize(w, h) {
      W = w; H = h
      buildFloor()
    },
    noteOn(note, x, v, kind, hue) {
      const q = qf()
      let count: number, frac: number, spread: number
      if (kind === 'tonic') { count = 64 + v * 50; frac = 0.45 + 0.4 * v; spread = 0.5 }
      else if (kind === 'spicy') { count = 7 + v * 7; frac = 0.12 + 0.12 * v; spread = 0.7 }
      else { count = 30 + v * 38; frac = 0.3 + 0.45 * v; spread = 0.45 }
      burst(x, H + 2, Math.round(count * calm * q), 0, spread, Math.min(0.85, frac), kind, hue)
      if (kind === 'spicy') { addPuff(x, H); addPuff(x, H) }
      held.set(note, { x, kind, hue, v, acc: 0, t: last / 1000 })
    },
    noteOff(note) {
      held.delete(note)
    },
    chord(xs) {
      rain(Math.round(26 * calm * qf()), W)
      void xs
      const c = Math.round(22 * calm * qf())
      burst(0, H + 2, c, 0.55, 0.3, 0.55, 'in', Math.random() * 360)
      burst(W, H + 2, c, -0.55, 0.3, 0.55, 'in', Math.random() * 360)
    },
    clear() {
      n = 0
      puffs.length = 0
      held.clear()
      if (fg) fg.clearRect(0, 0, W, H)
    },
    draw(ctx, now, quality) {
      curQ = quality
      const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0.016
      last = now
      step(dt)

      const a0 = ctx.globalAlpha, op0 = ctx.globalCompositeOperation
      ctx.globalCompositeOperation = 'source-over'

      if (floor) {
        ctx.globalAlpha = 0.92
        ctx.drawImage(floor, 0, 0, W, H)
      }

      // smoke puffs
      if (puffs.length) {
        const sp = smoke()
        for (let i = 0; i < puffs.length; i++) {
          const s = puffs[i]
          const t = s.age / s.max
          ctx.globalAlpha = 0.32 * Math.min(1, t * 6) * (1 - t)
          ctx.drawImage(sp, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2)
        }
      }
      ctx.globalAlpha = 1

      // counting sort by colour (front/back shade) so each colour is one path + one fill
      counts.fill(0)
      for (let i = 0; i < n; i++) {
        const p = pool[i]
        const k = p.col * 2 + (p.c < 0 ? 1 : 0)
        keys[i] = k
        counts[k + 1]++
      }
      for (let k = 0; k < NB * 2; k++) counts[k + 1] += counts[k]
      const start = counts.slice(0, NB * 2 + 1)
      const pos = counts // reuse as write cursors
      for (let i = 0; i < n; i++) order[pos[keys[i]]++] = i

      for (let k = 0; k < NB * 2; k++) {
        const s = start[k], e = start[k + 1]
        if (s === e) continue
        ctx.fillStyle = COLORS[k]
        ctx.beginPath()
        for (let j = s; j < e; j++) addShape(ctx, pool[order[j]])
        ctx.fill()
      }

      ctx.globalAlpha = a0
      ctx.globalCompositeOperation = op0
    },
  }
}

function addShape(ctx: CanvasRenderingContext2D, p: Piece) {
  const ux = Math.cos(p.rot), uy = Math.sin(p.rot)
  const ac = Math.max(0.1, Math.abs(p.c))
  const x = p.x, y = p.y, s = p.size
  switch (p.shape) {
    case R_RECT: {
      const a = s * 0.5 * ac, b = s * 0.3
      ctx.moveTo(x - ux * a + uy * b, y - uy * a - ux * b)
      ctx.lineTo(x + ux * a + uy * b, y + uy * a - ux * b)
      ctx.lineTo(x + ux * a - uy * b, y + uy * a + ux * b)
      ctx.lineTo(x - ux * a - uy * b, y - uy * a + ux * b)
      ctx.closePath()
      break
    }
    case R_CIRCLE: {
      const rx = s * 0.4 * ac
      ctx.moveTo(x + ux * rx, y + uy * rx)
      ctx.ellipse(x, y, rx, s * 0.4, p.rot, 0, TAU)
      break
    }
    case R_STAR: {
      const R = s * 0.75
      for (let i = 0; i < 10; i++) {
        const lx = STAR_X[i] * R * ac, ly = STAR_Y[i] * R
        const px = x + ux * lx - uy * ly, py = y + uy * lx + ux * ly
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      break
    }
    default: {
      // squiggly streamer: a wavy strip of K+1 points on each side
      const K = 6, L = s * 3 * p.len, tw = s * 0.15 * (0.4 + 0.6 * ac), amp = s * 0.45
      const sw = p.ph * 0.6
      for (let k = 0; k <= K; k++) {
        const t = k / K - 0.5
        const lx = t * L, ly = Math.sin(sw + t * p.wv) * amp - tw
        const px = x + ux * lx - uy * ly, py = y + uy * lx + ux * ly
        if (k === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      for (let k = K; k >= 0; k--) {
        const t = k / K - 0.5
        const lx = t * L, ly = Math.sin(sw + t * p.wv) * amp + tw
        ctx.lineTo(x + ux * lx - uy * ly, y + uy * lx + ux * ly)
      }
      ctx.closePath()
    }
  }
}
