import { useEffect, useRef } from 'react'
import { useCelebrateStore, type CelebrateKind } from './celebrate'
import './celebrate.css'

const COLORS = ['#7c5cff', '#ff5da2', '#ffd76c', '#35d4e8']
const DURATION = 2500
const TOAST_MS = 3000

interface Piece { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; c: string }

function makePieces(n: number, W: number, kind: CelebrateKind): Piece[] {
  return Array.from({ length: n }, (_, i) => ({
    x: Math.random() * W, y: -20 - Math.random() * 200,
    vx: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 4,
    w: 6 + Math.random() * 8, h: 8 + Math.random() * 10,
    r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
    c: kind === 'gold' && i % 2 ? COLORS[2] : COLORS[i % COLORS.length],
  }))
}

export function Celebration() {
  const event = useCelebrateStore((s) => s.event)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Auto-hide the toast
  useEffect(() => {
    if (!event) return
    const t = window.setTimeout(() => {
      if (useCelebrateStore.getState().event?.id === event.id) useCelebrateStore.setState({ event: null })
    }, TOAST_MS)
    return () => window.clearTimeout(t)
  }, [event])

  // Confetti: rAF only runs while pieces are animating
  useEffect(() => {
    const cv = canvasRef.current
    if (!event || !cv) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = window.innerWidth, H = window.innerHeight
    cv.width = W * dpr; cv.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const pieces = makePieces(event.kind === 'best' ? 60 : 150, W, event.kind)
    const start = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const t = now - start
      ctx.clearRect(0, 0, W, H)
      if (t >= DURATION) return // done: stop scheduling frames
      const fade = t > DURATION - 500 ? (DURATION - t) / 500 : 1
      ctx.globalAlpha = fade
      for (const p of pieces) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r)
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H) }
  }, [event])

  return (
    <>
      <canvas ref={canvasRef} className="kc-canvas" aria-hidden="true" />
      {event && (
        <div className="kc-toast-wrap" role="status" aria-live="polite">
          <div key={event.id} className={`kc-toast ${event.kind}`}>
            <span className="kc-emoji" aria-hidden="true">{event.emoji}</span>
            <span>{event.title}</span>
          </div>
        </div>
      )}
    </>
  )
}
