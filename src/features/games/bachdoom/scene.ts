// Turns the game's state into the list of billboards the raycaster draws (demons, boss, orbs, props, notes).
// The list is preallocated and refilled each frame.
import { newBillboard } from './render'
import type { Billboard } from './render'
import type { Game } from './game'
import type { DemonKind, Img, Sprites } from './types'

const HEIGHT: Record<DemonKind, number> = { imp: 1.22, grumble: 1.12, squeak: 0.8 }
/** tiny solid squares: 4 confetti colours (frames 2-5), gold and white sparks (6, 7) */
const dot = (abgr: number, n = 4): Img => ({ w: n, h: n, px: new Uint32Array(n * n).fill(abgr) })
const BITS: Img[] = [
  dot(0xff5fd0ff), dot(0xffa0f070), dot(0xffff9a5a), dot(0xff9a6aff), // butter, mint, sky, pink  (0xAABBGGRR)
  dot(0xff4ac9ff), dot(0xfff0fcff),
]
const TORCH: [number, number, number] = [255, 150, 60]
/** banner cloth colour per level (ambient is a wash, not a cloth colour) */
const BANNER: Record<string, [number, number, number]> = { E1M1: [200, 60, 80], E1M2: [140, 60, 200], E1M3: [70, 70, 200], E1M4: [220, 40, 40], E1M5: [120, 70, 220], E2M1: [240, 150, 60], E2M2: [220, 40, 100], E2M3: [230, 140, 30], E2M4: [60, 110, 230], E2M5: [40, 190, 150], E2M6: [150, 170, 255] }
const PROP_H = { column: 1, candles: 0.62, bust: 0.62, stand: 0.52, torch: 0.36, banner: 1 } as const

export class SceneList {
  list: Billboard[] = Array.from({ length: 200 }, newBillboard)
  n = 0
  private tmp = { x: 0, y: 0 }

  private next(): Billboard | null {
    if (this.n >= this.list.length) return null
    const b = this.list[this.n++]
    b.flip = false; b.tint = 0; b.glow = false; b.z = 0; b.ws = 1
    return b
  }

  build(g: Game, sp: Sprites) {
    this.n = 0
    const wh = g.map.spec.wallH ?? 1
    const clock = g.clock
    const demo = g.phase === 'title'
    const tc = g.map.spec.torch ?? TORCH, ac = g.map.spec.ambient ? BANNER[g.map.spec.id] ?? TORCH : TORCH

    for (const p of g.map.props) {
      const dx = p.x - g.camX, dy = p.y - g.camY
      if (dx * dx + dy * dy > 400) continue
      const b = this.next(); if (!b) break
      b.x = p.x; b.y = p.y
      if (p.kind === 'torch') {
        // slow two-frame flame, a different phase per sconce; the pose is fixed for kids who prefer reduced motion
        b.img = sp.props.torch[g.reduced ? 0 : Math.floor(clock * 2.2 + p.x * 1.7 + p.y * 2.3) & 1]
        b.z = Math.min(0.62, wh * 0.5); b.h = 0.55; b.glow = true
        b.tint = 0.4; b.tr = tc[0]; b.tg = tc[1]; b.tb = tc[2]
      } else if (p.kind === 'banner') {
        b.img = sp.props.banner
        b.h = Math.min(1.3, 0.55 * wh + 0.2); b.z = Math.max(0.15, wh - 0.2 - b.h)
        b.tint = 0.5; b.tr = ac[0]; b.tg = ac[1]; b.tb = ac[2]
      } else {
        b.img = sp.props[p.kind]
        b.h = p.kind === 'column' ? wh * 0.98 : PROP_H[p.kind] * Math.min(1.5, wh)
      }
    }
    for (const k of g.pickups) {
      if (!k.on) continue
      const b = this.next(); if (!b) break
      b.x = k.x; b.y = k.y; b.z = 0.38 + (g.reduced ? 0 : Math.sin(clock * 3 + k.ph) * 0.05); b.h = 0.2
      b.img = sp.note[Math.floor(clock * 2 + k.ph) & 1]; b.glow = true
    }
    for (const d of g.demons) {
      if (d.state === 2) continue
      if (d.room !== g.roomIdx && d.state !== 1) continue
      g.demonPos(d, this.tmp)
      const set = sp.demons[d.kind]
      const b = this.next(); if (!b) break
      b.x = this.tmp.x; b.y = this.tmp.y
      let h = HEIGHT[d.kind] * Math.min(1.25, wh)
      const fly = d.kind === 'squeak'
      b.z = fly ? 0.22 + Math.sin(d.t * 3) * 0.06 : Math.abs(Math.sin(d.t * 5)) * 0.025
      const walking = !demo && g.diff !== 'story' && d.dist > 2.55
      if (d.state === 1) {
        const k = Math.max(0, d.dieT / 0.85)
        b.img = set.hurt; b.tint = 0.85 * (1 - k); b.tr = 255; b.tg = 220; b.tb = 110
        h *= 0.35 + 0.65 * k; b.z += (1 - k) * 0.5; b.glow = true
      } else if (d.lungeT > 0 || (!demo && d.dist <= 2.55 && g.diff !== 'story')) b.img = set.attack
      else if (d.hurtT > 0) b.img = set.hurt
      else b.img = set.walk[Math.floor(d.t * (walking ? 4 : 2)) & 1]
      // squash on every hit (not a flash): shorter and wider, then springs back
      if (d.sq > 0 && !g.reduced) { const k = Math.sin((1 - d.sq / 0.12) * Math.PI); h *= 1 - 0.17 * k; b.ws = 1 + 0.2 * k }
      b.h = h
      if (d.hurtT > 0 && d.state === 0) { b.tint = 0.35; b.tr = 255; b.tg = 255; b.tb = 255 }
    }
    if (g.boss && g.room) {
      const bs = g.boss
      g.bossPos(this.tmp)
      const b = this.next()
      if (b) {
        b.x = this.tmp.x; b.y = this.tmp.y
        b.h = 2.5 * Math.min(1, wh / 2.2 + 0.2)
        b.z = 0.04 + (g.reduced ? 0 : Math.sin(clock * 1.7) * 0.07)
        if (bs.sq > 0 && !g.reduced) { const k = Math.sin((1 - bs.sq / 0.12) * Math.PI); b.h *= 1 - 0.1 * k; b.ws = 1 + 0.12 * k }
        if (bs.dieT >= 0) {
          const k = Math.max(0, 1 - bs.dieT / 2.6)
          b.img = sp.boss.hurt; b.tint = 0.85 * (1 - k); b.tr = 255; b.tg = 220; b.tb = 110; b.h *= 0.2 + 0.8 * k; b.glow = true
        } else if (bs.attackT > 0) b.img = sp.boss.attack
        else if (bs.hurtT > 0) { b.img = sp.boss.hurt; b.tint = 0.3 }
        else b.img = sp.boss.idle[Math.floor(clock * 2) & 1]
      }
      for (const o of g.orbs) {
        if (!o.on) continue
        g.orbPos(o, this.tmp)
        const ob = this.next(); if (!ob) break
        ob.x = this.tmp.x; ob.y = this.tmp.y; ob.z = o.z + Math.sin(o.t * 4) * 0.04; ob.h = 0.55 * (o.hitT > 0 && !g.reduced ? 1 + 0.5 * (o.hitT / 0.2) : 1); ob.glow = true
        ob.img = sp.orb[Math.floor(o.t * 8) & 1]
      }
    }
    for (const p of g.parts) {
      if (!p.on) continue
      const b = this.next(); if (!b) break
      b.x = p.x; b.y = p.y; b.z = p.z; b.glow = true
      if (p.frame >= 2) { b.h = (p.frame >= 6 ? 0.13 : 0.12) * Math.min(1, p.life / 0.2); b.img = BITS[p.frame - 2] }
      else { b.h = 0.17 * Math.min(1, p.life / 0.4); b.img = sp.note[(p.frame + Math.floor(clock * 6)) & 1] }
    }
    if (g.bfgT >= 0 && g.bfgT < 0.6 && g.room) {
      const t = g.bfgT / 0.6, r = g.room
      const b = this.next()
      if (b) {
        const dist = 0.9 + t * 4.2
        b.x = r.sx + r.hx * dist; b.y = r.sy + r.hy * dist
        b.z = 0.2 + t * 0.15; b.h = 0.35 + t * 0.9; b.glow = true
        b.img = sp.bfg[Math.floor(clock * 10) & 1]
      }
    }
  }
}
