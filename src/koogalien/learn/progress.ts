// Pure: the saved shape for Koogalien learning, one per player under the key 'koogalien'. Tested by scripts/koogalien-learn-fixtures.ts
import type { Card } from './srs'
import { newCard, review, withCard } from './srs'
import { newWordProg, nextRung, type WordProg, type Rung } from './ladder'

export const PROGRESS_KEY = 'koogalien'
export interface Progress { v: 1; words: Record<string, WordProg>; cards: Card[]; sentences: number; stars: number }
export const emptyProgress = (): Progress => ({ v: 1, words: {}, cards: [], sentences: 0, stars: 0 })

const RUNG_IDS: readonly string[] = ['hunt', 'follow', 'echo', 'memory', 'full', 'master']
/** accept anything stored, keep only what is valid (the storage is the kid's, but never trust it) */
export function sanitize(raw: unknown): Progress {
  const out = emptyProgress()
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Partial<Progress>
  if (r.words && typeof r.words === 'object') {
    for (const [id, w] of Object.entries(r.words)) {
      if (!w || typeof w !== 'object' || id.length > 40) continue
      const rung = RUNG_IDS.includes((w as WordProg).rung as string) ? ((w as WordProg).rung as Rung) : null
      const n = (x: unknown, hi: number) => (typeof x === 'number' && isFinite(x) ? Math.max(0, Math.min(hi, x)) : 0)
      out.words[id] = { rung, stars: n((w as WordProg).stars, 3), best: n((w as WordProg).best, 1) }
    }
  }
  if (Array.isArray(r.cards)) {
    for (const c of r.cards.slice(0, 400)) {
      if (c && typeof c.id === 'string' && c.box >= 1 && c.box <= 5 && typeof c.due === 'number' && isFinite(c.due)) out.cards.push({ id: c.id, box: Math.round(c.box) as Card['box'], due: c.due, seen: Math.max(0, c.seen | 0), right: Math.max(0, c.right | 0) })
    }
  }
  out.sentences = typeof r.sentences === 'number' && r.sentences > 0 ? Math.floor(r.sentences) : 0
  out.stars = typeof r.stars === 'number' && r.stars > 0 ? Math.floor(r.stars) : 0
  return out
}

/** one word finished in a round: the card moves a box and the word climbs a rung if it passed */
export function recordWord(p: Progress, id: string, passed: boolean, stars: number, now: number): Progress {
  const card = review(p.cards.find((c) => c.id === id) ?? newCard(id, now), passed, now)
  const wp = nextRung(p.words[id] ?? newWordProg(), passed, stars)
  return { ...p, cards: withCard(p.cards, card), words: { ...p.words, [id]: wp }, stars: p.stars + (passed ? Math.max(0, Math.min(3, Math.round(stars))) : 0) }
}
