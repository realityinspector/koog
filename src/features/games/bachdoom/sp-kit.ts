// Sprite-painting kit for BachDoom's procedural art. Pure functions, no state.
// Idea: every body part is painted flat into its own layer, then `part()` bevels it (light top-left,
// shadow bottom-right), adds a 1px dark outline and stamps it on the sprite, like layered stickers.
import type { Img } from './types'
import { fillEllipse, fillRect, get, hex, mix, newImg, put } from './px'

export interface Ramp { d: number; s: number; m: number; l: number; h: number } // deep, shadow, mid, light, highlight

const COOL = hex('#2b1055'), WARM = hex('#fff1c4'), DEEP = hex('#14051f')
export function ramp(base: string | number): Ramp {
  const m = typeof base === 'string' ? hex(base) : base
  return { d: mix(m, DEEP, 0.72), s: mix(m, COOL, 0.45), m, l: mix(m, WARM, 0.34), h: mix(m, hex('#ffffff'), 0.72) }
}
/** the same colours one step darker (so a part can reuse a sprite's existing palette) */
export const darker = (r: Ramp): Ramp => ({ d: r.d, s: r.d, m: r.s, l: r.m, h: r.l })
export const WHITE: Ramp = { d: hex('#5b5080'), s: hex('#b7acdc'), m: hex('#f3eeff'), l: hex('#ffffff'), h: hex('#ffffff') }

export const OL = hex('#1a0b2b')       // standard outline
export const MOUTH = hex('#3d0f34')    // inside of a mouth
export const TONGUE = hex('#e5587a')
export const TOOTH = hex('#fffbe6')
export const TOOTH_S = hex('#e4d8b4')

/** paint a part: draw(layer, flatColour) -> bevel -> outline -> stamp on dst. flat=true skips the bevel.
 *  innerOc: outline only where dst is already painted (soft inner contours), and nothing outside. */
export function part(dst: Img, r: Ramp, oc: number, draw: (L: Img, F: number) => void, flat = false, innerOc?: number) {
  const w = dst.w, h = dst.h
  const L = newImg(w, h)
  draw(L, r.m)
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (L.px[y * w + x] !== 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) return
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && L.px[y * w + x] !== 0
  const out = L.px.slice()
  if (!flat) {
    const F = r.m
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x
      if (L.px[i] !== F) continue
      let d1 = 1; while (d1 < 9 && inside(x - d1, y - d1)) d1++
      let d2 = 1; while (d2 < 9 && inside(x + d2, y + d2)) d2++
      const t = d1 + d2 - 1
      const lw = t >= 14 ? 2 : 1
      const sw = t >= 13 ? 3 : t >= 7 ? 2 : 1
      let c = F
      if (d1 <= lw) c = r.l
      else if (d2 <= sw) c = r.s
      else if (t >= 16 && ((x + y) & 1) === 0) { if (d1 === lw + 1) c = r.l; else if (d2 === sw + 1) c = r.s }
      out[i] = c
    }
  }
  for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue
    const i = y * w + x
    if (L.px[i] !== 0) dst.px[i] = out[i]
    else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) { if (innerOc === undefined) dst.px[i] = oc; else if (dst.px[i] !== 0) dst.px[i] = innerOc }
  }
}

/** round brush stroke at a continuous position */
export function dot(L: Img, x: number, y: number, w: number, c: number) {
  if (w <= 1.5) put(L, Math.floor(x), Math.floor(y), c)
  else fillEllipse(L, x, y, w / 2, w / 2, c)
}
/** quadratic / cubic bezier stroke with tapering width */
export function curve(L: Img, pts: number[][], w0: number, w1: number, c: number, steps = 48) {
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, u = 1 - t
    let x: number, y: number
    if (pts.length === 3) {
      x = u * u * pts[0][0] + 2 * u * t * pts[1][0] + t * t * pts[2][0]
      y = u * u * pts[0][1] + 2 * u * t * pts[1][1] + t * t * pts[2][1]
    } else {
      x = u * u * u * pts[0][0] + 3 * u * u * t * pts[1][0] + 3 * u * t * t * pts[2][0] + t * t * t * pts[3][0]
      y = u * u * u * pts[0][1] + 3 * u * u * t * pts[1][1] + 3 * u * t * t * pts[2][1] + t * t * t * pts[3][1]
    }
    dot(L, x, y, w0 + (w1 - w0) * t, c)
  }
}
/** spiral stroke: from radius r0 down to r1 around (cx,cy), starting angle a0, turning `turns` turns */
export function spiral(L: Img, cx: number, cy: number, r0: number, r1: number, a0: number, turns: number, w0: number, w1: number, c: number, steps = 70) {
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, a = a0 + t * turns * Math.PI * 2, r = r0 + (r1 - r0) * t
    dot(L, cx + Math.cos(a) * r, cy + Math.sin(a) * r, w0 + (w1 - w0) * t, c)
  }
}
/** paint only where the layer already holds something (the `over` arg is kept for readability) */
export function clipEllipse(L: Img, cx: number, cy: number, rx: number, ry: number, c: number, over: number) {
  for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
    for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
      const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry
      if (dx * dx + dy * dy <= 1 && get(L, i, j) !== 0) put(L, i, j, c)
    }
}
export function clipRect(L: Img, x: number, y: number, w: number, h: number, c: number, over: number) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (get(L, i, j) !== 0 && over >= 0) put(L, i, j, c)
}
/** remove (make transparent) everything above a sloped line y = ya + (yb - ya) * (x - xa) / (xb - xa) */
export function cutAbove(L: Img, xa: number, ya: number, xb: number, yb: number) {
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const ly = ya + ((yb - ya) * (x + 0.5 - xa)) / (xb - xa)
    if (y + 0.5 < ly) L.px[y * L.w + x] = 0
  }
}

export interface EyeOpts {
  cx: number; cy: number; rx: number; ry: number
  iris: string
  look?: [number, number]
  /** lid: y-cut at left edge, centre, right edge (px from the top of the eyeball); undefined = fully open */
  lid?: [number, number, number]
  mode?: 'open' | 'spiral' | 'squeeze' | 'x' | 'googly'
  oc?: number
  /** colour of the squeezed lid when mode='squeeze' */
  lidCol?: string
}
/** one big cartoon eyeball: white, coloured iris, pupil, shiny highlight, optional lid cut */
export function eye(dst: Img, o: EyeOpts) {
  const oc = o.oc ?? OL
  const { cx, cy, rx, ry } = o
  const mode = o.mode ?? 'open'
  if (mode === 'squeeze') {
    // eye squeezed shut: a curled slit with little "ouch" ticks above it (drawn thin, no outline)
    const dark = hex('#1a0b2b')
    const hw = Math.round(rx * 0.85)
    for (let i = -hw; i <= hw; i++) {
      const u = i / hw, yy = Math.round(cy + 1 - (1 - u * u) * 2)
      fillRect(dst, Math.round(cx + i), yy, 1, 2, dark)
    }
    for (const k of [-0.7, 0, 0.7]) fillRect(dst, Math.round(cx + k * rx), Math.round(cy - 6 + Math.abs(k) * 3), 1, 3, dark)
    return
  }
  const ir = ramp(o.iris)
  part(dst, WHITE, oc, (L, F) => {
    fillEllipse(L, cx, cy, rx, ry, F)
    if (mode === 'spiral') {
      const sp = ir.d
      spiral(L, cx, cy, Math.min(rx, ry) - 1.4, 0.4, -1, 2.2, 1, 1, sp, 90)
      clipEllipse(L, cx - 2, cy - 2, 1, 1, ir.h, F)
    } else if (mode === 'googly') {
      const lk = o.look ?? [0, 0]
      const pr = Math.max(2.5, rx * 0.5)
      clipEllipse(L, cx + lk[0], cy + lk[1], pr, pr, hex('#10051c'), F)
      fillRect(L, Math.round(cx + lk[0] - pr * 0.5), Math.round(cy + lk[1] - pr * 0.55), 3, 3, hex('#ffffff'))
      put(L, Math.round(cx + lk[0] + pr * 0.4), Math.round(cy + lk[1] + pr * 0.4), hex('#6d4f9c'))
    } else if (mode === 'x') {
      for (let k = -ry + 2; k <= ry - 2; k++) { put(L, Math.round(cx + k * 0.9), Math.round(cy + k), ir.d); put(L, Math.round(cx + k * 0.9) + 1, Math.round(cy + k), ir.d); put(L, Math.round(cx - k * 0.9), Math.round(cy + k), ir.d); put(L, Math.round(cx - k * 0.9) - 1, Math.round(cy + k), ir.d) }
    } else {
      const lk = o.look ?? [0, 0]
      const ix = cx + lk[0], iy = cy + lk[1]
      const irx = Math.max(2, Math.round(rx * 0.58)), iry = Math.max(2, Math.round(ry * 0.62))
      clipEllipse(L, ix, iy, irx, iry, ir.d, F)
      clipEllipse(L, ix - 0.3, iy - 0.3, irx - 1, iry - 1, ir.m, F)
      clipEllipse(L, ix + 0.8, iy + 1.2, irx * 0.6, iry * 0.55, ir.l, F)
      clipEllipse(L, ix, iy, Math.max(1.4, irx * 0.5), Math.max(1.4, iry * 0.52), hex('#10051c'), F)
      // shiny highlight, top-left
      const hx = Math.round(ix - irx * 0.42), hy = Math.round(iy - iry * 0.5)
      fillRect(L, hx, hy, 2, 2, hex('#ffffff'))
      put(L, Math.round(ix + irx * 0.35), Math.round(iy + iry * 0.4), ir.h)
    }
    if (o.lid) {
      const top = cy - ry
      const [a, b, c2] = o.lid
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        if (get(L, x, y) === 0) continue
        const u = (x + 0.5 - (cx - rx)) / (2 * rx)
        const cut = top + (u < 0.5 ? a + (b - a) * (u * 2) : b + (c2 - b) * ((u - 0.5) * 2))
        if (y + 0.5 < cut) put(L, x, y, 0)
      }
    }
  })
}

export interface MouthOpts {
  cx: number; cy: number; w: number; h: number
  /** how much the ends curl up above the middle */
  smile: number
  teeth: number
  /** tooth depth in px */
  td?: number
  wob?: number
  tongue?: boolean
  fang?: number          // big single tooth hanging from the top, x position (-1..1 of the mouth) -> 0 = none
  fangLen?: number
  bottom?: boolean       // show zig-zag lower teeth
}
/** wide jagged grin with zig-zag teeth */
export function mouth(dst: Img, o: MouthOpts, oc = OL) {
  part(dst, ramp(MOUTH), oc, (L) => {
    const x0 = Math.round(o.cx - o.w / 2), x1 = Math.round(o.cx + o.w / 2)
    const td = o.td ?? Math.min(3, Math.max(1, Math.round(o.h * 0.5)))
    const per = o.w / o.teeth
    for (let x = x0; x < x1; x++) {
      const u = (x + 0.5 - o.cx) / (o.w / 2)
      const wob = (o.wob ?? 0) * Math.sin(u * Math.PI * 2.2)
      const top = Math.round(o.cy - o.smile * u * u + wob)
      const bh = Math.max(1, Math.round(o.h * Math.pow(Math.max(0, 1 - u * u), 0.55)))
      const bot = top + bh
      for (let y = top; y < bot; y++) put(L, x, y, MOUTH)
      if (bh >= 2) {
        const f = (((x - x0) / per) % 1 + 1) % 1
        const tri = f < 0.5 ? f * 2 : 2 - f * 2
        const dTop = Math.min(bh - (o.bottom ? 1 : 0), Math.round(tri * td + 0.35))
        for (let y = top; y < top + dTop; y++) put(L, x, y, y === top + dTop - 1 && dTop > 1 ? TOOTH_S : TOOTH)
        if (o.bottom) {
          const f2 = (f + 0.5) % 1, tri2 = f2 < 0.5 ? f2 * 2 : 2 - f2 * 2
          const dB = Math.min(bh - dTop > 0 ? bh - 1 : 0, Math.round(tri2 * td))
          for (let y = bot - dB; y < bot; y++) put(L, x, y, TOOTH)
        }
      }
    }
    if (o.tongue) {
      const bx = Math.round(o.cx), by = Math.round(o.cy + o.h - 1)
      for (let j = 0; j < 3; j++) for (let i = -4 + j; i <= 4 - j; i++) if (get(L, bx + i, by - j) === MOUTH) put(L, bx + i, by - j, TONGUE)
    }
    if (o.fang) {
      const fx = Math.round(o.cx + o.fang * (o.w / 2)), fl = o.fangLen ?? 4
      const u = (fx + 0.5 - o.cx) / (o.w / 2)
      const top = Math.round(o.cy - o.smile * u * u + (o.wob ?? 0) * Math.sin(u * Math.PI * 2.2))
      for (let j = 0; j < fl; j++) { const hw = Math.max(0, 1 - Math.floor(j / 2)); for (let i = -hw; i <= hw; i++) put(L, fx + i, top + j, j >= fl - 1 ? TOOTH_S : TOOTH) }
    }
  }, true)
}

/** little 3-point claw on the end of a limb at (x,y) pointing in direction (dx,dy) */
export function claws(dst: Img, x: number, y: number, dx: number, dy: number, col = '#f4ead0', n = 3, len = 3) {
  part(dst, ramp(col), OL, (L, F) => {
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * 2
      // perpendicular spread
      const px = -dy * off, py = dx * off
      for (let s = 0; s < len; s++) put(L, Math.round(x + px + dx * s * 1.0 + (dx !== 0 ? 0 : 0)), Math.round(y + py + dy * s), F)
    }
  }, true)
}
