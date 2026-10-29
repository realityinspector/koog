// Effects & pickups: golden notes, dissonance orbs, the BFG orb, gun smoke.
import type { Img } from './types'
import { fillEllipse, fillPoly, fillRect, hex, line, newImg, outline, put, rng } from './px'
import { curve, OL, part, ramp } from './sp-kit'

/** a tilted ellipse (note head) */
function tiltEllipse(L: Img, cx: number, cy: number, rx: number, ry: number, ang: number, c: number) {
  const ca = Math.cos(ang), sa = Math.sin(ang)
  for (let j = Math.floor(cy - rx - 1); j <= Math.ceil(cy + rx + 1); j++)
    for (let i = Math.floor(cx - rx - 1); i <= Math.ceil(cx + rx + 1); i++) {
      const dx = i + 0.5 - cx, dy = j + 0.5 - cy
      const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry
      if (u * u + v * v <= 1) put(L, i, j, c)
    }
}

export function buildNotes(): [Img, Img] {
  const gold = ramp('#f2b81f')
  const a = newImg(16, 16), b = newImg(16, 16)
  // frame 0: a single quaver (eighth note)
  part(a, gold, OL, (L, F) => {
    tiltEllipse(L, 5.5, 11.5, 4, 3, -0.45, F)
    fillRect(L, 8, 2, 2, 10, F)
    curve(L, [[9, 2], [13, 4], [12, 9]], 2.4, 1.6, F, 20)
  })
  put(a, 4, 10, gold.h); put(a, 5, 9, gold.h)
  // frame 1: a beamed pair
  part(b, gold, OL, (L, F) => {
    tiltEllipse(L, 4.5, 12, 3.4, 2.7, -0.45, F)
    tiltEllipse(L, 11.5, 10.5, 3.4, 2.7, -0.45, F)
    fillRect(L, 6, 4, 2, 8, F); fillRect(L, 13, 2, 2, 8, F)
    fillPoly(L, [[6, 3], [15, 1], [15, 4], [6, 6]], F)
  })
  put(b, 3, 11, gold.h); put(b, 10, 9, gold.h)
  return [a, b]
}

export function buildOrbs(): [Img, Img] {
  const out: Img[] = []
  for (let f = 0; f < 2; f++) {
    const img = newImg(24, 24)
    const r = rng(41 + f * 17)
    const dark = hex('#4a0f78'), edge = hex('#ff9cf2'), mid = hex('#d03ee0'), core = hex('#8a1fb8'), deep = hex('#5a1288'), hot = hex('#fff6b0')
    // jittery silhouette: radius wobbles around the circle, plus a few little spikes
    const rad: number[] = []
    const N = 40
    for (let k = 0; k < N; k++) rad.push(Math.min(9.3, 8.6 + (r() - 0.5) * 1.4 + (k % 8 === f * 3 ? 1.8 : 0)))
    const R = (a: number) => {
      const t = ((a / (Math.PI * 2)) % 1 + 1) % 1 * N, i = Math.floor(t)
      return rad[i % N]
    }
    const body = newImg(24, 24)
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const dx = x + 0.5 - 12, dy = y + 0.5 - 12
      const d = Math.hypot(dx, dy)
      const a = Math.atan2(dy, dx)
      const rr = R(a)
      if (d <= rr) {
        // light rim, magenta band, deep purple core (shaded darker towards the bottom-right)
        let c = edge
        if (d < rr - 1.6) c = mid
        if (d < rr - 3.4) c = core
        if (d < rr - 6) c = deep
        if (dx + dy > 4 && d > rr - 1.6) c = mid
        put(body, x, y, c)
      }
    }
    for (let i = 0; i < body.px.length; i++) img.px[i] = body.px[i]
    // crackle: jagged zig-zag line across the ball
    const ang = f === 0 ? -0.5 : 0.7
    const ca = Math.cos(ang), sa = Math.sin(ang)
    const pts: number[][] = []
    void dark
    const zig = f === 0 ? [-3, 2.5, -2, 3, -2.5, 2, -1] : [2.5, -3, 2, -2.5, 3, -2, 1.5]
    for (let k = 0; k < zig.length; k++) {
      const u = -10 + (k * 20) / (zig.length - 1)
      pts.push([12 + u * ca - zig[k] * sa, 12 + u * sa + zig[k] * ca])
    }
    for (let k = 0; k + 1 < pts.length; k++) line(img, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], dark, 2)
    for (let k = 0; k + 1 < pts.length; k++) line(img, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], hot, 1)
    // keep the crackle inside the ball, then add the outline
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (body.px[y * 24 + x] === 0) img.px[y * 24 + x] = 0
    const src = img.px.slice()
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= 24 || y >= 24 ? 0 : src[y * 24 + x])
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++)
      if (src[y * 24 + x] === 0 && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) img.px[y * 24 + x] = hex('#240838')
    out.push(img)
  }
  return [out[0], out[1]]
}

export function buildBfg(): [Img, Img] {
  const out: Img[] = []
  const bands = ['#6a4a10', '#a8741a', '#d9a02a', '#f6c840', '#ffe68a', '#fff7c4', '#e6fdff', '#c9f6ff', '#ffffff']
  const cols = bands.map((b) => hex(b))
  for (let f = 0; f < 2; f++) {
    const img = newImg(64, 64)
    const radii = [31, 28.6, 26, 22.6, 19, 15.4, 11.8, 8.2, 4.4].map((v) => v - f * 0.8)
    // hard-edged rings with a 1-px dither between bands, like pixel-art glow
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 32)
      let bi = -1
      for (let k = 0; k < radii.length; k++) if (d <= radii[k]) bi = k
      if (bi < 0) continue
      let c = cols[bi]
      if (bi > 0 && d > radii[bi] - 1 && ((x + y) & 1) === 0) c = cols[bi - 1]
      put(img, x, y, c)
    }
    // thin cyan accents rings
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 32)
      if (Math.abs(d - (17 - f * 0.8)) < 0.5) put(img, x, y, hex('#9fe8ff'))
    }
    // starburst: 8 spikes, alternating long and short, rotated between frames
    const rot = 0.2 + f * (Math.PI / 8)
    for (let k = 0; k < 8; k++) {
      const a = rot + (k * Math.PI) / 4, len = k % 2 === 0 ? 31.4 : 25
      const nx = -Math.sin(a), ny = Math.cos(a), cx = Math.cos(a), cy = Math.sin(a)
      const base = 9, hw = k % 2 === 0 ? 4.6 : 3.6
      fillPoly(img, [
        [32 + cx * base + nx * hw, 32 + cy * base + ny * hw],
        [32 + cx * len, 32 + cy * len],
        [32 + cx * base - nx * hw, 32 + cy * base - ny * hw],
      ], cols[k % 2 === 0 ? 6 : 5])
      line(img, 32 + cx * base, 32 + cy * base, 32 + cx * (len - 3), 32 + cy * (len - 3), cols[8], 1)
    }
    // re-stamp the white core so spikes don't cover it
    fillEllipse(img, 32, 32, radii[8], radii[8], cols[8])
    fillEllipse(img, 32 - 0.5, 32 - 0.5, 2, 2, hex('#ffffff'))
    out.push(img)
  }
  return [out[0], out[1]]
}

export function buildSmoke(): [Img, Img, Img] {
  const grey = ramp('#d9d9e8')
  const OLS = hex('#35354a')
  // a cartoon cloud: flat-ish bottom, three bumps on top. units of half-size.
  const make = (size: number): Img => {
    const img = newImg(24, 24)
    const s = size / 2
    const cx = 12, cy = 12 + s * 0.06
    const bumps: number[][] = [[-0.6, 0.1, 0.36], [-0.2, -0.34, 0.44], [0.32, -0.3, 0.42], [0.64, 0.1, 0.34]]
    part(img, grey, OLS, (L, F) => {
      fillEllipse(L, cx, cy + s * 0.26, s * 0.8, s * 0.36, F)
      for (const [bx, by, br] of bumps) fillEllipse(L, cx + bx * s, cy + by * s, br * s, br * s, F)
    })
    if (size >= 12) {
      // little highlights on the bumps and a shadowy swirl underneath
      for (const [bx, by, br] of bumps) {
        const hx = Math.round(cx + (bx - 0.4 * br) * s), hy = Math.round(cy + (by - 0.45 * br) * s)
        put(img, hx, hy, grey.h); put(img, hx + 1, hy, grey.h); put(img, hx, hy + 1, grey.h)
      }
    }
    return img
  }
  return [make(9), make(14), make(19)]
}
