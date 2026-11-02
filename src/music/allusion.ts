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
import { findQuote, type Allusion, type AllusionSource, type Played } from './listen/ngram'
import { intervalBits, bitsOf, intervalsOf, isTrivial } from './listen/contour'
import { rhythmSim } from './listen/rhythm'

export type { Allusion, AllusionSource, Played }
export { intervalBits, bitsOf, intervalsOf, isTrivial, rhythmSim }

export const shortTitle = (t: string) => t.replace(/\s*\(.*\)\s*$/, '')
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

/** Best quote in the kid's last notes (a bounded window, newest last), or null. */
export const findAllusion = (played: Played[], index: AllusionIndex, minLen = 4): Allusion | null => findQuote(played, index.sources, minLen)
