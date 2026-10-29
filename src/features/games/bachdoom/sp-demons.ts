// The three "Dissonant" demons: imp (tall purple), grumble (round red), squeak (flying purple-pink).
import type { DemonSet, Img } from './types'
import type { Ramp } from './sp-kit'
import { fillEllipse, fillPoly, fillRect, hex, newImg, put } from './px'
import { claws, curve, darker, dot, eye, mouth, OL, part, ramp, spiral } from './sp-kit'

export type Phase = 'w0' | 'w1' | 'atk' | 'hurt'
const PH: Phase[] = ['w0', 'w1', 'atk', 'hurt']
const W = 48, H = 64

function set(f: (p: Phase) => Img): DemonSet {
  const [a, b, c, d] = PH.map(f)
  return { walk: [a, b], attack: c, hurt: d }
}

/** a pointed 3-toed foot whose bottom row is `yb`, toes pointing `dir` (-1 left, +1 right) */
function foot(img: Img, fx: number, yb: number, dir: number, r: Ramp) {
  part(img, r, OL, (L, F) => {
    fillEllipse(L, fx + dir * 1.5, yb - 1.3, 4.6, 2.3, F)
    fillRect(L, Math.round(fx - 3), yb - 1, 8, 2, F)
    // toe points
    put(L, Math.round(fx + dir * 6), yb, F); put(L, Math.round(fx + dir * 6), yb - 1, F); put(L, Math.round(fx + dir * 7), yb, F)
  })
}

// ---------------------------------------------------------------- IMP
export function buildImp(): DemonSet { return set(imp) }
function imp(ph: Phase): Img {
  const img = newImg(W, H)
  const skin = ramp('#8e50d2'), body = skin, limb = ramp('#6a39a6'), horn = ramp('#f1e0b0'), pink = ramp('#f0a6dc'), tail = limb
  const atk = ph === 'atk', hurt = ph === 'hurt'
  const bob = ph === 'w1' ? 1 : 0
  const hip = hurt ? 51 : atk ? 49 : 47 + bob
  const hy = hurt ? 28 : atk ? 25 : 23 + bob       // head centre y
  const hx = atk ? 25 : 24                            // head leans a touch
  // ---- tail (behind)
  const tw = ph === 'w1' ? 3 : 0
  part(img, tail, OL, (L, F) => {
    curve(L, [[28, hip - 1], [40, hip + 4 - tw], [42, hip - 8 - tw]], 3.4, 2, F)
    fillPoly(L, [[38, hip - 7 - tw], [46, hip - 7 - tw], [42, hip - 15 - tw]], F)
  })
  // ---- legs
  const lA = ph === 'w0' ? 0 : ph === 'w1' ? 2 : 0     // how much each foot is lifted
  const rA = ph === 'w0' ? 2 : ph === 'w1' ? 0 : 0
  const lx = hurt ? 15 : atk ? 17 : 19, rx = hurt ? 33 : atk ? 31 : 29
  part(img, limb, OL, (L, F) => {
    curve(L, [[21, hip - 2], [hurt ? 12 : 20, (hip + 61 - lA) / 2], [lx, 60 - lA]], 3.6, 3.2, F)
    curve(L, [[27, hip - 2], [hurt ? 36 : 28, (hip + 61 - rA) / 2], [rx, 60 - rA]], 3.6, 3.2, F)
  })
  foot(img, lx - 1, 62 - lA, -1, limb)
  foot(img, rx + 1, 62 - rA, 1, limb)
  // ---- back arm (viewer's left), stringy with claws
  const armL: number[][] = atk ? [[18, hip - 10], [8, hip - 9], [6, hip - 20]]
    : hurt ? [[18, hip - 10], [8, hip - 14], [5, hip - 22]]
      : ph === 'w0' ? [[18, hip - 10], [10, hip - 8], [9, hip + 1]] : [[18, hip - 10], [11, hip - 13], [7, hip - 19]]
  const armR: number[][] = atk ? [[30, hip - 10], [40, hip - 9], [42, hip - 20]]
    : hurt ? [[30, hip - 10], [40, hip - 14], [43, hip - 22]]
      : ph === 'w0' ? [[30, hip - 10], [37, hip - 13], [41, hip - 19]] : [[30, hip - 10], [38, hip - 8], [39, hip + 1]]
  // ---- torso
  part(img, body, OL, (L, F) => {
    fillEllipse(L, 24, hip - 7, hurt ? 9 : 7.5, hurt ? 7 : 9.5, F)
  })
  part(img, pink, OL, (L, F) => { fillEllipse(L, 24, hip - 6, 3.6, 4.6, F) })
  // little scribbly stripes on the belly
  for (let k = 0; k < 3; k++) fillRect(img, 22 + k, hip - 8 + k * 2, 3, 1, pink.s)
  // ---- arms
  for (const [arm, flip] of [[armL, 1], [armR, -1]] as [number[][], number][]) {
    part(img, limb, OL, (L, F) => { curve(L, arm, 2.8, 2.2, F) })
    const e = arm[2], pe = arm[1]
    let dx = e[0] - pe[0], dy = e[1] - pe[1]; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n
    claws(img, e[0] + dx, e[1] + dy, dx, dy, '#f4ead0', 3, 3)
    void flip
  }
  // ---- ears (behind head)
  part(img, skin, OL, (L, F) => {
    fillPoly(L, [[hx - 10, hy - 9], [hx - 10, hy + 4], [hx - 23, hy - (atk ? 14 : 10)]], F)
    fillPoly(L, [[hx + 10, hy - 6], [hx + 10, hy + 3], [hx + 22, hy + (atk ? -12 : 4)]], F)
  })
  part(img, pink, OL, (L, F) => {
    fillPoly(L, [[hx - 10, hy - 6], [hx - 10, hy + 1], [hx - 19, hy - (atk ? 11 : 8)]], F)
    fillPoly(L, [[hx + 10, hy - 4], [hx + 10, hy + 1], [hx + 18, hy + (atk ? -9 : 2)]], F)
  }, true)
  // ---- horns (behind head)
  part(img, horn, OL, (L, F) => {
    const cy0 = hy - 15
    spiral(L, 11 + (hx - 24), cy0, 7.6, 2.6, 1.2, 0.92, 4.4, 1.4, F)
  })
  part(img, horn, OL, (L, F) => {
    curve(L, [[hx + 6, hy - 10], [hx + 11, hy - 15], [hx + 13, hy - 19]], 6, 1.8, F)
  })
  // ---- head
  part(img, skin, OL, (L, F) => { fillEllipse(L, hx, hy, hurt ? 15 : 14, hurt ? 11.5 : 13, F) })
  // cheeks
  for (const sx of [-9, 9]) fillEllipse(img, hx + sx, hy + 5, 2.4, 1.5, pink.m)
  // ---- eye
  const eyeY = hy - 3
  eye(img, {
    cx: hx, cy: eyeY, rx: 8, ry: hurt ? 7.5 : 7.5, iris: '#ffd23a',
    look: atk ? [0, 1] : ph === 'w0' ? [-1, 0] : ph === 'w1' ? [1, 0] : [0, 0],
    lid: atk ? [0, 3, 1] : hurt ? undefined : [1, 2, 0],
    mode: hurt ? 'spiral' : 'open',
  })
  // brow
  part(img, darker(skin), OL, (L, F) => {
    if (atk) curve(L, [[hx - 9, eyeY - 10], [hx, eyeY - 6], [hx + 9, eyeY - 10]], 2.4, 2.4, F, 30)
    else if (hurt) curve(L, [[hx - 8, eyeY - 9], [hx, eyeY - 12], [hx + 8, eyeY - 8]], 2, 2, F, 30)
    else curve(L, [[hx - 8, eyeY - 8], [hx, eyeY - 9], [hx + 8, eyeY - 5]], 2.4, 2.4, F, 30)
  })
  // ---- grin
  if (atk) mouth(img, { cx: hx, cy: hy + 6, w: 22, h: 7, smile: 2, teeth: 6, td: 3, tongue: true, bottom: true })
  else if (hurt) mouth(img, { cx: hx, cy: hy + 6, w: 16, h: 4, smile: -1, teeth: 4, td: 2, wob: 1.4 })
  else mouth(img, { cx: hx, cy: hy + 7, w: 20, h: 4, smile: 2, teeth: 5, td: 2, bottom: true })
  return img
}

// ---------------------------------------------------------------- GRUMBLE
export function buildGrumble(): DemonSet { return set(grumble) }
function grumble(ph: Phase): Img {
  const img = newImg(W, H)
  const red = ramp('#e24c35'), head = red, limb = ramp('#b9352b'), belly = ramp('#ffc19a'), horn = ramp('#f1e0b0'), gold = hex('#ffd23a')
  const atk = ph === 'atk', hurt = ph === 'hurt'
  const bob = ph === 'w1' ? 1 : 0
  const hcy = hurt ? 31 : atk ? 28 : 26 + bob     // head centre y
  const bcy = hurt ? 51 : atk ? 48 : 47 + bob     // body centre y
  const hx = 24
  // ---- long bent horn + broken stub (behind head)
  part(img, horn, OL, (L, F) => {
    curve(L, [[hx + 8, hcy - 9], [hx + 11, hcy - 25], [hx + 21, hcy - 24], [hx + 22, hcy - 14]], 7, 1.8, F)
  })
  part(img, horn, OL, (L, F) => {
    const x = hx - 15, y = hcy - 15
    fillPoly(L, [[x - 1, y + 9], [x, y - 3], [x + 1, y - 2], [x + 3, y - 5], [x + 5, y - 2], [x + 7, y - 4], [x + 8, y + 9]], F)
  })
  // the broken top shows lighter "inside" with a crack
  const bx = hx - 15, by = hcy - 15
  fillRect(img, bx + 2, by - 3, 4, 1, horn.h); put(img, bx + 3, by - 1, horn.d); put(img, bx + 3, by, horn.d); put(img, bx + 4, by + 1, horn.d)
  // ---- body
  part(img, red, OL, (L, F) => { fillEllipse(L, 24, bcy, hurt ? 21 : atk ? 19.5 : 18.5, hurt ? 9.5 : 12.5, F) })
  part(img, belly, OL, (L, F) => { fillEllipse(L, 24, bcy + 1, hurt ? 11 : 10, hurt ? 6 : 8, F) })
  // scribbled note on belly
  const nc = belly.s
  fillRect(img, 23, bcy - 2, 1, 5, nc); fillRect(img, 21, bcy + 2, 3, 2, nc); fillRect(img, 24, bcy - 2, 3, 1, nc); put(img, 26, bcy - 1, nc)
  // ---- feet / stubby legs
  const lAm = ph === 'w0' ? 0 : ph === 'w1' ? 2 : 0, rAm = ph === 'w0' ? 2 : ph === 'w1' ? 0 : 0
  const spread = hurt ? 4 : atk ? 2 : 0
  part(img, limb, OL, (L, F) => {
    fillEllipse(L, 14 - spread, 58.8 - lAm, 7.3, 3.6, F)
    fillEllipse(L, 34 + spread, 58.8 - rAm, 7.3, 3.6, F)
  })
  // toes
  for (const [fx, lift, d] of [[14 - spread, lAm, -1], [34 + spread, rAm, 1]] as [number, number, number][]) for (let k = -1; k <= 1; k++) put(img, fx + d * 5 + k * 0, 60 - lift + k, limb.d)
  // ---- arms (chubby, behind head? in front of body)
  const armPose = (side: -1 | 1): number[][] => {
    const sx = 24 + side * 14
    if (atk) return [[sx, bcy - 6], [sx + side * 7, bcy - 12], [sx + side * 4, bcy - 22]]
    if (hurt) return [[sx, bcy - 4], [sx + side * 8, bcy - 10], [sx + side * 5, bcy - 18]]
    const fwd = (ph === 'w0') === (side === -1)
    return fwd ? [[sx, bcy - 5], [sx + side * 6, bcy - 1], [sx + side * 3, bcy + 6]] : [[sx, bcy - 5], [sx + side * 6, bcy - 8], [sx + side * 5, bcy - 13]]
  }
  for (const side of [-1, 1] as const) {
    const a = armPose(side)
    part(img, limb, OL, (L, F) => { curve(L, a, 6, 5, F); dot(L, a[2][0], a[2][1], 7, F) })
    if (atk || hurt) {
      const e = a[2]
      claws(img, e[0] - side, e[1] - 4, 0, -1, '#f4ead0', 3, 3)
    }
  }
  // ---- head
  part(img, head, OL, (L, F) => { fillEllipse(L, hx, hcy, hurt ? 17.5 : 16, hurt ? 12.5 : 14, F) })
  // ---- bow-tie (crooked)
  const ty = hcy + 14 - (hurt ? 1 : 0)
  part(img, ramp('#3c70dd'), OL, (L, F) => {
    fillPoly(L, [[hx - 1, ty], [hx - 9, ty - 4], [hx - 8, ty + 4]], F)
    fillPoly(L, [[hx + 1, ty + 1], [hx + 9, ty - 2], [hx + 9, ty + 6]], F)
    fillRect(L, hx - 2, ty - 1, 4, 4, F)
  })
  put(img, hx - 6, ty, gold); put(img, hx + 6, ty + 2, gold); put(img, hx - 5, ty + 2, gold)
  // ---- eye
  const ey = hcy - 3
  eye(img, {
    cx: hx, cy: ey, rx: 9, ry: 8, iris: '#3ad0e6',
    look: atk ? [0, 1] : ph === 'w0' ? [1, 0] : ph === 'w1' ? [-1, 0] : [0, 0],
    lid: atk ? [2, 6, 2] : hurt ? undefined : [2, 5, 2],
    mode: hurt ? 'squeeze' : 'open',
  })
  part(img, darker(limb), OL, (L, F) => {
    const dip = atk ? 6 : hurt ? -3 : 5, by = hurt ? ey - 7 : ey - 10
    curve(L, [[hx - 11, by], [hx - 6, by + dip * 0.5], [hx - 1, by + dip]], 3.4, 2.6, F, 30)
    curve(L, [[hx + 1, by + dip], [hx + 6, by + dip * 0.5], [hx + 11, by]], 2.6, 3.4, F, 30)
  })
  // ---- big brutish grin
  if (atk) mouth(img, { cx: hx, cy: hcy + 7, w: 28, h: 9, smile: 3, teeth: 7, td: 4, tongue: true, bottom: true })
  else if (hurt) mouth(img, { cx: hx, cy: hcy + 6, w: 20, h: 5, smile: -2, teeth: 5, td: 2, wob: 1.6 })
  else mouth(img, { cx: hx, cy: hcy + 8, w: 28, h: 6, smile: 3, teeth: 7, td: 3, bottom: true })
  // little stars when hurt
  if (hurt) for (const [sx, sy] of [[7, hcy - 14], [41, hcy - 12], [24, hcy - 17]]) { fillRect(img, sx - 1, sy, 3, 1, hex('#ffd23a')); fillRect(img, sx, sy - 1, 1, 3, hex('#ffd23a')) }
  return img
}

// ---------------------------------------------------------------- SQUEAK
export function buildSqueak(): DemonSet { return set(squeak) }
function squeak(ph: Phase): Img {
  const img = newImg(W, H)
  const skin = ramp('#d466d8'), pink = ramp('#ffb3e6'), wing = ramp('#8a43bb'), tail = wing, horn = ramp('#f1e0b0')
  const atk = ph === 'atk', hurt = ph === 'hurt'
  const cy = ph === 'w0' ? 27 : ph === 'w1' ? 29 : atk ? 29 : 31
  const cx = 24
  // wing angle (radians, up positive) per phase
  const ang = ph === 'w0' ? 1.0 : ph === 'w1' ? -0.6 : atk ? 0.15 : -0.9
  // ---- tail (behind)
  part(img, tail, OL, (L, F) => {
    const wig = ph === 'w1' ? -3 : 3
    curve(L, [[cx, cy + 8], [cx + 8 + wig, cy + 17], [cx + 2, cy + 24 + wig * 0.3], [cx + 9, cy + 29]], 3.4, 1.8, F)
    const ex = cx + 9, ey = cy + 29
    fillPoly(L, [[ex - 3, ey - 1], [ex + 4, ey - 4], [ex + 5, ey + 3]], F)
  })
  // ---- wings (behind body)
  for (const side of [-1, 1] as const) {
    const sx = cx + side * 8, sy = cy - 1
    const t = (a: number, l: number) => [sx + side * Math.cos(a) * l, sy - Math.sin(a) * l]
    const a0 = ang, spread = 0.62, L0 = atk ? 13.5 : hurt ? 15 : ph === 'w1' ? 15 : 20
    const T1 = t(a0 + spread, L0 * 0.95), T2 = t(a0, L0), T3 = t(a0 - spread, L0 * 0.72)
    const mid = (p: number[], q: number[]) => [sx + ((p[0] + q[0]) / 2 - sx) * 0.55, sy + ((p[1] + q[1]) / 2 - sy) * 0.55]
    part(img, wing, OL, (L, F) => {
      fillPoly(L, [[sx, sy - 4], T1, mid(T1, T2), T2, mid(T2, T3), T3, [sx, sy + 6]], F)
    })
    for (const T of [T2, T3]) {
      // wing "finger" bones
      const n = 14
      for (let k = 2; k <= n; k++) put(img, Math.round(sx + ((T[0] - sx) * k) / n), Math.round(sy + ((T[1] - sy) * k) / n), wing.s)
    }
  }
  // ---- horns (mismatched: one curly little, one stubby)
  part(img, horn, OL, (L, F) => { curve(L, [[cx - 6, cy - 9], [cx - 11, cy - 14], [cx - 8, cy - 19]], 4.2, 1.2, F, 30) })
  part(img, horn, OL, (L, F) => { fillPoly(L, [[cx + 4, cy - 10], [cx + 10, cy - 10], [cx + 9, cy - 16]], F) })
  // ---- body/head: one round ball
  part(img, skin, OL, (L, F) => { fillEllipse(L, cx, cy, hurt ? 13 : 12, hurt ? 11 : 12, F) })
  // pink belly bit peeking under the mouth
  part(img, pink, OL, (L, F) => { fillEllipse(L, cx, cy + 10, 5, 3, F) })
  // tiny arms
  for (const side of [-1, 1] as const) {
    const up = atk || hurt
    if (!up) continue
    part(img, skin, OL, (L, F) => {
      curve(L, up ? [[cx + side * 10, cy + 3], [cx + side * 14, cy - 1], [cx + side * 16, cy - 7]] : [[cx + side * 10, cy + 4], [cx + side * 13, cy + 8], [cx + side * 11, cy + 12]], 3, 2.4, F, 20)
    })
    if (atk || hurt) claws(img, cx + side * 16, cy - 8, 0, -1, '#f4ead0', 3, 2)
  }
  // ---- eye
  const ey = cy - 3
  eye(img, {
    cx, cy: ey, rx: 7, ry: 7, iris: '#40e07a',
    look: atk ? [0, 1] : ph === 'w0' ? [-1, 0] : ph === 'w1' ? [1, 0] : [0, 0],
    lid: atk ? [1, 2, 1] : undefined, mode: hurt ? 'spiral' : 'open',
  })
  // ---- grin with one big tooth
  if (atk) mouth(img, { cx, cy: cy + 5, w: 18, h: 7, smile: 1, teeth: 5, td: 3, tongue: true, bottom: true, fang: -0.35, fangLen: 5 })
  else if (hurt) mouth(img, { cx, cy: cy + 6, w: 12, h: 3, smile: -1, teeth: 3, td: 1, wob: 1.2 })
  else mouth(img, { cx, cy: cy + 6, w: 17, h: 4, smile: 2, teeth: 4, td: 2, fang: 0.3, fangLen: 5 })
  if (hurt) for (const [sx, sy] of [[8, cy - 14], [40, cy - 12]]) { fillRect(img, sx - 1, sy, 3, 1, hex('#ffd23a')); fillRect(img, sx, sy - 1, 1, 3, hex('#ffd23a')) }
  return img
}
