// Koogalien Racer picture: a top-down canvas, a smooth camera that follows the car, the road drawn straight from the timeline.
// Nothing is allocated per frame: paths are walked with moveTo/lineTo, scenery is built once per track, text is constant strings.
// Calm rules: reduced motion = a gentler camera, no turning with the car, no wobble. Nothing flashes: gates glow and fade over half a beat or more.
import { LEAD_BEATS, ROAD_HALF, RECOVER_BEATS, SPB, carAt, type Track } from './racerCore'
import { WORLDS, type World } from './tracks'
import type { RacerState, View } from './engine'
import type { Vehicle } from './vehicles'

export interface Camera { x: number; y: number; rot: number; zoom: number; init: boolean }
export const newCamera = (): Camera => ({ x: 0, y: 0, rot: 0, zoom: 1, init: false })

interface Props { xs: Float32Array; ys: Float32Array; kind: Uint8Array; n: number }
const propCache = new WeakMap<Track, Props>()
function propsFor(tr: Track): Props {
  let p = propCache.get(tr)
  if (p) return p
  const max = 140
  const xs = new Float32Array(max), ys = new Float32Array(max), kind = new Uint8Array(max)
  let n = 0, seed = (tr.n * 9301 + 49297) % 233280
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  for (let tries = 0; tries < 600 && n < max; tries++) {
    const j = Math.floor(rnd() * tr.n), side = rnd() < 0.5 ? -1 : 1, off = ROAD_HALF + 22 + rnd() * 150
    const x = tr.x[j] + Math.cos(tr.h[j]) * side * off, y = tr.y[j] + Math.sin(tr.h[j]) * side * off
    let ok = true
    for (let q = 0; q < tr.n; q += 2) { const dx = tr.x[q] - x, dy = tr.y[q] - y; if (dx * dx + dy * dy < (ROAD_HALF + 16) * (ROAD_HALF + 16)) { ok = false; break } }
    if (!ok) continue
    xs[n] = x; ys[n] = y; kind[n] = Math.floor(rnd() * 3); n++
  }
  p = { xs, ys, kind, n }
  propCache.set(tr, p)
  return p
}

const DASH = [16, 18], NODASH: number[] = []
const GRADE_COL = { perfect: '#46e07a', good: '#b8e04a', wrong: '#ff5a5a', missed: '#9aa0aa' } as const
const hue = (note: number) => `hsl(${(note % 12) * 30} 85% 60%)`
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const car = { x: 0, y: 0, heading: 0, d: 0 }
const base = { x: 0, y: 0, heading: 0, d: 0 }

function drawProp(ctx: CanvasRenderingContext2D, w: World, x: number, y: number, k: number, now: number) {
  switch (w.prop) {
    case 'flower':
      ctx.fillStyle = k === 0 ? '#ff7eb6' : k === 1 ? '#ffd23f' : '#fff'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.3); ctx.fill()
      ctx.fillStyle = '#ffec99'; ctx.beginPath(); ctx.arc(x, y, 2, 0, 6.3); ctx.fill()
      if (k === 2) { ctx.fillStyle = '#4c9a3a'; ctx.beginPath(); ctx.arc(x + 14, y + 6, 11, 0, 6.3); ctx.fill() }
      break
    case 'cactus':
      ctx.fillStyle = '#4d9a4d'; ctx.fillRect(x - 4, y - 14, 8, 26); ctx.fillRect(x - 12, y - 6, 8, 5); ctx.fillRect(x + 4, y - 2, 8, 5)
      if (k === 1) { ctx.fillStyle = '#b57a4a'; ctx.beginPath(); ctx.arc(x + 20, y + 8, 7, 0, 6.3); ctx.fill() }
      break
    case 'pine':
      ctx.fillStyle = '#2f6b4a'; ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x + 12, y + 10); ctx.lineTo(x - 12, y + 10); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x + 5, y - 6); ctx.lineTo(x - 5, y - 6); ctx.closePath(); ctx.fill()
      break
    case 'star': {
      const tw = 0.6 + 0.4 * Math.sin(now / 900 + x * 0.13 + y * 0.07)
      ctx.fillStyle = k === 0 ? `rgba(255,255,255,${0.5 * tw + 0.3})` : k === 1 ? `rgba(124,243,255,${0.45 * tw + 0.3})` : `rgba(255,170,255,${0.4 * tw + 0.3})`
      ctx.beginPath(); ctx.arc(x, y, k === 2 ? 4 : 2.4, 0, 6.3); ctx.fill()
      break
    }
  }
}

/** the car, pointing up, about 22 wide and 40 long */
function drawCar(ctx: CanvasRenderingContext2D, v: Vehicle, speed: number, now: number, reduced: boolean) {
  const wob = reduced ? 0 : Math.sin(now / 55) * 0.6 * speed
  ctx.save(); ctx.translate(wob, 0)
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(2, 3, 14, 22, 0, 0, 6.3); ctx.fill()
  const wheel = (x: number, y: number, r = 5) => { ctx.fillStyle = '#1d1d22'; ctx.fillRect(x - 3, y - r, 6, r * 2) }
  switch (v.id) {
    case 'bee':
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-14, -2, 9, 5, -0.5, 0, 6.3); ctx.ellipse(14, -2, 9, 5, 0.5, 0, 6.3); ctx.fill()
      wheel(-11, -10); wheel(11, -10); wheel(-11, 11); wheel(11, 11)
      ctx.fillStyle = v.color; ctx.beginPath(); ctx.ellipse(0, 0, 11, 19, 0, 0, 6.3); ctx.fill()
      ctx.fillStyle = v.accent; ctx.fillRect(-10, -2, 20, 4); ctx.fillRect(-9, 7, 18, 4)
      ctx.beginPath(); ctx.arc(0, -15, 6, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-4, -17, 3, 3); ctx.fillRect(1, -17, 3, 3)
      break
    case 'monster':
      for (const [x, y] of [[-13, -11], [13, -11], [-13, 12], [13, 12]]) { ctx.fillStyle = '#1d1d22'; ctx.fillRect(x - 5, y - 8, 10, 16) }
      ctx.fillStyle = v.color; ctx.fillRect(-10, -19, 20, 38); ctx.fillStyle = '#ffd7c9'; ctx.fillRect(-8, -13, 16, 9)
      ctx.fillStyle = v.accent; ctx.fillRect(-10, 2, 20, 3); ctx.fillRect(-8, 8, 16, 8)
      break
    case 'rocket':
      ctx.fillStyle = v.accent; ctx.beginPath(); ctx.moveTo(-5, 18); ctx.lineTo(0, 18 + (reduced ? 8 : 8 + Math.sin(now / 80) * 3 * speed + 4 * speed)); ctx.lineTo(5, 18); ctx.fill()
      ctx.fillStyle = v.color; ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(12, -6, 8, 18); ctx.lineTo(-8, 18); ctx.quadraticCurveTo(-12, -6, 0, -22); ctx.fill()
      ctx.fillStyle = v.accent; ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(-15, 20); ctx.lineTo(-8, 18); ctx.moveTo(8, 8); ctx.lineTo(15, 20); ctx.lineTo(8, 18); ctx.fill()
      ctx.fillStyle = '#6ec6ff'; ctx.beginPath(); ctx.arc(0, -6, 4, 0, 6.3); ctx.fill()
      break
    case 'snail':
      wheel(-9, 12, 6); wheel(9, 12, 6)
      ctx.fillStyle = v.color; ctx.beginPath(); ctx.ellipse(0, -2, 8, 20, 0, 0, 6.3); ctx.fill()
      ctx.fillStyle = v.accent; ctx.beginPath(); ctx.arc(0, 4, 11, 0, 6.3); ctx.fill()
      ctx.strokeStyle = '#c8924f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 4, 6, 0, 5); ctx.stroke()
      ctx.strokeStyle = v.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -18); ctx.lineTo(-5, -25); ctx.moveTo(3, -18); ctx.lineTo(5, -25); ctx.stroke()
      break
    case 'kart':
      wheel(-11, -11, 5); wheel(11, -11, 5); wheel(-12, 12, 6); wheel(12, 12, 6)
      ctx.fillStyle = v.color; ctx.beginPath(); ctx.moveTo(-6, -20); ctx.lineTo(6, -20); ctx.lineTo(10, 16); ctx.lineTo(-10, 16); ctx.closePath(); ctx.fill()
      ctx.fillStyle = v.accent; ctx.beginPath(); ctx.arc(0, 2, 5, 0, 6.3); ctx.fill(); ctx.fillRect(-9, 15, 18, 4)
      break
    case 'icecream':
      wheel(-11, -10); wheel(11, -10); wheel(-11, 11); wheel(11, 11)
      ctx.fillStyle = v.color; ctx.fillRect(-10, -19, 20, 38); ctx.fillStyle = v.accent; ctx.fillRect(-10, -19, 20, 7); ctx.fillRect(-10, 12, 20, 4)
      ctx.fillStyle = '#e8b86a'; ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(4, -2); ctx.lineTo(0, 9); ctx.fill()
      ctx.fillStyle = '#ff8fb3'; ctx.beginPath(); ctx.arc(0, -4, 5, 0, 6.3); ctx.fill()
      break
    default: // the family car
      wheel(-11, -11); wheel(11, -11); wheel(-11, 11); wheel(11, 11)
      ctx.fillStyle = v.color; ctx.beginPath(); ctx.roundRect(-10, -20, 20, 40, 6); ctx.fill()
      ctx.fillStyle = v.accent; ctx.fillRect(-7, -9, 14, 7); ctx.fillRect(-7, 6, 14, 5)
  }
  ctx.restore()
}

function drawMishap(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, age: number, rot: number, reduced: boolean) {
  ctx.save(); ctx.translate(x, y)
  const a = Math.min(age, 3)
  if (kind === 'pond') {
    ctx.fillStyle = '#4aa3e8'; ctx.beginPath(); ctx.ellipse(0, 0, 38, 26, 0, 0, 6.3); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2
    for (let r = 0; r < 3; r++) { const k = (a * 0.5 + r * 0.33) % 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(0, 0, 8 + k * 30, 5 + k * 20, 0, 0, 6.3); ctx.stroke() }
    ctx.globalAlpha = 1
    if (!reduced && age < 1.5) { ctx.fillStyle = '#d8f0ff'; for (let q = 0; q < 6; q++) { const an = q * 1.05, rr = 8 + age * 26; ctx.beginPath(); ctx.arc(Math.cos(an) * rr, Math.sin(an) * rr - Math.sin(Math.min(1, age) * 3.1) * 14, 3, 0, 6.3); ctx.fill() } }
    ctx.rotate(-rot); ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillText('💦', 0, -26)
  } else if (kind === 'hay') {
    for (let q = 0; q < 3; q++) {
      const fly = reduced ? 0 : Math.min(1, age * 0.8) * (q - 1) * 10
      ctx.fillStyle = '#e0b84a'; ctx.fillRect(-26 + q * 18 + fly, -10 - (q === 1 ? 10 : 0) - (reduced ? 0 : Math.sin(Math.min(1, age) * 3.1) * 8), 16, 16)
      ctx.strokeStyle = '#a07a22'; ctx.lineWidth = 1.5; ctx.strokeRect(-26 + q * 18 + fly, -10 - (q === 1 ? 10 : 0), 16, 16)
    }
  } else if (kind === 'chickens') {
    ctx.rotate(-rot); ctx.font = '20px serif'; ctx.textAlign = 'center'
    for (let q = 0; q < 5; q++) { const k = Math.min(1, age * 0.6), an = q * 1.25 + 0.4; ctx.fillText('🐔', Math.cos(an) * (6 + k * 34), Math.sin(an) * (6 + k * 24) + (reduced ? 0 : Math.sin(age * 9 + q) * 2)) }
    ctx.font = '700 13px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText('bawk!', 0, -34)
  } else if (kind === 'cow') {
    ctx.rotate(-rot); ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.fillText('🐄', 0, 8)
    ctx.font = '800 14px system-ui'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3; ctx.strokeText('HONK! moo!', 0, -26); ctx.fillText('HONK! moo!', 0, -26)
  }
  ctx.restore()
}

/** draw one frame. w,h are CSS pixels; the canvas backing store is dpr times bigger. */
export function drawFrame(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number, dpr: number, v: View, st: RacerState, now: number) {
  const world = WORLDS[v.def?.world ?? 0]
  const tr = v.track
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = world.ground; ctx.fillRect(0, 0, w, h)
  if (!tr) return
  const racing = st.phase === 'race'
  const dr = v.dr
  // ---- the car and the camera
  const sNow = racing ? Math.min(tr.n - 1, Math.max(0, (v.rb + LEAD_BEATS) * SPB)) : 0
  carAt(tr, racing ? dr : null, sNow, base)
  car.x = base.x; car.y = base.y; car.heading = base.heading; car.d = base.d
  let age = -1, mk = -1, spin = false
  if (racing && dr) {
    for (let k = 0; k < dr.mishaps.length; k++) if (dr.mishaps[k].beat <= v.rb) mk = k
    if (mk >= 0) {
      age = v.rb - dr.mishaps[mk].beat
      if (age < RECOVER_BEATS) {
        const m = dr.mishaps[mk], u = age / RECOVER_BEATS, off = m.side * (ROAD_HALF + 14) * Math.sin(Math.PI * u)
        const hx = tr.h[Math.min(tr.n - 1, Math.floor(sNow))]
        car.x = base.x + Math.cos(hx) * (off - base.d)
        car.y = base.y + Math.sin(hx) * (off - base.d)
        car.heading = hx + (m.kind === 'spin' ? (v.reduced ? Math.sin(age * 4) * 0.5 : age * 9) : 0)
        spin = m.kind === 'spin'
      }
    }
  }
  const following = racing
  const fitZ = Math.max(0.35, Math.min(2.4, Math.min((w - 40) / (v.maxX - v.minX + 2 * ROAD_HALF + 60), (h - 110) / (v.maxY - v.minY + 2 * ROAD_HALF + 60))))
  const tz = following ? Math.min(1.5, Math.max(0.8, Math.min(w, h) / 380)) : fitZ
  const tx = following ? car.x : (v.minX + v.maxX) / 2, ty = following ? car.y : (v.minY + v.maxY) / 2
  const trot = following ? -base.heading * (v.reduced ? 0.15 : 0.45) : 0
  const k = cam.init ? (v.reduced ? 0.05 : 0.1) : 1
  cam.init = true
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.zoom += (tz - cam.zoom) * k; cam.rot += (trot - cam.rot) * k
  ctx.translate(w / 2, h * (following ? 0.62 : 0.5)); ctx.rotate(cam.rot); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y)
  const viewR = Math.hypot(w, h) / cam.zoom * 0.62
  // ---- scenery
  const pr = propsFor(tr)
  for (let q = 0; q < pr.n; q++) {
    const dx = pr.xs[q] - cam.x, dy = pr.ys[q] - cam.y
    if (dx * dx + dy * dy < viewR * viewR) drawProp(ctx, world, pr.xs[q], pr.ys[q], pr.kind[q], now)
  }
  // ---- the road
  const j0 = following ? Math.max(0, Math.floor(sNow) - 40) : 0, j1 = following ? Math.min(tr.n - 1, Math.floor(sNow) + 150) : tr.n - 1
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath(); ctx.moveTo(tr.x[j0], tr.y[j0]); for (let j = j0 + 1; j <= j1; j++) ctx.lineTo(tr.x[j], tr.y[j])
  ctx.strokeStyle = world.edge; ctx.lineWidth = ROAD_HALF * 2 + 12; ctx.stroke()
  ctx.strokeStyle = world.road; ctx.lineWidth = ROAD_HALF * 2; ctx.stroke()
  ctx.setLineDash(DASH); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash(NODASH)
  // ---- start and finish lines
  for (let e = 0; e < 2; e++) {
    const j = e === 0 ? 0 : tr.n - 1
    if (j < j0 || j > j1) continue
    ctx.save(); ctx.translate(tr.x[j], tr.y[j]); ctx.rotate(tr.h[j])
    for (let c = 0; c < 10; c++) for (let r = 0; r < 2; r++) { ctx.fillStyle = (c + r) % 2 ? '#111' : '#fff'; ctx.fillRect(-ROAD_HALF + c * (ROAD_HALF / 5), -6 + r * 6, ROAD_HALF / 5, 6) }
    ctx.restore()
  }
  // ---- gates: the phrase, standing on the road at the time each note sounds
  const gates = tr.gates
  const hint = v.def?.hints ?? 'full'
  const names = hint === 'full' || hint === 'glow'
  ctx.font = '700 15px system-ui'; ctx.textAlign = 'center'
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i]
    if (g.j < j0 - 4 || g.j > j1 + 4) continue
    let lit = 0, col = tr.mode === 'pads' ? hue(g.v * 2) : hue(g.v)
    if (st.phase === 'listen') lit = v.lb >= g.beat ? Math.max(0.25, 1 - (v.lb - g.beat) / 0.8) : 0
    else if (st.phase === 'turn') lit = i === v.played && hint === 'full' ? 0.55 + 0.25 * Math.sin(now / 420) : 0
    else if (racing && dr) { if (v.rb >= g.beat) { lit = 1; col = GRADE_COL[dr.results[i].grade] } }
    else if (st.phase === 'result' && dr) { lit = 0.8; col = GRADE_COL[dr.results[i].grade] }
    ctx.save(); ctx.translate(tr.x[g.j], tr.y[g.j]); ctx.rotate(tr.h[g.j])
    const hw = ROAD_HALF + 4
    if (lit > 0) { ctx.globalAlpha = 0.35 * lit; ctx.strokeStyle = col; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.lineTo(hw, 0); ctx.stroke(); ctx.globalAlpha = 1 }
    ctx.strokeStyle = lit > 0 ? col : 'rgba(255,255,255,.55)'; ctx.lineWidth = lit > 0 ? 5 : 3; ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.lineTo(hw, 0); ctx.stroke()
    ctx.fillStyle = lit > 0 ? col : 'rgba(255,255,255,.8)'
    ctx.beginPath(); ctx.arc(-hw, 0, 5, 0, 6.3); ctx.arc(hw, 0, 5, 0, 6.3); ctx.fill()
    ctx.rotate(-tr.h[g.j] - cam.rot)
    if (names) {
      const label = tr.mode === 'pads' ? String(g.v + 1) : NAMES[((g.v % 12) + 12) % 12]
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(-14, -34, 28, 20)
      ctx.fillStyle = '#fff'; ctx.fillText(label, 0, -19)
    }
    ctx.restore()
  }
  // ---- mishap scenery (stays after it happens)
  if (racing && dr) for (let q = 0; q < dr.mishaps.length; q++) {
    const m = dr.mishaps[q], a = v.rb - m.beat
    if (a >= 0 && m.kind !== 'spin') drawMishap(ctx, m.kind, v.mx[q], v.my[q], a, cam.rot, v.reduced)
  }
  // ---- the car
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.heading)
  if (racing && mk >= 0 && age >= 0 && age < RECOVER_BEATS && dr!.mishaps[mk].kind === 'hay') ctx.rotate(Math.sin(age * 12) * 0.25 * (v.reduced ? 0 : 1))
  ctx.globalAlpha = racing && mk >= 0 && age >= 0 && age < RECOVER_BEATS ? 0.85 : 1
  drawCar(ctx, v.vehicle, v.speed, now, v.reduced)
  ctx.restore()
  if (spin) { // dizzy stars go round (slowly, never a flash)
    ctx.font = '16px serif'; ctx.textAlign = 'center'
    for (let q = 0; q < 4; q++) { const an = (v.reduced ? 0 : age * 3) + q * 1.57; ctx.fillText('⭐', car.x + Math.cos(an) * 24, car.y + Math.sin(an) * 12 - 22) }
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
