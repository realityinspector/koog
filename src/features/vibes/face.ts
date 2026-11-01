// A procedural cartoon face for the Vibes scene. Every mood is a bag of numbers (eyebrow tilt, mouth curve, tears...)
// and the face smoothly eases between them, so a sad chord slowly turns the smile into a frown with tears.
// Drawn with plain canvas paths (no emoji font), kept silly and friendly: angry puffs steam, scared sweats.
import type { MoodId } from '../../music/vibesCore'

export interface Face {
  fh: number; fs: number; fl: number // face colour (hsl)
  ey: number; esp: number; ew: number; eh: number; eopen: number; arc: number; arcDir: number
  pupil: number; lookX: number; lookY: number; spark: number; eAsym: number
  bY: number; bTilt: number; bAsym: number
  mY: number; mW: number; curve: number; open: number; wavy: number; smirk: number; tongue: number
  tear: number; sweat: number; blush: number; shades: number; steam: number; aura: number; auraHue: number
}
const BASE: Face = {
  fh: 46, fs: 96, fl: 60,
  ey: -0.16, esp: 0.34, ew: 0.1, eh: 0.15, eopen: 1, arc: 0, arcDir: 1,
  pupil: 1, lookX: 0, lookY: 0, spark: 0, eAsym: 0,
  bY: -0.42, bTilt: 0, bAsym: 0,
  mY: 0.34, mW: 0.3, curve: 0.5, open: 0, wavy: 0, smirk: 0, tongue: 0,
  tear: 0, sweat: 0, blush: 0, shades: 0, steam: 0, aura: 0, auraHue: 45,
}
const F = (o: Partial<Face>): Face => ({ ...BASE, ...o })
export const FACES: Record<MoodId, Face> = {
  happy: F({ arc: 0.85, curve: 1, open: 0.45, blush: 0.5, mW: 0.36, bY: -0.46 }),
  joyful: F({ spark: 1, ew: 0.13, eh: 0.17, curve: 1, open: 0.9, mW: 0.4, blush: 0.4, bY: -0.52, aura: 0.8, auraHue: 42 }),
  excited: F({ spark: 0.85, ew: 0.12, eh: 0.18, curve: 0.9, open: 1, mW: 0.34, bY: -0.55, blush: 0.2 }),
  sad: F({ eopen: 0.85, pupil: 0.8, lookY: 0.04, bTilt: -0.9, bY: -0.4, curve: -1, mY: 0.46, mW: 0.22, open: 0.1, tear: 1, fs: 78, fl: 62 }),
  tender: F({ arc: 0.9, arcDir: 1, blush: 1, curve: 0.65, mW: 0.2, bTilt: -0.25, bY: -0.44 }),
  calm: F({ arc: 0.95, arcDir: -1, curve: 0.45, mW: 0.2, bY: -0.4, blush: 0.15 }),
  dreamy: F({ eopen: 0.55, pupil: 0.85, lookY: -0.05, curve: 0.5, mW: 0.2, bY: -0.46, blush: 0.4, fh: 330, fs: 70, fl: 76, aura: 0.45, auraHue: 275 }),
  cool: F({ shades: 1, curve: 0.5, smirk: 0.5, mW: 0.3, bY: -0.5, blush: 0 }),
  sassy: F({ eopen: 0.5, pupil: 0.8, curve: 0.6, smirk: 1, mW: 0.26, bAsym: 1, bTilt: 0.15, bY: -0.42, lookX: 0.04 }),
  spooky: F({ eopen: 1.2, pupil: 0.3, ew: 0.12, eh: 0.17, curve: -0.2, wavy: 0.8, open: 0.4, mW: 0.28, mY: 0.42, bTilt: -0.35, bY: -0.5, fh: 268, fs: 48, fl: 74, aura: 0.35, auraHue: 275 }),
  tense: F({ eopen: 1.3, pupil: 0.32, ew: 0.12, eh: 0.18, bTilt: -0.55, bY: -0.52, curve: -0.15, wavy: 1, open: 0.35, mW: 0.26, mY: 0.42, sweat: 1, fh: 88, fs: 50, fl: 72 }),
  angry: F({ eopen: 0.7, pupil: 0.9, bTilt: 1, bY: -0.36, curve: -0.75, open: 0.55, mW: 0.3, mY: 0.42, steam: 1, fh: 8, fs: 88, fl: 58 }),
  surprised: F({ eopen: 1.45, pupil: 0.35, ew: 0.12, eh: 0.19, bY: -0.6, mW: 0.1, mY: 0.4, curve: 0, open: 1.2, blush: 0.2 }),
  triumphant: F({ spark: 0.5, bTilt: 0.4, bY: -0.44, curve: 0.9, open: 0.6, mW: 0.36, aura: 1, auraHue: 46, fh: 44, fs: 100, fl: 62 }),
  bittersweet: F({ eopen: 0.85, bTilt: -0.55, bY: -0.42, curve: 0.3, smirk: -0.3, mW: 0.22, tear: 0.55, blush: 0.25 }),
  goofy: F({ ew: 0.13, eh: 0.19, eAsym: -0.4, pupil: 0.55, lookX: 0.05, lookY: -0.03, curve: 0.85, open: 0.85, tongue: 1, mW: 0.34, bAsym: 1, bY: -0.46, smirk: 0.4 }),
  mysterious: F({ eopen: 0.6, pupil: 0.8, lookX: 0.07, bAsym: 1, bTilt: 0.2, curve: 0.1, smirk: 0.5, mW: 0.2, fh: 262, fs: 55, fl: 70, aura: 0.4, auraHue: 265 }),
  groovy: F({ arc: 0.9, curve: 1, open: 0.5, mW: 0.34, bY: -0.46, blush: 0.3, fh: 320, fs: 85, fl: 68 }),
  epic: F({ eopen: 0.75, bTilt: 0.8, bY: -0.38, curve: -0.2, open: 0.2, mW: 0.3, mY: 0.4, aura: 0.9, auraHue: 14, fh: 28, fs: 95, fl: 58 }),
  wondering: F({ eopen: 1, lookX: 0.07, lookY: -0.06, bAsym: 1, bTilt: 0.1, curve: -0.1, smirk: 0.5, mW: 0.14, mY: 0.4, fh: 50, fs: 90, fl: 64 }),
  content: F({ arc: 0.95, arcDir: -1, curve: 0.7, mW: 0.26, blush: 0.55, bY: -0.42 }),
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const KEYS = Object.keys(BASE) as (keyof Face)[]

export interface FaceFx { pulse: number; bob: number; shake: number }

export class FaceAnimator {
  cur: Face = { ...FACES.calm }
  tgt: Face = FACES.calm
  private blinkAt = 0
  private blinkEnd = 0
  constructor(private reduced: boolean) {}
  setMood(m: MoodId) { this.tgt = FACES[m] }
  step(dt: number) {
    const k = 1 - Math.exp(-dt / (this.reduced ? 380 : 230))
    for (const key of KEYS) {
      if (key === 'fh' || key === 'auraHue') {
        let d = ((this.tgt[key] - this.cur[key] + 540) % 360) - 180
        if (!Number.isFinite(d)) d = 0
        this.cur[key] = (this.cur[key] + d * k + 360) % 360
      } else this.cur[key] = lerp(this.cur[key], this.tgt[key], k)
    }
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, now: number, fx: FaceFx) {
    const f = this.cur
    if (now > this.blinkAt) {
      this.blinkEnd = now + 130
      this.blinkAt = now + 2600 + Math.random() * 3200
    }
    const blink = !this.reduced && now < this.blinkEnd && f.arc < 0.5 && f.shades < 0.5 ? 0.12 : 1
    ctx.save()
    ctx.translate(cx + Math.sin(now * 0.045) * fx.shake * R, cy + fx.bob * R)
    ctx.rotate(Math.sin(now * 0.0017) * 0.015 + fx.bob * 0.15)
    ctx.scale(R * (1 + fx.pulse), R * (1 + fx.pulse))
    const dark = '#35210f'
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'

    // aura
    if (f.aura > 0.02) {
      const g = ctx.createRadialGradient(0, 0, 0.9, 0, 0, 1.55)
      g.addColorStop(0, `hsla(${f.auraHue},95%,65%,${0.38 * f.aura})`)
      g.addColorStop(1, `hsla(${f.auraHue},95%,60%,0)`)
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(0, 0, 1.55, 0, 6.2832); ctx.fill()
    }
    // steam puffs (angry)
    if (f.steam > 0.02) {
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const u = ((now * 0.0006 + i / 3 + (s > 0 ? 0.17 : 0)) % 1)
        ctx.fillStyle = `rgba(255,255,255,${0.55 * f.steam * (1 - u)})`
        ctx.beginPath(); ctx.arc(s * (0.72 + u * 0.12), -0.62 - u * 0.5, 0.07 + u * 0.1, 0, 6.2832); ctx.fill()
      }
    }
    // head
    const grad = ctx.createRadialGradient(-0.3, -0.4, 0.1, 0, 0, 1.05)
    grad.addColorStop(0, `hsl(${f.fh},${f.fs}%,${Math.min(90, f.fl + 14)}%)`)
    grad.addColorStop(1, `hsl(${f.fh},${f.fs}%,${f.fl - 6}%)`)
    ctx.fillStyle = grad
    ctx.strokeStyle = `hsl(${f.fh},${Math.min(100, f.fs)}%,${f.fl - 28}%)`
    ctx.lineWidth = 0.035
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.2832); ctx.fill(); ctx.stroke()
    // blush
    if (f.blush > 0.02) {
      ctx.fillStyle = `rgba(255,92,128,${0.4 * f.blush})`
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.55, 0.12, 0.14, 0.085, 0, 0, 6.2832); ctx.fill() }
    }
    // eyes
    for (const s of [-1, 1]) {
      const k = s > 0 ? 1 + f.eAsym : 1 - f.eAsym * 0.25
      const ex = s * f.esp, ew = f.ew * k, eh = Math.max(0.012, f.eh * k * f.eopen * blink)
      const open = 1 - f.arc
      if (open > 0.02 && f.shades < 0.98) {
        ctx.globalAlpha = open * (1 - f.shades)
        const sw = Math.max(0, Math.min(1, (1 - f.pupil) * 2.2))
        if (sw > 0.02) {
          ctx.fillStyle = `rgba(255,255,255,${sw})`
          ctx.strokeStyle = dark; ctx.lineWidth = 0.03
          ctx.beginPath(); ctx.ellipse(ex, f.ey, ew * 1.25, eh * 1.2, 0, 0, 6.2832); ctx.fill(); ctx.stroke()
        }
        ctx.fillStyle = dark
        const pw = ew * (sw > 0.02 ? Math.max(0.5, f.pupil + 0.1) : 1), ph = eh * (sw > 0.02 ? Math.max(0.55, f.pupil + 0.1) : 1)
        ctx.beginPath(); ctx.ellipse(ex + f.lookX * s * 0 + f.lookX, f.ey + f.lookY, pw, ph, 0, 0, 6.2832); ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.beginPath(); ctx.arc(ex + f.lookX - pw * 0.3, f.ey + f.lookY - ph * 0.35, Math.min(pw, ph) * 0.32, 0, 6.2832); ctx.fill()
        ctx.globalAlpha = 1
      }
      if (f.arc > 0.02) {
        ctx.globalAlpha = Math.min(1, f.arc * 1.2)
        ctx.strokeStyle = dark; ctx.lineWidth = 0.055
        const d = f.arcDir
        ctx.beginPath(); ctx.moveTo(ex - ew * 1.3, f.ey + d * 0.04)
        ctx.quadraticCurveTo(ex, f.ey - d * 0.2, ex + ew * 1.3, f.ey + d * 0.04); ctx.stroke()
        ctx.globalAlpha = 1
      }
      if (f.spark > 0.02) {
        ctx.globalAlpha = Math.min(1, f.spark)
        star(ctx, ex, f.ey, ew * 2.4 * (1 + Math.sin(now * 0.006 + s) * 0.06), '#ffcf2e', '#c07a00')
        ctx.globalAlpha = 1
      }
    }
    // cool shades
    if (f.shades > 0.02) {
      ctx.globalAlpha = Math.min(1, f.shades)
      ctx.fillStyle = '#16121e'
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * f.esp - 0.2, f.ey - 0.1)
        ctx.lineTo(s * f.esp + 0.2, f.ey - 0.1); ctx.quadraticCurveTo(s * f.esp + 0.2, f.ey + 0.22, s * f.esp, f.ey + 0.2)
        ctx.quadraticCurveTo(s * f.esp - 0.2, f.ey + 0.22, s * f.esp - 0.2, f.ey - 0.1); ctx.fill()
      }
      ctx.fillRect(-0.16, f.ey - 0.08, 0.32, 0.05)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * f.esp - 0.07, f.ey - 0.03, 0.05, 0.02, -0.5, 0, 6.2832); ctx.fill() }
      ctx.globalAlpha = 1
    }
    // eyebrows
    ctx.strokeStyle = dark; ctx.lineWidth = 0.06
    for (const s of [-1, 1]) {
      const lift = s > 0 ? f.bAsym * 0.1 : 0
      const by = f.bY - lift
      const inner = by + f.bTilt * 0.13 + (f.eopen > 1 ? -0.02 : 0)
      const outer = by - f.bTilt * 0.06
      ctx.beginPath(); ctx.moveTo(s * (f.esp + 0.17), outer)
      ctx.quadraticCurveTo(s * (f.esp + 0.01), by - 0.04 - Math.abs(f.bTilt) * 0.0, s * (f.esp - 0.15), inner); ctx.stroke()
    }
    // mouth
    const N = 18
    const mw = f.mW
    const cl = f.mY - f.curve * 0.1 + f.smirk * 0.02
    const cr = f.mY - f.curve * 0.1 - f.smirk * 0.09
    const ct = f.mY + f.curve * 0.18 - f.smirk * 0.03
    const bul = f.open * 0.5
    const ph = now * 0.012
    const top: number[] = [], bot: number[] = []
    for (let i = 0; i <= N; i++) {
      const u = i / N
      const wob = Math.sin(u * 15 + ph) * f.wavy * 0.022
      const y = (1 - u) * (1 - u) * cl + 2 * u * (1 - u) * ct + u * u * cr
      top.push(y + wob); bot.push(y + 2 * u * (1 - u) * bul + wob)
    }
    const mx = (i: number) => -mw + (2 * mw * i) / N
    ctx.beginPath()
    for (let i = 0; i <= N; i++) i ? ctx.lineTo(mx(i), top[i]) : ctx.moveTo(mx(i), top[i])
    for (let i = N; i >= 0; i--) ctx.lineTo(mx(i), bot[i])
    ctx.closePath()
    if (f.open > 0.04) {
      ctx.fillStyle = `rgba(110,24,40,${Math.min(1, f.open * 3)})`
      ctx.fill()
      if (f.tongue > 0.02) {
        ctx.save(); ctx.clip()
        ctx.fillStyle = `rgba(255,110,140,${f.tongue})`
        ctx.beginPath(); ctx.ellipse(mw * 0.15, f.mY + bul * 0.5 + 0.02, mw * 0.55, 0.11 + 0.05 * f.tongue, 0, 0, 6.2832); ctx.fill()
        ctx.restore()
      }
    }
    ctx.strokeStyle = dark; ctx.lineWidth = 0.05
    ctx.stroke()
    // tears
    if (f.tear > 0.02) {
      for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
        const u = (now * 0.00045 + i * 0.5 + (s > 0 ? 0.25 : 0)) % 1
        const y = f.ey + 0.12 + u * 0.6
        ctx.fillStyle = `rgba(120,200,255,${f.tear * (1 - u * u) * 0.95})`
        ctx.strokeStyle = `rgba(40,110,200,${f.tear * (1 - u * u)})`; ctx.lineWidth = 0.015
        const x = s * (f.esp + 0.02 + u * 0.05)
        ctx.beginPath(); ctx.moveTo(x, y - 0.07); ctx.quadraticCurveTo(x + 0.06, y + 0.03, x, y + 0.06); ctx.quadraticCurveTo(x - 0.06, y + 0.03, x, y - 0.07); ctx.fill(); ctx.stroke()
      }
    }
    // sweat
    if (f.sweat > 0.02) {
      const u = (now * 0.0004) % 1
      const x = 0.62, y = -0.5 + u * 0.28
      ctx.fillStyle = `rgba(150,215,255,${f.sweat * 0.95})`
      ctx.strokeStyle = `rgba(50,120,200,${f.sweat})`; ctx.lineWidth = 0.018
      ctx.beginPath(); ctx.moveTo(x, y - 0.12); ctx.quadraticCurveTo(x + 0.09, y + 0.04, x, y + 0.08); ctx.quadraticCurveTo(x - 0.09, y + 0.04, x, y - 0.12); ctx.fill(); ctx.stroke()
    }
    ctx.restore()
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke: string) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 0.02
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
  }
  ctx.closePath(); ctx.fill(); ctx.stroke()
}
