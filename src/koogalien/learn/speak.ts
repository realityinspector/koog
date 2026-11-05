// Pure: build Scores and Sentences for one word or a short run of words (so a Koogalien voice can say it). Tested by scripts/koogalien-learn-fixtures.ts
import { alienById } from '../data/aliens'
import { midiOfDegree } from '../data/degrees'
import type { Chord, Degree, EncodeOpts, LexEntry, Score, Sentence, WordSlot } from '../data/types'

export const slotOf = (e: LexEntry): WordSlot => ({
  kind: e.kind === 'number' && e.id.startsWith('digit-') ? 'digit' : 'word',
  id: e.id.startsWith('digit-') ? null : e.id,
  en: e.en, chords: [e.chord], tone: { loud: 'normal', mods: [] }, confidence: 1, status: 'ok',
})
/** `say hello.`-style sentence for the code row (one word, a period at the end) */
export const sentenceOf = (es: readonly LexEntry[]): Sentence => ({ v: 1, words: es.map(slotOf), end: '.' })

export const VOICES_BY_UNIT = (unit: number): string => (unit <= 3 ? 'pip' : unit <= 6 ? 'dro' : 'zee')
/** beats between the start of one word and the next, and how long a chord rings */
export const WORD_BEATS = 1.5
export const RING_BEATS = 1

/** the chords alone, no closer: what a voice "says" in the games. Notes are placed around the voice's own do. */
export function chordsScore(chords: readonly Chord[], alienId: string, bpm: EncodeOpts['bpm'] = 100, vel = 0.7): Score {
  const centre = alienById(alienId)?.centre ?? 60
  return {
    v: 1, bpm, beats: chords.length * WORD_BEATS + 0.5,
    chords: chords.map((c, i) => ({ word: i, degrees: c, midi: c.map((d) => midiOfDegree(d as Degree, centre)), at: i * WORD_BEATS, dur: RING_BEATS, vel })),
    mods: [], wordStarts: chords.map((_, i) => i * WORD_BEATS),
  }
}
/** a letter: its row note, then its column note, as two lone notes */
export const letterScore = (row: number, col: number, alienId: string, bpm = 100): Score => chordsScore([[row as Degree], [col as Degree]], alienId, bpm)
