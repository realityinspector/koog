// BACH's status-bar face: 7 frames, 32 x 32, transparent outside the head. Pure + deterministic.
import { hex, newImg, fillPoly, fillRect, put, outline, mix } from './px'
import type { Face, Img } from './types'

const INK = hex('#2a2140')
const WIG = ['#a3abd2', '#c8cee9', '#e8ebf8', '#ffffff'].map((s) => hex(s)) // dark -> light
const SKIN = ['#da8f6e', '#f0b48b', '#fad3ac', '#fee3c1'].map((s) => hex(s))
const SKIN_PALE = ['#cfa593', '#e4bea9', '#f1d8c6', '#f7e5d8'].map((s) => hex(s))
const SKIN_HOT = ['#e4817a', '#f5a392', '#fcc6ad', '#ffdac4'].map((s) => hex(s))
const COAT = ['#2b2c54', '#3c3d6c', '#51548c'].map((s) => hex(s))
const CHEEK = hex('#f58f9a')
const BROW = hex('#54446a')
const MOUTH = hex('#7d2a40')
const INSIDE = hex('#c43a52')
const TONGUE = hex('#ff8fa6')
const BLUE = ['#3b92d6', '#8fdcff', '#e3f8ff'].map((s) => hex(s))
const GOLD = hex('#f0c040')
const WHITE = hex('#ffffff')

/** light from the upper left: l in about -1..1 -> palette index 0 (dark) .. 3 (light) */
const lit = (pal: number[], l: number) => pal[l > 0.25 ? 3 : l > -0.2 ? 2 : l > -0.6 ? 1 : 0]

function shadedEllipse(img: Img, cx: number, cy: number, rx: number, ry: number, pal: number[]) {
  for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
    for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
      const nx = (i + 0.5 - cx) / rx, ny = (j + 0.5 - cy) / ry
      if (nx * nx + ny * ny <= 1) put(img, i, j, lit(pal, -(0.55 * nx + 0.75 * ny)))
    }
}

/** ascii stamp: '.' transparent; other chars looked up in pal (unknown chars skipped) */
function stamp(img: Img, x0: number, y0: number, rows: string[], pal: Record<string, number>, mirror = false) {
  rows.forEach((row, j) => {
    const w = row.length
    for (let i = 0; i < w; i++) {
      const ch = mirror ? row[w - 1 - i] : row[i]
      const c = pal[ch]
      if (ch !== '.' && c !== undefined) put(img, x0 + i, y0 + j, c)
    }
  })
}
/** a pair of mirrored stamps: left one at x0, right one mirrored about the face axis (x = 16) */
function pair(img: Img, x0: number, y0: number, rows: string[], pal: Record<string, number>) {
  stamp(img, x0, y0, rows, pal)
  stamp(img, 32 - x0 - rows[0].length, y0, rows, pal, true)
}

type Look = 'center' | 'left' | 'right' | 'grin' | 'hurt' | 'sweaty' | 'dizzy'

function makeFace(look: Look): Img {
  const img = newImg(32, 32)
  const skin = look === 'sweaty' ? SKIN_PALE : look === 'hurt' ? SKIN_HOT : SKIN
  const dx = look === 'left' ? -1 : look === 'right' ? 1 : 0 // feature shift when the head turns
  const askew = look === 'sweaty'

  // coat + jabot (behind the chin)
  fillPoly(img, [[3, 30], [5, 27], [10, 25], [22, 25], [27, 27], [29, 30]], COAT[1])
  fillPoly(img, [[3, 30], [5, 27], [8, 26], [8, 30]], COAT[2])
  fillPoly(img, [[24, 26], [27, 27], [29, 30], [24, 30]], COAT[0])
  fillRect(img, 4, 29, 25, 1, COAT[0])
  put(img, 7, 28, GOLD); put(img, 24, 28, GOLD)
  const J = hex('#d5daee')
  fillRect(img, 12, 25, 8, 1, WHITE)
  fillRect(img, 11, 26, 10, 4, WHITE)
  for (let y = 27; y < 30; y++) { put(img, 13, y, J); put(img, 18, y, J) }
  put(img, 11, 29, J); put(img, 20, 29, J); put(img, 15, 29, J); put(img, 16, 29, J)
  put(img, 15, 26, J); put(img, 16, 26, J)

  // face
  shadedEllipse(img, 16, 18.6, 7.6, 7.4, skin)
  put(img, 8, 19, skin[1]); put(img, 23, 19, skin[1]) // ears peeking out under the curls

  // wig: dome + hairline drawn as one shaded layer (leaning when knocked askew)
  const inDome = (x: number, y: number) => ((x + 0.5 - 16) / 10) ** 2 + ((y + 0.5 - 8.6) / 6.9) ** 2 <= 1
  const inFront = (x: number, y: number) => ((x + 0.5 - 16) / 10.4) ** 2 + ((y + 0.5 - 7.1) / 5.1) ** 2 <= 1
  const inFace = (x: number, y: number) => ((x + 0.5 - 16) / 7.6) ** 2 + ((y + 0.5 - 18.6) / 7.4) ** 2 <= 1
  for (let y = 0; y < 32; y++) {
    const sh = askew ? Math.max(0, Math.round((14 - y) * 0.36)) : 0
    for (let x = 0; x < 32; x++) {
      if (!(inFront(x, y) || (inDome(x, y) && !inFace(x, y)))) continue
      const nx = (x + 0.5 - 16) / 10, ny = (y + 0.5 - 8.6) / 6.9
      let c = lit(WIG, -(0.5 * nx + 0.75 * ny) + 0.14)
      // two soft curved roll lines across the front of the wig
      const r = Math.sqrt(nx * nx * 100 + ny * ny * 47.6)
      if (c === WIG[3] && ny < -0.05 && (Math.abs(r - 7.6) < 0.55 || Math.abs(r - 4.6) < 0.5)) c = WIG[2]
      put(img, x + sh, y, c)
    }
  }
  // centre parting
  if (!askew) { put(img, 15, 12, WIG[1]); put(img, 16, 12, WIG[1]) }

  // side curls: two rows each side, each with a little swirl
  const curl = (cx: number, cy: number, flip: boolean) => {
    shadedEllipse(img, cx, cy, 3.3, 3.3, WIG)
    const sg = flip ? -1 : 1
    for (const [ox, oy] of [[-1, -1], [0, -1], [1, 0], [0, 1], [-1, 1]]) put(img, Math.floor(cx) + ox * sg, Math.floor(cy) + oy, WIG[1])
  }
  curl(5.4, 13.0, false); curl(5.4, 18.8, false)
  curl(26.6, 13.0, true); curl(26.6, 18.8, true)

  // cheeks
  const ck = look === 'sweaty' ? mix(CHEEK, skin[2], 0.55) : CHEEK
  pair(img, 9 + dx, 19, ['ccc', 'ccc'], { c: ck })

  // nose (moves a little more than the eyes when the head turns)
  stamp(img, 14 + dx * 2, 17, ['.hn.', 'nnnn', '.dd.'], { h: hex('#ffe4cc'), n: hex('#f4a08a'), d: skin[0] })

  const P = { k: INK, w: WHITE, p: INK, i: hex('#3f67b5'), s: WHITE, b: BROW, y: hex('#3552b8') }
  const ex = 10 + dx
  const wholeMouth = (rows: string[], x0: number, y0: number, pal: Record<string, number>) => stamp(img, x0 + dx, y0, rows, pal)
  switch (look) {
    case 'center':
    case 'left':
    case 'right': {
      const [a, b] = look === 'left' ? ['sy' + 'ww', 'yyww'] : look === 'right' ? ['wwsy', 'wwyy'] : ['wsyw', 'wyyw']
      pair(img, ex, 15, ['kkkk', a, b], P)
      pair(img, ex, 13, ['.bbb', 'b...'], P)
      wholeMouth(['k....k', '.kkkk.'], 13, 21, { k: MOUTH })
      break
    }
    case 'grin': {
      // big shiny sparkle eyes, raised brows, wide open grin with a tongue
      pair(img, ex, 14, ['.kk.', 'ksyk', 'kysk', '.kk.'], P)
      pair(img, ex, 12, ['.bbb'], P)
      stamp(img, 12, 21, ['.kkkkkk.', 'kwwwwwwk', 'krrttrrk', '.kkkkkk.'], { k: MOUTH, w: WHITE, r: INSIDE, t: TONGUE })
      break
    }
    case 'hurt': {
      // squinting > < eyes, brows pushed down in the middle, gritted teeth
      pair(img, ex, 14, ['kk..', '.kkk', 'kk..'], P)
      stamp(img, ex, 12, ['b...', '.bbb'], P)
      stamp(img, 32 - ex - 4, 12, ['...b', 'bbb.'], P)
      stamp(img, 11, 21, ['kkkkkkkkkk', 'kwwkwwkwwk', 'kwwkwwkwwk', '.kkkkkkkk.'], { k: MOUTH, w: WHITE })
      break
    }
    case 'sweaty': {
      // wide worried eyes, brows tilted up in the middle, wobbly mouth
      pair(img, ex, 15, ['kkkk', 'wppw', 'wwww'], P)
      stamp(img, ex, 12, ['.bbb', 'b...'], P)
      stamp(img, 32 - ex - 4, 12, ['bbb.', '...b'], P)
      stamp(img, 12, 21, ['..kk..kk', 'kk..kk..'], { k: MOUTH })
      break
    }
    case 'dizzy': {
      // X eye + spiral eye, silly open mouth with the tongue out
      stamp(img, ex - 1, 14, ['k...k', '.k.k.', '..k..', '.k.k.', 'k...k'], P)
      stamp(img, 32 - ex - 4, 14, ['kkkkk', 'k...k', 'k.k.k', 'k.kkk', 'kk...'], P)
      pair(img, ex, 12, ['bbb'], P)
      stamp(img, 12, 21, ['.kkkkkk.', 'krrrrrrk', '.kkttkk.', '..kttk..', '..kttk..'], { k: MOUTH, r: INSIDE, t: TONGUE })
      break
    }
  }

  // sweat drops (low health), on the wig and temple
  if (look === 'sweaty') {
    stamp(img, 21, 5, ['.a.', 'bbb', 'bhb', '.b.'], { a: BLUE[0], b: BLUE[1], h: BLUE[2] })
    stamp(img, 12, 7, ['.a.', 'bhb', '.b.'], { a: BLUE[0], b: BLUE[1], h: BLUE[2] })
  }
  outline(img, INK)
  return img
}

export function makeFaces(): Face {
  return {
    center: makeFace('center'),
    left: makeFace('left'),
    right: makeFace('right'),
    grin: makeFace('grin'),
    hurt: makeFace('hurt'),
    sweaty: makeFace('sweaty'),
    dizzy: makeFace('dizzy'),
  }
}
