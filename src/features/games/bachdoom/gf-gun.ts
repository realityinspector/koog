// The pipe-organ gun, seen from behind: wooden chest, fan of 5 golden pipes, white-gloved hands.
// 80 x 56 frames, transparent background, centred at the bottom of the screen. Pure + deterministic.
import { hex, mix, shade, rgba, R, G, B, A, newImg, fillRect, fillEllipse, ringEllipse, fillPoly, line, put, outline, blit, flipH } from './px'
import type { Gun, Img } from './types'

const W = 80, H = 56
const INK = hex('#1f1528')
const GOLD = ['#4a3208', '#7e5a12', '#b68a1f', '#dcb232', '#f6d65a', '#fff3b0'].map((s) => hex(s))
const WOOD = ['#2c190d', '#472a16', '#66401f', '#885a2b', '#a8733a'].map((s) => hex(s))
const GLOVE = ['#a9b0d0', '#d6dbee', '#ffffff'].map((s) => hex(s))
const CUFF = [hex('#9a1f35'), hex('#d83a50'), hex('#ff7b8c')]

interface Pipe { xb: number; yb: number; wb: number; xt: number; yt: number; wt: number; bend?: number }
// fan of five pipes: centre tallest; drawn outer-first so the middle one is in front
const PIPES: Pipe[] = [
  { xb: 17, yb: 39, wb: 11, xt: 12, yt: 22, wt: 10 },
  { xb: 63, yb: 39, wb: 11, xt: 68, yt: 22, wt: 10 },
  { xb: 28, yb: 38, wb: 12, xt: 25, yt: 14, wt: 11 },
  { xb: 52, yb: 38, wb: 12, xt: 55, yt: 14, wt: 11 },
  { xb: 40, yb: 38, wb: 14, xt: 40, yt: 7, wt: 13 },
]

/** cylinder shade index 0..5 for u in 0..1 across the pipe (highlight left of centre) */
const prof = (u: number) => (u < 0.1 ? 0 : u < 0.2 ? 1 : u < 0.28 ? 3 : u < 0.4 ? 5 : u < 0.5 ? 4 : u < 0.62 ? 3 : u < 0.78 ? 2 : u < 0.9 ? 1 : 0)

function drawPipe(img: Img, p: Pipe, glow: number, bend: number) {
  const ry = Math.max(3, Math.round(p.wt * 0.32))
  const top = p.yt + ry
  const span = p.yb - top
  const centre = (t: number) => p.xt + (p.xb - p.xt) * t + bend * (1 - t) ** 1.6
  const width = (t: number) => p.wt + (p.wb - p.wt) * t
  const row = (y: number, f: (idx: number) => number) => {
    const t = (y - top) / span
    const cx = centre(t), w = width(t)
    const xl = Math.round(cx - w / 2), xr = Math.round(cx + w / 2) - 1
    for (let x = xl; x <= xr; x++) put(img, x, y, GOLD[f(prof((x - xl + 0.5) / (xr - xl + 1)))])
    return [xl, xr]
  }
  for (let y = top; y <= p.yb; y++) {
    let f = (i: number) => i
    // rings
    for (const rt of [0.14, 0.46, 0.8]) {
      const ry0 = Math.round(top + span * rt)
      if (y === ry0) f = (i) => Math.min(5, i + 1)
      else if (y === ry0 + 1) f = (i) => Math.max(0, i - 1)
      else if (y === ry0 + 2) f = () => 0
    }
    if (y === p.yb) f = (i) => Math.max(0, i - 2)
    row(y, f)
  }
  // mouth (slit with lips)
  const my = Math.round(top + span * 0.56)
  const tm = (my - top) / span
  const [ml, mr] = (() => { const w = width(tm), cx = centre(tm); return [Math.round(cx - w / 2) + 2, Math.round(cx + w / 2) - 3] })()
  if (mr - ml >= 3) {
    fillRect(img, ml, my - 1, mr - ml + 1, 1, GOLD[0])
    fillRect(img, ml, my, mr - ml + 1, 4, hex('#1a0d06'))
    fillRect(img, ml, my + 2, mr - ml + 1, 2, hex('#33200d'))
    fillRect(img, ml, my + 4, mr - ml + 1, 1, GOLD[5])
    fillRect(img, ml + 1, my + 5, mr - ml - 1, 1, GOLD[1])
  }
  // open top: bright rim ring, dark (or glowing) bore
  const cx0 = centre(0)
  const rx = p.wt / 2
  fillEllipse(img, cx0, p.yt + ry, rx, ry, GOLD[4])
  ringEllipse(img, cx0, p.yt + ry, rx, ry, GOLD[2], 1)
  fillEllipse(img, cx0, p.yt + ry + 0.4, rx - 1.6, Math.max(1, ry - 1.4), glow === 1 ? hex('#ffe9a0') : glow === 2 ? hex('#ffb347') : hex('#150a05'))
  if (glow === 0) fillEllipse(img, cx0 - 0.5, p.yt + ry + 0.9, Math.max(1, rx - 3), Math.max(1, ry - 2), hex('#2b160a'))
  // a pale glint on the near rim
  put(img, Math.round(cx0 - rx * 0.55), p.yt + 1, GOLD[5])
  return [cx0, p.yt + ry, rx, ry]
}

function drawBody(img: Img) {
  // top face of the chest (we look slightly down on it)
  fillPoly(img, [[18, 33], [62, 33], [71, 40], [9, 40]], WOOD[3])
  fillRect(img, 17, 33, 46, 3, WOOD[2])
  fillRect(img, 12, 39, 56, 1, WOOD[4])
  // front face
  fillRect(img, 10, 43, 61, 13, WOOD[2])
  for (let x = 14; x < 70; x += 6) fillRect(img, x, 44, 1, 12, WOOD[1])
  fillRect(img, 10, 43, 2, 13, WOOD[1]); fillRect(img, 69, 43, 2, 13, WOOD[1])
  fillRect(img, 12, 43, 1, 13, WOOD[3])
  // gold trim along the top edge and base
  fillRect(img, 9, 40, 62, 1, GOLD[4])
  fillRect(img, 9, 41, 62, 1, GOLD[3])
  fillRect(img, 9, 42, 62, 1, GOLD[1])
  fillRect(img, 10, 53, 61, 1, GOLD[2])
  fillRect(img, 10, 54, 61, 2, WOOD[0])
  // key bay
  fillRect(img, 24, 43, 32, 1, GOLD[2])
  fillRect(img, 24, 44, 32, 10, GOLD[1])
  fillRect(img, 25, 44, 30, 9, hex('#150a05'))
  const kw = hex('#f6f1e2'), ks = hex('#c4bca8')
  for (let k = 0; k < 14; k++) {
    const x = 26 + k * 2
    fillRect(img, x, 46, 1, 6, kw)
    fillRect(img, x + 1, 46, 1, 6, k % 2 ? ks : kw)
    put(img, x + 1, 51, ks)
  }
  for (const i of [1, 2, 4, 5, 6, 8, 9, 11, 12]) fillRect(img, 25 + i * 2, 46, 2, 3, hex('#1c1424'))
}

function shadedGlove(img: Img, cx: number, cy: number, rx: number, ry: number) {
  for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
    for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
      const nx = (i + 0.5 - cx) / rx, ny = (j + 0.5 - cy) / ry
      if (nx * nx + ny * ny > 1) continue
      const l = -(0.55 * nx + 0.8 * ny)
      put(img, i, j, GLOVE[l > -0.15 ? 2 : l > -0.65 ? 1 : 0])
    }
}

/** left glove gripping the corner of the chest (mirrored for the right): 3 fingers + thumb, cartoon style */
function leftHand(): Img {
  const h = newImg(W, H)
  // three fingers curling in over the front of the chest (middle one longest)
  const rows = [{ y: 43, x1: 22 }, { y: 47, x1: 24 }, { y: 51, x1: 22 }]
  for (const r of rows) {
    fillRect(h, 7, r.y - 1, r.x1 - 5, 5, INK)
    fillRect(h, 7, r.y, r.x1 - 6, 3, GLOVE[2])
    fillRect(h, 7, r.y + 2, r.x1 - 6, 1, GLOVE[1])
    fillRect(h, 7, r.y + 1, 1, 1, GLOVE[2])
    put(h, r.x1, r.y, INK); put(h, r.x1, r.y + 2, INK) // rounded fingertip
    put(h, r.x1 - 2, r.y + 2, GLOVE[0])
  }
  // back of the hand
  fillEllipse(h, 9, 49, 7.6, 7.4, INK)
  shadedGlove(h, 9, 49, 6.6, 6.4)
  // thumb resting on top of the chest
  fillEllipse(h, 15.5, 41, 4.4, 3.6, INK)
  shadedGlove(h, 15.5, 41, 3.4, 2.6)
  // three stitch lines on the back of the hand
  for (const [x0, y0, x1, y1] of [[7, 44, 6, 47], [10, 44, 9, 47], [13, 45, 12, 48]]) line(h, x0, y0, x1, y1, GLOVE[0])
  // cuff
  fillRect(h, 3, 52, 11, 4, INK)
  fillRect(h, 4, 53, 9, 3, CUFF[1]); fillRect(h, 4, 53, 9, 1, CUFF[2]); fillRect(h, 4, 55, 9, 1, CUFF[0])
  return h
}

function dull(img: Img, amt: number) {
  for (let i = 0; i < img.px.length; i++) {
    const c = img.px[i]
    if (A(c) === 0) continue
    const l = R(c) * 0.3 + G(c) * 0.59 + B(c) * 0.11
    img.px[i] = shade(mix(c, rgba(l, l, l), amt), 0.92)
  }
}

interface Opts { dy: number; glow: 0 | 1 | 2; jam: boolean }

function drawGun(o: Opts): Img {
  const art = newImg(W, H)
  drawBody(art)
  const tops: number[][] = []
  const bends = o.jam ? [3, -3, -2, 2, 3] : [0, 0, 0, 0, 0]
  const lean = o.jam ? [{ dx: 2, dy: 2 }, { dx: -2, dy: 4 }, { dx: -1, dy: 1 }, { dx: 1, dy: 3 }, { dx: 1, dy: 0 }] : null
  PIPES.forEach((p, i) => {
    const q = lean ? { ...p, xt: p.xt + lean[i].dx, yt: p.yt + lean[i].dy } : p
    tops.push(drawPipe(art, q, o.glow, bends[i]))
  })
  // redraw the front lip over pipe bases so they sit behind the chest edge
  fillRect(art, 9, 40, 62, 1, GOLD[4]); fillRect(art, 9, 41, 62, 1, GOLD[3]); fillRect(art, 9, 42, 62, 1, GOLD[1])
  const left = leftHand()
  blit(art, left, 0, 0)
  blit(art, flipH(left), 0, 0)
  if (o.jam) dull(art, 0.55)
  outline(art, INK)

  // warm glow over the open pipe tops (only onto empty pixels)
  if (o.glow) {
    const gl = [hex('#fff6c0'), hex('#ffd36a'), hex('#ff9d3c'), hex('#e0652a')]
    for (const [cx, cy, rx, ry] of tops) {
      const R0 = rx + (o.glow === 1 ? 4 : 2.5)
      for (let j = Math.floor(cy - R0 - 1); j <= Math.ceil(cy + 1); j++)
        for (let i = Math.floor(cx - R0); i <= Math.ceil(cx + R0); i++) {
          if (A(art.px[j * W + i] ?? 1) !== 0 || i < 0 || j < 0 || i >= W || j >= H) continue
          const dx = (i + 0.5 - cx) / R0, dy = (j + 0.5 - cy + 1) / (R0 * 0.8)
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d > 1) continue
          const c = d < 0.5 ? gl[0] : d < 0.72 ? gl[1] : (i + j) % 2 === 0 ? gl[2] : 0
          if (c && (o.glow === 1 || d < 0.85)) put(art, i, j, o.glow === 2 && d >= 0.5 ? (d < 0.72 ? gl[2] : gl[3]) : c)
        }
    }
  }

  // grey smoke wisps for the jam
  if (o.jam) {
    const sm = [hex('#e3e4ee'), hex('#b4b6c8'), hex('#868aa4')]
    const puff = (cx: number, cy: number, r: number) => {
      fillEllipse(art, cx, cy, r + 0.8, r + 0.8, sm[2])
      fillEllipse(art, cx - 0.3, cy - 0.4, r, r, sm[1])
      fillEllipse(art, cx - 0.8, cy - 0.9, r * 0.6, r * 0.6, sm[0])
    }
    for (const [cx, cy, s] of [[tops[4][0] + 3, tops[4][1] - 3, 1], [tops[2][0] - 2, tops[2][1] - 3, 0.8]]) {
      puff(cx, cy, 2.6 * s); puff(cx + 2 * s, cy - 4.5 * s, 2.2 * s); puff(cx - 1 * s, cy - 8 * s, 1.7 * s); put(art, Math.round(cx + 3 * s), Math.round(cy - 11 * s), sm[1])
    }
  }

  const out = newImg(W, H)
  blit(out, art, 0, o.dy)
  return out
}

export function makeGun(): Gun {
  return {
    idle: drawGun({ dy: 0, glow: 0, jam: false }),
    fire: [drawGun({ dy: 4, glow: 1, jam: false }), drawGun({ dy: 2, glow: 2, jam: false })],
    jam: drawGun({ dy: 1, glow: 0, jam: true }),
  }
}
