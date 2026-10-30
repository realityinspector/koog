// Canvas 2D visualizer engine. No React here: the Visualizer component creates one
// per canvas and feeds it note events. Editing this file hot-swaps the engine.

import { useHarmonyStore } from '../../music/harmonyStore'
import { inKey, pc, type Key } from '../../music/theory'
import { DEFAULT_PARAMS, type SynthParams } from '../synth-history/params'
import { createGhosts } from './ghosts'
import { createSparkles } from './sparkle'
import { drawNebula } from './galaxy'
import type { Scene } from './scenes'
import { useJudge, type JudgeEvent, type NoteGrade } from '../../music/judge'
import { createConfetti } from './confetti'
import { createMail } from './mail'
import { createZombies } from './zombies'

export type Mode = 'fireworks' | 'ripples' | 'rise' | 'fire' | 'ghost' | 'mail' | 'confetti' | 'zombie'

// Background themes (request #7: "brighter and more fun"). Colours drift slowly, never flash.
export type Theme = 'rainbow' | 'candy' | 'ocean' | 'sunset' | 'night' | 'galaxy'
export const THEMES: { id: Theme; label: string }[] = [
  { id: 'rainbow', label: '🌈 Rainbow' },
  { id: 'candy', label: '🍬 Candy' },
  { id: 'ocean', label: '🌊 Ocean' },
  { id: 'sunset', label: '🌅 Sunset' },
  { id: 'night', label: '🌙 Night' },
  { id: 'galaxy', label: '🦄 Galaxy' },
]
// [top hue, bottom hue, saturation, top lightness, bottom lightness, drift speed]
const THEME_DEF: Record<Theme, [number, number, number, number, number, number]> = {
  rainbow: [280, 200, 88, 40, 46, 0.12],
  candy: [320, 270, 92, 50, 54, 0.02],
  ocean: [190, 230, 92, 38, 46, 0.02],
  sunset: [20, 320, 94, 48, 42, 0.02],
  night: [240, 250, 60, 17, 22, 0],
  galaxy: [320, 175, 92, 42, 38, 0.03],
}

export interface Engine {
  /** g = the judge's grade for this note. It decides the look (kind, score, rhythm, fizzle/boom). Without it the engine grades the note itself. */
  noteOn(note: number, velocity: number, g?: NoteGrade): void
  noteOff(note: number): void
  /** the judge's musical moments: cluster (fizzle/boom), resolve, cadence, motif, charged */
  react(ev: JudgeEvent): void
  /** true while a full-screen game owns the display: stop drawing and give back the CPU */
  setPaused(paused: boolean): void
  setMode(mode: Mode): void
  setEmoji(on: boolean): void
  setTheme(theme: Theme): void
  /** twinkling star + glitter layer (not in ghost mode, which has its own stars) */
  setSparkle(on: boolean): void
  /** the synth patch drives the look: wave=shape, cutoff=brightness, resonance=halo, attack/release=bloom/linger, detune=ghost, glide=streaks */
  setPatch(p: SynthParams): void
  destroy(): void
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
// Hue walks the circle of fifths, so notes that sound good together get related colours.
const hueFor = (note: number) => (((note % 12) * 7) % 12) * 30

// nt/st = which note spawned it and when (ms). A forearm slam is only known after its first notes already
// fired, so the 'cluster' event uses these tags to turn those early sparks gray (retro-fizzle).
// b = brightness multiplier (how well the note was played). fz = already fizzled.
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number; sat?: number; tw?: number; wob?: number; trail?: boolean; nb?: boolean; b?: number; nt?: number; st?: number; fz?: boolean; g?: number; gl?: boolean; sp?: number }
type Kind = 'tonic' | 'in' | 'spicy'
// rockets: normal (streak), form (rhythm in formation: straight and tall), boom (finale barrage), dud (fizzle: sputters, never bursts)
interface Rocket { x: number; y: number; vy: number; ty: number; hue: number; vx?: number; drag?: number; wob?: number; ph?: number; age?: number; sc?: number; form?: boolean; boom?: boolean; dud?: boolean; stage?: number; dudAt?: number; cough?: number; nt?: number; st?: number }
interface Ring { x: number; y: number; r: number; vr: number; life: number; max: number; hue: number; width: number; sat?: number; wob?: number; a?: number; nt?: number; st?: number }
interface Bar { note: number; x: number; top: number; bottom: number; hue: number; held: boolean; width: number; alpha: number; kind?: Kind; fz?: number; nt?: number; st?: number }
interface Label { text: string; x: number; y: number; life: number; hue: number; sz?: number; max?: number; sat?: number; lit?: number; stroke?: boolean; nt?: number }
interface Smoke { x: number; y: number; vx: number; vy: number; r: number; vr: number; life: number; max: number; a: number }
interface Block { x: number; y: number; vx: number; vy: number; rot: number; vr: number; s: number; life: number; max: number; tone: number }
interface Glow { x: number; y: number; life: number; max: number; r: number; hue: number; a: number }
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
const EMOJI_BOOM = ['⭐', '🌟', '✨', '💥', '🎆', '🎇', '🎉', '🪩', '💫']
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
interface Flame { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; pal: number; ph: number; lift: number; spark?: boolean; nt?: number; st?: number }
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

// Fizzle sprites, also stamped once: a soft gray smoke puff and a small dud rocket.
let smokeSpr: HTMLCanvasElement | null = null
function smokeSprite() {
  if (smokeSpr) return smokeSpr
  const c = document.createElement('canvas')
  c.width = c.height = 48
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(24, 24, 2, 24, 24, 24)
  gr.addColorStop(0, 'rgba(208,211,222,0.95)')
  gr.addColorStop(0.55, 'rgba(165,170,184,0.45)')
  gr.addColorStop(1, 'rgba(145,150,165,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 48, 48)
  smokeSpr = c
  return c
}
let dudSpr: HTMLCanvasElement | null = null
function dudSprite() {
  if (dudSpr) return dudSpr
  const c = document.createElement('canvas')
  c.width = 24
  c.height = 44
  const g = c.getContext('2d')!
  g.fillStyle = '#8a8f9c' // fins
  g.beginPath(); g.moveTo(5, 28); g.lineTo(1, 40); g.lineTo(8, 34); g.closePath(); g.fill()
  g.beginPath(); g.moveTo(19, 28); g.lineTo(23, 40); g.lineTo(16, 34); g.closePath(); g.fill()
  g.fillStyle = '#c4c8d2' // body
  g.beginPath(); g.roundRect(6, 12, 12, 26, 3); g.fill()
  g.fillStyle = '#a05a55' // nose, a sad faded red
  g.beginPath(); g.moveTo(6, 13); g.quadraticCurveTo(12, -4, 18, 13); g.closePath(); g.fill()
  g.fillStyle = '#6f7a8c' // window
  g.beginPath(); g.arc(12, 24, 3, 0, Math.PI * 2); g.fill()
  g.fillStyle = 'rgba(255,255,255,0.35)'
  g.fillRect(8, 15, 2, 20)
  dudSpr = c
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
  let paused = false // a full-screen game owns the display
  let dead = false
  let warned = false

  const particles: Particle[] = []
  const rings: Ring[] = []
  const bars: Bar[] = []
  const labels: Label[] = []
  const held = new Map<number, Held>()
  const motes: Particle[] = []
  const rockets: Rocket[] = []
  const emojis: Emoji[] = []
  // judge-driven effects
  const smokes: Smoke[] = []
  const blocks: Block[] = []
  const glows: Glow[] = []
  const fountains: { x: number; life: number; max: number }[] = []
  const timers: { at: number; fn: () => void }[] = []
  const noteY = new Map<number, number>() // where each note's burst happened (for resolve and motif)
  let lastPfft = 0
  let lastFizzSfx = 0
  let crackleN = 0
  let crackleJag: number[] = []
  let crackleIcons: { x: number; at: number }[] = [{ x: 0.2, at: 0 }, { x: 0.55, at: 9 }, { x: 0.85, at: 17 }]
  let tagNote = -1, tagT = 0 // fire mode: flames spawned right now belong to this note
  const laneGrad = new Map<string, CanvasGradient>()
  let emojiOn = false
  let sparkleOn = true
  let theme: Theme = 'rainbow'
  let drift = 0
  let tint = 0 // nudged by played notes
  let bgGrad: CanvasGradient | null = null
  let bgFrame = 0
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const calm = reduced ? 0.5 : 1
  const ghosts = createGhosts(reduced)
  const sparkles = createSparkles(reduced)
  // plug-in scenes (requests #17, #18): each one owns its own drawing; see scenes.ts
  const scenes: Partial<Record<Mode, Scene>> = { mail: createMail(reduced), confetti: createConfetti(reduced), zombie: createZombies(reduced) }
  const sceneList = Object.values(scenes) as Scene[]
  let lastSceneChord = 0
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
  let lfoTgt: 'none' | 'pitch' | 'filter' | 'amp' = 'none', lfoHz = 5, lfoDep = 0
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
    lfoTgt = p.lfoTarget ?? 'none'; lfoHz = p.lfoRate ?? 5; lfoDep = p.lfoDepth ?? 0
    glideAmt = p.glide > 0.02 ? Math.min(1, p.glide / 0.3) : 0
  }
  const pushP = (p: Particle, prio = false) => {
    if (particles.length >= MAX_PARTICLES * (prio ? 1.3 : 1) * quality) return
    if (linger !== 1) p.max = Math.round(p.max * linger)
    if (atkFrames > 1 && !p.nb) p.max += atkFrames
    particles.push(p)
  }
  function burst(x: number, y: number, hue: number, n: number, speed: number, extra: Partial<Particle> = {}, prio = false) {
    n = Math.round(n * calm * quality)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = (0.6 + Math.random()) * speed
      pushP({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 50 + Math.random() * 50, size: 1.5 + Math.random() * 2.5, hue: hue + (Math.random() - 0.5) * 30, ...extra }, prio)
    }
  }

  /** a lingering, faint coloured-gray haze where a shell went off (fireworks only, drawn with the smokes) */
  function haze(x: number, y: number, big = 1) {
    if (reduced || smokes.length >= 40 * quality) return
    smokes.push({ x, y, vx: (rnd() - 0.5) * 0.15, vy: -0.05, r: 40 * big, vr: 0.16, life: 0, max: 230 + rnd() * 60, a: 0.1 })
  }
  /** firework shell types: peony, chrysanthemum (trails), ring, willow (long golden droop), crossette (splits in four).
   *  Every type ends in glitter that twinkles as it falls. Reduced motion: plain peony only. */
  function shell(x: number, y: number, hue: number, n: number, speed: number, extra: Partial<Particle> = {}, fancy = true, prio = false) {
    const r = rnd()
    const type = reduced ? 0 : r < 0.3 ? 0 : r < 0.5 ? 1 : r < 0.68 ? 2 : r < 0.84 ? 3 : fancy ? 4 : 0
    if (type === 0) burst(x, y, hue, n, speed, { gl: true, ...extra }, prio)
    else if (type === 1) burst(x, y, hue, n * 0.9, speed, { trail: true, gl: true, ...extra }, prio)
    else if (type === 2) {
      const m = Math.round(Math.max(14, n * 0.7) * quality)
      const tilt = (rnd() - 0.5) * 1.2, sq = 0.45 + rnd() * 0.4
      for (let i = 0; i < m; i++) {
        const a = (i / m) * 6.2832
        const cx = Math.cos(a) * speed * 1.2, cy = Math.sin(a) * speed * 1.2 * sq
        pushP({ x, y, vx: cx * Math.cos(tilt) - cy * Math.sin(tilt), vy: cx * Math.sin(tilt) + cy * Math.cos(tilt), life: 0, max: 60 + rnd() * 14, size: 2.4, hue: hue + (i / m) * 40, gl: true, ...extra }, prio)
      }
      burst(x, y, hue + 150, n * 0.25, speed * 0.4, { size: 1.8, ...extra }, prio)
    } else if (type === 3) {
      burst(x, y, 42, n * 0.9, speed * 0.8, { trail: true, g: 0.02, gl: true, ...extra, size: 2.2 }, prio)
      burst(x, y, hue, n * 0.2, speed * 0.5, { ...extra }, prio)
    } else {
      const m = Math.max(5, Math.round(7 * quality))
      for (let i = 0; i < m; i++) {
        const a = (i / m) * 6.2832 + rnd() * 0.3, s = speed * (0.7 + rnd() * 0.3)
        pushP({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 80, size: 3, hue, trail: true, sp: 20 + Math.round(rnd() * 6), ...extra }, prio)
      }
    }
    haze(x, y, 0.6 + n / 90)
    if (!reduced) rings.push({ x, y, r: 3, vr: 2.2, life: 0, max: 22, hue, width: 2, a: 0.35 })
  }
  // a faint city skyline for scale, painted once per resize
  let skyline: HTMLCanvasElement | null = null
  function buildSkyline() {
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h * 0.16))
    const g = c.getContext('2d')!
    const H = c.height
    let seed = 7
    const sr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let layer = 0; layer < 2; layer++) {
      g.fillStyle = layer ? 'rgba(12,8,36,0.9)' : 'rgba(30,20,70,0.55)'
      const maxH = H * (layer ? 0.62 : 0.9)
      for (let x = layer ? 10 : -4; x < w; ) {
        const bw = 16 + sr() * 30, bh = maxH * (0.35 + sr() * 0.65)
        g.fillRect(x, H - bh, bw, bh)
        if (sr() < 0.25) g.fillRect(x + bw * 0.4, H - bh - 8 - sr() * 8, 2, 10) // antenna
        if (layer && sr() < 0.3) { g.beginPath(); g.moveTo(x, H - bh); g.lineTo(x + bw / 2, H - bh - 7); g.lineTo(x + bw, H - bh); g.fill() }
        if (layer) {
          g.fillStyle = 'rgba(255,214,120,0.7)'
          for (let wy = H - bh + 5; wy < H - 4; wy += 7) for (let wx = x + 4; wx < x + bw - 4; wx += 6) if (sr() < 0.22) g.fillRect(wx, wy, 2, 3)
          g.fillStyle = 'rgba(12,8,36,0.9)'
        }
        x += bw + sr() * 4
      }
    }
    skyline = c
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
    flames.push({ x, y, vx, vy, life: 0, max, size, pal, ph: rnd() * 6.28, lift, spark, nt: tagNote, st: tagT })
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

  // While the BOOM meter is full: a thin, steady electric crackle along the bottom edge. Small area, no blinking.
  function drawCrackle() {
    if (useJudge.getState().charge < 1) return
    const n = Math.max(8, Math.floor(w / 26))
    crackleN++
    if (crackleJag.length !== n + 1 || (!reduced && crackleN % 8 === 0)) {
      crackleJag = []
      for (let i = 0; i <= n; i++) crackleJag.push(rnd())
    }
    const t = performance.now() / 1000
    ctx.lineJoin = 'round'
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath()
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * w
        const amp = 0.5 + 0.5 * Math.sin(i * 0.5 - t * (reduced ? 0.6 : 2.4))
        const y = h - 3 - crackleJag[i] * (3 + amp * 12)
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
      ctx.strokeStyle = pass ? 'hsla(52,100%,90%,0.7)' : 'hsla(46,100%,58%,0.26)'
      ctx.lineWidth = pass ? 1.2 : 4.5
      ctx.stroke()
    }
    if (!reduced) {
      // a few small bolts that fade in and out smoothly, and the odd spark
      for (const ic of crackleIcons) {
        const u = ((crackleN + ic.at * 4) % 70) / 70
        if (u < 0.02) ic.x = 0.05 + rnd() * 0.9
        ctx.globalAlpha = Math.sin(u * Math.PI) * 0.8
        ctx.drawImage(sprite('⚡'), ic.x * w - 9, h - 30, 18, 18)
      }
      ctx.globalAlpha = 1
      if (rnd() < 0.12 * quality) pushP({ x: rnd() * w, y: h - 6, vx: (rnd() - 0.5) * 1.2, vy: -(1.5 + rnd() * 2), life: 0, max: 24, size: 1.6, hue: 50, nb: true, b: 0.8 })
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
    fireFloor = null
    skyline = null
    ghosts.resize(w, h)
    sparkles.resize(w, h)
    for (const sc of sceneList) sc.resize(w, h)
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

  // ================= judge-driven effects =================
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
  const later = (ms: number, fn: () => void) => { if (timers.length < 48) timers.push({ at: performance.now() + ms, fn }) }
  const avgX = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)

  /** a soft gray puff (stamped from one cached sprite, drawn source-over) */
  function puffAt(x: number, y: number, n = 1, size = 1, a = 0.38) {
    for (let i = 0; i < n; i++) {
      if (smokes.length >= 90 * quality) return
      smokes.push({ x: x + (rnd() - 0.5) * 14 * size, y: y + (rnd() - 0.5) * 8, vx: (rnd() - 0.5) * 0.9, vy: -(0.3 + rnd() * 0.8), r: (9 + rnd() * 7) * size, vr: 0.3 + rnd() * 0.3, life: 0, max: 45 + rnd() * 30, a })
    }
  }

  /** turn a particle gray and dull, and let it drop and fade */
  function fizzP(p: Particle) {
    p.fz = true
    p.sat = 10
    p.tw = undefined
    p.trail = false
    p.wob = undefined
    p.b = 0.4
    // half of them just vanish, so a pile of dull additive sparks doesn't add up to a bright blob
    p.max = rnd() < 0.5 ? p.life + 1 : Math.min(p.max, p.life + 22 + ((rnd() * 18) | 0))
    p.vx *= 0.35
    p.vy = Math.max(0, p.vy) * 0.5
  }

  /** a fizzled note: a rocket that sputters, wobbles, coughs gray smoke, droops and falls. Never bursts. */
  function dudRocket(x: number, note: number, now: number) {
    let n = 0
    for (const r of rockets) if (r.dud) n++
    if (n >= Math.max(3, Math.round(8 * quality))) return
    rockets.push({ x, y: h - 6, vy: -(5.5 + rnd() * 2.5), ty: 0, hue: 0, dud: true, stage: 0, ph: rnd() * 6.28, age: 0, dudAt: 15 + ((rnd() * 16) | 0), vx: 0, nt: note, st: now })
    if (now - lastPfft > 1500) {
      lastPfft = now
      labels.push({ text: 'pfft', x, y: h * 0.62, life: 0, hue: 220, sat: 10, lit: 82, sz: 19, max: 85 })
    }
  }
  function makeDud(r: Rocket) {
    r.dud = true
    r.form = false
    r.boom = false
    r.wob = undefined
    r.stage = 0
    r.ph = r.ph ?? rnd() * 6.28
    r.dudAt = (r.age ?? 0) + 5 + ((rnd() * 10) | 0)
    r.vx = 0
    r.vy = Math.max(r.vy, -6)
  }
  /** stamp a sprite centred at x,y, rotated by ang, wd x ht CSS px */
  function stampRot(img: HTMLCanvasElement, x: number, y: number, ang: number, wd: number, ht: number, a: number) {
    const c = Math.cos(ang) * dpr, sn = Math.sin(ang) * dpr
    ctx.globalAlpha = a
    ctx.setTransform(c, sn, -sn, c, x * dpr, y * dpr)
    ctx.drawImage(img, -wd / 2, -ht / 2, wd, ht)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  /** one frame of a dud rocket. Returns false when it is done. Call with source-over. */
  function stepDud(r: Rocket): boolean {
    const a = r.age ?? 0
    const ph = r.ph ?? 0
    const calmK = reduced ? 0.4 : 1
    let ang = 0
    let shake = 0
    if (r.stage === 0) {
      // sputtering up: the path wobbles more and more, sparks come and go
      r.vy *= 0.96
      r.x += Math.sin(a * 0.55 + ph) * (0.7 + a * 0.04) * calmK
      r.y += r.vy
      ang = Math.cos(a * 0.55 + ph) * 0.45 * calmK
      if (a % 2 === 0) puffAt(r.x, r.y + 9, 1, 0.55, 0.3)
      if (rnd() < 0.5) pushP({ x: r.x, y: r.y + 8, vx: (rnd() - 0.5) * 1.2, vy: 1 + rnd(), life: 0, max: 10, size: 1.6, hue: 28, nb: true, b: 0.7 })
      if (a >= (r.dudAt ?? 24) || r.vy > -1.1) { r.stage = 1; r.cough = 0; puffAt(r.x, r.y, 3, 0.9, 0.4) }
    } else if (r.stage === 1) {
      // cough
      r.cough = (r.cough ?? 0) + 1
      shake = Math.sin(r.cough * 1.7) * 2 * calmK
      ang = Math.sin(r.cough * 1.7) * 0.25 * calmK + r.cough * 0.03
      r.vy *= 0.9
      r.y += r.vy
      if (r.cough % 4 === 1) puffAt(r.x, r.y + 8, 1, 0.8, 0.42)
      if (r.cough > 14) { r.stage = 2; r.vx = (rnd() - 0.5) * 1.6 }
    } else {
      // droop and fall
      r.vy += 0.17
      r.vx = (r.vx ?? 0) * 0.99
      r.x += r.vx
      r.y += r.vy
      ang = Math.atan2(r.vy, r.vx ?? 0) + Math.PI / 2
      if (a % 5 === 0) puffAt(r.x, r.y - 6, 1, 0.5, 0.22)
      if (r.y > h - 14 || a > 170) { puffAt(r.x, Math.min(r.y, h - 14), 3, 1, 0.4); return false }
    }
    stampRot(dudSprite(), r.x + shake, r.y, ang, 15, 28, 1)
    ctx.globalAlpha = 1
    return true
  }

  /** a bar falls apart into gray blocks */
  function crumble(b: Bar) {
    const hgt = Math.max(10, b.bottom - b.top)
    const n = 8 + ((rnd() * 4) | 0)
    for (let i = 0; i < n && blocks.length < 140 * quality; i++) {
      blocks.push({ x: b.x + (rnd() - 0.5) * b.width, y: b.top + rnd() * hgt, vx: (rnd() - 0.5) * 3.2, vy: -2 - rnd() * 2.5, rot: rnd() * 6.28, vr: (rnd() - 0.5) * 0.4, s: 6 + rnd() * Math.max(5, b.width * 0.3), life: 0, max: 60 + rnd() * 25, tone: (rnd() * 3) | 0 })
    }
    puffAt(b.x, b.top + hgt / 2, 1, 0.7, 0.3)
  }

  /** the slam is known only now: undo what its first notes already spawned (tagged by note + time) */
  function retroFizzle(notes: number[]) {
    const now = performance.now()
    const cutoff = now - 260
    const set = new Set(notes)
    for (const n of notes) held.delete(n)
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      if (p.nt !== undefined && !p.fz && (p.st ?? 0) > cutoff && set.has(p.nt)) fizzP(p)
    }
    for (const r of rockets) if (!r.dud && r.nt !== undefined && (r.st ?? 0) > cutoff && set.has(r.nt)) makeDud(r)
    for (const r of rings) {
      if (r.nt === undefined || (r.st ?? 0) <= cutoff || !set.has(r.nt)) continue
      r.sat = 14
      r.hue = 30
      if (mode === 'ripples') r.vr = -Math.abs(r.vr) - 0.8 // a muddy ring that collapses
      else r.life = Math.max(r.life, r.max - 12)
    }
    for (const b of bars) {
      if (b.nt !== undefined && b.fz === undefined && (b.st ?? 0) > cutoff && set.has(b.nt)) { b.kind = 'spicy'; b.fz = 3 + ((rnd() * 6) | 0); b.held = false }
    }
    for (const f of flames) if (f.nt !== undefined && f.nt >= 0 && (f.st ?? 0) > cutoff && set.has(f.nt)) f.life = Math.max(f.life, f.max * 0.8)
    for (let i = labels.length - 1; i >= 0; i--) { const nt = labels[i].nt; if (nt !== undefined && set.has(nt)) labels.splice(i, 1) }
    if (mode === 'ghost') ghosts.spook()
    else if (mode === 'fire') for (const n of notes.slice(0, 3)) puffAt(xFor(n), h - 50, 2, 2, 0.55)
  }

  /** BOOM was charged and the kid slammed the keys: the best thing in the app */
  function boomFinale(notes: number[], xs: number[], cx: number) {
    const q = quality * calm
    const cy = h * 0.48
    const x0 = Math.min(...xs), x1 = Math.max(...xs)
    const span = Math.max(w * 0.36, x1 - x0 + 140)
    // 1. the hit: a gold shockwave, five rainbow rings, and ONE local glow (never the whole canvas)
    // (reduced motion: one slow, gentle ring and no emoji or barrage)
    rings.push({ x: cx, y: cy, r: 8, vr: reduced ? 4.6 : 11, life: 0, max: reduced ? 36 : 46, hue: 46, width: 13, a: 0.8 })
    if (!reduced) for (let k = 0; k < 3; k++) rings.push({ x: cx, y: cy, r: 4 - k * 16, vr: 9, life: 0, max: 48, hue: 300 - k * 100, width: 5 - k, a: 0.6 })
    glows.push({ x: cx, y: cy, life: 0, max: 20, r: 150, hue: 46, a: reduced ? 0.22 : 0.32 })
    // 2. core: gold sphere, rainbow sphere, glitter that hangs and twinkles
    burst(cx, cy, 46, 150, 8.5, { tw: rnd() * 6.28, trail: true, size: 3.4 }, true)
    const nr = Math.round(140 * q)
    for (let i = 0; i < nr; i++) {
      const a = (i / nr) * 6.2832 + rnd() * 0.05
      const sp = 3.5 + rnd() * 3.5
      pushP({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 80 + rnd() * 40, size: 2.6 + rnd() * 1.8, hue: (i / nr) * 360, tw: rnd() * 6.28 }, true)
    }
    if (!reduced) spawnEmoji(cx, cy, EMOJI_BOOM, 16, 1.3)
    const ng = Math.round(90 * q)
    for (let i = 0; i < ng; i++) {
      const a = rnd() * 6.2832
      const sp = 1 + rnd() * 6
      pushP({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: 0, max: 120 + rnd() * 60, size: 1.1 + rnd() * 1.3, hue: 44 + rnd() * 14, tw: rnd() * 6.28 }, true)
    }
    labels.push({ text: 'BOOM!', x: cx, y: cy - 6, life: 0, hue: 46, lit: 64, sz: 60, max: 95, stroke: true })
    if (reduced) return
    // 3. barrage: a rocket from every slammed lane, one after another
    // at most 3 rockets, 380 ms apart: keeps the BOOM under 3 bursts a second (photosensitivity rule)
    const lanes = [notes[0], notes[Math.floor(notes.length / 2)], notes[notes.length - 1]].filter((n, i, a) => n != null && a.indexOf(n) === i)
    lanes.forEach((n, i) => later(140 + i * 380, () => {
      const x = xFor(n), ty = h * (0.26 + rnd() * 0.2)
      rockets.push({ x, y: h, vy: -((h - ty) / 24.5), ty, hue: hueFor(n), boom: true, drag: 0.99, age: 0, sc: 1 })
    }))
    // 4. a golden crown ring, then secondary bursts, never closer than 0.35 s apart
    later(260, () => {
      const m = Math.round(44 * q)
      for (let i = 0; i < m; i++) {
        const a = (i / m) * 6.2832
        pushP({ x: cx, y: cy, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, life: 0, max: 80, size: 3, hue: 46, tw: i, trail: true }, true)
      }
    })
    ;[0.5, 0.85, 1.2, 1.55].forEach((sec, i) => later(sec * 1000, () => {
      const x = Math.max(40, Math.min(w - 40, cx + (i % 2 ? 1 : -1) * span * (0.3 + 0.25 * (i >> 1)) + (rnd() - 0.5) * 50))
      const y = h * (0.2 + rnd() * 0.22)
      const hu = 30 + i * 85
      burst(x, y, hu, 70, 5.6, { tw: rnd() * 6, trail: true, size: 3 }, true)
      burst(x, y, hu + 50, 34, 3.2, { tw: 2 }, true)
      rings.push({ x, y, r: 4, vr: 6, life: 0, max: 46, hue: hu, width: 5 })
    }))
    // 5. golden willow rain
    later(1000, () => {
      const m = Math.round(80 * q)
      for (let i = 0; i < m; i++) pushP({ x: cx - span / 2 + rnd() * span, y: h * (0.12 + rnd() * 0.06), vx: (rnd() - 0.5) * 1.2, vy: -0.4 + rnd() * 0.6, life: 0, max: 130 + rnd() * 50, size: 1.8 + rnd() * 1.6, hue: 40 + rnd() * 16, tw: rnd() * 6.28, trail: true }, true)
    })
  }

  /** the shape of a flower: eight petals of gold */
  function releaseBloom(note: number) {
    const x = xFor(note)
    const y = noteY.get(note) ?? h * 0.5
    const q = quality * calm
    // two layers of petals (8 big gold ones, 8 smaller pink-gold ones between them), filled in
    const n = Math.max(30, Math.round(110 * q))
    for (let i = 0; i < n; i++) {
      const inner = i % 3 === 0
      const a = rnd() * 6.2832
      const lobe = Math.pow(Math.abs(Math.cos(4 * (inner ? a + 0.3927 : a))), 0.8)
      const sp = (inner ? 3.0 : 5.4) * (0.1 + 0.9 * lobe) * (0.45 + 0.55 * rnd())
      pushP({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 60 + rnd() * 16, size: 2.2 + rnd() * 1.4, hue: inner ? 335 + rnd() * 25 : 40 + rnd() * 18, tw: i * 0.3 })
    }
    burst(x, y, 50, 8, 1.0, { size: 3.4, max: 50 })
    rings.push({ x, y, r: 4, vr: 3, life: 0, max: 46, hue: 46, width: 4 })
    labels.push({ text: 'release ✨', x, y: y - 34, life: 0, hue: 46, lit: 80, sz: 17, max: 85, stroke: true })
  }

  function cadenceFx(note: number) {
    const x = xFor(note)
    fountains.push({ x, life: 0, max: reduced ? 36 : 62 })
    rings.push({ x, y: h - 24, r: 6, vr: 6, life: 0, max: 62, hue: 46, width: 6 })
    rings.push({ x, y: h - 24, r: -8, vr: 6, life: 0, max: 70, hue: 290, width: 3 })
    labels.push({ text: '🏁 cadence', x, y: h * 0.5, life: 0, hue: 46, lit: 82, sz: 20, max: 100, stroke: true })
  }

  /** faint copies of the pattern's bursts, up above, one after another */
  function motifEcho(notes: number[]) {
    const ys: number[] = []
    const xs: number[] = []
    notes.forEach((n, i) => {
      const x = xFor(n)
      const y = Math.max(h * 0.3, (noteY.get(n) ?? h * 0.5) - h * 0.2)
      xs.push(x)
      ys.push(y)
      later(i * 140, () => {
        burst(x, y, hueFor(n), 24, 2.3, { b: 0.38 })
        rings.push({ x, y, r: 3, vr: 2.3, life: 0, max: 40, hue: hueFor(n), width: 2, a: 0.4 })
      })
    })
    labels.push({ text: '🔁 motif', x: avgX(xs), y: Math.max(h * 0.28, Math.min(...ys) - 26), life: 0, hue: 190, lit: 84, sz: 17, max: 100, stroke: true })
  }

  function rainbowWave(cx: number, cy: number, n: number) {
    for (let k = 0; k < n; k++) rings.push({ x: cx, y: cy, r: 6 - k * 18, vr: 8.5 + k * 0.2, life: 0, max: 75, hue: k * (360 / n), width: 7 - k * 0.4, a: 0.6 })
    rings.push({ x: cx, y: cy, r: 8, vr: 11, life: 0, max: 60, hue: 46, width: 8, a: 0.8 })
  }

  /** modest versions of the moments for ripples / rise / fire / ghost */
  function genericMark(x: number, y: number, text: string, hue: number) {
    rings.push({ x, y, r: 4, vr: 3.4, life: 0, max: 52, hue, width: 4 })
    rings.push({ x, y, r: -10, vr: 3.4, life: 0, max: 60, hue: hue + 30, width: 2 })
    labels.push({ text, x, y: y - 30, life: 0, hue, lit: 82, sz: 16, max: 85, stroke: true })
  }

  function boomFx(notes: number[]) {
    const xs = notes.map(xFor)
    const cx = avgX(xs)
    const now = performance.now()
    if (mode === 'fireworks') boomFinale(notes, xs, cx)
    else {
      labels.push({ text: 'BOOM!', x: cx, y: h * 0.4, life: 0, hue: 46, lit: 64, sz: 50, max: 90, stroke: true })
      if (mode === 'ripples') { rainbowWave(cx, h * 0.5, 7); burst(cx, h * 0.5, 46, 60, 6, { tw: 1 }, true) }
      else if (mode === 'rise') { rainbowWave(cx, h, 7); burst(cx, h - 40, 46, 70, 7, { tw: 1 }, true) }
      else if (mode === 'fire') {
        ignite = 1
        lastIgnite = now
        for (let k = 0; k < 3; k++) fireball(cx + (k - 1) * w * 0.18, h - 90 - k * 12, () => (rnd() < 0.3 ? 3 : 0))
        if (flashes.length < 6) flashes.push({ x: cx, life: 0 })
      } else if (mode === 'ghost') {
        ghosts.cheer(cx)
        rings.push({ x: cx, y: h * 0.45, r: 8, vr: 9, life: 0, max: 60, hue: 46, width: 6 })
      }
    }
  }

  function noteOn(note: number, velocity: number, g?: NoteGrade) {
    if (paused) return
    const v = Math.max(1, Math.min(127, velocity)) / 127
    const hue = hueFor(note)
    const x = xFor(note)
    lastNoteAt = performance.now()

    // the judge's grade is the truth (so the visuals agree with the games); without one, grade it here
    const kind: Kind = g?.kind ?? kindOf(note)
    if (g?.cluster) return clusterNote(note, x, v, hue, kind, g)
    // (slam notes never shift the background colour: a forearm must not swing the whole screen)
    if (theme === 'rainbow') tint += (((hue - (THEME_DEF.rainbow[0] + drift + tint)) %360 + 540) % 360 - 180) * 0.04
    if (kind === 'spicy') streak = Math.floor(streak / 3)
    else streak++
    const boost = 1 + Math.min(1.2, streak * 0.04)
    const spicyHue = 270 + (Math.random() - 0.5) * 30
    // how well it was played, 0..1. Scales burst size and brightness so weak notes are visibly weaker.
    const qs = g ? clamp01((g.score - 0.3) / 0.7) : 0.85
    const sz = 0.55 + 0.6 * qs
    const bright = 0.55 + 0.45 * qs
    const rh = g?.rhythm ?? null
    const tag = { nt: note, st: lastNoteAt }

    if (mode === 'fireworks') {
      const y = h - 40 - v * h * 0.55
      held.set(note, { x, y, hue, velocity: v, kind })
      noteY.set(note, y)
      if (kind === 'spicy') {
        burst(x, y, spicyHue, (10 + v * 16) * (0.7 + 0.3 * sz), 1 + v * 2, { sat: 12, wob: 1, size: 2 + Math.random() * 3, b: bright, ...tag })
      } else {
        const sc = kind === 'tonic' ? 1.3 : 1
        if (qs > 0.45 && v > 0.35) shell(x, y, hue, (14 + v * 46) * boost * sc * sz, (1.5 + v * 4.5) * sc * (0.8 + 0.2 * sz), { tw: Math.random() * 6.28, b: bright, ...tag }, false)
        else burst(x, y, hue, (14 + v * 46) * boost * sc * sz, (1.5 + v * 4.5) * sc * (0.8 + 0.2 * sz), { tw: Math.random() * 6.28, trail: streak > 5 && qs > 0.5, b: bright, ...tag })
        if (kind === 'tonic') {
          const nt = Math.round(36 * calm)
          for (let i = 0; i < nt; i++) {
            const a = (i / nt) * Math.PI * 2
            pushP({ x, y, vx: Math.cos(a) * 5.5, vy: Math.sin(a) * 5.5, life: 0, max: 80, size: 2.6, hue: 45, tw: i, trail: true, b: bright, ...tag })
          }
          rings.push({ x, y, r: 4, vr: 4, life: 0, max: 70, hue: 45, width: 5, a: bright, ...tag })
        }
        if (!reduced) {
          // rhythm: on the beat = a straight, tall rocket "in formation" (they all burst on one row). Off the beat = a wobbly short one.
          if (rh !== null && rh >= 0.8 && qs > 0.45 && rockets.length < 9) {
            const ty = h * (0.27 + (1 - qs) * 0.08)
            rockets.push({ x, y: h, vy: -((h - ty) / 24.5), ty, hue, form: true, drag: 0.99, age: 0, sc: 0.6 + 0.5 * qs, ...tag })
          } else if (rh !== null && rh < 0.35 && rockets.length < 9 && Math.random() < 0.7) {
            rockets.push({ x, y: h, vy: -(5 + Math.random() * 2), ty: h * (0.5 + Math.random() * 0.2), hue, wob: 1.8 + (0.35 - rh) * 3, ph: Math.random() * 6.28, age: 0, sc: 0.4, ...tag })
          }
          let ns = 0
          for (const r of rockets) if (!r.form && !r.dud && !r.boom) ns++
          if (streak >= 8 && ns < 3 && Math.random() < Math.min(0.7, 0.15 + streak * 0.03)) {
            rockets.push({ x: w * (0.15 + Math.random() * 0.7), y: h, vy: -(7 + Math.random() * 3), ty: h * (0.15 + Math.random() * 0.3), hue: Math.random() * 360, wob: rh === null ? 0.5 : (1 - rh) * 2, ph: Math.random() * 6.28, age: 0, ...tag })
          }
        }
      }
    } else if (mode === 'ripples') {
      const y = h * 0.5 + (Math.random() - 0.5) * h * 0.4
      held.set(note, { x, y, hue, velocity: v, kind })
      const sp = kind === 'spicy'
      const nr = kind === 'tonic' ? 5 : sp ? 2 : 3 + (streak > 6 ? 1 : 0)
      for (let k = 0; k < nr; k++) {
        rings.push({ x, y, r: 4 + k * -14, vr: (1.2 + v * 2.5) * (sp ? 0.7 : 1), life: 0, max: (110 + v * 60) * (sp ? 0.7 : 1), hue: sp ? spicyHue : kind === 'tonic' ? 45 : hue, width: 1.5 + v * 4 - k, sat: sp ? 12 : undefined, wob: sp && !reduced ? 1 : undefined, ...tag })
      }
    } else if (mode === 'fire') {
      held.set(note, { x, y: h, hue, velocity: v, kind })
      const ton = kind === 'tonic'
      const hsc = fireScale()
      const n = Math.round((8 + v * 14) * (ton ? 1.6 : 1) * calm * quality)
      tagNote = note
      tagT = lastNoteAt
      for (let i = 0; i < n; i++) {
        addFlame(x + (rnd() - 0.5) * 22, h - 6, (rnd() - 0.5) * 1.6, -(4 + v * 6) * hsc * (ton ? 1.5 : 1) * (0.6 + rnd() * 0.6), 30 + rnd() * 20, (12 + v * 14) * Math.min(1.3, hsc), palFor(kind))
      }
      tagNote = -1
      if (ton && flashes.length < 6) flashes.push({ x, life: 0 })
      const t = performance.now()
      if (kind !== 'spicy' && streak >= 12 && streak % 12 === 0 && t - lastIgnite > 3000) { ignite = 1; lastIgnite = t }
      if (held.size >= 3 && t - lastBall > 700) {
        lastBall = t
        const xs = [...held.values()]
        fireball(xs.reduce((a, q) => a + q.x, 0) / xs.length, h - 90, () => (xs.some((q) => q.kind === 'spicy') ? 1 + (rnd() < 0.5 ? 1 : 0) : rnd() < 0.3 ? 3 : 0))
      }
    } else if (mode === 'ghost') {
      held.set(note, { x, y: h, hue, velocity: v, kind })
      ghosts.noteOn(note, x, v, kind)
    } else if (scenes[mode]) {
      const sc = scenes[mode]!
      held.set(note, { x, y: h - 60, hue, velocity: v, kind })
      sc.noteOn(note, x, v, kind, hue, NAMES[note % 12], g)
      const t = performance.now()
      const hv = [...held.values()]
      if (hv.length >= 3 && t - lastSceneChord > 600 && hv.every((q) => q.kind !== 'spicy')) { lastSceneChord = t; sc.chord?.(hv.map((q) => q.x)) }
    } else {
      held.set(note, { x, y: h, hue, velocity: v, kind })
      bars.push({ note, x, top: h, bottom: h, hue: kind === 'spicy' ? spicyHue : kind === 'tonic' ? 45 : hue, kind, held: true, width: Math.max(8, (w / Math.max(12, hi - lo + 1)) * 0.7), alpha: 0.5 + v * 0.5, ...tag })
    }
    if (mode !== 'mail' && mode !== 'zombie') labels.push({ text: NAMES[note % 12] + (Math.floor(note / 12) - 1) + (kind === 'tonic' ? ' ★' : ''), x, y: (held.get(note)?.y ?? h) - 18, life: 0, hue: kind === 'spicy' ? 270 : hue, nt: note })
    if (labels.length > 24) labels.shift()
    if (sparkleOn && mode !== 'ghost' && !scenes[mode]?.ownBackdrop) sparkles.burst(x, held.get(note)?.y ?? h - 40, v)
    emojiFor(note, v, kind)
    patchFx(note, kind, hue, v)
  }

  /** a note that is part of a forearm slam. Fizzle = a sad dud, boom = the finale comes with the 'cluster' event. */
  function clusterNote(note: number, x: number, v: number, hue: number, kind: Kind, g: NoteGrade) {
    const now = performance.now()
    const fizz = g.cluster === 'fizzle'
    if (fizz) streak = Math.floor(streak / 2)
    const bw = Math.max(8, (w / Math.max(12, hi - lo + 1)) * 0.7)
    if (mode === 'fireworks') {
      if (fizz) dudRocket(x, note, now)
      else burst(x, h - 50, 46, 8, 2.2, { tw: 1, size: 2 }, true) // a gold pop in the lane
    } else if (mode === 'ripples') {
      if (fizz && rings.length < 70 * quality && now - lastFizzSfx > 40) {
        lastFizzSfx = now
        rings.push({ x, y: h * 0.5 + (rnd() - 0.5) * h * 0.3, r: 70 + rnd() * 30, vr: -(1.8 + rnd()), life: 0, max: 46, hue: 28, width: 5, sat: 18, nt: note, st: now })
      }
    } else if (mode === 'rise') {
      if (fizz) {
        if (bars.length < 60) bars.push({ note, x, top: h - 8, bottom: h, hue: 40, kind: 'spicy', held: false, width: bw, alpha: 0.75, fz: 16 + ((rnd() * 8) | 0) })
      } else {
        held.set(note, { x, y: h, hue, velocity: v, kind })
        bars.push({ note, x, top: h, bottom: h, hue: (note * 31) % 360, held: true, width: bw, alpha: 1 })
      }
    } else if (mode === 'fire') {
      if (fizz && smokes.length < 50 * quality) puffAt(x, h - 40, 2, 2, 0.55) // a smoke puff instead of a flame
    } else if (mode === 'ghost') {
      if (fizz && now - lastFizzSfx > 120) { lastFizzSfx = now; ghosts.spook() }
    } else if (scenes[mode]) {
      scenes[mode]!.noteOn(note, x, v, g.kind, hue, NAMES[note % 12], g)
    }
  }

  function react(ev: JudgeEvent) {
    if (paused || dead || ev.type === 'note' || ev.type === 'off') return
    try {
      const sc = scenes[mode]
      switch (ev.type) {
        case 'cluster': {
          const notes = ev.notes
          if (ev.boom) { for (const n of notes) held.delete(n); boomFx(notes) } else retroFizzle(notes)
          sc?.react?.({ type: ev.boom ? 'boom' : 'fizzle', notes, xs: notes.map(xFor) })
          break
        }
        case 'resolve': {
          const x = xFor(ev.to)
          if (mode === 'fireworks') releaseBloom(ev.to)
          else if (!sc) genericMark(x, mode === 'ripples' ? h * 0.5 : h * 0.55, 'release ✨', 46)
          sc?.react?.({ type: 'resolve', note: ev.to, x })
          break
        }
        case 'cadence': {
          const x = xFor(ev.note)
          if (mode === 'fireworks') cadenceFx(ev.note)
          else if (!sc) {
            genericMark(x, h * 0.55, '🏁 cadence', 46)
            if (mode === 'fire') ignite = Math.max(ignite, 0.6)
          }
          sc?.react?.({ type: 'cadence', note: ev.note, x, length: ev.length })
          break
        }
        case 'motif': {
          if (mode === 'fireworks') motifEcho(ev.notes)
          else if (!sc) genericMark(avgX(ev.notes.map(xFor)), h * 0.4, '🔁 motif', 190)
          sc?.react?.({ type: 'motif', xs: ev.notes.map(xFor) })
          break
        }
        case 'charged': {
          labels.push({ text: '⚡ BOOM ready!', x: w / 2, y: h - 80, life: 0, hue: 50, lit: 80, sz: 22, max: 110, stroke: true })
          const n = Math.round(26 * calm * quality)
          for (let i = 0; i < n; i++) pushP({ x: rnd() * w, y: h - 8, vx: (rnd() - 0.5) * 1.4, vy: -(2 + rnd() * 3), life: 0, max: 40 + rnd() * 25, size: 1.5 + rnd() * 1.5, hue: 48 + rnd() * 10, tw: rnd() * 6 })
          sc?.react?.({ type: 'charged' })
          break
        }
      }
    } catch (e) {
      if (!warned) { warned = true; console.error('[viz] react failed', e) }
    }
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
    ghosts.noteOff(note)
    for (const sc of sceneList) sc.noteOff(note)
    if (was && mode === 'fire') {
      // release: a few embers drift up and a puff of smoke
      for (let i = 0; i < Math.round(5 * calm * quality); i++) spark(was.x + (rnd() - 0.5) * 20, h - 30, palFor(was.kind), true)
      addFlame(was.x, h - 30, 0, -1.5, 40, 16, 0)
      if (flames.length) flames[flames.length - 1].life = 22
    }
    for (const b of bars) if (b.note === note && b.held) b.held = false
  }

  // One frame. frame() below wraps it so a bug in a new effect can never freeze the visualizer.
  function paint() {
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
        const a = mode === 'rise' ? 0.38 : scenes[mode] ? 0.6 : 0.2
        const off = drift + tint
        bgGrad = ctx.createLinearGradient(0, 0, w * 0.3, h)
        bgGrad.addColorStop(0, `hsla(${h1 + off},${sat}%,${l1}%,${a})`)
        bgGrad.addColorStop(0.55, `hsla(${(h1 + h2) / 2 + off + 20},${sat}%,${(l1 + l2) / 2}%,${a})`)
        bgGrad.addColorStop(1, `hsla(${h2 + off},${sat}%,${l2}%,${a})`)
      }
      if (mode === 'ghost') ghosts.drawBackdrop(ctx, now)
      else if (scenes[mode]?.ownBackdrop) scenes[mode]!.drawBackdrop?.(ctx, now)
      else {
        ctx.fillStyle = bgGrad
        ctx.fillRect(0, 0, w, h)
        if (theme === 'galaxy') drawNebula(ctx, now, w, h, reduced)
      }
      // fire mode: darken (translucent, even, never a flash) so the flames pop; theme tint still shows through
      if (mode === 'fire') {
        ctx.fillStyle = 'rgba(10,3,4,0.26)'
        ctx.fillRect(0, 0, w, h)
      }
    }
    if (mode === 'fireworks') {
      if (!skyline) buildSkyline()
      ctx.drawImage(skyline!, 0, h - skyline!.height, w, skyline!.height)
    }
    ctx.globalCompositeOperation = 'lighter'

    // delayed stages (BOOM barrage, motif echo) and fountains
    if (timers.length) {
      const tn = performance.now()
      for (let i = timers.length - 1; i >= 0; i--) {
        if (timers[i].at > tn) continue
        const fn = timers[i].fn
        timers[i] = timers[timers.length - 1]
        timers.pop()
        try { fn() } catch (e) { if (!warned) { warned = true; console.error('[viz] timer failed', e) } }
      }
    }
    for (let i = fountains.length - 1; i >= 0; i--) {
      const f = fountains[i]
      if (++f.life > f.max) { fountains[i] = fountains[fountains.length - 1]; fountains.pop(); continue }
      const n = Math.round(5 * quality * calm)
      for (let k = 0; k < n; k++) {
        pushP({ x: f.x + (rnd() - 0.5) * 10, y: h - 12, vx: (rnd() - 0.5) * 2.2, vy: -(8 + rnd() * 5), life: 0, max: 60 + rnd() * 30, size: 1.8 + rnd() * 2, hue: rnd() < 0.6 ? 42 + rnd() * 14 : rnd() * 360, tw: rnd() * 6.28 })
      }
    }

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
    if (mode === 'ghost' || scenes[mode]?.ownBackdrop) sparkles.draw(ctx, now, quality, false, 0.55)
    else if (sparkleOn) sparkles.draw(ctx, now, quality, true, 1)

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

    // rockets: streak rockets, rhythm "formation" rockets, the BOOM barrage, and fizzled duds
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]
      r.age = (r.age ?? 0) + 1
      if (r.dud) {
        ctx.globalCompositeOperation = 'source-over'
        const alive = stepDud(r)
        ctx.globalCompositeOperation = 'lighter'
        if (!alive) { rockets[i] = rockets[rockets.length - 1]; rockets.pop() }
        continue
      }
      const steps = Math.max(1, Math.min(5, Math.ceil(-r.vy / 6)))
      for (let k = 0; k < steps; k++) {
        r.y += r.vy / steps
        if (r.wob) r.x += (Math.sin(r.age * 0.33 + (r.ph ?? 0)) * r.wob) / steps
        pushP({ x: r.x, y: r.y + k * 2, vx: (Math.random() - 0.5) * 0.4, vy: 0.5, life: 0, max: steps > 1 ? 16 : 25, size: 2, hue: r.hue, tw: 1, nb: true })
        if (!reduced && quality > 0.5 && Math.random() < 0.55) pushP({ x: r.x, y: r.y + k * 2, vx: (Math.random() - 0.5) * 1.4, vy: 0.2 + Math.random() * 0.8, life: 0, max: 28 + Math.random() * 18, size: 1, hue: 44 + Math.random() * 10, tw: Math.random() * 6.28, nb: true, gl: true })
      }
      r.vy *= r.drag ?? 0.985
      ctx.fillStyle = `hsl(${r.hue},100%,85%)`
      ctx.beginPath()
      ctx.arc(r.x, r.y, 3, 0, Math.PI * 2)
      ctx.fill()
      if (r.y <= r.ty || r.vy > -1.5) {
        const sc = r.sc ?? 1
        if (r.boom) {
          shell(r.x, r.y, r.hue, 62, 5.2, { tw: Math.random() * 6 }, true, true)
          burst(r.x, r.y, 46, 28, 3.4, { tw: 2 }, true)
          rings.push({ x: r.x, y: r.y, r: 4, vr: 5, life: 0, max: 40, hue: 46, width: 4 })
        } else if (r.form) {
          shell(r.x, r.y, r.hue, 54 * sc, 4.6, { tw: Math.random() * 6 })
          burst(r.x, r.y, r.hue + 50, 20 * sc, 2.8, { tw: 2 })
          rings.push({ x: r.x, y: r.y, r: 4, vr: 3.4, life: 0, max: 42, hue: r.hue, width: 3, a: 0.5 + 0.5 * sc })
        } else {
          shell(r.x, r.y, r.hue, 70 * sc, 5 * (0.7 + 0.3 * sc), { tw: Math.random() * 6 })
          burst(r.x, r.y, r.hue + 60, 30 * sc, 3, { tw: 2 })
        }
        rockets[i] = rockets[rockets.length - 1]
        rockets.pop()
      }
    }

    // held notes: soft glow + constellation lines between everything being held (chords!)
    const hs = mode === 'fire' || mode === 'ghost' || scenes[mode] ? [] : [...held.values()]
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

    // LFO look (visual time only): smooth sine, brightness pulse capped at 3 Hz, off for reduced motion
    const lfoOn = lfoTgt !== 'none' && lfoDep > 0 && !reduced
    const lfoSec = performance.now() / 1000
    const lfoSin = lfoOn ? Math.sin(lfoSec * Math.PI * 2 * (lfoTgt === 'filter' ? Math.min(3, lfoHz) : lfoHz)) : 0
    const lfoPh = lfoSec * Math.PI * 2 * lfoHz
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life++
      p.vx *= 0.985
      p.vy = p.vy * 0.985 + 0.035
      p.x += p.vx
      p.y += p.vy
      if (p.fz) p.vy += 0.07
      if (p.g) p.vy += p.g
      if (p.sp && p.life === p.sp) {
        // crossette: the spark splits into four small ones in an X
        for (let k = 0; k < 4; k++) {
          const a = Math.PI / 4 + k * (Math.PI / 2), s = 2.2
          pushP({ x: p.x, y: p.y, vx: Math.cos(a) * s + p.vx * 0.3, vy: Math.sin(a) * s + p.vy * 0.3, life: 0, max: 46, size: p.size * 0.8, hue: p.hue + 20, tw: p.tw, gl: true, trail: true }, true)
        }
        particles[i] = particles[particles.length - 1]; particles.pop(); continue
      }
      const t = 1 - p.life / p.max
      if (t <= 0) { particles[i] = particles[particles.length - 1]; particles.pop(); continue }
      if (p.wob) p.x += Math.sin(p.life * 0.5 + i) * 0.6
      const tw = p.tw !== undefined ? 0.55 + 0.45 * Math.sin(p.life * 0.35 + p.tw) : 1
      if (p.trail && quality > 0.7 && p.life % 3 === 0 && particles.length < MAX_PARTICLES * 0.8 * quality) pushP({ x: p.x, y: p.y, vx: 0, vy: 0.2, life: 0, max: 18, size: p.size * 0.6, hue: p.hue + 20, tw: p.tw, nb: true })
      const dull = p.sat !== undefined
      const grow = atkFrames > 1 && !p.nb && p.life < atkFrames ? p.life / atkFrames : 1
      const r = (lfoTgt === 'amp' && lfoOn ? 1 + 0.3 * lfoDep * lfoSin : 1) * 2.2 * p.size * sizeMul * (dull ? 0.8 + (1 - t) * 1.2 : 0.4 + t * 0.6) * (0.35 + 0.65 * grow)
      const al = Math.min(1, (dull ? t * 0.8 : t * tw) * alphaMul * grow * (lfoTgt === 'filter' && lfoOn ? 1 + 0.3 * lfoDep * lfoSin : 1)) * (p.b ?? 1)
      const shim = lfoTgt === 'pitch' && lfoOn ? Math.sin(lfoPh + p.y * 0.02) * 4 * lfoDep : 0
      ctx.globalAlpha = p.gl && t < 0.5 ? al * (((p.life * 5 + (p.tw ?? 0) * 17) | 0) % 5 < 2 ? 1 : 0.3) : al
      const spr = pdot(shape, level, p.hue, dull)
      ctx.drawImage(spr, p.x - r + shim, p.y - r, r * 2, r * 2)
      if (ghost > 0 && quality > 0.6 && !p.nb) {
        const off = (2 + ghost * 7) * ghostDir
        ctx.globalAlpha = al * 0.45
        ctx.drawImage(spr, p.x - r + off, p.y - r - off * 0.4, r * 2, r * 2)
      }
    }
    ctx.globalAlpha = 1
    drawFire(now)
    if (mode === 'ghost') {
      ghosts.draw(ctx, now, quality)
      ctx.globalCompositeOperation = 'lighter'
    }
    const scene = scenes[mode]
    if (scene) {
      ctx.globalCompositeOperation = 'source-over'
      scene.draw(ctx, now, quality)
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 1
    }

    // local glows (BOOM): small and soft, never the whole canvas
    for (let i = glows.length - 1; i >= 0; i--) {
      const gl = glows[i]
      const u = ++gl.life / gl.max
      if (u >= 1) { glows[i] = glows[glows.length - 1]; glows.pop(); continue }
      const r = gl.r * (0.55 + 0.45 * u)
      ctx.globalAlpha = gl.a * (1 - u) * (1 - u)
      ctx.drawImage(dot(gl.hue, false), gl.x - r, gl.y - r, r * 2, r * 2)
    }
    ctx.globalAlpha = 1
    if (smokes.length || blocks.length) {
      ctx.globalCompositeOperation = 'source-over'
      if (smokes.length) {
        const spr = smokeSprite()
        for (let i = smokes.length - 1; i >= 0; i--) {
          const m = smokes[i]
          m.life++
          const u = m.life / m.max
          if (u >= 1) { smokes[i] = smokes[smokes.length - 1]; smokes.pop(); continue }
          m.x += m.vx
          m.y += m.vy
          m.vy *= 0.985
          m.r += m.vr
          ctx.globalAlpha = m.a * Math.min(1, u * 8) * (1 - u)
          ctx.drawImage(spr, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2)
        }
      }
      // crumbled bar chunks: small gray squares that tumble and fall
      const TONES = ['#8b909d', '#a2a7b3', '#737886']
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i]
        b.life++
        const u = b.life / b.max
        if (u >= 1 || b.y > h + 20) { blocks[i] = blocks[blocks.length - 1]; blocks.pop(); continue }
        b.vy += 0.34
        b.x += b.vx
        b.y += b.vy
        b.rot += b.vr
        const c = Math.cos(b.rot) * dpr, sn = Math.sin(b.rot) * dpr
        ctx.globalAlpha = Math.min(1, (1 - u) * 1.6)
        ctx.setTransform(c, sn, -sn, c, b.x * dpr, b.y * dpr)
        ctx.fillStyle = TONES[b.tone]
        ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'lighter'
    }
    drawCrackle()

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
      ctx.strokeStyle = `hsla(${r.hue},${r.sat ?? 90}%,${r.sat ? 45 : 65}%,${t * (r.sat ? 0.6 : 0.9) * (r.a ?? 1)})`
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
      if (b.fz !== undefined) {
        // fizzled: a short wobbly stub, then it falls apart into blocks
        b.top -= 4
        if (--b.fz <= 0) { crumble(b); bars[i] = bars[bars.length - 1]; bars.pop(); continue }
      } else if (b.held) b.top -= speed
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
    ctx.lineJoin = 'round'
    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i]
      l.life++
      l.y -= l.sz ? 0.35 : 0.5
      const t = 1 - l.life / (l.max ?? 70)
      if (t <= 0) { labels.splice(i, 1); continue }
      if (l.sz) {
        // big labels pop in with a little overshoot
        const pop = Math.min(1, l.life / 10)
        const k = pop < 1 ? 1 + 0.3 * Math.sin(pop * Math.PI) : 1
        const a = Math.min(1, t * 3)
        const lx = Math.max(70, Math.min(w - 70, l.x))
        ctx.font = `800 ${Math.round(l.sz * k * Math.min(1, 0.4 + pop * 0.6))}px system-ui, sans-serif`
        if (l.stroke) {
          ctx.lineWidth = Math.max(3, l.sz * 0.12)
          ctx.strokeStyle = `hsla(262,60%,14%,${a * 0.85})`
          ctx.strokeText(l.text, lx, l.y)
        }
        ctx.fillStyle = `hsla(${l.hue},${l.sat ?? 95}%,${l.lit ?? 80}%,${a})`
        ctx.fillText(l.text, lx, l.y)
        ctx.font = '600 14px system-ui, sans-serif'
        continue
      }
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
  }
  function frame() {
    raf = 0
    if (paused || dead) return
    try {
      paint()
    } catch (e) {
      if (!warned) { warned = true; console.error('[viz] frame failed', e) }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
    if (!paused && !dead) raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    noteOn,
    noteOff,
    react,
    setPaused(p) {
      if (p === paused || dead) return
      paused = p
      if (p) {
        cancelAnimationFrame(raf)
        raf = 0
        timers.length = 0
        fountains.length = 0
      } else {
        lastFrame = performance.now()
        frameEma = 16
        if (!raf) raf = requestAnimationFrame(frame)
      }
    },
    setMode(m) {
      mode = m
      held.clear()
      timers.length = 0
      fountains.length = 0
      smokes.length = 0
      blocks.length = 0
      glows.length = 0
      rockets.length = 0
      noteY.clear()
      ghosts.clear()
      for (const sc of sceneList) sc.clear()
      for (const b of bars) b.held = false
    },
    setSparkle(on) {
      sparkleOn = on
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
      dead = true
      cancelAnimationFrame(raf)
      ro.disconnect()
    },
  }
}
