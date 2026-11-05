// Pure: Sentence -> English line, and sentence equality. Tested by scripts/koogalien-fixtures.ts
import type { Sentence } from '../data/types'

/** 'hello world': the words only, no closer (the closer is shown separately) */
export const gloss = (s: Sentence): string => s.words.map(w => w.en).join(' ')

const key = (s: Sentence) => JSON.stringify([s.end, s.words.map(w => [w.kind, w.id, w.en.toLowerCase(), w.chords, w.tone])])
/** ignores confidence, status, alts, alien and the letter case of spelled words */
export const sameSentence = (a: Sentence, b: Sentence): boolean => key(a) === key(b)
