// All 2D drawing on top of the raycast view: the pipe-organ gun, pips over demons, pop-ups, the red edge pulse,
// the Doom-style status bar (with Bach's face) and the title / tally / win / lose screens.
// Canvas only; keeps a few cached canvases derived from the art. No game rules live here.
import { PC_NAMES, pc } from '../../../music/theory'
import { PRELUDE_C } from '../../../music/scores'
import { useJudge } from '../../../music/judge'
import { drawText, textWidth } from './font'
import { LEVELS } from './levels'
import { DIFFS } from './game'
import type { FaceName, Game, Phase } from './game'
import type { View } from './render'
import type { Face, Gun, Img, Sprites } from './types'

export interface Art { sprites: Sprites; faces: Face; gun: Gun }

function toCanvas(img: Img): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = img.w; c.height = img.h
  const d = new ImageData(new Uint8ClampedArray(img.px.slice().buffer), img.w, img.h)
  c.getContext('2d')!.putImageData(d, 0, 0)
  return c
}
const GOLD = '#ffd76c', CREAM = '#fff3d0', DARK = '#1a0c12'

export class Painter {
  readonly sprites: Sprites
  private face: Record<FaceName, HTMLCanvasElement>
  private gun: { idle: HTMLCanvasElement; f0: HTMLCanvasElement; f1: HTMLCanvasElement; jam: HTMLCanvasElement }
  private note: HTMLCanvasElement[]
  private smoke: HTMLCanvasElement[]
  private barCv: HTMLCanvasElement | null = null
  private barKey = ''
  private vigCv: HTMLCanvasElement | null = null
  private vigA = 0
  private lastGlow = -9; private glowUntil = -9
  private lastPhase: Phase | '' = ''
  private screenT = 0
  private pt = { x: 0, y: 0, d: 0 }
  private nextBuf: number[] = []
  /** device px per internal view px, set each frame */
  private kx = 1; private ky = 1

  constructor(art: Art) {
    this.sprites = art.sprites
    const f = art.faces
    this.face = { center: toCanvas(f.center), left: toCanvas(f.left), right: toCanvas(f.right), grin: toCanvas(f.grin), hurt: toCanvas(f.hurt), sweaty: toCanvas(f.sweaty), dizzy: toCanvas(f.dizzy) }
    this.gun = { idle: toCanvas(art.gun.idle), f0: toCanvas(art.gun.fire[0]), f1: toCanvas(art.gun.fire[1]), jam: toCanvas(art.gun.jam) }
    this.note = art.sprites.note.map(toCanvas)
    this.smoke = art.sprites.smoke.map(toCanvas)
  }

  /** the largest integer pixel scale for text, from the stage height */
  ps(H: number) { return Math.max(2, Math.round(H / 190)) }

  draw(g: Game, view: View, ctx: CanvasRenderingContext2D, W: number, H: number, hudH: number, dt: number) {
    const viewH = H - hudH
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(view.canvas, 0, 0, view.iw, view.ih, 0, 0, W, viewH)
    this.kx = W / view.iw; this.ky = viewH / view.ih
    const ps = this.ps(H)
    if (g.phase !== this.lastPhase) { this.lastPhase = g.phase; this.screenT = 0 }
    this.screenT += dt

    if (g.phase === 'title') { this.title(ctx, g, W, H, hudH, ps); return }

    this.overlays(ctx, g, view, W, viewH, ps)
    this.gunLayer(ctx, g, W, viewH, ps)
    this.vignette(ctx, g, W, viewH, dt)
    this.statusBar(ctx, g, W, H, hudH, ps)
    this.topLayer(ctx, g, view, W, viewH, ps)
    if (g.phase === 'tally') this.tally(ctx, g, W, H, ps)
    else if (g.phase === 'win') this.win(ctx, g, W, H, ps)
    else if (g.phase === 'lose') this.lose(ctx, g, W, H, ps)
  }

  // ---------------------------------------------------------------- 3D overlays
  private toScreen(view: View, wx: number, wy: number, wz: number): boolean {
    const sc = view.project(wx, wy, wz, this.pt)
    if (!sc) return false
    this.pt.x *= this.kx; this.pt.y *= this.ky
    return true
  }
  private visibleAt(view: View, ix: number, d: number) { const c = Math.max(0, Math.min(view.iw - 1, Math.round(ix))); return view.zbuf[c] > d - 0.1 }

  private overlays(ctx: CanvasRenderingContext2D, g: Game, view: View, W: number, viewH: number, ps: number) {
    const tgt = g.target
    // pips (one per note left) above each demon, and a bobbing marker over the one you are playing
    for (const d of g.demons) {
      if (d.state !== 0 || d.room !== g.roomIdx || g.mode !== 'fight') continue
      const pos = { x: 0, y: 0 }
      g.demonPos(d, pos)
      const hgt = (d.kind === 'squeak' ? 0.8 : d.kind === 'imp' ? 1.22 : 1.12) * Math.min(1.25, (g.map.spec.wallH ?? 1))
      if (!this.toScreen(view, pos.x, pos.y, hgt * 0.9 + (d.kind === 'squeak' ? 0.25 : 0))) continue
      if (!this.visibleAt(view, this.pt.x / this.kx, this.pt.d)) continue
      const n = d.maxHp, pw = Math.max(5, Math.round(ps * 2.6)), gap = Math.max(2, Math.round(ps))
      const tw = n * pw + (n - 1) * gap
      let x = Math.round(this.pt.x - tw / 2); const y = Math.round(this.pt.y)
      ctx.fillStyle = 'rgba(10,4,12,.78)'
      ctx.fillRect(x - gap - 1, y - gap - 1, tw + gap * 2 + 2, pw + gap * 2 + 2)
      for (let i = 0; i < n; i++, x += pw + gap) { ctx.fillStyle = i < d.hp ? (d === tgt ? GOLD : '#c9a24a') : '#4a3350'; ctx.fillRect(x, y, pw, pw) }
      if (d === tgt) {
        // a gold arrow that bobs over the demon you are playing against
        const bob = g.reduced ? 0 : Math.round(Math.sin(g.clock * 6) * ps)
        const cx = Math.round(this.pt.x), cy = Math.round(this.pt.y - gap * 2 - ps * 5 + bob)
        ctx.fillStyle = '#3a2410'
        for (let r = 0; r < 4; r++) ctx.fillRect(cx - (3 - r) * ps - ps, cy + r * ps - ps, (3 - r) * 2 * ps + ps * 3, ps * 2)
        ctx.fillStyle = GOLD
        for (let r = 0; r < 4; r++) ctx.fillRect(cx - (3 - r) * ps, cy + r * ps, (3 - r) * 2 * ps + ps, ps)
      }
    }
    // tracer: a few gold notes fly from the organ to what you hit
    if (g.shot.t < 1) {
      if (this.toScreen(view, g.shot.wx, g.shot.wy, g.shot.wz)) {
        const sx = W / 2, sy = viewH * 0.72, tx = this.pt.x, ty = this.pt.y
        const s = g.shot.t
        for (let i = 0; i < 3; i++) {
          const u = Math.min(1, s * 1.1 + i * 0.09 - 0.09)
          if (u <= 0) continue
          const nx = sx + (tx - sx) * u, ny = sy + (ty - sy) * u - Math.sin(u * Math.PI) * viewH * 0.06
          const sz = Math.round(ps * (7 - i * 1.5))
          ctx.globalAlpha = 1 - u * 0.4
          ctx.drawImage(this.note[(i + (g.st.hits & 1)) & 1], Math.round(nx - sz / 2), Math.round(ny - sz / 2), sz, sz)
        }
        ctx.globalAlpha = 1
      }
    }
    // BFG impact glow: local, soft, and gentle (never a full-screen flash)
    if (g.bfgT >= 0.6 && g.room) {
      const k = (g.bfgT - 0.6) / 0.8
      const r = g.room
      if (this.toScreen(view, r.sx + r.hx * 5, r.sy + r.hy * 5, 0.5)) {
        const rad = viewH * (g.reduced ? 0.22 : 0.16 + 0.2 * Math.min(1, k * 1.4))
        const a = Math.max(0, 0.55 * (1 - k)) * (k < 0.15 ? k / 0.15 : 1)
        const gr = ctx.createRadialGradient(this.pt.x, this.pt.y, 0, this.pt.x, this.pt.y, rad)
        gr.addColorStop(0, `rgba(255,240,170,${a})`); gr.addColorStop(0.6, `rgba(255,200,90,${a * 0.5})`); gr.addColorStop(1, 'rgba(255,200,90,0)')
        ctx.fillStyle = gr
        ctx.fillRect(this.pt.x - rad, this.pt.y - rad, rad * 2, rad * 2)
      }
    }
    // screen-space ♪ sparks from the organ
    for (const p of g.sparks) {
      if (!p.on) continue
      const sz = Math.round(ps * 6)
      ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5)
      ctx.drawImage(this.note[p.frame & 1], Math.round(p.x * W - sz / 2), Math.round(p.y * viewH - sz / 2), sz, sz)
    }
    ctx.globalAlpha = 1
    // orb pops
    for (const o of g.orbs) {
      if (o.pop > 0) { /* the orb simply vanishes; a few notes fall from the burst() particles */ }
    }
  }

  private gunLayer(ctx: CanvasRenderingContext2D, g: Game, W: number, viewH: number, ps: number) {
    // the little glow frames show at most 3 times a second, however fast you play; in between the gun just kicks
    if (g.recoilT > 0.1 && g.clock - this.lastGlow >= 0.34) { this.lastGlow = g.clock; this.glowUntil = g.clock + 0.14 }
    const glow = g.clock < this.glowUntil
    const src = g.jamT > 0 ? this.gun.jam : glow ? (this.glowUntil - g.clock > 0.06 ? this.gun.f0 : this.gun.f1) : this.gun.idle
    const sc = Math.max(2, (viewH * 0.44) / src.height)
    const w = Math.round(src.width * sc), h = Math.round(src.height * sc)
    const bob = g.reduced ? 0 : Math.sin(g.bobT * 1.0) * ps * (g.mode === 'glide' ? 1.5 : 0.3)
    const kick = !glow && g.recoilT > 0 && !g.reduced ? Math.round((g.recoilT / 0.16) * ps * 2) : 0
    const x = Math.round(W / 2 - w / 2 + bob * 1.5), y = Math.round(viewH - h * 0.9 + Math.abs(bob) + kick)
    ctx.drawImage(src, x, y, w, h)
    if (g.smokeT > 0 || g.jamT > 0) {
      const k = g.jamT > 0 ? Math.min(1, (1.5 - g.jamT) / 0.5) : 1 - g.smokeT / 0.5
      const s = this.smoke[Math.min(2, Math.floor(k * 3))]
      const sz = Math.round(ps * 12 * (0.8 + k * 0.5))
      ctx.globalAlpha = g.jamT > 0 ? 0.9 : Math.max(0, 1 - k * 0.8)
      ctx.drawImage(s, Math.round(W / 2 - sz / 2), Math.round(y - sz * (0.2 + k * 0.5)), sz, sz)
      ctx.globalAlpha = 1
    }
  }

  private vignette(ctx: CanvasRenderingContext2D, g: Game, W: number, viewH: number, dt: number) {
    // one small square gradient, stretched to the view: an oval with a clear middle and soft red edges
    if (!this.vigCv) {
      const c = document.createElement('canvas')
      c.width = 96; c.height = 96
      const x = c.getContext('2d')!
      const gr = x.createRadialGradient(48, 48, 30, 48, 48, 66)
      gr.addColorStop(0, 'rgba(215,30,55,0)'); gr.addColorStop(1, 'rgba(215,30,55,1)')
      x.fillStyle = gr; x.fillRect(0, 0, 96, 96)
      this.vigCv = c
    }
    // ease toward the target so the pulse fades in and out, never snaps
    const want = g.vig * (g.reduced ? 0.2 : 0.32)
    this.vigA += (want - this.vigA) * Math.min(1, dt * 14)
    if (this.vigA > 0.01) { ctx.globalAlpha = this.vigA; ctx.drawImage(this.vigCv, 0, 0, W, viewH); ctx.globalAlpha = 1 }
  }

  // ---------------------------------------------------------------- status bar
  private bar(W: number, hudH: number): HTMLCanvasElement {
    const key = W + 'x' + hudH
    if (this.barCv && this.barKey === key) return this.barCv
    const c = this.barCv ?? document.createElement('canvas')
    c.width = W; c.height = hudH
    const x = c.getContext('2d')!
    const gr = x.createLinearGradient(0, 0, 0, hudH)
    gr.addColorStop(0, '#4a2c1c'); gr.addColorStop(1, '#22120c')
    x.fillStyle = gr; x.fillRect(0, 0, W, hudH)
    // wood grain
    x.fillStyle = 'rgba(0,0,0,.14)'
    for (let i = 0; i < hudH; i += 4) x.fillRect(0, i, W, 1)
    x.fillStyle = 'rgba(255,200,140,.06)'
    for (let i = 2; i < hudH; i += 8) x.fillRect(0, i, W, 1)
    // gold trim
    x.fillStyle = '#f2c24f'; x.fillRect(0, 0, W, 3)
    x.fillStyle = '#8a5a14'; x.fillRect(0, 3, W, 2)
    this.barCv = c; this.barKey = key
    return c
  }

  private panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = '#120a10'; ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#6b4a22'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y, 2, h)
    ctx.fillStyle = '#05030a'; ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x + w - 2, y, 2, h)
  }

  private statusBar(ctx: CanvasRenderingContext2D, g: Game, W: number, H: number, hudH: number, ps: number) {
    const y0 = H - hudH
    ctx.drawImage(this.bar(W, hudH), 0, y0)
    const pad = Math.round(hudH * 0.09), ph = hudH - pad * 2 - 4, py = y0 + pad + 3
    const big = ph >= 70
    const sl = big ? 2 : 1 // label scale
    const sn = big ? 3 : 2 // number scale
    const judge = useJudge.getState()
    const lh = 7 * sl + 4 // y of a number under a label

    // HARMONY and TEMPO
    const hx = Math.round(W * 0.012), hw = Math.round(W * 0.15)
    this.panel(ctx, hx, py, hw, ph)
    drawText(ctx, 'HARMONY', hx + 6, py + 5, sl, GOLD)
    const pct = Math.round(g.harmony)
    drawText(ctx, pct + '%', hx + 6, py + 5 + lh, sn, pct < 30 ? '#ff8a8a' : CREAM, { shadow: DARK })
    const bw = hw - 12, byy = py + ph - 8
    ctx.fillStyle = '#2a1626'; ctx.fillRect(hx + 6, byy, bw, 4)
    ctx.fillStyle = pct < 30 ? '#ff6a6a' : '#7cf0a0'; ctx.fillRect(hx + 6, byy, Math.round(bw * g.harmony / 100), 4)

    const tx = hx + hw + 6, tw = Math.round(W * 0.1)
    this.panel(ctx, tx, py, tw, ph)
    drawText(ctx, 'TEMPO', tx + 6, py + 5, sl, '#8fd4ff')
    drawText(ctx, Math.round(g.armor) + '%', tx + 6, py + 5 + lh, sn, CREAM, { shadow: DARK })
    ctx.fillStyle = '#16203a'; ctx.fillRect(tx + 6, byy, tw - 12, 4)
    ctx.fillStyle = '#5db6ff'; ctx.fillRect(tx + 6, byy, Math.round((tw - 12) * g.armor / 100), 4)

    // NEXT notes: little note heads with the letter inside, octave number underneath
    const nx = tx + tw + 6, nw = Math.round(W * 0.2)
    this.panel(ctx, nx, py, nw, ph)
    drawText(ctx, 'NEXT', nx + 6, py + 4, sl, GOLD)
    this.nextBuf.length = 0
    g.upcoming(6, this.nextBuf)
    const cell = (nw - 8) / 6
    const exact = g.diff !== 'story'
    const r0 = Math.min(cell * 0.47, (ph - 6 - 7 * sl) * (exact ? 0.34 : 0.4))
    for (let i = 0; i < this.nextBuf.length; i++) {
      const n = this.nextBuf[i]
      const r = r0 * (i === 0 ? 1 : 0.92 - i * 0.025)
      const cx = Math.round(nx + 4 + cell * (i + 0.5)), cy = Math.round(py + 7 * sl + 8 + r0 * 0.95)
      ctx.fillStyle = '#1a0c12'; ctx.beginPath(); ctx.ellipse(cx, cy, r + 2, r * 0.9 + 2, -0.25, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = i === 0 ? '#fff0a0' : i < 3 ? '#e6b94a' : '#a07d36'
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.9, -0.25, 0, Math.PI * 2); ctx.fill()
      const name = PC_NAMES[pc(n)]
      const sc = name.length > 1 ? Math.max(1, Math.floor(r / 6.5)) : Math.max(1, Math.floor(r / 4.6))
      drawText(ctx, name, cx, Math.round(cy - (7 * sc) / 2), sc, '#2a1406', { align: 'center' })
      if (exact) drawText(ctx, String(Math.floor(n / 12) - 1), cx, py + ph - 9, 1, i === 0 ? CREAM : '#b59a6a', { align: 'center' })
    }
    if (!this.nextBuf.length) drawText(ctx, 'DONE!', nx + nw / 2, py + ph * 0.5, sn, GOLD, { align: 'center' })

    // Bach's face
    const fcv = this.face[g.face]
    const fs = Math.max(1, Math.floor((hudH - 8) / 32))
    const fw = 32 * fs
    const fx = Math.round(W / 2 - fw / 2), fy = Math.round(y0 + (hudH - fw) / 2 + 2)
    ctx.fillStyle = '#120a10'; ctx.fillRect(fx - 4, fy - 3, fw + 8, fw + 6)
    ctx.fillStyle = '#6b4a22'; ctx.fillRect(fx - 4, fy - 3, fw + 8, 2); ctx.fillRect(fx - 4, fy - 3, 2, fw + 6)
    const grd = ctx.createLinearGradient(0, fy, 0, fy + fw)
    grd.addColorStop(0, '#8a5a8e'); grd.addColorStop(1, '#4a2a5a')
    ctx.fillStyle = grd; ctx.fillRect(fx - 2, fy - 1, fw + 4, fw + 2)
    ctx.drawImage(fcv, fx, fy, fw, fw)

    // BFG meter
    const bx = Math.round(W * 0.5 + fw / 2 + 12), bW = Math.round(W * 0.19)
    this.panel(ctx, bx, py, bW, ph)
    const full = judge.charge >= 1
    drawText(ctx, 'BFG', bx + 6, py + 5, sl, full ? '#fff0a0' : GOLD)
    const lab = full ? 'READY! SLAM A FOREARM' : 'BIG FOREARM GESTURE'
    if (textWidth(lab, 1) + textWidth('BFG', sl) + 24 < bW) drawText(ctx, lab, bx + bW - 6, py + 5, 1, full ? '#fff0a0' : '#b59a6a', { align: 'right' })
    else if (full) drawText(ctx, 'READY!', bx + bW - 6, py + 5, 1, '#fff0a0', { align: 'right' })
    drawText(ctx, Math.round(judge.charge * 100) + '%', bx + 6, py + 5 + lh, sn, CREAM, { shadow: DARK })
    const segs = 12, sgW = (bW - 12) / segs, sgH = 6
    for (let i = 0; i < segs; i++) {
      const on = judge.charge * segs > i + 0.01
      ctx.fillStyle = on ? (full ? '#fff0a0' : '#ffc94a') : '#2a1626'
      ctx.fillRect(Math.round(bx + 6 + i * sgW), py + ph - sgH - 4, Math.max(2, Math.round(sgW) - 2), sgH)
    }

    // level info
    const ix = bx + bW + 6, iw = W - ix - Math.round(W * 0.012)
    this.panel(ctx, ix, py, iw, ph)
    const spec = g.spec
    drawText(ctx, spec.id, ix + 6, py + 5, sl, GOLD)
    const total = g.piece.notes.length
    drawText(ctx, 'NOTE ' + Math.min(total, g.ptr) + '/' + total, ix + 6, py + 5 + lh, sl, CREAM)
    if (g.isBoss) drawText(ctx, 'BAR ' + Math.min(g.piece.bars, g.bar + 1) + '/' + g.piece.bars, ix + 6, py + 5 + lh + 7 * sl + 4, sl, CREAM)
    else drawText(ctx, 'KILLS ' + g.st.kills + '/' + g.st.demons, ix + 6, py + 5 + lh + 7 * sl + 4, sl, CREAM)
    if (g.streak >= 3) drawText(ctx, 'STREAK ' + g.streak, ix + iw - 6, py + 5, sl, '#7cf0a0', { align: 'right' })
    drawText(ctx, g.diff === 'story' ? 'STORY' : g.diff === 'normal' ? 'NORMAL' : 'ULTRA', ix + iw - 6, py + ph - 7 * sl - 4, sl, '#b59a6a', { align: 'right' })
  }

  // ---------------------------------------------------------------- pop-ups, intro, boss bar
  private topLayer(ctx: CanvasRenderingContext2D, g: Game, view: View, W: number, viewH: number, ps: number) {
    // pop-ups
    for (const p of g.pops) {
      if (!p.on) continue
      const k = p.t / p.dur
      const sc = p.big ? ps + 1 : Math.max(2, ps)
      let x = W * p.fx, y = viewH * p.fy
      if (p.world) { if (!this.toScreen(view, p.wx, p.wy, p.wz)) continue; x = this.pt.x; y = this.pt.y }
      if (!g.reduced) y -= k * viewH * 0.08
      const a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1
      ctx.globalAlpha = Math.max(0, a)
      const half = textWidth(p.text, sc) / 2
      x = Math.max(half + 4, Math.min(W - half - 4, x))
      drawText(ctx, p.text, x, y, sc, p.col, { align: 'center', shadow: DARK })
    }
    ctx.globalAlpha = 1
    // intro card
    if (g.introT > 0 && g.phase === 'play') {
      const a = Math.min(1, g.introT / 0.6)
      ctx.globalAlpha = a
      const y = Math.round(viewH * (g.isBoss ? 0.2 : 0.07))
      const spec = g.spec
      const lines = [spec.id + ': ' + spec.name.toUpperCase(), '♪ ' + g.piece.title + '  -  ' + g.piece.origin, g.diff === 'ultra' ? 'PLAY IN TIME FOR PERFECTS!' : g.isBoss ? 'FOLLOW THE CHORDS. KEEP THE ORBS BACK!' : 'PLAY THE GLOWING KEYS TO HARMONIZE THE DEMONS!']
      const sc = [ps + 1, ps, Math.max(1, ps - 1)]
      const wmax = Math.max(...lines.map((l, i) => textWidth(l, sc[i]))) + ps * 8
      ctx.fillStyle = 'rgba(14,6,18,.72)'
      ctx.fillRect(Math.round(W / 2 - wmax / 2), y - ps * 2, wmax, ps * 38)
      let yy = y
      lines.forEach((l, i) => { drawText(ctx, l, W / 2, yy, sc[i], i === 0 ? GOLD : i === 1 ? CREAM : '#b9b0d6', { align: 'center', shadow: DARK }); yy += (7 + 4) * sc[i] })
      ctx.globalAlpha = 1
    }
    // boss health bar
    if (g.boss && g.phase === 'play' || (g.boss && g.phase === 'win')) {
      const bw = Math.round(W * 0.5), bx = Math.round(W / 2 - bw / 2), by = Math.round(viewH * 0.03), bh = Math.max(8, Math.round(ps * 4))
      ctx.fillStyle = 'rgba(14,6,18,.78)'; ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8 + (ps * 9))
      const segW = (bw - 4 * 4) / 5
      const cs = g.piece.chunks
      for (let i = 0; i < 5; i++) {
        const sx = bx + i * (segW + 4)
        ctx.fillStyle = '#2a1626'; ctx.fillRect(sx, by, segW, bh)
        const frac = Math.max(0, g.bossHp[i] ?? 0) / (cs[i].e - cs[i].s)
        ctx.fillStyle = i === g.bossPhase ? '#ff8a5a' : '#c9568a'
        ctx.fillRect(sx, by, Math.round(segW * frac), bh)
      }
      const ch = PRELUDE_C[Math.max(0, Math.min(PRELUDE_C.length - 1, g.bar))].chord
      drawText(ctx, 'CACOPHODEMON', bx, by + bh + 4, Math.max(1, ps - 1), GOLD, { shadow: DARK })
      drawText(ctx, 'BAR ' + (g.bar + 1) + '/' + g.piece.bars + '  CHORD ' + ch, bx + bw, by + bh + 4, Math.max(1, ps - 1), CREAM, { align: 'right', shadow: DARK })
    }
  }

  // ---------------------------------------------------------------- big screens
  private dim(ctx: CanvasRenderingContext2D, W: number, H: number, a: number) { ctx.fillStyle = `rgba(10,4,16,${a})`; ctx.fillRect(0, 0, W, H) }

  private star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, on: boolean) {
    ctx.beginPath()
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) }
    ctx.closePath()
    ctx.fillStyle = on ? GOLD : '#3b2a3a'; ctx.fill()
    ctx.lineWidth = Math.max(1, r * 0.12); ctx.strokeStyle = on ? '#8a5a14' : '#1a0c12'; ctx.stroke()
  }

  private wrap(s: string, scale: number, maxW: number): string[] {
    const out: string[] = []
    let line = ''
    for (const w of s.split(' ')) {
      const t = line ? line + ' ' + w : w
      if (textWidth(t, scale) > maxW && line) { out.push(line); line = w } else line = t
    }
    if (line) out.push(line)
    return out
  }

  private card(ctx: CanvasRenderingContext2D, W: number, H: number, bw: number, bh: number) {
    const x = Math.round(W / 2 - bw / 2), y = Math.round(H * 0.035)
    ctx.fillStyle = 'rgba(18,8,22,.94)'; ctx.fillRect(x, y, bw, bh)
    ctx.fillStyle = '#f2c24f'; ctx.fillRect(x, y, bw, 3); ctx.fillRect(x, y + bh - 3, bw, 3)
    ctx.fillStyle = '#8a5a14'; ctx.fillRect(x, y + 3, bw, 2); ctx.fillRect(x, y + bh - 5, bw, 2)
    return { x, y }
  }

  private count(t: number, delay: number, target: number) { return Math.round(target * Math.max(0, Math.min(1, (t - delay) / 0.8))) }

  private tally(ctx: CanvasRenderingContext2D, g: Game, W: number, H: number, ps: number) {
    this.dim(ctx, W, H, 0.62)
    const bw = Math.min(W - 16, Math.round(W * 0.6)), bh = Math.round(H * 0.66)
    const { x, y } = this.card(ctx, W, H, bw, bh)
    const t = this.screenT, r = g.result
    const sc = ps
    drawText(ctx, g.spec.id + ' FINISHED!', W / 2, y + bh * 0.07, sc + 1, GOLD, { align: 'center', shadow: DARK })
    drawText(ctx, g.spec.name, W / 2, y + bh * 0.07 + 11 * (sc + 1), Math.max(1, sc - 1), CREAM, { align: 'center' })
    const rows: [string, string][] = [
      ['KILLS', this.count(t, 0.3, Math.round(r.killsPct * 100)) + '%'],
      ['NOTES', this.count(t, 1.1, Math.round(r.notesPct * 100)) + '%'],
      ['ACCURACY', this.count(t, 1.9, Math.round(r.acc * 100)) + '%'],
      ['TIME', Math.floor(r.time / 60) + ':' + String(Math.floor(r.time % 60)).padStart(2, '0')],
    ]
    const ry = y + bh * 0.3
    rows.forEach(([a, b], i) => {
      const yy = ry + i * 10 * sc
      drawText(ctx, a, x + bw * 0.2, yy, sc, '#c9c3e6')
      drawText(ctx, b, x + bw * 0.8, yy, sc, CREAM, { align: 'right', shadow: DARK })
    })
    const sy = ry + 4 * 10 * sc + sc * 3
    for (let i = 0; i < 3; i++) this.star(ctx, W / 2 + (i - 1) * sc * 11, sy + sc * 4, sc * 4.5, t > 2.6 + i * 0.35 && i < r.stars)
    const fact = this.wrap(g.spec.fact, Math.max(1, sc - 1), bw * 0.86)
    fact.forEach((l, i) => drawText(ctx, l, W / 2, sy + sc * 12 + i * 9 * Math.max(1, sc - 1), Math.max(1, sc - 1), '#b9b0d6', { align: 'center' }))
  }

  private win(ctx: CanvasRenderingContext2D, g: Game, W: number, H: number, ps: number) {
    this.dim(ctx, W, H, 0.66)
    const bw = Math.min(W - 16, Math.round(W * 0.66)), bh = Math.round(H * 0.67)
    const { x, y } = this.card(ctx, W, H, bw, bh)
    const t = this.screenT, r = g.result, sc = ps
    drawText(ctx, 'YOU WIN!', W / 2, y + bh * 0.06, sc + 3, GOLD, { align: 'center', shadow: DARK })
    drawText(ctx, 'BACH IS PROUD', W / 2, y + bh * 0.06 + 10 * (sc + 3), sc + 1, CREAM, { align: 'center', shadow: DARK })
    const rows: [string, string][] = [
      ['ACCURACY', this.count(t, 0.4, Math.round(r.acc * 100)) + '%'],
      ['PERFECTS', String(g.st.perfects)],
      ['BFGS', String(g.st.bfgs)],
      ['TIME', Math.floor(r.time / 60) + ':' + String(Math.floor(r.time % 60)).padStart(2, '0')],
    ]
    const ry = y + bh * 0.4
    rows.forEach(([a, b], i) => {
      drawText(ctx, a, x + bw * 0.28, ry + i * 10 * sc, sc, '#c9c3e6')
      drawText(ctx, b, x + bw * 0.72, ry + i * 10 * sc, sc, CREAM, { align: 'right', shadow: DARK })
    })
    const sy = ry + 4 * 10 * sc + sc * 3
    for (let i = 0; i < 3; i++) this.star(ctx, W / 2 + (i - 1) * sc * 11, sy + sc * 4, sc * 4.5, t > 1.2 + i * 0.35 && i < r.stars)
    const fact = this.wrap(g.spec.fact, Math.max(1, sc - 1), bw * 0.86)
    fact.forEach((l, i) => drawText(ctx, l, W / 2, sy + sc * 12 + i * 9 * Math.max(1, sc - 1), Math.max(1, sc - 1), '#b9b0d6', { align: 'center' }))
  }

  private lose(ctx: CanvasRenderingContext2D, g: Game, W: number, H: number, ps: number) {
    this.dim(ctx, W, H, 0.55)
    const bw = Math.min(W - 16, Math.round(W * 0.5)), bh = Math.round(H * 0.58)
    const { y } = this.card(ctx, W, H, bw, bh)
    drawText(ctx, 'OUT OF HARMONY!', W / 2, y + bh * 0.12, ps + 2, GOLD, { align: 'center', shadow: DARK })
    const lines = this.wrap('Bach needs a quick coffee break. The demons are laughing, but they are not scary. Try the phrase again!', Math.max(1, ps - 1), bw * 0.84)
    lines.forEach((l, i) => drawText(ctx, l, W / 2, y + bh * 0.36 + i * 9 * Math.max(1, ps - 1), Math.max(1, ps - 1), CREAM, { align: 'center' }))
    const fs = Math.max(2, Math.floor((bh * 0.22) / 32))
    ctx.drawImage(this.face.dizzy, Math.round(W / 2 - 16 * fs), Math.round(y + bh * 0.62), 32 * fs, 32 * fs)
  }

  // ---------------------------------------------------------------- title
  private title(ctx: CanvasRenderingContext2D, g: Game, W: number, H: number, hudH: number, ps: number) {
    // darken the backdrop with a soft gradient so the logo and buttons read
    const gr = ctx.createLinearGradient(0, 0, 0, H)
    gr.addColorStop(0, 'rgba(10,4,16,.55)'); gr.addColorStop(0.45, 'rgba(10,4,16,.72)'); gr.addColorStop(1, 'rgba(10,4,16,.9)')
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)
    const word = 'BACHDOOM'
    const s = Math.max(3, Math.min(Math.floor((W * 0.58) / (8 * 6)), Math.floor((H * 0.17) / 7)))
    const lw = textWidth(word, s), lx = Math.round(W / 2 - lw / 2), ly = Math.round(H * 0.05)
    // extruded, two-tone chunky logo
    for (let i = s; i >= 1; i--) drawText(ctx, word, lx + i, ly + i, s, i > s * 0.5 ? '#3a0a1c' : '#7a1a2c')
    drawText(ctx, word, lx, ly, s, '#ffb347')
    ctx.save(); ctx.beginPath(); ctx.rect(lx - 4, ly - 4, lw + 12, 3.5 * s + 4); ctx.clip()
    drawText(ctx, word, lx, ly, s, '#fff3b0'); ctx.restore()
    // note decorations
    drawText(ctx, '♪', lx - 9 * s, ly + s, s, '#ffd76c', { shadow: '#3a0a1c' })
    drawText(ctx, '♪', lx + lw + 3 * s, ly + s, s, '#ffd76c', { shadow: '#3a0a1c' })
    const sub = 'EPISODE 1: KNEE-DEEP IN THE BAROQUE'
    const ss = Math.max(1, Math.min(ps, Math.floor((W * 0.8) / ((sub.length * 6) | 0))))
    drawText(ctx, sub, W / 2, ly + 7 * s + s * 2, ss, CREAM, { align: 'center', shadow: '#3a0a1c' })
    // the bottom strip: the same wooden bar the game uses, with a tagline
    ctx.drawImage(this.bar(W, hudH), 0, H - hudH)
    const tag = '♪ PLAY THE PIECE. HARMONIZE THE DEMONS. ♪'
    drawText(ctx, tag, W / 2, H - hudH / 2 - 3.5 * ps, ps, GOLD, { align: 'center', shadow: DARK })
    // keep DIFFS referenced so a rename there is caught by the type checker
    void DIFFS; void LEVELS
  }
}
