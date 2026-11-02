// Shared types of the listening core (src/music/listen). Types only: no runtime code.
import type { Key } from './pitch'

/** One key going down. `t` is milliseconds on the caller's clock (the stages never read a clock themselves). */
export interface NoteOn { id: number; note: number; velocity: number; t: number }

/** 'tonic' = the home note, 'in' = in the key, 'out' = outside the key (was 'spicy'). */
export type NoteKind = 'tonic' | 'in' | 'out'

export type ChordQuality = 'major' | 'minor' | '7' | 'maj7' | 'm7' | 'dim' | 'aug' | 'sus4' | 'sus2'

export interface ChordInfo {
  /** pitch class 0-11 */
  root: number
  quality: ChordQuality
  /** display name, e.g. "C major", "G7", "A minor 7" */
  name: string
  /** the chord's pitch classes, root first */
  pcs: number[]
}

/** A snapshot of what the player is doing right now. Filled in by the runtime (a later wave). */
export interface Features {
  t: number
  key: Key
  keyConfidence: number
  chord: ChordInfo | null
  bpm: number
  /** recent note-ons, oldest first */
  recent: NoteOn[]
}

export type ListenEvent =
  | { type: 'note'; note: NoteOn; kind: NoteKind }
  | { type: 'chord'; chord: ChordInfo | null; t: number }
  | { type: 'key'; key: Key; confidence: number; t: number }
  | { type: 'tempo'; bpm: number; t: number }
