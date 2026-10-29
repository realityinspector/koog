// Zombies mode: goofy cartoon zombies rise out of a moonlit graveyard at every note. All zombies are
// sprites built once per (skin, shirt, frame) and stamped with drawImage. The graveyard backdrop is
// rendered once into an offscreen canvas; only the low green fog moves. No flashes, no blood.
import type { Scene, SceneFactory, SceneKind, SceneReact } from './scenes'
import type { NoteGrade } from '../../music/judge'

const TAU = 6.283185
const BW = 96, BH = 80 // body sprite
const HW = 56, HH = 76 // head sprite
const SKINS: [number, number, number][] = [[100, 42, 58], [165, 40, 54], [72, 48, 58]] // h, s, l
const HAIR = ['hsl(265,35%,24%)', 'hsl(28,45%,25%)', 'hsl(210,12%,68%)']
const WALK = [0, 1, 2, 1]
const DIRT = ['#5a3d2b', '#7a5638', '#3f2c20']

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

// ---------- sprites ----------
const bodies = new Map<number, HTMLCanvasElement>()
const heads = new Map<number, HTMLCanvasElement>()
const handsS = new Map<number, HTMLCanvasElement>()
const armsS = new Map<number, HTMLCanvasElement>()
let moundS: HTMLCanvasElement | null = null
let starS: HTMLCanvasElement | null = null

const skinCss = (s: number, dl = 0) => `hsl(${SKINS[s][0]},${SKINS[s][1]}%,${SKINS[s][2] + dl}%)`

function bodySprite(skin: number, hb: number, f: number) {
  const id = (skin * 6 + hb) * 5 + f
  let c = bodies.get(id)
  if (c) return c
  const [c2, g] = mk(BW, BH)
  c = c2
  const cx = 48
  const sk = skinCss(skin), skd = skinCss(skin, -14)
  const hue = hb * 60
  const shirt = `hsl(${hue},68%,52%)`, shirtD = `hsl(${hue},68%,38%)`
  // legs
  const lift = f === 0 ? [-5, 0] : f === 2 ? [0, -5] : [0, 0]
  for (let i = 0; i < 2; i++) {
    const lx = cx - 13 + i * 14, ly = 54 + lift[i]
    g.fillStyle = 'hsl(228,22%,32%)'
    g.fillRect(lx, ly, 12, 18)
    g.fillStyle = '#2b2236'
    g.beginPath(); g.ellipse(lx + 6, 74 + lift[i], 8, 4.5, 0, 0, TAU); g.fill()
  }
  // torso with torn hem
  g.beginPath()
  g.moveTo(34, 27)
  g.quadraticCurveTo(48, 20, 62, 27)
  g.lineTo(63, 56)
  for (let k = 1; k <= 6; k++) g.lineTo(63 - k * 5, k % 2 ? 63 : 55)
  g.closePath()
  g.fillStyle = shirt
  g.fill()
  g.save()
  g.clip()
  g.fillStyle = shirtD
  g.fillRect(30, 39, 40, 4)
  g.fillStyle = skd
  g.beginPath(); g.moveTo(40, 46); g.lineTo(47, 44); g.lineTo(50, 50); g.lineTo(45, 54); g.lineTo(39, 52); g.closePath(); g.fill()
  g.fillStyle = `hsl(${hue + 40},60%,66%)`
  g.fillRect(53, 31, 7, 6)
  g.restore()
  // arms
  const hands = f === 3 ? [[20, 6], [76, 6]] : f === 0 ? [[14, 27], [82, 33]] : f === 2 ? [[14, 33], [82, 27]] : [[12, 24], [84, 24]]
  g.lineCap = 'round'
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1
    const sx = cx + s * 14, sy = 30
    if (f === 4 && s === -1) {
      g.strokeStyle = shirt; g.lineWidth = 10
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - 6, sy + 3); g.stroke()
      g.fillStyle = skd
      g.beginPath(); g.arc(sx - 7, sy + 3.5, 3.5, 0, TAU); g.fill()
      continue
    }
    const [hx, hy] = hands[i]
    const mx = sx + (hx - sx) * 0.45, my = sy + (hy - sy) * 0.45
    g.strokeStyle = shirt; g.lineWidth = 10
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(mx, my); g.stroke()
    g.strokeStyle = sk; g.lineWidth = 7
    g.beginPath(); g.moveTo(mx, my); g.lineTo(hx, hy); g.stroke()
    g.fillStyle = sk
    g.beginPath(); g.arc(hx, hy, 5.5, 0, TAU); g.fill()
    g.fillStyle = skd
    g.beginPath(); g.arc(hx + s * 3, hy - 4, 2.2, 0, TAU); g.fill()
  }
  bodies.set(id, c)
  return c
}

function handsSprite(skin: number) {
  let c = handsS.get(skin)
  if (c) return c
  const [c2, g] = mk(BW, 40)
  c = c2
  const sk = skinCss(skin), skd = skinCss(skin, -14)
  g.lineCap = 'round'
  for (const s of [-1, 1]) {
    const bx = 48 + s * 12, tx = 48 + s * 21
    g.strokeStyle = sk; g.lineWidth = 8
    g.beginPath(); g.moveTo(bx, 42); g.lineTo(tx, 14); g.stroke()
    g.fillStyle = sk
    g.beginPath(); g.arc(tx, 11, 6.5, 0, TAU); g.fill()
    g.fillStyle = skd
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.arc(tx + k * 5, 5 - Math.abs(k), 2.4, 0, TAU); g.fill() }
  }
  handsS.set(skin, c)
  return c
}

function armSprite(skin: number, hb: number) {
  const id = skin * 6 + hb
  let c = armsS.get(id)
  if (c) return c
  const [c2, g] = mk(48, 18)
  c = c2
  g.lineCap = 'round'
  g.strokeStyle = `hsl(${hb * 60},68%,52%)`; g.lineWidth = 10
  g.beginPath(); g.moveTo(8, 9); g.lineTo(20, 9); g.stroke()
  g.strokeStyle = skinCss(skin); g.lineWidth = 7
  g.beginPath(); g.moveTo(20, 9); g.lineTo(36, 9); g.stroke()
  g.fillStyle = skinCss(skin)
  g.beginPath(); g.arc(39, 9, 5.5, 0, TAU); g.fill()
  armsS.set(id, c)
  return c
}

// extra: 0 hair tuft, 1 bandage, 2 leaf sprout, 3 party hat
function headSprite(skin: number, extra: number) {
  const id = skin * 4 + extra
  let c = heads.get(id)
  if (c) return c
  const [c2, g] = mk(HW, HH)
  c = c2
  const cx = 28
  const sk = skinCss(skin), skd = skinCss(skin, -16)
  if (extra === 0) {
    g.fillStyle = HAIR[skin]
    g.beginPath()
    g.moveTo(15, 34); g.lineTo(14, 16); g.lineTo(23, 30)
    g.lineTo(26, 8); g.lineTo(32, 29)
    g.lineTo(41, 14); g.lineTo(41, 34)
    g.closePath(); g.fill()
  }
  // ears + head
  g.fillStyle = sk
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 21, 48, 4.5, 6, 0, 0, TAU); g.fill() }
  g.beginPath(); g.ellipse(cx, 46, 22, 19.5, 0, 0, TAU); g.fill()
  g.strokeStyle = skd; g.lineWidth = 1.8
  g.stroke()
  // cheek stitches
  g.lineWidth = 1.4; g.lineCap = 'round'
  g.beginPath(); g.moveTo(11, 56); g.lineTo(18, 58); g.stroke()
  for (const x of [13, 15.5, 18]) { g.beginPath(); g.moveTo(x, 54.5); g.lineTo(x + 0.6, 59.5); g.stroke() }
  // mismatched googly eyes
  g.lineWidth = 1.6
  g.strokeStyle = '#26382c'
  g.fillStyle = '#fff'
  g.beginPath(); g.arc(19, 42, 8.5, 0, TAU); g.fill(); g.stroke()
  g.beginPath(); g.arc(38, 40, 6, 0, TAU); g.fill(); g.stroke()
  g.fillStyle = '#16151c'
  g.beginPath(); g.arc(21, 45, 3.6, 0, TAU); g.fill()
  g.beginPath(); g.arc(36, 38.5, 2.8, 0, TAU); g.fill()
  g.fillStyle = '#fff'
  g.beginPath(); g.arc(22, 43.8, 1.2, 0, TAU); g.fill()
  g.beginPath(); g.arc(36.8, 37.6, 0.9, 0, TAU); g.fill()
  // nose
  g.fillStyle = skd
  g.beginPath(); g.ellipse(cx + 1, 51, 2.6, 1.8, 0, 0, TAU); g.fill()
  // goofy grin
  g.fillStyle = '#3a1830'
  g.beginPath(); g.moveTo(15, 55); g.quadraticCurveTo(cx, 70, 42, 54); g.quadraticCurveTo(cx, 58, 15, 55); g.closePath(); g.fill()
  g.fillStyle = '#fff'
  g.fillRect(19, 56, 4.5, 4.5)
  g.fillRect(31, 57, 4.5, 4.5)
  g.fillStyle = '#f07aa0'
  g.beginPath(); g.ellipse(cx + 3, 63, 4.5, 2.2, 0, 0, TAU); g.fill()
  // extras
  if (extra === 1) {
    g.save()
    g.translate(cx, 33); g.rotate(-0.16)
    g.fillStyle = '#efe3c0'
    g.fillRect(-22, -5, 44, 9)
    g.strokeStyle = 'rgba(150,120,70,0.6)'; g.lineWidth = 1
    g.beginPath(); g.moveTo(-8, -5); g.lineTo(-8, 4); g.moveTo(9, -5); g.lineTo(9, 4); g.stroke()
    g.restore()
  } else if (extra === 2) {
    g.strokeStyle = '#3f9a3a'; g.lineWidth = 2.4
    g.beginPath(); g.moveTo(cx, 29); g.quadraticCurveTo(cx - 2, 20, cx, 14); g.stroke()
    g.fillStyle = '#58c24a'
    for (const s of [-1, 1]) {
      g.save(); g.translate(cx + s * 6, 12); g.rotate(s * 0.6)
      g.beginPath(); g.ellipse(0, 0, 7, 3.6, 0, 0, TAU); g.fill()
      g.restore()
    }
  } else if (extra === 3) {
    g.fillStyle = '#ff5fa8'
    g.beginPath(); g.moveTo(14, 35); g.lineTo(43, 35); g.lineTo(31, 3); g.closePath(); g.fill()
    g.strokeStyle = '#ffe14a'; g.lineWidth = 3
    g.beginPath(); g.moveTo(19, 27); g.lineTo(38, 24); g.moveTo(24, 15); g.lineTo(34, 13); g.stroke()
    g.fillStyle = '#ffe14a'
    g.beginPath(); g.arc(31, 4, 3.8, 0, TAU); g.fill()
  }
  heads.set(id, c)
  return c
}

function moundSprite() {
  if (moundS) return moundS
  const [c, g] = mk(76, 20)
  g.translate(38, 11)
  g.scale(1, 0.3)
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 38)
  gr.addColorStop(0, '#6a4830')
  gr.addColorStop(0.7, '#4a3224')
  gr.addColorStop(1, 'rgba(60,40,30,0)')
  g.fillStyle = gr
  g.fillRect(-38, -38, 76, 76)
  moundS = c
  return c
}

function starSprite() {
  if (starS) return starS
  const [c, g] = mk(28, 28)
  const gr = g.createRadialGradient(14, 14, 0, 14, 14, 14)
  gr.addColorStop(0, 'rgba(255,230,120,0.7)')
  gr.addColorStop(1, 'rgba(255,210,60,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 28, 28)
  g.fillStyle = '#ffe36a'
  g.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2, r = i % 2 ? 2.6 : 9
    g.lineTo(14 + Math.cos(a) * r, 14 + Math.sin(a) * r)
  }
  g.closePath(); g.fill()
  starS = c
  return c
}

// ---------- text bubbles (cached) ----------
interface TextS { c: HTMLCanvasElement; w: number; h: number }
const texts = new Map<string, TextS>()
let measureCtx: CanvasRenderingContext2D | null = null
function textSprite(txt: string, style = 0): TextS {
  const key = style + txt
  let t = texts.get(key)
  if (t) return t
  const FS = 13, S = 2, pad = 7
  measureCtx = measureCtx ?? document.createElement('canvas').getContext('2d')!
  const font = `700 ${FS * S}px system-ui, sans-serif`
  measureCtx.font = font
  const tw = Math.ceil(measureCtx.measureText(txt).width / S)
  const w = tw + pad * 2, bh = FS + pad * 1.5, h = bh + 6
  const [c, g] = mk(w * S, h * S)
  g.scale(S, S)
  g.fillStyle = style ? 'rgba(255,238,150,0.96)' : 'rgba(236,255,232,0.95)'
  g.strokeStyle = 'rgba(28,52,40,0.85)'
  g.lineWidth = 1.5
  g.beginPath()
  g.roundRect(1, 1, w - 2, bh - 1, 8)
  g.fill(); g.stroke()
  g.beginPath()
  g.moveTo(w / 2 - 4, bh - 0.5); g.lineTo(w / 2, h - 1); g.lineTo(w / 2 + 4, bh - 0.5)
  g.closePath(); g.fill()
  g.font = `700 ${FS}px system-ui, sans-serif`
  g.fillStyle = '#1e3a2a'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(txt, w / 2, bh / 2 + 0.5)
  t = { c, w, h }
  texts.set(key, t)
  return t
}

// draw sprite w x h at local (dx, dy) scaled by k, hiding anything below the local ground line y = 0
function stamp(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, w: number, h: number, dx: number, dy: number, k: number) {
  const dh = h * k
  if (dy >= 0) return
  if (dy + dh <= 0) { ctx.drawImage(img, dx, dy, w * k, dh); return }
  const rows = -dy / k
  ctx.drawImage(img, 0, 0, w, rows, dx, dy, w * k, rows * k)
}

function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- backdrop ----------
function buildBackdrop(W: number, H: number): HTMLCanvasElement {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const [c, g] = mk(Math.max(1, Math.ceil(W * dpr)), Math.max(1, Math.ceil(H * dpr)))
  g.scale(dpr, dpr)
  const rnd = mulberry(Math.round(W) * 31 + Math.round(H))
  // sky
  const sky = g.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, 'rgb(30,20,66)')
  sky.addColorStop(0.5, 'rgb(36,40,92)')
  sky.addColorStop(0.8, 'rgb(32,82,96)')
  sky.addColorStop(1, 'rgb(26,60,70)')
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)
  // stars
  g.fillStyle = 'rgba(220,255,230,0.5)'
  for (let i = 0; i < 45; i++) {
    const r = rnd() < 0.2 ? 1.5 : 1
    g.fillRect(rnd() * W, rnd() * H * 0.55, r, r)
  }
  // big pale-green moon
  const mr = Math.max(40, Math.min(W, H) * 0.15), mx = W * 0.78, my = H * 0.24
  const glow = g.createRadialGradient(mx, my, mr * 0.7, mx, my, mr * 3.4)
  glow.addColorStop(0, 'rgba(190,255,170,0.42)')
  glow.addColorStop(0.45, 'rgba(150,235,170,0.14)')
  glow.addColorStop(1, 'rgba(120,220,170,0)')
  g.fillStyle = glow
  g.fillRect(mx - mr * 3.4, my - mr * 3.4, mr * 6.8, mr * 6.8)
  const disc = g.createRadialGradient(mx - mr * 0.25, my - mr * 0.25, mr * 0.1, mx, my, mr)
  disc.addColorStop(0, 'rgb(236,255,208)')
  disc.addColorStop(1, 'rgb(172,222,150)')
  g.fillStyle = disc
  g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill()
  g.fillStyle = 'rgba(110,160,100,0.25)'
  for (const [dx, dy, r] of [[-0.3, 0.2, 0.2], [0.28, -0.2, 0.14], [0.2, 0.38, 0.1], [-0.15, -0.4, 0.09]]) {
    g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); g.fill()
  }
  // distant hills
  g.fillStyle = 'rgb(28,52,68)'
  g.beginPath(); g.moveTo(0, H)
  for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, H * 0.7 + Math.sin(x * 0.011) * H * 0.025 + Math.sin(x * 0.027 + 1) * H * 0.012)
  g.lineTo(W, H); g.closePath(); g.fill()
  // back tombstones
  const stone = (x: number, base: number, w: number, h: number, kind: number, col: string, txt: string) => {
    g.fillStyle = col
    if (kind === 1) {
      g.fillRect(x - w * 0.12, base - h, w * 0.24, h)
      g.fillRect(x - w * 0.4, base - h * 0.72, w * 0.8, w * 0.22)
    } else {
      g.beginPath()
      g.moveTo(x - w / 2, base)
      g.lineTo(x - w / 2, base - h + w / 2)
      g.arc(x, base - h + w / 2, w / 2, Math.PI, 0)
      g.lineTo(x + w / 2, base)
      g.closePath(); g.fill()
      g.fillStyle = txt
      g.font = `700 ${Math.round(w * 0.28)}px system-ui, sans-serif`
      g.textAlign = 'center'
      g.fillText('RIP', x, base - h * 0.52)
    }
  }
  const sc = Math.max(0.6, Math.min(1.4, Math.min(W, H) / 600))
  for (let x = 20; x < W; x += (70 + rnd() * 70) * sc) {
    const k = rnd() < 0.3 ? 1 : 0
    stone(x, H * 0.77, (30 + rnd() * 14) * sc, (44 + rnd() * 26) * sc, k, 'rgb(30,40,76)', 'rgba(110,140,170,0.35)')
  }
  // ground strip
  const gr = g.createLinearGradient(0, H * 0.76, 0, H)
  gr.addColorStop(0, 'rgb(36,64,62)')
  gr.addColorStop(1, 'rgb(20,34,36)')
  g.fillStyle = gr
  g.fillRect(0, H * 0.76, W, H * 0.24)
  // iron fence
  const fb = H * 0.84, fh = Math.max(36, H * 0.09)
  g.fillStyle = 'rgb(16,22,36)'
  g.fillRect(0, fb - fh * 0.75, W, 3)
  g.fillRect(0, fb - fh * 0.3, W, 3)
  for (let x = 4; x < W; x += 15 * sc) {
    g.fillRect(x, fb - fh, 4, fh)
    g.beginPath(); g.moveTo(x - 1, fb - fh); g.lineTo(x + 2, fb - fh - 8); g.lineTo(x + 5, fb - fh); g.closePath(); g.fill()
  }
  // front tombstones, few and far between
  for (let x = 50 + rnd() * 80; x < W; x += (190 + rnd() * 160) * sc) {
    stone(x, H * 0.96, (36 + rnd() * 10) * sc, (52 + rnd() * 20) * sc, rnd() < 0.4 ? 1 : 0, 'rgb(16,22,40)', 'rgba(100,130,150,0.3)')
  }
  return c
}

function fogSprite() {
  const [c, g] = mk(320, 80)
  g.translate(160, 40)
  g.scale(1, 0.25)
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 160)
  gr.addColorStop(0, 'rgba(150,235,170,0.5)')
  gr.addColorStop(0.5, 'rgba(110,200,150,0.2)')
  gr.addColorStop(1, 'rgba(100,190,140,0)')
  g.fillStyle = gr
  g.fillRect(-160, -160, 320, 320)
  return c
}

// ---------- scene ----------
interface Z {
  note: number; x: number; bx: number; gy: number; k: number
  skin: number; hb: number; extra: number; kind: SceneKind
  ph: number; born: number
  state: number // 0 rising, 1 up, 2 sinking
  vis: number; wave: number
  dir: number; spd: number; range: number
  ev: number; evT: number; nextEv: number // spicy mishaps: 1 head pop, 2 arm drop
  dStart: number; dUntil: number
  // judge moments: point-and-laugh at a fizzle, pancake on BOOM, bow on a cadence, zap on a release
  lgStart: number; lgUntil: number; lgX: number; lgTxt: TextS | null
  flatStart: number; flatUntil: number
  bowStart: number; bowUntil: number
  zapT: number
  text: TextS
  tx: number; ty: number; bOn: boolean
}
interface Dirt { x: number; y: number; vx: number; vy: number; life: number; s: number; c: number; gy: number }

export const createZombies: SceneFactory = (reduced) => {
  const calm = reduced ? 0.5 : 1
  const mv = reduced ? 0.5 : 1
  const list: Z[] = []
  const holding = new Map<number, Z>()
  const dirt: Dirt[] = []
  let W = 0, H = 0
  let curQ = 1
  let lastT = 0, lastNow = 0
  let bg: HTMLCanvasElement | null = null
  let fog: HTMLCanvasElement | null = null
  let bubble = { x: 0, t0: -1e9, txt: '🧟 DANCE!' }
  let boomT = -1e9
  const LAUGHS = ['HA HA!', 'hehehe', 'pfft! 😂', 'oopsie!']
  const FOGS: [number, number, number, number][] = [[0.8, 14, 0, 1], [0.9, 20, 0.4, 1.2], [0.72, 10, 0.75, 0.8]]

  const zcap = (q: number) => Math.round(30 * calm * Math.max(0.4, q))
  const dcap = (q: number) => Math.round(200 * calm * Math.max(0.4, q))
  const s0 = () => Math.max(0.7, Math.min(1.3, Math.min(W, H) / 700))

  function puff(x: number, y: number, n: number) {
    const room = dcap(curQ) - dirt.length
    n = Math.min(Math.round(n * calm * 1.3), room)
    for (let i = 0; i < n; i++) {
      dirt.push({
        x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 150 * mv, vy: -(110 + Math.random() * 190) * mv,
        life: 450 + Math.random() * 450, s: 2.5 + Math.random() * 3, c: Math.floor(Math.random() * 3), gy: y + 2,
      })
    }
  }

  function sink(z: Z, wave: number) {
    if (z.state === 2) return
    z.state = 2
    z.wave = wave
    z.ev = 0
    if (holding.get(z.note) === z) holding.delete(z.note)
    puff(z.x, z.gy, 6)
  }

  function sinkOldest() {
    let o: Z | null = null
    for (const z of list) if (z.state < 2 && (!o || z.born < o.born)) o = z
    if (o) sink(o, 0)
  }

  function update(z: Z, dt: number, now: number): boolean {
    if (z.state === 0) {
      z.vis = Math.min(1, z.vis + dt / (reduced ? 1200 : 900))
      if (z.vis >= 1) { z.state = 1; z.nextEv = now + 900 + Math.random() * 1200 }
    } else if (z.state === 2) {
      if (z.wave > 0) z.wave -= dt
      else {
        z.vis -= dt / (reduced ? 1000 : 700)
        if (z.vis <= 0) return false
      }
    } else {
      // up
      const dancing = now < z.dUntil
      if (z.kind === 'spicy' && !dancing) {
        if (z.ev === 0 && now >= z.nextEv) { z.ev = Math.random() < 0.5 ? 1 : 2; z.evT = 0 }
        else if (z.ev) {
          z.evT += dt
          if (z.evT >= (z.ev === 1 ? 1500 : 1900) / (reduced ? 0.8 : 1)) { z.ev = 0; z.nextEv = now + 1800 + Math.random() * 2400 }
        }
      }
      if (!dancing && z.ev === 0 && z.kind !== 'tonic') {
        z.x += z.dir * z.spd * dt / 1000
        if (Math.abs(z.x - z.bx) > z.range || z.x < 24 || z.x > W - 24) { z.dir = -z.dir; z.x += z.dir * 2 }
        else if (Math.random() < 0.0015 * dt / 16) z.dir = -z.dir
      }
    }
    return true
  }

  function drawZ(ctx: CanvasRenderingContext2D, z: Z, now: number, q: number) {
    const k = z.k, vis = z.vis
    const ease = (p: number) => p * p * (3 - 2 * p)
    let frame = q < 0.5 ? 1 : WALK[Math.floor(now / (reduced ? 440 : 290) + z.ph) & 3]
    let lift = 0, dxd = 0
    let headUp = 0, headRot = 0, headSx = 1, headSy = 1, headDx = 0
    let tilt = z.dir * 0.05 * mv
    let armPos: { x: number; y: number; r: number } | null = null
    let boing = false
    const rv = vis >= 1 ? 1 : Math.max(0, Math.min(1, (vis - 0.3) / 0.7))
    const bob = Math.sin(now * 0.009 * calm + z.ph) * 2.2 * k * mv * (z.state === 1 ? 1 : 0)
    let bodyTop = -78 * k + bob + (1 - ease(rv)) * 122 * k

    if (z.state === 2 && z.wave > 0) frame = Math.floor(now / 140) & 1 ? 3 : 1
    else if (z.state === 1) {
      const dancing = now < z.dUntil
      if (dancing) {
        const u = (now - z.dStart) / 1600
        if (u < 0.5) { frame = 3; lift = Math.abs(Math.sin(u * Math.PI * 4)) * 11 * k * mv }
        else { dxd = Math.sin((u - 0.5) * Math.PI * 4) * 24 * k * mv; frame = WALK[Math.floor(now / 120) & 3] }
      } else if (z.kind === 'tonic') {
        lift = Math.abs(Math.sin(now * 0.0105 * calm + z.ph)) * 13 * k * mv
        dxd = Math.sin(now * 0.0035 * calm + z.ph) * 6 * k * mv
        if (Math.floor(now / (reduced ? 400 : 260) + z.ph) & 1) frame = 3
      } else if (z.ev === 1) {
        const u = z.evT / (1500 / (reduced ? 0.8 : 1))
        frame = u < 0.9 ? 3 : 1
        if (u < 0.6) {
          const p = u / 0.6
          headUp = 4 * p * (1 - p) * 80 * k * (reduced ? 0.7 : 1)
          headRot = p * TAU * (z.dir || 1)
          headDx = Math.sin(p * Math.PI) * 22 * k * z.dir
        } else if (u < 0.85) {
          const p = (u - 0.6) / 0.25
          headUp = Math.sin(p * Math.PI) * 14 * k * mv
          headSy = 1 - 0.18 * Math.sin(p * Math.PI * 2)
          headSx = 1 + (1 - headSy) * 0.6
        }
        boing = u > 0.5 && u < 0.95
      } else if (z.ev === 2) {
        const u = z.evT / (1900 / (reduced ? 0.8 : 1))
        const sx = -25 * k, sy = bodyTop + 27 * k, rx = -46 * k, ry = -5 * k
        frame = u < 0.85 ? 4 : 1
        if (u < 0.2) {
          const p = u / 0.2
          armPos = { x: sx + (rx - sx) * p, y: sy + (ry - sy) * p - Math.sin(p * Math.PI) * 20 * k, r: p * 7 }
        } else if (u < 0.55) {
          armPos = { x: rx, y: ry - Math.abs(Math.sin(now * 0.012)) * 4 * k * mv, r: Math.sin(now * 0.02) * 0.25 }
        } else if (u < 0.85) {
          const p = ease((u - 0.55) / 0.3)
          armPos = { x: rx + (sx - rx) * p, y: ry + (sy - ry) * p, r: Math.sin(p * Math.PI) * 0.4 }
        }
      }
    }
    // judge moments (only while the zombie is standing up)
    const ease01 = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t) }
    const laughing = z.state === 1 && now >= z.lgStart && now < z.lgUntil
    let mirror = 1
    if (laughing) {
      // point and laugh at the slam: a jiggle, one arm stuck out toward it
      frame = 4
      lift = Math.max(lift, Math.abs(Math.sin(now * 0.022 + z.ph)) * 6 * k * mv)
      tilt += Math.sin(now * 0.018 + z.ph) * 0.08 * mv
      mirror = z.lgX > z.x ? -1 : 1
    }
    if (z.state === 1 && now >= z.bowStart && now < z.bowUntil) {
      const u = (now - z.bowStart) / (z.bowUntil - z.bowStart)
      tilt += ease01(u / 0.35) * (1 - ease01((u - 0.65) / 0.35)) * 0.6 * (z.dir || 1) * mv
    }
    let sx = 1, sy = 1, flat = false
    if (now >= z.flatStart && now < z.flatUntil) {
      // pancake: squash flat, stay, then boing back up
      const t = now - z.flatStart
      if (t < 130) { const p = t / 130; sy = 1 - 0.8 * p * p; sx = 1 + 0.55 * p; flat = true }
      else if (t < 950) { sy = 0.2 + Math.sin(t * 0.03) * 0.012; sx = 1.55; flat = true }
      else { const p = Math.min(1, (t - 950) / 400), u = p - 1; sy = 0.2 + 0.8 * (1 + 2.70158 * u * u * u + 1.70158 * u * u); sx = 1.55 - 0.55 * p }
    }
    if (z.kind === 'spicy' && z.state === 1) tilt += Math.sin(now * 0.007 * calm + z.ph) * 0.14 * mv
    bodyTop -= lift
    if (laughing) armPos = { x: -30 * k, y: bodyTop + 30 * k, r: Math.PI + 0.25 + Math.sin(now * 0.03 + z.ph) * 0.1 }

    // dirt mound under the zombie
    ctx.globalAlpha = 0.35 + 0.55 * (1 - vis)
    ctx.drawImage(moundSprite(), z.x - 38 * k, z.gy - 9 * k, 76 * k, 20 * k)

    ctx.save()
    ctx.translate(z.x + dxd, z.gy)
    if (tilt) ctx.rotate(tilt)
    if (mirror !== 1 || sx !== 1 || sy !== 1) ctx.scale(mirror * sx, sy)
    // hands poke out first
    if (vis < 0.55) {
      const hp = Math.min(1, vis / 0.3)
      ctx.globalAlpha = vis < 0.3 ? 1 : (0.55 - vis) / 0.25
      const wob = Math.sin(now * 0.02 * calm + z.ph) * 2 * k * mv
      stamp(ctx, handsSprite(z.skin), BW, 40, -48 * k + wob, -ease(hp) * 38 * k, k)
    }
    ctx.globalAlpha = 1
    if (rv > 0) {
      stamp(ctx, bodySprite(z.skin, z.hb, frame), BW, BH, -48 * k, bodyTop, k)
      const neckY = bodyTop + 24 * k
      const hb = Math.sin(now * 0.0125 * calm + z.ph) * 1.2 * k * mv * (z.state === 1 ? 1 : 0)
      const head = headSprite(z.skin, z.extra)
      if (headRot === 0 && headSx === 1 && headSy === 1 && headUp === 0) {
        stamp(ctx, head, HW, HH, -28 * k, neckY - 62 * k + hb, k)
      } else {
        ctx.save()
        ctx.translate(headDx, neckY - 16 * k - headUp)
        ctx.rotate(headRot)
        ctx.scale(headSx, headSy)
        ctx.drawImage(head, -28 * k, -46 * k, HW * k, HH * k)
        ctx.restore()
      }
      z.tx = z.x + dxd
      z.ty = z.gy + neckY - 44 * k
      z.bOn = vis > 0.8
      if (armPos) {
        ctx.save()
        ctx.translate(armPos.x, armPos.y)
        ctx.rotate(armPos.r)
        ctx.drawImage(armSprite(z.skin, z.hb), -24 * k, -9 * k, 48 * k, 18 * k)
        ctx.restore()
      }
      if (z.kind === 'tonic' && q >= 0.4) {
        const star = starSprite()
        const n = q < 0.5 ? 1 : 3
        for (let i = 0; i < n; i++) {
          const a = now * 0.0018 * calm + i * 2.09 + z.ph
          const tw = 0.5 + 0.5 * Math.sin(now * 0.006 + i * 2 + z.ph)
          const sz = (10 + 12 * tw) * k * 1.3
          ctx.globalAlpha = 0.35 + 0.6 * tw
          ctx.drawImage(star, Math.cos(a) * 42 * k - sz / 2, bodyTop + (-12 + Math.sin(a) * 30) * k - sz / 2, sz, sz)
        }
        ctx.globalAlpha = 1
      }
    }
    ctx.restore()
    if (flat && q >= 0.4) {
      // seeing stars
      const star = starSprite()
      for (let i = 0; i < 3; i++) {
        const a = now * 0.006 + i * 2.09
        const sz = 15 * k * 1.3
        ctx.globalAlpha = 0.9
        ctx.drawImage(star, z.x + Math.cos(a) * 34 * k - sz / 2, z.gy - 22 * k + Math.sin(a) * 7 * k - sz / 2, sz, sz)
      }
      ctx.globalAlpha = 1
    }
    if (z.zapT > 0 && now - z.zapT < 650) {
      // zapped: one lightning bolt from the sky and a golden glow (a single thin bolt, fading over 0.4 s)
      const u = (now - z.zapT) / 650
      const hy = z.gy - 78 * k
      if (u < 0.6) {
        ctx.globalAlpha = 1 - u / 0.6
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(z.x, -8)
        for (let j = 1; j < 7; j++) ctx.lineTo(z.x + Math.sin(j * 7.3 + z.ph * 3) * 16, -8 + ((hy + 8) * j) / 7)
        ctx.lineTo(z.x, hy)
        ctx.strokeStyle = 'rgba(255,226,80,0.55)'
        ctx.lineWidth = 7
        ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,235,0.95)'
        ctx.lineWidth = 2.2
        ctx.stroke()
      }
      const gs = starSprite(), gz = 90 * k * (0.6 + 0.4 * u)
      ctx.globalAlpha = (1 - u) * 0.85
      ctx.drawImage(gs, z.x - gz / 2, hy - gz / 2, gz, gz)
      ctx.globalAlpha = 1
    }
    if (boing) {
      const t = textSprite('BOING!', 1)
      ctx.globalAlpha = 0.95
      ctx.drawImage(t.c, z.x + dxd - t.w * 0.25, z.gy + bodyTop - 76 * k, t.w * 0.5, t.h * 0.5)
      ctx.globalAlpha = 1
    }
  }

  const scene: Scene = {
    ownBackdrop: true,
    resize(w, h) {
      W = w; H = h
      bg = null
    },
    noteOn(note, x, v, kind, hue, name, g?: NoteGrade) {
      if (g?.cluster === 'fizzle') { puff(Math.max(24, Math.min(W - 24, x)), H * 0.88, 2); return } // no zombie for a fizzle: the crowd laughs instead
      const old = holding.get(note)
      if (old) sink(old, 250)
      const cap = zcap(curQ)
      let active = 0
      for (const z of list) if (z.state < 2) active++
      if (active >= cap) sinkOldest()
      if (list.length >= cap + 10) return
      const ds = Math.random()
      const gy = H * (0.8 + ds * 0.12)
      const depth = 0.88 + ds * 0.24
      const kScale = (0.8 + v * 0.5) * depth * s0() * (kind === 'tonic' ? 1.15 : 1)
      const skin = Math.floor(Math.random() * 3)
      const opts = [`${name}… brains…`, `${name}…`, `brains… ${name}`]
      const z: Z = {
        note, x: Math.max(24, Math.min(W - 24, x)), bx: x, gy, k: kScale,
        skin, hb: ((Math.round(hue / 60) % 6) + 6) % 6, extra: kind === 'tonic' ? 3 : Math.floor(Math.random() * 3), kind,
        ph: Math.random() * TAU, born: lastNow, state: 0, vis: 0, wave: 0,
        dir: Math.random() < 0.5 ? -1 : 1, spd: (10 + Math.random() * 10) * s0() * mv, range: 60 + Math.random() * 50,
        ev: 0, evT: 0, nextEv: lastNow + 1500 + Math.random() * 1500, dStart: 0, dUntil: 0,
        lgStart: 0, lgUntil: 0, lgX: 0, lgTxt: null, flatStart: 0, flatUntil: 0, bowStart: 0, bowUntil: 0, zapT: 0,
        text: textSprite(opts[Math.floor(Math.random() * opts.length)]), tx: x, ty: gy, bOn: false,
      }
      z.bx = z.x
      if (g?.cluster === 'boom' && lastNow - boomT < 600) { z.flatStart = boomT; z.flatUntil = boomT + 1350 } // the rest of the slam also gets flattened
      holding.set(note, z)
      list.push(z)
      puff(z.x, z.gy, 10)
    },
    noteOff(note) {
      const z = holding.get(note)
      if (!z) return
      holding.delete(note)
      sink(z, z.vis > 0.6 ? 450 : 0)
    },
    react(ev: SceneReact) {
      const now = lastNow
      if (ev.type === 'fizzle') {
        // undo the zombies the slam's first notes raised, then everybody points and laughs (gently: it's a funny sound, not a shaming one)
        const set = new Set(ev.notes)
        for (const z of list) if (z.state < 2 && set.has(z.note) && now - z.born < 320) sink(z, 0)
        const tx = ev.xs.reduce((a, b) => a + b, 0) / Math.max(1, ev.xs.length)
        let k = 0
        for (const z of list) {
          if (z.state === 2) continue
          z.lgStart = now + (k % 6) * 80 + Math.random() * 100
          z.lgUntil = z.lgStart + 1900
          z.lgX = tx
          z.lgTxt = k % 2 === 0 && k < 6 ? textSprite(LAUGHS[Math.floor(Math.random() * LAUGHS.length)], 1) : null
          z.ev = 0
          z.nextEv = z.lgUntil + 600
          k++
        }
      } else if (ev.type === 'boom') {
        // every zombie is flattened like a pancake, then pops back up
        boomT = now
        for (const z of list) {
          if (z.state === 2) continue
          z.flatStart = now + Math.random() * 60
          z.flatUntil = z.flatStart + 1350
          z.ev = 0
          z.nextEv = z.flatUntil + 600
          puff(z.x, z.gy, 3)
        }
        bubble = { x: ev.xs.reduce((a, b) => a + b, 0) / Math.max(1, ev.xs.length), t0: now, txt: '💥 SPLAT!' }
      } else if (ev.type === 'resolve') {
        // one zombie is zapped and starts to dance
        let z = holding.get(ev.note) ?? null
        if (!z) for (const q of list) if (q.state < 2 && (!z || Math.abs(q.x - ev.x) < Math.abs(z.x - ev.x))) z = q
        if (!z) return
        z.zapT = now
        z.dStart = now + 700
        z.dUntil = z.dStart + 2300
        z.ev = 0
        puff(z.x, z.gy, 5)
      } else if (ev.type === 'cadence') {
        // the whole graveyard bows, a wave starting at the home note's lane
        for (const z of list) {
          if (z.state === 2) continue
          z.bowStart = now + (Math.abs(z.x - ev.x) / Math.max(1, W)) * 500
          z.bowUntil = z.bowStart + 1500
        }
        bubble = { x: ev.x, t0: now, txt: '👏 Bravo!' }
      }
    },
    chord(xs) {
      const t = lastNow
      for (const z of list) {
        if (z.state === 2) continue
        z.dStart = t
        z.dUntil = t + 1600
        z.ev = 0
        z.nextEv = t + 2400
      }
      if (xs.length) bubble = { x: xs.reduce((a, b) => a + b, 0) / xs.length, t0: t, txt: '🧟 DANCE!' }
    },
    clear() {
      list.length = 0
      holding.clear()
      dirt.length = 0
    },
    drawBackdrop(ctx, now) {
      if (!W || !H) return
      const gA = ctx.globalAlpha, gC = ctx.globalCompositeOperation
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      bg = bg ?? buildBackdrop(W, H)
      ctx.drawImage(bg, 0, 0, W, H)
      fog = fog ?? fogSprite()
      const t = now / 1000
      ctx.globalAlpha = 0.32
      for (const [yf, sp, off, sc] of FOGS) {
        const bw = 320 * sc * Math.max(1, W / 700), bh = 80 * sc * 1.6
        const span = W + bw
        const x = ((t * sp * calm + off * span) % span) - bw
        ctx.drawImage(fog, x, H * yf - bh / 2, bw, bh)
      }
      ctx.globalAlpha = gA
      ctx.globalCompositeOperation = gC
    },
    draw(ctx, now, quality) {
      curQ = quality
      const dt = lastT ? Math.min(50, Math.max(0, now - lastT)) : 16
      lastT = now
      lastNow = now
      const gA = ctx.globalAlpha, gC = ctx.globalCompositeOperation
      ctx.globalCompositeOperation = 'source-over'
      // update zombies (swap-remove)
      let active = 0
      for (let i = list.length - 1; i >= 0; i--) {
        const z = list[i]
        if (!update(z, dt, now)) { list[i] = list[list.length - 1]; list.pop(); continue }
        if (z.state < 2) active++
      }
      if (active > zcap(quality)) sinkOldest()
      // update dirt
      const ds = dt / 1000
      for (let i = dirt.length - 1; i >= 0; i--) {
        const p = dirt[i]
        p.life -= dt
        p.vy += 700 * ds
        p.x += p.vx * ds
        p.y += p.vy * ds
        if (p.life <= 0 || (p.vy > 0 && p.y >= p.gy)) { dirt[i] = dirt[dirt.length - 1]; dirt.pop() }
      }
      // depth sort (insertion sort, list is small and nearly sorted)
      for (let i = 1; i < list.length; i++) {
        const z = list[i]
        let j = i - 1
        while (j >= 0 && list[j].gy > z.gy) { list[j + 1] = list[j]; j-- }
        list[j + 1] = z
      }
      for (const z of list) drawZ(ctx, z, now, quality)
      // dirt
      let lastC = -1
      for (const p of dirt) {
        if (p.c !== lastC) { ctx.fillStyle = DIRT[p.c]; lastC = p.c }
        ctx.globalAlpha = Math.min(1, p.life / 250)
        ctx.fillRect(p.x, p.y, p.s, p.s)
      }
      // speech bubbles
      if (quality >= 0.5) {
        for (const z of list) {
          if (!z.bOn || z.state === 2 && z.vis < 0.8 || (now >= z.flatStart && now < z.flatUntil)) continue
          const age = now - z.born
          const a = Math.min(1, (2700 - age) / 500)
          if (a <= 0) continue
          ctx.globalAlpha = a * 0.95
          const w = z.text.w * 0.72, h = z.text.h * 0.72
          const bx = Math.max(4, Math.min(W - w - 4, z.tx - w / 2))
          ctx.drawImage(z.text.c, bx, z.ty - h - 2, w, h)
        }
        for (const z of list) {
          if (!z.lgTxt || !z.bOn || now < z.lgStart || now >= z.lgUntil) continue
          const a = Math.min(1, (z.lgUntil - now) / 300, (now - z.lgStart) / 150 + 0.2)
          const w = z.lgTxt.w * 0.72, h = z.lgTxt.h * 0.72
          ctx.globalAlpha = a * 0.95
          ctx.drawImage(z.lgTxt.c, Math.max(4, Math.min(W - w - 4, z.tx - w / 2)), z.ty - h - 6 - Math.abs(Math.sin(now * 0.02 + z.ph)) * 4, w, h)
        }
        const ba = Math.min(1, (1700 - (now - bubble.t0)) / 400)
        if (ba > 0 && bubble.t0 > -1e8) {
          const t = textSprite(bubble.txt, 1)
          const w = t.w * 0.6, h = t.h * 0.6
          ctx.globalAlpha = ba
          ctx.drawImage(t.c, Math.max(4, Math.min(W - w - 4, bubble.x - w / 2)), H * 0.32 - Math.sin((now - bubble.t0) * 0.004) * 4 * mv, w, h)
        }
      }
      ctx.globalAlpha = gA
      ctx.globalCompositeOperation = gC
    },
  }
  return scene
}
