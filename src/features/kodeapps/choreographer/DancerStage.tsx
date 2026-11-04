// The Koreographer stage: a canvas that draws the stick-man from whatever `read()` says each frame (no React re-render per frame).
// No flashing: the only motion is the dancer; the beat light is a soft fade at most 2.7 times a second (bpm is capped at 160).
import { useEffect, useRef } from 'react'
import type { Arg, MoveId } from './engine'
import { moveDef } from './engine'
import { poseFor, rigOf, type Rig } from './moves'

export interface StageState { move: MoveId | null; u: number; a: Arg; beat: number; react: boolean; label: string; tint: number }

export function DancerStage({ read, reduced }: { read: () => StageState; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    let raf = 0, alive = true
    const fit = () => {
      const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.max(2, Math.round(r.width * d)); cv.height = Math.max(2, Math.round(r.height * d))
    }
    fit()
    const ro = new ResizeObserver(fit); ro.observe(cv)
    const frame = () => {
      if (!alive) return
      raf = requestAnimationFrame(frame)
      const s = read()
      const W = cv.width, H = cv.height
      const U = H / 10.5, floor = H * 0.86, cx = W / 2
      const hue = s.tint
      ctx.clearRect(0, 0, W, H)
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, `hsl(${hue} 40% 16%)`); g.addColorStop(1, `hsl(${hue} 45% 26%)`)
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      // soft spotlight (one big gentle ellipse, never flashing)
      const sp = ctx.createRadialGradient(cx, floor - U * 3, U, cx, floor - U * 3, U * 7)
      sp.addColorStop(0, 'rgba(255,240,200,0.20)'); sp.addColorStop(1, 'rgba(255,240,200,0)')
      ctx.fillStyle = sp; ctx.fillRect(0, 0, W, H)
      // floor
      ctx.fillStyle = `hsl(${hue} 30% 12%)`; ctx.fillRect(0, floor, W, H - floor)
      ctx.strokeStyle = `hsla(${hue} 60% 70% / .18)`; ctx.lineWidth = 1
      for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(cx + i * U * 1.4, floor); ctx.lineTo(cx + i * U * 3, H); ctx.stroke() }
      const pose = poseFor(s.move, s.u, s.a, s.beat, reduced)
      const rig = rigOf(pose)
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(cx + pose.x * U, floor + 3, U * 1.1, U * 0.22, 0, 0, 7); ctx.fill()
      draw(ctx, rig, pose.face, cx, floor, U, s.react ? 48 : (hue + 170) % 360, pose.bow)
      // label
      if (s.move) {
        const m = moveDef(s.move)
        ctx.font = `700 ${Math.round(U * 0.62)}px system-ui, sans-serif`; ctx.textAlign = 'center'
        const txt = `${m.emoji} ${s.label || m.name}`
        const w = ctx.measureText(txt).width + U
        ctx.fillStyle = s.react ? 'rgba(255,200,60,.92)' : 'rgba(255,255,255,.88)'
        ctx.beginPath(); ctx.roundRect(cx - w / 2, U * 0.5, w, U * 1.1, U * 0.3); ctx.fill()
        ctx.fillStyle = '#1a1a2e'; ctx.fillText(txt, cx, U * 1.28)
      }
      // beat light: soft fade, small
      const b = 0.5 + 0.5 * Math.cos(s.beat * Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${reduced ? 0.35 : 0.15 + 0.5 * b * b})`
      ctx.beginPath(); ctx.arc(W - U * 0.9, U * 0.9, U * 0.32, 0, 7); ctx.fill()
    }
    raf = requestAnimationFrame(frame)
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect() }
  }, [read, reduced])
  return <canvas ref={ref} className="kr-stage" role="img" aria-label="The dancer on the stage" />
}

function draw(ctx: CanvasRenderingContext2D, r: Rig, face: string, cx: number, fy: number, U: number, shirtHue: number, bow: number) {
  const P = (p: [number, number]): [number, number] => [cx + p[0] * U, fy - p[1] * U]
  const line = (pts: [number, number][], col: string, w: number) => {
    ctx.strokeStyle = col; ctx.lineWidth = w * U; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); pts.forEach((q, i) => { const [x, y] = P(q); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }); ctx.stroke()
  }
  const skin = '#f6d3a8', shirt = `hsl(${shirtHue} 75% 60%)`, pants = `hsl(${(shirtHue + 120) % 360} 45% 38%)`
  line([r.lhip, r.lkn, r.lft], pants, 0.34); line([r.rhip, r.rkn, r.rft], pants, 0.34)
  line([r.lft, [r.lft[0] - 0.28 * Math.sign(r.lft[0] - r.hip[0] || -1), r.lft[1]]], '#222', 0.26)
  line([r.rft, [r.rft[0] - 0.28 * Math.sign(r.rft[0] - r.hip[0] || 1), r.rft[1]]], '#222', 0.26)
  line([r.hip, r.neck], shirt, 0.62)
  line([r.lsh, r.lel, r.lha], skin, 0.26); line([r.rsh, r.rel, r.rha], skin, 0.26)
  for (const h of [r.lha, r.rha]) { const [x, y] = P(h); ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, y, U * 0.2, 0, 7); ctx.fill() }
  const [hx, hy] = P(r.head)
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hy, r.headR * U, 0, 7); ctx.fill()
  if (r.back) { ctx.fillStyle = '#4a2f1a'; ctx.beginPath(); ctx.arc(hx, hy, r.headR * U * 0.95, 0, 7); ctx.fill(); return }
  ctx.fillStyle = '#4a2f1a'; ctx.beginPath(); ctx.arc(hx, hy - r.headR * U * 0.15, r.headR * U * 1.0, Math.PI * 1.05, Math.PI * 1.95); ctx.fill()
  const ex = r.headR * U * 0.36 * r.sx, ey = hy - r.headR * U * 0.05 + bow * U * 0.1
  ctx.fillStyle = '#222'
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + s * ex, ey, U * 0.07, 0, 7); ctx.fill() }
  ctx.strokeStyle = '#222'; ctx.lineWidth = U * 0.06; ctx.beginPath()
  if (face === 'oh') ctx.arc(hx, ey + U * 0.28, U * 0.1, 0, 7)
  else ctx.arc(hx, ey + U * 0.14, U * (face === 'grin' ? 0.22 : 0.16), 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.stroke()
}
