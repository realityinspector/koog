// Decor props, drawn as billboards standing on the bottom edge: column, candelabra, composer bust, music stand.
import type { Img } from './types'
import { fillEllipse, fillPoly, fillRect, hex, line, newImg, put, rng } from './px'
import { curve, OL, part, ramp } from './sp-kit'

const MARBLE = ramp('#ebe6f4'), GOLD = ramp('#efb42a'), WOOD = ramp('#a8693a')

export function buildColumn(): Img {
  const img = newImg(32, 64)
  const r = rng(9)
  // fluted marble shaft (cylinder shading by column)
  const x0 = 7, w = 18
  part(img, MARBLE, OL, (L, F) => { fillRect(L, x0, 9, w, 47, F) }, true)
  const tones = [MARBLE.m, MARBLE.l, MARBLE.l, MARBLE.m, MARBLE.m, MARBLE.m, MARBLE.s, MARBLE.s, MARBLE.s]
  for (let y = 10; y < 55; y++) for (let i = 0; i < w; i++) {
    const u = i / (w - 1)
    let c = u < 0.1 ? MARBLE.m : u < 0.3 ? MARBLE.l : u < 0.62 ? MARBLE.m : u < 0.84 ? MARBLE.s : hex('#8d84b4')
    if (i % 4 === 2) c = u < 0.5 ? MARBLE.s : hex('#8d84b4')       // flute grooves
    put(img, x0 + i, y, c)
  }
  void tones
  // marble veins
  for (let k = 0; k < 5; k++) {
    let x = x0 + 2 + Math.floor(r() * 12), y = 12 + Math.floor(r() * 36)
    for (let s = 0; s < 6; s++) { put(img, x, y, hex('#b9b0d8')); x += r() < 0.5 ? 1 : 0; y += 1 }
  }
  // gold capital: slab, curled volutes, echinus
  part(img, GOLD, OL, (L, F) => {
    fillRect(L, 3, 2, 26, 3, F)
    fillRect(L, 4, 5, 24, 2, F)
    fillPoly(L, [[7, 7], [25, 7], [23, 11], [9, 11]], F)
    fillEllipse(L, 6.5, 8, 3.5, 3.5, F); fillEllipse(L, 25.5, 8, 3.5, 3.5, F)
  })
  for (let dx = 5; dx < 28; dx += 3) fillRect(img, dx, 5, 1, 1, GOLD.d)
  for (const sx of [6, 25]) { put(img, sx, 8, GOLD.d); put(img, sx + 1, 8, GOLD.d); put(img, sx + 1, 9, GOLD.d) }
  // gold base: torus rings + plinth
  part(img, GOLD, OL, (L, F) => {
    fillRect(L, 6, 54, 20, 2, F)
    fillEllipse(L, 16, 58, 11, 2.6, F)
    fillRect(L, 3, 60, 26, 4, F)
  })
  fillRect(img, 3, 62, 26, 1, GOLD.s)
  return img
}

export function buildCandles(): Img {
  const img = newImg(24, 48)
  // stand: foot, stem with knobs, three arms
  part(img, GOLD, OL, (L, F) => {
    fillEllipse(L, 12, 44.5, 7.5, 2.8, F)
    fillRect(L, 10, 41, 5, 3, F)
    fillRect(L, 11, 22, 3, 20, F)
    fillEllipse(L, 12.5, 37, 3.4, 2.2, F)
    fillEllipse(L, 12.5, 30, 3, 2, F)
    curve(L, [[12, 27], [6, 28], [5.5, 22]], 2.4, 2.4, F, 24)
    curve(L, [[13, 27], [19, 28], [19.5, 22]], 2.4, 2.4, F, 24)
  })
  const cups: [number, number][] = [[5, 22], [12, 19], [19, 22]]
  for (const [cx, cy] of cups) {
    part(img, GOLD, OL, (L, F) => { fillPoly(L, [[cx - 3, cy - 1], [cx + 4, cy - 1], [cx + 3, cy + 2], [cx - 2, cy + 2]], F) })
  }
  // candles + flames
  const wax = ramp('#f7efd8')
  cups.forEach(([cx, cy], i) => {
    const top = cy - 9 + (i === 1 ? 0 : 1)
    part(img, wax, OL, (L, F) => { fillRect(L, cx - 1, top, 3, cy - top - 1, F) })
    // wick
    put(img, cx, top - 1, hex('#3a2a2a'))
    // teardrop flame (orange outside, yellow inside, white tip)
    const fy = top - 2
    part(img, ramp('#ff8a1c'), hex('#b5301a'), (L, F) => {
      fillEllipse(L, cx + 0.5, fy - 1.4, 2.3, 2.6, F)
      fillPoly(L, [[cx - 1.6, fy - 1], [cx + 2.6, fy - 1], [cx + 0.5, fy - 6.2]], F)
    }, true)
    fillEllipse(img, cx + 0.5, fy - 1.1, 1.1, 1.6, hex('#ffe45e'))
    put(img, cx, fy - 1, hex('#fff9d0'))
  })
  return img
}

export function buildBust(): Img {
  const img = newImg(32, 56)
  const M = ramp('#f0ebe0'), WIG = ramp('#d9d4ea'), STONE = ramp('#cfc8de')
  // pedestal
  part(img, STONE, OL, (L, F) => {
    fillRect(L, 4, 52, 24, 3, F)
    fillRect(L, 8, 42, 16, 10, F)
    fillRect(L, 4, 39, 24, 3, F)
  })
  fillRect(img, 9, 44, 1, 7, STONE.l)
  fillRect(img, 22, 44, 1, 7, STONE.s)
  // shoulders + coat
  part(img, M, OL, (L, F) => {
    fillEllipse(L, 16, 36, 14, 7.5, F)
    fillRect(L, 2, 36, 28, 3, F)
  })
  // coat lapels + buttons carved in
  line(img, 16, 31, 10, 38, M.s, 1); line(img, 16, 31, 22, 38, M.s, 1)
  put(img, 16, 36, M.d); put(img, 16, 38, M.d)
  // ruffled cravat
  part(img, ramp('#fbf8f0'), OL, (L, F) => {
    fillPoly(L, [[16, 28], [11, 31], [12, 35], [16, 33], [20, 35], [21, 31]], F)
  })
  // wig behind face: big puffy top, rolled sausage curls on the sides
  part(img, WIG, OL, (L, F) => {
    fillEllipse(L, 16, 13, 12, 10, F)
    for (const [cx, cy] of [[5.5, 17], [5, 22.5], [26.5, 17], [27, 22.5]]) fillEllipse(L, cx, cy, 3.9, 3, F)
    fillEllipse(L, 6.5, 27, 3.2, 2.6, F); fillEllipse(L, 25.5, 27, 3.2, 2.6, F)
  })
  // curl swirls
  for (const [cx, cy] of [[5, 17], [5, 22], [27, 17], [27, 22]]) { put(img, cx, cy, WIG.d); put(img, cx + 1, cy, WIG.d); put(img, cx + 1, cy + 1, WIG.s) }
  // curly lines on top puff
  for (let k = 0; k < 4; k++) { put(img, 9 + k * 4, 6 + (k % 2), WIG.s); put(img, 10 + k * 4, 6 + (k % 2), WIG.s) }
  // face
  part(img, M, OL, (L, F) => { fillEllipse(L, 16, 19, 7.2, 8.6, F) })
  // brows, eyes, big nose, tiny singing mouth, rosy cheeks
  fillRect(img, 11, 15, 4, 1, hex('#8a7fa8')); fillRect(img, 17, 14, 4, 1, hex('#8a7fa8'))
  fillRect(img, 12, 17, 2, 2, hex('#3a2f55')); fillRect(img, 18, 17, 2, 2, hex('#3a2f55'))
  fillRect(img, 15, 19, 3, 3, M.l); fillRect(img, 16, 22, 3, 1, M.s); put(img, 18, 21, M.s)
  fillRect(img, 14, 25, 4, 2, hex('#7a3b50')); fillRect(img, 15, 25, 2, 1, hex('#f0a0b0'))
  put(img, 10, 22, hex('#f2b9c6')); put(img, 11, 22, hex('#f2b9c6')); put(img, 21, 22, hex('#f2b9c6')); put(img, 22, 22, hex('#f2b9c6'))
  // tied ribbon at the back, peeking out
  part(img, ramp('#3a3a6a'), OL, (L, F) => { fillPoly(L, [[16, 28], [13, 30], [15, 31]], F); fillPoly(L, [[17, 28], [20, 30], [18, 31]], F) }, true)
  return img
}

export function buildStand(): Img {
  const img = newImg(28, 40)
  // legs and stem (behind desk)
  part(img, WOOD, OL, (L, F) => {
    fillRect(L, 13, 17, 3, 15, F)
    line(L, 14, 31, 4, 39, F, 2); line(L, 14, 31, 24, 39, F, 2); line(L, 14, 31, 14, 39, F, 2)
    fillEllipse(L, 14.5, 32, 3, 2, F)
  })
  // desk board (slightly tilted: a lip at the bottom)
  part(img, WOOD, OL, (L, F) => {
    fillRect(L, 2, 2, 24, 16, F)
    fillRect(L, 2, 16, 24, 3, F)
  })
  // sheet of music
  const paper = hex('#fbf6e6'), paperS = hex('#d9cfae'), ink = hex('#2a1a3a'), staff = hex('#8f84a8')
  fillRect(img, 4, 3, 20, 13, paper)
  fillRect(img, 4, 15, 20, 1, paperS); fillRect(img, 23, 3, 1, 13, paperS)
  for (const y of [5, 7, 9, 11]) fillRect(img, 5, y, 18, 1, staff)
  // notes: head dots on the lines with stems
  const notes: [number, number, boolean][] = [[7, 10, true], [11, 8, true], [15, 11, true], [19, 7, true]]
  for (const [nx, ny, up] of notes) { fillRect(img, nx, ny, 2, 2, ink); if (up) fillRect(img, nx + 2, ny - 4, 1, 5, ink) }
  fillRect(img, 11, 3, 1, 1, ink)
  // paper curl at corner + page clip
  fillRect(img, 20, 13, 3, 2, paperS)
  fillRect(img, 2, 17, 3, 1, GOLD.m); fillRect(img, 23, 17, 3, 1, GOLD.m)
  return img
}

/** wall sconce with a flame (2 frames, 16 x 32). The flame is pale so the level's torch colour can tint it. */
export function buildTorch(): [Img, Img] {
  const mk = (f: number): Img => {
    const img = newImg(16, 32)
    // bracket + cup
    part(img, GOLD, OL, (L, F) => {
      fillRect(L, 7, 18, 3, 12, F)
      fillPoly(L, [[3, 14], [13, 14], [11, 19], [5, 19]], F)
      fillEllipse(L, 8, 29, 4.5, 2, F)
    })
    // flame: outer, middle, hot core; the tip leans a pixel with the frame
    const lean = f ? 1 : 0
    const outer = hex('#ffc060'), mid = hex('#ffe9a0'), core = hex('#ffffe8')
    fillPoly(img, [[8, 14], [4, 12], [4, 8], [6, 4 + f], [7 + lean, 1], [9 + lean, 5], [11, 8], [12, 12]], outer)
    fillPoly(img, [[8, 14], [6, 12], [6, 9], [8, 5 + f], [9, 9], [10, 12]], mid)
    fillRect(img, 7, 10, 2, 3, core)
    return img
  }
  return [mk(0), mk(1)]
}

/** hanging cloth banner with a gold note on it (24 x 56). Mid-grey cloth so the level colour can tint it. */
export function buildBanner(): Img {
  const img = newImg(24, 56)
  const CLOTH = ramp('#c8a0e8')
  part(img, GOLD, OL, (L, F) => { fillRect(L, 1, 1, 22, 3, F); fillEllipse(L, 2, 2.5, 2, 2, F); fillEllipse(L, 22, 2.5, 2, 2, F) })
  part(img, CLOTH, OL, (L, F) => { fillPoly(L, [[3, 4], [21, 4], [21, 48], [12, 54], [3, 48]], F) })
  // gold trim and tassels
  for (let y = 7; y < 46; y++) { put(img, 5, y, GOLD.m); put(img, 18, y, GOLD.m) }
  for (const x of [5, 9, 13, 17]) fillRect(img, x, 50 - Math.abs(x - 11) / 2, 2, 2, GOLD.l)
  // a big eighth note
  const g = GOLD.l, d = GOLD.d
  fillEllipse(img, 9, 34, 4, 3, d); fillEllipse(img, 9, 34, 3, 2, g)
  fillRect(img, 12, 14, 2, 21, g); fillRect(img, 13, 14, 1, 21, GOLD.m)
  fillPoly(img, [[14, 14], [19, 20], [19, 25], [14, 19]], g)
  return img
}
