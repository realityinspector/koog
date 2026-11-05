// Pure: shared Koogalien types. Only builder A edits this file. Tested by scripts/koogalien-fixtures.ts
export const KOOGALIEN_VERSION = 1

export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
/** a sorted, de-duplicated set of 1..4 degrees pressed together (1 degree alone = a digit outside spell mode) */
export type Chord = readonly Degree[]

/** the sound-shaping layer. v1 uses only 'wobble' (excited); the rest are reserved so the types never change. */
export type ModName = 'wobble' | 'sweep' | 'bend' | 'tremolo' | 'filter'
export interface ModSpec { name: ModName; /** 0..1 */ depth: number }
export type Loudness = 'soft' | 'normal' | 'loud'
export interface Tone { loud: Loudness; mods: ModSpec[] }

export type WordKind = 'greeting' | 'noun' | 'verb' | 'pronoun' | 'feeling' | 'question' | 'color' | 'number' | 'connector' | 'name' | 'code' | 'closer' | 'control'
export type Ending = '.' | '?' | '!'

export interface LexEntry {
  id: string           // stable lowercase id; closers are 'period' | 'question' | 'shout'
  en: string           // the English it reads as ('.' for the period closer)
  emoji: string
  kind: WordKind
  chord: Chord         // 1..4 degrees; the single-degree chords are reserved for digits
  tier: 1 | 2 | 3      // LANGUAGE.md tiers
  unit: number         // curriculum unit that introduces it (1..9)
  alt?: string[]       // other English words that map here
  /** word-frequency rank in everyday English (1 = most common); lets a future book translator pick which words earn a chord */
  freq?: number
  /** reserved word forms (plural, intensity, family); v1 uses none */
  forms?: { plural?: string; intensity?: string[]; family?: string }
  /** the 'why it sounds right' line from LANGUAGE.md */
  why?: string
}

/** a letter in spell mode: a row note (1..7) then a column note (1..4) */
export interface Glyph { ch: string; row: number; col: number; unit: number }

/**
 * RESERVED musical dimensions (THESIS.md "Reaching literature"). v1 gives none of them a meaning: matching folds to degrees and ignores them.
 * They are optional, default to plain when absent, and travel unchanged through encode and decode so a later version can give them words.
 */
export interface Dims {
  /** raw lowest MIDI note of the stroke (kept even though v1 folds to degrees); an inversion shows as bass != root */
  bass?: number
  durationClass?: 'short' | 'long'
  dyn?: 'soft' | 'mid' | 'loud'
  arp?: 'none' | 'up' | 'down'
  /** reserved rhythm pattern id */
  rhythm?: string
  /** reserved key centre as pitch class 0..11 */
  keyCenter?: number
  mode?: 'major' | 'minor'
  /** reserved octave register offset from home */
  register?: number
  /** reserved tempo class or bpm */
  tempo?: number
  /** reserved: a named modulation other than the v1 Tone mods */
  mod?: string
}

/** one thing in a sentence */
export type SlotKind = 'word' | 'digit' | 'spelled' | 'unknown'
export interface WordSlot extends Dims {
  kind: SlotKind
  /** lexicon id when kind === 'word' */
  id: string | null
  /** English text as it reads: 'hello', '3', 'MAYA' (spelled keeps the case of the source) */
  en: string
  /** the chords as played or encoded (a spelled word: spell chord, then the single notes, as degrees) */
  chords: Chord[]
  tone: Tone
  /** 0..1: how sure the recognizer is. 1 for words made by code or text */
  confidence: number
  alts?: { id: string; confidence: number }[]
  status: 'ok' | 'maybe' | 'unknown'
}

/** THE hub value. Every view is a pure function of this. */
export interface Sentence { v: number; words: WordSlot[]; end: Ending; alien?: string }

export interface Koogalien {  // a voice
  id: string; name: string; emoji: string
  patch: Record<string, number | string>   // partial synth params applied while this voice speaks
  centre: number                            // MIDI note of the voice's do
  greeting: string                          // Koogalien code, e.g. 'say hello.'
}

export interface Diag { message: string; start: number; end: number; line: number; col: number; hint?: string }

/** timing: one beat = one quarter note */
export interface ChordEvent { word: number; degrees: Chord; midi: number[]; at: number; dur: number; vel: number; /** reserved dimensions of the word this stroke belongs to, passed through unchanged */ dims?: Dims }
export interface ModEvent { word: number; mod: ModSpec; at: number; dur: number }
export interface Score { v: number; bpm: number; beats: number; chords: ChordEvent[]; mods: ModEvent[]; wordStarts: number[]; /** beat where a '?' lifts the last word */ liftAt?: number; /** true when encode already lifted the last word's notes for a '?' (playScore must not lift again) */ liftApplied?: boolean }

export interface EncodeOpts { bpm: number; homeC?: number; chordBeats?: number; wordGapBeats?: number; alien?: string; velCap?: number }

/** what the recognizer reads besides tokens */
export interface ModSample { kind: 'wheel' | 'bend' | 'knob' | 'slider'; /** 0..1 (bend -1..1) */ value: number; t: number }

export interface DecodeOpts {
  bpm: number
  homeC: number            // MIDI note of do. default 60
  chordMs: number          // default 70
  wordGapBeats: number     // default 1
  wordGapFloorMs: number   // default 400 (free time)
  sentenceGapBeats: number // default 2
  slowChordMs: number      // default 1000
  modHoldMs: number        // default 250
  modThreshold: number     // default 0.4
  known?: ReadonlySet<string>
  /** lead decision 2: a 'maybe' normally WAITS for the kid to confirm. true = take the best guess. Default false. */
  autoAccept?: boolean
  /** accessibility: keys stay lit until a 'commit' (the chord window is off) */
  chordBuilder?: boolean
}
export const DEFAULT_DECODE: DecodeOpts = { bpm: 100, homeC: 60, chordMs: 70, wordGapBeats: 1, wordGapFloorMs: 400, sentenceGapBeats: 2, slowChordMs: 1000, modHoldMs: 250, modThreshold: 0.4, autoAccept: false }

export const LIMITS = { lettersPerSpell: 20, wordsPerSentence: 32, codeChars: 400, shareChars: 400, outbox: 50 } as const
