// Pure: what all four Koogalien games share. The help ladder, crediting a word in the shared Koogalien progress (so learning in
// any game counts everywhere), picking a pool, and the small per-player save the games keep beside it.
// Tested by scripts/koogalien-games-fixtures.ts. No DOM, no audio, `now` is always injected.
import type { Chord, LexEntry } from '../../../koogalien/data/types'
import { rng } from '../../../koogalien/learn/checks'
import { ALL_ITEMS } from '../../../koogalien/learn/items'
import { RUNGS, type Rung, type WordProg } from '../../../koogalien/learn/ladder'
import { recordWord, type Progress } from '../../../koogalien/learn/progress'
import { cardOf, review, withCard } from '../../../koogalien/learn/srs'

export type Help = 'glow' | 'fade' | 'none'
export const rungIdx = (r: Rung | null | undefined): number => (r == null ? -1 : RUNGS.indexOf(r))

/** the ladder of help: Hunt & Peck glow on early tries, a short glow that fades on middle rungs, none once it is known.
 *  Two misses on the same word always bring the glow back. "Hear it again" is never gated by this. */
export function helpFor(p: WordProg | undefined, missesNow = 0): Help {
  if (missesNow >= 2) return 'glow'
  const i = rungIdx(p?.rung ?? null)
  return i <= 0 ? 'glow' : i <= 2 ? 'fade' : 'none'
}

/** credit a word (or a letter, id `letter-k`) in the shared progress. A pass climbs the ladder only up to `cap`; above that it just
 *  moves the Leitner box. A miss sends the card back to box 1, due right now, so it returns soon. */
export function credit(p: Progress, id: string, passed: boolean, stars: number, now: number, cap: Rung): Progress {
  const cur = p.words[id]
  if (passed && cur && rungIdx(cur.rung) >= rungIdx(cap)) {
    const card = review(cardOf(p.cards, id, now), true, now)
    return { ...p, cards: withCard(p.cards, card), words: { ...p.words, [id]: { ...cur, best: 1 } }, stars: p.stars + 1 }
  }
  return recordWord(p, id, passed, stars, now)
}

/** 3 stars for a clean item, 2 for one slip, 1 otherwise */
export const starsFor = (misses: number): number => (misses <= 0 ? 3 : misses === 1 ? 2 : 1)

export function shuffle<T>(xs: readonly T[], seed: number): T[] {
  const r = rng(seed), a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** words that make a fair set of wrong answers: other teachable items from the first `maxUnit` units */
export const poolOf = (maxUnit: number): LexEntry[] => ALL_ITEMS.filter((e) => e.unit <= maxUnit && e.kind !== 'closer' && e.kind !== 'control')

export const sameChord = (a: Chord, b: Chord): boolean => a.length === b.length && a.every((d, i) => d === b[i])

// ---- the games' own small save (names for Spell Station, bests, which game was last), next to the shared progress
export const GAMES_KEY = 'koogalien-games'
export interface GamesSave { v: 1; names: string[]; docked: string[]; bestStreak: number; rocketBest: number; rocketFast: boolean; chat: Record<string, number>; last: string | null }
export const emptySave = (): GamesSave => ({ v: 1, names: [], docked: [], bestStreak: 0, rocketBest: 0, rocketFast: false, chat: {}, last: null })
const n0 = (x: unknown, hi = 9999) => (typeof x === 'number' && isFinite(x) ? Math.max(0, Math.min(hi, Math.floor(x))) : 0)
/** a name to spell: letters, apostrophe and spaces, up to 12, lower case. '' if nothing usable. */
export function cleanName(s: unknown): string {
  if (typeof s !== 'string') return ''
  return s.toLowerCase().replace(/[^a-z' ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12).trim()
}
export function sanitizeSave(raw: unknown): GamesSave {
  const out = emptySave()
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Partial<GamesSave>
  if (Array.isArray(r.names)) out.names = [...new Set(r.names.map(cleanName).filter(Boolean))].slice(0, 8)
  if (Array.isArray(r.docked)) out.docked = [...new Set(r.docked.map(cleanName).filter(Boolean))].slice(0, 20)
  out.bestStreak = n0(r.bestStreak, 99); out.rocketBest = n0(r.rocketBest, 99999); out.rocketFast = !!r.rocketFast
  if (r.chat && typeof r.chat === 'object') for (const [k, v] of Object.entries(r.chat).slice(0, 12)) if (k.length < 24) out.chat[k] = n0(v, 999)
  out.last = typeof r.last === 'string' && r.last.length < 20 ? r.last : null
  return out
}
