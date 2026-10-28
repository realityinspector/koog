// Galaxy theme extras: a few big soft nebula blobs (pre-rendered once) that drift very slowly.
const BLOBS: [number, number, number, number][] = [
  // hue, x frac, y frac, radius frac
  [320, 0.25, 0.3, 0.55],
  [175, 0.78, 0.7, 0.6],
  [270, 0.55, 0.45, 0.5],
]
const sprites: HTMLCanvasElement[] = []

function blob(i: number) {
  let c = sprites[i]
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const hue = BLOBS[i][0]
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, `hsla(${hue},95%,62%,0.9)`)
  gr.addColorStop(0.5, `hsla(${hue},90%,55%,0.35)`)
  gr.addColorStop(1, `hsla(${hue},90%,50%,0)`)
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  sprites[i] = c
  return c
}

export function drawNebula(ctx: CanvasRenderingContext2D, now: number, w: number, h: number, reduced: boolean) {
  const t = (now / 1000) * (reduced ? 0.4 : 1)
  const m = Math.max(w, h)
  ctx.globalAlpha = 0.07
  for (let i = 0; i < BLOBS.length; i++) {
    const [, fx, fy, fr] = BLOBS[i]
    const r = m * fr * 0.5
    const x = w * fx + Math.sin(t * 0.07 + i * 2) * w * 0.06
    const y = h * fy + Math.cos(t * 0.05 + i * 3) * h * 0.06
    ctx.drawImage(blob(i), x - r, y - r, r * 2, r * 2)
  }
  ctx.globalAlpha = 1
}
