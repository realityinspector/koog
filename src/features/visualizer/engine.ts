// Canvas 2D visualizer engine. No React here: the Visualizer component creates one
// per canvas and feeds it note events. Editing this file hot-swaps the engine.

import { useHarmonyStore } from '../../music/harmonyStore'
import { inKey, pc, type Key } from '../../music/theory'

export type Mode = 'fireworks' | 'ripples' | 'rise'

// Background themes (request #7: "brighter and more fun"). Colours drift slowly, never flash.
export type Theme = 'rainbow' | 'candy' | 'ocean' | 'sunset' | 'night'
export const THEMES: { id: Theme; label: string }[] = [
  { id: 'rainbow', label: '🌈 Rainbow' },
  { id: 'candy', label: '🍬 Candy' },
  { id: 'ocean', label: '🌊 Ocean' },
  { id: 'sunset', label: '🌅 Sunset' },
  { id: 'night', label: '🌙 Night' },
]
// [top hue, bottom hue, saturation, top lightness, bottom lightness, drift speed]
const THEME_DEF: Record<Theme, [number, number, number, number, number, number]> = {
  rainbow: [280, 200, 70, 24, 30, 0.12],
  candy: [320, 270, 75, 30, 36, 0.02],
  ocean: [190, 230, 75, 22, 30, 0.02],
  sunset: [20, 320, 80, 30, 26, 0.02],
  night: [240, 240, 35, 6, 8, 0],
}

export interface Engine {
  noteOn(note: number, velocity: number): void
  noteOff(note: number): void
  setMode(mode: Mode): void
  setEmoji(on: boolean): void
  setTheme(theme: Theme): void
  destroy(): void
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
// Hue walks the circle of fifths, so notes that sound good together get related colours.
const hueFor = (note: number) => (((note % 12) * 7) % 12) * 30

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number; sat?: number; tw?: number; wob?: number; trail?: boolean }
type Kind = 'tonic' | 'in' | 'spicy'
interface Rocket { x: number; y: number; vy: number; ty: number; hue: number }
interface Bloom { x: number; y: number; r: number; life: number; max: number; hue: number; n: number }
interface Ring { x: number; y: number; r: number; vr: number; life: number; max: number; hue: number; width: number; sat?: number; wob?: number }
interface Bar { note: number; x: number; top: number; bottom: number; hue: number; held: boolean; width: number; alpha: number; kind?: Kind }
interface Label { text: string; x: number; y: number; life: number; hue: number }
interface Held { x: number; y: number; hue: number; velocity: number; kind?: Kind }

const MAX_PARTICLES = 1100
const MAX_EMOJI = 140

// Emoji sets (feature request #1 from the in-app idea box).
const EMOJI_IN = ['🎵', '🎶', '✨', '💖', '🦋', '🌈', '🍭', '🎉', '💫', '🌸', '⭐', '🪩', '🫧', '🍓', '🐬']
const EMOJI_TONIC = ['🌟', '👑', '🏆', '💎']
const EMOJI_SPICY = ['🌶️', '🌶️', '🌶️', '🥵', '😜']
const EMOJI_FIRE = ['🔥', '🚀', '⚡️', '😎']
const EMOJI_CHORD = ['🌈', '🎹', '🪐']
interface Emoji { ch: string; x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; life: number; max: number }
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]

// Perf (request #3): thousands of separate arc() fills per frame overload the GPU.
// Instead, pre-render one soft glowing dot per hue bucket and stamp it with drawImage.
const DOT = 32
const dots = new Map<number, HTMLCanvasElement>()
function dot(hue: number, dull: boolean) {
  const hb = ((Math.round(hue / 15) % 24) + 24) % 24
  const id = hb * 2 + (dull ? 1 : 0)
  let c = dots.get(id)
  if (!c) {
    c = document.createElement('canvas')
    c.width = c.height = DOT
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(DOT / 2, DOT / 2, 0, DOT / 2, DOT / 2, DOT / 2)
    const h = hb * 15
    const sat = dull ? 14 : 95
    grad.addColorStop(0, `hsla(${h},${sat}%,${dull ? 60 : 88}%,1)`)
    grad.addColorStop(0.3, `hsla(${h},${sat}%,${dull ? 45 : 65}%,0.85)`)
    grad.addColorStop(1, `hsla(${h},${sat}%,50%,0)`)
    g.fillStyle = grad
    g.fillRect(0, 0, DOT, DOT)
    dots.set(id, c)
  }
  return c
}

// Drawing emoji text every frame is slow too, so rasterize each one once.
const SPRITE = 64
const sprites = new Map<string, HTMLCanvasElement>()
function sprite(ch: string) {
  let c = sprites.get(ch)
  if (!c) {
    c = document.createElement('canvas')
    c.width = c.height = SPRITE
    const g = c.getContext('2d')!
    g.font = `${SPRITE * 0.8}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(ch, SPRITE / 2, SPRITE / 2 + 2)
    sprites.set(ch, c)
  }
  return c
}

export function createEngine(canvas: HTMLCanvasElement): Engine {
  const ctx = canvas.getContext('2d')!
  let w = 0
  let h = 0
  let mode: Mode = 'fireworks'
  let lo = 48
  let hi = 84
  let lastNoteAt = 0
  let raf = 0

  const particles: Particle[] = []
  const rings: Ring[] = []
  const bars: Bar[] = []
  const labels: Label[] = []
  const held = new Map<number, Held>()
  const motes: Particle[] = []
  const rockets: Rocket[] = []
  const blooms: Bloom[] = []
  const emojis: Emoji[] = []
  const laneGrad = new Map<string, CanvasGradient>()
  let emojiOn = false
  let theme: Theme = 'rainbow'
  let drift = 0
  let tint = 0 // nudged by played notes
  let bgGrad: CanvasGradient | null = null
  let bgFrame = 0
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const calm = reduced ? 0.5 : 1
  let streak = 0
  let quality = 1 // 0.35..1, drops automatically when frames get slow
  let lastFrame = performance.now()
  let frameEma = 16
  let chordT = 0 // 0..1 fade of the held-chord mandala
  let chordKey = ''
  let lastChordBloom = 0
  const curKey = (): Key => useHarmonyStore.getState().key
  const kindOf = (note: number): Kind => {
    const k = curKey()
    if (pc(note) === k.tonic) return 'tonic'
    return inKey(note, k) ? 'in' : 'spicy'
  }
  const pushP = (p: Particle) => { if (particles.length < MAX_PARTICLES * quality) particles.push(p) }
  function burst(x: number, y: number, hue: number, n: number, speed: number, extra: Partial<Particle> = {}) {
    n = Math.round(n * calm * quality)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = (0.6 + Math.random()) * speed
      pushP({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 50 + Math.random() * 50, size: 1.5 + Math.random() * 2.5, hue: hue + (Math.random() - 0.5) * 30, ...extra })
    }
  }

  let dpr = 1
  const resize = () => {
    dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const r = canvas.getBoundingClientRect()
    w = r.width
    h = r.height
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0b0b16'
    ctx.fillRect(0, 0, w, h)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  for (let i = 0; i < 40; i++) {
    motes.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.2, vy: -0.1 - Math.random() * 0.2, life: 0, max: 1, size: 1 + Math.random() * 1.5, hue: Math.random() * 360 })
  }

  const xFor = (note: number) => {
    lo = Math.min(lo, note)
    hi = Math.max(hi, note)
    const pad = Math.min(60, w * 0.06)
    return pad + ((note - lo) / Math.max(1, hi - lo)) * (w - pad * 2)
  }

  function noteOn(note: number, velocity: number) {
    const v = Math.max(1, Math.min(127, velocity)) / 127
    const hue = hueFor(note)
    const x = xFor(note)
    lastNoteAt = performance.now()
    if (theme === 'rainbow') tint += (((hue - (THEME_DEF.rainbow[0] + drift + tint)) % 360 + 540) % 360 - 180) * 0.04

    const kind = kindOf(note)
    if (kind === 'spicy') streak = Math.floor(streak / 3)
    else streak++
    const boost = 1 + Math.min(1.2, streak * 0.04)
    const spicyHue = 270 + (Math.random() - 0.5) * 30

    if (mode === 'fireworks') {
      const y = h - 40 - v * h * 0.55
      held.set(note, { x, y, hue, velocity: v, kind })
      if (kind === 'spicy') {
        burst(x, y, spicyHue, 10 + v * 16, 1 + v * 2, { sat: 12, wob: 1, size: 2 + Math.random() * 3 })
      } else {
        const sc = kind === 'tonic' ? 1.3 : 1
        burst(x, y, hue, (14 + v * 46) * boost * sc, (1.5 + v * 4.5) * sc, { tw: Math.random() * 6.28, trail: streak > 5 })
        if (kind === 'tonic') {
          for (let i = 0; i < Math.round(36 * calm); i++) {
            const a = (i / 36) * Math.PI * 2
            pushP({ x, y, vx: Math.cos(a) * 5.5, vy: Math.sin(a) * 5.5, life: 0, max: 80, size: 2.6, hue: 45, tw: i, trail: true })
          }
          rings.push({ x, y, r: 4, vr: 4, life: 0, max: 70, hue: 45, width: 5 })
        }
        if (!reduced && streak >= 8 && rockets.length < 3 && Math.random() < Math.min(0.7, 0.15 + streak * 0.03)) {
          rockets.push({ x: w * (0.15 + Math.random() * 0.7), y: h, vy: -(7 + Math.random() * 3), ty: h * (0.15 + Math.random() * 0.3), hue: Math.random() * 360 })
        }
      }
    } else if (mode === 'ripples') {
      const y = h * 0.5 + (Math.random() - 0.5) * h * 0.4
      held.set(note, { x, y, hue, velocity: v, kind })
      const sp = kind === 'spicy'
      const nr = kind === 'tonic' ? 5 : sp ? 2 : 3 + (streak > 6 ? 1 : 0)
      for (let k = 0; k < nr; k++) {
        rings.push({ x, y, r: 4 + k * -14, vr: (1.2 + v * 2.5) * (sp ? 0.7 : 1), life: 0, max: (110 + v * 60) * (sp ? 0.7 : 1), hue: sp ? spicyHue : kind === 'tonic' ? 45 : hue, width: 1.5 + v * 4 - k, sat: sp ? 12 : undefined, wob: sp && !reduced ? 1 : undefined })
      }
    } else {
      held.set(note, { x, y: h, hue, velocity: v, kind })
      bars.push({ note, x, top: h, bottom: h, hue: kind === 'spicy' ? spicyHue : kind === 'tonic' ? 45 : hue, kind, held: true, width: Math.max(8, (w / Math.max(12, hi - lo + 1)) * 0.7), alpha: 0.5 + v * 0.5 })
    }
    labels.push({ text: NAMES[note % 12] + (Math.floor(note / 12) - 1) + (kind === 'tonic' ? ' ★' : ''), x, y: (held.get(note)?.y ?? h) - 18, life: 0, hue: kind === 'spicy' ? 270 : hue })
    if (labels.length > 24) labels.shift()
    emojiFor(note, v, kind)
  }

  function spawnEmoji(x: number, y: number, set: string[], n: number, v: number) {
    n = Math.max(1, Math.round(n * quality))
    for (let i = 0; i < n && emojis.length < MAX_EMOJI * quality; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2
      const s = (2 + Math.random() * 3) * (0.7 + v * 0.6) * (reduced ? 0.6 : 1)
      emojis.push({ ch: pick(set), x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: (Math.random() - 0.5) * 0.6, vr: reduced ? 0 : (Math.random() - 0.5) * 0.08, size: 18 + v * 18 + Math.random() * 8, life: 0, max: 80 + Math.random() * 40 })
    }
  }

  function emojiFor(note: number, v: number, kind: Kind) {
    if (!emojiOn) return
    const y = held.get(note)?.y ?? h - 40
    const x = held.get(note)?.x ?? xFor(note)
    if (kind === 'spicy') return spawnEmoji(x, y, EMOJI_SPICY, 2 + Math.round(v * 2), v)
    if (kind === 'tonic') spawnEmoji(x, y, EMOJI_TONIC, 3, v)
    else spawnEmoji(x, y, EMOJI_IN, 1 + Math.round(v * 3), v)
    if (streak >= 32 || streak === 8 || streak === 16) spawnEmoji(x, y, EMOJI_FIRE, streak >= 32 ? 2 : 4, v)
    const hs = [...held.values()]
    if (hs.length >= 3 && hs.every((s) => s.kind !== 'spicy')) spawnEmoji(x, y - 20, EMOJI_CHORD, 1, v)
  }

  function noteOff(note: number) {
    held.delete(note)
    for (const b of bars) if (b.note === note && b.held) b.held = false
  }

  function frame() {
    const now = performance.now()
    frameEma = frameEma * 0.9 + Math.min(100, now - lastFrame) * 0.1
    lastFrame = now
    if (frameEma > 21) quality = Math.max(0.35, quality - 0.02)
    else if (frameEma < 17.5) quality = Math.min(1, quality + 0.005)
    // Translucent fill leaves soft trails. Kept dark and even: no full-screen flashes.
    ctx.globalCompositeOperation = 'source-over'
    {
      const [h1, h2, sat, l1, l2, speed] = THEME_DEF[theme]
      drift = (drift + speed * (reduced ? 0.3 : 1)) % 360
      // rebuild the gradient every few frames (cheap) as the hue drifts
      if (!bgGrad || ++bgFrame % 6 === 0) {
        const a = mode === 'rise' ? 0.35 : 0.16
        const off = drift + tint
        bgGrad = ctx.createLinearGradient(0, 0, w * 0.3, h)
        bgGrad.addColorStop(0, `hsla(${h1 + off},${sat}%,${l1}%,${a})`)
        bgGrad.addColorStop(0.55, `hsla(${(h1 + h2) / 2 + off + 20},${sat}%,${(l1 + l2) / 2}%,${a})`)
        bgGrad.addColorStop(1, `hsla(${h2 + off},${sat}%,${l2}%,${a})`)
      }
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)
    }
    ctx.globalCompositeOperation = 'lighter'

    // ambient motes when idle
    const idle = performance.now() - lastNoteAt > 3000
    for (const m of motes) {
      m.x += m.vx
      m.y += m.vy
      if (m.y < -5) { m.y = h + 5; m.x = Math.random() * w }
      m.hue += 0.2
      const r = m.size * 2.2
      ctx.globalAlpha = idle ? 0.35 : 0.12
      ctx.drawImage(dot(m.hue, false), m.x - r, m.y - r, r * 2, r * 2)
    }
    ctx.globalAlpha = 1

    // key backdrop: faint glowing lanes where the safe notes live
    {
      const k = curKey()
      const pad = Math.min(60, w * 0.06)
      for (let n = lo; n <= hi; n++) {
        if (!inKey(n, k)) continue
        const x = pad + ((n - lo) / Math.max(1, hi - lo)) * (w - pad * 2)
        const ton = pc(n) === k.tonic
        const lw = Math.max(6, (w / Math.max(12, hi - lo + 1)) * 0.5)
        const hh = ton ? 45 : hueFor(n)
        const gk = `${hh}|${ton}|${h}`
        let g = laneGrad.get(gk)
        if (!g) {
          g = ctx.createLinearGradient(0, h, 0, h * (ton ? 0.55 : 0.75))
          g.addColorStop(0, `hsla(${hh},90%,65%,${ton ? 0.2 : 0.09})`)
          g.addColorStop(1, `hsla(${hh},90%,65%,0)`)
          if (laneGrad.size > 200) laneGrad.clear()
          laneGrad.set(gk, g)
        }
        ctx.fillStyle = g
        ctx.fillRect(x - lw / 2, h * (ton ? 0.55 : 0.75), lw, h * (ton ? 0.45 : 0.25))
        ctx.fillStyle = `hsla(${hh},90%,70%,${ton ? 0.5 : 0.25})`
        ctx.beginPath()
        ctx.arc(x, h - 8, ton ? 4 : 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // rockets
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]
      r.y += r.vy
      r.vy *= 0.985
      pushP({ x: r.x, y: r.y, vx: (Math.random() - 0.5) * 0.4, vy: 0.5, life: 0, max: 25, size: 2, hue: r.hue, tw: 1 })
      ctx.fillStyle = `hsl(${r.hue},100%,85%)`
      ctx.beginPath()
      ctx.arc(r.x, r.y, 3, 0, Math.PI * 2)
      ctx.fill()
      if (r.y <= r.ty || r.vy > -1.5) {
        burst(r.x, r.y, r.hue, 70, 5, { tw: Math.random() * 6, trail: true })
        burst(r.x, r.y, r.hue + 60, 30, 3, { tw: 2 })
        rockets.splice(i, 1)
      }
    }

    // held notes: soft glow + constellation lines between everything being held (chords!)
    const hs = [...held.values()]
    if (hs.length > 1) {
      ctx.lineWidth = 1.5
      for (let i = 0; i < hs.length; i++) {
        for (let j = i + 1; j < hs.length; j++) {
          if (hs.length > 5) ctx.strokeStyle = `hsla(${hs[i].hue},90%,65%,0.45)`
          else {
            const g = ctx.createLinearGradient(hs[i].x, hs[i].y, hs[j].x, hs[j].y)
            g.addColorStop(0, `hsla(${hs[i].hue},90%,65%,0.55)`)
            g.addColorStop(1, `hsla(${hs[j].hue},90%,65%,0.55)`)
            ctx.strokeStyle = g
          }
          ctx.beginPath()
          ctx.moveTo(hs[i].x, hs[i].y)
          ctx.lineTo(hs[j].x, hs[j].y)
          ctx.stroke()
        }
      }
    }
    // consonant chord (3+ distinct held notes, all in key): rotating mandala bloom
    {
      const ids = [...held.keys()]
      const ok = ids.length >= 3 && ids.every((n) => kindOf(n) !== 'spicy') && new Set(ids.map(pc)).size >= 3
      chordT += ((ok ? 1 : 0) - chordT) * 0.08
      if (ok) {
        const key = ids.map(pc).sort().join(',')
        if (key !== chordKey && performance.now() - lastChordBloom > 400) {
          chordKey = key
          lastChordBloom = performance.now()
        }
      } else chordKey = ''
      if (chordT > 0.02 && hs.length) {
        const cx = hs.reduce((a, q) => a + q.x, 0) / hs.length
        const cy = hs.reduce((a, q) => a + q.y, 0) / hs.length
        const R = (60 + hs.length * 18 + Math.max(...hs.map((q) => q.velocity)) * 40) * chordT
        const rot = reduced ? 0 : performance.now() / 6000
        ctx.lineWidth = 1.2
        for (let layer = 0; layer < 3; layer++) {
          const petals = 6 + layer * 2 + hs.length
          for (let i = 0; i < petals; i++) {
            const a = rot * (layer % 2 ? -1 : 1) + (i / petals) * Math.PI * 2
            const hue = hs[i % hs.length].hue + layer * 20
            const rr = R * (0.45 + layer * 0.3)
            const px = cx + Math.cos(a) * rr
            const py = cy + Math.sin(a) * rr
            ctx.strokeStyle = `hsla(${hue},90%,70%,${0.28 * chordT})`
            ctx.beginPath()
            ctx.ellipse((cx + px) / 2, (cy + py) / 2, rr / 2, rr * 0.22, a, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
        for (let i = 0; i < hs.length; i++) {
          for (let j = i + 1; j < hs.length; j++) {
            ctx.strokeStyle = `hsla(${hs[i].hue},90%,75%,${0.35 * chordT})`
            ctx.beginPath()
            ctx.moveTo(hs[i].x, hs[i].y)
            ctx.lineTo(hs[j].x, hs[j].y)
            ctx.stroke()
          }
        }
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6)
        g.addColorStop(0, `hsla(45,100%,80%,${0.22 * chordT})`)
        g.addColorStop(1, 'hsla(45,100%,60%,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, R * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    if (mode !== 'rise') {
      for (const s of hs) {
        const r = 18 + s.velocity * 30
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r)
        g.addColorStop(0, `hsla(${s.hue},100%,75%,0.5)`)
        g.addColorStop(1, `hsla(${s.hue},100%,60%,0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life++
      p.vx *= 0.985
      p.vy = p.vy * 0.985 + 0.035
      p.x += p.vx
      p.y += p.vy
      const t = 1 - p.life / p.max
      if (t <= 0) { particles[i] = particles[particles.length - 1]; particles.pop(); continue }
      if (p.wob) p.x += Math.sin(p.life * 0.5 + i) * 0.6
      const tw = p.tw !== undefined ? 0.55 + 0.45 * Math.sin(p.life * 0.35 + p.tw) : 1
      if (p.trail && quality > 0.7 && p.life % 3 === 0 && particles.length < MAX_PARTICLES * 0.8 * quality) pushP({ x: p.x, y: p.y, vx: 0, vy: 0.2, life: 0, max: 18, size: p.size * 0.6, hue: p.hue + 20, tw: p.tw })
      const dull = p.sat !== undefined
      const r = 2.2 * p.size * (dull ? 0.8 + (1 - t) * 1.2 : 0.4 + t * 0.6)
      ctx.globalAlpha = dull ? t * 0.8 : t * tw
      ctx.drawImage(dot(p.hue, dull), p.x - r, p.y - r, r * 2, r * 2)
    }
    ctx.globalAlpha = 1

    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]
      r.life++
      r.r += r.vr
      r.vr *= 0.992
      const t = 1 - r.life / r.max
      if (t <= 0) { rings.splice(i, 1); continue }
      if (r.r <= 0) continue
      ctx.strokeStyle = `hsla(${r.hue},${r.sat ?? 90}%,${r.sat ? 45 : 65}%,${t * (r.sat ? 0.6 : 0.9)})`
      ctx.lineWidth = Math.max(0.5, r.width * t)
      ctx.beginPath()
      if (r.wob) {
        for (let a = 0; a <= 48; a++) {
          const ang = (a / 48) * Math.PI * 2
          const rr = r.r + Math.sin(ang * 5 + r.life * 0.25) * (3 + r.r * 0.04)
          a ? ctx.lineTo(r.x + Math.cos(ang) * rr, r.y + Math.sin(ang) * rr) : ctx.moveTo(r.x + Math.cos(ang) * rr, r.y + Math.sin(ang) * rr)
        }
        ctx.closePath()
      } else ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
      ctx.stroke()
    }

    for (let i = bars.length - 1; i >= 0; i--) {
      const b = bars[i]
      const speed = 2.2
      if (b.held) b.top -= speed
      else { b.top -= speed; b.bottom -= speed }
      if (b.bottom < -10) { bars.splice(i, 1); continue }
      const g = ctx.createLinearGradient(0, b.top, 0, b.bottom)
      const sp = b.kind === 'spicy'
      g.addColorStop(0, `hsla(${b.hue},${sp ? 14 : 100}%,${sp ? 50 : 75}%,${b.alpha * (sp ? 0.6 : 1)})`)
      g.addColorStop(1, `hsla(${b.hue},${sp ? 10 : 100}%,${sp ? 30 : 50}%,${b.alpha * 0.3})`)
      ctx.fillStyle = g
      const x = b.x - b.width / 2 + (sp && !reduced ? Math.sin(performance.now() / 90 + b.top * 0.05) * 2 : 0)
      const hgt = Math.max(2, b.bottom - b.top)
      ctx.beginPath()
      ctx.roundRect(x, b.top, b.width, hgt, Math.min(b.width / 2, 8))
      ctx.fill()
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.font = '600 14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i]
      l.life++
      l.y -= 0.5
      const t = 1 - l.life / 70
      if (t <= 0) { labels.splice(i, 1); continue }
      ctx.fillStyle = `hsla(${l.hue},90%,80%,${t})`
      ctx.fillText(l.text, l.x, l.y)
    }

    ctx.textBaseline = 'middle'
    for (let i = emojis.length - 1; i >= 0; i--) {
      const e = emojis[i]
      e.life++
      e.vx *= 0.99
      e.vy = e.vy * 0.99 + 0.06
      e.x += e.vx
      e.y += e.vy
      e.rot += e.vr
      const t = 1 - e.life / e.max
      if (t <= 0 || e.y > h + 40) { emojis[i] = emojis[emojis.length - 1]; emojis.pop(); continue }
      const sz = e.size * 1.25 * Math.min(1, e.life / 8) // quick scale-in
      ctx.globalAlpha = Math.min(1, t * 1.6)
      const c = Math.cos(e.rot), sn = Math.sin(e.rot)
      ctx.setTransform(dpr * c, dpr * sn, -dpr * sn, dpr * c, dpr * e.x, dpr * e.y)
      ctx.drawImage(sprite(e.ch), -sz / 2, -sz / 2, sz, sz)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalAlpha = 1
    ctx.textBaseline = 'alphabetic'

    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    noteOn,
    noteOff,
    setMode(m) {
      mode = m
      held.clear()
      for (const b of bars) b.held = false
    },
    setTheme(t) {
      theme = t
      bgGrad = null
    },
    setEmoji(on) {
      emojiOn = on
      if (!on) emojis.length = 0
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
    },
  }
}
