// Pure: spaced repetition with 5 Leitner boxes. `now` is always injected. Tested by scripts/koogalien-learn-fixtures.ts
export interface Card { id: string; box: 1 | 2 | 3 | 4 | 5; due: number /* ms epoch */; seen: number; right: number }

/** days until the next review, by box: box 1 = next session, then 1, 3, 7, 14 days */
export const BOX_DAYS = [0, 1, 3, 7, 14] as const
export const DAY_MS = 86_400_000

export function newCard(id: string, now: number): Card { return { id, box: 1, due: now, seen: 0, right: 0 } }

/** right = up one box (max 5) and wait longer; wrong = back to box 1, due right away */
export function review(c: Card, correct: boolean, now: number): Card {
  const box = (correct ? Math.min(5, c.box + 1) : 1) as Card['box']
  return { id: c.id, box, due: now + BOX_DAYS[box - 1] * DAY_MS, seen: c.seen + 1, right: c.right + (correct ? 1 : 0) }
}

/** cards that are due, most overdue first, low boxes before high on ties, then by id so the order is stable */
export function due(cards: readonly Card[], now: number, limit: number): Card[] {
  return cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due || a.box - b.box || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, Math.max(0, limit))
}

/** get a card from a list or make a fresh one */
export function cardOf(cards: readonly Card[], id: string, now: number): Card { return cards.find((c) => c.id === id) ?? newCard(id, now) }
/** replace (or add) a card, returning a new list */
export function withCard(cards: readonly Card[], c: Card): Card[] { const i = cards.findIndex((x) => x.id === c.id); const out = cards.slice(); if (i < 0) out.push(c); else out[i] = c; return out }
