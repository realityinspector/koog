// Smart Band brain: pure functions, no audio, no React. Easy to test.
//
// The idea in plain words:
//  1. Look at the key she is in and list the "friendly" chords for it (I, IV, V, vi ...).
//  2. Look at the notes she played in the last beat or two. A chord "likes" a note if the note is
//     one of the chord's three notes. Add up how much each chord likes her recent notes.
//  3. Pick the chord with the best score. But don't flip-flop: only switch away from the chord
//     we're already playing when we're on a downbeat AND the new chord wins by a clear margin.
import { PC_NAMES, type Key } from '../../music/theory'

export type Quality = 'maj' | 'min' | 'dim'
export interface Chord { root: number; quality: Quality; name: string; pcs: number[]; primary: boolean }
export interface MelodyNote { pc: number; w: number } // pitch class 0-11, weight (newer = bigger)

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const MINOR = [0, 2, 3, 5, 7, 8, 10]
/** How much better (in "notes") a new chord must score before we leave the current one. */
export const SWITCH_MARGIN = 0.9

const isMinorish = (key: Key) => key.scale === 'minor' || key.scale === 'minorPentatonic' || key.scale === 'blues'

const shortName = (root: number, q: Quality) => PC_NAMES[root] + (q === 'min' ? 'm' : q === 'dim' ? 'dim' : '')

function makeChord(root: number, quality: Quality, primary: boolean): Chord {
  const third = quality === 'maj' ? 4 : 3
  const fifth = quality === 'dim' ? 6 : 7
  return { root, quality, name: shortName(root, quality), pcs: [root, (root + third) % 12, (root + fifth) % 12], primary }
}

export const sameChord = (a: Chord | null, b: Chord | null) => !!a && !!b && a.root === b.root && a.quality === b.quality

/** The chords that belong to a key: stack scale notes in thirds. Primary ones get a small head start. */
export function candidateChords(key: Key): Chord[] {
  const minor = isMinorish(key)
  const sc = minor ? MINOR : MAJOR
  // major: I IV V vi, then ii iii.  minor: i iv v VI, then VII.
  const degrees = minor ? [0, 3, 4, 5, 6] : [0, 3, 4, 5, 1, 2]
  return degrees.map((d, i) => {
    const root = (key.tonic + sc[d]) % 12
    const third = (sc[(d + 2) % 7] - sc[d] + 12) % 12
    const fifth = (sc[(d + 4) % 7] - sc[d] + 12) % 12
    const q: Quality = third === 3 && fifth === 6 ? 'dim' : third === 3 ? 'min' : 'maj'
    return makeChord(root, q, i < 4)
  })
}

/** Turn a chord name from detectChord ("A minor", "G7", "C maj7") into a Chord, or null. */
export function parseChordName(s: string | null): Chord | null {
  if (!s) return null
  const m = /^([A-G]#?)(.*)$/.exec(s.trim())
  if (!m) return null
  const root = PC_NAMES.indexOf(m[1])
  if (root < 0) return null
  const rest = m[2]
  const q: Quality = rest.includes('dim') ? 'dim' : rest.includes('minor') ? 'min' : 'maj'
  return makeChord(root, q, true)
}

/** How much a chord likes the recent melody. Each melody note that is one of its 3 notes counts. */
export function scoreChord(c: Chord, melody: MelodyNote[]): number {
  let s = 0
  for (const n of melody) {
    if (c.pcs.includes(n.pc)) s += n.w * (n.pc === c.root ? 1.1 : 1) // the root is a touch more convincing
  }
  return s + (c.primary ? 0.1 : 0)
}

/**
 * Choose the chord to play. `current` is what the band is playing now (or null at the start).
 * Stability rule: off the downbeat, or without a clear winner, we keep the current chord.
 */
export function pickChord(melody: MelodyNote[], key: Key, current: Chord | null, downbeat: boolean): Chord {
  const cands = candidateChords(key)
  if (melody.length === 0) return current ?? cands[0]
  let best = cands[0], bestScore = -1
  for (const c of cands) {
    const s = scoreChord(c, melody)
    if (s > bestScore) { best = c; bestScore = s }
  }
  if (!current) return best
  if (!downbeat) return current
  if (sameChord(best, current)) return current
  return bestScore >= scoreChord(current, melody) + SWITCH_MARGIN ? best : current
}

/** Weight recent notes: the newest beat counts fully, the beat before counts less. */
export function weighMelody(notes: { note: number; ageBeats: number }[]): MelodyNote[] {
  return notes
    .filter((n) => n.ageBeats <= 2)
    .map((n) => ({ pc: ((n.note % 12) + 12) % 12, w: n.ageBeats <= 1 ? 1 : 0.6 }))
}

export const MIN_BPM = 70
export const MAX_BPM = 140
export const DEFAULT_BPM = 96

/**
 * Guess her tempo from when her notes start. Take the gaps between note starts, use the median
 * (so one stray gap doesn't matter), turn it into bpm, fold into 70-140 and ease toward it.
 * With too little to go on, keep the previous tempo.
 */
export function estimateBpm(onsetsMs: number[], prev: number = DEFAULT_BPM): number {
  const ons: number[] = []
  for (const t of onsetsMs) if (!ons.length || t - ons[ons.length - 1] >= 70) ons.push(t) // a chord = one onset
  const recent = ons.slice(-9)
  const iois: number[] = []
  for (let i = 1; i < recent.length; i++) {
    const d = recent[i] - recent[i - 1]
    if (d >= 150 && d <= 1500) iois.push(d)
  }
  if (iois.length < 3) return clampBpm(prev)
  iois.sort((a, b) => a - b)
  const mid = iois.length >> 1
  const med = iois.length % 2 ? iois[mid] : (iois[mid - 1] + iois[mid]) / 2
  let bpm = 60000 / med
  while (bpm > MAX_BPM) bpm /= 2
  while (bpm < MIN_BPM) bpm *= 2
  return clampBpm(prev + (bpm - prev) * 0.35)
}

export const clampBpm = (b: number) => Math.round(Math.max(MIN_BPM, Math.min(MAX_BPM, b)))
