// Pure: judging a played chord and choosing which words to practise. Seeded and deterministic. Tested by scripts/koogalien-learn-fixtures.ts
import type { Chord, LexEntry } from '../data/types'
import { LEXICON } from '../data/lexicon'
import { chordDistance, matchChord } from '../engine/match'
import { ALL_ITEMS, itemById, itemsOfUnit } from './items'
import { due, type Card } from './srs'

export const ACCEPT = 0.85
const same = (a: Chord, b: Chord) => a.length === b.length && a.every((d, i) => d === b[i])
const norm = (c: Chord): Chord => [...new Set(c)].sort((a, b) => a - b) as unknown as Chord

/** did the kid play this word? A lone note (a digit) must be exactly right; a chord must be right, or so close that no other word is nearer.
 *  Timing never matters here: jitter inside a chord is the recogniser's job (one chord window), not the judge's. */
export function judgeWord(played: Chord, want: LexEntry): { ok: boolean; confidence: number } {
  const p = norm(played)
  if (!p.length) return { ok: false, confidence: 0 }
  if (same(p, want.chord)) return { ok: true, confidence: 1 }
  const confidence = Math.max(0, 1 - chordDistance(p, want.chord))
  if (want.chord.length === 1 || p.length === 1) return { ok: false, confidence }
  const rivals = matchChord(p)
  const top = rivals[0]
  const ok = confidence >= ACCEPT && (!top || top.id === want.id)
  return { ok, confidence }
}

/** the words (and digits) nearest to a played chord, best first. Always works from the lexicon so it needs no recogniser state. */
export function nearest(played: Chord, n = 3): { entry: LexEntry; confidence: number }[] {
  const p = norm(played)
  if (!p.length) return []
  const pool: readonly LexEntry[] = p.length === 1 ? ALL_ITEMS.filter((e) => e.chord.length === 1) : LEXICON
  return pool.map((entry) => ({ entry, confidence: 1 - chordDistance(p, entry.chord) }))
    .filter((r) => r.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence || (a.entry.id < b.entry.id ? -1 : 1))
    .slice(0, n)
}

/** small seeded random generator (mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
function shuffle<T>(xs: readonly T[], r: () => number): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** choose up to n different words for a round in `unit`: due review cards first (at most half), then words from this unit that are new
 *  or still low in the boxes, then anything from earlier units. No repeats; the same inputs always give the same round. */
export function pickRound(unit: number, cards: readonly Card[], now: number, n: number, seed: number): LexEntry[] {
  const r = rng(seed)
  const out: LexEntry[] = []
  const seen = new Set<string>()
  const add = (e: LexEntry | undefined) => { if (e && !seen.has(e.id) && out.length < n) { seen.add(e.id); out.push(e) } }
  const unitIds = new Set(itemsOfUnit(unit).map((e) => e.id))
  for (const c of due(cards, now, Math.ceil(n / 2))) { const e = itemById(c.id); if (e && e.unit <= unit && e.kind !== 'closer') add(e) }
  const byBox = new Map(cards.map((c) => [c.id, c.box]))
  const here = shuffle(itemsOfUnit(unit), r).sort((a, b) => (byBox.get(a.id) ?? 0) - (byBox.get(b.id) ?? 0))
  for (const e of here) add(e)
  for (const e of shuffle(ALL_ITEMS.filter((x) => x.unit < unit && !unitIds.has(x.id)), r)) add(e)
  return shuffle(out, r)
}
