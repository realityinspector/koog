// Floor and ceiling textures for BachDoom: 64 x 64, opaque, seamless. Pure + deterministic.
import { hex, shade, rng } from './px'
import type { Img } from './types'
import { hash, noise, paint, ramp } from './tex-kit'

const H = (list: string[]) => list.map((s) => hex(s))
const wd = (a: number, b: number) => { const d = (((a - b) % 64) + 64) % 64; return d > 32 ? 64 - d : d }

/** irregular grey-blue flagstones, dark grout */
export function flag(): Img {
  const r = rng(61)
  const pts: number[][] = []
  const C = 64 / 3
  for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 3; cx++) pts.push([(cx + 0.5 + (cy & 1 ? 0.5 : 0) + (r() - 0.5) * 0.35) * C, (cy + 0.5 + (r() - 0.5) * 0.3) * C])
  const pal = H(['#6f7c9e', '#62708f', '#7a87a6', '#69789b', '#7482a0'])
  const grout = hex('#2e3449')
  const mottle = noise(62, 4, 4)
  return paint((x, y) => {
    let d1 = 1e9, d2 = 1e9, bi = 0
    for (let i = 0; i < pts.length; i++) {
      const dx = wd(x + 0.5, pts[i][0]), dy = wd(y + 0.5, pts[i][1])
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < d1) { d2 = d1; d1 = d; bi = i } else if (d < d2) d2 = d
    }
    const gap = d2 - d1
    if (gap < 2.3) return grout
    let c = pal[Math.floor(hash(bi, 3, 9) * pal.length)]
    const m = mottle(x, y)
    if (m > 0.62) c = shade(c, 1.06)
    else if (m < 0.36) c = shade(c, 0.94)
    if (gap < 4) {
      // bevel: lit on the upper-left sides, shaded on lower-right
      const up = (y + 0.5 - pts[bi][1]) + (x + 0.5 - pts[bi][0]) * 0.6
      c = up < 0 ? shade(c, 1.14) : shade(c, 0.82)
    }
    return c
  })
}

/** dark / cream marble checkerboard, 4 x 4 squares of 16 px */
export function checker(): Img {
  const dark = H(['#38344f', '#413d5c'])
  const cream = H(['#f1e8cf', '#e6dbbd'])
  const nz = noise(71, 4, 4), nz2 = noise(72, 8, 8)
  return paint((x, y) => {
    const sq = ((x >> 4) + (y >> 4)) & 1
    const lx = x & 15, ly = y & 15
    const v = nz(x, y) * 0.6 + nz2(x, y) * 0.4
    let c = sq ? dark[v > 0.5 ? 1 : 0] : cream[v > 0.5 ? 0 : 1]
    if (lx === 0 || ly === 0) c = shade(c, 1.15)
    else if (lx === 15 || ly === 15) c = shade(c, 0.78)
    return c
  })
}

/** red carpet with a gold diamond medallion and corner diamonds */
export function carpet(): Img {
  const red = H(['#8c1a2c', '#982034'])
  const deep = hex('#6e1222')
  const g = H(['#f0c850', '#cf9b2a', '#9a6c18'])
  const nz = noise(81, 4, 4)
  return paint((x, y) => {
    const d1 = wd(x + 0.5, 32) + wd(y + 0.5, 32)
    const d2 = wd(x + 0.5, 0) + wd(y + 0.5, 0)
    // medallion
    if (d1 >= 25 && d1 <= 26) return g[d1 === 25 ? 0 : 1]
    if (d1 === 27) return g[2]
    if (d1 >= 19 && d1 <= 20) return g[1]
    if (d1 < 19) {
      if (d1 <= 4) return d1 <= 2 ? g[0] : g[1]
      if (d1 >= 9 && d1 <= 10) return g[1]
      return d1 < 9 ? deep : red[1]
    }
    // corner diamonds
    if (d2 >= 9 && d2 <= 10) return g[d2 === 9 ? 0 : 1]
    if (d2 === 11) return g[2]
    if (d2 <= 3) return g[0]
    if (d2 < 9) return deep
    // small gold studs between diamonds
    if ((wd(x + 0.5, 32) <= 1 && wd(y + 0.5, 0) <= 1) || (wd(x + 0.5, 0) <= 1 && wd(y + 0.5, 32) <= 1)) return g[0]
    return nz(x, y) > 0.5 ? red[0] : red[1]
  })
}

/** warm wooden floorboards with staggered butt joints */
export function planks(): Img {
  const pal = H(['#b27c43', '#bf8948', '#a67140', '#c5924f', '#b88444'])
  const seam = hex('#5c3b1d')
  const gr = noise(91, 2, 40)
  return paint((x, y) => {
    const row = y >> 3, ly = y & 7
    const jx = Math.floor(hash(row, 1, 4) * 64)
    const bi = (((x - jx + 64) & 63) >> 5) // two boards per row
    if (ly === 0) return seam
    if (((x - jx + 64) & 31) === 0) return seam
    let c = pal[Math.floor(hash(row, bi, 6) * pal.length)]
    const g = gr(x, y)
    if (g > 0.66) c = shade(c, 1.08)
    else if (g < 0.34) c = shade(c, 0.92)
    if (ly === 1) c = shade(c, 1.12)
    else if (ly === 7) c = shade(c, 0.88)
    return c
  })
}

/** slate-blue groin vault: crossing darker ribs with bosses over stone courses */
export function vault(): Img {
  const stone = H(['#5a668e', '#525e86', '#63709a'])
  const rib = H(['#454e7c', '#394170', '#2e3560', '#232950'])
  const boss = H(['#f1d77a', '#d3a93a', '#8f6a1c'])
  return paint((x, y) => {
    const dd = (x - y + 64) & 63, ss = (x + y) & 63
    const d1 = Math.min(dd, 64 - dd), d2 = Math.min(ss, 64 - ss)
    // bosses where ribs cross: (32,32) and (0,0)
    for (const [bx, by] of [[32, 32], [0, 0]]) {
      const dx = wd(x + 0.5, bx), dy = wd(y + 0.5, by)
      const rr = Math.sqrt(dx * dx + dy * dy)
      if (rr < 6.5) return rr < 2.2 ? boss[0] : rr < 5 ? boss[1] : boss[2]
    }
    const d = Math.min(d1, d2)
    if (d <= 3) return rib[d]
    if (d === 4) return shade(stone[1], 0.7)
    const row = y >> 3
    const xx = (x + (row & 1) * 8) & 63
    let c = stone[Math.floor(hash(xx >> 4, row, 12) * stone.length)]
    if ((y & 7) === 0 || (xx & 15) === 0) c = shade(c, 0.86)
    return c
  })
}

/** cream plaster ceiling with a lattice of dark wood beams */
export function beams(): Img {
  const plaster = H(['#efe6ce', '#eadfc4'])
  const wood = H(['#3d2613', '#4d3019', '#5f3e20'])
  const nzP = noise(101, 3, 3)
  const gH = noise(102, 2, 14), gV = noise(103, 14, 2)
  return paint((x, y) => {
    const bx = x >= 28 && x < 36, by = y >= 28 && y < 36
    if (by) {
      const ly = y - 28
      let c = ramp(wood, gH(x, y))
      if (ly === 0) c = shade(c, 1.5)
      else if (ly === 1) c = shade(c, 1.2)
      else if (ly === 7) c = shade(c, 0.55)
      else if (ly === 6) c = shade(c, 0.78)
      return c
    }
    if (bx) {
      const lx = x - 28
      let c = ramp(wood, gV(x, y))
      if (lx === 0) c = shade(c, 1.45)
      else if (lx === 1) c = shade(c, 1.18)
      else if (lx === 7) c = shade(c, 0.55)
      else if (lx === 6) c = shade(c, 0.78)
      return c
    }
    let c = ramp(plaster, nzP(x, y))
    // soft shadows under / right of the beams
    if (y >= 36 && y < 38) c = shade(c, y === 36 ? 0.8 : 0.9)
    else if (x >= 36 && x < 38) c = shade(c, x === 36 ? 0.82 : 0.91)
    return c
  })
}

/** gold-painted coffered ceiling: bevelled square frames around recessed panels with a rosette */
export function gold(): Img {
  const hi = hex('#f6da7c'), left = hex('#e5be52'), right = hex('#b98a28'), low = hex('#9a6d1a'), gap = hex('#5e400c')
  const fl = H(['#d9ab3c', '#cfa133'])
  const dk = hex('#8a6014'), lt = hex('#efca58')
  return paint((x, y) => {
    const mx = x & 31, my = y & 31
    const dl = mx, dr = 31 - mx, dt = my, db = 31 - my
    const e = Math.min(dl, dr, dt, db)
    if (e === 0) return gap
    if (e <= 3) {
      if (dt === e && dt <= dl && dt <= dr) return hi
      if (dl === e && dl <= db) return left
      if (db === e) return low
      return right
    }
    if (e === 4) return (dt === 4 || dl === 4) ? dk : lt // recess: shadow on the top / left inner edge
    // recessed field with a rosette
    const cx = Math.abs(mx - 15.5), cy = Math.abs(my - 15.5)
    const dm = cx + cy
    if (dm <= 1.6) return dk
    if (dm < 4.5) return lt
    if (dm < 6) return hi === 0 ? dk : dk
    if (dm < 7.2) return fl[0]
    const ang = Math.max(cx, cy)
    if (ang >= 7 && ang <= 7.5 && dm < 12) return shade(fl[1], 0.9)
    return fl[1]
  })
}
