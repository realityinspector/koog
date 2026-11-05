// Koog Kode language: shared types and limits. PURE (no DOM, no audio, no stores) so scripts/kode-fixtures.ts can test everything here.
// This is an independent, from-scratch implementation. Its mini-notation is inspired by live-coding pattern languages in general;
// no code or grammar tables were copied from any GPL / AGPL project (Koog is MIT).

/** one cycle = one bar = 4 beats */
export const CYCLE_BEATS = 4

/** hard limits so a pattern can never hang the page */
export const LIMITS = {
  /** characters in the whole program */
  src: 3000,
  /** code lines (blank and comment lines do not count) */
  lines: 32,
  /** layers playing at once */
  layers: 8,
  /** how deep [ ] and < > may nest */
  depth: 4,
  /** steps side by side in one [ ] or one pattern */
  steps: 64,
  /** most sounds one layer may make in one bar */
  events: 128,
  /** most work the player may do to plan one bar of one layer (counts rests and repeats) */
  work: 4000,
  /** biggest x*N */
  repeat: 16,
} as const

export type PatKind = 'notes' | 'drums'

export type Node =
  | { t: 'note'; midi: number; s: number; e: number }
  | { t: 'drum'; voice: number; s: number; e: number }
  | { t: 'rest' }
  | { t: 'seq'; items: Node[] }
  | { t: 'stack'; layers: Node[] }
  | { t: 'alt'; items: Node[] }
  | { t: 'rep'; n: number; node: Node }

/** a friendly problem, pointing at exact characters of the source (start inclusive, end exclusive) */
export interface Diag { message: string; start: number; end: number; line: number; col: number }

/** `play <name> [+n|-n] [x2|x½]`: a saved motif (🧩 My Motifs), looped on the bar grid and looked up again at every bar */
export interface MotifRef { name: string; shift: number; speed: number; s: number; e: number }
/** finds a motif by name (the app wires this to the Koding Kore). Pitched notes are MIDI numbers; pad notes are lanes 0..7. */
export type MotifResolver = (name: string, shift: number, speed: number) => { kind: 'pitch' | 'lane'; notes: { note: number; beat: number; beats: number; vel: number }[] } | null

export interface LayerSpec {
  kind: PatKind
  node: Node
  /** set for a `play` line (then node is empty) */
  motif?: MotifRef
  sound: string
  loud: number
  /** 1-based source line */
  line: number
}

export interface Program {
  src: string
  layers: LayerSpec[]
  /** the last `tempo` in the code, if any */
  tempo?: number
  errors: Diag[]
}

/** what the player hands to the sound code: one sound at a moment inside a bar */
export interface PlanEvent {
  layer: number
  kind: 'note' | 'drum'
  /** MIDI note, or drum voice index 0..7 */
  value: number
  sound: string
  /** 0..1 */
  vel: number
  /** beats from the start of the bar */
  beat: number
  /** length in beats (the step's slot) */
  dur: number
  /** source range to highlight */
  s: number
  e: number
}

export class KodeError extends Error {
  constructor(message: string, public start: number, public end: number) { super(message) }
}

/** 1-based line and column of a source offset */
export function locate(src: string, off: number): { line: number; col: number } {
  let line = 1, last = -1
  const o = Math.max(0, Math.min(off, src.length))
  for (let i = 0; i < o; i++) if (src.charCodeAt(i) === 10) { line++; last = i }
  return { line, col: o - last }
}
export function diag(src: string, message: string, start: number, end: number): Diag {
  const s = Math.max(0, Math.min(start, src.length))
  const { line, col } = locate(src, s)
  return { message, start: s, end: Math.max(s + 1, end), line, col }
}
/** "Line 2, character 7: ..." */
export const describe = (d: Diag): string => `Line ${d.line}, character ${d.col}: ${d.message}`
