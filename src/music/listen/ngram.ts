// N-gram style matching core: "do the player's last few notes look like a slice of a known melody?" Pure, no state.
// Matches by pitch OFFSET (transposition-invariant), forgives one wrong note in a longer window, ignores trivial
// material, and scores by matched notes, interval surprise and rhythm shape. Time is passed in on each note.
import { PC_NAMES, pc } from './pitch'
import { bitsOf, isTrivial } from './contour'
import { rhythmSim } from './rhythm'

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

const keyLabel = (tonic: number, scale: string) => PC_NAMES[pc(tonic)] + (scale === 'minor' ? ' minor' : '')

const MAX_WIN = 8
const GAP_MAX = 1600 // ms: a longer pause ends the kid's "window"

/** Best quote in the kid's last notes (a bounded window, newest last), or null. Cheap: ~40 tunes x ~100 positions x 8 notes. */
export function findQuote(played: Played[], sources: AllusionSource[], minLen = 4): Allusion | null {
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
    for (const src of sources) {
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
          const shift = pc(off)
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
