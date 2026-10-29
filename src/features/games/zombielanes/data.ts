// Zombie Lanes: levels, lessons, chords, save format. Pure data and helpers, no module-level state.
import { PC_NAMES, pc } from '../../../music/theory'
import { SONGS } from '../../songs/songs'
import { pload, psave } from '../../../profile/profile'

export type Mode = 'easy' | 'normal'
export type Phase = 'menu' | 'card' | 'play' | 'over'

export interface LevelDef {
  wave: number
  title: string
  /** one-line mini lesson shown on the wave card */
  lesson: string
  tip?: string
  pool: number[]
  /** sign shows sharps and flats (some zombies are black keys) */
  accidentals: boolean
  hideNames: boolean
  count: number
  /** seconds between spawns */
  interval: number
  /** seconds for a zombie to walk the whole lane (Easy) */
  travel: number
  /** every Nth zombie is a crowned chord zombie */
  chordEvery?: number
  boss?: boolean
  /** light the nearest zombie's key on the keybed (training wheels) */
  guide: boolean
}

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
const WHITE = new Set([0, 2, 4, 5, 7, 9, 11])
const whites = (lo: number, hi: number) => range(lo, hi).filter((n) => WHITE.has(pc(n)))

export const LEVELS: LevelDef[] = [
  { wave: 1, title: 'White keys', lesson: 'White keys go C D E F G A B, then repeat. C sits just left of the two black keys.',
    pool: whites(60, 71), accidentals: false, hideNames: false, count: 8, interval: 3.6, travel: 16, guide: true },
  { wave: 2, title: 'Two octaves', lesson: 'The pattern repeats all the way up. Same letter, higher sound: C D E F G A B, C D E F G A B.',
    pool: whites(60, 83), accidentals: false, hideNames: false, count: 10, interval: 3.1, travel: 14, guide: true },
  { wave: 3, title: 'Sharps and flats', lesson: 'A sharp (♯) is the black key just to the right. A flat (♭) is the black key just to the left.',
    pool: range(60, 83), accidentals: true, hideNames: false, count: 12, interval: 2.8, travel: 13, guide: false },
  { wave: 4, title: 'No names, plus chords', lesson: 'No names this time! Find each note by where it sits in the key pattern.',
    tip: 'Crown zombies are chords: play all 3 notes together. C = C E G, F = F A C, G = G B D.',
    pool: range(60, 83), accidentals: true, hideNames: true, count: 12, interval: 2.9, travel: 13, chordEvery: 4, guide: false },
  { wave: 5, title: 'Zombie King', lesson: 'Boss time! Play Ode to Joy one note at a time. Each right note hits the King.',
    tip: 'The sign shows what to play next: E E F G G F E D C C D E E D D. A BOOM slam skips ahead!',
    pool: [], accidentals: false, hideNames: false, count: 1, interval: 0, travel: 80, boss: true, guide: false },
]

export interface Chord { name: string; tones: number[] }
export const CHORDS: Chord[] = [
  { name: 'C', tones: [60, 64, 67] },
  { name: 'F', tones: [65, 69, 72] },
  { name: 'G', tones: [67, 71, 74] },
]
/** how long (ms) you have to play all 3 chord tones */
export const CHORD_WINDOW = 400

/** Ode to Joy (public domain), taken from the song book so the boss plays the same tune the Songs screen teaches. */
export function odeMelody(): number[] {
  const s = SONGS.find((x) => x.id === 'ode')
  const m = s ? s.notes.filter((n) => n.note != null).map((n) => n.note as number) : []
  return m.length ? m : [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62]
}

const SHARP = PC_NAMES
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
/** "C", "F♯" (sharp) or "G♭" (flat). `flat` only matters for black keys. */
export function noteLabel(note: number, flat = false): string {
  const p = pc(note)
  return flat ? FLAT[p] : SHARP[p].replace('#', '♯')
}
export const isBlackKey = (n: number) => !WHITE.has(pc(n))

// ---- saved progress (per kid, via the profile) ----
export interface Save {
  best: Record<Mode, number>
  /** highest wave unlocked per mode */
  wave: Record<Mode, number>
  mode: Mode
}
const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)
export function loadSave(): Save {
  const r = pload<Partial<Save>>('zombielanes', {}) ?? {}
  return {
    best: { easy: num(r.best?.easy, 0, 0, 1e9), normal: num(r.best?.normal, 0, 0, 1e9) },
    wave: { easy: Math.round(num(r.wave?.easy, 1, 1, 5)), normal: Math.round(num(r.wave?.normal, 1, 1, 5)) },
    mode: r.mode === 'normal' ? 'normal' : 'easy',
  }
}
export function writeSave(s: Save) { psave('zombielanes', s) }

export interface Snapshot {
  phase: Phase
  mode: Mode
  wave: number
  score: number
  lives: number
  combo: number
  left: number
  jam: boolean
  bossHp: number
  bossMax: number
  stars: number
  won: boolean
  newBest: boolean
  cleared: number
  save: Save
  bonusBrain: boolean
}
export const MAX_LIVES = 3
