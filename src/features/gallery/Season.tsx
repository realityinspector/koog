import { useEffect, useRef } from 'react'
import { onNote } from '../../music/notes'
import type { Season } from './holiday'

// The seasonal touches of the holiday Art Gallery modes, drawn on one canvas that sits over the picture:
// falling leaves (Thanksgiving) or snow (Christmas), and a string of lights that glow and sway.
// Photosensitivity: every light swells and fades on a 7 to 11 second cycle (far under 3 per second), nothing flashes.
// Reduced motion: leaves and snow stand still, the lights hold a steady glow.

const LEAF = ['#d9822b', '#c2410c', '#e9b44c', '#9a3412', '#b45309', '#f2c14e']
const BULBS: Record<Season, string[]> = {
  thanksgiving: ['#ffb347', '#ffd27a', '#ff8c42', '#f6c453'],
  christmas: ['#ff4d4d', '#3ddc84', '#ffd166', '#ffffff', '#ff4d4d', '#3ddc84'],
}
interface P { x: number; y: number; r: number; v: number; sw: number; ph: number; c: string; rot: number; spin: number }

export function SeasonCanvas({ kind }: { kind: Season }) {
  const cv = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = cv.current
    if (!c) return
    const g = c.getContext('2d')
    if (!g) return
    let w = 0, h = 0, raf = 0, last = performance.now(), energy = 0
    const still = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } })()
    let parts: P[] = []
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    const make = (initial: boolean): P => kind === 'christmas'
      ? { x: rnd(0, w), y: initial ? rnd(0, h) : -8, r: rnd(1, 3.4), v: rnd(14, 38), sw: rnd(6, 22), ph: rnd(0, 6.28), c: '#ffffff', rot: 0, spin: 0 }
      : { x: rnd(0, w), y: initial ? rnd(0, h) : -20, r: rnd(7, 13), v: rnd(18, 42), sw: rnd(14, 40), ph: rnd(0, 6.28), c: LEAF[Math.floor(Math.random() * LEAF.length)], rot: rnd(0, 6.28), spin: rnd(-1.1, 1.1) }
    const fit = () => {
      w = c.width = Math.max(1, Math.round(c.clientWidth)); h = c.height = Math.max(1, Math.round(c.clientHeight))
      const n = Math.round(Math.min(130, Math.max(24, (w * h) / (kind === 'christmas' ? 9000 : 26000))))
      parts = Array.from({ length: n }, () => make(true))
    }
    fit()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    ro?.observe(c)
    const off = onNote((e) => { if (e.on) energy = Math.min(1, energy + 0.22) }) // playing makes the lights glow a little brighter

    const swagY = (x: number, t: number, row: number) => {
      const span = Math.max(180, w / (w < 600 ? 2 : 4)) // one droop per span
      const u = ((x % span) / span)
      return 22 + row * 20 + Math.sin(u * Math.PI) * (22 + 4 * Math.sin(t * 0.3 + row)) + (still ? 0 : Math.sin(t * 0.25 + x * 0.004) * 2)
    }
    const bulbs: Record<Season, string[]> = BULBS
    const draw = (t: number, dt: number) => {
      g.clearRect(0, 0, w, h)
      // falling things
      for (const p of parts) {
        if (!still) {
          p.y += p.v * dt
          p.ph += dt * 0.7
          p.rot += p.spin * dt
          if (p.y > h + 24) Object.assign(p, make(false))
        }
        const x = p.x + Math.sin(p.ph) * p.sw
        if (kind === 'christmas') {
          g.globalAlpha = 0.55 + 0.4 * (p.r / 3.4)
          g.fillStyle = '#fff'
          g.beginPath(); g.arc(x, p.y, p.r, 0, 6.283); g.fill()
        } else {
          g.save(); g.translate(x, p.y); g.rotate(p.rot); g.globalAlpha = 0.82
          g.fillStyle = p.c
          g.beginPath(); g.moveTo(0, -p.r); g.quadraticCurveTo(p.r * 0.85, -p.r * 0.2, 0, p.r); g.quadraticCurveTo(-p.r * 0.85, -p.r * 0.2, 0, -p.r); g.fill()
          g.strokeStyle = 'rgba(80,30,0,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -p.r); g.lineTo(0, p.r); g.stroke()
          g.restore()
        }
      }
      g.globalAlpha = 1
      // the string lights: two swags across the top, bulbs that swell and fade slowly
      energy = Math.max(0, energy - dt * 0.12)
      const cols = bulbs[kind]
      for (let row = 0; row < 2; row++) {
        g.strokeStyle = 'rgba(20,12,8,.7)'; g.lineWidth = 1.4
        g.beginPath()
        for (let x = 0; x <= w + 8; x += 8) { const y = swagY(x, t, row); if (x === 0) g.moveTo(x, y); else g.lineTo(x, y) }
        g.stroke()
        const step = w < 600 ? 44 : 62
        for (let x = step / 2 + row * (step / 2); x < w; x += step) {
          const i = Math.round(x / step) + row * 3
          const y = swagY(x, t, row) + 5
          const glow = still ? 0.72 : 0.55 + 0.3 * Math.sin(t * (0.55 + (i % 5) * 0.09) + i * 1.7) + energy * 0.2
          const col = cols[i % cols.length]
          g.globalCompositeOperation = 'lighter'
          const rad = 16 + glow * 10
          const gr = g.createRadialGradient(x, y, 0, x, y, rad)
          gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)')
          g.globalAlpha = Math.min(0.85, glow * 0.7)
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill()
          g.globalCompositeOperation = 'source-over'
          g.globalAlpha = 0.95
          g.fillStyle = col; g.beginPath(); g.ellipse(x, y, 3.2, 4.6, 0, 0, 6.283); g.fill()
        }
      }
      g.globalAlpha = 1
    }
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now
      draw(now / 1000, dt)
      raf = requestAnimationFrame(frame)
    }
    if (still) draw(0, 0); else raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); off() }
  }, [kind])
  return <canvas ref={cv} className="gl-season" aria-hidden data-season={kind} />
}
