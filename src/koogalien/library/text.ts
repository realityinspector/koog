// Pure: sentence splitting that knows about "Mr." and attribution clauses, plus dialogue speaker detection.
// Speakers: the narrator is voice 0; each named speaker in a chapter gets Pip, Dro or Zee in order of first appearance;
// unnamed quotes alternate with the previous speaker. Tested by scripts/library-fixtures.ts
import { splitSentences } from '../engine/translate'
import type { VoiceNo } from './types'

const DOT = '․' // stands in for the dot of an abbreviation while we split
const ABBR = /\b(Mr|Mrs|Ms|Dr|St|Messrs|Mme|Col|Capt|Gen|Prof|Rev|Sr|Jr)\./g

/** sentences of a paragraph; an attribution that starts lowercase ("said Alice.") joins the quote before it */
export function sentencesOf(para: string): string[] {
  const safe = para.replace(ABBR, '$1' + DOT)
  const raw = splitSentences(safe).map((s) => s.replace(new RegExp(DOT, 'g'), '.'))
  const out: string[] = []
  for (const s of raw) {
    if (out.length && /^[a-z]/.test(s) && /["”’'?!,]\s*$|[?!.]["”’']\s*$/.test(out[out.length - 1])) out[out.length - 1] += ' ' + s
    else out.push(s)
  }
  return out
}

const OPEN = /^[\s]*(?:[“"]|‘(?=[A-Za-z])|'(?=[A-Za-z]))/
const CLOSE_CH = /[”"]/g
const OPEN_CH = /[“"]/g

/** how many double quotes are open after this text, starting from `open` (0 or 1): handles “curly” and "straight" quotes */
export function quoteDepth(text: string, open: number): number {
  let o = open
  for (const ch of text) {
    if (ch === '“') o = 1
    else if (ch === '”') o = 0
    else if (ch === '"') o = o ? 0 : 1
  }
  return o
}
void CLOSE_CH; void OPEN_CH

/** does a sentence carry spoken words? (starts inside a quote, or opens one, or a paragraph that opens with a single quote) */
export function isSpoken(sentence: string, openBefore: number, singleQuoteParagraph: boolean): boolean {
  return openBefore === 1 || OPEN.test(sentence) || (singleQuoteParagraph && /['‘’]/.test(sentence))
}

const SAY = '(?:said|asked|cried|replied|answered|shouted|exclaimed|whispered|thought|called|added|continued|remarked|muttered|sighed|laughed|growled|squeaked|declared|observed|inquired|repeated|roared|sobbed|screamed|yelled|murmured|interrupted|suggested|explained|wondered|began|went on)'
const TITLE = '(?:the |old |little |poor |dear |good |great |young |mr\\.? |mrs\\.? |miss |master |uncle |aunt |dame |sir )*'
const NAME = '([A-Za-z]+)'
const AFTER = new RegExp(`\\b${SAY}\\s+${TITLE}${NAME}`, 'i')
const BEFORE = new RegExp(`${TITLE}${NAME}\\s+${SAY}\\b`, 'i')
const PRONOUN = /^(work|good|other|just|aloud|of|if|when|while|is|was|had|has|do|did|not|no|yes|now|oh|ah|well|what|who|why|how|where|which|he|she|it|they|i|we|you|him|her|them|and|then|the|a|to|in|on|at|of|with|as|again|softly|slowly|quickly|gently|loudly|sadly|so|but|too|out|up|down|over|back|after|before|once|this|that|there|here|all|one|his|their|its|my|our|your|her)$/i

/** the speaker named around a quote ("said the Whale", "Alice cried"), lowercased, or null when it is a pronoun or absent */
export function speakerName(sentence: string): string | null {
  const outside = sentence.replace(/[“"][^”"]*[”"]/g, ' ').replace(/[‘'][^’']*[’']/g, (m) => (m.length > 3 ? ' ' : m))
  const m = AFTER.exec(outside) ?? BEFORE.exec(outside)
  if (!m) return null
  const raw = m[1].trim()
  const first = raw.split(' ')[0]
  if (PRONOUN.test(first) || /ly$/i.test(first)) return null
  return raw.toLowerCase().replace(/^(the|old|little|poor|dear|good|great|young) /, '').trim() || null
}

const WHISPER = /\b(whisper|murmur|mutter|thought|wondered|softly|sigh)/i
const LOUD = /\b(shout|cried|exclaim|scream|yell|roar|bellow|thunder)/i
/** how a sentence is delivered, from its attribution: reserved words only, no guessing */
export function delivery(sentence: string): 'soft' | 'loud' | 'plain' {
  if (WHISPER.test(sentence)) return 'soft'
  if (LOUD.test(sentence)) return 'loud'
  return 'plain'
}

export interface CastState { names: Map<string, VoiceNo>; last: VoiceNo; /** the speaker before `last` */ prev: VoiceNo; next: VoiceNo; /** names heard in the current chapter */ seen: Set<string> }
export const newCast = (): CastState => ({ names: new Map(), last: 0, prev: 0, next: 1, seen: new Set() })
const nextVoice = (v: VoiceNo): VoiceNo => ((v % 3) + 1) as VoiceNo

/**
 * The voice of one SPOKEN sentence. A named speaker keeps one voice for the whole chapter (first seen = Pip, then Dro, then Zee, then around again).
 * An unnamed quote in a NEW paragraph answers the last speaker with a different voice; inside a paragraph the speaker stays.
 */
export function voiceFor(cast: CastState, sentence: string, newParagraph: boolean): VoiceNo {
  const name = speakerName(sentence)
  let v: VoiceNo
  if (name) {
    cast.seen.add(name)
    const known = cast.names.get(name)
    if (known) v = known
    else { v = cast.next; cast.next = nextVoice(cast.next); cast.names.set(name, v) }
  } else if (cast.last === 0) { v = cast.next; cast.next = nextVoice(cast.next) }
  else if (!newParagraph) v = cast.last
  else if (cast.prev && cast.prev !== cast.last) v = cast.prev
  else { v = cast.next; if (v === cast.last) v = nextVoice(v); cast.next = nextVoice(v) }
  if (v !== cast.last) cast.prev = cast.last
  cast.last = v
  return v
}

/** a new chapter keeps the book's cast (so Alice is always the same voice) but forgets who spoke last */
export function startChapter(cast: CastState): void { cast.last = 0; cast.prev = 0; cast.seen = new Set() }
