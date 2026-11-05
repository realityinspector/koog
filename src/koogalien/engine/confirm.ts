// Pure: resolving 'maybe' words (lead decision 2: a maybe WAITS for the kid unless auto-accept is on). Tested by scripts/koogalien-fixtures.ts
import { lexById } from '../data/lexicon'
import type { Sentence, WordSlot } from '../data/types'

export const needsConfirm = (s: Sentence): boolean => s.words.some(w => w.status === 'maybe')

/** the kid picked alternative `id` for word `i`: it becomes an ok word (the played chord stays as played) */
export function confirmAlt(s: Sentence, i: number, id: string): Sentence {
  const w = s.words[i], e = lexById(id)
  if (!w || !e) return s
  const alts = w.alts?.find(a => a.id === id)
  const words = s.words.map((x, j): WordSlot => j !== i ? x : { ...x, kind: 'word', id: e.id, en: e.en, status: 'ok', confidence: alts ? alts.confidence : 1 })
  return { ...s, words }
}

/** auto-accept: every maybe takes its best guess */
export function acceptGuesses(s: Sentence): Sentence {
  return { ...s, words: s.words.map((w): WordSlot => w.status === 'maybe' ? { ...w, status: 'ok' } : w) }
}
