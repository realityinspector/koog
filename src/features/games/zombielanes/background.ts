// Zombie Lanes backdrop: a spooky-cute graveyard horizon, the ground, and one lane per real key.
// Rendered ONCE into an offscreen canvas (again only when the size or the keybed range changes).
const TAU = Math.PI * 2

export interface Lane {
  note: number
  /** left edge and width in canvas CSS px, copied from the real on-screen key */
  x: number
  w: number
  cx: number
  black: boolean
}

// tiny deterministic random so the graveyard looks the same every time
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

export function renderBackground(w: number, h: number, dpr: number, lanes: Lane[], horizonY: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr))
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  const rand = rng(7)

  // sky: deep indigo to a glowing lavender at the horizon (dark, never black)
  const sky = g.createLinearGradient(0, 0, 0, horizonY)
  sky.addColorStop(0, '#2c2563'); sky.addColorStop(0.6, '#46408a'); sky.addColorStop(1, '#7468b4')
  g.fillStyle = sky; g.fillRect(0, 0, w, horizonY + 2)
  // stars
  for (let i = 0; i < 46; i++) {
    const x = rand() * w, y = rand() * horizonY * 0.8, r = 0.6 + rand() * 1.2
    g.fillStyle = `rgba(255,250,220,${0.35 + rand() * 0.5})`
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill()
  }
  // a friendly sleepy moon
  const mr = Math.max(14, Math.min(horizonY * 0.28, 38)), mx = w * 0.3, my = horizonY * 0.6
  const glow = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 2.6)
  glow.addColorStop(0, 'rgba(255,240,180,.38)'); glow.addColorStop(1, 'rgba(255,240,180,0)')
  g.fillStyle = glow; g.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6)
  g.fillStyle = '#fff1b8'; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill()
  g.fillStyle = 'rgba(210,190,120,.45)'
  for (const [dx, dy, r] of [[-0.35, -0.3, 0.2], [0.3, 0.2, 0.16], [-0.1, 0.45, 0.12]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); g.fill() }
  g.strokeStyle = '#7a6430'; g.lineWidth = Math.max(1.4, mr * 0.07); g.lineCap = 'round'
  g.beginPath(); g.arc(mx - mr * 0.33, my - mr * 0.05, mr * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke()
  g.beginPath(); g.arc(mx + mr * 0.33, my - mr * 0.05, mr * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke()
  g.beginPath(); g.arc(mx, my + mr * 0.3, mr * 0.2, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke()
  // wisps of cloud
  g.fillStyle = 'rgba(90,80,150,.55)'
  for (const [fx, fy, fw] of [[0.7, 0.55, 0.16], [0.18, 0.3, 0.12], [0.42, 0.7, 0.1]]) {
    const cx = w * fx, cy = horizonY * fy, cw = w * fw
    g.beginPath(); g.ellipse(cx, cy, cw / 2, 6, 0, 0, TAU); g.ellipse(cx + cw * 0.2, cy - 4, cw / 3.4, 5, 0, 0, TAU); g.fill()
  }

  // distant hills
  const hill = (base: number, amp: number, col: string, seed: number) => {
    const r2 = rng(seed), ph = r2() * 6, f2 = 0.004 + r2() * 0.004
    g.fillStyle = col
    g.beginPath(); g.moveTo(0, horizonY + 2)
    for (let x = 0; x <= w; x += 8) g.lineTo(x, base - Math.sin(x * f2 + ph) * amp - Math.sin(x * f2 * 2.3 + ph) * amp * 0.4)
    g.lineTo(w, horizonY + 2); g.closePath(); g.fill()
  }
  hill(horizonY - 6, horizonY * 0.16, '#463d82', 3)
  hill(horizonY - 2, horizonY * 0.1, '#3a3270', 11)

  // graveyard props along the horizon
  const unit = Math.max(10, horizonY * 0.3)
  const prop = (x: number, kind: number) => {
    const baseY = horizonY - 1
    g.save(); g.translate(x, baseY)
    if (kind === 0 || kind === 1) { // tombstone
      const tw = unit * 0.9, th = unit * (kind ? 1.35 : 1.05)
      g.fillStyle = '#a9a3d6'; g.strokeStyle = '#5b5496'; g.lineWidth = 1.6
      g.beginPath(); g.moveTo(-tw / 2, 0); g.lineTo(-tw / 2, -th + tw / 2); g.arc(0, -th + tw / 2, tw / 2, Math.PI, 0); g.lineTo(tw / 2, 0); g.closePath(); g.fill(); g.stroke()
      g.fillStyle = '#5b5496'; g.font = `800 ${Math.round(unit * 0.3)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(kind ? 'BOO' : 'RIP', 0, -th * 0.45)
    } else if (kind === 2) { // cross
      g.fillStyle = '#a9a3d6'; g.strokeStyle = '#5b5496'; g.lineWidth = 1.4
      g.beginPath(); g.rect(-unit * 0.09, -unit * 1.3, unit * 0.18, unit * 1.3); g.rect(-unit * 0.4, -unit * 0.95, unit * 0.8, unit * 0.18); g.fill(); g.stroke()
    } else if (kind === 3) { // pumpkin
      g.fillStyle = '#ff9a3c'; g.strokeStyle = '#b65a12'; g.lineWidth = 1.4
      g.beginPath(); g.ellipse(0, -unit * 0.35, unit * 0.5, unit * 0.36, 0, 0, TAU); g.fill(); g.stroke()
      g.fillStyle = '#3d2a14'
      g.beginPath(); g.moveTo(-unit * 0.22, -unit * 0.44); g.lineTo(-unit * 0.1, -unit * 0.34); g.lineTo(-unit * 0.3, -unit * 0.34); g.closePath()
      g.moveTo(unit * 0.22, -unit * 0.44); g.lineTo(unit * 0.3, -unit * 0.34); g.lineTo(unit * 0.1, -unit * 0.34); g.closePath()
      g.moveTo(-unit * 0.22, -unit * 0.2); g.quadraticCurveTo(0, -unit * 0.08, unit * 0.22, -unit * 0.2); g.quadraticCurveTo(0, -unit * 0.15, -unit * 0.22, -unit * 0.2); g.fill()
      g.fillStyle = '#5a8a3a'; g.fillRect(-unit * 0.05, -unit * 0.8, unit * 0.1, unit * 0.14)
    } else { // bare, crooked tree
      g.strokeStyle = '#2c2556'; g.lineWidth = Math.max(3, unit * 0.14); g.lineCap = 'round'
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-unit * 0.2, -unit * 0.8, unit * 0.1, -unit * 1.5); g.stroke()
      g.lineWidth = Math.max(2, unit * 0.08)
      g.beginPath(); g.moveTo(-unit * 0.05, -unit * 0.9); g.lineTo(-unit * 0.55, -unit * 1.25); g.moveTo(unit * 0.02, -unit * 1.15); g.lineTo(unit * 0.5, -unit * 1.55); g.stroke()
    }
    g.restore()
  }
  // a fence behind the props
  g.strokeStyle = '#2f2862'; g.fillStyle = '#2f2862'; g.lineWidth = 2
  const post = Math.max(8, unit * 0.42)
  g.beginPath(); g.moveTo(0, horizonY - post * 0.4); g.lineTo(w, horizonY - post * 0.4); g.moveTo(0, horizonY - post * 0.75); g.lineTo(w, horizonY - post * 0.75); g.stroke()
  for (let x = 4; x < w; x += post * 0.7) {
    g.beginPath(); g.moveTo(x - 3, horizonY); g.lineTo(x - 3, horizonY - post + 4); g.lineTo(x, horizonY - post - 2); g.lineTo(x + 3, horizonY - post + 4); g.lineTo(x + 3, horizonY); g.closePath(); g.fill()
  }
  const step = Math.max(70, unit * 3.4)
  for (let x = step * 0.4, i = 0; x < w - 20; x += step * (0.8 + rand() * 0.5), i++) {
    if (Math.abs(x - mx) < mr) continue
    prop(x, [0, 1, 3, 2, 4, 1, 0, 3][(i + Math.floor(rand() * 2)) % 8])
  }

  // ground
  const ground = g.createLinearGradient(0, horizonY, 0, h)
  ground.addColorStop(0, '#3a3677'); ground.addColorStop(1, '#27214f')
  g.fillStyle = ground; g.fillRect(0, horizonY, w, h - horizonY)
  // little grass tufts and mushrooms on the ground
  for (let i = 0; i < 26; i++) {
    const x = rand() * w, y = horizonY + 6 + rand() * (h - horizonY - 20)
    g.strokeStyle = 'rgba(120,200,140,.25)'; g.lineWidth = 1.5; g.lineCap = 'round'
    g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x - 4, y - 5); g.moveTo(x, y); g.lineTo(x, y - 7); g.moveTo(x + 3, y); g.lineTo(x + 4, y - 5); g.stroke()
  }

  // lanes: one per real key, lined up with the keybed below
  const whites = lanes.filter((l) => !l.black).sort((a, b) => a.x - b.x)
  whites.forEach((l, i) => {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.085)'
    g.fillRect(l.x, horizonY, l.w, h - horizonY)
  })
  g.strokeStyle = 'rgba(200,185,255,.22)'; g.lineWidth = 1
  g.beginPath()
  for (const l of whites) { g.moveTo(Math.round(l.x) + 0.5, horizonY); g.lineTo(Math.round(l.x) + 0.5, h) }
  if (whites.length) { const e = whites[whites.length - 1]; g.moveTo(Math.round(e.x + e.w) + 0.5, horizonY); g.lineTo(Math.round(e.x + e.w) + 0.5, h) }
  g.stroke()
  for (const l of lanes) {
    if (!l.black) continue
    const grad = g.createLinearGradient(0, horizonY, 0, h)
    grad.addColorStop(0, 'rgba(14,8,40,.55)'); grad.addColorStop(1, 'rgba(14,8,40,.38)')
    g.fillStyle = grad; g.fillRect(l.x, horizonY, l.w, h - horizonY)
    g.strokeStyle = 'rgba(200,185,255,.2)'
    g.beginPath(); g.moveTo(Math.round(l.x) + 0.5, horizonY); g.lineTo(Math.round(l.x) + 0.5, h); g.moveTo(Math.round(l.x + l.w) + 0.5, horizonY); g.lineTo(Math.round(l.x + l.w) + 0.5, h); g.stroke()
  }
  // mist: the lanes fade in out of the fog at the horizon
  const mist = g.createLinearGradient(0, horizonY, 0, horizonY + (h - horizonY) * 0.45)
  mist.addColorStop(0, 'rgba(100,95,170,.9)'); mist.addColorStop(1, 'rgba(100,95,170,0)')
  g.fillStyle = mist; g.fillRect(0, horizonY, w, (h - horizonY) * 0.45)

  // the "keys" edge: where the zombies bite
  const edge = g.createLinearGradient(0, h - 26, 0, h)
  edge.addColorStop(0, 'rgba(110,255,170,0)'); edge.addColorStop(1, 'rgba(110,255,170,.34)')
  g.fillStyle = edge; g.fillRect(0, h - 26, w, 26)
  g.fillStyle = 'rgba(150,255,190,.75)'; g.fillRect(0, h - 3, w, 3)
  return c
}

/** soft red glow around the edges, stamped with a low alpha when a brain is lost (never a full-screen flash). */
export function renderVignette(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w / 2)); c.height = Math.max(1, Math.round(h / 2))
  const g = c.getContext('2d')!
  const r = Math.hypot(c.width, c.height) / 2
  const gr = g.createRadialGradient(c.width / 2, c.height / 2, r * 0.55, c.width / 2, c.height / 2, r)
  gr.addColorStop(0, 'rgba(255,70,90,0)'); gr.addColorStop(1, 'rgba(255,70,90,.9)')
  g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height)
  return c
}
