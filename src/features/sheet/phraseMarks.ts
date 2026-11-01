// Phrase brackets for the sheet: which note ranges form each tiny phrase, and the chained phrase around the current one.
// Segmentation comes from the phrase engine (src/music/phraseEngine.ts). Loaded through import.meta.glob so the sheet
// still builds and runs when that file is missing; then a small local cut (at rests / long notes, 3 notes max) is used.
import type { SongNote } from '../songs/songs'
import type { Phrase } from '../../music/phrases'

type Seg = (songId: string, notes: SongNote[], size: Phrase['size'], beatsPerBar?: number) => Phrase[]
const mods = import.meta.glob('../../music/phraseEngine.ts', { eager: true }) as Record<string, Record<string, unknown>>
function findSeg(): Seg | null {
  for (const m of Object.values(mods)) {
    if (typeof m.segment === 'function') return m.segment as Seg
    for (const v of [m.phraseEngine, m.engine, m.default]) {
      const f = (v as { segment?: unknown } | undefined)?.segment
      if (typeof f === 'function') return (f as Seg).bind(v)
    }
  }
  return null
}

export interface Span { a: number; b: number }   // note indices, b exclusive
export interface Marks { small: Span[]; chain: Span | null }

function fallback(notes: SongNote[], size: number): Span[] {
  const out: Span[] = []
  let a = -1, cnt = 0
  const per = size === 1 ? 3 : 3 * (1 << (size - 1))
  notes.forEach((n, i) => {
    if (n.note == null) { if (a >= 0) { out.push({ a, b: i }); a = -1; cnt = 0 } return }
    if (a < 0) a = i
    cnt++
    if (cnt >= per || n.beats >= 2) { out.push({ a, b: i + 1 }); a = -1; cnt = 0 }
  })
  if (a >= 0) out.push({ a, b: notes.length })
  return out
}

/** brackets for a score; `cur` = the phrase being practised (its chain, if it is bigger than a tiny phrase, gets the big bracket) */
export function phraseMarks(songId: string, notes: SongNote[], bpb: number, cur: Phrase | null): Marks {
  const seg = findSeg()
  const spans = (size: 1 | 2 | 3 | 4): Span[] => {
    if (seg) { try { return seg(songId, notes, size, bpb).map((p) => ({ a: p.start, b: p.end })) } catch { /* fall through */ } }
    return fallback(notes, size)
  }
  const small = spans(1)
  const chain: Span | null = cur && cur.size > 1 ? { a: cur.start, b: cur.end } : null
  return { small, chain }
}
if (import.meta.hot) import.meta.hot.accept()
