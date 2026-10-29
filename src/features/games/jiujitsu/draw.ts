// Drawing for Jiu-Jitsu Flow: the dojo background (rendered once per size) and the cartoon grapplers.
import { joints, resolve, type Fig, type V } from './poses'

export interface View { w: number; h: number; s: number; ox: number; gy: number }
export interface Look { gi: string; edge: string; skin: string; hair: string; belt: string; shade: string }

export const KID_LOOK = (belt: string): Look => ({ gi: '#f6f6f2', edge: '#9aa0b8', skin: '#e9b48b', hair: '#4a2f1c', belt, shade: '#d7dae6' })
export const PARTNER_LOOK: Look = { gi: '#3568d8', edge: '#16327e', skin: '#bd7d56', hair: '#1c1613', belt: '#8a5429', shade: '#2b55b4' }

export function makeView(w: number, h: number): View {
  const gy = Math.max(h * 0.58, h - Math.min(112, h * 0.27))
  const s = Math.max(60, Math.min(w / 4.4, (gy - Math.min(64, h * 0.16)) / 1.75))
  return { w, h, s, ox: w / 2, gy }
}
const X = (v: View, x: number) => v.ox + x * v.s
const Y = (v: View, y: number) => v.gy - y * v.s

export function renderBackground(w: number, h: number, dpr: number, gy: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr))
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  const mt = Math.min(h * 0.7, gy - h * 0.09)
  const wallH = mt - h * 0.03
  const wg = g.createLinearGradient(0, 0, 0, wallH)
  wg.addColorStop(0, '#2b2a4a'); wg.addColorStop(1, '#4a4468')
  g.fillStyle = wg; g.fillRect(0, 0, w, wallH)
  // wooden wainscot and shoji panels
  g.fillStyle = '#6e4a32'; g.fillRect(0, wallH * 0.72, w, wallH * 0.28)
  g.fillStyle = 'rgba(0,0,0,.18)'
  for (let x = 0; x < w; x += 46) g.fillRect(x, wallH * 0.72, 2, wallH * 0.28)
  const pw = Math.min(150, w / 6)
  for (let i = 0; i < 4; i++) {
    const x = w * (0.1 + i * 0.1 * (i > 1 ? 0 : 1)) + (i > 1 ? w * 0.55 + (i - 2) * (pw + 12) : 0)
    g.fillStyle = 'rgba(255,245,215,.16)'; g.fillRect(x, wallH * 0.12, pw, wallH * 0.52)
    g.strokeStyle = 'rgba(255,235,190,.32)'; g.lineWidth = 2; g.strokeRect(x, wallH * 0.12, pw, wallH * 0.52)
    g.beginPath(); g.moveTo(x + pw / 2, wallH * 0.12); g.lineTo(x + pw / 2, wallH * 0.64); g.moveTo(x, wallH * 0.38); g.lineTo(x + pw, wallH * 0.38); g.stroke()
  }
  // a simple red-sun banner in the middle (no text)
  const bx = w / 2, bw = Math.min(150, w * 0.14), by = wallH * 0.08
  g.fillStyle = '#f2e7cf'; g.fillRect(bx - bw / 2, by, bw, wallH * 0.55)
  g.fillStyle = '#c63a3a'; g.beginPath(); g.arc(bx, by + wallH * 0.2, bw * 0.28, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#26253f'; g.fillRect(bx - bw / 2, by, bw, 6)
  // floor and mat
  const fg = g.createLinearGradient(0, wallH, 0, h)
  fg.addColorStop(0, '#8d6a4c'); fg.addColorStop(1, '#6a4a34')
  g.fillStyle = fg; g.fillRect(0, wallH, w, h - wallH)
  const mb = h * 0.97, ml = w * 0.04, mr = w * 0.96
  const inset = w * 0.07
  g.beginPath(); g.moveTo(ml + inset, mt); g.lineTo(mr - inset, mt); g.lineTo(mr, mb); g.lineTo(ml, mb); g.closePath()
  const mg = g.createLinearGradient(0, mt, 0, mb)
  mg.addColorStop(0, '#2e6fd0'); mg.addColorStop(1, '#3f86ee')
  g.fillStyle = mg; g.fill()
  g.save(); g.clip()
  // puzzle-mat tiles in perspective
  for (let i = -8; i <= 24; i++) {
    const t = i / 16
    g.strokeStyle = 'rgba(8,24,70,.28)'; g.lineWidth = 2
    g.beginPath(); g.moveTo(ml + inset + (mr - ml - 2 * inset) * t, mt); g.lineTo(ml + (mr - ml) * (t * 1.35 - 0.175), mb); g.stroke()
  }
  for (let r = 1; r < 5; r++) {
    const y = mt + (mb - mt) * Math.pow(r / 5, 1.5)
    g.strokeStyle = 'rgba(8,24,70,.28)'; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke()
  }
  g.fillStyle = 'rgba(255,255,255,.08)'
  g.fillRect(ml, mt, w, 3)
  g.restore()
  g.strokeStyle = '#f6d34f'; g.lineWidth = 4
  g.beginPath(); g.moveTo(ml + inset, mt); g.lineTo(mr - inset, mt); g.lineTo(mr, mb); g.lineTo(ml, mb); g.closePath(); g.stroke()
  // soft vignette
  const vg = g.createRadialGradient(w / 2, h * 0.5, h * 0.3, w / 2, h * 0.5, h * 1.0)
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,6,30,.45)')
  g.fillStyle = vg; g.fillRect(0, 0, w, h)
  return c
}

function limb(g: CanvasRenderingContext2D, v: View, pts: V[], width: number, fill: string, edge: string) {
  g.lineCap = 'round'; g.lineJoin = 'round'
  g.beginPath()
  pts.forEach((p, i) => (i ? g.lineTo(X(v, p[0]), Y(v, p[1])) : g.moveTo(X(v, p[0]), Y(v, p[1]))))
  g.strokeStyle = edge; g.lineWidth = (width + 0.035) * v.s; g.stroke()
  g.strokeStyle = fill; g.lineWidth = width * v.s; g.stroke()
}
const dot = (g: CanvasRenderingContext2D, v: View, p: V, r: number, fill: string, edge: string) => {
  g.beginPath(); g.arc(X(v, p[0]), Y(v, p[1]), r * v.s, 0, Math.PI * 2)
  g.fillStyle = fill; g.fill(); g.strokeStyle = edge; g.lineWidth = Math.max(1, 0.018 * v.s); g.stroke()
}

export function drawFig(g: CanvasRenderingContext2D, v: View, f0: Fig, look: Look, happy = 1) {
  const f = resolve(f0)
  const j = joints(f)
  const edge = look.edge
  // far arm and leg first
  limb(g, v, [j.neck, j.e[1], j.h[1]], 0.1, look.shade, edge)
  limb(g, v, [j.hip, j.kn[1], j.ft[1]], 0.13, look.shade, edge)
  // torso
  limb(g, v, [j.hip, j.neck], 0.26, look.gi, edge)
  // belt band across the hips
  const bt: V = [j.hip[0] + (j.neck[0] - j.hip[0]) * 0.1, j.hip[1] + (j.neck[1] - j.hip[1]) * 0.1]
  limb(g, v, [j.hip, bt], 0.27, look.belt, 'rgba(0,0,0,.45)')
  // lapel V
  g.strokeStyle = edge; g.lineWidth = 0.025 * v.s; g.lineCap = 'round'
  const mid: V = [j.hip[0] + (j.neck[0] - j.hip[0]) * 0.55, j.hip[1] + (j.neck[1] - j.hip[1]) * 0.55]
  g.beginPath(); g.moveTo(X(v, j.neck[0]), Y(v, j.neck[1])); g.lineTo(X(v, mid[0]), Y(v, mid[1])); g.stroke()
  // near leg, feet
  limb(g, v, [j.hip, j.kn[0], j.ft[0]], 0.14, look.gi, edge)
  dot(g, v, j.ft[1], 0.06, look.skin, edge)
  dot(g, v, j.ft[0], 0.06, look.skin, edge)
  // head
  drawHead(g, v, f, j.head, look, happy)
  // near arm
  limb(g, v, [j.neck, j.e[0], j.h[0]], 0.11, look.gi, edge)
  dot(g, v, j.h[1], 0.052, look.skin, edge)
  dot(g, v, j.h[0], 0.056, look.skin, edge)
}

function drawHead(g: CanvasRenderingContext2D, v: View, f: Fig, c: V, look: Look, happy: number) {
  const r = 0.125 * v.s
  g.save()
  g.translate(X(v, c[0]), Y(v, c[1]))
  g.rotate(-((f.t + f.hd - 90) * Math.PI) / 180)
  const s = f.f
  // hair (back of head and top)
  g.fillStyle = look.hair
  g.beginPath(); g.arc(-s * r * 0.12, -r * 0.1, r * 1.06, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2)
  g.fillStyle = look.skin; g.fill(); g.strokeStyle = look.edge; g.lineWidth = Math.max(1, 0.02 * v.s); g.stroke()
  // hair fringe
  g.fillStyle = look.hair
  g.beginPath(); g.arc(0, 0, r, Math.PI * 1.02, Math.PI * 1.95); g.lineTo(s * r * 0.1, -r * 0.35); g.closePath(); g.fill()
  // eyes and smile
  g.fillStyle = '#1d1a2a'
  g.beginPath(); g.arc(s * r * 0.45, r * 0.02, r * 0.11, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(s * r * 0.02, r * 0.02, r * 0.1, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#7a3a2a'; g.lineWidth = Math.max(1.2, r * 0.1); g.lineCap = 'round'
  g.beginPath(); g.arc(s * r * 0.24, r * 0.2, r * 0.3 * (0.4 + 0.6 * happy), 0.15 * Math.PI, 0.85 * Math.PI); g.stroke()
  g.restore()
}

export function drawShadow(g: CanvasRenderingContext2D, v: View, a: Fig, b: Fig) {
  const ja = joints(resolve(a)), jb = joints(resolve(b))
  const xs = [ja.hip[0], ja.ft[0][0], ja.head[0], jb.hip[0], jb.ft[0][0], jb.head[0], ja.h[0][0], jb.h[0][0]]
  const lo = Math.min(...xs) - 0.1, hi = Math.max(...xs) + 0.1
  g.fillStyle = 'rgba(8,16,50,.3)'
  g.beginPath(); g.ellipse(X(v, (lo + hi) / 2), v.gy + 0.03 * v.s, ((hi - lo) / 2) * v.s, 0.1 * v.s, 0, 0, Math.PI * 2); g.fill()
}
export const toScreen = (v: View, x: number, y: number): V => [X(v, x), Y(v, y)]
