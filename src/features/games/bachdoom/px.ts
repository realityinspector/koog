// Tiny pixel-art toolkit shared by the procedural art modules. Pure functions, no state.
// Colours are 0xAABBGGRR uint32 (see types.ts). Everything draws with hard pixel edges (no anti-aliasing).
import type { Img } from './types'

export const rgba = (r: number, g: number, b: number, a = 255) => (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0
/** '#rrggbb' or '#rgb' -> colour */
export function hex(s: string, a = 255): number {
  let h = s.replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  return rgba((n >> 16) & 255, (n >> 8) & 255, n & 255, a)
}
export const R = (c: number) => c & 255
export const G = (c: number) => (c >> 8) & 255
export const B = (c: number) => (c >> 16) & 255
export const A = (c: number) => (c >>> 24) & 255
/** linear mix of two colours, t 0..1 (alpha mixed too) */
export function mix(c1: number, c2: number, t: number): number {
  return rgba(R(c1) + (R(c2) - R(c1)) * t, G(c1) + (G(c2) - G(c1)) * t, B(c1) + (B(c2) - B(c1)) * t, A(c1) + (A(c2) - A(c1)) * t)
}
/** brighten (f>1) or darken (f<1), alpha kept */
export const shade = (c: number, f: number) => rgba(Math.min(255, R(c) * f), Math.min(255, G(c) * f), Math.min(255, B(c) * f), A(c))

export const newImg = (w: number, h: number): Img => ({ w, h, px: new Uint32Array(w * h) })
export const cloneImg = (i: Img): Img => ({ w: i.w, h: i.h, px: i.px.slice() })

/** set one pixel (bounds-checked, overwrites) */
export function put(img: Img, x: number, y: number, c: number) {
  x |= 0; y |= 0
  if (x >= 0 && y >= 0 && x < img.w && y < img.h) img.px[y * img.w + x] = c
}
export function get(img: Img, x: number, y: number): number {
  x |= 0; y |= 0
  return x >= 0 && y >= 0 && x < img.w && y < img.h ? img.px[y * img.w + x] : 0
}
export function fillRect(img: Img, x: number, y: number, w: number, h: number, c: number) {
  for (let j = Math.max(0, y | 0); j < Math.min(img.h, (y + h) | 0); j++)
    for (let i = Math.max(0, x | 0); i < Math.min(img.w, (x + w) | 0); i++) img.px[j * img.w + i] = c
}
/** filled ellipse centred at (cx, cy) with radii rx, ry */
export function fillEllipse(img: Img, cx: number, cy: number, rx: number, ry: number, c: number) {
  for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
    for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
      const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry
      if (dx * dx + dy * dy <= 1) put(img, i, j, c)
    }
}
/** ellipse outline (thickness in pixels) */
export function ringEllipse(img: Img, cx: number, cy: number, rx: number, ry: number, c: number, t = 1) {
  const irx = Math.max(0.01, rx - t), iry = Math.max(0.01, ry - t)
  for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
    for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
      const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry
      const ex = (i + 0.5 - cx) / irx, ey = (j + 0.5 - cy) / iry
      if (dx * dx + dy * dy <= 1 && ex * ex + ey * ey > 1) put(img, i, j, c)
    }
}
/** straight line with square brush of `thick` pixels */
export function line(img: Img, x0: number, y0: number, x1: number, y1: number, c: number, thick = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  const o = Math.floor((thick - 1) / 2)
  for (let s = 0; s <= n; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / n), y = Math.round(y0 + ((y1 - y0) * s) / n)
    for (let j = 0; j < thick; j++) for (let i = 0; i < thick; i++) put(img, x + i - o, y + j - o, c)
  }
}
/** filled polygon (even-odd scanline), pts = [[x,y],...] */
export function fillPoly(img: Img, pts: number[][], c: number) {
  let y0 = Infinity, y1 = -Infinity
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]) }
  const xs: number[] = []
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(img.h - 1, Math.ceil(y1)); y++) {
    xs.length = 0
    const yc = y + 0.5
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
    }
    xs.sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) put(img, x, y, c)
  }
}
/** add a 1px outline of colour c around every opaque region (grows the art by 1px; leave a margin) */
export function outline(img: Img, c: number) {
  const src = img.px.slice()
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= img.w || y >= img.h ? 0 : src[y * img.w + x])
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (A(src[y * img.w + x]) === 0 && (A(at(x - 1, y)) > 0 || A(at(x + 1, y)) > 0 || A(at(x, y - 1)) > 0 || A(at(x, y + 1)) > 0)) img.px[y * img.w + x] = c
}
/** paste src onto dst at (x, y); transparent pixels skipped */
export function blit(dst: Img, src: Img, x: number, y: number) {
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) { const c = src.px[j * src.w + i]; if (A(c) > 0) put(dst, x + i, y + j, c) }
}
export function flipH(img: Img): Img {
  const o = newImg(img.w, img.h)
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) o.px[y * img.w + x] = img.px[y * img.w + (img.w - 1 - x)]
  return o
}
/** seeded random 0..1 (mulberry32), so the art is the same every run */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
