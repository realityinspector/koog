// Canvas 2D visualizer engine. No React here: the Visualizer component creates one
// per canvas and feeds it note events. Editing this file hot-swaps the engine.

import { useHarmonyStore } from '../../music/harmonyStore'
import { inKey, pc, type Key } from '../../music/theory'
import { DEFAULT_PARAMS, type SynthParams } from '../synth-history/params'

export type Mode = 'fireworks' | 'ripples' | 'rise' | 'fire'

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
  /** the synth patch drives the look: wave=shape, cutoff=brightness, resonance=halo, attack/release=bloom/linger, detune=ghost, glide=streaks */
  setPatch(p: SynthParams): void
  destroy(): void
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
// Hue walks the circle of fifths, so notes that sound good together get related colours.
const hueFor = (note: number) => (((note % 12) * 7) % 12) * 30

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number; sat?: number; tw?: number; wob?: number; trail?: boolean; nb?: boolean }
type Kind = 'tonic' | 'in' | 'spicy'
interface Rocket { x: number; y: number; vy: number; ty: number; hue: number }
interface Bloom { x: number; y: number; r: number; life: number; max: number; hue: number; n: number }
interface Ring { x: number; y: number; r: number; vr: number; life: number; max: number; hue: number; width: number; sat?: number; wob?: number }
interface Bar { note: number; x: number; top: number; bottom: number; hue: number; held: boolean; width: number; alpha: number; kind?: Kind }
interface Label { text: string; x: number; y: number; life: number; hue: number }
interface Streak { x1: number; y1: number; x2: number; y2: number; life: number; max: number; hue: number }
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

// Patch-driven particle sprites: shape per synth wave, softness per filter cutoff.
// shape 0 sine (round glow), 1 triangle, 2 square, 3 sawtooth (shards). level 0 muffled, 1 normal, 2 crisp.
const pdots = new Map<number, HTMLCanvasElement>()
function pdot(shape: number, level: number, hue: number, dull: boolean) {
  if (shape === 0 && level === 1) return dot(hue, dull)
  const hb = ((Math.round(hue / 15) % 24) + 24) % 24
  const id = ((shape * 3 + level) * 24 + hb) * 2 + (dull ? 1 : 0)
  let c = pdots.get(id)
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = DOT
  const g = c.getContext('2d')!
  const h = hb * 15, sat = dull ? 14 : 95, m = DOT / 2
  const lit = (dull ? 60 : 70) + (level === 2 ? 14 : level === 0 ? -8 : 0)
  const grad = g.createRadialGradient(m, m, 0, m, m, m)
  const a0 = level === 0 ? 0.7 : 1
  grad.addColorStop(0, `hsla(${h},${sat}%,${dull ? 60 : 88}%,${a0})`)
  grad.addColorStop(level === 2 ? 0.22 : 0.35, `hsla(${h},${sat}%,${dull ? 45 : 65}%,${level === 0 ? 0.5 : 0.8})`)
  grad.addColorStop(1, `hsla(${h},${sat}%,50%,0)`)
  g.fillStyle = grad
  g.globalAlpha = shape === 0 ? 1 : level === 0 ? 0.55 : 0.4
  g.fillRect(0, 0, DOT, DOT)
  g.globalAlpha = 1
  if (shape > 0) {
    g.shadowColor = `hsla(${h},${sat}%,65%,1)`
    g.shadowBlur = level === 0 ? 7 : level === 2 ? 1 : 4
    g.fillStyle = `hsla(${h},${sat}%,${lit}%,${level === 0 ? 0.75 : 1})`
    g.beginPath()
    const R = level === 0 ? 11 : 9
    if (shape === 1) { g.moveTo(m, m - R); g.lineTo(m + R * 0.95, m + R * 0.7); g.lineTo(m - R * 0.95, m + R * 0.7); g.closePath() }
    else if (shape === 2) g.rect(m - R * 0.7, m - R * 0.7, R * 1.4, R * 1.4)
    else {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 2.2 : 13
        const x = m + Math.cos(a) * rr, y = m + Math.sin(a) * rr
        i ? g.lineTo(x, y) : g.moveTo(x, y)
      }
      g.closePath()
    }
    g.fill()
  }
  if (pdots.size > 600) pdots.clear()
  pdots.set(id, c)
  return c
}

// Fire mode: flame puff sprites, pre-rendered once per (palette, heat stage) and stamped with drawImage.
// Palettes: 0 gold (in key), 1 green (copper), 2 blue (spicy), 3 white-hot (tonic). Stage 0 = hottest, 7 = smoke.
const FSTAGES = 8
const FPAL: number[][][] = [
  [[58, 100, 94], [48, 100, 70], [38, 100, 58], [26, 100, 52], [14, 100, 46], [4, 85, 36], [0, 20, 22], [0, 0, 14]],
  [[140, 100, 94], [130, 100, 72], [125, 95, 55], [145, 90, 45], [165, 80, 35], [190, 60, 28], [200, 20, 20], [0, 0, 14]],
  [[190, 100, 95], [196, 100, 75], [208, 100, 60], [222, 95, 50], [240, 80, 40], [255, 60, 30], [260, 20, 20], [0, 0, 14]],
  [[60, 60, 99], [55, 100, 90], [48, 100, 72], [36, 100, 60], [24, 100, 50], [10, 90, 40], [0, 20, 22], [0, 0, 14]],
]
const FSIZE = 48
const fireSprites: HTMLCanvasElement[] = []
function flameSpr(pal: number, stage: number) {
  const id = pal * FSTAGES + stage
  let c = fireSprites[id]
  if (!c) {
    c = document.createElement('canvas')
    c.width = c.height = FSIZE
    const g = c.getContext('2d')!
    const [hh, ss, ll] = FPAL[pal][stage]
    const grad = g.createRadialGradient(FSIZE / 2, FSIZE / 2, 0, FSIZE / 2, FSIZE / 2, FSIZE / 2)
    grad.addColorStop(0, `hsla(${hh},${ss}%,${ll}%,1)`)
    grad.addColorStop(0.4, `hsla(${hh},${ss}%,${ll}%,0.5)`)
    grad.addColorStop(1, `hsla(${hh},${ss}%,${ll}%,0)`)
    g.fillStyle = grad
    g.fillRect(0, 0, FSIZE, FSIZE)
    fireSprites[id] = c
  }
  return c
}
interface Flame { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; pal: number; ph: number; lift: number; spark?: boolean }
const MAX_FLAMES = 850

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
  // ---- Synth patch -> look. Defaults (DEFAULT_PARAMS) leave every factor neutral. ----
  let shape = 0, level = 1, sizeMul = 1, alphaMul = 1, patched = false
  let halo = 0, atkFrames = 0, linger = 1, ghost = 0, ghostDir = 1, glideAmt = 0
  const streaks: Streak[] = []
  let lastPos: { x: number; y: number; t: number } | null = null
  function setPatch(p: SynthParams) {
    const d = DEFAULT_PARAMS
    const isDef = p.wave === d.wave && p.detune === d.detune && p.cutoff === d.cutoff && p.resonance === d.resonance && p.attack === d.attack && p.release === d.release && p.glide === d.glide
    // Untouched default patch keeps the classic soft glow. Once she starts patching,
    // sawtooth shows as shards and stays that way (no flip-flopping as other knobs move).
    if (!isDef) patched = true
    shape = p.wave === 'sine' ? 0 : p.wave === 'triangle' ? 1 : p.wave === 'square' ? 2 : patched ? 3 : 0
    const k = Math.max(-1, Math.min(1, Math.log2(Math.max(40, p.cutoff) / d.cutoff) / 3))
    level = k < -0.3 ? 0 : k > 0.3 ? 2 : 1
    sizeMul = 1 + Math.max(0, -k) * 0.6
    alphaMul = 1 + k * 0.3
    halo = Math.max(0, Math.min(1, (p.resonance - 6) / 14))
    atkFrames = Math.min(72, Math.max(0, p.attack - d.attack) * 60)
    linger = Math.max(0.6, Math.min(2.2, 1 + 0.5 * Math.log2(Math.max(0.01, p.release) / d.release)))
    const dt = Math.abs(p.detune) - 7
    ghost = dt > 1 ? Math.min(1, dt / 40) : 0
    ghostDir = p.detune < 0 ? -1 : 1
    glideAmt = p.glide > 0.02 ? Math.min(1, p.glide / 0.3) : 0
  }
  const pushP = (p: Particle) => {
    if (particles.length >= MAX_PARTICLES * quality) return
    if (linger !== 1) p.max = Math.round(p.max * linger)
    if (atkFrames > 1 && !p.nb) p.max += atkFrames
    particles.push(p)
  }
  function burst(x: number, y: number, hue: number, n: number, speed: number, extra: Partial<Particle> = {}) {
    n = Math.round(n * calm * quality)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = (0.6 + Math.random()) * speed
      pushP({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 50 + Math.random() * 50, size: 1.5 + Math.random() * 2.5, hue: hue + (Math.random() - 0.5) * 30, ...extra })
    }
  }

  // ---- Fire mode state ----
  const flames: Flame[] = []
  const flashes: { x: number; life: number }[] = []
  let fireFloor: CanvasGradient | null = null
  let floorG = 0
  let ignite = 0 // 1 -> 0 over ~2.5s: the whole floor is burning
  let lastIgnite = 0
  let lastBall = 0
  const fireScale = () => Math.min(1.6, Math.max(0.6, h / 700))
  const rnd = Math.random
  function addFlame(x: number, y: number, vx: number, vy: number, max: number, size: number, pal: number, lift = 0.02, spark = false) {
    if (flames.length >= MAX_FLAMES * quality) return
    flames.push({ x, y, vx, vy, life: 0, max, size, pal, ph: rnd() * 6.28, lift, spark })
  }
  const palFor = (kind?: Kind) => (kind === 'spicy' ? 1 + (rnd() < 0.5 ? 1 : 0) : kind === 'tonic' && rnd() < 0.55 ? 3 : 0)
  function spark(x: number, y: number, pal: number, long = false) {
    addFlame(x, y, (rnd() - 0.5) * 1.6, -(2 + rnd() * 3.5) * fireScale(), (long ? 90 : 55) + rnd() * 50, 2.5 + rnd() * 2.5, pal, 0.012, true)
  }
  function fireball(x: number, y: number, pal: (() => number)) {
    const n = Math.round(28 * calm * quality)
    const hsc = fireScale()
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.7
      const sp = (1.5 + rnd() * 4) * hsc
      addFlame(x + (rnd() - 0.5) * 20, y, Math.cos(a) * sp, Math.sin(a) * sp, 30 + rnd() * 22, (17 + rnd() * 15) * Math.min(1.3, hsc), pal(), 0.012)
    }
    for (let i = 0; i < Math.round(8 * calm); i++) spark(x, y, pal(), true)
  }
  function emitFire() {
    const hsc = fireScale()
    const crowd = held.size > 4 ? Math.sqrt(4 / held.size) : 1
    const q = quality * calm
    for (const s of held.values()) {
      const ton = s.kind === 'tonic'
      const v = s.velocity
      const rate = (0.9 + v * 1.8) * (ton ? 1.5 : 1) * crowd * q
      const n = Math.floor(rate) + (rnd() < rate % 1 ? 1 : 0)
      const spread = ton ? 14 : 8 + v * 8
      for (let i = 0; i < n; i++) {
        addFlame(
          s.x + (rnd() - 0.5) * spread * 2, h - 6, (rnd() - 0.5) * 0.8,
          -(3 + v * 5) * hsc * (ton ? 1.5 : 1) * (0.7 + rnd() * 0.6) * (reduced ? 0.7 : 1),
          (28 + v * 18) * (ton ? 1.45 : 1) * (0.8 + rnd() * 0.4),
          (11 + v * 13) * (ton ? 1.4 : 1) * (0.8 + rnd() * 0.4) * Math.min(1.3, hsc),
          palFor(s.kind),
        )
      }
      if (rnd() < 0.22 * q) spark(s.x + (rnd() - 0.5) * spread * 2, h - 20, palFor(s.kind))
    }
    if (ignite > 0) {
      ignite = Math.max(0, ignite - 1 / 150)
      const n = Math.round(5 * ignite * q)
      for (let i = 0; i < n; i++) addFlame(rnd() * w, h - 6, (rnd() - 0.5) * 0.6, -(2.5 + rnd() * 3.5) * hsc, 30 + rnd() * 16, (11 + rnd() * 9) * Math.min(1.3, hsc), rnd() < 0.25 ? 3 : 0)
      if (rnd() < 0.3 * q) spark(rnd() * w, h - 20, 0)
    }
  }
  function drawFire(now: number) {
    const ft = now / 1000
    // warm floor glow: grows with the number of held notes (and floor ignition)
    floorG += (Math.min(1, held.size / 6) + ignite * 0.8 - floorG) * 0.06
    if (floorG > 0.02) {
      if (!fireFloor) {
        fireFloor = ctx.createLinearGradient(0, h, 0, h * 0.6)
        fireFloor.addColorStop(0, 'hsla(28,100%,55%,0.45)')
        fireFloor.addColorStop(0.5, 'hsla(14,100%,45%,0.15)')
        fireFloor.addColorStop(1, 'hsla(8,100%,40%,0)')
      }
      ctx.globalAlpha = Math.min(1, floorG)
      ctx.fillStyle = fireFloor
      ctx.fillRect(0, h * 0.6, w, h * 0.4)
    }
    for (const s of held.values()) {
      const g = 70 + s.velocity * 80 + (s.kind === 'tonic' ? 40 : 0)
      ctx.globalAlpha = 0.3
      ctx.drawImage(flameSpr(s.kind === 'spicy' ? 2 : s.kind === 'tonic' ? 3 : 0, 2), s.x - g, h - g * 0.6, g * 2, g * 1.2)
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]
      const t = 1 - ++f.life / 16
      if (t <= 0) { flashes.splice(i, 1); continue }
      const r = 70 + (1 - t) * 90
      ctx.globalAlpha = t * 0.85
      ctx.drawImage(flameSpr(3, 0), f.x - r, h - 70 - r, r * 2, r * 2)
    }
    for (let i = flames.length - 1; i >= 0; i--) {
      const p = flames[i]
      p.life++
      const age = p.life / p.max
      if (age >= 1) { flames[i] = flames[flames.length - 1]; flames.pop(); continue }
      p.vx = p.vx * 0.94 + Math.sin(p.y * 0.02 + ft * 6 + p.ph) * (p.spark ? 0.22 : 0.1)
      p.vy = p.vy * 0.99 - p.lift
      p.x += p.vx
      p.y += p.vy
      const flick = 0.8 + 0.2 * Math.sin(p.life * 0.9 + p.ph)
      if (p.spark) {
        const r = p.size * 2 * (1 - age * 0.5)
        ctx.globalAlpha = (1 - age) * flick
        ctx.drawImage(flameSpr(p.pal, Math.min(4, Math.floor(age * 5))), p.x - r, p.y - r, r * 2, r * 2)
      } else {
        const r = p.size * (1 - age * 0.65)
        ctx.globalAlpha = Math.pow(1 - age, 0.6) * 0.5 * flick
        ctx.drawImage(flameSpr(p.pal, Math.min(FSTAGES - 1, Math.floor(age * FSTAGES))), p.x - r, p.y - r * 1.3, r * 2, r * 2.6)
      }
    }
    ctx.globalAlpha = 1
  }

  let dpr = 1
  const resize = () => {
    dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const r = canvas.getBoundingClientRect()
    w = r.width
    h = r.height
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    fireFloor = null
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
    } else if (mode === 'fire') {
      held.set(note, { x, y: h, hue, velocity: v, kind })
      const ton = kind === 'tonic'
      const hsc = fireScale()
      const n = Math.round((8 + v * 14) * (ton ? 1.6 : 1) * calm * quality)
      for (let i = 0; i < n; i++) {
        addFlame(x + (rnd() - 0.5) * 22, h - 6, (rnd() - 0.5) * 1.6, -(4 + v * 6) * hsc * (ton ? 1.5 : 1) * (0.6 + rnd() * 0.6), 30 + rnd() * 20, (12 + v * 14) * Math.min(1.3, hsc), palFor(kind))
      }
      if (ton && flashes.length < 6) flashes.push({ x, life: 0 })
      const t = performance.now()
      if (kind !== 'spicy' && streak >= 12 && streak % 12 === 0 && t - lastIgnite > 3000) { ignite = 1; lastIgnite = t }
      if (held.size >= 3 && t - lastBall > 700) {
        lastBall = t
        const xs = [...held.values()]
        fireball(xs.reduce((a, q) => a + q.x, 0) / xs.length, h - 90, () => (xs.some((q) => q.kind === 'spicy') ? 1 + (rnd() < 0.5 ? 1 : 0) : rnd() < 0.3 ? 3 : 0))
      }
    } else {
      held.set(note, { x, y: h, hue, velocity: v, kind })
      bars.push({ note, x, top: h, bottom: h, hue: kind === 'spicy' ? spicyHue : kind === 'tonic' ? 45 : hue, kind, held: true, width: Math.max(8, (w / Math.max(12, hi - lo + 1)) * 0.7), alpha: 0.5 + v * 0.5 })
    }
    labels.push({ text: NAMES[note % 12] + (Math.floor(note / 12) - 1) + (kind === 'tonic' ? ' ★' : ''), x, y: (held.get(note)?.y ?? h) - 18, life: 0, hue: kind === 'spicy' ? 270 : hue })
    if (labels.length > 24) labels.shift()
    emojiFor(note, v, kind)
    patchFx(note, kind, hue, v)
  }

  // Resonance halo + glide streak, on top of whatever the mode drew.
  function patchFx(note: number, kind: Kind, hue: number, v: number) {
    const pos = held.get(note) ?? { x: xFor(note), y: h - 20 }
    const fireSoft = mode === 'fire' ? 0.5 : 1
    if (halo > 0.1 && !reduced && rings.length < 60 * quality) {
      rings.push({ x: pos.x, y: pos.y, r: 4, vr: 2 + v * 2, life: 0, max: 40 + halo * 40, hue: kind === 'tonic' ? 45 : hue + 25, width: (2 + halo * 4) * fireSoft })
      if (halo > 0.5 && mode !== 'fire') rings.push({ x: pos.x, y: pos.y, r: -8, vr: 2 + v * 2, life: 0, max: 60 + halo * 30, hue: hue - 25, width: 1.5 + halo * 2 })
    }
    const now = performance.now()
    if (glideAmt > 0 && lastPos && now - lastPos.t < 1500 && streaks.length < 8 && lastPos.x !== pos.x) {
      streaks.push({ x1: lastPos.x, y1: lastPos.y, x2: pos.x, y2: pos.y, life: 0, max: (25 + glideAmt * 60) * (reduced ? 0.6 : 1) * fireSoft, hue })
    }
    lastPos = { x: pos.x, y: pos.y, t: now }
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
    const was = held.get(note)
    held.delete(note)
    if (was && mode === 'fire') {
      // release: a few embers drift up and a puff of smoke
      for (let i = 0; i < Math.round(5 * calm * quality); i++) spark(was.x + (rnd() - 0.5) * 20, h - 30, palFor(was.kind), true)
      addFlame(was.x, h - 30, 0, -1.5, 40, 16, 0)
      if (flames.length) flames[flames.length - 1].life = 22
    }
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
      // fire mode: darken (translucent, even, never a flash) so the flames pop; theme tint still shows through
      if (mode === 'fire') {
        ctx.fillStyle = 'rgba(10,3,4,0.26)'
        ctx.fillRect(0, 0, w, h)
      }
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
      pushP({ x: r.x, y: r.y, vx: (Math.random() - 0.5) * 0.4, vy: 0.5, life: 0, max: 25, size: 2, hue: r.hue, tw: 1, nb: true })
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
    const hs = mode === 'fire' ? [] : [...held.values()]
    if (mode === 'fire') emitFire()
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
      if (p.trail && quality > 0.7 && p.life % 3 === 0 && particles.length < MAX_PARTICLES * 0.8 * quality) pushP({ x: p.x, y: p.y, vx: 0, vy: 0.2, life: 0, max: 18, size: p.size * 0.6, hue: p.hue + 20, tw: p.tw, nb: true })
      const dull = p.sat !== undefined
      const grow = atkFrames > 1 && !p.nb && p.life < atkFrames ? p.life / atkFrames : 1
      const r = 2.2 * p.size * sizeMul * (dull ? 0.8 + (1 - t) * 1.2 : 0.4 + t * 0.6) * (0.35 + 0.65 * grow)
      const al = Math.min(1, (dull ? t * 0.8 : t * tw) * alphaMul * grow)
      ctx.globalAlpha = al
      const spr = pdot(shape, level, p.hue, dull)
      ctx.drawImage(spr, p.x - r, p.y - r, r * 2, r * 2)
      if (ghost > 0 && quality > 0.6 && !p.nb) {
        const off = (2 + ghost * 7) * ghostDir
        ctx.globalAlpha = al * 0.45
        ctx.drawImage(spr, p.x - r + off, p.y - r - off * 0.4, r * 2, r * 2)
      }
    }
    ctx.globalAlpha = 1
    drawFire(now)

    ctx.lineCap = 'round'
    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i]
      const t = 1 - ++s.life / s.max
      if (t <= 0) { streaks.splice(i, 1); continue }
      ctx.strokeStyle = `hsla(${s.hue},95%,72%,${t * 0.55})`
      ctx.lineWidth = 2 + t * 5
      ctx.beginPath()
      ctx.moveTo(s.x1, s.y1)
      ctx.lineTo(s.x1 + (s.x2 - s.x1) * Math.min(1, (1 - t) * 4 + 0.15), s.y1 + (s.y2 - s.y1) * Math.min(1, (1 - t) * 4 + 0.15))
      ctx.stroke()
    }
    ctx.lineCap = 'butt'

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
    setPatch,
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
