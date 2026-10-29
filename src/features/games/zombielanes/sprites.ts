// Zombie Lanes sprites. Everything is drawn once into small offscreen canvases (at the real device
// scale) and then stamped with drawImage, so the game loop never draws a path or a gradient per zombie.
// A `Sprites` instance is owned by one game and thrown away on resize. No module-level state.
const TAU = Math.PI * 2

export interface Skin { skin: string; dark: string; shirt: string; shirtD: string; pants: string; hair: string }
export const SKINS: Skin[] = [
  { skin: '#9bd95f', dark: '#6aa83a', shirt: '#ff7a59', shirtD: '#d4543a', pants: '#4a4a85', hair: '#5a3a86' },
  { skin: '#78d6b0', dark: '#43a587', shirt: '#4fa8ff', shirtD: '#3279cf', pants: '#6a4a85', hair: '#2f6f8f' },
  { skin: '#cfe05a', dark: '#9db237', shirt: '#b46cff', shirtD: '#8545cf', pants: '#3f5a7a', hair: '#7a4a24' },
]
export const EXTRAS = 6
/** design boxes (units). The sprite is drawn scaled by `k` px per unit. Feet sit near the bottom edge. */
export const ZW = 100, ZH = 162, ZFEET = 152
export const KW = 150, KH = 196, KFEET = 188
export const SIGN_Y = 78 // centre of the sign board in the zombie box
export const KSIGN_Y = 140

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return [c, c.getContext('2d')!]
}
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.roundRect(x, y, w, h, r)
}

export const CONFETTI = ['#7bdc5a', '#a6f08a', '#4fbf6b', '#ffe14a', '#ff7ac0', '#7fe0ff']
export const STARS = ['#fff6a0', '#ffe14a', '#c8ffb0', '#ffffff']
export const CONFETTI_FRAMES = 6

export class Sprites {
  readonly k: number
  readonly dpr: number
  private z = new Map<string, HTMLCanvasElement>()
  private signs = new Map<string, HTMLCanvasElement>()
  private fx = new Map<string, HTMLCanvasElement>()

  constructor(k: number, dpr: number) { this.k = k; this.dpr = dpr }

  private cached(m: Map<string, HTMLCanvasElement>, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
    let c = m.get(key)
    if (!c) {
      const [cv, g] = mk(w, h)
      draw(g)
      m.set(key, cv)
      c = cv
    }
    return c
  }

  /** a walking zombie without its sign. frame 0 or 1. */
  zombie(skin: number, extra: number, frame: number, crown: boolean) {
    const k = this.k
    return this.cached(this.z, `z${skin}.${extra}.${frame}.${crown ? 1 : 0}`, ZW * k, ZH * k, (g) => {
      g.scale(k, k)
      drawZombie(g, SKINS[skin], extra, frame, crown, skin)
    })
  }

  /** the board a zombie holds (and the hands that hold it). label '' = blank. dots = small chord dots. */
  sign(label: string, skin: number, dots = 0) {
    const k = this.k
    return this.cached(this.signs, `s${label}|${skin}|${dots}`, ZW * k, ZH * k, (g) => {
      g.scale(k, k)
      drawSign(g, label, SKINS[skin], dots)
    })
  }

  king(frame: number) {
    const k = this.k
    return this.cached(this.z, `k${frame}`, KW * k, KH * k, (g) => {
      g.scale(k, k)
      drawKing(g, frame)
    })
  }

  /** The King's sign: the next notes of the song. chips[0] is the one to play now. */
  kingSign(chips: string[]) {
    const k = this.k
    return this.cached(this.signs, 'K' + chips.join(','), KW * k, KH * k, (g) => {
      g.scale(k, k)
      drawKingSign(g, chips)
    })
  }

  star(i: number) {
    const s = 22 * this.dpr
    return this.cached(this.fx, 'star' + i, s, s, (g) => {
      g.translate(s / 2, s / 2)
      g.fillStyle = STARS[i % STARS.length]
      g.strokeStyle = 'rgba(40,90,40,.55)'
      g.lineWidth = 1.2 * this.dpr
      g.lineJoin = 'round'
      g.beginPath()
      const R = s * 0.46, r = s * 0.2
      for (let n = 0; n < 10; n++) {
        const a = -Math.PI / 2 + (n * Math.PI) / 5
        const rad = n % 2 ? r : R
        g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
      }
      g.closePath(); g.fill(); g.stroke()
    })
  }

  confetti(ci: number, frame: number) {
    const d = this.dpr
    const w = 16 * d, h = 16 * d
    return this.cached(this.fx, `c${ci}.${frame}`, w, h, (g) => {
      g.translate(w / 2, h / 2)
      g.rotate((frame / CONFETTI_FRAMES) * Math.PI)
      g.fillStyle = CONFETTI[ci % CONFETTI.length]
      g.fillRect(-6.5 * d, -3.4 * d, 13 * d, 6.8 * d)
    })
  }

  /** soft round puff, white with a minty edge */
  puff() {
    const s = 64 * this.dpr
    return this.cached(this.fx, 'puff', s, s, (g) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
      gr.addColorStop(0, 'rgba(235,255,225,.95)')
      gr.addColorStop(0.55, 'rgba(160,235,150,.55)')
      gr.addColorStop(1, 'rgba(120,220,120,0)')
      g.fillStyle = gr; g.fillRect(0, 0, s, s)
    })
  }

  smoke() {
    const s = 48 * this.dpr
    return this.cached(this.fx, 'smoke', s, s, (g) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
      gr.addColorStop(0, 'rgba(190,190,215,.8)')
      gr.addColorStop(0.6, 'rgba(150,150,185,.35)')
      gr.addColorStop(1, 'rgba(120,120,160,0)')
      g.fillStyle = gr; g.fillRect(0, 0, s, s)
    })
  }

  shadow() {
    const w = 90 * this.dpr, h = 26 * this.dpr
    return this.cached(this.fx, 'shadow', w, h, (g) => {
      g.translate(w / 2, h / 2); g.scale(1, h / w)
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, w / 2)
      gr.addColorStop(0, 'rgba(8,4,24,.55)'); gr.addColorStop(1, 'rgba(8,4,24,0)')
      g.fillStyle = gr; g.fillRect(-w / 2, -w / 2, w, w)
    })
  }

  /** a tall soft column of coloured light for a lane (1 px wide, stretched). Cached per hue. */
  laneGlow(hue: number) {
    const hh = Math.round(hue / 10) * 10
    return this.cached(this.fx, 'lane' + hh, 4, 128, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 128)
      gr.addColorStop(0, `hsla(${hh},90%,70%,0)`)
      gr.addColorStop(0.6, `hsla(${hh},90%,66%,.35)`)
      gr.addColorStop(1, `hsla(${hh},95%,72%,.9)`)
      g.fillStyle = gr; g.fillRect(0, 0, 4, 128)
    })
  }

  /** a wisp of ground mist */
  fog() {
    const w = 260 * this.dpr, h = 44 * this.dpr
    return this.cached(this.fx, 'fog', w, h, (g) => {
      g.translate(w / 2, h / 2); g.scale(1, h / w)
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, w / 2)
      gr.addColorStop(0, 'rgba(190,185,240,.5)'); gr.addColorStop(0.6, 'rgba(160,155,225,.22)'); gr.addColorStop(1, 'rgba(150,145,220,0)')
      g.fillStyle = gr; g.fillRect(-w / 2, -w / 2, w, w)
    })
  }

  /** a tiny friendly bat silhouette, wings up (0) or down (1) */
  bat(frame: number) {
    const d = this.dpr, w = 30 * d, h = 18 * d
    return this.cached(this.fx, 'bat' + frame, w, h, (g) => {
      g.scale(d, d); g.translate(15, 9)
      g.fillStyle = '#1c1740'
      const up = frame === 0 ? -7 : 5
      g.beginPath(); g.ellipse(0, 1, 3.6, 4.6, 0, 0, TAU); g.fill()
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(s * 2, -1); g.quadraticCurveTo(s * 9, up - 3, s * 14, up + 2); g.quadraticCurveTo(s * 10, 1 + up * 0.2, s * 7, 3); g.quadraticCurveTo(s * 5, 0, s * 2, 4); g.closePath(); g.fill()
      }
      g.beginPath(); g.moveTo(-2.6, -3); g.lineTo(-2, -7); g.lineTo(0, -4); g.lineTo(2, -7); g.lineTo(2.6, -3); g.closePath(); g.fill()
      g.fillStyle = '#ffe14a'; g.fillRect(-2, -1.5, 1.3, 1.3); g.fillRect(0.8, -1.5, 1.3, 1.3)
    })
  }

  mound() {
    const w = 96 * this.dpr, h = 30 * this.dpr
    return this.cached(this.fx, 'mound', w, h, (g) => {
      g.translate(w / 2, h / 2); g.scale(1, h / w)
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, w / 2)
      gr.addColorStop(0, '#7a5638'); gr.addColorStop(0.7, '#5a3d2b'); gr.addColorStop(1, 'rgba(70,48,34,0)')
      g.fillStyle = gr; g.fillRect(-w / 2, -w / 2, w, w)
    })
  }
}

// ---------------- art ----------------

function drawZombie(g: CanvasRenderingContext2D, S: Skin, extra: number, frame: number, crown: boolean, outfit: number) {
  g.save()
  g.translate(0, 12)
  g.lineCap = 'round'; g.lineJoin = 'round'
  // legs: the feet take turns lifting
  const lift = frame === 0 ? [-6, 0] : [0, -6]
  for (let i = 0; i < 2; i++) {
    const lx = 32 + i * 21, ly = 96 + lift[i]
    g.fillStyle = S.pants; rr(g, lx, ly, 15, 38, 5); g.fill()
    g.fillStyle = 'rgba(0,0,20,.22)'; rr(g, lx + 9, ly + 2, 6, 36, 4); g.fill()
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(lx + 2, ly + 4, 2.5, 26)
    g.fillStyle = '#2d2540'
    g.beginPath(); g.ellipse(lx + 7.5 + (i ? 2 : -2), 136 + lift[i], 11, 5.5, 0, 0, TAU); g.fill()
  }
  // arms reach out to the sign
  for (const s of [-1, 1]) {
    const sx = 50 + s * 21, sy = 70, hx = 50 + s * 42, hy = 92 + (frame === 0 ? s : -s) * 2
    const mx = sx + (hx - sx) * 0.5, my = sy + (hy - sy) * 0.5
    g.strokeStyle = S.shirt; g.lineWidth = 11
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(mx, my); g.stroke()
    g.strokeStyle = S.skin; g.lineWidth = 8
    g.beginPath(); g.moveTo(mx, my); g.lineTo(hx, hy); g.stroke()
  }
  // torso with a torn hem
  g.beginPath()
  g.moveTo(27, 64); g.quadraticCurveTo(50, 55, 73, 64); g.lineTo(75, 104)
  for (let n = 1; n <= 8; n++) g.lineTo(75 - n * 6.25, n % 2 ? 113 : 104)
  g.closePath()
  g.fillStyle = S.shirt; g.fill()
  g.save(); g.clip()
  g.fillStyle = S.shirtD; g.fillRect(20, 80, 60, 6)
  g.fillStyle = S.dark
  g.beginPath(); g.moveTo(34, 92); g.lineTo(44, 90); g.lineTo(46, 99); g.lineTo(38, 102); g.closePath(); g.fill()
  // outfit: stripes, a star pocket or a bow tie, so the crowd is not three clones
  if (outfit === 0) {
    g.fillStyle = 'rgba(255,255,255,.22)'
    for (let y = 68; y < 112; y += 12) g.fillRect(20, y, 60, 4.5)
  } else if (outfit === 1) {
    g.fillStyle = 'rgba(255,255,255,.28)'; rr(g, 56, 84, 14, 14, 3); g.fill()
    g.fillStyle = '#ffe14a'; g.beginPath(); for (let n = 0; n < 10; n++) { const a = -Math.PI / 2 + (n * Math.PI) / 5, r = n % 2 ? 2.4 : 5; g.lineTo(63 + Math.cos(a) * r, 91 + Math.sin(a) * r) } g.closePath(); g.fill()
  } else {
    g.fillStyle = '#ffe14a'; g.fillRect(46, 64, 8, 24)
    g.fillStyle = '#ff4f6e'; g.beginPath(); g.moveTo(50, 70); g.lineTo(38, 63); g.lineTo(38, 77); g.closePath(); g.moveTo(50, 70); g.lineTo(62, 63); g.lineTo(62, 77); g.closePath(); g.fill()
  }
  g.fillStyle = 'rgba(0,0,30,.2)'; g.fillRect(60, 60, 20, 60)
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(27, 62, 6, 50)
  g.restore()
  // ears + head
  g.fillStyle = S.skin; g.strokeStyle = S.dark; g.lineWidth = 2
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(50 + s * 28, 38, 5.5, 7.5, 0, 0, TAU); g.fill(); g.stroke() }
  g.beginPath(); g.ellipse(50, 34, 29, 26, 0, 0, TAU); g.fill(); g.stroke()
  g.save(); g.beginPath(); g.ellipse(50, 34, 28, 25, 0, 0, TAU); g.clip()
  g.fillStyle = 'rgba(0,40,20,.16)'; g.beginPath(); g.ellipse(58, 46, 34, 26, 0, 0, TAU); g.fill()
  g.fillStyle = 'rgba(255,255,230,.26)'; g.beginPath(); g.ellipse(38, 17, 13, 6, -0.4, 0, TAU); g.fill()
  g.restore()
  // extras on top
  if (extra === 0) { // leaf sprout
    g.strokeStyle = '#3f9a3a'; g.lineWidth = 3
    g.beginPath(); g.moveTo(50, 9); g.quadraticCurveTo(47, 0, 50, -6); g.stroke()
    g.fillStyle = '#58c24a'
    for (const s of [-1, 1]) { g.save(); g.translate(50 + s * 7, -6); g.rotate(s * 0.6); g.beginPath(); g.ellipse(0, 0, 8, 4, 0, 0, TAU); g.fill(); g.restore() }
  } else if (extra === 1) { // bandage
    g.save(); g.translate(50, 15); g.rotate(-0.14)
    g.fillStyle = '#f2e8c8'; g.fillRect(-26, -5, 52, 10)
    g.strokeStyle = 'rgba(150,120,70,.6)'; g.lineWidth = 1.2
    g.beginPath(); g.moveTo(-9, -5); g.lineTo(-9, 5); g.moveTo(10, -5); g.lineTo(10, 5); g.stroke()
    g.restore()
  } else if (extra === 2) { // messy hair
    g.fillStyle = S.hair
    g.beginPath(); g.moveTo(26, 22); g.lineTo(24, 2); g.lineTo(36, 15); g.lineTo(42, -4); g.lineTo(50, 12); g.lineTo(60, -3); g.lineTo(64, 14); g.lineTo(76, 3); g.lineTo(74, 24); g.closePath(); g.fill()
  } else if (extra === 4) { // top hat
    g.fillStyle = '#2a2540'; g.strokeStyle = '#14101f'; g.lineWidth = 2
    rr(g, 34, -16, 32, 30, 3); g.fill(); g.stroke()
    g.beginPath(); g.ellipse(50, 14, 30, 5.5, 0, 0, TAU); g.fill(); g.stroke()
    g.fillStyle = '#b46cff'; g.fillRect(34.5, 3, 31, 6)
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(38, -13, 4, 14)
  } else if (extra === 5) { // big headphones
    g.strokeStyle = '#3a3a52'; g.lineWidth = 5
    g.beginPath(); g.arc(50, 32, 31, Math.PI * 1.08, Math.PI * 1.92); g.stroke()
    g.fillStyle = '#4fb4ff'; g.strokeStyle = '#2a5f9a'; g.lineWidth = 2
    for (const s of [-1, 1]) { rr(g, 50 + s * 30 - 6, 28, 12, 20, 5); g.fill(); g.stroke() }
  } else { // party hat
    g.fillStyle = '#ff5fa8'
    g.beginPath(); g.moveTo(31, 14); g.lineTo(69, 14); g.lineTo(52, -14); g.closePath(); g.fill()
    g.strokeStyle = '#ffe14a'; g.lineWidth = 3
    g.beginPath(); g.moveTo(37, 6); g.lineTo(62, 4); g.moveTo(43, -4); g.lineTo(57, -6); g.stroke()
    g.fillStyle = '#ffe14a'; g.beginPath(); g.arc(52, -15, 4.5, 0, TAU); g.fill()
  }
  // cheeks + stitches
  g.fillStyle = 'rgba(255,130,150,.45)'
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(50 + s * 20, 44, 6, 4, 0, 0, TAU); g.fill() }
  g.strokeStyle = S.dark; g.lineWidth = 1.6
  g.beginPath(); g.moveTo(66, 48); g.lineTo(74, 46); g.stroke()
  for (const x of [68, 70.5, 73]) { g.beginPath(); g.moveTo(x, 44); g.lineTo(x + 0.6, 50); g.stroke() }
  // mismatched googly eyes
  g.lineWidth = 1.8; g.strokeStyle = '#26382c'; g.fillStyle = '#fff'
  g.beginPath(); g.arc(38, 30, 10.5, 0, TAU); g.fill(); g.stroke()
  g.beginPath(); g.arc(62, 28, 7.5, 0, TAU); g.fill(); g.stroke()
  g.fillStyle = '#16151c'
  g.beginPath(); g.arc(40, 34, 4.6, 0, TAU); g.fill()
  g.beginPath(); g.arc(60, 26.5, 3.4, 0, TAU); g.fill()
  g.fillStyle = '#fff'
  g.beginPath(); g.arc(41.2, 32.2, 1.5, 0, TAU); g.fill()
  g.beginPath(); g.arc(61, 25.4, 1.1, 0, TAU); g.fill()
  // nose + goofy grin with a missing tooth
  g.fillStyle = S.dark; g.beginPath(); g.ellipse(51, 40, 3.2, 2.2, 0, 0, TAU); g.fill()
  g.fillStyle = '#3a1830'
  g.beginPath(); g.moveTo(32, 45); g.quadraticCurveTo(50, 66, 69, 44); g.quadraticCurveTo(50, 50, 32, 45); g.closePath(); g.fill()
  g.fillStyle = '#fff'; g.fillRect(37, 46.5, 6, 6); g.fillRect(56, 46.5, 6, 6)
  g.fillStyle = '#f07aa0'; g.beginPath(); g.ellipse(53, 57, 5.5, 2.6, 0, 0, TAU); g.fill()
  if (crown) {
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#b87a00'; g.lineWidth = 2.2
    g.beginPath(); g.moveTo(28, 14); g.lineTo(24, -12); g.lineTo(38, 0); g.lineTo(50, -16); g.lineTo(62, 0); g.lineTo(76, -12); g.lineTo(72, 14); g.closePath(); g.fill(); g.stroke()
    const jewel = ['#ff4f6e', '#4fb4ff', '#7bdc5a']
    ;[[24, -12], [50, -16], [76, -12]].forEach(([x, y], i) => { g.fillStyle = jewel[i]; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill() })
  }
  g.restore()
}

function drawSign(g: CanvasRenderingContext2D, label: string, S: Skin, dots: number) {
  const bx = 9, by = 80, bw = 82, bh = 44
  // board
  g.fillStyle = 'rgba(30,15,5,.28)'; rr(g, bx + 2, by + 4, bw, bh, 7); g.fill()
  g.fillStyle = '#dba765'; rr(g, bx, by, bw, bh, 7); g.fill()
  g.strokeStyle = '#8a5a2b'; g.lineWidth = 3; g.stroke()
  g.fillStyle = 'rgba(255,240,200,.45)'; rr(g, bx + 4, by + 4, bw - 8, 5, 2.5); g.fill()
  g.fillStyle = '#8a5a2b'
  for (const [nx, ny] of [[bx + 7, by + 8], [bx + bw - 7, by + 8], [bx + 7, by + bh - 8], [bx + bw - 7, by + bh - 8]]) { g.beginPath(); g.arc(nx, ny, 1.8, 0, TAU); g.fill() }
  // label
  if (label) {
    const maxW = bw - 22
    let size = dots ? 32 : 40
    g.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`
    const w = g.measureText(label).width
    if (w > maxW) { size = Math.floor((size * maxW) / w); g.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif` }
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillStyle = '#3b2412'
    g.fillText(label, bx + bw / 2, by + bh / 2 + (dots ? -4 : 1.5))
  }
  if (dots) {
    g.fillStyle = '#3b2412'
    for (let i = 0; i < dots; i++) { g.beginPath(); g.arc(bx + bw / 2 + (i - (dots - 1) / 2) * 9, by + bh - 8, 2.8, 0, TAU); g.fill() }
  }
  // hands gripping the board
  for (const s of [-1, 1]) {
    const hx = s < 0 ? bx + 1 : bx + bw - 1, hy = by + 18
    g.fillStyle = S.skin; g.strokeStyle = S.dark; g.lineWidth = 1.8
    g.beginPath(); g.arc(hx, hy, 8, 0, TAU); g.fill(); g.stroke()
    g.fillStyle = S.dark
    for (let n = -1; n <= 1; n++) { g.beginPath(); g.arc(hx - s * 4, hy + n * 4.6, 1.6, 0, TAU); g.fill() }
  }
}

function drawKing(g: CanvasRenderingContext2D, frame: number) {
  g.lineCap = 'round'; g.lineJoin = 'round'
  const skin = '#8fd05a', dark = '#62a237'
  // cape
  g.fillStyle = '#5e3a9a'
  g.beginPath(); g.moveTo(26, 98); g.lineTo(124, 98); g.lineTo(144, 176); g.lineTo(6, 176); g.closePath(); g.fill()
  // shoes
  const lift = frame === 0 ? [-6, 0] : [0, -6]
  for (let i = 0; i < 2; i++) {
    g.fillStyle = '#2d2540'
    g.beginPath(); g.ellipse(52 + i * 46, 181 + lift[i], 17, 8, 0, 0, TAU); g.fill()
    g.fillStyle = '#ffd23f'; g.fillRect(48 + i * 46, 176 + lift[i], 8, 6)
  }
  // robe
  g.fillStyle = '#d0405f'
  g.beginPath(); g.moveTo(34, 96); g.lineTo(116, 96); g.lineTo(128, 172); g.lineTo(22, 172); g.closePath(); g.fill()
  g.fillStyle = '#a82c4a'
  g.beginPath(); g.moveTo(54, 100); g.lineTo(62, 100); g.lineTo(58, 172); g.lineTo(46, 172); g.closePath(); g.fill()
  g.beginPath(); g.moveTo(88, 100); g.lineTo(96, 100); g.lineTo(104, 172); g.lineTo(92, 172); g.closePath(); g.fill()
  // ermine hem
  g.fillStyle = '#fff'; rr(g, 18, 162, 114, 15, 7); g.fill()
  g.fillStyle = '#2a2040'
  for (let x = 28; x < 128; x += 16) { g.beginPath(); g.ellipse(x, 171, 2.4, 3.6, 0, 0, TAU); g.fill() }
  // arms out to the sign
  for (const s of [-1, 1]) {
    g.strokeStyle = '#d0405f'; g.lineWidth = 14
    g.beginPath(); g.moveTo(75 + s * 38, 108); g.lineTo(75 + s * 52, 126); g.stroke()
    g.strokeStyle = skin; g.lineWidth = 10
    g.beginPath(); g.moveTo(75 + s * 52, 126); g.lineTo(75 + s * 66, 142); g.stroke()
  }
  // ermine collar
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(75, 98, 40, 12, 0, 0, TAU); g.fill()
  g.fillStyle = '#2a2040'
  for (const x of [48, 62, 75, 88, 102]) { g.beginPath(); g.ellipse(x, 101, 2.2, 3.4, 0, 0, TAU); g.fill() }
  // head
  g.fillStyle = skin; g.strokeStyle = dark; g.lineWidth = 2.5
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(75 + s * 42, 64, 7, 10, 0, 0, TAU); g.fill(); g.stroke() }
  g.beginPath(); g.ellipse(75, 62, 42, 36, 0, 0, TAU); g.fill(); g.stroke()
  // cheeks
  g.fillStyle = 'rgba(255,130,150,.45)'
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(75 + s * 28, 74, 8, 5, 0, 0, TAU); g.fill() }
  // eyes
  g.lineWidth = 2.2; g.strokeStyle = '#26382c'; g.fillStyle = '#fff'
  g.beginPath(); g.arc(57, 56, 13, 0, TAU); g.fill(); g.stroke()
  g.beginPath(); g.arc(94, 53, 9.5, 0, TAU); g.fill(); g.stroke()
  g.fillStyle = '#16151c'
  g.beginPath(); g.arc(60, 61, 5.8, 0, TAU); g.fill()
  g.beginPath(); g.arc(92, 51, 4.3, 0, TAU); g.fill()
  g.fillStyle = '#fff'; g.beginPath(); g.arc(61.5, 58.8, 1.9, 0, TAU); g.fill(); g.beginPath(); g.arc(93, 49.6, 1.4, 0, TAU); g.fill()
  // grin
  g.fillStyle = '#3a1830'
  g.beginPath(); g.moveTo(48, 76); g.quadraticCurveTo(75, 100, 102, 75); g.quadraticCurveTo(75, 82, 48, 76); g.closePath(); g.fill()
  g.fillStyle = '#fff'; g.fillRect(56, 78, 8, 8); g.fillRect(84, 78, 8, 8)
  g.fillStyle = '#f07aa0'; g.beginPath(); g.ellipse(78, 90, 7, 3, 0, 0, TAU); g.fill()
  // moustache
  g.fillStyle = '#f4f1ff'; g.strokeStyle = '#c9c4e6'; g.lineWidth = 1.4
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(75, 70); g.quadraticCurveTo(75 + s * 18, 62, 75 + s * 32, 74); g.quadraticCurveTo(75 + s * 18, 76, 75, 74); g.closePath(); g.fill(); g.stroke()
  }
  // nose
  g.fillStyle = dark; g.beginPath(); g.ellipse(75, 68, 4.5, 3.2, 0, 0, TAU); g.fill()
  // crown
  g.fillStyle = '#ffd23f'; g.strokeStyle = '#b87a00'; g.lineWidth = 2.6
  g.beginPath(); g.moveTo(40, 40); g.lineTo(34, 4); g.lineTo(54, 20); g.lineTo(75, -2); g.lineTo(96, 20); g.lineTo(116, 4); g.lineTo(110, 40); g.closePath(); g.fill(); g.stroke()
  const jewel = ['#ff4f6e', '#4fb4ff', '#7bdc5a', '#ff4f6e', '#4fb4ff']
  ;[[34, 4], [54, 20], [75, -2], [96, 20], [116, 4]].forEach(([x, y], i) => { g.fillStyle = jewel[i]; g.beginPath(); g.arc(x, y + (i === 2 ? 1 : 0), 4.6, 0, TAU); g.fill() })
  g.fillStyle = '#c0392b'; g.fillRect(40, 33, 70, 7)
}

function drawKingSign(g: CanvasRenderingContext2D, chips: string[]) {
  // chips look like "E" or "E|4" (letter, then a small octave number in Normal mode)
  const bx = 8, by = 118, bw = 134, bh = 50
  g.fillStyle = 'rgba(30,15,5,.3)'; rr(g, bx + 2, by + 4, bw, bh, 8); g.fill()
  g.fillStyle = '#dba765'; rr(g, bx, by, bw, bh, 8); g.fill()
  g.strokeStyle = '#8a5a2b'; g.lineWidth = 3.2; g.stroke()
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  const parts = chips.map((c) => c.split('|'))
  const size = (i: number) => (i === 0 ? 30 : 21)
  const wOf = (i: number) => {
    g.font = `800 ${size(i)}px ${FONT}`
    let w = g.measureText(parts[i][0]).width
    if (parts[i][1]) { g.font = `800 ${i === 0 ? 15 : 12}px ${FONT}`; w += g.measureText(parts[i][1]).width + 1 }
    return w + (i === 0 ? 16 : 6)
  }
  const room = bw - 30
  let n = Math.min(5, parts.length)
  const total = (k: number) => { let t = 0; for (let i = 0; i < k; i++) t += wOf(i); return t }
  while (n > 2 && total(n) > room) n--
  let x = bx + bw / 2 - total(n) / 2
  g.textBaseline = 'middle'; g.textAlign = 'left'
  const cy = by + bh / 2 + 1
  for (let i = 0; i < n; i++) {
    const w = wOf(i)
    if (i === 0) {
      g.fillStyle = '#ffe36a'; g.strokeStyle = '#a56a00'; g.lineWidth = 2.4
      rr(g, x, cy - 19, w, 38, 8); g.fill(); g.stroke()
    }
    const pad = i === 0 ? 8 : 3
    g.fillStyle = '#3b2412'; g.globalAlpha = i === 0 ? 1 : 1 - i * 0.12
    g.font = `800 ${size(i)}px ${FONT}`
    g.fillText(parts[i][0], x + pad, cy + 1)
    if (parts[i][1]) {
      const mw = g.measureText(parts[i][0]).width
      g.font = `800 ${i === 0 ? 15 : 12}px ${FONT}`
      g.fillText(parts[i][1], x + pad + mw + 1, cy + (i === 0 ? 9 : 7))
    }
    g.globalAlpha = 1
    x += w
  }
  for (const s of [-1, 1]) {
    const hx = s < 0 ? bx + 1 : bx + bw - 1, hy = by + 20
    g.fillStyle = '#8fd05a'; g.strokeStyle = '#62a237'; g.lineWidth = 2
    g.beginPath(); g.arc(hx, hy, 10, 0, TAU); g.fill(); g.stroke()
    g.fillStyle = '#62a237'
    for (let m = -1; m <= 1; m++) { g.beginPath(); g.arc(hx - s * 5, hy + m * 5.5, 1.8, 0, TAU); g.fill() }
  }
}
