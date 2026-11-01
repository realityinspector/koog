// Allusion / quotation finder. Pure rules, no state, no ML.
// "Did the last few notes the kid played look like the start of (or a slice of) a tune we know?"
//   - Every source melody (the public-domain SONGS, plus phrases the kid has learned) is just a list of MIDI notes
//     and note lengths. We compare by PITCH OFFSET, so a quote in another key still matches (transposition-invariant).
//   - One wrong note is forgiven in a longer window.
//   - Trivial stuff never counts: scales, repeated notes, trills. A match is scored by how many notes agree, how
//     "surprising" the intervals are (a leap is rarer than a step), and whether the rhythm shape agrees too.
// Only public-domain songs from SONGS are ever named; the Koog Originals and unchecked classics are not indexed
// as songs (a kid's own learned phrases of them still count as "your phrase").
import { SONGS, type Song } from '../features/songs/songs'
import { PC_NAMES } from './theory'

export interface AllusionSource {
  id: string
  title: string
  kind: 'song' | 'phrase'
  /** the song's home key (to name the key of a transposed quote) */
  key?: { tonic: number; scale: string }
  notes: number[]
  beats: number[]
}
export interface Played { note: number; t: number }
export interface Allusion {
  source: AllusionSource
  /** how many of the kid's last notes matched */
  length: number
  /** semitones the kid's version sits above the original (mod 12; 0 = same key) */
  shift: number
  /** name of the key the quote was played in, when it moved ("G", "E minor") */
  keyName: string | null
  /** position in the source where the matched slice starts (0 = the opening) */
  start: number
  mismatches: number
  rhythm: number
  bits: number
  score: number
}

// "how surprising is this jump" in bits: steps and repeats are common, leaps are rare
const BITS: Record<number, number> = { 0: 2.4, 1: 2.8, 2: 2.4, 3: 3.2, 4: 3.2, 5: 3.6, 7: 4.2 }
export const intervalBits = (i: number) => BITS[Math.abs(i)] ?? 5
export const bitsOf = (iv: number[]) => iv.reduce((a, i) => a + intervalBits(i), 0)
export const intervalsOf = (ns: number[]) => ns.slice(1).map((n, i) => n - ns[i])

/** scales, runs of steps, repeated notes and trills say nothing about WHICH tune it is */
export function isTrivial(ns: number[]): boolean {
  if (ns.length < 3) return true
  const iv = intervalsOf(ns)
  const pcs = new Set(ns.map((n) => n % 12)).size
  const zeros = iv.filter((i) => i === 0).length
  if (pcs <= 1) return true
  // 4 notes may be "da da da DUM" (a repeat, then a leap); longer than that, mostly-repeats and trills are filler
  if (ns.length >= 5 && (pcs <= 2 || zeros * 2 > iv.length)) return true
  if (iv.every((i) => Math.abs(i) <= 2) && zeros === 0) {
    let turns = 0
    for (let k = 1; k < iv.length; k++) if (Math.sign(iv[k]) !== Math.sign(iv[k - 1])) turns++
    if (turns <= 1) return true // a scale, up, down, or up-and-down
  }
  return false
}

/** 0..1: do the note lengths of the kid's window rise and fall like the source's? (ratios, so tempo does not matter) */
export function rhythmSim(times: number[], beats: number[]): number {
  const n = times.length - 1 // intervals between onsets
  if (n < 3 || beats.length < n) return 0.5
  let d = 0, c = 0
  for (let k = 1; k < n; k++) {
    const a = (times[k + 1] - times[k]) / Math.max(1, times[k] - times[k - 1])
    const b = beats[k] / Math.max(1e-6, beats[k - 1])
    d += Math.abs(Math.log2(a / b)); c++
  }
  return Math.max(0, 1 - d / c / 0.8)
}

export const shortTitle = (t: string) => t.replace(/\s*\(.*\)\s*$/, '')
const keyLabel = (tonic: number, scale: string) => PC_NAMES[((tonic % 12) + 12) % 12] + (scale === 'minor' ? ' minor' : '')

/** Sources from SONGS: only the tunes people know. Koog Originals, the user's own songs and not-yet-verified classics are left out. */
export function songSources(songs: Song[] = SONGS): AllusionSource[] {
  const out: AllusionSource[] = []
  for (const s of songs) {
    if (s.tier === 'pop' || s.mine || s.checked === false) continue
    const sounding = s.notes.filter((n) => n.note != null)
    if (sounding.length < 5) continue
    out.push({ id: s.id, title: shortTitle(s.title), kind: 'song', key: s.key, notes: sounding.map((n) => n.note as number), beats: sounding.map((n) => n.beats) })
  }
  return out
}

export interface AllusionIndex { sources: AllusionSource[] }
export const buildIndex = (sources: AllusionSource[]): AllusionIndex => ({ sources })

const MAX_WIN = 8
const GAP_MAX = 1600 // ms: a longer pause ends the kid's "window"

/** Best quote in the kid's last notes (a bounded window, newest last), or null. Cheap: ~40 tunes x ~100 positions x 8 notes. */
export function findAllusion(played: Played[], index: AllusionIndex, minLen = 4): Allusion | null {
  // the window: the newest notes with no big pause inside
  let from = played.length - 1
  while (from > 0 && played.length - from < MAX_WIN && played[from].t - played[from - 1].t <= GAP_MAX) from--
  const win = played.slice(from)
  if (win.length < minLen) return null
  let best = null as Allusion | null
  const songsHit = new Set<string>()
  for (let L = win.length; L >= minLen; L--) {
    const w = win.slice(win.length - L)
    const kn = w.map((p) => p.note)
    const times = w.map((p) => p.t)
    const allowed = L >= 8 ? 1 : 0
    let found = null as Allusion | null
    for (const src of index.sources) {
      const learned = src.kind === 'phrase'
      if (src.notes.length < L) continue
      const sn = src.notes
      for (let s = 0; s + L <= sn.length; s++) {
        // try the offset from note 0 and from note 1 (so a wrong first note is still forgiven)
        for (let anchor = 0; anchor <= (allowed ? 1 : 0); anchor++) {
          const off = kn[anchor] - sn[s + anchor]
          let bad = 0
          for (let i = 0; i < L && bad <= allowed; i++) if (kn[i] - sn[s + i] !== off) bad++
          if (bad > allowed) continue
          // only the matching notes count for distinctiveness
          const okIdx: number[] = []
          for (let i = 0; i < L; i++) if (kn[i] - sn[s + i] === off) okIdx.push(i)
          const mk = okIdx.map((i) => kn[i])
          if (isTrivial(mk.length === L ? kn : mk) || isTrivial(kn)) continue
          const iv: number[] = []
          for (let i = 1; i < L; i++) if (kn[i] - sn[s + i] === off && kn[i - 1] - sn[s + i - 1] === off) iv.push(kn[i] - kn[i - 1])
          const bits = bitsOf(iv)
          const matched = L - bad
          const rhythm = rhythmSim(times, src.beats.slice(s, s + L))
          const sb = src.beats.slice(s, s + L)
          const uneven = Math.max(...sb) / Math.max(1e-6, Math.min(...sb)) >= 1.8
          const leap = iv.some((i) => Math.abs(i) >= 3)
          const ok = learned
            ? matched >= 4 && bits >= 7.5 && (matched >= 5 || (leap && rhythm >= 0.5))
            : (matched >= 5 && bits >= (bad ? 11.5 : matched === 5 ? 14.5 : matched === 6 ? 14 : 13) + (s > 0 ? 2 : 0)) || (matched === 4 && bits >= 8 && leap && rhythm >= 0.75 && uneven && s === 0)
          if (!ok) continue
          const score = matched + bits / 6 + rhythm * 1.5 + (learned ? 2 : 0) - bad
          const shift = ((off % 12) + 12) % 12
          if (!learned) songsHit.add(src.id)
          if (!found || score > found.score) {
            found = {
              source: src, length: matched, shift, start: s, mismatches: bad, rhythm, bits, score,
              keyName: shift !== 0 && src.key ? keyLabel(src.key.tonic + shift, src.key.scale) : null,
            }
          }
        }
      }
    }
    if (found && (!best || found.score > best.score)) best = found
    if (best) break // the longest window that matches wins
  }
  // a pattern that fits 4+ different tunes is a cliché, not a quote
  if (best && best.source.kind === 'song' && songsHit.size >= 4) return null
  return best
}
