// Pure: Program -> one Sentence (say lines joined in order; variables already substituted by parse). Tested by scripts/koogalien-lang-fixtures.ts
import type { Sentence } from '../data/types'
import { KOOGALIEN_VERSION, LIMITS } from '../data/types'
import type { Program } from './parse'

export function lower(p: Program): Sentence {
  const words: Sentence['words'] = []
  let end: Sentence['end'] = '.'
  for (const s of p.says) {
    for (const w of s.words) if (words.length < LIMITS.wordsPerSentence) words.push(w)
    end = s.end
  }
  return { v: KOOGALIEN_VERSION, words, end }
}
