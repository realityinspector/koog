// Pure: chord distance and nearest words. Tested by scripts/koogalien-fixtures.ts
import { LEXICON } from '../data/lexicon'
import type { Chord } from '../data/types'

/** Jaccard distance over degree sets, 0 (same) .. 1 (nothing shared) */
export function chordDistance(a: Chord, b: Chord): number {
  const A = new Set<number>(a), B = new Set<number>(b)
  let inter = 0
  A.forEach(x => { if (B.has(x)) inter++ })
  const uni = A.size + B.size - inter
  return uni === 0 ? 0 : 1 - inter / uni
}

export const OK_AT = 0.85
export const MAYBE_AT = 0.5
/** weakest alternative worth showing */
export const ALT_FLOOR = 0.3

/** words a chord can read as: everything except closers and the spell control (those are exact-only, see recognize) */
const CANDIDATES = LEXICON.filter(e => e.kind !== 'closer' && e.kind !== 'control')

/** nearest words, best first, max 3. Exact = 1; otherwise 1 - distance (+0.03 for words the kid knows), never above 0.99. Single keys are digits, so they match nothing. */
export function matchChord(c: Chord, known?: ReadonlySet<string>): { id: string; confidence: number }[] {
  if (c.length < 2) return []
  const out: { id: string; confidence: number; freq: number }[] = []
  for (const e of CANDIDATES) {
    const d = chordDistance(c, e.chord)
    let conf = d === 0 ? 1 : Math.min(0.99, 1 - d + (known?.has(e.id) ? 0.03 : 0))
    conf = Math.round(conf * 1000) / 1000
    if (conf >= ALT_FLOOR) out.push({ id: e.id, confidence: conf, freq: e.freq ?? 9999 })
  }
  out.sort((x, y) => y.confidence - x.confidence || x.freq - y.freq)
  return out.slice(0, 3).map(({ id, confidence }) => ({ id, confidence }))
}
