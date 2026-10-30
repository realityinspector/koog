// Drawing for Jiu-Jitsu Flow: the dojo background (rendered once per size) and the cartoon grapplers.
import { joints, resolve, type Fig, type V } from './poses'

export interface View { w: number; h: number; s: number; ox: number; gy: number }
export interface Look { gi: string; edge: string; skin: string; hair: string; belt: string; shade: string; hairStyle: number }

export const KID_LOOK = (belt: string): Look => ({ gi: '#f6f6f2', edge: '#9aa0b8', skin: '#e9b48b', hair: '#4a2f1c', belt, shade: '#d7dae6', hairStyle: 0 })
export const PARTNER_LOOKS: Look[] = [
  { gi: '#3568d8', edge: '#16327e', skin: '#bd7d56', hair: '#1c1613', belt: '#8a5429', shade: '#2b55b4', hairStyle: 2 },
  { gi: '#3568d8', edge: '#16327e', skin: '#f0c49c', hair: '#8a3b1c', belt: '#2e7d3f', shade: '#2b55b4', hairStyle: 3 },
  { gi: '#3a4f8f', edge: '#1a2650', skin: '#8d5a3b', hair: '#241a14', belt: '#d6a21e', shade: '#2d3f77', hairStyle: 1 },
  { gi: '#2f6fd0', edge: '#16327e', skin: '#e2ab82', hair: '#111118', belt: '#7a3d9e', shade: '#2858ac', hairStyle: 4 },
]
export const PARTNER_LOOK: Look = PARTNER_LOOKS[0]

export function makeView(w: number, h: number): View {
  const gy = Math.max(h * 0.58, h - Math.min(h < 520 ? 98 : 112, h * 0.25))
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
  // chair rail along the top of the wainscot
  const ry = wallH * 0.72
  g.fillStyle = '#9a6a45'; g.fillRect(0, ry - 5, w, 8)
  g.fillStyle = 'rgba(255,230,180,.35)'; g.fillRect(0, ry - 5, w, 2)
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, ry + 3, w, 3)
  const pw = Math.min(150, w / 6)
  const wins: number[] = []
  for (let i = 0; i < 4; i++) {
    const x = w * (0.1 + i * 0.1 * (i > 1 ? 0 : 1)) + (i > 1 ? w * 0.55 + (i - 2) * (pw + 12) : 0)
    wins.push(x)
    const sky = g.createLinearGradient(0, wallH * 0.12, 0, wallH * 0.64)
    sky.addColorStop(0, 'rgba(255,236,190,.34)'); sky.addColorStop(1, 'rgba(255,214,150,.16)')
    g.fillStyle = sky; g.fillRect(x, wallH * 0.12, pw, wallH * 0.52)
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
  // mat texture: fine speckle and alternating tile tint, seeded so it never shimmers
  g.save(); g.beginPath(); g.moveTo(ml + inset, mt); g.lineTo(mr - inset, mt); g.lineTo(mr, mb); g.lineTo(ml, mb); g.closePath(); g.clip()
  let sd = 12345
  const rr = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296)
  const dots = Math.min(900, Math.round((w * h) / 900))
  for (let i = 0; i < dots; i++) {
    g.fillStyle = rr() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,10,50,.09)'
    const dy = mt + rr() * (mb - mt)
    g.fillRect(rr() * w, dy, 1.6, 1.2)
  }
  for (let i = -8; i < 24; i += 2) {
    const t0 = i / 16, t1 = (i + 1) / 16
    g.fillStyle = 'rgba(255,255,255,.035)'
    g.beginPath()
    g.moveTo(ml + inset + (mr - ml - 2 * inset) * t0, mt); g.lineTo(ml + inset + (mr - ml - 2 * inset) * t1, mt)
    g.lineTo(ml + (mr - ml) * (t1 * 1.35 - 0.175), mb); g.lineTo(ml + (mr - ml) * (t0 * 1.35 - 0.175), mb); g.closePath(); g.fill()
  }
  g.restore()
  // soft window light falling across the floor
  for (const x of wins) {
    const lg = g.createLinearGradient(x, wallH * 0.64, x + pw * 0.6, mb)
    lg.addColorStop(0, 'rgba(255,235,180,.10)'); lg.addColorStop(1, 'rgba(255,235,180,0)')
    g.fillStyle = lg
    g.beginPath(); g.moveTo(x, wallH * 0.64); g.lineTo(x + pw, wallH * 0.64); g.lineTo(x + pw * 1.5 + w * 0.08, mb); g.lineTo(x + w * 0.04, mb); g.closePath(); g.fill()
  }
  // a few seated classmates and a coach watching from the wall (flat silhouettes, no faces)
  const fl = wallH + 2
  const hs = Math.max(14, Math.min(34, h * 0.07))
  const sit = (cx: number, sc: number, col: string, tag: string) => {
    const r = hs * sc * 0.32
    g.fillStyle = col
    g.beginPath(); g.arc(cx, fl - hs * sc * 0.95, r, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.moveTo(cx - r * 1.6, fl); g.quadraticCurveTo(cx - r * 1.7, fl - hs * sc * 0.65, cx, fl - hs * sc * 0.65); g.quadraticCurveTo(cx + r * 1.7, fl - hs * sc * 0.65, cx + r * 1.6, fl); g.closePath(); g.fill()
    if (tag === 'b') { g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(cx - r * 1.6, fl - hs * sc * 0.28, r * 3.2, hs * sc * 0.09) }
  }
  const crowdCols = ['#1d1b34', '#23203d', '#1a1830']
  ;[0.09, 0.15, 0.21].forEach((u, i) => sit(w * u, 0.9 + (i % 2) * 0.15, crowdCols[i], 'b'))
  ;[0.79, 0.85, 0.91].forEach((u, i) => sit(w * u, 1 - (i % 2) * 0.12, crowdCols[(i + 1) % 3], 'b'))
  // soft vignette
  const vg = g.createRadialGradient(w / 2, h * 0.5, h * 0.3, w / 2, h * 0.5, h * 1.0)
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,6,30,.45)')
  g.fillStyle = vg; g.fillRect(0, 0, w, h)
  return c
}

type P = [number, number]
const deg = (d: number) => (d * Math.PI) / 180
const ang = (a: V, b: V) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI

/** A tapered capsule between two screen points. */
function capsule(g: CanvasRenderingContext2D, a: P, b: P, ra: number, rb: number) {
  const an = Math.atan2(b[1] - a[1], b[0] - a[0])
  g.beginPath()
  g.arc(a[0], a[1], ra, an + Math.PI / 2, an + Math.PI * 1.5)
  g.arc(b[0], b[1], rb, an - Math.PI / 2, an + Math.PI / 2)
  g.closePath()
}

/** A limb of tapered bones: outline pass, fill pass, then a soft highlight and shadow stripe for volume. */
function limb(g: CanvasRenderingContext2D, v: View, pts: V[], radii: number[], fill: string, edge: string, shade = true) {
  const sp = pts.map((p) => [X(v, p[0]), Y(v, p[1])] as P)
  const rs = radii.map((r) => r * v.s)
  const ow = Math.max(1.4, 0.022 * v.s)
  g.lineJoin = 'round'
  g.fillStyle = edge; g.strokeStyle = edge; g.lineWidth = ow * 2
  for (let i = 0; i < sp.length - 1; i++) { capsule(g, sp[i], sp[i + 1], rs[i], rs[i + 1]); g.fill(); g.stroke() }
  g.fillStyle = fill
  for (let i = 0; i < sp.length - 1; i++) { capsule(g, sp[i], sp[i + 1], rs[i], rs[i + 1]); g.fill() }
  if (!shade) return
  g.lineCap = 'round'
  for (let i = 0; i < sp.length - 1; i++) {
    const a = sp[i], b = sp[i + 1]
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1
    let nx = -dy / d, ny = dx / d
    if (ny > 0) { nx = -nx; ny = -ny }
    const k = 0.42
    g.strokeStyle = 'rgba(255,255,255,.26)'; g.lineWidth = rs[i] * 0.4
    g.beginPath(); g.moveTo(a[0] + nx * rs[i] * k, a[1] + ny * rs[i] * k); g.lineTo(b[0] + nx * rs[i + 1] * k, b[1] + ny * rs[i + 1] * k); g.stroke()
    g.strokeStyle = 'rgba(10,10,50,.16)'; g.lineWidth = rs[i] * 0.5
    g.beginPath(); g.moveTo(a[0] - nx * rs[i] * 0.55, a[1] - ny * rs[i] * 0.55); g.lineTo(b[0] - nx * rs[i + 1] * 0.55, b[1] - ny * rs[i + 1] * 0.55); g.stroke()
  }
}
const lerpV = (a: V, b: V, u: number): V => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]

function arm(g: CanvasRenderingContext2D, v: View, sh: V, el: V, hd: V, look: Look, fill: string) {
  const edge = look.edge
  const wr = lerpV(el, hd, 0.76)
  // skin forearm and fist first, then the baggy sleeve over it
  limb(g, v, [wr, hd], [0.036, 0.042], look.skin, edge, false)
  const fx = X(v, hd[0]), fy = Y(v, hd[1])
  g.beginPath(); g.arc(fx, fy, 0.05 * v.s, 0, Math.PI * 2); g.fillStyle = look.skin; g.fill(); g.strokeStyle = edge; g.lineWidth = Math.max(1.2, 0.02 * v.s); g.stroke()
  limb(g, v, [sh, el, wr], [0.068, 0.066, 0.06], fill, edge)
  // cuff band
  limb(g, v, [lerpV(el, hd, 0.6), wr], [0.058, 0.058], look.shade, edge, false)
}

function leg(g: CanvasRenderingContext2D, v: View, hip: V, kn: V, ft: V, look: Look, fill: string, f: number) {
  const edge = look.edge
  // foot (skin) pointing the way the figure faces
  const sa = ang(kn, ft)
  const fa = deg(sa + 90 * f)
  const cx = X(v, ft[0]) + Math.cos(fa) * 0.035 * v.s, cy = Y(v, ft[1]) - Math.sin(fa) * 0.035 * v.s
  g.beginPath(); g.ellipse(cx, cy, 0.062 * v.s, 0.036 * v.s, -fa, 0, Math.PI * 2)
  g.fillStyle = look.skin; g.fill(); g.strokeStyle = edge; g.lineWidth = Math.max(1.2, 0.02 * v.s); g.stroke()
  limb(g, v, [hip, kn, lerpV(kn, ft, 0.8)], [0.085, 0.07, 0.062], fill, edge)
  limb(g, v, [lerpV(kn, ft, 0.62), lerpV(kn, ft, 0.82)], [0.062, 0.062], look.shade, edge, false)
}

export function drawFig(g: CanvasRenderingContext2D, v: View, f0: Fig, look: Look, happy = 1, t = 0, mood = 0) {
  const f = resolve(f0)
  const j = joints(f)
  const edge = look.edge
  const far = look.shade
  // far arm and leg first
  leg(g, v, j.hip, j.kn[1], j.ft[1], look, far, f.f)
  arm(g, v, j.neck, j.e[1], j.h[1], look, far)
  // torso, with the jacket skirt flaring a little below the belt
  const tx = j.neck[0] - j.hip[0], ty = j.neck[1] - j.hip[1]
  const down: V = [j.hip[0] - tx * 0.18, j.hip[1] - ty * 0.18]
  limb(g, v, [down, j.hip, j.neck], [0.12, 0.14, 0.15], look.gi, edge)
  // front direction (the side the face points to)
  const tl = Math.hypot(tx, ty) || 1
  const fx = (ty / tl) * f.f, fy = (-tx / tl) * f.f
  // lapel V and collar
  const mid = lerpV(j.hip, j.neck, 0.52)
  const L = (a: V, b: V, w: number, c: string) => {
    g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'
    g.beginPath(); g.moveTo(X(v, a[0]), Y(v, a[1])); g.lineTo(X(v, b[0]), Y(v, b[1])); g.stroke()
  }
  const nk1: V = [j.neck[0] + fx * 0.07 - tx * 0.02, j.neck[1] + fy * 0.07 - ty * 0.02]
  const nk2: V = [j.neck[0] - fx * 0.05 - tx * 0.02, j.neck[1] - fy * 0.05 - ty * 0.02]
  const vee: V = [mid[0] + fx * 0.02, mid[1] + fy * 0.02]
  L(nk1, vee, 0.04 * v.s, edge); L(nk1, vee, 0.022 * v.s, look.gi)
  L(nk2, vee, 0.03 * v.s, edge); L(nk2, vee, 0.014 * v.s, look.shade)
  // belt band, knot and swinging tails
  const bt = lerpV(j.hip, j.neck, 0.12)
  limb(g, v, [j.hip, bt], [0.148, 0.152], look.belt, 'rgba(20,10,10,.55)', false)
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 0.02 * v.s
  g.beginPath(); g.moveTo(X(v, j.hip[0]), Y(v, j.hip[1]) - 0.0); g.lineTo(X(v, bt[0]), Y(v, bt[1])); g.stroke()
  const kn0: V = [bt[0] + fx * 0.13 - tx * 0.04, bt[1] + fy * 0.13 - ty * 0.04]
  const sway = Math.sin(t * 2.3) * 7 + mood * 0
  for (let i = 0; i < 2; i++) {
    const a = deg(-90 + (i ? 26 : -18) * f.f + sway * (i ? 1.2 : 0.8))
    const len = i ? 0.2 : 0.16
    const e: V = [kn0[0] + Math.cos(a) * len, Math.max(0.01, kn0[1] + Math.sin(a) * len)]
    const m: V = [kn0[0] + Math.cos(a + 0.25) * len * 0.5, kn0[1] + Math.sin(a + 0.25) * len * 0.5]
    g.strokeStyle = 'rgba(20,10,10,.55)'; g.lineWidth = 0.056 * v.s; g.lineCap = 'round'
    g.beginPath(); g.moveTo(X(v, kn0[0]), Y(v, kn0[1])); g.quadraticCurveTo(X(v, m[0]), Y(v, m[1]), X(v, e[0]), Y(v, e[1])); g.stroke()
    g.strokeStyle = look.belt; g.lineWidth = 0.04 * v.s
    g.beginPath(); g.moveTo(X(v, kn0[0]), Y(v, kn0[1])); g.quadraticCurveTo(X(v, m[0]), Y(v, m[1]), X(v, e[0]), Y(v, e[1])); g.stroke()
  }
  g.beginPath(); g.ellipse(X(v, kn0[0]), Y(v, kn0[1]), 0.045 * v.s, 0.04 * v.s, 0, 0, Math.PI * 2)
  g.fillStyle = look.belt; g.fill(); g.strokeStyle = 'rgba(20,10,10,.6)'; g.lineWidth = Math.max(1.2, 0.016 * v.s); g.stroke()
  // near leg, head, near arm
  leg(g, v, j.hip, j.kn[0], j.ft[0], look, look.gi, f.f)
  drawHead(g, v, f, j.head, look, happy, t, mood)
  arm(g, v, j.neck, j.e[0], j.h[0], look, look.gi)
}

function drawHead(g: CanvasRenderingContext2D, v: View, f: Fig, c: V, look: Look, happy: number, t: number, mood: number) {
  const r = 0.125 * v.s
  g.save()
  g.translate(X(v, c[0]), Y(v, c[1]))
  g.rotate(-((f.t + f.hd - 90) * Math.PI) / 180)
  const s = f.f
  const lw = Math.max(1, 0.02 * v.s)
  const disc = (x: number, y: number, rr: number, fill: string) => { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fillStyle = fill; g.fill() }
  const hs = look.hairStyle
  // hair behind the head
  g.fillStyle = look.hair
  if (hs === 1) { disc(-s * r * 0.35, -r * 1.12, r * 0.42, look.hair); g.strokeStyle = look.edge; g.lineWidth = lw * 0.6; g.stroke() } // topknot
  if (hs === 3) { // ponytail
    g.beginPath(); g.moveTo(-s * r * 0.8, -r * 0.4); g.quadraticCurveTo(-s * r * 1.9, -r * 0.1, -s * r * 1.5, r * 1.0); g.quadraticCurveTo(-s * r * 1.15, r * 0.1, -s * r * 0.7, r * 0.3); g.closePath(); g.fill()
  }
  if (hs === 2) for (let i = 0; i < 7; i++) { const a = Math.PI * (1.0 + i / 6); disc(Math.cos(a) * r * 1.0, Math.sin(a) * r * 1.0 - r * 0.05, r * 0.4, look.hair) }
  disc(-s * r * 0.12, -r * 0.1, r * 1.06, look.hair)
  // ear and face
  disc(-s * r * 0.72, r * 0.12, r * 0.24, look.skin)
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2)
  g.fillStyle = look.skin; g.fill(); g.strokeStyle = look.edge; g.lineWidth = lw; g.stroke()
  // cheek shade
  g.fillStyle = 'rgba(120,40,30,.13)'; g.beginPath(); g.ellipse(-s * r * 0.35, r * 0.45, r * 0.6, r * 0.34, 0, 0, Math.PI * 2); g.fill()
  // hair fringe
  g.fillStyle = look.hair
  g.beginPath(); g.arc(0, 0, r, Math.PI * 1.02, Math.PI * 1.95); g.lineTo(s * r * 0.1, -r * 0.35); g.closePath(); g.fill()
  if (hs === 0) { g.beginPath(); g.moveTo(-s * r * 0.1, -r * 0.95); g.quadraticCurveTo(s * r * 0.1, -r * 1.5, s * r * 0.45, -r * 1.1); g.quadraticCurveTo(s * r * 0.2, -r * 1.05, -s * r * 0.1, -r * 0.6); g.fill() } // cowlick
  if (hs === 4) { g.fillStyle = '#d33a3a'; g.fillRect(-r * 1.02, -r * 0.55, r * 2.04, r * 0.26); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = lw * 0.7; g.strokeRect(-r * 1.02, -r * 0.55, r * 2.04, r * 0.26) } // headband
  // eyes (with a blink), brows, cheeks and mouth
  const blink = Math.sin(t * 1.3 + look.hair.length) > 0.985 ? 0.15 : 1
  const eye = (x: number, y: number) => {
    g.save(); g.translate(x, y); g.scale(1, blink)
    disc(0, 0, r * 0.15, '#ffffff'); disc(s * r * 0.03, 0, r * 0.1, '#1d1a2a'); disc(s * r * 0.06, -r * 0.04, r * 0.035, '#ffffff')
    g.restore()
  }
  eye(s * r * 0.5, r * 0.0); eye(s * r * 0.06, r * 0.0)
  g.strokeStyle = look.hair; g.lineWidth = Math.max(1.2, r * 0.1); g.lineCap = 'round'
  const bl = mood === 1 ? -0.3 : mood === 2 ? 0.3 : happy < 0.5 ? 0.35 : 0
  for (const bx of [0.5, 0.06]) {
    g.beginPath(); g.moveTo(s * r * (bx - 0.15), -r * (0.3 + bl * (bx > 0.3 ? -1 : 1) * 0.2)); g.lineTo(s * r * (bx + 0.15), -r * (0.3 - bl * (bx > 0.3 ? -1 : 1) * 0.2)); g.stroke()
  }
  g.fillStyle = 'rgba(255,90,90,.28)'; g.beginPath(); g.arc(s * r * 0.32, r * 0.38, r * 0.14, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#7a3a2a'; g.lineWidth = Math.max(1.2, r * 0.1)
  if (mood === 2) { g.beginPath(); g.ellipse(s * r * 0.28, r * 0.42, r * 0.13, r * 0.17, 0, 0, Math.PI * 2); g.fillStyle = '#5a1f1f'; g.fill(); g.lineWidth = Math.max(1, r * 0.06); g.stroke() }
  else if (mood === 1) { g.beginPath(); g.moveTo(s * r * 0.1, r * 0.45); g.lineTo(s * r * 0.45, r * 0.45); g.stroke() }
  else { g.beginPath(); g.arc(s * r * 0.24, r * 0.2, r * 0.3 * (0.4 + 0.6 * happy), 0.15 * Math.PI, 0.85 * Math.PI); g.stroke() }
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
