// The Cacophodemon: a floating plum-purple lump with a brass tuba-bell mouth, cymbal ears,
// a crown of broken tuning forks, one googly eye + one spiral eye, drumstick and recorder.
import type { Img } from './types'
import { fillEllipse, fillPoly, fillRect, hex, line, newImg, put, ringEllipse } from './px'
import { curve, darker, dot, eye, OL, part, ramp, TOOTH } from './sp-kit'

type BPhase = 'i0' | 'i1' | 'atk' | 'hurt'
const S = 96

const PLUM = ramp('#8b3fae'), PLUM2 = darker(PLUM), TOOTHR = ramp(TOOTH), BRASS = ramp('#e6a82a'), STEEL = ramp('#b9c6dc'), WOOD = ramp('#c98b4b')
const DEEPMOUTH = [hex('#4d1340'), hex('#35092f'), hex('#220524'), hex('#14031a')]

function doodleNote(img: Img, x: number, y: number, c: number) {
  fillRect(img, x, y + 4, 3, 2, c); fillRect(img, x + 2, y, 1, 5, c); put(img, x + 3, y + 1, c); put(img, x + 4, y + 2, c)
}

/** one broken tuning fork pointing along `ang` (0 = up, radians, +clockwise) from (bx,by) */
function fork(img: Img, bx: number, by: number, ang: number, len: number, broken: boolean) {
  const dx = Math.sin(ang), dy = -Math.cos(ang), px = Math.cos(ang), py = Math.sin(ang)
  part(img, STEEL, OL, (L, F) => {
    const hl = len * 0.42
    for (let k = 0; k <= hl; k += 0.5) dot(L, bx + dx * k, by + dy * k, 4, F)
    const ex = bx + dx * hl, ey = by + dy * hl
    for (let k = -3.6; k <= 3.6; k += 0.5) dot(L, ex + px * k, ey + py * k, 3, F)       // the U bottom
    for (const side of [-1, 1]) {
      const pl = broken && side === 1 ? len * 0.3 : len * 0.58
      for (let k = 0; k <= pl; k += 0.5) dot(L, ex + px * 3.6 * side + dx * k, ey + py * 3.6 * side + dy * k, side === 1 && broken ? 3 : 2.6, F)
    }
  })
}

function cymbal(img: Img, cx: number, cy: number, rx: number, ry: number, crack: boolean, tilt: number) {
  part(img, BRASS, OL, (L, F) => { fillEllipse(L, cx, cy, rx, ry, F) })
  ringEllipse(img, cx - tilt * 0.4, cy, rx - 2.4, ry - 2.4, BRASS.s, 1)
  part(img, BRASS, OL, (L, F) => { fillEllipse(L, cx - tilt * 0.3, cy, rx * 0.42, ry * 0.2 + rx * 0.2, F) })
  put(img, Math.round(cx - rx * 0.25 - tilt * 0.3), Math.round(cy - 2), BRASS.h)
  if (crack) {
    const c = hex('#4a2a10')
    let x = Math.round(cx + rx * 0.2), y = Math.round(cy - ry + 2)
    for (let k = 0; k < 9; k++) { put(img, x, y, c); y += 1; x += k % 2 === 0 ? 1 : -1 }
  }
}

/** the tuba bell: brass flange, a deep tunnel and a ring of jagged teeth */
function bell(img: Img, cx: number, cy: number, rx: number, ry: number, hurt: boolean) {
  part(img, BRASS, OL, (L, F) => { fillEllipse(L, cx, cy, rx, ry, F) })
  const irx = rx - 5, iry = ry - 4.5
  ringEllipse(img, cx, cy, rx - 2, ry - 2, BRASS.l, 1)
  fillEllipse(img, cx + 0.5, cy + 0.5, irx, iry, BRASS.d)
  fillEllipse(img, cx + 1, cy + 1, irx - 1, iry - 1, DEEPMOUTH[0])
  fillEllipse(img, cx + 1, cy + 1.5, irx * 0.72, iry * 0.7, DEEPMOUTH[1])
  fillEllipse(img, cx + 1, cy + 2, irx * 0.46, iry * 0.44, DEEPMOUTH[2])
  fillEllipse(img, cx + 1, cy + 2, irx * 0.22, iry * 0.2, DEEPMOUTH[3])
  void hurt
}
function teeth(img: Img, cx: number, cy: number, rx: number, ry: number, n: number, depth: number, skipLow = false) {
  const irx = rx - 5, iry = ry - 4.5
  part(img, TOOTHR, OL, (L, F) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.2
      if (skipLow && Math.sin(a) > 0.55 && Math.abs(Math.cos(a)) < 0.5) continue
      const sz = (k % 3 === 0 ? 1.2 : k % 3 === 1 ? 0.85 : 1) * depth
      const bx = cx + 1 + Math.cos(a) * (irx - 0.5), by = cy + 1 + Math.sin(a) * (iry - 0.5)
      const tx = cx + 1 + Math.cos(a) * (irx - sz), ty = cy + 1 + Math.sin(a) * (iry - sz * (iry / irx))
      const nx = -Math.sin(a), ny = Math.cos(a)
      // triangle: base on the rim (width 4.4), apex pointing at the centre
      const pts = [[bx + nx * 2.9, by + ny * 2.3], [bx - nx * 2.9, by - ny * 2.3], [tx, ty]]
      const x0 = Math.min(pts[0][0], pts[1][0], pts[2][0]), y0 = Math.min(pts[0][1], pts[1][1], pts[2][1])
      for (let y = Math.floor(y0); y <= Math.ceil(Math.max(pts[0][1], pts[1][1], pts[2][1])); y++)
        for (let x = Math.floor(x0); x <= Math.ceil(Math.max(pts[0][0], pts[1][0], pts[2][0])); x++) {
          // barycentric inside test
          const [A, B, C] = pts
          const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1])
          const l1 = ((B[1] - C[1]) * (x + 0.5 - C[0]) + (C[0] - B[0]) * (y + 0.5 - C[1])) / d
          const l2 = ((C[1] - A[1]) * (x + 0.5 - C[0]) + (A[0] - C[0]) * (y + 0.5 - C[1])) / d
          if (l1 >= -0.02 && l2 >= -0.02 && 1 - l1 - l2 >= -0.02) put(L, x, y, F)
        }
    }
  })
}

export function buildBoss(): { idle: [Img, Img]; attack: Img; hurt: Img } {
  return { idle: [boss('i0'), boss('i1')], attack: boss('atk'), hurt: boss('hurt') }
}

function boss(ph: BPhase): Img {
  const img = newImg(S, S)
  const atk = ph === 'atk', hurt = ph === 'hurt'
  const oy = ph === 'i0' ? 2 : ph === 'i1' ? 0 : atk ? 1 : 3          // vertical bob
  const wig = ph === 'i1' ? 1 : 0                                         // details wiggle
  const sw = hurt ? 1.1 : atk ? 1.04 : 1, sh = hurt ? 0.9 : atk ? 1.02 : 1  // squash & stretch
  const cx = 48
  const Y = (v: number) => v + oy

  // ---- crown of broken tuning forks (behind body)
  const spec: [number, number, number, number, boolean][] = [
    // angle, base x, base y, length, broken
    [-0.95, 24, 31, 19, false], [-0.45, 34, 27, 22, true], [0.05, 48, 25, 23, false], [0.5, 62, 27, 22, false], [1.0, 73, 31, 18, true],
  ]
  spec.forEach(([ang, bx, by, len, br], i) => fork(img, bx, Y(by) + (hurt ? 1 : 0), ang + (wig ? (i % 2 ? 0.07 : -0.07) : 0) + (hurt ? (i % 2 ? -0.12 : 0.12) : 0), len, br))

  // ---- cymbal ears (behind body, mismatched)
  const ew = hurt ? 2 : 0
  cymbal(img, 11 - ew + wig, Y(41) + (hurt ? 8 : 0), 8, 17, false, -2)
  cymbal(img, 85 + ew - wig, Y(43) + (hurt ? 8 : 0), 7, 14, true, 2)

  // ---- lumpy body
  part(img, PLUM, OL, (L, F) => {
    fillEllipse(L, cx, Y(54), 30 * sw, 28 * sh, F)
    fillEllipse(L, 30, Y(37), 14 * sw, 13 * sh, F)
    fillEllipse(L, 68, Y(38), 13 * sw, 12 * sh, F)
    fillEllipse(L, 29, Y(68), 13 * sw, 12 * sh, F)
    fillEllipse(L, 68, Y(69), 14 * sw, 12 * sh, F)
    fillEllipse(L, cx, Y(30), 17 * sw, 8 * sh, F)
  })
  // warts and bumps for character
  for (const [wx, wy, wr] of [[20, 56, 2], [75, 52, 2.4], [48, 36, 1.6], [58, 60, 1.6], [27, 77, 2]] as [number, number, number][]) {
    part(img, PLUM2, OL, (L, F) => { fillEllipse(L, wx, Y(wy), wr, wr, F) })
  }
  // scribbled music-note graffiti
  const sc = hex('#e9b8ff'), sc2 = hex('#c47adf')
  doodleNote(img, 20, Y(44), sc); doodleNote(img, 74, Y(60), sc2); doodleNote(img, 40, Y(28), sc2)
  for (let k = 0; k < 6; k++) put(img, 21 + k, Y(63) + (k % 2), sc2)     // zig-zag scribble
  put(img, 80, Y(36), sc); put(img, 81, Y(37), sc); put(img, 82, Y(36), sc); put(img, 81, Y(35), sc) // tiny sparkle-x scar

  // ---- the eyes
  const bigX = 37, bigY = Y(40 + (hurt ? 2 : 0))
  if (hurt) {
    const dk = hex('#1a0b2b')
    line(img, bigX - 9, bigY - 8, bigX + 4, bigY, dk, 3); line(img, bigX + 4, bigY, bigX - 9, bigY + 8, dk, 3)
    // tear drops
    for (const [tx, ty] of [[27, 51], [50, 49]]) { fillRect(img, tx, Y(ty), 2, 3, hex('#7fd4ff')); put(img, tx, Y(ty) - 1, hex('#7fd4ff')); put(img, tx, Y(ty), hex('#e8faff')) }
  } else {
    eye(img, {
      cx: bigX, cy: bigY, rx: 13, ry: 13, iris: '#000', mode: 'googly',
      look: atk ? [-1, 4] : ph === 'i0' ? [-4, 5] : [3, 5],
      lid: atk ? [3, 8, 2] : [4, 3, 0],
    })
  }
  // unibrow over both eyes
  part(img, PLUM2, OL, (L, F) => {
    if (hurt) curve(L, [[22, Y(28)], [34, Y(25)], [47, Y(30)]], 3.4, 3, F, 30)
    else if (atk) curve(L, [[22, Y(24)], [36, Y(34)], [50, Y(33)]], 4.2, 3.2, F, 30)
    else curve(L, [[23, Y(25)], [36, Y(22)], [50, Y(27)]], 4, 3.2, F, 30)
  })
  const sx = 66, sy = Y(38 + (hurt ? 2 : 0))
  if (hurt) {
    eye(img, { cx: sx, cy: sy, rx: 6.5, ry: 6, iris: '#fff', mode: 'x' })
  } else {
    eye(img, { cx: sx, cy: sy, rx: 7, ry: 7, iris: '#ff5a8a', mode: 'spiral', lid: atk ? [2, 3, 1] : [0, 0, 0] })
  }
  part(img, PLUM2, OL, (L, F) => {
    curve(L, atk ? [[59, Y(28)], [66, Y(29)], [73, Y(33)]] : [[59, Y(30)], [66, Y(26)], [74, Y(29)]], 2.6, 2.2, F, 20)
  })

  // ---- tuba-bell mouth
  const bcy = Y(70 + (hurt ? 1 : 0))
  const brx = atk ? 25 : 24, bry = atk ? 15.5 : hurt ? 12 : 14
  bell(img, cx, bcy, brx, bry, hurt)
  if (atk) {
    // a glowing red-purple orb charging in the bell
    const ox = cx + 1, oy2 = bcy + 1
    const cols = ['#7a1a6a', '#b02a80', '#e0407a', '#ff7a88', '#ffc4c0', '#fff4ee']
    const rs = [11.5, 9.6, 7.8, 5.8, 3.8, 2]
    fillEllipse(img, ox, oy2, 13, 10.5, hex('#4c1250'))
    cols.forEach((c, i) => fillEllipse(img, ox, oy2, rs[i], rs[i] * 0.86, hex(c)))
    for (const [dx, dy] of [[-13, -2], [13, 0], [-6, -11], [8, 10], [0, -12]]) { fillRect(img, ox + dx, oy2 + dy, 2, 2, hex('#ffd0e8')) }
  }
  teeth(img, cx, bcy, brx, bry, hurt ? 11 : 15, hurt ? 4 : 5.6, hurt)
  if (hurt) {
    // tongue lolling out over the bottom-right rim
    part(img, ramp('#ee5a82'), OL, (L, F) => { fillEllipse(L, cx + 19, bcy + bry - 2, 5.5, 6.5, F) })
    fillRect(img, cx + 19, bcy + bry - 6, 1, 8, hex('#b43a60'))
  }

  // ---- arms (stubby) with drumstick (left) and recorder (right)
  const lh = atk ? [10, Y(62)] : [11, Y(78)]
  const rh = atk ? [86, Y(60)] : [85, Y(78)]
  part(img, PLUM2, OL, (L, F) => {
    curve(L, [[24, Y(68)], [14, Y(70 + (atk ? -4 : 6))], lh], 7, 5, F, 24)
    curve(L, [[73, Y(68)], [83, Y(70 + (atk ? -4 : 6))], rh], 7, 5, F, 24)
  })
  // drumstick: from left hand, leaning up-left, with a round felt tip
  const stickTop = atk ? [5, Y(40)] : [4, Y(60 + wig * 2)]
  part(img, WOOD, OL, (L, F) => { curve(L, [lh, [(lh[0] + stickTop[0]) / 2 + 1, (lh[1] + stickTop[1]) / 2], stickTop], 4, 3.2, F, 24) })
  part(img, TOOTHR, OL, (L, F) => { dot(L, stickTop[0], stickTop[1] - 1, 6, F) })
  dot(img, lh[0] + 1, lh[1] + 1, 6.5, PLUM2.m); put(img, lh[0] - 1, lh[1] - 1, PLUM2.l); put(img, lh[0], lh[1] - 2, PLUM2.l)
  // recorder: from right hand, leaning up-right, with finger holes
  const recTop = atk ? [91, Y(38)] : [91, Y(58 - wig * 2)]
  part(img, darker(WOOD), OL, (L, F) => { curve(L, [rh, [(rh[0] + recTop[0]) / 2 + 1, (rh[1] + recTop[1]) / 2], recTop], 5, 4.2, F, 24) })
  for (let k = 0; k < 4; k++) {
    const t = 0.25 + k * 0.18
    put(img, Math.round(rh[0] + (recTop[0] - rh[0]) * t), Math.round(rh[1] + (recTop[1] - rh[1]) * t), WOOD.h)
  }
  part(img, TOOTHR, OL, (L, F) => { fillRect(L, recTop[0] - 2, recTop[1] - 4, 4, 3, F) })
  dot(img, rh[0] - 1, rh[1] + 1, 6.5, PLUM2.m); put(img, rh[0] - 3, rh[1] - 1, PLUM2.l); put(img, rh[0] - 2, rh[1] - 2, PLUM2.l)

  // ---- crooked conductor's bow-tie, hugging the bell
  const ty = Y(84), bx = cx + 1
  part(img, ramp('#e23b4e'), OL, (L, F) => {
    fillPoly(L, [[bx - 1, ty], [bx - 13, ty - 6], [bx - 12, ty + 5]], F)
    fillPoly(L, [[bx + 3, ty + 1], [bx + 14, ty - 3], [bx + 14, ty + 8]], F)
    fillRect(L, bx - 2, ty - 2, 5, 6, F)
  })
  for (const [dx, dy] of [[-8, 0], [9, 2], [-5, 2]]) put(img, bx + dx, ty + dy, hex('#fff2a0'))
  return img
}
