// Wall textures for BachDoom: 64 x 64, opaque, seamless. Pure + deterministic.
import { hex, mix, shade, rng } from './px'
import type { Img } from './types'
import { TEX } from './types'
import { hash, noise, paint, ramp, wget, wline, wput, wrect } from './tex-kit'

const H = (list: string[]) => list.map((s) => hex(s))

/** warm grey-brown stone bricks, staggered, with cracks and moss */
export function brick(): Img {
  const pal = H(['#907a6b', '#85705f', '#9a8572', '#7b6753', '#a18c78', '#87725e'])
  const mortar = hex('#4a3f38')
  const blot = noise(21, 8, 8)
  const img = paint((x, y) => {
    const row = y >> 3
    const xx = (x - (row & 1) * 8 + 64) & 63
    const col = xx >> 4, lx = xx & 15, ly = y & 7
    if (ly === 0 || lx === 0) return mortar
    let c = pal[Math.floor(hash(col, row, 5) * pal.length)]
    const n = blot(x, y)
    if (n > 0.6) c = shade(c, 1.09)
    else if (n < 0.38) c = shade(c, 0.9)
    if (ly === 1) c = shade(c, 1.22)
    else if (ly === 7) c = shade(c, 0.76)
    if (lx === 1) c = shade(c, 1.1)
    else if (lx === 15) c = shade(c, 0.84)
    return c
  })
  const crack = hex('#3a2e27'), crackLo = hex('#5a4a3e')
  const cracks = [
    [[21, 9], [22, 11], [22, 13], [23, 15], [23, 17], [24, 19]],
    [[49, 38], [48, 40], [49, 42], [48, 44], [47, 46]],
    [[6, 50], [8, 51], [9, 53], [11, 54]],
  ]
  for (const pts of cracks) {
    for (let i = 0; i + 1 < pts.length; i++) {
      wline(img, pts[i][0] + 1, pts[i][1], pts[i + 1][0] + 1, pts[i + 1][1], crackLo)
      wline(img, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], crack)
    }
  }
  const greens = H(['#3c5a2e', '#587c3a', '#7ea04c'])
  const moss = [[8, 31, 6], [41, 15, 5], [54, 55, 6], [26, 47, 4], [60, 24, 3]]
  const r = rng(9)
  for (const [cx, cy, rx] of moss) {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -rx; dx <= rx; dx++) {
        const d = (dx * dx) / (rx * rx) + (dy * dy) / 5
        if (d < 1 && r() > d * 0.7) {
          const g = greens[dy < 0 ? 2 : dy > 0 ? 0 : 1]
          wput(img, cx + dx, cy + dy, r() > 0.5 ? g : greens[1])
        }
      }
  }
  return img
}

/** golden organ-pipe facade: 4 cylinder pipes with mouths, rings and dark wood between */
export function pipes(): Img {
  const wood = H(['#1d1008', '#2b190c', '#38220f'])
  const gold = H(['#3f2a09', '#74500f', '#a97618', '#d2a028', '#efc745', '#fff1a6'])
  const prof = [0, 1, 2, 3, 4, 5, 5, 4, 3, 3, 2, 2, 1, 0]
  const mouthY = [41, 35, 29, 35]
  const img = paint((x, y) => {
    const lx = x & 15
    if (lx === 0) return wood[1]
    if (lx === 15) return wood[hash(x >> 4, y >> 2, 3) > 0.5 ? 0 : 2]
    return gold[prof[lx - 1]]
  })
  const set = (x: number, y: number, c: number) => wput(img, x, y, c)
  for (let i = 0; i < 4; i++) {
    const x0 = i * 16 + 1
    const rows = (y: number, f: (u: number) => number) => { for (let u = 0; u < 14; u++) set(x0 + u, y, gold[f(u)]) }
    // rings: bright top, dark bottom
    for (const by of [4, 17, 52]) {
      rows(by, (u) => Math.min(5, prof[u] + 1))
      rows(by + 1, (u) => Math.max(0, prof[u] - 1))
      rows(by + 2, () => 0)
    }
    // mouth
    const my = mouthY[i]
    rows(my - 2, (u) => Math.min(5, prof[u] + 1))
    rows(my - 1, () => 0)
    const mdark = H(['#0e0703', '#1d0f06', '#2e1a0a', '#3f2610'])
    for (let k = 0; k < 6; k++) for (let u = 2; u <= 11; u++) set(x0 + u, my + k, mdark[k < 1 ? 0 : k < 2 ? 1 : k < 4 ? 2 : 3])
    for (let k = -1; k < 7; k++) { set(x0 + 1, my + k, gold[0]); set(x0 + 12, my + k, gold[0]) }
    for (let u = 2; u <= 11; u++) { set(x0 + u, my + 6, gold[Math.min(5, prof[u] + 1)]); set(x0 + u, my + 7, gold[prof[u] > 3 ? 3 : 2]); set(x0 + u, my + 8, gold[0]) }
    set(x0 + 1, my + 6, gold[1]); set(x0 + 12, my + 6, gold[1])
  }
  return img
}

/** jewel-tone diamond-lattice stained glass with lead lines */
export function glass(): Img {
  const jewels = H(['#d8203e', '#2a54dc', '#19ad5c', '#f4a91c', '#9440d0'])
  const grid = [[0, 1, 2, 3], [2, 4, 0, 1], [4, 3, 1, 0], [1, 0, 3, 4]]
  const lead = hex('#17111f'), leadLo = hex('#2c2340'), node = hex('#0c0812')
  const ramps = jewels.map((c) => [shade(c, 0.48), shade(c, 0.75), c, mix(c, hex('#ffffff'), 0.35), mix(c, hex('#ffffff'), 0.72)])
  return paint((x, y) => {
    const s = (x + y) & 63, d = (x - y + 64) & 63
    const a = s & 15, b = d & 15
    if (a < 2 && b < 2) return node
    if (a < 2 || b < 2) return a === 1 || b === 1 ? leadLo : lead
    const u = s >> 4, v = d >> 4
    const rp = ramps[grid[u][v]]
    // glow: bright heart, deeper toward the lead; light from above
    const dist = Math.max(Math.abs(a - 8.5), Math.abs(b - 8.5)) / 6.5
    const yl = (a - b) / 2 / 6.5
    const t = (1 - dist) * 0.75 + (0.5 - yl * 0.5) * 0.55
    let idx = t > 0.92 ? 3 : t > 0.58 ? 2 : t > 0.28 ? 1 : 0
    if (a >= 4 && a <= 5 && b >= 11 && b <= 12) idx = 4 // glint
    return rp[idx]
  })
}

/** dark wood: frame-and-panel wainscot with grain and bevelled moulding */
export function wood(): Img {
  const tones = H(['#48301a', '#563a20', '#674627', '#7a5532'])
  const gV = noise(41, 28, 3), gV2 = noise(42, 9, 2)
  const gH = noise(43, 3, 20)
  const grainV = (x: number, y: number) => {
    const v = gV(x, y) * 0.65 + gV2(x, y) * 0.35 + (hash(x, 0, 7) - 0.5) * 0.18
    return v
  }
  const grainH = (x: number, y: number) => gH(x, y) * 0.8 + hash(0, y, 8) * 0.2
  return paint((x, y) => {
    const mx = x & 31
    const inPanel = mx >= 4 && mx < 28 && y >= 6 && y < 58
    if (!inPanel) {
      // stile (vertical grain) or rail (horizontal grain)
      const stile = y >= 6 && y < 58
      const g = stile ? grainV(x, y) : grainH(x, y)
      let c = ramp(tones, g)
      // soft shadow beside the panel groove
      if (stile && (mx === 3 || mx === 28)) c = shade(c, 0.6)
      if (!stile && (y === 5 || y === 58)) c = shade(c, 0.6)
      if (stile && (mx === 0 || mx === 31)) c = shade(c, 1.12)
      return c
    }
    const dl = mx - 4, dr = 27 - mx, dt = y - 6, db = 57 - y
    const e = Math.min(dl, dr, dt, db)
    if (e === 0) return hex('#1a0e07') // groove
    if (e <= 3) {
      const c = ramp(tones, grainH(x, y))
      if (dt === e && dt <= dl && dt <= dr) return shade(c, 1.45) // top facet lit
      if (dl === e && dl <= db) return shade(c, 1.18) // left facet
      if (db === e) return shade(c, 0.6) // bottom facet in shadow
      return shade(c, 0.74)
    }
    // raised field: lighter, vertical grain; thin inner lip
    let c = ramp(tones, grainV(x, y) * 0.9 + 0.12)
    if (e === 4) c = (dt === 4 || dl === 4) ? shade(c, 0.7) : shade(c, 1.12)
    return c
  })
}

/** deep red velvet curtain: vertical folds, gold trim on top, gold fringe at the bottom */
export function velvet(): Img {
  const reds = H(['#2c0610', '#470a17', '#650f22', '#86152f', '#a91f3b', '#c93450', '#e1566e'])
  const nz = noise(51, 6, 2)
  const gold = H(['#5b3a0c', '#f2cb4c', '#cf9a22', '#8d5f14'])
  const TAU = Math.PI * 2
  return paint((x, y) => {
    const xs = x + 2.4 * Math.sin((y / 64) * TAU) + 1.2 * Math.sin((y / 64) * TAU * 2 + 1)
    const p = (xs / 16) * TAU
    let i = 0.5 + 0.36 * Math.cos(p) + 0.12 * Math.cos(2 * p + 1) + (nz(x, y) - 0.5) * 0.16
    i = Math.max(0, Math.min(0.999, i))
    let c = ramp(reds, i)
    // top gold piping + shadow under it
    if (y === 0) return gold[0]
    if (y === 1) return gold[1]
    if (y === 2) return gold[2]
    if (y === 3) return gold[3]
    if (y === 4) return shade(c, 0.6)
    if (y === 5) return shade(c, 0.82)
    // bottom band + fringe
    if (y === 50) return shade(c, 0.8)
    if (y === 51) return gold[3]
    if (y === 52) return gold[1]
    if (y === 53) return gold[2]
    if (y === 54) return gold[3]
    if (y >= 55) {
      const k = x & 3
      const bead = y >= 61
      if (k === 1 || (bead && k === 2)) return k === 1 ? gold[1] : gold[2]
      if (k === 2 || (bead && k === 0)) return bead ? gold[3] : gold[2]
      return shade(c, 0.62)
    }
    return c
  })
}

/** cream marble with soft grey veins, faint slab joints and a thin gold inlay band */
export function marble(): Img {
  const cream = H(['#f4eddc', '#ece3cd', '#e3d8bf'])
  const n1 = noise(31, 3, 3), n2 = noise(32, 6, 6)
  const img = paint((x, y) => {
    const v = n1(x, y) * 0.62 + n2(x, y) * 0.38
    let c = ramp(cream, 1 - v)
    if (x === 0 || y === 0) c = hex('#cfc1a3')
    else if (x === 1 || y === 1) c = hex('#faf5e8')
    return c
  })
  const core = hex('#a4a2b0'), halo = hex('#cac5cc')
  const pts: number[][][] = []
  // long, gently swaying veins (smooth sinusoidal drift, so no scribbles); they wrap around the tile
  const vein = (x: number, y: number, base: number, len: number, w: number, ph: number, amp: number) => {
    const seg: number[][] = []
    for (let s = 0; s < len; s++) {
      const ang = base + amp * Math.sin(s * 0.045 + ph) + amp * 0.45 * Math.sin(s * 0.11 + ph * 2.3)
      x += Math.cos(ang); y += Math.sin(ang)
      seg.push([x, y, ang, w + (Math.sin(s * 0.09 + ph) > 0.6 ? 1 : 0)])
    }
    pts.push(seg)
    return seg
  }
  const m1 = vein(4, -6, 1.15, 120, 1, 0.5, 0.35)
  vein(m1[34][0], m1[34][1], 0.55, 38, 0, 1, 0.25)
  vein(m1[78][0], m1[78][1], 1.7, 34, 0, 2, 0.25)
  const m2 = vein(36, -10, 1.0, 110, 1, 2.1, 0.3)
  vein(m2[50][0], m2[50][1], 0.45, 30, 0, 3, 0.2)
  vein(52, 24, 1.3, 50, 0, 4, 0.3)
  for (const seg of pts) for (const [x, y, ang] of seg) {
    const nx = -Math.sin(ang), ny = Math.cos(ang)
    for (let o = -3; o <= 3; o++) {
      const px = Math.round(x + nx * o), py = Math.round(y + ny * o)
      const base = wget(img, px, py)
      const k = Math.abs(o) <= 1 ? 0.3 : 0.1
      wput(img, px, py, mix(base, hex('#8e8c9c'), k))
    }
  }
  for (const seg of pts) for (const [x, y, ang, w] of seg) {
    const px = Math.round(x), py = Math.round(y)
    if (w > 0) { wput(img, px, py, core); wput(img, px + 1, py, halo) } else wput(img, px, py, halo)
  }
  // gold inlay band
  const dark = hex('#3e2c16'), g = H(['#f4d466', '#d6a634', '#a67c1c'])
  wrect(img, 0, 53, TEX, 1, dark)
  wrect(img, 0, 54, TEX, 1, g[0])
  wrect(img, 0, 55, TEX, 1, g[1])
  wrect(img, 0, 56, TEX, 1, g[2])
  wrect(img, 0, 57, TEX, 1, dark)
  // little dark studs on the band
  for (let sx = 8; sx < TEX; sx += 16) {
    wrect(img, sx - 1, 55, 3, 1, dark)
    wput(img, sx, 54, dark)
    wput(img, sx, 56, dark)
  }
  return img
}
