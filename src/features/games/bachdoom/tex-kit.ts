// Tiny helpers for seamless (wrap-around) 64 x 64 texture painting. Pure functions, no state.
import { newImg, rng } from './px'
import type { Img } from './types'
import { TEX } from './types'

export const wrap = (v: number) => ((v % TEX) + TEX) % TEX

/** put a pixel with wrap-around edges, so anything drawn off one side re-enters on the other */
export function wput(img: Img, x: number, y: number, c: number) {
  img.px[wrap(Math.floor(y)) * TEX + wrap(Math.floor(x))] = c
}
export function wget(img: Img, x: number, y: number): number {
  return img.px[wrap(Math.floor(y)) * TEX + wrap(Math.floor(x))]
}
export function wrect(img: Img, x: number, y: number, w: number, h: number, c: number) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) wput(img, x + i, y + j, c)
}
export function wline(img: Img, x0: number, y0: number, x1: number, y1: number, c: number, thick = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  const o = Math.floor((thick - 1) / 2)
  for (let s = 0; s <= n; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / n), y = Math.round(y0 + ((y1 - y0) * s) / n)
    for (let j = 0; j < thick; j++) for (let i = 0; i < thick; i++) wput(img, x + i - o, y + j - o, c)
  }
}
export function wdisc(img: Img, cx: number, cy: number, r: number, c: number) {
  for (let j = -Math.ceil(r); j <= Math.ceil(r); j++)
    for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) if (i * i + j * j <= r * r) wput(img, cx + i, cy + j, c)
}

/** build a texture from a per-pixel function (x, y in 0..63) -> colour */
export function paint(f: (x: number, y: number) => number): Img {
  const img = newImg(TEX, TEX)
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) img.px[y * TEX + x] = f(x, y)
  return img
}

/** deterministic hash -> 0..1 */
export function hash(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** seamless smooth value noise (0..1); nx * ny lattice cells across the tile */
export function noise(seed: number, nx: number, ny: number): (x: number, y: number) => number {
  const r = rng(seed)
  const v = new Float32Array(nx * ny)
  for (let i = 0; i < v.length; i++) v[i] = r()
  return (x, y) => {
    const fx = (wrap(x) / TEX) * nx, fy = (wrap(y) / TEX) * ny
    const ix = Math.floor(fx), iy = Math.floor(fy)
    let tx = fx - ix, ty = fy - iy
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty)
    const x1 = (ix + 1) % nx, y1 = (iy + 1) % ny
    const a = v[iy * nx + ix], b = v[iy * nx + x1], c = v[y1 * nx + ix], d = v[y1 * nx + x1]
    return a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty
  }
}

/** pick a palette entry for t in 0..1 (posterize) */
export function ramp(cols: number[], t: number): number {
  return cols[Math.max(0, Math.min(cols.length - 1, Math.floor(t * cols.length)))]
}
