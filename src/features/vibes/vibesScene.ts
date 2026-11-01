// The Vibes scene: a giant procedural face that feels the music, emoji that pop out of notes and chords,
// a valence x arousal "mood plane", and a slow colour wash. All state read from src/music/vibes.ts.
// Photosensitivity: the wash moves at a crawl (hue eases over seconds), nothing flashes, particles are small.
import type { Scene, SceneFactory, SceneReact } from '../visualizer/scenes'
import { MOODS, CHORD_EMOJI, noteEmoji, useVibes, vibeEventsSince, vibeSeq, type MoodId } from '../../music/vibes'
import { useHarmonyStore } from '../../music/harmonyStore'
import { FaceAnimator } from './face'
import { useChallenge } from './challenge'

const MAXP = 140
interface P { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; age: number; max: number; spr: HTMLCanvasElement | null; sway: number }

const sprites = new Map<string, HTMLCanvasElement>()
function sprite(ch: string): HTMLCanvasElement {
  let c = sprites.get(ch)
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (g) {
    g.font = '48px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(ch, 32, 36)
  }
  sprites.set(ch, c)
  return c
}
const hueDiff = (a: number, b: number) => ((b - a + 540) % 360) - 180

export const createVibes: SceneFactory = (reduced): Scene => {
  let w = 800, h = 500
  const face = new FaceAnimator(reduced)
  const pool: P[] = []
  for (let i = 0; i < MAXP; i++) pool.push({ x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, size: 24, age: 0, max: 1, spr: null, sway: 0 })
  let live = 0
  const heldX = new Map<number, number>()
  let seq = vibeSeq()
  let hue = 222, lastNow = 0, pulse = 0, shownMood: MoodId = 'calm'
  let moodAt = 0
  let won = useChallenge.getState().wins
  let everActive = false
  const trail: { v: number; a: number }[] = []
  let trailAt = 0
  const calm = reduced ? 0.5 : 1

  function spawn(ch: string, x: number, y: number, vx: number, vy: number, size: number, max: number, quality = 1) {
    if (live >= MAXP * Math.max(0.4, quality) * calm) return
    const p = pool[live++]
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.size = size; p.age = 0; p.max = max
    p.rot = reduced ? 0 : (Math.random() - 0.5) * 0.5; p.vr = reduced ? 0 : (Math.random() - 0.5) * 2
    p.spr = sprite(ch); p.sway = Math.random() * 6.28
  }
  function burst(chars: string[], x: number, y: number, n: number, speed: number, size: number) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4
      const s = speed * (0.5 + Math.random() * 0.7)
      spawn(chars[(Math.random() * chars.length) | 0], x, y, Math.cos(a) * s, Math.sin(a) * s, size * (0.8 + Math.random() * 0.5), 1.8 + Math.random() * 0.9)
    }
  }

  function events() {
    for (const e of vibeEventsSince(seq)) {
      seq = e.seq
      if (e.type === 'chord') {
        const xs = [...heldX.values()]
        const x = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : w / 2
        burst(CHORD_EMOJI[e.quality], x, h * 0.72, reduced ? 3 : 7, 150, 34)
        pulse = Math.min(0.09, pulse + 0.05)
      } else if (e.type === 'mood') {
        moodAt = lastNow
        const d = MOODS[e.mood]
        if (!reduced) burst(d.accents, w / 2, h * 0.3, 4, 120, 30)
      } else if (e.type === 'judge') {
        if (e.kind === 'boom') burst(['🤩', '🎉', '✨', '🥳'], w / 2, h * 0.55, 14, 220, 38)
        else if (e.kind === 'fizzle') burst(['🤪', '💨'], w / 2, h * 0.6, 4, 110, 32)
        else if (e.kind === 'cadence') burst(['😌', '💛', '👏'], w / 2, h * 0.6, 4, 120, 32)
        else if (e.kind === 'resolve') burst(['😮‍💨'], w / 2, h * 0.62, 2, 90, 30)
      }
    }
  }

  function wash(ctx: CanvasRenderingContext2D, now: number, st: ReturnType<typeof useVibes.getState>) {
    const target = MOODS[st.mood].hue
    hue = (hue + hueDiff(hue, target) * Math.min(1, (now - lastNow) / (reduced ? 4000 : 2200)) + 360) % 360
    const L = 9 + (st.arousal + 1) * 3 + st.intensity * 3
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, `hsl(${hue},50%,${L + 3}%)`)
    g.addColorStop(1, `hsl(${(hue + 25) % 360},45%,${L - 3}%)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // two big slow blobs of colour
    const t = reduced ? 0 : now * 0.00012
    for (let i = 0; i < 2; i++) {
      const bx = w * (0.3 + 0.4 * i) + Math.sin(t * (1 + i) + i * 2) * w * 0.12
      const by = h * (0.35 + 0.2 * i) + Math.cos(t * (1.3 + i) + i) * h * 0.1
      const r = Math.max(w, h) * 0.55
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, r)
      const a = 0.22 + st.intensity * 0.2
      rg.addColorStop(0, `hsla(${(hue + (i ? 35 : -20) + 360) % 360},75%,${40 + st.valence * 8}%,${a})`)
      rg.addColorStop(1, `hsla(${hue},70%,40%,0)`)
      ctx.fillStyle = rg
      ctx.fillRect(0, 0, w, h)
    }
  }

  function plane(ctx: CanvasRenderingContext2D, now: number, st: ReturnType<typeof useVibes.getState>) {
    const S = Math.max(78, Math.min(104, w * 0.1))
    const x0 = w - S - 14, y0 = Math.max(64, h * 0.5 - S / 2)
    ctx.save()
    ctx.fillStyle = 'rgba(10,8,30,0.5)'
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 1
    rr(ctx, x0, y0, S, S, 10); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.beginPath(); ctx.moveTo(x0 + S / 2, y0 + 4); ctx.lineTo(x0 + S / 2, y0 + S - 4); ctx.moveTo(x0 + 4, y0 + S / 2); ctx.lineTo(x0 + S - 4, y0 + S / 2); ctx.stroke()
    ctx.globalAlpha = 0.55
    const ce = 15
    ctx.drawImage(sprite('🤩'), x0 + S - ce - 3, y0 + 3, ce, ce)
    ctx.drawImage(sprite('😤'), x0 + 3, y0 + 3, ce, ce)
    ctx.drawImage(sprite('😢'), x0 + 3, y0 + S - ce - 3, ce, ce)
    ctx.drawImage(sprite('😌'), x0 + S - ce - 3, y0 + S - ce - 3, ce, ce)
    ctx.globalAlpha = 1
    if (now - trailAt > 110) { trailAt = now; trail.push({ v: st.valence, a: st.arousal }); if (trail.length > 36) trail.shift() }
    const px = (p: { v: number; a: number }) => x0 + 6 + ((p.v + 1) / 2) * (S - 12)
    const cur = { v: st.valence, a: st.arousal }
    const py = (p: { v: number; a: number }) => y0 + 6 + (1 - (p.a + 1) / 2) * (S - 12)
    const hc = MOODS[st.mood].hue
    for (let i = 1; i < trail.length; i++) {
      ctx.strokeStyle = `hsla(${hc},90%,70%,${(i / trail.length) * 0.7})`
      ctx.lineWidth = 1 + (i / trail.length) * 2.5
      ctx.beginPath(); ctx.moveTo(px(trail[i - 1]), py(trail[i - 1])); ctx.lineTo(px(trail[i]), py(trail[i])); ctx.stroke()
    }
    ctx.fillStyle = `hsl(${hc},95%,72%)`
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(px(cur), py(cur), 5.5, 0, 6.2832); ctx.fill(); ctx.stroke()
    ctx.fillStyle = 'rgba(235,230,255,0.75)'
    ctx.font = '700 9px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('SAD  ◂ MOOD ▸  HAPPY', x0 + S / 2, y0 + S + 12)
    ctx.restore()
  }

  return {
    ownBackdrop: true,
    resize(nw, nh) { w = nw; h = nh },
    noteOn(note, x, v, _kind, _hue, _name, g) {
      heldX.set(note, x)
      everActive = true
      pulse = Math.min(0.08, pulse + 0.02 + v * 0.025)
      if (g?.cluster) return
      const key = useHarmonyStore.getState().key
      const n = 1 + (v > 0.7 ? 1 : 0)
      for (let i = 0; i < n; i++) spawn(noteEmoji(note, key), x + (Math.random() - 0.5) * 16, h * 0.74, (Math.random() - 0.5) * 50, -(90 + Math.random() * 90 + v * 60), 24 + v * 14, 1.6 + Math.random() * 0.8)
    },
    react(ev: SceneReact) {
      void ev // judge echoes arrive through the vibe event feed
    },
    noteOff(note) { heldX.delete(note) },
    clear() { live = 0; heldX.clear(); seq = vibeSeq(); trail.length = 0 },
    drawBackdrop(ctx, now) {
      const st = useVibes.getState()
      wash(ctx, now, st)
    },
    draw(ctx, now, quality) {
      const dt = Math.min(64, lastNow ? now - lastNow : 16)
      const st = useVibes.getState()
      events()
      if (st.activity > 0.05) everActive = true
      // challenge win -> little party
      const wins = useChallenge.getState().wins
      if (wins !== won) { won = wins; burst(['🏆', '🎉', '⭐', '🥳', '👏'], w / 2, h * 0.5, 16, 240, 38) }
      if (st.mood !== shownMood) { shownMood = st.mood; face.setMood(st.mood) }
      face.step(dt)
      pulse *= Math.exp(-dt / 160)
      const R = Math.max(50, Math.min(w * 0.19, h * 0.22))
      const cx = w / 2, cy = h * 0.53
      const m = st.mood
      const bobby = !reduced && (m === 'groovy' || m === 'excited' || m === 'joyful')
      const fx = {
        pulse,
        bob: bobby ? Math.sin(now * (m === 'groovy' ? 0.0062 : 0.011)) * 0.025 * (0.4 + st.intensity) : 0,
        shake: !reduced && (m === 'tense' || m === 'angry') ? 0.008 * (0.4 + st.intensity) : 0,
      }
      // particles
      for (let i = live - 1; i >= 0; i--) {
        const p = pool[i]
        p.age += dt / 1000
        const u = p.age / p.max
        if (u >= 1) { pool[i] = pool[live - 1]; pool[live - 1] = p; live--; continue }
        p.vx *= Math.exp(-dt / 900)
        p.vy = p.vy * Math.exp(-dt / 1100) - 18 * dt / 1000
        p.x += (p.vx + Math.sin(p.age * 3 + p.sway) * (reduced ? 4 : 14)) * dt / 1000
        p.y += p.vy * dt / 1000
        p.rot += p.vr * dt / 1000
        const a = u < 0.12 ? u / 0.12 : 1 - Math.max(0, (u - 0.55) / 0.45)
        const s = p.size * (0.7 + 0.3 * Math.min(1, u * 6))
        ctx.globalAlpha = Math.max(0, a)
        if (p.rot) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.drawImage(p.spr!, -s / 2, -s / 2, s, s); ctx.restore() }
        else ctx.drawImage(p.spr!, p.x - s / 2, p.y - s / 2, s, s)
      }
      ctx.globalAlpha = 1
      face.draw(ctx, cx, cy, R, now, fx)
      // mood name under the face
      const def = MOODS[m]
      ctx.save()
      ctx.textAlign = 'center'
      ctx.font = `800 ${Math.round(Math.max(13, R * 0.17))}px system-ui, sans-serif`
      const label = def.label.toUpperCase()
      const ly = cy + R * 1.2 + 6
      ctx.fillStyle = 'rgba(10,8,30,0.45)'
      const tw = ctx.measureText(label).width + 56
      rr(ctx, cx - tw / 2, ly - R * 0.17 - 4, tw, R * 0.17 + 14, 14); ctx.fill()
      ctx.fillStyle = `hsl(${def.hue},90%,86%)`
      ctx.fillText(label, cx + 14, ly + 2)
      const es = R * 0.2
      ctx.drawImage(sprite(def.emoji), cx - tw / 2 + 10, ly - es * 0.82, es, es)
      if (!everActive) {
        ctx.fillStyle = 'rgba(240,236,255,0.8)'
        ctx.font = `600 ${Math.round(Math.max(12, R * 0.13))}px system-ui, sans-serif`
        ctx.fillText('Play a chord and watch how I feel!', cx, ly + R * 0.3 + 12)
      }
      ctx.restore()
      plane(ctx, now, st)
      void quality; void moodAt
      lastNow = now
    },
  }
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
