// Sparkle layer: slow twinkling 4-point stars + glitter that drifts down from note bursts.
// Sprites are pre-rendered once; per frame it is only drawImage. Never flashes: every star
// follows its own slow sine (0.3 to 1 Hz) with a random phase, so they are never in sync.

const SS = 32
const STAR_COLORS: [number, number][] = [[0, 0], [330, 100], [185, 100], [48, 100], [270, 100]]
const starSprites: HTMLCanvasElement[] = []

function starSprite(i: number) {
  let c = starSprites[i]
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = SS
  const g = c.getContext('2d')!
  const m = SS / 2
  const [hue, sat] = STAR_COLORS[i]
  const glow = g.createRadialGradient(m, m, 0, m, m, m)
  glow.addColorStop(0, `hsla(${hue},${sat}%,90%,0.7)`)
  glow.addColorStop(0.3, `hsla(${hue},${sat}%,75%,0.22)`)
  glow.addColorStop(1, `hsla(${hue},${sat}%,70%,0)`)
  g.fillStyle = glow
  g.fillRect(0, 0, SS, SS)
  // 4-point twinkle: concave curves between the tips
  const R = m * 0.95, k = m * 0.12
  g.fillStyle = `hsla(${hue},${Math.min(sat, 60)}%,96%,1)`
  g.beginPath()
  g.moveTo(m, m - R)
  g.quadraticCurveTo(m + k, m - k, m + R, m)
  g.quadraticCurveTo(m + k, m + k, m, m + R)
  g.quadraticCurveTo(m - k, m + k, m - R, m)
  g.quadraticCurveTo(m - k, m - k, m, m - R)
  g.closePath()
  g.fill()
  starSprites[i] = c
  return c
}

interface Star { x: number; y: number; size: number; f: number; ph: number; spr: number; flare: number }
interface Glitter { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; spr: number; ph: number }

const MAX_GLITTER = 90

export interface Sparkles {
  resize(w: number, h: number): void
  /** a note was played at x,y: nearby stars flare and glitter drifts down */
  burst(x: number, y: number, v: number): void
  /** glitter=false draws only the quiet star field (ghost mode) */
  draw(ctx: CanvasRenderingContext2D, now: number, quality: number, glitter: boolean, gain: number): void
}

export function createSparkles(reduced: boolean): Sparkles {
  const calm = reduced ? 0.5 : 1
  const N = reduced ? 32 : 70
  const stars: Star[] = []
  const glitter: Glitter[] = []
  let W = 0, H = 0
  const place = (s: Star) => {
    s.x = Math.random() * W
    s.y = Math.random() * H
  }
  for (let i = 0; i < N; i++) {
    stars.push({ x: 0, y: 0, size: 7 + Math.random() * 11, f: (0.3 + Math.random() * 0.7) * calm, ph: Math.random() * 6.283, spr: Math.floor(Math.random() * STAR_COLORS.length), flare: 0 })
  }
  return {
    resize(w, h) {
      W = w
      H = h
      for (const s of stars) place(s)
    },
    burst(x, y, v) {
      const R = 190
      for (const s of stars) {
        const d = Math.hypot(s.x - x, s.y - y)
        if (d < R) s.flare = Math.max(s.flare, 1 - d / R)
      }
      const n = Math.round((3 + v * 6) * calm)
      for (let i = 0; i < n && glitter.length < MAX_GLITTER; i++) {
        glitter.push({ x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 1.2, vy: -0.6 - Math.random() * 0.8, life: 0, max: 80 + Math.random() * 60, size: 5 + Math.random() * 6, spr: Math.floor(Math.random() * STAR_COLORS.length), ph: Math.random() * 6.283 })
      }
    },
    draw(ctx, now, quality, withGlitter, gain) {
      const t = now / 1000
      const cnt = Math.max(Math.floor(N * 0.5), Math.floor(N * quality))
      for (let i = 0; i < cnt; i++) {
        const s = stars[i]
        s.flare *= 0.97
        const tw = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * s.f + s.ph)
        const a = Math.min(1, (0.2 + 0.7 * tw + s.flare * 0.6) * gain)
        const r = s.size * (0.8 + 0.3 * tw + s.flare * 0.5)
        ctx.globalAlpha = a
        ctx.drawImage(starSprite(s.spr), s.x - r, s.y - r, r * 2, r * 2)
      }
      if (withGlitter) {
        for (let i = glitter.length - 1; i >= 0; i--) {
          const p = glitter[i]
          const age = ++p.life / p.max
          if (age >= 1) { glitter[i] = glitter[glitter.length - 1]; glitter.pop(); continue }
          p.vy += 0.018
          p.x += p.vx + Math.sin(p.life * 0.06 + p.ph) * 0.25
          p.y += p.vy
          const r = p.size * (1 - age * 0.4)
          ctx.globalAlpha = (1 - age) * (0.65 + 0.35 * Math.sin(p.life * 0.15 + p.ph))
          ctx.drawImage(starSprite(p.spr), p.x - r, p.y - r, r * 2, r * 2)
        }
      }
      ctx.globalAlpha = 1
    },
  }
}
