// Pure: Sentence -> canonical Koogalien code (`say hello world.`). Tested by scripts/koogalien-lang-fixtures.ts
import type { Sentence, WordSlot } from '../data/types'
import { lexById } from '../data/lexicon'

/** depth a bare `~wobble` means */
export const DEFAULT_MOD_DEPTH = 0.6

export function printWord(w: WordSlot): string {
  let t: string
  if (w.kind === 'word') t = (w.id && lexById(w.id)?.en) || w.en
  else if (w.kind === 'digit') t = w.en
  else t = '"' + w.en.replace(/["“”]/g, "'").replace(/\s+/g, ' ') + '"'
  if (w.tone.loud !== 'normal') t += '~' + w.tone.loud
  for (const m of w.tone.mods) {
    const d = Math.round(Math.max(0, Math.min(1, m.depth)) * 100)
    t += '~' + m.name + (d === Math.round(DEFAULT_MOD_DEPTH * 100) ? '' : '=' + (d / 100))
  }
  return t
}

export function print(s: Sentence): string {
  return 'say' + (s.words.length ? ' ' + s.words.map(printWord).join(' ') : '') + s.end
}
