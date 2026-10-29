// Mail mode: every note mails something. An envelope flutters up from the key, pops open, and a big
// LETTER card (the note's name) flies out. Postcards, parcels, stamps and paper planes mix in.
// All art is built once per variant into offscreen canvases and stamped with drawImage.
import type { Scene, SceneFactory, SceneKind, SceneReact } from './scenes'
import type { NoteGrade } from '../../music/judge'

const TAU = 6.283
const GOLD = 12 // hue bucket index meaning "gold"
const FONT = 'system-ui, sans-serif'

const sprites = new Map<string, HTMLCanvasElement>()

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}
function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath()
  g.moveTo(x, y + s * 0.9)
  g.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.35)
  g.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.6, y - s * 0.1, x, y + s * 0.9)
  g.closePath()
}
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rad = i % 2 ? r * 0.45 : r
    g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad)
  }
  g.closePath()
}
const bucketOf = (hue: number) => (((Math.round(hue / 30) % 12) + 12) % 12)
const hueOf = (b: number) => (b === GOLD ? 46 : b * 30)
const paper = (b: number, l: number) => (b === GOLD ? `hsl(46,95%,${l - 4}%)` : `hsl(${hueOf(b)},75%,${l}%)`)

function cached(key: string, build: () => HTMLCanvasElement) {
  let c = sprites.get(key)
  if (!c) { c = build(); sprites.set(key, c) }
  return c
}

// kind: 0 normal, 1 tonic (gold + wax seal), 2 spicy (gray, return to sender)
function envSprite(kind: number, b: number) {
  return cached(`e${kind}:${kind === 0 ? b : 0}`, () => {
    const [c, g] = mk(72, 54)
    const gold = kind === 1, gray = kind === 2
    const body = gold ? '#ffd75a' : gray ? '#c3c6cd' : paper(b, 86)
    const dark = gold ? '#e5a91c' : gray ? '#9a9ea8' : paper(b, 66)
    g.shadowColor = 'rgba(0,0,0,0.28)'
    g.shadowBlur = 5
    g.shadowOffsetY = 2
    g.fillStyle = body
    if (gray) {
      g.beginPath()
      g.moveTo(5, 8); g.lineTo(26, 5); g.lineTo(45, 8); g.lineTo(66, 6); g.lineTo(68, 26); g.lineTo(65, 47); g.lineTo(44, 45); g.lineTo(24, 48); g.lineTo(6, 45); g.lineTo(4, 26)
      g.closePath()
    } else rr(g, 4, 6, 64, 42, 4)
    g.fill()
    g.shadowColor = 'transparent'
    g.strokeStyle = dark
    g.lineWidth = 1.6
    g.stroke()
    // flap + side folds
    g.fillStyle = dark
    g.globalAlpha = 0.35
    g.beginPath(); g.moveTo(5, 8); g.lineTo(36, 30); g.lineTo(67, 8); g.closePath(); g.fill()
    g.globalAlpha = 1
    g.beginPath()
    g.moveTo(5, 46); g.lineTo(28, 24); g.moveTo(67, 46); g.lineTo(44, 24)
    g.moveTo(5, 8); g.lineTo(36, 30); g.lineTo(67, 8)
    g.stroke()
    if (gray) {
      g.strokeStyle = 'rgba(80,84,96,0.45)'
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(14, 12); g.lineTo(20, 20); g.lineTo(15, 30)
      g.moveTo(56, 40); g.lineTo(50, 34); g.lineTo(58, 28)
      g.stroke()
    } else {
      // postage stamp, top-right
      g.fillStyle = '#fff'
      g.fillRect(50, 10, 14, 17)
      g.setLineDash([2, 2])
      g.strokeStyle = dark
      g.lineWidth = 1
      g.strokeRect(50.5, 10.5, 13, 16)
      g.setLineDash([])
      g.fillStyle = gold ? '#e0568a' : `hsl(${(hueOf(b) + 150) % 360},70%,60%)`
      g.fillRect(53, 13, 8, 11)
      g.fillStyle = 'rgba(255,255,255,0.8)'
      g.beginPath(); g.arc(57, 18, 2, 0, TAU); g.fill()
    }
    // seal
    if (gray) {
      g.save()
      g.translate(34, 35)
      g.rotate(-0.22)
      g.fillStyle = 'rgba(255,255,255,0.55)'
      g.fillRect(-23, -8, 46, 16)
      g.strokeStyle = 'rgba(205,45,45,0.9)'
      g.lineWidth = 1.6
      g.strokeRect(-22, -7, 44, 14)
      g.fillStyle = 'rgba(205,45,45,0.95)'
      g.font = `700 6.5px ${FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('RETURN', 0, -2.6)
      g.fillText('TO SENDER', 0, 3.6)
      g.restore()
    } else {
      g.fillStyle = gold ? '#c0272d' : '#e8334a'
      g.shadowColor = 'rgba(0,0,0,0.3)'
      g.shadowBlur = 3
      g.beginPath(); g.arc(36, 30, gold ? 8 : 6.5, 0, TAU); g.fill()
      g.shadowColor = 'transparent'
      g.fillStyle = gold ? '#ffd75a' : '#fff'
      if (gold || b % 2) { star(g, 36, 30, gold ? 5.2 : 4); g.fill() } else { heart(g, 36, 30.5, 2.6); g.fill() }
    }
    return c
  })
}

function cardSprite(letter: string, b: number, kind: number) {
  return cached(`c${kind}:${kind === 2 ? 0 : b}:${letter}`, () => {
    const [c, g] = mk(80, 92)
    const hue = kind === 1 ? 46 : hueOf(b)
    g.shadowColor = 'rgba(0,0,0,0.3)'
    g.shadowBlur = 6
    g.shadowOffsetY = 2
    const grad = g.createLinearGradient(0, 6, 0, 84)
    if (kind === 1) { grad.addColorStop(0, '#fffbe3'); grad.addColorStop(1, '#ffe9a0') }
    else if (kind === 2) { grad.addColorStop(0, '#f1f1f4'); grad.addColorStop(1, '#cfd0d8') }
    else { grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, `hsl(${hue},80%,90%)`) }
    g.fillStyle = grad
    rr(g, 7, 6, 66, 78, 6)
    g.fill()
    g.shadowColor = 'transparent'
    g.strokeStyle = kind === 1 ? '#e5a91c' : kind === 2 ? '#9a9ea8' : `hsl(${hue},70%,75%)`
    g.lineWidth = 2
    g.stroke()
    // ruled lines + fold crease
    g.strokeStyle = 'rgba(80,80,110,0.14)'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(15, 68); g.lineTo(65, 68); g.moveTo(15, 74); g.lineTo(53, 74)
    g.moveTo(7, 30); g.lineTo(73, 30)
    g.stroke()
    // mini stamp
    g.fillStyle = kind === 1 ? '#c0272d' : kind === 2 ? '#8f93a0' : `hsl(${hue},85%,62%)`
    g.fillRect(58, 11, 10, 12)
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.beginPath(); g.arc(63, 17, 2, 0, TAU); g.fill()
    // bubble letter
    g.save()
    g.translate(40, 48)
    if (kind === 2) g.rotate(-0.12)
    g.font = `700 ${letter.length > 1 ? 40 : 54}px ${FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.strokeStyle = '#fff'
    g.lineWidth = 11
    g.strokeText(letter, 0, 2)
    g.strokeStyle = kind === 2 ? '#4b4f5c' : `hsl(${hue},85%,28%)`
    g.lineWidth = 6.5
    g.strokeText(letter, 0, 2)
    g.fillStyle = kind === 2 ? '#aab0c0' : kind === 1 ? '#ffc61a' : `hsl(${hue},95%,60%)`
    g.fillText(letter, 0, 2)
    g.fillStyle = 'rgba(255,255,255,0.45)'
    g.font = `700 ${letter.length > 1 ? 40 : 54}px ${FONT}`
    g.restore()
    if (kind === 1) {
      g.fillStyle = '#ffd23a'
      for (const [x, y, r] of [[14, 16, 4], [70, 78, 3.5], [13, 78, 3]]) { star(g, x, y, r); g.fill() }
    }
    return c
  })
}

function stampSprite(b: number) {
  return cached(`s${b}`, () => {
    const [c, g] = mk(34, 40)
    g.shadowColor = 'rgba(0,0,0,0.25)'
    g.shadowBlur = 3
    g.fillStyle = '#fff'
    g.fillRect(4, 4, 26, 32)
    g.shadowColor = 'transparent'
    // perforated edge
    g.globalCompositeOperation = 'destination-out'
    for (let x = 6; x < 30; x += 5) { g.beginPath(); g.arc(x, 4, 1.6, 0, TAU); g.arc(x, 36, 1.6, 0, TAU); g.fill() }
    for (let y = 8; y < 34; y += 5) { g.beginPath(); g.arc(4, y, 1.6, 0, TAU); g.arc(30, y, 1.6, 0, TAU); g.fill() }
    g.globalCompositeOperation = 'source-over'
    g.fillStyle = paper(b, 62)
    g.fillRect(8, 8, 18, 24)
    g.fillStyle = 'rgba(255,255,255,0.85)'
    if (b % 2) { star(g, 17, 18, 6); g.fill() } else { heart(g, 17, 18, 4); g.fill() }
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.fillRect(11, 27, 12, 2)
    return c
  })
}

function postcardSprite(b: number) {
  return cached(`p${b}`, () => {
    const [c, g] = mk(72, 50)
    g.shadowColor = 'rgba(0,0,0,0.25)'
    g.shadowBlur = 4
    g.fillStyle = '#fffaf0'
    rr(g, 4, 4, 64, 42, 3)
    g.fill()
    g.shadowColor = 'transparent'
    g.strokeStyle = 'rgba(0,0,0,0.12)'
    g.stroke()
    // picture side: sky, sun, hill
    g.fillStyle = paper(b, 78)
    g.fillRect(8, 8, 30, 34)
    g.fillStyle = '#ffe36a'
    g.beginPath(); g.arc(28, 18, 5, 0, TAU); g.fill()
    g.fillStyle = paper((b + 4) % 12, 55)
    g.beginPath(); g.moveTo(8, 42); g.quadraticCurveTo(20, 24, 38, 42); g.closePath(); g.fill()
    // address lines + stamp
    g.strokeStyle = 'rgba(60,60,90,0.35)'
    g.lineWidth = 1
    g.beginPath()
    for (let y = 28; y <= 40; y += 5) { g.moveTo(43, y); g.lineTo(63, y) }
    g.stroke()
    g.fillStyle = paper((b + 6) % 12, 65)
    g.fillRect(53, 9, 10, 12)
    g.strokeStyle = '#fff'
    g.setLineDash([1.5, 1.5])
    g.strokeRect(53.5, 9.5, 9, 11)
    return c
  })
}

function parcelSprite(b: number) {
  return cached(`k${b}`, () => {
    const [c, g] = mk(56, 52)
    g.shadowColor = 'rgba(0,0,0,0.28)'
    g.shadowBlur = 4
    g.fillStyle = '#d9a566'
    rr(g, 5, 8, 46, 38, 4)
    g.fill()
    g.shadowColor = 'transparent'
    g.fillStyle = 'rgba(255,255,255,0.18)'
    g.fillRect(5, 8, 46, 8)
    // string cross + bow
    g.strokeStyle = '#7b4a24'
    g.lineWidth = 2
    g.beginPath(); g.moveTo(28, 8); g.lineTo(28, 46); g.moveTo(5, 28); g.lineTo(51, 28); g.stroke()
    g.beginPath()
    g.moveTo(28, 27); g.quadraticCurveTo(14, 12, 20, 20); g.moveTo(28, 27); g.quadraticCurveTo(42, 12, 36, 20)
    g.stroke()
    // label
    g.fillStyle = '#fff'
    g.fillRect(32, 32, 16, 10)
    g.fillStyle = paper(b, 55)
    g.fillRect(34, 34, 5, 6)
    return c
  })
}

function planeSprite(b: number) {
  return cached(`a${b}`, () => {
    const [c, g] = mk(64, 40)
    g.shadowColor = 'rgba(0,0,0,0.22)'
    g.shadowBlur = 3
    g.fillStyle = '#fdfdff'
    g.beginPath(); g.moveTo(60, 20); g.lineTo(5, 6); g.lineTo(20, 20); g.closePath(); g.fill()
    g.shadowColor = 'transparent'
    g.fillStyle = paper(b, 82)
    g.beginPath(); g.moveTo(60, 20); g.lineTo(20, 20); g.lineTo(26, 32); g.closePath(); g.fill()
    g.fillStyle = paper(b, 68)
    g.beginPath(); g.moveTo(20, 20); g.lineTo(5, 6); g.lineTo(26, 32); g.closePath(); g.fill()
    g.strokeStyle = 'rgba(70,70,110,0.35)'
    g.lineWidth = 1
    g.beginPath(); g.moveTo(60, 20); g.lineTo(20, 20); g.stroke()
    return c
  })
}

// Fizzle: crumpled gray junk mail (a paper ball, an ad flyer) spills out. All gray, a bit funny, never scary.
function junkSprite(v: number) {
  return cached(`j${v}`, () => {
    if (v === 0) {
      const [c, g] = mk(48, 48)
      g.shadowColor = 'rgba(0,0,0,0.25)'
      g.shadowBlur = 4
      const gr = g.createRadialGradient(20, 18, 2, 24, 24, 22)
      gr.addColorStop(0, '#eceef2')
      gr.addColorStop(1, '#a3a8b4')
      g.fillStyle = gr
      g.beginPath()
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU, r = i % 2 ? 15 : 20 + (i % 3)
        g.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r)
      }
      g.closePath()
      g.fill()
      g.shadowColor = 'transparent'
      g.strokeStyle = 'rgba(70,76,92,0.45)'
      g.lineWidth = 1.2
      g.beginPath()
      g.moveTo(10, 20); g.lineTo(22, 26); g.lineTo(16, 36)
      g.moveTo(30, 12); g.lineTo(28, 24); g.lineTo(38, 28)
      g.moveTo(20, 10); g.lineTo(26, 16)
      g.stroke()
      return c
    }
    const [c, g] = mk(56, 66)
    g.shadowColor = 'rgba(0,0,0,0.25)'
    g.shadowBlur = 4
    g.fillStyle = '#d9dce3'
    g.beginPath()
    g.moveTo(6, 6); g.lineTo(46, 4); g.lineTo(50, 60); g.lineTo(26, 56); g.lineTo(6, 60)
    g.closePath()
    g.fill()
    g.shadowColor = 'transparent'
    g.fillStyle = '#9fa5b3'
    g.beginPath(); g.moveTo(34, 57); g.lineTo(50, 60); g.lineTo(47, 44); g.closePath(); g.fill() // bent corner
    g.fillStyle = '#6f7686'
    g.font = `800 15px ${FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(v === 1 ? 'SALE!' : 'JUNK', 28, 20)
    g.font = `700 8px ${FONT}`
    g.fillText(v === 1 ? '50% OFF' : 'MAIL', 28, 33)
    g.fillStyle = 'rgba(80,86,102,0.35)'
    for (let y = 40; y <= 52; y += 5) g.fillRect(10, y, 28, 2)
    return c
  })
}

// BOOM: an overstuffed mailbag that rises, shakes, and bursts.
function bagSprite() {
  return cached('bag', () => {
    const [c, g] = mk(96, 104)
    g.shadowColor = 'rgba(0,0,0,0.3)'
    g.shadowBlur = 6
    g.shadowOffsetY = 3
    const gr = g.createLinearGradient(0, 20, 0, 100)
    gr.addColorStop(0, '#c99a5e')
    gr.addColorStop(1, '#8e6334')
    g.fillStyle = gr
    g.beginPath()
    g.moveTo(34, 24)
    g.bezierCurveTo(10, 36, 4, 70, 18, 90)
    g.quadraticCurveTo(48, 102, 78, 90)
    g.bezierCurveTo(92, 70, 86, 36, 62, 24)
    g.closePath()
    g.fill()
    g.shadowColor = 'transparent'
    // neck puff + rope
    g.fillStyle = '#b6864c'
    g.beginPath(); g.moveTo(34, 24); g.quadraticCurveTo(20, 10, 30, 2); g.quadraticCurveTo(48, 12, 66, 2); g.quadraticCurveTo(76, 10, 62, 24); g.closePath(); g.fill()
    g.strokeStyle = '#5b3b1c'
    g.lineWidth = 4
    g.lineCap = 'round'
    g.beginPath(); g.moveTo(33, 24); g.quadraticCurveTo(48, 30, 63, 24); g.stroke()
    g.lineWidth = 2.5
    g.beginPath(); g.moveTo(48, 28); g.quadraticCurveTo(40, 40, 36, 38); g.moveTo(48, 28); g.quadraticCurveTo(58, 42, 62, 38); g.stroke()
    // stitches + patch
    g.strokeStyle = 'rgba(70,44,20,0.55)'
    g.lineWidth = 1.5
    g.setLineDash([4, 3])
    g.beginPath(); g.moveTo(22, 80); g.quadraticCurveTo(48, 92, 74, 80); g.stroke()
    g.setLineDash([])
    g.fillStyle = '#fffdf5'
    rr(g, 26, 48, 44, 24, 4)
    g.fill()
    g.strokeStyle = '#d33c4c'
    g.lineWidth = 2
    g.stroke()
    g.fillStyle = '#d33c4c'
    g.font = `800 17px ${FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('MAIL', 48, 61)
    // a letter peeking out
    g.fillStyle = '#fff'
    g.save(); g.translate(40, 8); g.rotate(-0.25); g.fillRect(-9, -7, 18, 12); g.strokeStyle = '#e8334a'; g.lineWidth = 1; g.strokeRect(-9, -7, 18, 12); g.restore()
    return c
  })
}

interface Item {
  ty: 0 | 1 | 2 | 3 | 4 // 0 envelope rising, 1 letter, 2 ballistic, 3 flutter, 4 the BOOM mailbag
  /** performance.now() at spawn: lets a late 'fizzle' event undo what a slam's first notes already sent */
  born: number
  junk: boolean
  spr: HTMLCanvasElement
  w: number
  x: number; y: number; bx: number; y0: number
  vx: number; vy: number; g: number
  rot: number; vr: number
  ph: number; sway: number
  age: number; max: number; delay: number
  note: number; held: boolean
  hoverY: number; dur: number; wob: number; rel: number
  aim: boolean; spicy: boolean
  // pop data
  env: HTMLCanvasElement | null; card: HTMLCanvasElement | null
  gold: boolean; bucket: number
}

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)
const easeBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1, u = x - 1; return 1 + c3 * u * u * u + c1 * u * u }

export const createMail: SceneFactory = (reduced): Scene => {
  const calm = reduced ? 0.5 : 1 // count scale
  const sp = reduced ? 0.6 : 1 // speed scale
  const rotK = reduced ? 0.35 : 1 // rotation scale
  const list: Item[] = []
  const holding = new Map<number, Item>()
  let W = 800, H = 600
  let curQ = 1
  let lastChord = 0

  const cap = (q: number) => Math.round(80 * calm * Math.max(0.35, Math.min(1, q)))
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)
  const rb = () => (Math.random() * 12) | 0

  function blank(spr: HTMLCanvasElement, w: number): Item {
    return {
      ty: 2, born: performance.now(), junk: false, spr, w, x: 0, y: 0, bx: 0, y0: 0, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, ph: Math.random() * TAU, sway: 0,
      age: 0, max: 200, delay: 0, note: -1, held: false, hoverY: 0, dur: 40, wob: 0, rel: 0, aim: false, spicy: false,
      env: null, card: null, gold: false, bucket: 0,
    }
  }
  // make room for a priority item by dropping one decorative piece; false if full of important stuff
  function room(): boolean {
    if (list.length < cap(curQ)) return true
    for (let i = 0; i < list.length; i++) {
      if (list[i].ty >= 2) { list[i] = list[list.length - 1]; list.pop(); return true }
    }
    return false
  }
  const roomMisc = (frac: number) => list.length < cap(curQ) * frac

  function spawnStamp(x: number, y: number, b: number, w: number, delay = 0) {
    const s = blank(stampSprite(b), w)
    s.ty = 3
    s.bx = x; s.x = x; s.y = y
    s.vy = rnd(0.9, 1.7) * sp
    s.sway = rnd(18, 40)
    s.max = 700
    s.delay = delay
    list.push(s)
  }
  function spawnPlane(x: number, y: number, dir: number, b: number, delay = 0) {
    const p = blank(planeSprite(b), rnd(44, 58))
    p.x = x; p.y = y
    p.vx = dir * rnd(2.6, 3.8) * sp
    p.vy = rnd(-2.0, -0.6) * sp
    p.g = 0.012 * sp
    p.aim = true
    p.max = 260
    p.delay = delay
    list.push(p)
  }
  function spawnBurst(x: number, y: number, n: number, gold: boolean) {
    for (let i = 0; i < n && list.length < cap(curQ); i++) {
      const s = blank(stampSprite(gold ? GOLD : rb()), rnd(13, 19))
      const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05)
      const v = rnd(2, 5) * sp
      s.x = x; s.y = y
      s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v
      s.g = 0.13 * sp
      s.vr = rnd(-0.15, 0.15) * rotK
      s.rot = rnd(0, TAU)
      s.max = Math.round(rnd(45, 70) / sp)
      list.push(s)
    }
  }

  function pop(o: Item, x: number, y: number) {
    // the empty envelope tumbles away
    if (o.env) {
      const e = blank(o.env, o.w)
      e.x = x; e.y = y; e.rot = o.rot
      e.vx = rnd(-1.2, 1.2) * sp; e.vy = -1.2 * sp; e.g = 0.11 * sp
      e.vr = rnd(-0.07, 0.07) * rotK
      e.max = Math.round(70 / sp)
      if (list.length < cap(curQ) + 2) list.push(e)
    }
    spawnBurst(x, y, Math.round((o.gold ? 9 : 5) * calm), o.gold)
    o.ty = 1
    o.spr = o.card!
    o.w = o.w * 1.15
    o.y0 = y
    o.bx = x
    o.age = 0
    o.rot = 0
  }

  /** a fizzle: junk mail pops out of the lane, tumbles, and falls (capped, so mashing can't flood the screen) */
  function junkSpill(x: number, n: number) {
    let junk = 0
    for (const o of list) if (o.junk) junk++
    for (let i = 0; i < n && junk < 36 * calm && list.length < cap(curQ) + 30; i++, junk++) {
      const j = blank(junkSprite(Math.floor(Math.random() * 3)), rnd(30, 46))
      j.junk = true
      j.x = x + rnd(-18, 18); j.y = H - 10
      j.vx = rnd(-2.4, 2.4) * sp; j.vy = -rnd(4.5, 8.5) * sp; j.g = 0.2 * sp * sp
      j.rot = rnd(0, TAU); j.vr = rnd(-0.2, 0.2) * rotK
      j.max = Math.round(150 / sp)
      list.push(j)
    }
  }
  /** BOOM: the bag bursts into letters, cards, parcels, stamps and planes */
  function bagBurst(x: number, y: number) {
    const total = Math.round(46 * calm)
    const room = Math.max(0, cap(curQ) + 80 - list.length)
    for (let i = 0; i < Math.min(total, room); i++) {
      const r = Math.random()
      let o: Item
      const b = rb()
      if (r < 0.3) o = blank(envSprite(0, b), rnd(46, 62))
      else if (r < 0.5) o = blank(cardSprite('ABCDEFG'[(Math.random() * 7) | 0], b, r < 0.38 ? 1 : 0), rnd(48, 64))
      else if (r < 0.65) o = blank(postcardSprite(b), rnd(50, 64))
      else if (r < 0.77) o = blank(parcelSprite(b), rnd(36, 48))
      else if (r < 0.85) o = blank(planeSprite(b), rnd(44, 56))
      else o = blank(stampSprite(r < 0.93 ? GOLD : b), rnd(18, 28))
      const a = rnd(-Math.PI * 0.97, -Math.PI * 0.03)
      const v = rnd(4.5, 11) * sp
      o.x = x + rnd(-10, 10); o.y = y + rnd(-10, 10)
      o.vx = Math.cos(a) * v; o.vy = Math.sin(a) * v
      o.g = 0.17 * sp * sp
      o.rot = rnd(0, TAU); o.vr = rnd(-0.16, 0.16) * rotK
      o.max = Math.round(rnd(110, 170) / sp)
      list.push(o)
    }
    spawnBurst(x, y, Math.round(14 * calm), true)
  }

  return {
    ownBackdrop: false,
    resize(w, h) { W = w; H = h },
    react(ev: SceneReact) {
      if (ev.type === 'fizzle') {
        // undo the envelopes the slam's first notes already sent, and spill junk instead
        const now = performance.now()
        for (let i = list.length - 1; i >= 0; i--) {
          const o = list[i]
          if (o.ty <= 1 && o.note >= 0 && ev.notes.includes(o.note) && now - o.born < 260) {
            if (holding.get(o.note) === o) holding.delete(o.note)
            list[i] = list[list.length - 1]
            list.pop()
          }
        }
        for (const x of ev.xs.slice(0, 3)) junkSpill(x, 2)
      } else if (ev.type === 'boom') {
        const cx = ev.xs.reduce((a, b) => a + b, 0) / Math.max(1, ev.xs.length)
        const bag = blank(bagSprite(), 118)
        bag.ty = 4
        bag.bx = cx; bag.x = cx
        bag.y0 = H + 70; bag.y = bag.y0
        bag.hoverY = H * 0.55
        bag.max = 100000
        list.push(bag)
      }
    },
    noteOn(note, x, v, kind: SceneKind, hue, name, g?: NoteGrade) {
      if (g?.cluster === 'fizzle') { junkSpill(x, 2); return }
      if (g?.cluster === 'boom') { if (roomMisc(0.9)) spawnBurst(x, H - 30, Math.round(5 * calm), true); return }
      if (!room()) return
      const b = bucketOf(hue)
      const k = kind === 'tonic' ? 1 : kind === 'spicy' ? 2 : 0
      const big = k === 1 ? 1.35 : 1
      const o = blank(envSprite(k, b), (58 + v * 18) * big)
      o.ty = 0
      o.env = o.spr
      o.card = cardSprite(name, b, k)
      o.gold = k === 1
      o.spicy = k === 2
      o.bucket = b
      o.bx = x; o.x = x
      o.y0 = H + 30; o.y = o.y0
      o.hoverY = Math.max(130, H * (0.62 - v * 0.2) + rnd(-12, 12))
      o.dur = Math.round((k === 2 ? 52 : 40) / sp)
      o.wob = k === 2 ? Math.round(26 / sp) : 0
      o.sway = rnd(10, 22) * (k === 2 ? 1.5 : 1)
      o.note = note
      o.held = true
      o.max = 100000
      const old = holding.get(note)
      if (old) old.held = false
      holding.set(note, o)
      list.push(o)
      // other mail, mixed in
      if (roomMisc(0.8) && Math.random() < 0.6 * (reduced ? 0.7 : 1)) {
        const r = Math.random()
        if (r < 0.45) {
          spawnStamp(x + rnd(-120, 120), rnd(-10, H * 0.3), k === 1 ? GOLD : rb(), rnd(22, 32))
        } else if (r < 0.7) {
          const p = blank(postcardSprite(rb()), rnd(54, 68))
          p.x = x; p.y = H + 10
          p.vx = rnd(-1.6, 1.6) * sp; p.vy = -rnd(6.5, 9) * sp; p.g = 0.14 * sp * sp
          p.vr = rnd(-0.05, 0.05) * rotK
          p.max = Math.round(170 / sp)
          list.push(p)
        } else if (r < 0.87) {
          const p = blank(parcelSprite(rb()), rnd(38, 50))
          p.x = x; p.y = H + 10
          p.vx = rnd(-1.4, 1.4) * sp; p.vy = -rnd(6, 8.5) * sp; p.g = 0.14 * sp * sp
          p.vr = rnd(-0.04, 0.04) * rotK
          p.max = Math.round(170 / sp)
          list.push(p)
        } else {
          spawnPlane(x, H - 20, Math.random() < 0.5 ? -1 : 1, rb())
        }
      }
      if (k === 1) {
        const n = Math.round(3 * calm)
        for (let i = 0; i < n && roomMisc(0.9); i++) spawnStamp(x + rnd(-90, 90), rnd(-10, 60), GOLD, rnd(22, 30), i * 8)
      }
    },
    noteOff(note) {
      const o = holding.get(note)
      if (o) o.held = false
      holding.delete(note)
    },
    chord(xs) {
      const now = performance.now()
      if (now - lastChord < 500) return
      lastChord = now
      if (Math.random() < 0.5) {
        // paper-airplane flock
        const dir = Math.random() < 0.5 ? 1 : -1
        const n = Math.round(Math.min(8, xs.length * 2 + 1) * calm)
        const base = H * rnd(0.4, 0.7)
        for (let i = 0; i < n && roomMisc(0.95); i++) {
          spawnPlane(dir > 0 ? -40 : W + 40, base + (i % 3) * 28 - 28 + rnd(-8, 8), dir, rb(), i * 7)
        }
      } else {
        // stamp rain
        const n = Math.round(12 * calm)
        for (let i = 0; i < n && roomMisc(0.95); i++) spawnStamp(rnd(0, W), -20, rb(), rnd(20, 30), (i * 5) | 0)
      }
    },
    clear() {
      list.length = 0
      holding.clear()
    },
    draw(ctx, now, quality) {
      curQ = quality
      const t = now / 1000
      const c = cap(quality)
      const comp = ctx.globalCompositeOperation
      ctx.globalCompositeOperation = 'source-over'
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i]
        if (o.delay > 0) { o.delay--; continue }
        let a = 1, x = o.x, y = o.y, rot = o.rot, w = o.w, flipX = 1
        let dead = false
        if (o.ty === 0) {
          o.age++
          const p = Math.min(1, o.age / o.dur)
          const e = easeOut(p)
          y = o.y0 + (o.hoverY - o.y0) * e
          x = o.bx + Math.sin(o.age * 0.18 * sp + o.ph) * o.sway * (1 - e * 0.5)
          rot = Math.sin(o.age * 0.2 * sp + o.ph) * 0.3 * rotK * (1 - e * 0.6)
          if (o.spicy && p > 0.6) rot += Math.sin(o.age * 0.95) * 0.34 * rotK * (o.age > o.dur ? 1.3 : p)
          a = Math.min(1, o.age / 6)
          if (o.age >= o.dur + o.wob) {
            pop(o, x, y)
            continue
          }
        } else if (o.ty === 1) {
          o.age++
          const tt = Math.min(1, o.age / 16)
          w = o.w * Math.max(0.1, easeBack(tt))
          const baseY = o.hoverY - 34 * easeOut(tt)
          y = baseY + Math.sin(t * 2.2 + o.ph) * 6
          x = o.bx + Math.sin(t * 1.3 * sp + o.ph) * 6
          rot = Math.sin(t * 1.6 + o.ph) * 0.09 * rotK
          if (o.held && o.age > 1800) o.held = false
          if (!o.held) {
            o.rel++
            if (o.rel > 30) {
              const d = o.rel - 30
              y += d * 0.7 * sp
              x += Math.sin(d * 0.12 + o.ph) * 8
              rot += Math.sin(d * 0.15 + o.ph) * 0.2 * rotK
              a = 1 - d / 50
            }
            if (o.rel >= 80) dead = true
          }
        } else if (o.ty === 4) {
          // the BOOM bag: rises (22 frames), shakes harder and swells (22 frames), bursts
          o.age++
          const p1 = Math.min(1, o.age / 22)
          y = o.y0 + (o.hoverY - o.y0) * easeOut(p1)
          x = o.bx
          const sh = o.age > 22 ? (o.age - 22) / 22 : 0
          rot = Math.sin(o.age * 1.15) * 0.18 * sh * rotK
          w = o.w * (1 + 0.3 * sh * sh)
          if (o.age >= 44) { bagBurst(x, y); dead = true }
        } else if (o.ty === 2) {
          o.age++
          o.vy += o.g
          o.x += o.vx; o.y += o.vy
          x = o.x; y = o.y
          if (o.aim) {
            o.vy += Math.sin(t * 3 + o.ph) * 0.02
            if (o.vx < 0) { rot = Math.atan2(-o.vy, -o.vx) * rotK; flipX = -1 } else rot = Math.atan2(o.vy, o.vx) * rotK
          } else { o.rot += o.vr; rot = o.rot }
          if (list.length > c) o.age += 2
          a = Math.min(1, o.age / 6, (o.max - o.age) / 25)
          if (o.age >= o.max || o.y > H + 80 || o.y < -80 || o.x < -90 || o.x > W + 90) dead = true
        } else {
          o.age++
          o.y += o.vy
          if (list.length > c) o.age += 2
          x = o.bx + Math.sin(o.age * 0.045 * sp + o.ph) * o.sway
          rot = Math.sin(o.age * 0.06 * sp + o.ph) * 0.8 * rotK
          if (!reduced) flipX = Math.max(0.3, Math.abs(Math.cos(o.age * 0.07 + o.ph)))
          a = Math.min(1, o.age / 10, (o.max - o.age) / 30)
          y = o.y
          if (o.y > H + 40 || o.age >= o.max) dead = true
        }
        if (dead || a <= 0) {
          if (o.ty === 1 && holding.get(o.note) === o) holding.delete(o.note)
          list[i] = list[list.length - 1]
          list.pop()
          continue
        }
        const h = w * (o.spr.height / o.spr.width)
        ctx.globalAlpha = a > 1 ? 1 : a
        ctx.save()
        ctx.translate(x, y)
        if (rot !== 0) ctx.rotate(rot)
        if (flipX !== 1) ctx.scale(o.aim ? 1 : flipX, o.aim ? flipX : 1)
        ctx.drawImage(o.spr, -w / 2, -h / 2, w, h)
        ctx.restore()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = comp
    },
  }
}
