// Pure: English -> Sentence. Streaming-friendly: translateStream yields one Sentence at a time, deterministic, no hidden state, no length limit
// (only the live-input caps in LIMITS apply to the recognizer). Every English word translates: lexicon words become chords, anything else is spelled.
// Tested by scripts/koogalien-fixtures.ts
import { ALPHABET, SPELL_END, SPELL_ID, glyphByChar } from '../data/alphabet'
import { lexByEnglish, lexById } from '../data/lexicon'
import { KOOGALIEN_VERSION } from '../data/types'
import type { Chord, Degree, Ending, Sentence, WordSlot } from '../data/types'

const PLAIN = () => ({ loud: 'normal' as const, mods: [] })
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 }
void ALPHABET

export function digitSlot(d: Degree): WordSlot {
  return { kind: 'digit', id: null, en: String(d), chords: [[d]], tone: PLAIN(), confidence: 1, status: 'ok' }
}
export function wordSlot(id: string): WordSlot | null {
  const e = lexById(id)
  return e ? { kind: 'word', id: e.id, en: e.en, chords: [e.chord], tone: PLAIN(), confidence: 1, status: 'ok' } : null
}
/** spell chord, then [row],[col] per letter, then the spell-end chord. Letters outside the alphabet are dropped; null when nothing is left. */
export function spellSlot(text: string): WordSlot | null {
  const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const letters: string[] = []
  for (const ch of plain) if (/^[A-Za-z']$/.test(ch) && glyphByChar(ch)) letters.push(ch)
  if (!letters.some(ch => ch !== "'")) return null
  const spell = lexById(SPELL_ID)!.chord
  const chords: Chord[] = [spell]
  for (const ch of letters) { const g = glyphByChar(ch)!; chords.push([g.row as Degree], [g.col as Degree]) }
  chords.push(SPELL_END)
  return { kind: 'spelled', id: null, en: letters.join(''), chords, tone: PLAIN(), confidence: 1, status: 'ok' }
}

/** a word the lexicon can say as a chord (not closers or the spell control, which would change meaning) */
function lexWord(t: string): WordSlot | null {
  const e = lexByEnglish(t)
  return e && e.kind !== 'closer' && e.kind !== 'control' ? wordSlot(e.id) : null
}

const TOKEN = /[A-Za-zÀ-ɏ']+|[0-9]+|[.?!]+/g
/** the words (and digits) of a piece of text, ignoring punctuation; the last . ? ! decides the ending */
function slotsOf(text: string, known?: ReadonlySet<string>): { words: WordSlot[]; end: Ending } {
  const toks = text.match(TOKEN) ?? []
  const words: WordSlot[] = []
  let end: Ending = '.'
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    if (/^[.?!]+$/.test(t)) { const c = t[t.length - 1]; end = c === '?' ? '?' : c === '!' ? '!' : '.'; continue }
    if (/^[0-9]+$/.test(t)) {
      if (t === '10') { const w = wordSlot('ten'); if (w) words.push(w); continue }
      for (const ch of t) {
        const n = Number(ch)
        if (n === 0) words.push(wordSlot('zero')!)
        else if (n === 9) words.push(wordSlot('nine')!)
        else words.push(digitSlot(n as Degree))
      }
      continue
    }
    const low = t.toLowerCase().replace(/^'+|'+$/g, '')
    if (!low) continue
    // two-word entries ('Koog Alien')
    const next = toks[i + 1]
    if (next && /^[A-Za-z]/.test(next)) {
      const two = lexByEnglish(low + ' ' + next.toLowerCase())
      if (two && two.kind !== 'closer' && two.kind !== 'control') { words.push(wordSlot(two.id)!); i++; continue }
    }
    if (NUMBER_WORDS[low]) { words.push(digitSlot(NUMBER_WORDS[low] as Degree)); continue }
    const w = lexWord(low) ?? spellSlot(t.replace(/^'+|'+$/g, ''))
    if (w) words.push(w)
  }
  void known
  return { words, end }
}

/** the whole text as ONE sentence; the last . ? ! sets the ending (default '.') */
export function translate(text: string, known?: ReadonlySet<string>): Sentence {
  const { words, end } = slotsOf(text, known)
  return { v: KOOGALIEN_VERSION, words, end }
}

/** split on sentence endings (. ? ! followed by a space or the end; "3.5" is not split) */
export function splitSentences(text: string): string[] {
  const out: string[] = []
  const re = /[^.?!]*(?:[.?!]+["'”’)\]]*(?=\s|$)|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) && m[0] !== '') { if (/[A-Za-z0-9]/.test(m[0])) out.push(m[0].trim()); if (re.lastIndex >= text.length) break }
  return out
}

/** one Sentence at a time, in order: a book can be translated chapter by chapter without holding it all */
export function* translateStream(text: string, known?: ReadonlySet<string>): Generator<Sentence, void, undefined> {
  for (const s of splitSentences(text)) {
    const sen = translate(s, known)
    if (sen.words.length) yield sen
  }
}
export const translateAll = (text: string, known?: ReadonlySet<string>): Sentence[] => Array.from(translateStream(text, known))

/** how much of a text the lexicon covers; everything else is spelled, so ratio 1 means no spelling at all */
export function coverage(text: string): { known: number; spelled: number; ratio: number } {
  let known = 0, spelled = 0
  for (const s of translateStream(text)) for (const w of s.words) { if (w.kind === 'spelled') spelled++; else known++ }
  const total = known + spelled
  return { known, spelled, ratio: total ? known / total : 1 }
}
