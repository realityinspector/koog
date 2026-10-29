// Jiu-Jitsu Flow: belts, the position ladder, phrase making, lessons and the save format.
// Pure data and helpers, no module-level state.
import { SONGS, type Song } from '../../songs/songs'
import { pload, psave } from '../../../profile/profile'

export type Phase = 'menu' | 'bow' | 'call' | 'echo' | 'move' | 'sub' | 'lesson' | 'promo' | 'flow' | 'flowend'

export const BELTS = [
  { id: 'white', name: 'White', color: '#f4f4f0' },
  { id: 'blue', name: 'Blue', color: '#2d72e0' },
  { id: 'purple', name: 'Purple', color: '#8447c9' },
  { id: 'brown', name: 'Brown', color: '#8a5429' },
  { id: 'black', name: 'Black', color: '#1b1b1f' },
] as const

/** The ladder of positions. Rung 0 is standing, the last rung is the submission. */
export const RUNGS = ['Standing', 'Guard', 'Side control', 'Knee on belly', 'Mount', 'Back control', 'Submission']
/** STEPS[i] moves you from rung i to rung i+1, and scores IBJJF-style points. */
export const STEPS = [
  { name: 'Takedown', pts: 2 },
  { name: 'Guard pass', pts: 3 },
  { name: 'Knee on belly', pts: 2 },
  { name: 'Mount', pts: 4 },
  { name: 'Back control', pts: 4 },
  { name: 'Smooth finish', pts: 0 },
]
export const LAST_RUNG = RUNGS.length - 1

export const LESSONS = [
  "In jiu-jitsu you tap to say 'you got me', and your partner lets go right away. Tap early, tap often.",
  'Technique beats strength. A smaller person who knows the moves can stay in control of a bigger one.',
  'We bow to our partner before and after every roll. Respect comes first.',
  'Your partner is not your enemy. You are helping each other learn.',
  'Stay calm and breathe. Smooth hands win positions; rushed hands make mistakes.',
  'Control means being gentle and in charge. A good grappler keeps their partner safe.',
  'Everyone starts as a white belt, even the best in the world. Keep showing up.',
  'Losing a position is just learning. Reset, breathe and try again.',
]

export const TECHNIQUES = ['Hip escape', 'Knee slice', 'Arm drag', 'Smooth sweep', 'Pressure pass', 'Scissor sweep', 'Shoulder walk', 'Balance break', 'Frame and shrimp', 'Guard retention']

export const level = (belt: number, stripes: number) => belt * 4 + stripes

export interface Phrase { notes: number[]; beats: number[]; ioi: number }

const SCALE = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76]
const PENTA = [60, 62, 64, 67, 69, 72, 74, 76]

/** Phrases get longer, faster and more chromatic as the level L (0..19) rises. */
export function makePhrase(L: number, rnd: () => number = Math.random): Phrase {
  const len = Math.min(6, 2 + Math.floor((L * 4) / 19))
  const pool = L < 4 ? PENTA : SCALE
  const chrom = Math.min(0.5, Math.max(0, (L - 7) * 0.06))
  const leapMax = L < 4 ? 2 : L < 8 ? 3 : 5
  let ix = Math.floor(rnd() * Math.min(pool.length, 6))
  const notes: number[] = []
  for (let i = 0; i < len; i++) {
    let n = pool[ix]
    if (i > 0 && rnd() < chrom) n += rnd() < 0.5 ? 1 : -1
    if (n === notes[i - 1]) { ix = (ix + 1) % pool.length; n = pool[ix] }
    notes.push(n)
    let step = 0
    while (step === 0) step = Math.round((rnd() * 2 - 1) * leapMax)
    ix = Math.max(0, Math.min(pool.length - 1, ix + step))
  }
  const beats = notes.map(() => (L >= 8 && rnd() < 0.3 ? (rnd() < 0.5 ? 0.5 : 2) : 1))
  return { notes, beats, ioi: Math.round(720 - L * 20) }
}

export const FLOW_IDS = ['gymnopedie', 'swan', 'canon', 'morning', 'ode']
export const flowSongs = (): Song[] => FLOW_IDS.map((id) => SONGS.find((s) => s.id === id)).filter((s): s is Song => !!s)

export interface Save { belt: number; stripes: number; best: number; total: number; flowBest: number }
const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)
export function loadSave(): Save {
  const r = pload<Partial<Save>>('jiujitsu', {}) ?? {}
  return { belt: Math.round(num(r.belt, 0, 0, 4)), stripes: Math.round(num(r.stripes, 0, 0, 3)), best: num(r.best, 0, 0, 1e6), total: num(r.total, 0, 0, 1e9), flowBest: num(r.flowBest, 0, 0, 1e6) }
}
export function writeSave(s: Save) { psave('jiujitsu', s) }

export interface Snapshot {
  phase: Phase
  belt: number; stripes: number; practice: boolean
  rung: number; points: number; partner: number
  banner: string; tip: string
  ei: number; len: number; slips: number; maxSlips: number
  lesson: string; promoTo: number; stripeEarned: boolean; newBest: boolean
  tapN: number
  songs: { id: string; title: string }[]; songIx: number
  flowPos: number; flowTotal: number; chain: number; longest: number
  save: Save
}
