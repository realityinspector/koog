// Pure: Sentence -> Score. A chord word is one stroke; a digit is one note; a spelled word is the spell chord, one note per row/column hop, then the spell-end chord.
// Timing (beats): a word starts every chordBeats + wordGapBeats (default 0.75 + 1) so the rest between words is a real word gap; spell hops are 0.5 beat apart.
// A '?' sentence lifts its last word by a whole step here (liftApplied = true), so playback never has to. Deterministic and stable.
// Tested by scripts/koogalien-fixtures.ts
import { SPELL_END } from '../data/alphabet'
import { alienById } from '../data/aliens'
import { VEL_OF_LOUD } from '../data/tone'
import { midiOfDegree, degreeOf } from '../data/degrees'
import { KOOGALIEN_VERSION } from '../data/types'
import type { Chord, ChordEvent, Dims, EncodeOpts, ModEvent, Score, Sentence, WordSlot } from '../data/types'

export const LIFT_SEMITONES = 2
export const HOP_BEATS = 0.5

const DIM_KEYS: (keyof Dims)[] = ['bass', 'durationClass', 'dyn', 'arp', 'rhythm', 'keyCenter', 'mode', 'register', 'tempo', 'mod']
export function dimsOf(w: WordSlot): Dims | undefined {
  const d: Dims = {}
  let any = false
  for (const k of DIM_KEYS) if (w[k] !== undefined) { (d as Record<string, unknown>)[k] = w[k]; any = true }
  return any ? d : undefined
}

const CLOSER: Record<string, Chord> = { '.': [5, 8], '?': [2, 5], '!': [1, 3, 5, 8] }

export function encode(s: Sentence, o: EncodeOpts): Score {
  const bpm = o.bpm > 0 ? o.bpm : 100
  const alien = alienById(o.alien ?? s.alien ?? '')
  const home = o.homeC ?? alien?.centre ?? 60
  const cap = Math.min(0.85, o.velCap ?? 0.85)
  const chordBeats = o.chordBeats ?? 0.75
  const gap = o.wordGapBeats ?? 1
  const chords: ChordEvent[] = []
  const mods: ModEvent[] = []
  const wordStarts: number[] = []
  let at = 0

  const ev = (word: number, degrees: Chord, start: number, dur: number, vel: number, dims?: Dims): ChordEvent => {
    const midi = degrees.map(d => midiOfDegree(d, home))
    if (dims?.bass !== undefined && degreeOf(dims.bass, home) === degrees[0] && dims.bass <= midi[0]) midi[0] = dims.bass
    const e: ChordEvent = { word, degrees, midi, at: start, dur, vel: Math.min(cap, vel) }
    if (dims) e.dims = dims
    return e
  }

  s.words.forEach((w, i) => {
    wordStarts.push(at)
    const vel = VEL_OF_LOUD[w.tone.loud]
    const dims = dimsOf(w)
    let spanEnd: number
    if (w.kind === 'spelled') {
      let t = at
      w.chords.forEach((c, k) => {
        const isHop = c.length === 1
        const dur = isHop ? HOP_BEATS : chordBeats
        chords.push(ev(i, c, t, dur, vel, k === 0 ? dims : undefined))
        // the hop right after the spell chord waits a full chord; hops run 0.5 beat apart
        t += isHop ? HOP_BEATS : chordBeats
      })
      spanEnd = t
    } else {
      const c = w.chords[0] ?? []
      if (c.length) chords.push(ev(i, c, at, chordBeats, vel, dims))
      spanEnd = at + chordBeats
    }
    for (const m of w.tone.mods) mods.push({ word: i, mod: { name: m.name, depth: m.depth }, at, dur: Math.max(chordBeats, spanEnd - at) })
    at = spanEnd + gap
  })

  const endChord = CLOSER[s.end] ?? CLOSER['.']
  const closerStart = s.words.length ? at : 0
  chords.push(ev(s.words.length, endChord, closerStart, chordBeats, s.end === '!' ? VEL_OF_LOUD.loud : VEL_OF_LOUD.normal))
  const score: Score = { v: KOOGALIEN_VERSION, bpm, beats: closerStart + chordBeats, chords, mods, wordStarts }

  if (s.end === '?' && s.words.length) {
    const last = s.words.length - 1
    score.liftAt = wordStarts[last]
    for (const e of chords) if (e.word === last) e.midi = e.midi.map(m => m + LIFT_SEMITONES)
    score.liftApplied = true
  }
  void SPELL_END
  return score
}
