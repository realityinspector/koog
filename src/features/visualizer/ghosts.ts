// Ghost mode: cute (not scary) sheet ghosts float up from every note. All ghosts are sprites
// rendered once per (variant, hem frame) and stamped with drawImage. Moonlit backdrop is cached.

export type GhostKind = 'tonic' | 'in' | 'spicy'

const GW = 72
const GH = 84
// pastel body colours: [hue, sat] (white first)
const PASTELS: [number, number][] = [[0, 0], [330, 80], [200, 85], [150, 70], [270, 80], [50, 90]]
const V_SLIME = PASTELS.length * 2
const V_KING = V_SLIME + 1
const FRAMES = 3
const HEM = [1, -1, 0.35] // hem wobble amplitude multiplier per frame
const ghostSprites: HTMLCanvasElement[] = []

function ghostPath(g: CanvasRenderingContext2D, frame: number) {
  const cx = GW / 2, R = 23, headY = 30, bottom = 68, amp = 6 * HEM[frame]
  const left = cx - R, right = cx + R
  g.beginPath()
  g.moveTo(left, bottom)
  g.lineTo(left, headY)
  g.arc(cx, headY, R, Math.PI, 0)
  g.lineTo(right, bottom)
  const n = 6, step = (R * 2) / n
  for (let k = 1; k <= n; k++) {
    const x = right - k * step
    const cy = bottom + (k % 2 ? 1 : -1) * amp * 1.6
    g.quadraticCurveTo(x + step / 2, cy, x, bottom + (k % 2 ? 0 : -1) * amp * 0.2)
  }
  g.closePath()
}

function ghostSprite(variant: number, frame: number) {
  const id = variant * FRAMES + frame
  let c = ghostSprites[id]
  if (c) return c
  c = document.createElement('canvas')
  c.width = GW
  c.height = GH
  const g = c.getContext('2d')!
  const cx = GW / 2
  const slime = variant === V_SLIME, king = variant === V_KING
  const [hue, sat] = king ? [48, 100] : slime ? [105, 90] : PASTELS[Math.floor(variant / 2)]
  const mouthO = !slime && !king && variant % 2 === 1
  const fill = g.createLinearGradient(0, 8, 0, 72)
  fill.addColorStop(0, `hsl(${hue},${sat}%,${slime ? 66 : king ? 95 : 97}%)`)
  fill.addColorStop(1, `hsl(${hue},${sat}%,${slime ? 46 : king ? 80 : 84}%)`)
  g.shadowColor = `hsla(${hue},${Math.max(sat, 40)}%,${slime ? 55 : 80}%,0.95)`
  g.shadowBlur = 9
  g.fillStyle = fill
  ghostPath(g, frame)
  g.fill()
  g.shadowBlur = 0
  // blush
  if (!slime) {
    g.fillStyle = 'rgba(255,120,170,0.35)'
    for (const dx of [-14, 14]) { g.beginPath(); g.ellipse(cx + dx, 40, 4.5, 3, 0, 0, 6.283); g.fill() }
  }
  const eyeCol = slime ? '#1b3a10' : '#242042'
  g.fillStyle = eyeCol
  if (slime) {
    // mischievous: slanted eyes, raised brows, wide grin with fangs
    for (const s of [-1, 1]) {
      g.save()
      g.translate(cx + s * 9, 30)
      g.rotate(s * 0.35)
      g.beginPath(); g.ellipse(0, 0, 4.2, 6, 0, 0, 6.283); g.fill()
      g.restore()
    }
    g.strokeStyle = eyeCol
    g.lineWidth = 2.4
    g.lineCap = 'round'
    g.beginPath(); g.moveTo(cx - 16, 20); g.lineTo(cx - 5, 24); g.moveTo(cx + 16, 20); g.lineTo(cx + 5, 24); g.stroke()
    g.beginPath(); g.moveTo(cx - 12, 41); g.quadraticCurveTo(cx, 54, cx + 12, 41); g.quadraticCurveTo(cx, 45, cx - 12, 41); g.fillStyle = eyeCol; g.fill()
    g.fillStyle = '#fff'
    g.beginPath(); g.moveTo(cx - 7, 43); g.lineTo(cx - 4, 43); g.lineTo(cx - 5.5, 47); g.fill()
    g.beginPath(); g.moveTo(cx + 7, 43); g.lineTo(cx + 4, 43); g.lineTo(cx + 5.5, 47); g.fill()
    // little shine dots for slime
    g.fillStyle = 'rgba(255,255,255,0.55)'
    g.beginPath(); g.ellipse(cx - 14, 14, 4, 2.2, -0.5, 0, 6.283); g.fill()
  } else {
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 9, 31, 3.8, 5.6, 0, 0, 6.283); g.fill() }
    g.fillStyle = '#fff'
    for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 9 - 1.2, 29, 1.4, 0, 6.283); g.fill() }
    g.fillStyle = eyeCol
    if (mouthO) { g.beginPath(); g.ellipse(cx, 44, 3.2, 4, 0, 0, 6.283); g.fill() }
    else if (king) { g.strokeStyle = eyeCol; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.arc(cx, 41, 5, 0.2, Math.PI - 0.2); g.stroke() }
  }
  if (king) {
    g.shadowColor = 'rgba(255,200,40,0.9)'
    g.shadowBlur = 5
    g.fillStyle = '#ffd23a'
    g.beginPath()
    g.moveTo(cx - 14, 14); g.lineTo(cx - 15, 2); g.lineTo(cx - 7, 9); g.lineTo(cx, 0); g.lineTo(cx + 7, 9); g.lineTo(cx + 15, 2); g.lineTo(cx + 14, 14)
    g.closePath(); g.fill()
    g.shadowBlur = 0
    g.fillStyle = '#ff5d8f'
    g.beginPath(); g.arc(cx, 10, 2, 0, 6.283); g.fill()
  }
  ghostSprites[id] = c
  return c
}

let puffSpr: HTMLCanvasElement | null = null
function puffSprite() {
  if (puffSpr) return puffSpr
  const c = document.createElement('canvas')
  c.width = c.height = 48
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(24, 24, 2, 24, 24, 24)
  gr.addColorStop(0, 'rgba(245,240,255,0.95)')
  gr.addColorStop(0.55, 'rgba(210,198,250,0.5)')
  gr.addColorStop(1, 'rgba(190,175,240,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 48, 48)
  puffSpr = c
  return c
}
interface Puff { x: number; y: number; age: number; size: number }

interface Ghost {
  x: number; y: number; bx: number; vy: number; ph: number; sway: number; size: number; variant: number
  age: number; max: number; note: number; hoverY: number
  /** frames left before a spooked ghost goes poof */
  spook?: number
  orbit?: { cx: number; rad: number; ang: number; spin: number }
  conga?: { dir: number; base: number }
  delay: number; hov?: boolean
}

export interface Ghosts {
  resize(w: number, h: number): void
  noteOn(note: number, x: number, v: number, kind: GhostKind): void
  noteOff(note: number): void
  releaseAll(): void
  /** a fizzled forearm slam: the ghosts on screen jump, shake, and go poof one after another */
  spook(): void
  /** BOOM: a swirling ring of ghosts and two conga lines */
  cheer(cx: number): void
  clear(): void
  drawBackdrop(ctx: CanvasRenderingContext2D, now: number): void
  draw(ctx: CanvasRenderingContext2D, now: number, quality: number): void
}

export function createGhosts(reduced: boolean): Ghosts {
  const calm = reduced ? 0.5 : 1
  const list: Ghost[] = []
  const puffs: Puff[] = []
  const holding = new Map<number, Ghost>()
  let W = 0, H = 0
  let lastChord = 0
  let chordFlip = false
  // cached backdrop
  let skyG: CanvasGradient | null = null
  let moonGlow: CanvasGradient | null = null
  let moonDisc: CanvasGradient | null = null
  let moonX = 0, moonY = 0, moonR = 0
  let fog: HTMLCanvasElement | null = null
  const FOGS: [number, number, number, number][] = [[0.55, 14, 0, 0.9], [0.74, 20, 0.4, 1.2], [0.9, 11, 0.75, 0.7]] // y frac, speed, offset, scale

  function fogSprite() {
    const c = document.createElement('canvas')
    c.width = 320
    c.height = 80
    const g = c.getContext('2d')!
    g.translate(160, 40)
    g.scale(1, 0.25)
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 160)
    gr.addColorStop(0, 'rgba(190,175,255,0.55)')
    gr.addColorStop(0.5, 'rgba(160,140,230,0.22)')
    gr.addColorStop(1, 'rgba(150,130,220,0)')
    g.fillStyle = gr
    g.fillRect(-160, -160, 320, 320)
    return c
  }

  const make = (variant: number, x: number, y: number, size: number, vy: number, max: number): Ghost =>
    ({ x, y, bx: x, vy, ph: Math.random() * 6.283, sway: 8 + Math.random() * 14, size, variant, age: 0, max, note: -1, hoverY: y, delay: 0 })
  const cap = (q: number) => Math.round(60 * calm * Math.max(0.4, q))
  let curQ = 1

  return {
    resize(w, h) {
      W = w; H = h
      moonX = w * 0.8; moonY = h * 0.24; moonR = Math.max(34, Math.min(w, h) * 0.13)
      // gradients are rebuilt lazily (once) in drawBackdrop after a resize
      skyG = null; moonGlow = null; moonDisc = null
    },
    noteOn(note, x, v, kind) {
      if (list.length >= cap(curQ)) return
      const variant = kind === 'tonic' ? V_KING : kind === 'spicy' ? V_SLIME : Math.floor(Math.random() * PASTELS.length) * 2 + (Math.random() < 0.4 ? 1 : 0)
      const size = (34 + v * 40) * (kind === 'tonic' ? 1.5 : 1)
      const hoverY = H * (0.62 - v * 0.22) + (Math.random() - 0.5) * 20
      const gh = make(variant, x, H - 20, size, -(1.1 + v * 1.1) * (reduced ? 0.5 : 1), 400)
      gh.hoverY = hoverY
      gh.note = note
      if (kind === 'spicy') gh.sway *= 1.6
      holding.set(note, gh)
      list.push(gh)
      const now = performance.now()
      if (holding.size >= 3 && now - lastChord > 1400) {
        lastChord = now
        chordFlip = !chordFlip
        const hs = [...holding.values()]
        const cx = hs.reduce((a, q) => a + q.bx, 0) / hs.length
        if (chordFlip) {
          // swirling ring
          const n = Math.min(8, hs.length + 3)
          for (let i = 0; i < n && list.length < cap(curQ); i++) {
            const o = make(Math.floor(Math.random() * PASTELS.length) * 2, cx, H * 0.5, 26 + v * 8, -0.3, 220)
            o.orbit = { cx, rad: 70 + hs.length * 8, ang: (i / n) * 6.283, spin: (reduced ? 0.012 : 0.025) * (i % 2 ? 1 : 1) }
            o.y = H * 0.5
            list.push(o)
          }
        } else {
          // conga line
          const dir = Math.random() < 0.5 ? 1 : -1
          const base = H * (0.3 + Math.random() * 0.25)
          for (let i = 0; i < 6 && list.length < cap(curQ); i++) {
            const o = make(Math.floor(Math.random() * PASTELS.length) * 2 + 1, dir > 0 ? -30 : W + 30, base, 30, 0, 600)
            o.conga = { dir, base }
            o.delay = i * 14
            list.push(o)
          }
        }
      }
    },
    noteOff(note) {
      const g = holding.get(note)
      if (g) g.note = -1
      holding.delete(note)
    },
    releaseAll() {
      for (const g of holding.values()) g.note = -1
      holding.clear()
    },
    spook() {
      let k = 0
      for (let i = list.length - 1; i >= 0 && k < 10; i--) {
        const g = list[i]
        if (g.spook !== undefined || g.orbit || g.conga) continue
        g.spook = 12 + k * 3
        k++
      }
    },
    cheer(cx) {
      const room = cap(curQ) + 14
      const n = 10
      for (let i = 0; i < n && list.length < room; i++) {
        const o = make(i % 5 === 0 ? V_KING : Math.floor(Math.random() * PASTELS.length) * 2, cx, H * 0.45, 28 + (i % 3) * 4, -0.3, 260)
        o.orbit = { cx, rad: 84 + (i % 2) * 38, ang: (i / n) * 6.283, spin: (reduced ? 0.014 : 0.03) * (i % 2 ? 1 : -1) }
        o.y = H * 0.45
        list.push(o)
      }
      for (const dir of [1, -1]) {
        const base = H * (0.28 + (dir > 0 ? 0 : 0.22))
        for (let i = 0; i < 5 && list.length < room; i++) {
          const o = make(Math.floor(Math.random() * PASTELS.length) * 2 + 1, dir > 0 ? -30 : W + 30, base, 30, 0, 600)
          o.conga = { dir, base }
          o.delay = i * 12
          list.push(o)
        }
      }
    },
    clear() {
      list.length = 0
      puffs.length = 0
      holding.clear()
    },
    drawBackdrop(ctx, now) {
      const t = now / 1000
      if (!skyG) {
        skyG = ctx.createLinearGradient(0, 0, 0, H)
        skyG.addColorStop(0, 'rgb(34,22,92)')
        skyG.addColorStop(0.6, 'rgb(62,34,120)')
        skyG.addColorStop(1, 'rgb(96,52,140)')
        moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.6, moonX, moonY, moonR * 3.2)
        moonGlow.addColorStop(0, 'rgba(255,248,210,0.5)')
        moonGlow.addColorStop(0.4, 'rgba(210,200,255,0.16)')
        moonGlow.addColorStop(1, 'rgba(180,170,255,0)')
        moonDisc = ctx.createRadialGradient(moonX - moonR * 0.25, moonY - moonR * 0.25, moonR * 0.1, moonX, moonY, moonR)
        moonDisc.addColorStop(0, 'rgb(255,254,236)')
        moonDisc.addColorStop(1, 'rgb(240,226,170)')
      }
      ctx.globalAlpha = 0.28
      ctx.fillStyle = skyG
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
      ctx.fillStyle = moonGlow!
      ctx.fillRect(moonX - moonR * 3.2, moonY - moonR * 3.2, moonR * 6.4, moonR * 6.4)
      ctx.fillStyle = moonDisc!
      ctx.beginPath()
      ctx.arc(moonX, moonY, moonR, 0, 6.283)
      ctx.fill()
      ctx.fillStyle = 'rgba(200,185,130,0.22)'
      for (const [dx, dy, r] of [[-0.3, 0.2, 0.2], [0.25, -0.15, 0.14], [0.2, 0.35, 0.1]]) {
        ctx.beginPath(); ctx.arc(moonX + dx * moonR, moonY + dy * moonR, r * moonR, 0, 6.283); ctx.fill()
      }
      fog = fog ?? fogSprite()
      for (const [yf, sp, off, sc] of FOGS) {
        const bw = 320 * sc * Math.max(1, W / 700), bh = 80 * sc * 1.6
        const span = W + bw
        const x = ((t * sp * calm + off * span) % span) - bw
        ctx.globalAlpha = 0.5
        ctx.drawImage(fog, x, H * yf - bh / 2, bw, bh)
      }
      ctx.globalAlpha = 1
    },
    draw(ctx, now, quality) {
      curQ = quality
      const t = now / 1000
      const c = cap(quality)
      ctx.globalCompositeOperation = 'source-over'
      for (let i = list.length - 1; i >= 0; i--) {
        const g = list[i]
        if (g.delay > 0) { g.delay--; continue }
        if (g.spook !== undefined && --g.spook <= 0) {
          if (puffs.length < 24) puffs.push({ x: g.x, y: g.y, age: 0, size: g.size * 1.5 })
          if (holding.get(g.note) === g) holding.delete(g.note)
          list[i] = list[list.length - 1]; list.pop(); continue
        }
        let a = 1
        if (g.orbit) {
          g.age++
          g.orbit.ang += g.orbit.spin
          g.y -= 0.25 * calm
          g.x = g.orbit.cx + Math.cos(g.orbit.ang) * g.orbit.rad
          const yy = g.y + Math.sin(g.orbit.ang) * g.orbit.rad * 0.35
          a = Math.min(1, g.age / 15, (g.max - g.age) / 40)
          if (g.age >= g.max) { list[i] = list[list.length - 1]; list.pop(); continue }
          const gy = yy
          drawOne(ctx, g, g.x, gy, a, t, quality)
          continue
        }
        if (g.conga) {
          g.age++
          g.x += g.conga.dir * 2.1 * calm
          g.y = g.conga.base + Math.sin(g.x * 0.02) * 34
          if (g.x < -60 || g.x > W + 60 || g.age >= g.max) { list[i] = list[list.length - 1]; list.pop(); continue }
          drawOne(ctx, g, g.x, g.y, 0.95, t, quality)
          continue
        }
        if (g.note >= 0) {
          // held: rise to the hover height, then bob in place until the key is released
          if (!g.hov && g.y > g.hoverY) g.y += g.vy
          else { g.hov = true; g.y = g.hoverY + Math.sin(t * 2.2 + g.ph) * 6 }
          a = Math.min(1, ++g.age / 12)
        } else {
          g.y += g.vy
          g.age++
          const topFade = Math.max(0, Math.min(1, g.y / (H * 0.28)))
          const lifeFade = Math.min(1, (g.max - g.age) / 40)
          a = Math.min(1, g.age / 12, topFade, lifeFade)
          if (a <= 0 || g.y < -g.size || g.age >= g.max) {
            if (holding.get(g.note) === g) holding.delete(g.note)
            list[i] = list[list.length - 1]; list.pop(); continue
          }
        }
        // soft cull when over budget (quality dropped): oldest drift out faster
        if (list.length > c && g.note < 0) g.age += 3
        g.x = g.bx + Math.sin(t * 1.5 * calm + g.ph) * g.sway
        drawOne(ctx, g, g.x, g.y, a, t, quality)
      }
      // poofs: soft lavender clouds where spooked ghosts vanished
      if (puffs.length) {
        const sp = puffSprite()
        for (let i = puffs.length - 1; i >= 0; i--) {
          const p = puffs[i]
          const u = ++p.age / 34
          if (u >= 1) { puffs[i] = puffs[puffs.length - 1]; puffs.pop(); continue }
          const r = p.size * (0.55 + u * 0.8)
          ctx.globalAlpha = 0.7 * (1 - u)
          ctx.drawImage(sp, p.x - r, p.y - r, r * 2, r * 2)
        }
      }
      ctx.globalAlpha = 1
    },
  }

  function drawOne(ctx: CanvasRenderingContext2D, g: Ghost, x: number, y: number, a: number, t: number, quality: number) {
    const fr = reduced || quality < 0.5 ? 0 : [0, 1, 2, 1][Math.floor(t * 4 * calm + g.ph) & 3]
    let wd = g.size, ht = g.size * (GH / GW)
    if (g.spook !== undefined) {
      // spooked: jump, shake, puff up a bit
      x += Math.sin(g.spook * 2.1) * 4
      y -= 4
      wd *= 1.12
      ht *= 1.12
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, a)) * 0.95
    ctx.drawImage(ghostSprite(g.variant, fr), x - wd / 2, y - ht / 2, wd, ht)
  }
}
