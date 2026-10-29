// Runway Remix art. Everything is drawn with canvas paths (no images) and built ONCE per look into small
// offscreen layers (legs, arms, torso, head, hat...). The game then just stamps and rotates those layers.
// Figure units: feet at y=0, up is negative, about 200 tall. All fabric and colour comes from the item + palette.
import { BODIES, CATS, MODELS, eraById, optionsOf, palColors, type Colors, type Fabric, type Item, type Look, type Model } from './data'

export interface Layer { c: HTMLCanvasElement; ox: number; oy: number; sc: number }
export interface Figure {
  sc: number; look: Look; sw: number; hw: number
  legL: Layer; legR: Layer; torso: Layer; back: Layer | null; armL: Layer; armR: Layer
  head: Layer; headOops: Layer; headProud: Layer; hat: Layer | null; hatItem: Item | null
}
export interface Pose {
  /** leg lift 0..1 and swing -1..1 for left and right */
  liftL: number; liftR: number; swingL: number; swingR: number
  bob: number; sway: number; arm: number; face: 'happy' | 'oops' | 'proud'
  hatDx: number; hatDy: number; hatRot: number; hatOn: boolean
  /** extra tilt for a wobble (radians) */
  tilt: number
}
export const NEUTRAL: Pose = { liftL: 0, liftR: 0, swingL: 0, swingR: 0, bob: 0, sway: 0, arm: 0, face: 'happy', hatDx: 0, hatDy: 0, hatRot: 0, hatOn: true, tilt: 0 }

const HIP = -92, WAIST = -110, SHO = -148, HEADY = -174, FLOOR = -3, LEGLEN = 84
const TAU = Math.PI * 2
const mk = (w: number, h: number, ox: number, oy: number, sc: number, fn: (g: CanvasRenderingContext2D) => void): Layer => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w * sc)); c.height = Math.max(1, Math.ceil(h * sc))
  const g = c.getContext('2d')!
  g.scale(sc, sc); g.translate(ox, oy)
  g.lineJoin = 'round'; g.lineCap = 'round'
  fn(g)
  return { c, ox: ox * sc, oy: oy * sc, sc }
}
const P = (it: Item | null, k: string, d = 0) => it?.p?.[k] ?? d
const OUT = 'rgba(25,10,35,.5)'
const outline = (g: CanvasRenderingContext2D, w = 1.3) => { g.strokeStyle = OUT; g.lineWidth = w; g.stroke() }
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}
function ell(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU) }

function pick(C: Colors, role: string | undefined): string {
  switch (role) {
    case 'accent': return C.accent
    case 'trim': return C.trim
    case 'dark': return C.dark
    case 'light': return C.light
    case 'white': return C.white
    default: return C.main
  }
}

/** Fill the current path with a colour and a fabric pattern clipped inside it. */
function paint(g: CanvasRenderingContext2D, path: () => void, color: string, fabric: Fabric | undefined, C: Colors, box: [number, number, number, number], line = true) {
  path(); g.fillStyle = color; g.fill()
  if (fabric && fabric !== 'plain') {
    g.save(); path(); g.clip()
    const [bx, by, bw, bh] = box
    if (fabric === 'brocade') {
      g.fillStyle = C.light; g.globalAlpha = 0.5
      for (let y = by; y < by + bh; y += 9) for (let x = bx + ((Math.round(y / 9) & 1) ? 4.5 : 0); x < bx + bw; x += 9) {
        g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 2.4, y); g.lineTo(x, y + 3); g.lineTo(x - 2.4, y); g.closePath(); g.fill()
      }
      g.fillStyle = C.trim; g.globalAlpha = 0.45
      for (let y = by + 4.5; y < by + bh; y += 9) for (let x = bx + ((Math.round(y / 9) & 1) ? 0 : 4.5); x < bx + bw; x += 9) { g.beginPath(); g.arc(x, y, 1.1, 0, TAU); g.fill() }
    } else if (fabric === 'stripe') {
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 0.9
      for (let x = bx; x < bx + bw; x += 4.2) { g.beginPath(); g.moveTo(x, by); g.lineTo(x, by + bh); g.stroke() }
    } else if (fabric === 'sequin') {
      g.fillStyle = 'rgba(255,255,255,.75)'
      for (let y = by; y < by + bh; y += 5) for (let x = bx + ((Math.round(y / 5) & 1) ? 2.5 : 0); x < bx + bw; x += 5) { g.beginPath(); g.arc(x, y, 0.95, 0, TAU); g.fill() }
      g.fillStyle = C.light; g.globalAlpha = 0.4
      for (let y = by + 2.5; y < by + bh; y += 10) for (let x = bx + 1; x < bx + bw; x += 10) { g.beginPath(); g.arc(x, y, 1.5, 0, TAU); g.fill() }
    } else if (fabric === 'holo') {
      const gr = g.createLinearGradient(bx, by, bx + bw, by + bh)
      gr.addColorStop(0, '#7ff7ff'); gr.addColorStop(0.35, '#ff9bf0'); gr.addColorStop(0.65, '#fff6a0'); gr.addColorStop(1, '#8cffc9')
      g.globalAlpha = 0.7; g.fillStyle = gr; g.fillRect(bx, by, bw, bh)
      g.globalAlpha = 0.3; g.strokeStyle = '#fff'; g.lineWidth = 1.2
      for (let k = -bh; k < bw; k += 10) { g.beginPath(); g.moveTo(bx + k, by + bh); g.lineTo(bx + k + bh, by); g.stroke() }
    } else if (fabric === 'lace') {
      g.fillStyle = 'rgba(255,255,255,.65)'
      for (let y = by; y < by + bh; y += 4) for (let x = bx + ((Math.round(y / 4) & 1) ? 2 : 0); x < bx + bw; x += 4) { g.beginPath(); g.arc(x, y, 1.2, 0, TAU); g.fill() }
    } else if (fabric === 'velvet') {
      const gr = g.createLinearGradient(bx, by, bx + bw, by)
      gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(0.4, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(0,0,0,.3)')
      g.fillStyle = gr; g.fillRect(bx, by, bw, bh)
    }
    g.restore()
  }
  if (line) { path(); outline(g) }
}

// ---------------- body geometry ----------------
const halfAt = (y: number, b: { sw: number; ww: number; hw: number }) =>
  y <= WAIST ? b.sw + (b.ww - b.sw) * Math.max(0, (y - SHO) / (WAIST - SHO)) : b.ww + (b.hw - b.ww) * Math.min(1, (y - WAIST) / (HIP - WAIST))

function torsoShape(g: CanvasRenderingContext2D, b: { sw: number; ww: number; hw: number }, bottom: number, flareBelow = 0, neckLow = 0) {
  const hb = bottom > HIP ? b.hw + (bottom - HIP) * 0.2 + flareBelow : halfAt(bottom, b) + flareBelow
  g.beginPath()
  g.moveTo(-b.sw * 0.38, SHO - 6 + neckLow)
  g.lineTo(-b.sw, SHO + 3); g.lineTo(-b.ww, WAIST)
  if (bottom > WAIST) g.lineTo(-halfAt(Math.min(bottom, HIP), b), Math.min(bottom, HIP))
  if (bottom > HIP) g.lineTo(-hb, bottom)
  if (bottom > HIP) g.lineTo(hb, bottom)
  if (bottom > WAIST) g.lineTo(halfAt(Math.min(bottom, HIP), b), Math.min(bottom, HIP))
  g.lineTo(b.ww, WAIST); g.lineTo(b.sw, SHO + 3); g.lineTo(b.sw * 0.38, SHO - 6 + neckLow)
  g.closePath()
}

// ---------------- the figure ----------------
export function buildFigure(look: Look, sc: number): Figure {
  const era = eraById(look.era)
  const C = palColors(look.pal)
  const model = MODELS[look.model % MODELS.length]
  const b = BODIES[model.body]
  const it = (cat: (typeof CATS)[number]) => optionsOf(era, cat)[look.items[CATS.indexOf(cat)] ?? 0] ?? optionsOf(era, cat)[0]
  const hat = it('hats'), top = it('tops'), bot = it('bottoms'), shoe = it('shoes'), acc = it('acc')
  const skin = model.skin
  const hip = b.hw * 0.5
  const isSkirt = bot.shape === 'skirt'

  // --- legs (pivot at the hip joint) ---
  const mkLeg = (side: -1 | 1) => mk(80, 110, 40, 6, sc, (g) => {
    const wTop = hip + 3.2, wBot = 4
    const legPath = (w0: number, w1: number, len: number) => () => { g.beginPath(); g.moveTo(-w0, 0); g.lineTo(-w1, len); g.lineTo(w1, len); g.lineTo(w0, 0); g.closePath() }
    paint(g, legPath(wTop, wBot, LEGLEN), skin, 'plain', C, [-10, 0, 20, LEGLEN], false)
    if (bot.shape === 'pants' || bot.shape === 'breeches') {
      const br = bot.shape === 'breeches'
      const len = br ? 54 : LEGLEN - 4
      const wide = P(bot, 'wide') ? 6 : P(bot, 'slim') ? -1.5 : 1.5
      const w1 = br ? wTop - 2.4 : wBot + 2 + wide
      paint(g, legPath(wTop + 1.6, w1, len), pick(C, bot.role), bot.fabric, C, [-14, 0, 28, len])
      if (br) { // white stockings + garter
        g.fillStyle = C.white; g.beginPath(); g.moveTo(-w1 + 0.6, len); g.lineTo(-wBot, LEGLEN); g.lineTo(wBot, LEGLEN); g.lineTo(w1 - 0.6, len); g.closePath(); g.fill()
        g.fillStyle = C.trim; g.fillRect(-w1, len - 3, w1 * 2, 3)
      }
    }
    drawShoe(g, shoe, C, side)
    if (shoe.shape === 'boot') { /* boot shaft is drawn inside drawShoe */ }
  })
  const legL = mkLeg(-1), legR = mkLeg(1)

  // --- arms (pivot at the shoulder) ---
  const sleeveLen = top.shape === 'tee' ? 22 : top.shape === 'bodice' ? (P(top, 'hood') ? 54 : 8) : top.shape === 'vest' ? 54 : 54
  const sleeveColor = top.shape === 'vest' ? C.white : top.shape === 'blouse' ? (top.role === 'main' || top.role === 'accent' ? pick(C, top.role) : C.white) : pick(C, top.role)
  const sleeveFabric = top.shape === 'vest' ? 'plain' : top.fabric
  const glove = acc.shape === 'gloves'
  const mkArm = (side: -1 | 1) => mk(90, 190, 45, 72, sc, (g) => {
    const armPath = (w0: number, w1: number, len: number) => () => { g.beginPath(); g.moveTo(-w0, 0); g.lineTo(-w1, len); g.lineTo(w1, len); g.lineTo(w0, 0); g.closePath() }
    if (side === 1 && (acc.shape === 'cape')) { /* cape drawn in back layer */ }
    paint(g, armPath(4.6, 3.4, 56), skin, 'plain', C, [-6, 0, 12, 56], false)
    if (glove) { g.fillStyle = C.white; g.beginPath(); g.moveTo(-4.1, 20); g.lineTo(-3.5, 56); g.lineTo(3.5, 56); g.lineTo(4.1, 20); g.closePath(); g.fill(); outline(g, 1) }
    if (sleeveLen > 0) {
      const puff = P(top, 'puff') ? 3 : 0
      paint(g, armPath(5.8 + puff, 4.9 + puff * 0.7, sleeveLen), sleeveColor, sleeveFabric, C, [-9, 0, 18, sleeveLen])
      if (sleeveLen > 40 && top.shape !== 'blouse') { g.fillStyle = top.shape === 'vest' ? C.white : C.trim; g.fillRect(-5.2, sleeveLen - 4, 10.4, 4) }
      if (top.shape === 'blouse' && P(top, 'ruffle')) { g.fillStyle = C.white; g.fillRect(-5.8, sleeveLen - 3, 11.6, 3) }
    }
    if (acc.shape === 'cuffs') { g.fillStyle = C.white; g.fillRect(-5, 48, 10, 6); g.fillStyle = 'rgba(0,0,0,.2)'; for (let x = -4; x < 5; x += 2) g.fillRect(x, 53, 1, 2) }
    // hand
    ell(g, 0, 59, 4.6, 5.2); g.fillStyle = glove ? C.white : skin; g.fill(); outline(g, 1)
    if (side === 1) drawHandProp(g, acc, C)
  })
  const armL = mkArm(-1), armR = mkArm(1)

  // --- torso + bottoms ---
  const high = P(top, 'high') || P(bot, 'high')
  const torso = mk(190, 190, 95, 168, sc, (g) => {
    // pivot (0,0) at the hip joint line? We want pivot at HIP: translate so y=HIP is the origin of the layer.
    g.translate(0, 0)
    const topY = SHO - 12
    void topY
    // base skin torso
    g.beginPath(); torsoShape(g, b, HIP + 4); g.fillStyle = skin; g.fill()
    // neck
    g.fillStyle = skin; g.fillRect(-5.5, SHO - 14, 11, 12)
    // pants hip block
    if (bot.shape === 'pants' || bot.shape === 'breeches') {
      paint(g, () => { g.beginPath(); g.moveTo(-b.ww, WAIST); g.lineTo(-b.hw - 1, HIP + 8); g.lineTo(b.hw + 1, HIP + 8); g.lineTo(b.ww, WAIST); g.closePath() }, pick(C, bot.role), bot.fabric, C, [-b.hw, WAIST, b.hw * 2, 20], true)
      g.fillStyle = C.trim; g.fillRect(-b.ww, WAIST - 1, b.ww * 2, 3.4)
    }
    // skirts
    if (isSkirt) drawSkirt(g, bot, C, b, high)
    // top
    drawTop(g, top, C, b, skin, model)
    // extras on the torso
    drawTorsoAcc(g, acc, C, b)
  })
  // torso layer origin is the figure origin (feet); keep as is.

  // --- back layer: cape, orbs ---
  let back: Layer | null = null
  if (acc.shape === 'cape') {
    back = mk(190, 190, 95, 168, sc, (g) => {
      paint(g, () => { g.beginPath(); g.moveTo(-b.sw - 2, SHO); g.quadraticCurveTo(-b.sw - 22, -70, -b.sw - 14, -14); g.lineTo(b.sw + 14, -14); g.quadraticCurveTo(b.sw + 22, -70, b.sw + 2, SHO); g.closePath() }, pick(C, acc.role), acc.fabric, C, [-60, SHO, 120, 140])
    })
  } else if (acc.shape === 'orbs') {
    back = mk(190, 190, 95, 168, sc, (g) => {
      for (const [x, y, r] of [[-56, -150, 5.5], [58, -118, 7], [-62, -88, 4.5]] as const) {
        const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.6)
        gr.addColorStop(0, C.white); gr.addColorStop(0.3, C.accent); gr.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 2.6, 0, TAU); g.fill()
        g.fillStyle = C.white; g.beginPath(); g.arc(x, y, r * 0.7, 0, TAU); g.fill()
      }
    })
  }

  // --- head ---
  const mkHead = (face: Pose['face']) => mk(110, 150, 55, 90, sc, (g) => drawHead(g, model, C, face, acc, hat))
  const head = mkHead('happy'), headOops = mkHead('oops'), headProud = mkHead('proud')
  const hatLayer = hat.shape === 'none' ? null : mk(130, 120, 65, 80, sc, (g) => drawHat(g, hat, C))
  return { sc, look, sw: b.sw, hw: b.hw, legL, legR, torso, back, armL, armR, head, headOops, headProud, hat: hatLayer, hatItem: hat.shape === 'none' ? null : hat }
}

const stamp = (g: CanvasRenderingContext2D, l: Layer, x: number, y: number, rot = 0, mul = 1) => {
  g.save(); g.translate(x, y)
  if (rot) g.rotate(rot)
  const k = mul / l.sc
  g.drawImage(l.c, -l.ox * k, -l.oy * k, l.c.width * k, l.c.height * k)
  g.restore()
}

/** Stamp the whole figure with its feet at (x, y). `s` is screen pixels per figure unit. */
export function drawFigure(g: CanvasRenderingContext2D, f: Figure, x: number, y: number, s: number, p: Pose) {
  g.save()
  g.translate(x, y); g.scale(s, s)
  g.rotate(p.tilt)
  g.translate(0, p.bob)
  const hipX = f.hw * 0.5
  const lifts: [number, number] = [p.liftL, p.liftR]
  if (f.back) stamp(g, f.back, 0, 0, p.sway * 0.4)
  // legs
  const legAt = (l: Layer, side: -1 | 1, lift: number, sw: number) => stamp(g, l, side * hipX, HIP - lift * 7, sw * 0.26 + side * 0.03)
  legAt(f.legL, -1, lifts[0], p.swingL); legAt(f.legR, 1, lifts[1], p.swingR)
  // arms (back arm first), torso sways around the hip
  g.save(); g.translate(0, HIP); g.rotate(p.sway); g.translate(0, -HIP)
  stamp(g, f.armL, -f.sw + 1, SHO + 4, -0.05 - p.arm * 0.5)
  stamp(g, f.torso, 0, 0)
  stamp(g, f.armR, f.sw - 1, SHO + 4, 0.05 + p.arm * 0.35)
  const head = p.face === 'oops' ? f.headOops : p.face === 'proud' ? f.headProud : f.head
  stamp(g, head, 0, HEADY)
  if (f.hat && p.hatOn) stamp(g, f.hat, p.hatDx, HEADY + p.hatDy, p.hatRot)
  g.restore()
  g.restore()
}

/** A hat on its own (for the wardrobe malfunction): drawn at (x,y) with rotation and a pixel scale. */
export function drawHatAlone(g: CanvasRenderingContext2D, f: Figure, x: number, y: number, s: number, rot: number) {
  if (!f.hat) return
  g.save(); g.translate(x, y); g.scale(s, s); stamp(g, f.hat, 0, 0, rot); g.restore()
}

// ---------------- parts ----------------
function drawShoe(g: CanvasRenderingContext2D, sh: Item, C: Colors, side: -1 | 1) {
  const col = pick(C, sh.role)
  const y = LEGLEN + 1.5
  const out = side * 2
  switch (sh.shape) {
    case 'boot': {
      paint(g, () => { rr(g, -6.4 + out * 0.3, 56, 12.8, 30, 3) }, col, sh.fabric, C, [-7, 56, 14, 30])
      paint(g, () => ell(g, out + side * 2.5, y + 3, 9.5, 5), col, 'plain', C, [-10, y - 3, 20, 10])
      g.fillStyle = C.trim; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(0, 62 + k * 5.5, 0.9, 0, TAU); g.fill() }
      break
    }
    case 'oxford': {
      paint(g, () => ell(g, out + side * 2, y + 2.5, 9.5, 5.2), col, 'plain', C, [-10, y - 3, 20, 10])
      g.fillStyle = sh.role === 'dark' ? C.white : C.dark
      g.beginPath(); g.ellipse(out + side * 5.5, y + 2.5, 3.6, 3.6, 0, 0, TAU); g.fill()
      g.fillStyle = C.white; g.fillRect(-5, 74, 10, 8); g.strokeStyle = OUT; g.lineWidth = 0.9; g.strokeRect(-5, 74, 10, 8)
      break
    }
    case 'sneaker': {
      paint(g, () => ell(g, out + side * 2.5, y + 1.5, 10.5, 6.2), col, 'plain', C, [-12, y - 5, 24, 12])
      g.fillStyle = C.white; g.fillRect(-10 + out + side * 2.5, y + 4, 21, 3.6)
      g.strokeStyle = C.white; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-3, y - 2); g.lineTo(3, y - 2); g.moveTo(-3, y + 0.5); g.lineTo(3, y + 0.5); g.stroke()
      break
    }
    case 'platform': {
      paint(g, () => { rr(g, -6.4 + out * 0.3, 66, 12.8, 14, 3) }, col, 'plain', C, [-7, 66, 14, 14])
      paint(g, () => rr(g, -10.5 + out * 0.5, 80, 21, 11, 3), C.dark, 'plain', C, [-11, 80, 22, 11])
      g.fillStyle = C.trim; g.fillRect(-10 + out * 0.5, 87, 20, 2)
      break
    }
    case 'hover': {
      g.save(); g.globalAlpha = 0.55
      const gr = g.createRadialGradient(0, 92, 0, 0, 92, 15); gr.addColorStop(0, C.white); gr.addColorStop(0.4, C.accent); gr.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = gr; g.fillRect(-16, 78, 32, 28); g.restore()
      paint(g, () => ell(g, out + side * 2, y - 1, 9, 5.4), col, 'plain', C, [-10, y - 6, 20, 12])
      g.fillStyle = C.white; g.fillRect(-7, y + 3, 14, 2)
      break
    }
    case 'heel': {
      paint(g, () => ell(g, out + side * 2.5, y + 2, 8, 4.6), col, 'plain', C, [-9, y - 3, 18, 9])
      g.fillStyle = C.dark; g.fillRect(-5.5 + out * 0.2, y + 3, 2.4, 6)
      if (P(sh, 'strap')) { g.strokeStyle = C.white; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-6, y - 3); g.lineTo(6, y - 3); g.stroke(); g.fillStyle = C.white; g.beginPath(); g.arc(0, y - 3, 1.5, 0, TAU); g.fill() }
      break
    }
    case 'buckle': {
      paint(g, () => ell(g, out + side * 2.5, y + 2.5, 9.5, 5.2), col, 'plain', C, [-10, y - 3, 20, 10])
      g.fillStyle = '#ffd34d'; g.fillRect(out + side * 2.5 - 2.4, y - 1.2, 4.8, 4.4); g.fillStyle = col; g.fillRect(out + side * 2.5 - 1.2, y - 0.2, 2.4, 2.4)
      break
    }
    default: {
      paint(g, () => ell(g, out + side * 2.5, y + 2.5, 9.5, 5.2), col, sh.fabric, C, [-10, y - 3, 20, 10])
    }
  }
}

function drawHandProp(g: CanvasRenderingContext2D, acc: Item, C: Colors) {
  const col = pick(C, acc.role)
  if (acc.shape === 'fan') {
    g.save(); g.translate(1, 60)
    for (let k = -3; k <= 3; k++) {
      g.save(); g.rotate(k * 0.26 - 0.1)
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-3.4, -26); g.lineTo(3.4, -26); g.closePath(); g.fillStyle = k % 2 ? C.white : col; g.fill(); outline(g, 0.8); g.restore()
    }
    g.restore()
  } else if (acc.shape === 'cane') {
    g.strokeStyle = C.dark; g.lineWidth = 3.2; g.beginPath(); g.moveTo(1, 24); g.lineTo(1, 100); g.stroke()
    g.strokeStyle = '#ffd34d'; g.lineWidth = 4.4; g.beginPath(); g.arc(-1.5, 20, 4.5, Math.PI * 0.9, TAU + 0.2); g.stroke()
  } else if (acc.shape === 'parasol') {
    g.strokeStyle = C.dark; g.lineWidth = 2.2; g.beginPath(); g.moveTo(1, 70); g.lineTo(1, -34); g.stroke()
    g.save(); g.translate(1, -34)
    paint(g, () => { g.beginPath(); g.moveTo(-34, 4); g.quadraticCurveTo(-30, -26, 0, -28); g.quadraticCurveTo(30, -26, 34, 4); for (let k = 3; k >= -3; k--) g.quadraticCurveTo(k * 11 + 5.5, 11, k * 11 - 0 + (k === -3 ? 0 : 0), 4); g.closePath() }, col, acc.fabric, C, [-34, -28, 68, 40])
    g.restore()
  } else if (acc.shape === 'bag') {
    paint(g, () => rr(g, -9, 58, 18, 11, 3), col, 'sequin', C, [-9, 58, 18, 11]); g.fillStyle = '#ffd34d'; g.fillRect(-2, 58, 4, 2.4)
  }
}

function drawTop(g: CanvasRenderingContext2D, top: Item, C: Colors, b: { sw: number; ww: number; hw: number }, skin: string, model: Model) {
  const col = pick(C, top.role)
  const box: [number, number, number, number] = [-b.sw - 4, SHO, b.sw * 2 + 8, 90]
  void model
  switch (top.shape) {
    case 'coat': {
      const len = P(top, 'len', 40)
      const hem = WAIST + len
      const tails = P(top, 'tails')
      const fl = 3 + len * 0.16
      // coat body
      paint(g, () => {
        g.beginPath(); g.moveTo(-b.sw * 0.4, SHO - 5); g.lineTo(-b.sw - 0.5, SHO + 3); g.lineTo(-b.ww, WAIST)
        g.lineTo(-b.hw - fl, hem)
        if (tails) { g.lineTo(-3, hem); g.lineTo(0, WAIST + 6); g.lineTo(3, hem) }
        g.lineTo(b.hw + fl, hem); g.lineTo(b.ww, WAIST); g.lineTo(b.sw + 0.5, SHO + 3); g.lineTo(b.sw * 0.4, SHO - 5); g.closePath()
      }, col, top.fabric, C, [-b.sw - 10, SHO, b.sw * 2 + 20, len + 62])
      // inner shirt V and lapels
      g.beginPath(); g.moveTo(-b.sw * 0.34, SHO - 4); g.lineTo(0, WAIST - 12); g.lineTo(b.sw * 0.34, SHO - 4); g.closePath(); g.fillStyle = C.white; g.fill(); outline(g, 1)
      g.fillStyle = C.trim; g.strokeStyle = OUT; g.lineWidth = 1
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * b.sw * 0.38, SHO - 5); g.lineTo(s * 2, WAIST - 12); g.lineTo(s * b.sw * 0.62, SHO + 14); g.lineTo(s * b.sw * 0.7, SHO + 4); g.closePath(); g.fill(); g.stroke() }
      g.fillStyle = '#ffd34d'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0, WAIST - 8 + k * 7, 1.5, 0, TAU); g.fill() }
      if (P(top, 'collar')) { g.fillStyle = C.white; g.beginPath(); g.moveTo(-5, SHO - 8); g.lineTo(0, SHO - 1); g.lineTo(5, SHO - 8); g.closePath(); g.fill() }
      break
    }
    case 'vest': {
      paint(g, () => {
        g.beginPath(); g.moveTo(-b.sw * 0.55, SHO - 4); g.lineTo(-b.sw + 2, SHO + 4); g.lineTo(-b.ww, WAIST); g.lineTo(-b.hw + 2, WAIST + 14); g.lineTo(0, WAIST + 20)
        g.lineTo(b.hw - 2, WAIST + 14); g.lineTo(b.ww, WAIST); g.lineTo(b.sw - 2, SHO + 4); g.lineTo(b.sw * 0.55, SHO - 4); g.lineTo(0, SHO + 16); g.closePath()
      }, col, top.fabric, C, box)
      g.fillStyle = C.white; g.beginPath(); g.moveTo(-b.sw * 0.34, SHO - 4); g.lineTo(0, SHO + 16); g.lineTo(b.sw * 0.34, SHO - 4); g.closePath(); g.fill()
      if (P(top, 'ruffle')) ruffle(g, 0, SHO + 4, 9)
      g.fillStyle = '#ffd34d'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(0, SHO + 22 + k * 7, 1.4, 0, TAU); g.fill() }
      break
    }
    case 'blouse': {
      paint(g, () => torsoShape(g, b, WAIST + 12), col, top.fabric, C, box)
      if (P(top, 'ruffle')) ruffle(g, 0, SHO - 1, P(top, 'high') ? 11 : 9)
      if (P(top, 'high')) { g.fillStyle = C.white; rr(g, -6, SHO - 17, 12, 12, 3); g.fill(); outline(g, 1) }
      break
    }
    case 'bodice': {
      const drop = P(top, 'drop')
      const bottomY = WAIST + (drop ? 14 : P(top, 'len', 20) > 30 ? 8 : 2)
      paint(g, () => torsoShape(g, b, bottomY, 0, P(top, 'high') ? -2 : 3), col, top.fabric, C, box)
      if (P(top, 'v')) { g.beginPath(); g.moveTo(-b.sw * 0.4, SHO - 3); g.lineTo(0, SHO + 18); g.lineTo(b.sw * 0.4, SHO - 3); g.closePath(); g.fillStyle = skin; g.fill() }
      if (P(top, 'hood')) { g.fillStyle = C.accent; g.beginPath(); g.ellipse(0, SHO - 4, b.sw * 0.75, 6, 0, 0, Math.PI); g.fill(); outline(g, 1) }
      g.strokeStyle = C.trim; g.lineWidth = 2; g.beginPath(); g.moveTo(-b.ww, bottomY - 1); g.lineTo(b.ww, bottomY - 1); g.stroke()
      break
    }
    default: { // tee
      paint(g, () => torsoShape(g, b, WAIST + 10), col, top.fabric, C, box)
      g.fillStyle = skin; g.beginPath(); g.ellipse(0, SHO - 4, 7, 4, 0, 0, Math.PI); g.fill()
    }
  }
}
function ruffle(g: CanvasRenderingContext2D, x: number, y: number, w: number) {
  g.fillStyle = C_WHITE
  for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + (k - 2) * (w * 0.4), y + k % 2 * 3 + 4, w * 0.26, 4.5, 0, 0, TAU); g.fill(); outline(g, 0.8) }
  g.beginPath(); g.moveTo(x - w * 0.5, y - 1); g.lineTo(x + w * 0.5, y - 1); g.lineTo(x, y + 18); g.closePath(); g.fill()
}
const C_WHITE = '#f7f1e6'

function drawSkirt(g: CanvasRenderingContext2D, bot: Item, C: Colors, b: { sw: number; ww: number; hw: number }, high: number) {
  const col = pick(C, bot.role)
  const flare = P(bot, 'flare', 1.3), len = P(bot, 'len', 1)
  const y0 = high ? WAIST - 12 : WAIST - 1
  const hemY = WAIST + (FLOOR - WAIST) * len
  const hemW = b.hw * flare * 1.1 + 8
  const waistW = high ? b.sw * 0.92 : b.ww + 1
  const fringe = P(bot, 'fringe')
  const bustle = P(bot, 'bustle')
  paint(g, () => {
    g.beginPath(); g.moveTo(-waistW, y0)
    g.quadraticCurveTo(-hemW * 0.68, (y0 + hemY) * 0.5 - 6, -hemW, hemY)
    if (fringe) { const n = 12; for (let k = 0; k < n; k++) g.lineTo(-hemW + (k + 0.5) * (hemW * 2 / n), hemY + (k % 2 ? 2 : 8)) }
    else if (flare > 1.9) { g.quadraticCurveTo(0, hemY + 7, hemW, hemY) }
    else g.lineTo(hemW, hemY)
    g.quadraticCurveTo(hemW * 0.68, (y0 + hemY) * 0.5 - 6, waistW, y0)
    g.closePath()
  }, col, bot.fabric, C, [-hemW, y0, hemW * 2, hemY - y0 + 10])
  // pleats / folds
  g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1.1
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * waistW * 0.4, y0 + 3); g.lineTo(k * hemW * 0.42, hemY - 2); g.stroke() }
  if (fringe) { g.strokeStyle = C.trim; g.lineWidth = 1; for (let k = 0; k < 12; k++) { const x = -hemW + (k + 0.5) * (hemW * 2 / 12); g.beginPath(); g.moveTo(x, hemY - 6); g.lineTo(x, hemY + (k % 2 ? 2 : 8)); g.stroke() } }
  if (bustle) {
    paint(g, () => { g.beginPath(); g.moveTo(hemW * 0.5, y0 + 6); g.quadraticCurveTo(hemW * 1.25 + 6, y0 + 22, hemW * 1.05, hemY - 8); g.lineTo(hemW * 0.5, hemY - 14); g.closePath() }, C.accent, bot.fabric, C, [hemW * 0.4, y0, hemW, hemY - y0])
    g.fillStyle = C.trim; g.beginPath(); g.arc(hemW * 0.7, y0 + 12, 4.5, 0, TAU); g.fill(); outline(g, 0.9)
  }
  // waist sash
  g.fillStyle = C.trim; g.fillRect(-waistW, y0 - 1, waistW * 2, 3.6)
}

function drawTorsoAcc(g: CanvasRenderingContext2D, acc: Item, C: Colors, b: { sw: number; ww: number; hw: number }) {
  switch (acc.shape) {
    case 'bowtie':
      g.fillStyle = pick(C, acc.role)
      g.beginPath(); g.moveTo(0, SHO - 3); g.lineTo(-9, SHO - 8); g.lineTo(-9, SHO + 2); g.closePath(); g.fill(); outline(g, 0.9)
      g.beginPath(); g.moveTo(0, SHO - 3); g.lineTo(9, SHO - 8); g.lineTo(9, SHO + 2); g.closePath(); g.fill(); outline(g, 0.9)
      g.beginPath(); g.arc(0, SHO - 3, 2.2, 0, TAU); g.fill(); break
    case 'cravat':
      g.fillStyle = C.white; g.beginPath(); g.moveTo(-5, SHO - 8); g.lineTo(5, SHO - 8); g.lineTo(8, SHO + 14); g.lineTo(0, SHO + 9); g.lineTo(-8, SHO + 14); g.closePath(); g.fill(); outline(g, 0.9); break
    case 'pearls':
      g.fillStyle = C.white
      for (let k = 0; k <= 16; k++) { const t = k / 16, x = Math.sin(t * Math.PI - Math.PI / 2) * b.sw * 0.55, y = SHO - 6 + Math.sin(t * Math.PI) * 38; g.beginPath(); g.arc(x, y, 2.3, 0, TAU); g.fill(); outline(g, 0.7) }
      break
    case 'watch':
      g.strokeStyle = '#ffd34d'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, SHO - 4); g.quadraticCurveTo(b.sw * 0.5, SHO + 16, b.sw * 0.45, WAIST - 2); g.stroke()
      g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(b.sw * 0.45, WAIST, 3.8, 0, TAU); g.fill(); outline(g, 0.9)
      g.fillStyle = C.white; g.beginPath(); g.arc(b.sw * 0.45, WAIST, 2.3, 0, TAU); g.fill(); break
    case 'boa':
      g.fillStyle = pick(C, acc.role)
      for (let k = 0; k < 11; k++) { const x = -b.sw * 0.95 + k * (b.sw * 1.9 / 10); g.beginPath(); g.ellipse(x, SHO + 1 + Math.sin(k) * 1.5, 5.4, 5.4, 0, 0, TAU); g.fill() }
      for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { g.beginPath(); g.ellipse(s * (b.sw * 0.9 - k * 0.6), SHO + 4 + k * 8, 5.2, 5.2, 0, 0, TAU); g.fill() }
      break
    default: break
  }
}

// ---------------- head + hair ----------------
function drawHead(g: CanvasRenderingContext2D, m: Model, C: Colors, face: Pose['face'], acc: Item, hat: Item) {
  const hair = m.hair, st = m.style
  const wrapCol = C.accent
  const hasHat = hat.shape !== 'none'
  // back hair
  g.fillStyle = hair
  if (st === 'afro') { g.beginPath(); g.arc(0, -4, 31, 0, TAU); g.fill() }
  else if (st === 'long') { rr(g, -25, -14, 50, 62, 18); g.fill() }
  else if (st === 'bob') { rr(g, -24, -14, 48, 32, 14); g.fill() }
  else if (st === 'braids') { for (const s of [-1, 1]) for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(s * 21, 2 + k * 9, 4.8, 5.4, 0, 0, TAU); g.fill() } }
  else if (st === 'bun') { g.beginPath(); g.arc(0, -29, 9, 0, TAU); g.fill() }
  // face
  ell(g, 0, 1, 19, 21); g.fillStyle = m.skin; g.fill(); outline(g, 1.2)
  // ears
  for (const s of [-1, 1]) { ell(g, s * 19, 3, 3.4, 4.6); g.fillStyle = m.skin; g.fill(); outline(g, 0.9) }
  // front hair
  g.fillStyle = hair
  if (st === 'wrap') {
    g.fillStyle = wrapCol; g.beginPath(); g.ellipse(0, -9, 21, 15, 0, Math.PI, TAU); g.fill(); outline(g, 1)
    g.beginPath(); g.ellipse(0, -22, 10, 7, 0, 0, TAU); g.fill(); outline(g, 1)
    g.strokeStyle = C.light; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-19, -9); g.quadraticCurveTo(0, -20, 19, -9); g.stroke()
  } else if (st === 'afro') { g.beginPath(); g.ellipse(0, -13, 25, 14, 0, Math.PI, TAU); g.fill() }
  else if (st === 'buzz') { g.globalAlpha = 0.85; g.beginPath(); g.ellipse(0, -9, 19.2, 13, 0, Math.PI, TAU); g.fill(); g.globalAlpha = 1 }
  else if (st === 'pixie') { g.beginPath(); g.ellipse(0, -9, 20, 14, 0, Math.PI, TAU); g.fill(); g.beginPath(); g.moveTo(-14, -12); g.quadraticCurveTo(0, -4, 14, -17); g.lineTo(20, -8); g.lineTo(-20, -8); g.closePath(); g.fill() }
  else { g.beginPath(); g.ellipse(0, -9, 20.4, 15, 0, Math.PI, TAU); g.fill(); g.beginPath(); g.moveTo(-19, -8); g.quadraticCurveTo(-5, -1, 6, -14); g.lineTo(19, -8); g.lineTo(0, -16); g.closePath(); g.fill() }
  if (st === 'long' || st === 'bob') { for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 21, 6, 5, 16, 0, 0, TAU); g.fill() } }
  void hasHat
  // eyes
  for (const s of [-1, 1]) {
    const ex = s * 7.5
    if (face === 'proud') { g.strokeStyle = '#2a1a22'; g.lineWidth = 1.8; g.beginPath(); g.arc(ex, 2.5, 3, Math.PI * 1.15, Math.PI * 1.85); g.stroke() }
    else {
      const big = face === 'oops' ? 1.25 : 1
      ell(g, ex, 2, 3.1 * big, 3.5 * big); g.fillStyle = '#fff'; g.fill()
      g.fillStyle = m.eyes; g.beginPath(); g.arc(ex, 2.4, 2.2 * big, 0, TAU); g.fill()
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 0.8, 1.4, 0.9, 0, TAU); g.fill()
    }
    g.strokeStyle = hair === '#c4a35a' ? '#8a6a30' : hair; g.lineWidth = 1.6; g.beginPath()
    if (face === 'oops') { g.moveTo(ex - 3.4, -5.6); g.lineTo(ex + 3.4, -7) } else g.arc(ex, 2, 5, Math.PI * 1.15, Math.PI * 1.85)
    if (face === 'oops') g.stroke(); else { g.beginPath(); g.moveTo(ex - 3.6, -3.2); g.quadraticCurveTo(ex, -5.8, ex + 3.6, -3.2); g.stroke() }
  }
  // cheeks, nose, mouth
  g.fillStyle = 'rgba(255,110,130,.28)'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 12, 9, 3.6, 0, TAU); g.fill() }
  g.strokeStyle = 'rgba(40,20,20,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-1.4, 7); g.quadraticCurveTo(0, 9, 1.4, 7); g.stroke()
  g.strokeStyle = '#7a2a3a'; g.lineWidth = 1.7; g.beginPath()
  if (face === 'oops') { ell(g, 0, 14, 3.2, 3.8); g.fillStyle = '#5a1a2a'; g.fill() }
  else if (face === 'proud') { g.moveTo(-6, 12); g.quadraticCurveTo(0, 20, 6, 12); g.closePath(); g.fillStyle = '#7a2a3a'; g.fill(); g.fillStyle = '#fff'; g.fillRect(-4, 12.5, 8, 2) }
  else { g.moveTo(-5, 12.5); g.quadraticCurveTo(0, 17, 5, 12.5); g.stroke() }
  if (acc.shape === 'shades') {
    paint(g, () => { rr(g, -16, -2, 14, 9, 3.5); rr(g, 2, -2, 14, 9, 3.5) }, C.dark, 'holo', C, [-16, -2, 32, 9], false)
    g.beginPath(); rr(g, -16, -2, 14, 9, 3.5); outline(g, 1); g.beginPath(); rr(g, 2, -2, 14, 9, 3.5); outline(g, 1)
    g.strokeStyle = OUT; g.beginPath(); g.moveTo(-2, 2); g.lineTo(2, 2); g.stroke()
  }
}

// ---------------- hats (origin = head centre) ----------------
function drawHat(g: CanvasRenderingContext2D, h: Item, C: Colors) {
  const col = pick(C, h.role)
  const fab = h.fabric
  switch (h.shape) {
    case 'wig': {
      g.fillStyle = '#f4f0ff'
      const blobs: [number, number, number][] = [[0, -22, 20], [-18, -14, 9], [18, -14, 9], [-23, -3, 8], [23, -3, 8], [-23, 9, 7], [23, 9, 7], [-10, -26, 10], [10, -26, 10]]
      for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); outline(g, 0.9) }
      g.beginPath(); g.arc(0, -22, 19, 0, TAU); g.fill()
      g.fillStyle = C.accent; g.beginPath(); g.arc(-26, 19, 4, 0, TAU); g.arc(26, 19, 4, 0, TAU); g.fill()
      break
    }
    case 'tricorn': {
      paint(g, () => { g.beginPath(); g.moveTo(-28, -12); g.lineTo(0, -34); g.lineTo(28, -12); g.quadraticCurveTo(0, -2, -28, -12); g.closePath() }, col, fab, C, [-28, -34, 56, 32])
      g.strokeStyle = '#ffd34d'; g.lineWidth = 2; g.beginPath(); g.moveTo(-28, -12); g.quadraticCurveTo(0, -2, 28, -12); g.stroke()
      g.fillStyle = C.white; g.beginPath(); g.arc(0, -20, 2.6, 0, TAU); g.fill()
      break
    }
    case 'plume': {
      paint(g, () => ell(g, 0, -13, 30, 7), col, 'velvet', C, [-30, -20, 60, 14])
      paint(g, () => { rr(g, -15, -34, 30, 24, 10) }, col, 'velvet', C, [-15, -34, 30, 24])
      g.strokeStyle = C.white; g.lineWidth = 3; g.beginPath(); g.moveTo(10, -30); g.quadraticCurveTo(36, -42, 30, -12); g.stroke()
      g.strokeStyle = C.trim; g.lineWidth = 1.2; g.beginPath(); g.moveTo(10, -30); g.quadraticCurveTo(34, -38, 28, -14); g.stroke()
      break
    }
    case 'bonnet': {
      paint(g, () => { g.beginPath(); g.ellipse(0, -8, 25, 22, 0, Math.PI * 0.9, Math.PI * 2.1); g.lineTo(23, 14); g.lineTo(19, 14); g.quadraticCurveTo(14, -20, 0, -18); g.quadraticCurveTo(-14, -20, -19, 14); g.lineTo(-23, 14); g.closePath() }, col, fab, C, [-26, -32, 52, 46])
      g.strokeStyle = C.white; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-22, 12); g.lineTo(-6, 26); g.moveTo(22, 12); g.lineTo(6, 26); g.stroke()
      g.fillStyle = C.accent; g.beginPath(); g.moveTo(0, 22); g.lineTo(-8, 17); g.lineTo(-8, 28); g.closePath(); g.moveTo(0, 22); g.lineTo(8, 17); g.lineTo(8, 28); g.closePath(); g.fill(); outline(g, 0.8)
      break
    }
    case 'bicorne': {
      paint(g, () => { g.beginPath(); g.moveTo(-34, -10); g.quadraticCurveTo(-22, -36, 0, -26); g.quadraticCurveTo(22, -36, 34, -10); g.quadraticCurveTo(0, -18, -34, -10); g.closePath() }, col, fab, C, [-34, -36, 68, 28])
      g.strokeStyle = '#ffd34d'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-34, -10); g.quadraticCurveTo(0, -18, 34, -10); g.stroke()
      g.fillStyle = C.accent; g.beginPath(); g.arc(0, -20, 3, 0, TAU); g.fill()
      break
    }
    case 'band': {
      g.strokeStyle = C.trim; g.lineWidth = 4; g.beginPath(); g.ellipse(0, -8, 20, 15, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke()
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -8, 20, 15, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke()
      g.fillStyle = col
      g.beginPath(); g.moveTo(14, -20); g.quadraticCurveTo(32, -50, 22, -56); g.quadraticCurveTo(24, -36, 14, -20); g.closePath(); g.fill(); outline(g, 0.9)
      g.strokeStyle = C.white; g.lineWidth = 1; g.beginPath(); g.moveTo(15, -21); g.quadraticCurveTo(24, -38, 22, -54); g.stroke()
      g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(14, -20, 3, 0, TAU); g.fill()
      break
    }
    case 'tophat': {
      paint(g, () => ell(g, 0, -15, 25, 5.5), col, 'plain', C, [-25, -20, 50, 11])
      paint(g, () => { rr(g, -15, -56, 30, 42, 3) }, col, fab, C, [-15, -56, 30, 42])
      g.fillStyle = C.accent; g.fillRect(-15, -26, 30, 7); outline(g, 0.8)
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(-11, -52, 5, 30)
      break
    }
    case 'boater': {
      paint(g, () => ell(g, 0, -16, 27, 6), col, 'stripe', C, [-27, -22, 54, 12])
      paint(g, () => { rr(g, -15, -36, 30, 22, 3) }, col, 'stripe', C, [-15, -36, 30, 22])
      g.fillStyle = C.accent; g.fillRect(-15, -26, 30, 5); g.fillStyle = C.dark; g.fillRect(-15, -22, 30, 1.6)
      break
    }
    case 'bighat': {
      paint(g, () => ell(g, 0, -13, 38, 11), col, 'velvet', C, [-38, -24, 76, 22])
      paint(g, () => { g.beginPath(); g.ellipse(0, -22, 19, 14, 0, Math.PI, TAU); g.lineTo(19, -14); g.lineTo(-19, -14); g.closePath() }, col, 'velvet', C, [-19, -36, 38, 22])
      g.strokeStyle = C.white; g.lineWidth = 3
      for (const [x, ang] of [[-8, -0.7], [4, 0.1], [14, 0.8]] as const) { g.beginPath(); g.moveTo(x, -30); g.quadraticCurveTo(x + ang * 40, -62, x + ang * 55, -50); g.stroke() }
      g.fillStyle = C.trim; g.beginPath(); g.arc(-12, -17, 5, 0, TAU); g.fill(); outline(g, 0.9)
      break
    }
    case 'flatcap': {
      paint(g, () => { g.beginPath(); g.ellipse(0, -12, 23, 14, 0, Math.PI, TAU); g.quadraticCurveTo(24, -9, 20, -7); g.lineTo(-20, -7); g.closePath() }, col, fab, C, [-23, -26, 46, 20])
      paint(g, () => { g.beginPath(); g.moveTo(-14, -8); g.quadraticCurveTo(0, 2, 24, -8); g.lineTo(22, -12); g.lineTo(-14, -12); g.closePath() }, C.dark, 'plain', C, [-14, -12, 38, 10])
      break
    }
    case 'cloche': {
      paint(g, () => { g.beginPath(); g.moveTo(-23, 3); g.quadraticCurveTo(-26, -34, 0, -34); g.quadraticCurveTo(26, -34, 23, 3); g.quadraticCurveTo(0, -3, -23, 3); g.closePath() }, col, fab, C, [-26, -34, 52, 38])
      g.fillStyle = C.accent; g.beginPath(); g.moveTo(-23, -5); g.lineTo(23, -5); g.lineTo(23, -1); g.lineTo(-23, -1); g.closePath(); g.fill()
      g.fillStyle = C.white; g.beginPath(); g.arc(15, -8, 3.5, 0, TAU); g.fill(); outline(g, 0.8)
      break
    }
    case 'fedora': {
      paint(g, () => ell(g, 0, -15, 29, 6.5), col, fab, C, [-29, -22, 58, 14])
      paint(g, () => { g.beginPath(); g.moveTo(-16, -15); g.quadraticCurveTo(-18, -42, -6, -40); g.quadraticCurveTo(0, -35, 6, -40); g.quadraticCurveTo(18, -42, 16, -15); g.closePath() }, col, fab, C, [-18, -42, 36, 28])
      g.fillStyle = C.accent; g.fillRect(-16.5, -24, 33, 5)
      break
    }
    case 'visor': {
      g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.ellipse(0, -6, 21, 15, 0, Math.PI * 1.02, Math.PI * 1.98); g.stroke()
      paint(g, () => { g.beginPath(); g.moveTo(-20, -6); g.quadraticCurveTo(0, 6, 20, -6); g.lineTo(18, -16); g.quadraticCurveTo(0, -6, -18, -16); g.closePath() }, C.trim, 'holo', C, [-20, -16, 40, 22])
      g.globalAlpha = 0.5; g.fillStyle = col; g.fill(); g.globalAlpha = 1; outline(g, 1)
      break
    }
    case 'crown': {
      paint(g, () => { g.beginPath(); g.moveTo(-18, -16); g.lineTo(-22, -40); g.lineTo(-9, -28); g.lineTo(0, -46); g.lineTo(9, -28); g.lineTo(22, -40); g.lineTo(18, -16); g.closePath() }, col, 'holo', C, [-22, -46, 44, 30])
      g.fillStyle = C.white; for (const [x, y] of [[-22, -40], [0, -46], [22, -40]]) { g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill() }
      break
    }
    case 'antenna': {
      g.strokeStyle = C.dark; g.lineWidth = 3; g.beginPath(); g.ellipse(0, -8, 20, 15, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke()
      for (const s of [-1, 1]) {
        g.strokeStyle = C.dark; g.lineWidth = 1.6; g.beginPath(); g.moveTo(s * 13, -20); g.quadraticCurveTo(s * 20, -34, s * 14 + s * 4, -44); g.stroke()
        const gr = g.createRadialGradient(s * 18, -46, 0, s * 18, -46, 9); gr.addColorStop(0, C.white); gr.addColorStop(0.4, col); gr.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = gr; g.beginPath(); g.arc(s * 18, -46, 9, 0, TAU); g.fill()
      }
      break
    }
    default: break
  }
}

// ---------------- stills, judges, audience ----------------
/** One standing pose, scaled to fit `h` pixels tall, drawn into any canvas (thumbnails, portraits). */
export function drawStill(cv: HTMLCanvasElement, look: Look, face: Pose['face'] = 'proud') {
  const g = cv.getContext('2d')!
  const era = eraById(look.era)
  const w = cv.width, h = cv.height
  g.clearRect(0, 0, w, h)
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, era.bg[0]); gr.addColorStop(1, era.bg[1])
  g.fillStyle = gr; g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(w / 2, h * 0.94, w * 0.34, h * 0.05, 0, 0, TAU); g.fill()
  const s = (h * 0.9) / 215
  const f = buildFigure(look, s * 1.5)
  drawFigure(g, f, w / 2, h * 0.94, s, { ...NEUTRAL, face })
}

export const JUDGE_LOOKS = [
  { skin: '#8d5a3a', hair: '#1a0f0a', accent: '#ff66c4' }, // Ms. Sparkle
  { skin: '#f1c9a5', hair: '#444a5a', accent: '#4ad0ff' }, // Mr. Tempo
  { skin: '#c68a5c', hair: '#d8d8e8', accent: '#9a7bff' }, // Dr. Harmony
]
export function drawJudge(cv: HTMLCanvasElement, idx: number) {
  const g = cv.getContext('2d')!
  const w = cv.width, h = cv.height
  const j = JUDGE_LOOKS[idx]
  g.clearRect(0, 0, w, h)
  g.save(); g.translate(w / 2, h * 0.5); const s = Math.min(w, h) / 100; g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round'
  // shoulders + jacket
  paint(g, () => { g.beginPath(); g.moveTo(-40, 50); g.quadraticCurveTo(-38, 30, -16, 28); g.lineTo(16, 28); g.quadraticCurveTo(38, 30, 40, 50); g.closePath() }, j.accent, idx === 0 ? 'sequin' : 'plain', palColors({ root: 0, q: 'major' }), [-40, 28, 80, 22])
  // hair back
  g.fillStyle = j.hair
  if (idx === 0) { g.beginPath(); g.arc(0, -6, 34, 0, TAU); g.fill() }
  if (idx === 2) { g.beginPath(); g.arc(0, -36, 12, 0, TAU); g.fill() }
  ell(g, 0, 2, 26, 29); g.fillStyle = j.skin; g.fill(); outline(g, 1.5)
  g.fillStyle = j.hair
  if (idx === 1) { g.beginPath(); g.ellipse(0, -13, 26, 14, 0, Math.PI, TAU); g.fill() } else { g.beginPath(); g.ellipse(0, -14, 27, 16, 0, Math.PI, TAU); g.fill() }
  // eyes, smile
  for (const sx of [-1, 1]) { ell(g, sx * 10, 2, 4, 4.6); g.fillStyle = '#fff'; g.fill(); g.fillStyle = '#2a1a22'; g.beginPath(); g.arc(sx * 10, 2.5, 2.8, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(sx * 10 + 1, 1.4, 1.1, 0, TAU); g.fill() }
  g.fillStyle = 'rgba(255,110,130,.3)'; for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 16, 12, 4.4, 0, TAU); g.fill() }
  g.strokeStyle = '#7a2a3a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-8, 15); g.quadraticCurveTo(0, 24, 8, 15); g.stroke()
  if (idx === 0) { // star-rim glasses + beret
    g.strokeStyle = '#ffd34d'; g.lineWidth = 2.4
    for (const sx of [-1, 1]) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU - Math.PI / 2, r = k % 2 ? 4.8 : 9; g.lineTo(sx * 11 + Math.cos(a) * r, 2 + Math.sin(a) * r) } g.closePath(); g.stroke() }
    paint(g, () => ell(g, 6, -28, 25, 9), j.accent, 'plain', palColors({ root: 0, q: 'major' }), [-20, -37, 50, 18])
  } else if (idx === 1) { // headphones + metronome pin
    g.strokeStyle = '#2a2a44'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 31, Math.PI * 1.02, Math.PI * 1.98); g.stroke()
    for (const sx of [-1, 1]) { rr(g, sx * 31 - 5, -6, 10, 18, 4); g.fillStyle = j.accent; g.fill(); outline(g, 1.2) }
    g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(24, 38); g.lineTo(30, 38); g.lineTo(27, 31); g.closePath(); g.fill()
  } else { // half-moon glasses + bow tie
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 2; for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 10, 2, 7.5, 0, Math.PI); g.stroke() }
    g.beginPath(); g.moveTo(-3, 2); g.lineTo(3, 2); g.stroke()
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, 34); g.lineTo(-10, 28); g.lineTo(-10, 40); g.closePath(); g.moveTo(0, 34); g.lineTo(10, 28); g.lineTo(10, 40); g.closePath(); g.fill(); outline(g, 1)
  }
  g.restore()
}

/** A small seated audience member (head + shoulders), cached per variant. */
export function makeAudience(hue: number, skin: string, hair: string, standing: boolean, sc: number): HTMLCanvasElement {
  return mk(40, 50, 20, 25, sc, (g) => {
    const y = standing ? -6 : 0
    g.fillStyle = `hsl(${hue} 45% 22%)`
    g.beginPath(); g.moveTo(-15, 24); g.quadraticCurveTo(-14, 8 + y, 0, 7 + y); g.quadraticCurveTo(14, 8 + y, 15, 24); g.closePath(); g.fill()
    if (standing) { g.strokeStyle = skin; g.lineWidth = 4; g.beginPath(); g.moveTo(-12, 12); g.lineTo(-18, -12); g.moveTo(12, 12); g.lineTo(18, -12); g.stroke() }
    g.fillStyle = hair; g.beginPath(); g.arc(0, -2 + y, 11.5, 0, TAU); g.fill()
    g.fillStyle = skin; g.beginPath(); g.ellipse(0, 1 + y, 9, 10, 0, 0, TAU); g.fill()
    g.fillStyle = hair; g.beginPath(); g.ellipse(0, -5 + y, 10, 6, 0, Math.PI, TAU); g.fill()
  }).c
}

/** A goofy party hat for the "wardrobe malfunction" when the model isn't wearing a hat. */
export function goofyHat(sc: number): Layer {
  return mk(60, 70, 30, 60, sc, (g) => {
    const C = palColors({ root: 7, q: 'major' })
    paint(g, () => { g.beginPath(); g.moveTo(-16, 0); g.lineTo(0, -50); g.lineTo(16, 0); g.closePath() }, C.accent, 'stripe', C, [-16, -50, 32, 50])
    g.fillStyle = C.trim; g.beginPath(); g.arc(0, -50, 6, 0, TAU); g.fill(); outline(g, 1)
  })
}
