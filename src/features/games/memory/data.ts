// Phrase Match: pure data. Phrases are cut from Koog's own public-domain and traditional songs
// (the same SONGS list the Learn phrase ladder uses), so nothing here is new melody.
import type { Phrase } from '../../../music/phrases'
import { SONGS } from '../../songs/songs'

export type Level = 'easy' | 'medium' | 'hard'
export interface LevelDef { id: Level; label: string; cols: number; rows: number; pairs: number; decoys: number; lens: [number, number]; hint: 'all' | 'first' | 'none'; blurb: string }
export const LEVELS: LevelDef[] = [
  { id: 'easy', label: 'Easy', cols: 3, rows: 2, pairs: 3, decoys: 0, lens: [3, 4], hint: 'all', blurb: '2 x 3 cards. The keys light up to help you play it back.' },
  { id: 'medium', label: 'Medium', cols: 4, rows: 3, pairs: 6, decoys: 1, lens: [4, 5], hint: 'first', blurb: '3 x 4 cards. Only the first key lights up.' },
  { id: 'hard', label: 'Hard', cols: 4, rows: 4, pairs: 8, decoys: 3, lens: [5, 6], hint: 'none', blurb: '4 x 4 cards. No key lights, and look-alike tunes hide in the deck.' },
]
export const levelDef = (l: Level) => LEVELS.find((x) => x.id === l)!

/** public domain or traditional songs only */
const SOURCE_IDS = ['buns', 'mary', 'twinkle', 'ode', 'lune', 'jingle', 'bday', 'saints', 'grace', 'brahms', 'minuet', 'greensleeves', 'elise', 'canon', 'korobeiniki', 'entertainer', 'turkish', 'king', 'nachtmusik', 'beethoven5']

export interface Phr extends Phrase { bpm: number; decoyOf?: string }

const sig = (p: { notes: { note: number }[] }) => p.notes.map((n) => n.note).join(',')
const rhy = (p: { notes: { beat: number; beats: number }[] }) => p.notes.map((n) => n.beat + '/' + n.beats).join(',')

/** every window of lo..hi sounding notes in the song, keeping the beat offsets */
function windows(songId: string, lo: number, hi: number): Phr[] {
  const s = SONGS.find((x) => x.id === songId)
  if (!s) return []
  const sounding: { note: number; t: number; beats: number; i: number }[] = []
  let t = 0
  s.notes.forEach((n, i) => { if (n.note != null) sounding.push({ note: n.note, t, beats: n.beats, i }); t += n.beats })
  const out: Phr[] = []
  for (let len = lo; len <= hi; len++) {
    for (let a = 0; a + len <= sounding.length; a += Math.max(1, len - 1)) {
      const w = sounding.slice(a, a + len)
      const ps = w.map((x) => x.note)
      if (new Set(ps).size < 3) continue // need a few different pitches
      if (Math.max(...ps) - Math.min(...ps) > 14) continue
      if (w[len - 1].t - w[0].t > 8) continue // not stretched over a long rest
      out.push({
        id: `${songId}:${w[0].i}-${w[len - 1].i + 1}`, songId, start: w[0].i, end: w[len - 1].i + 1, size: 1,
        notes: w.map((x) => ({ note: x.note, beat: x.t - w[0].t, beats: x.beats })),
        bpm: Math.max(84, Math.min(112, s.bpm)),
      })
    }
  }
  return out
}

/** same rhythm, different notes: the look-alike tune for the hard levels */
export function makeDecoy(p: Phr, rnd: () => number): Phr {
  for (let tries = 0; tries < 30; tries++) {
    const notes = p.notes.map((n, i) => {
      if (i === 0 || rnd() < 0.35) return { ...n }
      const d = (1 + Math.floor(rnd() * 3)) * (rnd() < 0.5 ? -1 : 1)
      return { ...n, note: n.note + d }
    })
    const d: Phr = { ...p, id: p.id + '~d', notes, decoyOf: p.id }
    if (sig(d) !== sig(p) && notes.every((n) => n.note >= 36 && n.note <= 96)) return d
  }
  const notes = p.notes.map((n, i) => (i === p.notes.length - 1 ? { ...n, note: n.note + 2 } : { ...n }))
  return { ...p, id: p.id + '~d', notes, decoyOf: p.id }
}

/** pick the phrases for a game: distinct songs first, no two alike (decoys excepted) */
export function pickPhrases(level: Level, rnd: () => number = Math.random): Phr[] {
  const def = levelDef(level)
  const base = def.pairs - def.decoys
  const ids = [...SOURCE_IDS].sort(() => rnd() - 0.5)
  const chosen: Phr[] = []
  const seen = new Set<string>()
  const firstNotes = new Set<number>()
  for (const id of ids) {
    if (chosen.length >= base) break
    const pool = windows(id, def.lens[0], def.lens[1]).sort(() => rnd() - 0.5)
    const p = pool.find((x) => !seen.has(sig(x)) && !firstNotes.has(x.notes[0].note))
    if (p) { chosen.push(p); seen.add(sig(p)); firstNotes.add(p.notes[0].note) }
  }
  const decoyBase = [...chosen].sort(() => rnd() - 0.5).slice(0, def.decoys)
  for (const b of decoyBase) { const d = makeDecoy(b, rnd); chosen.push(d) }
  return chosen
}

export function shuffle<T>(a: T[], rnd: () => number = Math.random): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}

export const sameRhythm = (a: Phr, b: Phr) => rhy(a) === rhy(b)

// ---- score and saved bests ----
export interface Best { flips: number; ms: number; stars: number }
export interface MemSave { best: Record<string, Best>; plays: number }
export const bestKey = (l: Level, ear: boolean) => `${l}:${ear ? 'ear' : 'pic'}`
/** 3 stars: close to perfect memory; 2: fine; 1: finished */
export function starsFor(flips: number, pairs: number): number {
  if (flips <= Math.ceil(pairs * 3)) return 3
  if (flips <= pairs * 4.5) return 2
  return 1
}
export const isBetter = (a: Best, b: Best | undefined) => !b || a.flips < b.flips || (a.flips === b.flips && a.ms < b.ms)
export const fmtTime = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
