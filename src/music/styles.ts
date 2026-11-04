// Mimic styles: a style is a RULE SET (scales per chord, rhythm feel, phrase habits, ornaments, dynamics, patch).
// Pure data + pure functions (no audio, no state, no DOM) so it can be unit-tested. Data-only module (no self-accept).
//
// COPYRIGHT / PUBLICITY RULES (strict, see docs):
//  - kind 'pd'    : composers whose characteristic work is US public domain (published 1930 or earlier). Real phrases may be
//                   quoted on purpose (QUOTES below, taken from the songs library) and are always named with their source.
//  - kind 'style' : post-1930 / still-copyrighted idioms (cool jazz, bebop, blues, funk ...). We emulate STYLE TRAITS only
//                   (modes, rhythm feel, space, register, articulation, timbre, form). No melodies, solos or licks are copied;
//                   every generated phrase is rule-based and original. Styles are named by IDIOM, never by a person.
//  - Round 2: jazz and modern players (src/features/mimic/peopleStyles.ts) may be NAMED, but only their general habits are emulated: still no melodies, solos or licks.
//  - No likenesses: icons are original abstract SVG paths (see ICONS).
import { SONGS } from '../features/songs/songs'
import type { Key } from './theory'
import { PEOPLE_DET, PEOPLE_QUAL, PEOPLE_STYLES } from '../features/mimic/peopleStyles'

export type Rng = () => number
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const pick = <T>(r: Rng, items: [T, number][]): T => {
  let s = 0; for (const [, w] of items) s += w
  let x = r() * s
  for (const [v, w] of items) { x -= w; if (x <= 0) return v }
  return items[items.length - 1][0]
}
const mod = (n: number, m: number) => ((n % m) + m) % m

// ---------- types ----------
export interface Patch {
  wave: OscillatorType; wave2?: OscillatorType
  /** cents between the two oscillators */
  detune: number
  cutoff: number; res: number; fenv: number
  a: number; d: number; s: number; r: number
  level: number
  /** vibrato: Hz, depth in cents, delay in s */
  vib?: { rate: number; depth: number; delay: number }
  /** simple FM (e-piano): modulator ratio, index (0..~6), decay s */
  fm?: { ratio: number; index: number; decay: number }
}
export interface Ev {
  /** beats from the start of the phrase */
  t: number; dur: number; note: number; vel: number
  /** cents to start from (blue-note scoop); glides to 0 */
  bend?: number
  /** what made this note: main melody note, or an ornament / chromatic helper (these may leave the scale) */
  kind: 'main' | 'grace' | 'trill' | 'turn' | 'approach' | 'blue' | 'bass' | 'chord' | 'quote'
}
export interface Chord { root: number; q: string }
export interface Trait { id: string; label: string; hint: string }
export interface Feel {
  /** beats the swing unit (0.5 = swung eighths, 0.25 = swung 16ths) */
  swingUnit: number
  /** long:short ratio, 1 = straight, 2 = triplet swing */
  swing: number
  /** chance an on-beat note is anticipated (pushed one grid step early) */
  sync: number
  /** notes per beat, roughly */
  density: number
  /** chance of leaving a rest instead of a note */
  rest: number
  /** grid in beats */
  grid: number
  /** fraction of a note's slot that sounds (articulation) */
  legato: number
  /** [beats, weight] note lengths */
  durs: [number, number][]
}
type Dev = 'repeat' | 'sequence' | 'invert' | 'retro' | 'fragment' | 'additive'
export interface StyleDef {
  id: string; name: string; emoji: string; icon: string
  kind: 'pd' | 'style'
  era: string
  /** one line, plain history. Names artists only as factual reference, no likeness, no endorsement */
  blurb: string
  mode: 'major' | 'minor' | 'dorian' | 'tonic'
  bpm: number; bpb: number
  /** chord progression relative to home; each chord lasts one bar */
  prog: Chord[]
  feel: Feel
  /** [beats, weight] phrase lengths */
  lens: [number, number][]
  devs: [Dev, number][]
  range: [number, number]
  /** chance a strong-beat note is pulled to a chord tone */
  ctSnap: number
  orn: { grace: number; trill: number; turn: number; approach: number; enclosure: number; blue: number }
  /** extra "blue" notes (semitones above chord root) that may replace the 3rd / 7th */
  blues: number[]
  dyn: 'flat' | 'swell' | 'terraced' | 'accent' | 'arch'
  vel: [number, number]
  /** rubato amount in beats (0 = strict) */
  rubato: number
  patch: Patch
  comp: 'walk' | 'sparse' | 'alberti' | 'roll' | 'oompah' | 'boogie' | 'funk' | 'pulse' | 'arps' | 'gospel' | 'bossa' | 'satie' | 'planing' | 'five'
  traits: [Trait, Trait, Trait]
  /** ids from the songs library that may be quoted on purpose (public domain only) */
  quotes?: string[]
  /** small answer-ending habit */
  cadence?: 'balanced' | 'tonic'
}

export const NOTICE = 'Style emulation for learning. Not affiliated with any artist or estate.'

// ---------- chord / scale vocabulary ----------
export const QUAL: Record<string, { tones: number[]; scale: number[] }> = {
  M: { tones: [0, 4, 7], scale: [0, 2, 4, 5, 7, 9, 11] },
  m: { tones: [0, 3, 7], scale: [0, 2, 3, 5, 7, 8, 10] },
  m7: { tones: [0, 3, 7, 10], scale: [0, 2, 3, 5, 7, 9, 10] },
  d7: { tones: [0, 4, 7, 10], scale: [0, 2, 4, 5, 7, 9, 10] },
  d9: { tones: [0, 4, 7, 10], scale: [0, 2, 4, 5, 7, 9, 10] },
  M7: { tones: [0, 4, 7, 11], scale: [0, 2, 4, 5, 7, 9, 11] },
  M7L: { tones: [0, 4, 7, 11], scale: [0, 2, 4, 6, 7, 9, 11] },
  wt: { tones: [0, 4, 8], scale: [0, 2, 4, 6, 8, 10] },
  pM: { tones: [0, 4, 7], scale: [0, 2, 4, 7, 9] },
  pm: { tones: [0, 3, 7], scale: [0, 3, 5, 7, 10] },
  bl: { tones: [0, 3, 7, 10], scale: [0, 3, 5, 6, 7, 10] },
  bg: { tones: [0, 4, 7, 10], scale: [0, 3, 4, 5, 7, 9, 10] },
  fk: { tones: [0, 4, 7, 10], scale: [0, 3, 5, 7, 9, 10] },
  gp: { tones: [0, 4, 7], scale: [0, 2, 4, 5, 7, 9] },
  ...PEOPLE_QUAL,
}
const ch = (root: number, q: string): Chord => ({ root, q })

// ---------- original abstract icons (24x24 paths, no likenesses) ----------
export const ICONS: Record<string, string> = {
  bach: 'M3 18 L7 6 L11 18 L15 6 L19 18 L21 12', // zig-zag counterpoint
  mozart: 'M4 18 C4 8 10 8 12 14 C14 8 20 8 20 18', // balanced arches
  chopin: 'M3 16 C7 4 11 20 15 8 C17 4 19 6 21 10', // flowing wave
  debussy: 'M3 8 H21 M5 12 H19 M7 16 H17 M9 20 H15', // stacked planes
  satie: 'M6 20 V12 M12 20 V6 M18 20 V15', // sparse columns
  joplin: 'M3 18 L8 8 L10 16 L15 6 L17 14 L21 8', // syncopated jumps
  gershwin: 'M3 12 C6 4 9 20 12 12 S18 4 21 14', // bending blue wave
  cooljazz: 'M3 14 H9 M12 14 H14 M17 10 H21 M3 18 H21', // long tones + space
  bebop: 'M3 18 L6 9 L8 15 L11 5 L13 14 L16 7 L18 13 L21 4', // fast darts
  blues: 'M4 20 V8 M4 8 C10 4 14 14 20 8 M4 14 H20', // twelve-bar bend
  boogie: 'M3 18 H5 V12 H7 V18 H9 V12 H11 V18 H13 V12 H15 V18 H17 V12 H19 V18 H21', // rolling steps
  funk: 'M3 18 V12 M7 18 V8 M11 18 V14 M15 18 V6 M19 18 V12', // 16th stabs
  minimal: 'M4 8 H8 M10 8 H14 M16 8 H20 M4 14 H8 M10 14 H14 M16 14 H20 M4 20 H8', // repeating cells
  synthpop: 'M3 18 L8 10 L12 16 L16 6 L21 14', // arp ramps
  gospel: 'M4 20 V10 M9 20 V6 M15 20 V6 M20 20 V10 M4 10 H20', // 1-4-5 columns
  bossa: 'M4 16 C8 6 12 6 12 14 C12 20 20 20 20 8', // gentle sway
}

// ---------- the styles ----------
const D = (): [Dev, number][] => [['repeat', 1]]
void D
export const STYLES: StyleDef[] = [
  {
    id: 'bach', name: 'Baroque Counterpoint', emoji: '🎼', icon: ICONS.bach, kind: 'pd', era: '1700s', mode: 'major', bpm: 96, bpb: 4,
    blurb: 'Bach and his Baroque friends wove tunes together and marched patterns up and down the scale (sequences).',
    prog: [ch(0, 'M'), ch(9, 'm7'), ch(2, 'm7'), ch(7, 'd7')],
    feel: { swingUnit: 0.25, swing: 1, sync: 0.02, density: 3, rest: 0.03, grid: 0.25, legato: 0.82, durs: [[0.25, 0.7], [0.5, 0.25], [1, 0.05]] },
    lens: [[4, 0.5], [8, 0.5]], devs: [['sequence', 0.5], ['invert', 0.2], ['repeat', 0.2], ['retro', 0.1]], range: [48, 84], ctSnap: 0.7,
    orn: { grace: 0, trill: 0.3, turn: 0.05, approach: 0, enclosure: 0, blue: 0 }, blues: [], dyn: 'terraced', vel: [66, 82], rubato: 0,
    patch: { wave: 'sawtooth', wave2: 'square', detune: 6, cutoff: 3200, res: 1, fenv: 3000, a: 0.002, d: 0.35, s: 0.05, r: 0.12, level: 0.5 },
    comp: 'walk', quotes: ['invention1', 'prelude', 'toccata'], cadence: 'tonic',
    traits: [
      { id: 'run', label: 'Running notes', hint: 'Play a run of 5 or more notes stepping up or down.' },
      { id: 'repeat', label: 'Sequence (repeat a pattern)', hint: 'Play a little pattern, then play it again starting on another note.' },
      { id: 'fast', label: 'Even, busy notes', hint: 'Keep many quick notes going, evenly.' }],
  },
  {
    id: 'mozart', name: 'Classical Balance', emoji: '🎻', icon: ICONS.mozart, kind: 'pd', era: '1780s', mode: 'major', bpm: 112, bpb: 4,
    blurb: 'Mozart and Haydn liked tidy phrases: a question, then an answer, with a light left-hand pattern (Alberti bass).',
    prog: [ch(0, 'M'), ch(7, 'd7'), ch(0, 'M'), ch(5, 'M'), ch(7, 'd7'), ch(0, 'M')],
    feel: { swingUnit: 0.5, swing: 1, sync: 0.03, density: 2, rest: 0.07, grid: 0.25, legato: 0.8, durs: [[0.5, 0.5], [0.25, 0.25], [1, 0.25]] },
    lens: [[4, 0.5], [8, 0.5]], devs: [['sequence', 0.4], ['repeat', 0.3], ['invert', 0.2], ['fragment', 0.1]], range: [55, 88], ctSnap: 0.6,
    orn: { grace: 0.25, trill: 0.15, turn: 0.1, approach: 0, enclosure: 0, blue: 0 }, blues: [], dyn: 'arch', vel: [60, 82], rubato: 0,
    patch: { wave: 'triangle', wave2: 'sine', detune: 3, cutoff: 5000, res: 0.5, fenv: 2000, a: 0.004, d: 0.6, s: 0.15, r: 0.25, level: 0.55 },
    comp: 'alberti', quotes: ['nachtmusik', 'turkish', 'surprise'], cadence: 'balanced',
    traits: [
      { id: 'steps', label: 'Balanced question and answer', hint: 'Play two short phrases: the second one answers the first.' },
      { id: 'ornament', label: 'A little ornament', hint: 'Add a quick grace note or trill (two fast notes).' },
      { id: 'tidy', label: 'Clear, even notes', hint: 'Keep your timing steady.' }],
  },
  {
    id: 'chopin', name: 'Romantic Nocturne', emoji: '🌙', icon: ICONS.chopin, kind: 'pd', era: '1830s', mode: 'minor', bpm: 66, bpb: 3,
    blurb: 'Chopin sang on the piano: flexible timing (rubato), sparkling ornaments, and long breathing phrases.',
    prog: [ch(0, 'm'), ch(8, 'M'), ch(5, 'm'), ch(7, 'd7')],
    feel: { swingUnit: 0.5, swing: 1, sync: 0.03, density: 2.4, rest: 0.03, grid: 0.25, legato: 1.0, durs: [[0.5, 0.35], [0.25, 0.3], [1, 0.25], [1.5, 0.1]] },
    lens: [[6, 0.5], [9, 0.5]], devs: [['sequence', 0.35], ['repeat', 0.2], ['invert', 0.15], ['fragment', 0.3]], range: [48, 92], ctSnap: 0.5,
    orn: { grace: 0.3, trill: 0.1, turn: 0.2, approach: 0, enclosure: 0, blue: 0 }, blues: [], dyn: 'swell', vel: [50, 84], rubato: 0.12,
    patch: { wave: 'triangle', wave2: 'sine', detune: 4, cutoff: 3800, res: 0.5, fenv: 1600, a: 0.006, d: 0.9, s: 0.25, r: 0.6, level: 0.55 },
    comp: 'roll', quotes: [], cadence: 'tonic',
    traits: [
      { id: 'rubato', label: 'Rubato (bend the time)', hint: 'Speed up a little, then slow down. Not like a robot.' },
      { id: 'ornament', label: 'Sparkling ornaments', hint: 'Add a quick turn or grace note.' },
      { id: 'run', label: 'Singing line with a run', hint: 'End with a flowing run of notes.' }],
  },
  {
    id: 'debussy', name: 'Impressionist Colors', emoji: '🌫️', icon: ICONS.debussy, kind: 'pd', era: '1890s', mode: 'tonic', bpm: 66, bpb: 4,
    blurb: 'Debussy painted with sound: whole-tone scales, five-note pentatonic tunes and chords sliding in parallel.',
    prog: [ch(0, 'wt'), ch(0, 'pM'), ch(2, 'wt'), ch(7, 'pM')],
    feel: { swingUnit: 0.5, swing: 1, sync: 0.05, density: 1.5, rest: 0.15, grid: 0.5, legato: 1.1, durs: [[0.5, 0.3], [1, 0.4], [1.5, 0.2], [2, 0.1]] },
    lens: [[4, 0.4], [8, 0.6]], devs: [['sequence', 0.5], ['repeat', 0.3], ['fragment', 0.2]], range: [55, 91], ctSnap: 0.2,
    orn: { grace: 0.05, trill: 0, turn: 0, approach: 0, enclosure: 0, blue: 0 }, blues: [], dyn: 'swell', vel: [40, 66], rubato: 0.06,
    patch: { wave: 'sine', wave2: 'triangle', detune: 5, cutoff: 2500, res: 0.4, fenv: 900, a: 0.02, d: 1.2, s: 0.2, r: 1.0, level: 0.5 },
    comp: 'planing',
    traits: [
      { id: 'whole', label: 'Whole-tone color', hint: 'Play notes skipping every other key (C D E F# G# A#): a dreamy sound.' },
      { id: 'pent', label: 'Pentatonic tune', hint: 'Use only five different notes, like the black keys.' },
      { id: 'space', label: 'Let it float', hint: 'Leave some quiet gaps.' }],
  },
  {
    id: 'satie', name: 'Sparse & Modal', emoji: '🕯️', icon: ICONS.satie, kind: 'pd', era: '1880s', mode: 'major', bpm: 66, bpb: 3,
    blurb: 'Satie wrote slow, quiet pieces with few notes and gentle old-fashioned modes. Space is part of the music.',
    prog: [ch(0, 'M7L'), ch(7, 'M7')],
    feel: { swingUnit: 0.5, swing: 1, sync: 0.02, density: 0.7, rest: 0.35, grid: 0.5, legato: 1.0, durs: [[1, 0.3], [2, 0.5], [3, 0.2]] },
    lens: [[6, 0.5], [9, 0.5]], devs: [['repeat', 0.4], ['sequence', 0.3], ['fragment', 0.3]], range: [60, 84], ctSnap: 0.6,
    orn: { grace: 0, trill: 0, turn: 0, approach: 0, enclosure: 0, blue: 0 }, blues: [], dyn: 'flat', vel: [38, 54], rubato: 0,
    patch: { wave: 'triangle', wave2: 'sine', detune: 2, cutoff: 2200, res: 0.3, fenv: 700, a: 0.01, d: 0.9, s: 0.1, r: 0.8, level: 0.45 },
    comp: 'satie', quotes: ['gymnopedie'], cadence: 'tonic',
    traits: [
      { id: 'slow', label: 'Slow and sparse', hint: 'Play only a few notes, slowly.' },
      { id: 'space', label: 'Leave silence', hint: 'Let the quiet gaps ring.' },
      { id: 'longNotes', label: 'Let notes hang', hint: 'Hold notes for a long time.' }],
  },
  {
    id: 'joplin', name: 'Ragtime', emoji: '🎹', icon: ICONS.joplin, kind: 'pd', era: '1900s', mode: 'major', bpm: 100, bpb: 4,
    blurb: 'Scott Joplin and other ragtime players put melody notes between the beats (syncopation) over an oom-pah left hand.',
    prog: [ch(0, 'M'), ch(9, 'd7'), ch(2, 'd7'), ch(7, 'd7')],
    feel: { swingUnit: 0.5, swing: 1, sync: 0.55, density: 2.5, rest: 0.06, grid: 0.5, legato: 0.9, durs: [[0.5, 0.55], [1, 0.3], [0.25, 0.15]] },
    lens: [[4, 0.5], [8, 0.5]], devs: [['repeat', 0.4], ['sequence', 0.4], ['fragment', 0.2]], range: [60, 91], ctSnap: 0.5,
    orn: { grace: 0.1, trill: 0, turn: 0, approach: 0.1, enclosure: 0, blue: 0 }, blues: [], dyn: 'accent', vel: [64, 88], rubato: 0,
    patch: { wave: 'square', wave2: 'sawtooth', detune: 14, cutoff: 4500, res: 1, fenv: 1800, a: 0.003, d: 0.4, s: 0.1, r: 0.15, level: 0.42 },
    comp: 'oompah', quotes: ['entertainer'], cadence: 'tonic',
    traits: [
      { id: 'sync', label: 'Syncopation', hint: 'Play short-LONG-short: put notes between the beats.' },
      { id: 'steps', label: 'Bouncy, steady beat', hint: 'Keep a steady beat going under the off-beats.' },
      { id: 'repeat', label: 'Repeat a motif', hint: 'Play a pattern and repeat it.' }],
  },
  {
    id: 'gershwin', name: 'Blue-Note Concert Jazz', emoji: '🎷', icon: ICONS.gershwin, kind: 'pd', era: '1920s', mode: 'major', bpm: 84, bpb: 4,
    blurb: 'In the 1920s concert composers like Gershwin bent the 3rd and 7th into blue notes and slid between pitches.',
    prog: [ch(0, 'M'), ch(5, 'M'), ch(0, 'M'), ch(7, 'd7')],
    feel: { swingUnit: 0.5, swing: 1.25, sync: 0.3, density: 1.6, rest: 0.1, grid: 0.5, legato: 0.95, durs: [[0.5, 0.35], [1, 0.35], [1.5, 0.15], [2, 0.15]] },
    lens: [[4, 0.4], [8, 0.6]], devs: [['sequence', 0.3], ['repeat', 0.3], ['fragment', 0.2], ['invert', 0.2]], range: [57, 89], ctSnap: 0.4,
    orn: { grace: 0.1, trill: 0, turn: 0, approach: 0, enclosure: 0, blue: 0.55 }, blues: [3, 10], dyn: 'swell', vel: [58, 84], rubato: 0.05,
    patch: { wave: 'square', detune: 0, cutoff: 1900, res: 1.5, fenv: 900, a: 0.05, d: 0.1, s: 0.8, r: 0.15, level: 0.45, vib: { rate: 5.2, depth: 18, delay: 0.25 } },
    comp: 'oompah',
    traits: [
      { id: 'blue', label: 'Blue notes', hint: 'Use the flat 3rd and flat 7th (the "bluesy" black keys near the major scale).' },
      { id: 'swing', label: 'A little swing', hint: 'Play long-short pairs.' },
      { id: 'longNotes', label: 'A singing long note', hint: 'Hold one note and let it sing.' }],
  },
  {
    id: 'cooljazz', name: 'Cool Jazz (1950s modal style)', emoji: '🎺', icon: ICONS.cooljazz, kind: 'style', era: '1950s', mode: 'dorian', bpm: 92, bpb: 4,
    blurb: 'In the 1950s some jazz players, Miles Davis among those who made this sound famous, slowed down, used modes and left lots of space.',
    prog: [ch(0, 'm7'), ch(0, 'm7'), ch(5, 'd7'), ch(0, 'm7')],
    feel: { swingUnit: 0.5, swing: 1.9, sync: 0.15, density: 0.9, rest: 0.6, grid: 0.5, legato: 0.95, durs: [[0.5, 0.4], [1, 0.4], [2, 0.2]] },
    lens: [[6, 0.4], [8, 0.6]], devs: [['repeat', 0.3], ['sequence', 0.3], ['fragment', 0.3], ['invert', 0.1]], range: [57, 81], ctSnap: 0.5,
    orn: { grace: 0.05, trill: 0, turn: 0, approach: 0, enclosure: 0, blue: 0 }, blues: [], dyn: 'swell', vel: [48, 72], rubato: 0,
    patch: { wave: 'sawtooth', detune: 0, cutoff: 1500, res: 5, fenv: 800, a: 0.04, d: 0.2, s: 0.7, r: 0.25, level: 0.5, vib: { rate: 4.5, depth: 14, delay: 0.35 } },
    comp: 'sparse',
    traits: [
      { id: 'dorian', label: 'Dorian mode', hint: 'Use the flat 3rd and flat 7th of your home note (a minor-ish, open sound).' },
      { id: 'space', label: 'Leave space', hint: 'Rest between phrases. Silence is cool.' },
      { id: 'longNotes', label: 'Long notes', hint: 'Hold some notes for a second or more.' }],
  },
  {
    id: 'bebop', name: 'Bebop (1940s fast style)', emoji: '⚡', icon: ICONS.bebop, kind: 'style', era: '1940s', mode: 'major', bpm: 150, bpb: 4,
    blurb: 'In the 1940s small-band jazz sped up: quick eighth-note lines that dart around the chord and squeeze in chromatic passing notes.',
    prog: [ch(2, 'm7'), ch(7, 'd7'), ch(0, 'M7'), ch(0, 'M7')],
    feel: { swingUnit: 0.5, swing: 1.7, sync: 0.12, density: 2, rest: 0.05, grid: 0.5, legato: 0.94, durs: [[0.5, 0.85], [1, 0.15]] },
    lens: [[4, 0.3], [8, 0.7]], devs: [['sequence', 0.4], ['invert', 0.2], ['fragment', 0.2], ['repeat', 0.1], ['retro', 0.1]], range: [55, 88], ctSnap: 0.85,
    orn: { grace: 0, trill: 0, turn: 0, approach: 0.7, enclosure: 0.3, blue: 0 }, blues: [], dyn: 'accent', vel: [58, 86], rubato: 0,
    patch: { wave: 'sawtooth', detune: 3, cutoff: 3500, res: 2, fenv: 1500, a: 0.01, d: 0.1, s: 0.6, r: 0.1, level: 0.5 },
    comp: 'walk',
    traits: [
      { id: 'fast', label: 'Fast eighth notes', hint: 'Play 8 or more quick notes in a row.' },
      { id: 'chrom', label: 'Chromatic approach', hint: 'Slide in by a half step (neighbor key) before landing on a note.' },
      { id: 'swing', label: 'Swing the eighths', hint: 'Play long-short, long-short.' }],
  },
  {
    id: 'blues', name: 'Blues (12-bar style)', emoji: '🎸', icon: ICONS.blues, kind: 'style', era: '1920s-50s', mode: 'tonic', bpm: 84, bpb: 4,
    blurb: 'Blues grew from work songs and church music: the minor pentatonic scale plus a flat-5 "blue note", in a 12-bar loop with call and response.',
    prog: [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 0].map((r) => ch(r, 'bl')),
    feel: { swingUnit: 0.5, swing: 1.8, sync: 0.2, density: 1.3, rest: 0.25, grid: 0.5, legato: 0.9, durs: [[0.5, 0.4], [1, 0.35], [2, 0.15], [1.5, 0.1]] },
    lens: [[4, 0.5], [8, 0.5]], devs: [['repeat', 0.5], ['sequence', 0.25], ['fragment', 0.25]], range: [55, 84], ctSnap: 0.4,
    orn: { grace: 0.15, trill: 0, turn: 0, approach: 0, enclosure: 0, blue: 0.5 }, blues: [6], dyn: 'accent', vel: [58, 84], rubato: 0,
    patch: { wave: 'sawtooth', wave2: 'square', detune: 8, cutoff: 2600, res: 3, fenv: 1100, a: 0.01, d: 0.3, s: 0.5, r: 0.2, level: 0.42 },
    comp: 'walk',
    traits: [
      { id: 'blue', label: 'Blue notes', hint: 'Use the flat 3rd, flat 5th or flat 7th of your home note.' },
      { id: 'callresp', label: 'Call and response', hint: 'Play a short phrase, pause, then answer it.' },
      { id: 'repeat', label: 'Repeat the riff', hint: 'Play the same little pattern twice.' }],
  },
  {
    id: 'boogie', name: 'Boogie-Woogie', emoji: '🚂', icon: ICONS.boogie, kind: 'style', era: '1930s-40s', mode: 'tonic', bpm: 132, bpb: 4,
    blurb: 'Boogie-woogie pianists drive a rolling left-hand bass over a 12-bar blues while the right hand repeats punchy riffs.',
    prog: [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map((r) => ch(r, 'bg')),
    feel: { swingUnit: 0.5, swing: 2, sync: 0.15, density: 3, rest: 0.05, grid: 0.5, legato: 0.8, durs: [[0.5, 0.7], [1, 0.2], [0.25, 0.1]] },
    lens: [[4, 0.6], [8, 0.4]], devs: [['repeat', 0.6], ['sequence', 0.3], ['fragment', 0.1]], range: [58, 88], ctSnap: 0.4,
    orn: { grace: 0.2, trill: 0.15, turn: 0, approach: 0, enclosure: 0, blue: 0.2 }, blues: [6], dyn: 'accent', vel: [66, 92], rubato: 0,
    patch: { wave: 'sawtooth', detune: 5, cutoff: 4000, res: 1, fenv: 2400, a: 0.002, d: 0.3, s: 0.2, r: 0.12, level: 0.42 },
    comp: 'boogie',
    traits: [
      { id: 'swing', label: 'Shuffle feel', hint: 'Play bouncy long-short pairs.' },
      { id: 'repeat', label: 'Riff it', hint: 'Repeat a short pattern over and over.' },
      { id: 'fast', label: 'Keep it rolling', hint: 'Play lots of quick, steady notes.' }],
  },
  {
    id: 'funk', name: 'Funk (16th-note groove)', emoji: '🕺', icon: ICONS.funk, kind: 'style', era: '1960s-70s', mode: 'dorian', bpm: 100, bpb: 4,
    blurb: 'Funk bands lock onto tight, repeating 16th-note riffs with plenty of silence in between (the "one" lands hard).',
    prog: [ch(0, 'd9'), ch(0, 'd9'), ch(5, 'd9'), ch(0, 'd9')],
    feel: { swingUnit: 0.25, swing: 1.15, sync: 0.6, density: 3, rest: 0.35, grid: 0.25, legato: 0.45, durs: [[0.25, 0.6], [0.5, 0.3], [0.75, 0.1]] },
    lens: [[4, 0.7], [8, 0.3]], devs: [['repeat', 0.5], ['fragment', 0.3], ['sequence', 0.2]], range: [48, 84], ctSnap: 0.45,
    orn: { grace: 0.12, trill: 0, turn: 0, approach: 0.1, enclosure: 0, blue: 0 }, blues: [], dyn: 'accent', vel: [56, 92], rubato: 0,
    patch: { wave: 'sawtooth', wave2: 'square', detune: 4, cutoff: 3200, res: 6, fenv: 3500, a: 0.001, d: 0.14, s: 0.1, r: 0.06, level: 0.4 },
    comp: 'funk',
    traits: [
      { id: 'sync', label: 'Syncopated 16ths', hint: 'Play short notes that land between the beats.' },
      { id: 'repeat', label: 'A repeating riff', hint: 'Lock a short pattern and repeat it.' },
      { id: 'space', label: 'Short and punchy', hint: 'Play short notes with gaps (staccato).' }],
  },
  {
    id: 'minimal', name: 'Minimalism (repeating cells)', emoji: '🔁', icon: ICONS.minimal, kind: 'style', era: '1960s on', mode: 'major', bpm: 120, bpb: 4,
    blurb: 'Minimal music repeats a tiny cell of notes in a steady pulse and changes it very gradually, one note at a time.',
    prog: [ch(0, 'M'), ch(0, 'M'), ch(9, 'm7'), ch(9, 'm7')],
    feel: { swingUnit: 0.5, swing: 1, sync: 0, density: 2, rest: 0, grid: 0.5, legato: 0.9, durs: [[0.5, 1]] },
    lens: [[8, 1]], devs: [['additive', 1]], range: [55, 88], ctSnap: 0.2,
    orn: { grace: 0, trill: 0, turn: 0, approach: 0, enclosure: 0, blue: 0 }, blues: [], dyn: 'flat', vel: [60, 72], rubato: 0,
    patch: { wave: 'sine', wave2: 'triangle', detune: 2, cutoff: 3000, res: 0.5, fenv: 1200, a: 0.002, d: 0.35, s: 0, r: 0.2, level: 0.5 },
    comp: 'pulse',
    traits: [
      { id: 'repeat', label: 'Repeat a cell', hint: 'Play a 3 to 5 note pattern again and again.' },
      { id: 'pulse', label: 'Steady pulse', hint: 'Keep every note the same distance apart.' },
      { id: 'stepwise', label: 'Change one thing', hint: 'Repeat, then change just one note.' }],
  },
  {
    id: 'synthpop', name: 'Synth-Pop (80s arps)', emoji: '🎛️', icon: ICONS.synthpop, kind: 'style', era: '1980s', mode: 'minor', bpm: 116, bpb: 4,
    blurb: '1980s synth bands ran fast chord arpeggios through bright, slightly detuned sawtooth sounds over four steady chords.',
    prog: [ch(0, 'm'), ch(8, 'M'), ch(3, 'M'), ch(10, 'M')],
    feel: { swingUnit: 0.25, swing: 1, sync: 0.25, density: 3, rest: 0.04, grid: 0.25, legato: 0.8, durs: [[0.25, 0.7], [0.5, 0.2], [1, 0.1]] },
    lens: [[4, 0.5], [8, 0.5]], devs: [['sequence', 0.5], ['repeat', 0.4], ['invert', 0.1]], range: [52, 88], ctSnap: 0.9,
    orn: { grace: 0, trill: 0, turn: 0, approach: 0, enclosure: 0, blue: 0 }, blues: [], dyn: 'flat', vel: [66, 82], rubato: 0,
    patch: { wave: 'sawtooth', wave2: 'sawtooth', detune: 14, cutoff: 2800, res: 2, fenv: 2200, a: 0.01, d: 0.25, s: 0.5, r: 0.25, level: 0.4 },
    comp: 'arps',
    traits: [
      { id: 'arp', label: 'Arpeggios', hint: 'Play the notes of a chord one after another (up or down).' },
      { id: 'pulse', label: 'Even 16ths', hint: 'Keep a steady, fast stream of notes.' },
      { id: 'repeat', label: 'Repeat the hook', hint: 'Play a pattern twice.' }],
  },
  {
    id: 'gospel', name: 'Gospel & Soul (1-4-5)', emoji: '🙌', icon: ICONS.gospel, kind: 'style', era: '1950s-70s', mode: 'major', bpm: 76, bpb: 4,
    blurb: 'Gospel and soul build songs on the I, IV and V chords with warm organ or electric-piano sounds and extra passing chords.',
    prog: [ch(0, 'M'), ch(0, 'd7'), ch(5, 'M'), ch(5, 'm'), ch(0, 'M'), ch(7, 'd7')],
    feel: { swingUnit: 0.5, swing: 1.5, sync: 0.3, density: 1.8, rest: 0.15, grid: 0.5, legato: 0.9, durs: [[0.5, 0.4], [1, 0.3], [2, 0.2], [1.5, 0.1]] },
    lens: [[4, 0.5], [8, 0.5]], devs: [['repeat', 0.4], ['sequence', 0.4], ['fragment', 0.2]], range: [55, 86], ctSnap: 0.5,
    orn: { grace: 0.3, trill: 0, turn: 0, approach: 0, enclosure: 0, blue: 0.25 }, blues: [3], dyn: 'swell', vel: [56, 86], rubato: 0,
    patch: { wave: 'sine', detune: 0, cutoff: 5000, res: 0.5, fenv: 800, a: 0.004, d: 0.7, s: 0.2, r: 0.3, level: 0.5, fm: { ratio: 14, index: 1.6, decay: 0.25 }, vib: { rate: 5.5, depth: 8, delay: 0.3 } },
    comp: 'gospel',
    traits: [
      { id: 'chords', label: 'Play chords', hint: 'Press 3 notes together.' },
      { id: 'onefourfive', label: '1-4-5 roots', hint: 'Play your home note, then 4th, then 5th up the scale.' },
      { id: 'swing', label: 'Lean into the groove', hint: 'Play long-short pairs.' }],
  },
  {
    id: 'bossa', name: 'Bossa Nova (syncopated comping)', emoji: '🌴', icon: ICONS.bossa, kind: 'style', era: '1960s', mode: 'major', bpm: 128, bpb: 4,
    blurb: 'Bossa nova from Brazil pairs a gentle, steady bass with chords that land in a syncopated pattern, all very soft and relaxed.',
    prog: [ch(2, 'm7'), ch(7, 'd7'), ch(0, 'M7'), ch(9, 'm7')],
    feel: { swingUnit: 0.5, swing: 1, sync: 0.5, density: 1.8, rest: 0.2, grid: 0.5, legato: 0.8, durs: [[0.5, 0.45], [1, 0.3], [1.5, 0.15], [2, 0.1]] },
    lens: [[4, 0.5], [8, 0.5]], devs: [['sequence', 0.4], ['repeat', 0.3], ['invert', 0.2], ['fragment', 0.1]], range: [55, 86], ctSnap: 0.5,
    orn: { grace: 0, trill: 0, turn: 0, approach: 0.2, enclosure: 0, blue: 0 }, blues: [], dyn: 'flat', vel: [48, 70], rubato: 0,
    patch: { wave: 'triangle', wave2: 'sine', detune: 5, cutoff: 2800, res: 0.8, fenv: 1800, a: 0.003, d: 0.5, s: 0.05, r: 0.2, level: 0.5 },
    comp: 'bossa',
    traits: [
      { id: 'sync', label: 'Syncopation', hint: 'Land some notes just before the beat.' },
      { id: 'steady', label: 'Gentle and steady', hint: 'Keep it soft and even.' },
      { id: 'space', label: 'Relaxed spaces', hint: 'Leave short gaps between phrases.' }],
  },
]
STYLES.push(...PEOPLE_STYLES) // the named jazz and modern players (round 2)
export const styleById = (id: string): StyleDef => STYLES.find((s) => s.id === id) ?? STYLES[0]

// ---------- harmony helpers ----------
/** Home note (pitch class) for a style given the player's key. Keeps the notes on the same keys when possible. */
export function homeOf(st: StyleDef, key: Key): number {
  const minorish = key.scale === 'minor' || key.scale === 'minorPentatonic' || key.scale === 'blues'
  switch (st.mode) {
    case 'major': return mod(minorish ? key.tonic + 3 : key.tonic, 12)
    case 'minor': return mod(minorish ? key.tonic : key.tonic + 9, 12)
    case 'dorian': return mod(minorish ? key.tonic : key.tonic + 2, 12)
    default: return mod(key.tonic, 12)
  }
}
export function chordAt(st: StyleDef, bar: number): Chord { return st.prog[mod(bar, st.prog.length)] }
const poolOf = (c: Chord) => QUAL[c.q] ?? QUAL.M
/** Pitch classes allowed as MAIN melody notes at a chord (chord scale + the style's blue substitutions). */
export function chordPcs(st: StyleDef, home: number, c: Chord): Set<number> {
  const out = new Set<number>()
  const base = home + c.root
  for (const s of poolOf(c).scale) out.add(mod(base + s, 12))
  for (const b of st.blues) out.add(mod(base + b, 12))
  return out
}
/** Every pitch class this style may use as a MAIN note anywhere in its progression. */
export function stylePcs(st: StyleDef, home: number): Set<number> {
  const out = new Set<number>()
  for (const c of st.prog) for (const p of chordPcs(st, home, c)) out.add(p)
  return out
}
/** scale degree d (0 = chord root in the base octave) -> MIDI note */
function degToNote(c: Chord, home: number, d: number, baseOct: number): number {
  const sc = poolOf(c).scale, n = sc.length
  return baseOct + mod(home + c.root, 12) + 12 * Math.floor(d / n) + sc[mod(d, n)]
}
/** nearest scale degree of a MIDI note in this chord's pool */
function noteToDeg(c: Chord, home: number, note: number, baseOct: number): number {
  const sc = poolOf(c).scale, n = sc.length
  let best = 0, bd = 1e9
  const o0 = Math.floor((note - baseOct) / 12)
  for (let o = o0 - 1; o <= o0 + 1; o++) for (let k = 0; k < n; k++) {
    const d = o * n + k, dist = Math.abs(degToNote(c, home, d, baseOct) - note)
    if (dist < bd) { bd = dist; best = d }
  }
  return best
}

// ---------- phrase generation ----------
export interface CallNote { note: number; t?: number; dur?: number }
export interface AnswerOpts { seed: number; key: Key; /** which bar of the progression the answer starts on */ bar?: number; /** answer index (balanced cadences) */ index?: number }
export interface Answer { events: Ev[]; beats: number; label: string; devs: string[]; chordBar: number; home: number }

const swingT = (st: StyleDef, t: number) => {
  const u = st.feel.swingUnit, p = 2 * u
  const k = Math.floor(t / p + 1e-9), f = t - k * p
  if (Math.abs(f - u) < 1e-6) return k * p + p * st.feel.swing / (1 + st.feel.swing)
  return t
}

function developCell(m: number[], dev: Dev, r: Rng): number[] {
  switch (dev) {
    case 'invert': return m.map((x) => -x)
    case 'retro': return [...m].reverse()
    case 'fragment': return m.slice(0, Math.max(2, Math.ceil(m.length / 2)))
    case 'sequence': { const sh = [1, 2, -1, -2][Math.floor(r() * 4)]; return m.map((x) => x + sh) }
    default: return m
  }
}

function buildAnswer(st: StyleDef, call: CallNote[], o: AnswerOpts): Answer {
  const r = mulberry32(o.seed)
  const home = homeOf(st, o.key)
  const f = st.feel
  const bar0 = o.bar ?? 0
  const BASE = 12 * 5 // octave-4 anchored base; actual register is placed by range
  const centre = Math.round((st.range[0] + st.range[1]) / 2)
  const bpb = st.bpb
  // 1. the motif: the call's contour as scale-degree steps (same contour, transformed later)
  const c0 = chordAt(st, bar0)
  let pitches = call.map((c) => c.note).slice(0, 8)
  if (pitches.length === 0) {
    const d0 = noteToDeg(c0, home, centre, BASE)
    pitches = [degToNote(c0, home, d0, BASE)]
    let d = d0
    for (let i = 0; i < 3; i++) { d += Math.floor(r() * 3) - 1 || 1; pitches.push(degToNote(c0, home, d, BASE)) }
  }
  const degs = pitches.map((p) => noteToDeg(c0, home, p, BASE))
  const m = degs.map((d) => d - degs[0])
  // 2. rhythm: onsets with durations on the style's grid
  const len = pick(r, st.lens)
  type Slot = { t: number; dur: number }
  const slots: Slot[] = []
  let t = 0
  // cool / sparse styles start a little late: a breath before the answer
  if (f.rest > 0.3) t = r() < 0.5 ? f.grid * 2 : 0
  const p0 = f.density * f.grid
  let justRested = false
  while (t < len - 1e-6) {
    if (slots.length > 0 && !justRested && r() < f.rest) { t += pick(r, f.rest > 0.3 ? [[1, 0.4], [1.5, 0.3], [2, 0.3]] : [[f.grid, 0.4], [f.grid * 2, 0.4], [f.grid * 4, 0.2]]); justRested = true; continue }
    justRested = false
    let dur = pick(r, f.durs)
    // a fast-density style crowds notes with probability so density is respected
    if (dur < 1 && r() > Math.min(1, p0 * 2.2) && f.density < 1.2) dur = Math.max(dur, 1)
    dur = Math.min(dur, len - t)
    if (dur < f.grid - 1e-6) break
    let ts = t
    if (f.sync > 0 && ts > 0 && Math.abs(ts - Math.round(ts)) < 1e-6 && r() < f.sync && ts - f.grid > (slots[slots.length - 1]?.t ?? -1) + (slots[slots.length - 1]?.dur ?? 0) - 1e-6 + 0) ts -= f.grid
    slots.push({ t: ts, dur: dur + (t - ts) })
    t += dur
  }
  // an answer to a phrase always has at least 3 notes (sparse styles used to answer a 4-note call with just 2)
  if (slots.length < 3) {
    let nt = slots.length ? Math.ceil(slots[slots.length - 1].t + slots[slots.length - 1].dur - 1e-6) : 0
    while (slots.length < 3) { if (nt > len - 1) nt = Math.max(0, len - 1 - (3 - slots.length)); slots.push({ t: nt, dur: 1 }); nt += 1 }
    slots.sort((x, y) => x.t - y.t)
  }
  const N = slots.length
  // 3. pitch material by development habits
  const devsUsed: string[] = []
  const degSeq: number[] = []
  let part = 0
  const additive = st.devs.length === 1 && st.devs[0][0] === 'additive'
  let shiftTotal = 0
  while (degSeq.length < N) {
    let cell: number[]
    if (additive) { cell = m.slice(0, Math.min(m.length, 2 + part)); devsUsed.push('additive') }
    else if (part === 0) { cell = m; devsUsed.push('restate') }
    else { const dv = pick(r, st.devs); cell = developCell(m, dv, r); devsUsed.push(dv); if (dv === 'sequence') shiftTotal += cell[0] - m[0] }
    // each part starts from the previous part's end, pulled back toward the register centre
    const start = degSeq.length ? degSeq[degSeq.length - 1] + (r() < 0.5 ? -1 : 1) : noteToDeg(c0, home, centre, BASE) + Math.round((r() - 0.5) * 2)
    for (const x of cell) degSeq.push(start + x - (cell[0] === m[0] ? 0 : 0))
    part++
    if (part > 12) break
  }
  void shiftTotal
  degSeq.length = N
  // 4. pitches over the chord of each slot; chord-tone pulls; range folding
  const evs: Ev[] = []
  const sw = (x: number) => swingT(st, x)
  const evBlue = new Set<number>()
  for (let i = 0; i < N; i++) {
    const s = slots[i]
    const bar = bar0 + Math.floor(s.t / bpb)
    const c = chordAt(st, bar)
    const pool = poolOf(c)
    let d = degSeq[i]
    let note = degToNote(c, home, d, BASE)
    // fold into range
    while (note > st.range[1]) { note -= 12; d -= pool.scale.length }
    while (note < st.range[0]) { note += 12; d += pool.scale.length }
    degSeq[i] = d
    const strong = Math.abs(s.t - Math.round(s.t)) < 1e-6 && Math.round(s.t) % 2 === 0
    const last = i === N - 1
    if ((strong && r() < st.ctSnap) || (last)) {
      // nearest chord tone
      let bestN = note, bd = 1e9
      for (const tn of pool.tones) for (let o = -2; o <= 2; o++) {
        const cand = mod(home + c.root + tn, 12) + 12 * (Math.floor(note / 12) + o)
        if (cand >= st.range[0] && cand <= st.range[1] && Math.abs(cand - note) < bd) { bd = Math.abs(cand - note); bestN = cand }
      }
      note = bestN
    }
    // cadence: end on the home note / a stable tone
    if (last) {
      const wantTonic = st.cadence === 'tonic' || (st.cadence === 'balanced' && (o.index ?? 0) % 2 === 1)
      const lc = chordAt(st, bar)
      const target = wantTonic ? mod(home + lc.root, 12) : mod(home + lc.root + (pool.tones[2] ?? 7), 12)
      let bestN = note, bd = 1e9
      for (let oct = Math.floor(st.range[0] / 12); oct <= Math.floor(st.range[1] / 12); oct++) {
        const cand = target + 12 * oct
        if (cand >= st.range[0] && cand <= st.range[1] && Math.abs(cand - note) < bd) { bd = Math.abs(cand - note); bestN = cand }
      }
      note = bestN
    }
    // blue-note substitution (3rd / 7th flattened) with a scoop
    let bend: number | undefined, kind: Ev['kind'] = 'main'
    if (st.orn.blue > 0 && st.blues.length && r() < st.orn.blue && !last) {
      const rel = mod(note - home - c.root, 12)
      if ((rel === 4 || rel === 11 || rel === 3 || rel === 10 || rel === 7 || rel === 5) && st.blues.length) {
        const b = st.blues[Math.floor(r() * st.blues.length)]
        const cand = note - rel + b
        if (cand >= st.range[0] && cand <= st.range[1]) {
          // a 3rd-ish note becomes the flat 3rd, a 7th-ish note the flat 7th, a 4th/5th the flat 5th
          const near = (rel === 4 || rel === 3 || rel === 5) ? [3, 6].includes(b) : (rel === 11 || rel === 10 || rel === 7) ? [10, 6].includes(b) : false
          if (near) { note = cand; bend = -100; kind = 'blue'; evBlue.add(i) }
        }
      }
    }
    evs.push({ t: s.t, dur: s.dur * f.legato, note, vel: 80, bend, kind })
  }
  // 5. chromatic approach notes / enclosures (bebop habit): neighbours one grid step before a strong-beat target
  const out: Ev[] = []
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i], prev = out[out.length - 1]
    const onBeat = Math.abs(e.t - Math.round(e.t)) < 1e-6
    if (onBeat && prev && prev.kind === 'main' && Math.abs((e.t - f.grid) - prev.t) < 1e-6 && r() < st.orn.approach) {
      const below = r() < 0.6
      prev.note = e.note + (below ? -1 : 1); prev.kind = 'approach'
      // enclosure: the note before the approach comes from the other side, diatonically
      const pp = out[out.length - 2]
      if (pp && pp.kind === 'main' && Math.abs((prev.t - f.grid) - pp.t) < 1e-6 && r() < st.orn.enclosure) { pp.note = e.note + (below ? 2 : -2); pp.kind = 'approach' }
    }
    out.push({ ...e })
  }
  // 6. ornaments on long notes: trill, turn, grace
  const fin: Ev[] = []
  for (const e of out) {
    const c = chordAt(st, bar0 + Math.floor(e.t / bpb)), sc = poolOf(c).scale
    const upper = (() => { const k = sc.findIndex((x) => mod(home + c.root + x, 12) === mod(e.note, 12)); return k < 0 ? e.note + 2 : e.note + (sc[(k + 1) % sc.length] - sc[k] + 12) % 12 })()
    if (e.kind === 'main' && e.dur >= 1 && r() < st.orn.trill) {
      const step = 0.125, cnt = Math.min(6, Math.floor((e.dur * 0.7) / step))
      for (let k = 0; k < cnt; k++) fin.push({ t: e.t + k * step, dur: step * 0.9, note: k % 2 === 0 ? e.note : upper, vel: e.vel - 8, kind: 'trill' })
      fin.push({ ...e, t: e.t + cnt * step, dur: e.dur - cnt * step })
    } else if (e.kind === 'main' && e.dur >= 0.75 && r() < st.orn.turn) {
      const lower = e.note - 2
      const g = 0.125
      for (const [k, nn] of [upper, e.note, lower].entries()) fin.push({ t: e.t + k * g, dur: g * 0.95, note: nn, vel: e.vel - 6, kind: 'turn' })
      fin.push({ ...e, t: e.t + 3 * g, dur: e.dur - 3 * g })
    } else if ((e.kind === 'main' || e.kind === 'blue') && e.dur >= 0.5 && e.t > 0 && r() < st.orn.grace) {
      const g = 0.0625 * 2
      // grace from a semitone below (jazz/blues/gospel slide) or the upper neighbour (classical appoggiatura)
      const jazz = st.kind === 'style' || st.id === 'gershwin' || st.id === 'joplin'
      fin.push({ t: e.t, dur: g, note: jazz ? e.note - 1 : upper, vel: e.vel - 10, kind: 'grace' })
      fin.push({ ...e, t: e.t + g, dur: e.dur - g })
    } else fin.push(e)
  }
  // 7. swing, rubato, dynamics, range clamp
  const L = Math.max(...fin.map((e) => e.t + e.dur), len)
  fin.sort((a, b) => a.t - b.t)
  const n = fin.length
  fin.forEach((e, i) => {
    const t0 = sw(e.t), t1 = sw(e.t + e.dur)
    e.t = t0; e.dur = Math.max(0.06, t1 - t0)
    if (st.rubato > 0) e.t += st.rubato * Math.sin((e.t / L) * Math.PI * 2) * (1 - Math.abs(2 * (e.t / L) - 1) * 0.3)
    const pos = i / Math.max(1, n - 1), on = Math.abs(e.t - Math.round(e.t)) < 0.02
    const [lo, hi] = st.vel
    let v = lo + (hi - lo) * 0.5
    switch (st.dyn) {
      case 'flat': v = lo + (hi - lo) * (0.4 + r() * 0.2); break
      case 'swell': v = lo + (hi - lo) * Math.sin(pos * Math.PI) ; break
      case 'arch': v = lo + (hi - lo) * (0.35 + 0.65 * Math.sin(pos * Math.PI)); break
      case 'terraced': v = pos < 0.5 ? hi : lo + (hi - lo) * 0.6; break
      case 'accent': v = on ? lo + (hi - lo) * (0.7 + r() * 0.3) : lo + (hi - lo) * (0.1 + r() * 0.3); break
    }
    if (e.kind === 'grace' || e.kind === 'trill' || e.kind === 'turn') v -= 8
    e.vel = Math.round(Math.max(24, Math.min(110, v)))
    e.note = Math.max(st.range[0] - 1, Math.min(st.range[1] + 1, e.note))
  })
  // rubato must stay in order
  for (let i = 1; i < fin.length; i++) if (fin[i].t < fin[i - 1].t) fin[i].t = fin[i - 1].t + 0.001
  // the last note rings a bit longer (a cadence)
  const lastE = fin[fin.length - 1]
  if (lastE) lastE.dur = Math.max(lastE.dur, Math.min(st.feel.rest > 0.3 ? 1.5 : 2, len - lastE.t + 0.5))
  const label = st.name + (devsUsed.length > 1 ? ' · ' + [...new Set(devsUsed)].join(' + ') : '')
  return { events: fin, beats: Math.max(...fin.map((e) => e.t + e.dur)), label, devs: devsUsed, chordBar: bar0, home }
}

// Originality guard: a generated phrase must not contain a 6-note interval n-gram that appears in the songs library.
// Pure stepwise / repeated-note grams (scale runs) are generic building blocks, not melodies, and are exempt.
let songGrams: Set<string> | null = null
const nontrivial = (g: string) => { const a = g.split(',').map(Number); return a.some((x) => Math.abs(x) >= 3) && new Set(a).size > 2 }
function gramsOfSongs(): Set<string> {
  if (songGrams) return songGrams
  songGrams = new Set()
  for (const s of SONGS) for (const g of intervalGrams(s.notes.filter((n) => n.note != null).map((n) => n.note as number), 5)) if (nontrivial(g)) songGrams.add(g)
  return songGrams
}
/** true when the melody of these events copies a song n-gram (exported for tests) */
export function copiesSong(events: Ev[]): boolean {
  const g = gramsOfSongs()
  const ns = events.filter((e) => e.kind === 'main' || e.kind === 'blue' || e.kind === 'approach').sort((a, b) => a.t - b.t).map((e) => e.note)
  for (const x of intervalGrams(ns, 5)) if (nontrivial(x) && g.has(x)) return true
  return false
}
/** Build an answer to the player's call, in the style's habits. Pure and deterministic for a given seed.
 *  Re-rolls (deterministically) if the result would echo a known song. */
export function makeAnswer(st: StyleDef, call: CallNote[], o: AnswerOpts): Answer {
  let a = buildAnswer(st, call, o)
  for (let k = 1; k <= 14 && copiesSong(a.events); k++) a = buildAnswer(st, call, { ...o, seed: o.seed + k * 7919 })
  return a
}

// ---------- backing (bass + comping), one bar at a time ----------
export function backingBar(st: StyleDef, key: Key, bar: number, seed = 1): Ev[] {
  const r = mulberry32(seed * 7919 + bar)
  const home = homeOf(st, key), c = chordAt(st, bar), q = poolOf(c)
  const rootPc = mod(home + c.root, 12)
  const bassRoot = 36 + mod(rootPc - 36, 12) // C2..B2
  const mid = 12 * 5 + 0
  const tonesAt = (base: number) => q.tones.map((x) => base + mod(rootPc + x - base, 12))
  const triad = tonesAt(mid - 5).slice(0, 4)
  const e: Ev[] = []
  const B = (t: number, n: number, d: number, v = 70) => e.push({ t, dur: d, note: n, vel: v, kind: 'bass' })
  const C = (t: number, ns: number[], d: number, v = 52) => ns.forEach((n) => e.push({ t, dur: d, note: n, vel: v, kind: 'chord' }))
  const fifth = bassRoot + 7, third = bassRoot + (q.tones[1] ?? 4)
  switch (st.comp) {
    case 'walk': { // quarter-note walking bass: root, chord tone, scale tone, approach to the next root
      const nextRoot = mod(home + chordAt(st, bar + 1).root, 12)
      const nb = 36 + mod(nextRoot - 36, 12)
      const steps = [bassRoot, bassRoot + q.tones[1], bassRoot + q.tones[2], nb + (r() < 0.5 ? -1 : 1)]
      steps.forEach((n, i) => B(i, n, 0.9, i === 0 ? 76 : 62))
      if (st.id === 'bach') C(0, [triad[0], triad[2]], 2, 36)
      break }
    case 'sparse': B(0, bassRoot, 1.8, 66); B(2, r() < 0.5 ? fifth : third, 1.8, 58); if (r() < 0.6) C(1.5, [triad[1], triad[3] ?? triad[2]], 1.2, 40); break
    case 'alberti': { const [a, b, cc] = [triad[0], triad[1], triad[2]]; [a, cc, b, cc, a, cc, b, cc].forEach((n, i) => B(i * 0.5, n - 12 + 0, 0.45, 50)); break }
    case 'roll': B(0, bassRoot, 1.4, 62); for (const [i, n] of [triad[1], triad[2], triad[0] + 12].entries()) B(1 + i * 0.66, n, 0.7, 46); if (bpbOf(st) === 3) { /* waltz */ } break
    case 'oompah': B(0, bassRoot, 0.9, 74); C(1, triad.slice(0, 3), 0.8, 52); B(2, fifth, 0.9, 70); C(3, triad.slice(0, 3), 0.8, 52); break
    case 'boogie': [0, 4, 7, 9, 10, 9, 7, 4].forEach((x, i) => B(i * 0.5, bassRoot + x, 0.45, i % 2 === 0 ? 74 : 60)); break
    case 'funk': [0, 0.75, 1.5, 2.25, 3.0, 3.5].forEach((t, i) => B(t, bassRoot + (i === 3 ? 7 : i === 5 ? 10 : 0), 0.22, t === 0 ? 86 : 64)); C(1.25, triad.slice(0, 3), 0.18, 50); C(2.75, triad.slice(0, 3), 0.18, 50); break
    case 'pulse': for (let i = 0; i < 8; i++) B(i * 0.5, [triad[0], triad[1], triad[2], triad[1]][i % 4], 0.4, 44); B(0, bassRoot, 3.8, 56); break
    case 'arps': for (let i = 0; i < 16; i++) B(i * 0.25, [triad[0], triad[1], triad[2], triad[1] + 12][i % 4], 0.22, 40); B(0, bassRoot, 1.9, 66); B(2, bassRoot, 1.9, 62); break
    case 'gospel': C(0, triad.slice(0, 4), 1.8, 54); B(0, bassRoot, 1.8, 70); C(2, triad.slice(0, 4), 1.6, 50); B(2, fifth, 1.6, 62); B(3.5, bassRoot + 2, 0.4, 52); break
    case 'bossa': B(0, bassRoot, 1.4, 70); B(1.5, fifth, 1.4, 62); B(2, bassRoot, 1.4, 66); B(3.5, fifth, 0.5, 58); C(0, triad.slice(1, 4), 0.8, 42); C(1.5, triad.slice(1, 4), 0.8, 42); C(3, triad.slice(1, 4), 0.8, 42); break
    case 'five': { // 5/4 felt as 3 + 2: bass on 1 and 4, chord stabs on 1, 3 and 4
      B(0, bassRoot, 2.4, 72); B(3, r() < 0.5 ? fifth : bassRoot, 1.8, 62); C(0, triad.slice(0, 3), 0.6, 44); C(3, triad.slice(0, 3), 0.6, 46); if (r() < 0.5) C(1.5, triad.slice(1, 4), 0.4, 36); break }
    case 'satie': B(0, bassRoot - 0, 1.5, 48); C(1, triad.slice(0, 3), 1.8, 34); break
    case 'planing': { const stp = [0, 2, 4, 2][mod(bar, 4)]; C(0, [triad[0] + stp, triad[1] + stp, triad[2] + stp], 3.6, 34); B(0, bassRoot + stp, 3.6, 46); break }
  }
  return e
}
const bpbOf = (st: StyleDef) => st.bpb

// ---------- restyling the player's own notes (Style filter) ----------
export interface Extra { after: number; dur: number; note: number; vel: number; kind: Ev['kind'] }
/** Extra styled voices to ADD around the player's note. The player's own note is never delayed or changed: all extras are
 *  either simultaneous (harmony) or later (ornament, swing echo). `after` is in seconds. */
export function filterExtras(st: StyleDef, key: Key, note: number, vel: number, bar: number, seed: number): { snapped: number; extras: Extra[] } {
  const r = mulberry32(seed)
  const home = homeOf(st, key), c = chordAt(st, bar), pool = poolOf(c)
  const pcs = chordPcs(st, home, c)
  let snapped = note
  if (!pcs.has(mod(note, 12))) for (const dlt of [-1, 1, -2, 2]) if (pcs.has(mod(note + dlt, 12))) { snapped = note + dlt; break }
  const BASE = 60
  const d = noteToDeg(c, home, snapped, BASE)
  const beat = 60 / st.bpm
  const extras: Extra[] = []
  const v = Math.round(vel * 0.5)
  // diatonic harmony a third below (simultaneous, quiet) - snapped to the style's scale
  if (st.kind === 'pd' || r() < 0.7) extras.push({ after: 0, dur: beat * 1.2, note: degToNote(c, home, d - 2, BASE), vel: v, kind: 'chord' })
  // swing echo on the next swung off-beat: a soft octave-up repeat
  const u = st.feel.swingUnit
  const echoAt = beat * (u * 2 * st.feel.swing / (1 + st.feel.swing))
  if (st.feel.swing > 1.2 && r() < 0.6) extras.push({ after: echoAt, dur: beat * 0.4, note: Math.min(100, snapped + 12), vel: Math.round(vel * 0.3), kind: 'grace' })
  // ornament flourish a hair later
  if (r() < st.orn.grace + st.orn.turn + st.orn.trill) {
    const up = degToNote(c, home, d + 1, BASE)
    extras.push({ after: 0.09, dur: 0.08, note: up, vel: Math.round(vel * 0.35), kind: 'grace' })
    extras.push({ after: 0.18, dur: 0.12, note: snapped, vel: Math.round(vel * 0.3), kind: 'grace' })
  }
  return { snapped, extras }
}

// ---------- PD quotes (only styles with kind 'pd' and quotes[]) ----------
export interface Quote { events: Ev[]; beats: number; credit: string }
export function quoteFor(st: StyleDef, key: Key, which: number): Quote | null {
  if (st.kind !== 'pd' || !st.quotes?.length) return null
  const id = st.quotes[mod(which, st.quotes.length)]
  const song = SONGS.find((s) => s.id === id)
  if (!song) return null
  const evs: Ev[] = []
  let t = 0
  const shift = (() => { // transpose into the player's key (nearest octave shift to the song's tonic)
    const dlt = mod(homeOfSong(song.key) , 12)
    void dlt
    let s = mod(key.tonic - song.key.tonic, 12); if (s > 6) s -= 12
    return s
  })()
  for (const n of song.notes) {
    if (t >= 8) break
    if (n.note != null) evs.push({ t, dur: n.beats * 0.92, note: n.note + shift, vel: 78, kind: 'quote' })
    t += n.beats
  }
  const scale = st.bpm / (song.bpm || st.bpm) // keep the quote at its own tempo; durations are in song beats scaled to style beats
  evs.forEach((e) => { e.t *= scale; e.dur *= scale })
  return { events: evs, beats: t * scale, credit: `${song.origin}, ${song.title} (${song.year})` }
}
const homeOfSong = (k: Key) => k.tonic

// ---------- trait detection (simple detectors over the player's notes) ----------
export interface PlayedNote { note: number; t: number; dur: number }  // seconds
export interface TraitResult { id: string; label: string; hint: string; ok: boolean }
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
export function silenceFraction(ns: PlayedNote[]): number {
  if (ns.length < 2) return 0
  const s = [...ns].sort((a, b) => a.t - b.t)
  const t0 = s[0].t, t1 = Math.max(...s.map((n) => n.t + n.dur))
  const span = t1 - t0
  if (span <= 0) return 0
  let covered = 0, end = t0
  for (const n of s) { const a = Math.max(n.t, end), b = n.t + n.dur; if (b > a) { covered += b - a; end = b } }
  return Math.max(0, 1 - covered / span)
}
const iois = (s: PlayedNote[]) => s.slice(1).map((n, i) => n.t - s[i].t).filter((x) => x > 0.03)
const DET: Record<string, (s: PlayedNote[], home: number) => boolean> = {
  ...PEOPLE_DET,
  space: (s) => silenceFraction(s) >= 0.3 || iois(s).filter((x) => x >= 0.9).length >= 2 || s.slice(1).some((n, i) => n.t - (s[i].t + s[i].dur) >= 0.7),
  longNotes: (s) => s.filter((n) => n.dur >= 0.7).length >= 2 || (s.length >= 3 && median(s.map((n) => n.dur)) >= 0.5),
  dorian: (s, h) => { const p = new Set(s.map((n) => mod(n.note - h, 12))); return p.has(3) && p.has(10) },
  blue: (s, h) => { const p = new Set(s.map((n) => mod(n.note - h, 12))); return [3, 6, 10].filter((x) => p.has(x)).length >= (p.has(3) && p.has(10) ? 2 : 1) && (p.has(3) || p.has(6)) },
  fast: (s) => { let run = 0, best = 0; for (const x of iois(s)) { if (x <= 0.32) { run++; best = Math.max(best, run) } else run = 0 } return best >= 5 },
  chrom: (s) => { let c = 0; for (let i = 1; i < s.length; i++) if (Math.abs(s[i].note - s[i - 1].note) === 1) c++; return c >= 2 },
  swing: (s) => { const x = iois(s); let c = 0; for (let i = 1; i < x.length; i++) { const q = x[i - 1] / x[i]; if (q >= 1.4 && q <= 3.4 && x[i - 1] < 0.9) c++ } return c >= 2 },
  sync: (s) => { const x = iois(s); let c = 0; for (let i = 1; i < x.length; i++) if (x[i] >= x[i - 1] * 1.6 && x[i - 1] <= 0.45 && (i + 1 >= x.length || x[i + 1] <= x[i] * 0.7)) c++; return c >= 2 },
  repeat: (s) => { const iv = s.slice(1).map((n, i) => n.note - s[i].note); for (let L = 2; L <= 5; L++) for (let i = 0; i + 2 * L <= iv.length; i++) { let same = true; for (let k = 0; k < L; k++) if (iv[i + k] !== iv[i + L + k]) same = false; if (same && iv.slice(i, i + L).some((x) => x !== 0)) return true } return false },
  pent: (s) => s.length >= 6 && new Set(s.map((n) => mod(n.note, 12))).size <= 5,
  whole: (s) => { if (s.length < 5) return false; const p = new Set(s.map((n) => mod(n.note, 12))); if (p.size < 4) return false; const base = [...p][0] % 2; return [...p].every((x) => x % 2 === base) },
  arp: (s) => { let run = 0; let dir = 0; for (let i = 1; i < s.length; i++) { const d = s[i].note - s[i - 1].note, ad = Math.abs(d); if (ad >= 3 && ad <= 5 && (dir === 0 || Math.sign(d) === dir)) { run++; dir = Math.sign(d) } else { run = 0; dir = 0 } if (run >= 3) return true } return false },
  run: (s) => { let run = 1, dir = 0; for (let i = 1; i < s.length; i++) { const d = s[i].note - s[i - 1].note, ad = Math.abs(d); if (ad >= 1 && ad <= 2 && (dir === 0 || Math.sign(d) === dir)) { run++; dir = Math.sign(d) } else { run = 1; dir = 0 } if (run >= 5) return true } return false },
  slow: (s) => s.length >= 3 && s.length <= 12 && median(iois(s)) >= 0.6,
  ornament: (s) => iois(s).some((x) => x <= 0.13) && s.length >= 3,
  pulse: (s) => { const x = iois(s); if (x.length < 5) return false; const m = x.reduce((a, b) => a + b, 0) / x.length; const sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length); return sd / m < 0.2 },
  steady: (s) => { const x = iois(s); if (x.length < 4) return false; const m = x.reduce((a, b) => a + b, 0) / x.length; const sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length); return sd / m < 0.28 },
  steps: (s) => { const x = iois(s); if (x.length < 4) return false; const m = x.reduce((a, b) => a + b, 0) / x.length; const sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length); return sd / m < 0.3 },
  tidy: (s) => DET.steady(s, 0),
  rubato: (s) => { const x = iois(s); if (x.length < 5) return false; const h = Math.floor(x.length / 2); const a = x.slice(0, h).reduce((p, q) => p + q, 0) / h, b = x.slice(h).reduce((p, q) => p + q, 0) / (x.length - h); return Math.max(a, b) / Math.min(a, b) >= 1.25 },
  stepwise: (s) => { const iv = s.slice(1).map((n, i) => n.note - s[i].note); return iv.length >= 6 && DET.repeat(s, 0) && iv.filter((x) => Math.abs(x) <= 2).length >= iv.length * 0.6 },
  callresp: (s) => { const g = s.slice(1).map((n, i) => n.t - (s[i].t + s[i].dur)); return g.some((x) => x >= 0.5) && s.length >= 4 },
  chords: (s) => { let groups = 0; const t = [...s].sort((a, b) => a.t - b.t); for (let i = 0; i + 2 < t.length; i++) if (t[i + 2].t - t[i].t <= 0.08) { groups++; i += 2 } return groups >= 2 },
  onefourfive: (s, h) => { const rel = s.map((n) => mod(n.note - h, 12)); let stage = 0; for (const x of rel) { if (stage === 0 && x === 0) stage = 1; else if (stage === 1 && x === 5) stage = 2; else if (stage === 2 && x === 7) return true } return false },
}
/** Grade a stretch of the player's playing against a style's three traits. */
export function detectTraits(st: StyleDef, played: PlayedNote[], key: Key): TraitResult[] {
  const home = homeOf(st, key)
  const s = [...played].sort((a, b) => a.t - b.t)
  return st.traits.map((tr) => ({ ...tr, ok: (DET[tr.id] ?? (() => false))(s, home) }))
}
export const TRAIT_DETECTORS = Object.keys(DET)

// ---------- originality ----------
/** interval n-grams of a note list (for the originality test against SONGS) */
export function intervalGrams(notes: number[], n = 6): Set<string> {
  const out = new Set<string>()
  const iv = notes.slice(1).map((x, i) => x - notes[i])
  for (let i = 0; i + n <= iv.length; i++) out.add(iv.slice(i, i + n).join(','))
  return out
}
