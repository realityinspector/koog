// Motif functions, the pure part: trim + quantise a played phrase, call signs, arguments (transpose, speed, loudness), recursion.
// No DOM, audio or stores, so scripts/kore-fixtures.ts can test it. Docs: docs/KODING_KORE.md
export type MotifKind = 'pitch' | 'lane'
export interface MotifNote { v: number; beat: number; beats: number; vel: number }
export interface CallSign {
  kind: MotifKind
  /** pitch motifs: the first note and the interval to the second (so the sign works in any key); the first-note offset is the transpose argument */
  a: number
  interval: number
  /** pad motifs: the chosen pad lane (hit it twice) */
  lane?: number
}
export interface Motif {
  id: string
  name: string
  emoji: string
  kind: MotifKind
  notes: MotifNote[]
  sign: CallSign
  /** default arguments (the editor changes these; a call adds its own on top) */
  transpose: number
  speed: number
  /** recursion: call itself again `times` more times, each `delay` beats later, `shift` semitones higher, a bit softer */
  recurse?: { delay: number; times: number; shift: number }
  created: number
  example?: boolean
}
export interface MotifEvent { kind: 'note' | 'drum'; value: number; beat: number; beats: number; vel: number; depth: number }
export interface MotifCall { motif: Motif; transpose: number; speed: number; vel: number; startBeat: number; events: MotifEvent[] }
export interface Tap { pitch?: number; lane?: number; t: number; vel: number }

export const MAX_DEPTH = 4
export const MAX_NOTES = 32
export const MAX_EVENTS = 256
export const HOLD_MS = 350
export const SIGN_GAP_MS = 900
export const DOUBLE_MS = 450
export const MAX_TRANSPOSE = 24
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))

/** snap close-to-grid beats onto a 1/4-beat grid (lightly: far-off beats keep their feel) */
export const quantBeat = (b: number, grid = 0.25, tol = 0.1) => { const g = Math.round(b / grid) * grid; return Math.abs(g - b) <= tol ? g : Math.round(b * 20) / 20 }

/** Played taps (ms) -> motif notes. Leading silence is dropped (beat 0 = first note); no trailing silence (the last note is half a beat). */
export function trimQuantise(taps: Tap[], bpm: number): { kind: MotifKind; notes: MotifNote[] } | null {
  const ts = taps.filter((t) => t.pitch != null || t.lane != null).sort((a, b) => a.t - b.t).slice(0, MAX_NOTES)
  if (!ts.length) return null
  const kind: MotifKind = ts[0].pitch != null ? 'pitch' : 'lane'
  const use = ts.filter((t) => (kind === 'pitch' ? t.pitch != null : t.lane != null))
  const mpb = 60000 / clamp(bpm || 100, 40, 240)
  const t0 = use[0].t
  const starts = use.map((t) => quantBeat((t.t - t0) / mpb))
  const notes: MotifNote[] = use.map((t, i) => {
    const next = i + 1 < use.length ? starts[i + 1] - starts[i] : 0.5
    return { v: kind === 'pitch' ? t.pitch! : t.lane!, beat: starts[i], beats: Math.round(clamp(next > 0 ? next * 0.95 : 0.1, 0.1, 1.5) * 100) / 100, vel: Math.round(clamp(t.vel, 0.1, 1) * 100) / 100 }
  })
  return { kind, notes }
}

export function callSignOf(kind: MotifKind, notes: MotifNote[], lane?: number): CallSign | null {
  if (kind === 'lane') return { kind, a: 0, interval: 0, lane: lane ?? notes[0]?.v ?? 0 }
  if (notes.length < 2) return null
  return { kind, a: notes[0].v, interval: notes[1].v - notes[0].v }
}

export const gainOfVel = (vel: number) => clamp(vel / 0.7, 0.25, 1)
export const nextBeatOf = (beat: number) => (Math.abs(beat - Math.round(beat)) < 0.02 ? Math.round(beat) + 1 : Math.floor(beat) + 1)

/** Build the scheduled events for one call. Total transpose = motif default + call argument; speed multiplies; vel (0..1) scales loudness. */
export function planCall(m: Motif, a: { transpose?: number; speed?: number; vel?: number; startBeat: number }): MotifCall {
  const transpose = clamp(Math.round((a.transpose ?? 0) + m.transpose), -MAX_TRANSPOSE, MAX_TRANSPOSE)
  const speed = clamp((a.speed ?? 1) * m.speed, 0.25, 4)
  const vel = clamp(a.vel ?? 0.7, 0, 1)
  const events: MotifEvent[] = []
  const levels = m.recurse ? Math.min(MAX_DEPTH, 1 + Math.max(0, Math.floor(m.recurse.times))) : 1
  for (let k = 0; k < levels; k++) {
    const off = k * (m.recurse?.delay ?? 0) / speed
    const shift = k * (m.recurse?.shift ?? 0)
    const soft = Math.pow(0.8, k)
    for (const n of m.notes) {
      if (events.length >= MAX_EVENTS) break
      const value = m.kind === 'pitch' ? clamp(n.v + transpose + shift, 0, 127) : clamp(n.v, 0, 7)
      events.push({ kind: m.kind === 'pitch' ? 'note' : 'drum', value, beat: a.startBeat + off + n.beat / speed, beats: n.beats / speed, vel: clamp(n.vel * gainOfVel(vel) * soft, 0.05, 1), depth: k })
    }
  }
  return { motif: m, transpose, speed, vel, startBeat: a.startBeat, events }
}

export interface InEvent { src: string; pitch?: number; lane?: number; vel: number; t: number }
export interface Detected { motif: Motif; transpose: number; speed: number; vel: number }

/**
 * Recognise call signs. Pitched: two notes whose interval matches a motif's sign, the second one HELD for HOLD_MS.
 * The first note's distance from the motif's own first note is the transpose argument. Pads: the chosen pad hit twice quickly.
 * Feed it on()/off() from the token layer (off = note released), and tick(now) about every 50 ms or when the hold timer fires.
 */
export class CallDetector {
  private prev: InEvent | null = null
  private pend: { m: Motif; p1: InEvent; p2: InEvent; held: boolean } | null = null
  private lastPad: { lane: number; t: number } | null = null
  constructor(private motifs: () => Motif[], private pedal: () => boolean = () => false) {}
  private fire(m: Motif, p1: InEvent, p2: InEvent): Detected {
    this.pend = null; this.prev = null
    return { motif: m, transpose: clamp(p1.pitch! - m.sign.a, -MAX_TRANSPOSE, MAX_TRANSPOSE), speed: this.pedal() ? 2 : 1, vel: p2.vel }
  }
  on(e: InEvent): Detected | null {
    if (e.lane != null && e.pitch == null) {
      const l = this.lastPad
      this.lastPad = { lane: e.lane, t: e.t }
      this.pend = null
      if (l && l.lane === e.lane && e.t - l.t <= DOUBLE_MS && e.t >= l.t) {
        const m = this.motifs().find((x) => x.sign.kind === 'lane' && x.sign.lane === e.lane)
        this.lastPad = null
        if (m) return { motif: m, transpose: 0, speed: this.pedal() ? 2 : 1, vel: e.vel }
      }
      return null
    }
    if (e.pitch == null) return null
    this.pend = null
    const p1 = this.prev
    this.prev = e
    if (p1 && p1.pitch != null && e.t - p1.t <= SIGN_GAP_MS && e.t >= p1.t) {
      const iv = e.pitch - p1.pitch
      const m = this.motifs().find((x) => x.sign.kind === 'pitch' && x.sign.interval === iv)
      if (m) this.pend = { m, p1, p2: e, held: true }
    }
    return null
  }
  /** the second note was let go: a hold long enough fires, a short tap cancels */
  off(e: { pitch: number; t: number }): Detected | null {
    const p = this.pend
    if (!p || p.p2.pitch !== e.pitch) return null
    return e.t - p.p2.t >= HOLD_MS ? this.fire(p.m, p.p1, p.p2) : ((this.pend = null), null)
  }
  tick(now: number): Detected | null {
    const p = this.pend
    return p && now - p.p2.t >= HOLD_MS ? this.fire(p.m, p.p1, p.p2) : null
  }
  reset() { this.prev = null; this.pend = null; this.lastPad = null }
}

export const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
const AUTO: [string, string][] = [['🐝', 'Buzz'], ['🦆', 'Quack'], ['🐸', 'Ribbit'], ['🦋', 'Flutter'], ['🐢', 'Slowpoke'], ['🦊', 'Sneak'], ['🐙', 'Wiggle'], ['🦉', 'Hoot'], ['🐬', 'Splash'], ['🦄', 'Sparkle']]
export const EMOJI_CHOICES = ['🐝', '🦆', '🐸', '🦋', '🐢', '🦊', '🐙', '🦉', '🐬', '🦄', '🚀', '⭐', '🔥', '🌈', '🎸', '🥁', '👾', '🍕', '🌀', '💎']
export function autoName(existing: Motif[]): { emoji: string; name: string } {
  const have = new Set(existing.map((m) => normName(m.name)))
  for (const [emoji, name] of AUTO) if (!have.has(normName(name))) return { emoji, name }
  return { emoji: '🧩', name: `Motif${existing.length + 1}` }
}

/** the built-in teaser: a motif that calls itself later, like a round (4 levels, each higher and softer) */
export const ROUND_EXAMPLE: Motif = {
  id: 'example-round', name: 'Round', emoji: '🌀', kind: 'pitch', example: true, created: 0, transpose: 0, speed: 1,
  notes: [60, 64, 67, 64].map((v, i) => ({ v, beat: i, beats: 0.9, vel: 0.7 })),
  sign: { kind: 'pitch', a: 60, interval: 4 },
  recurse: { delay: 2, times: 3, shift: 0 },
}
