// Pitch basics for the listening core. Pure data and functions, no state. theory.ts re-exports all of this.

export const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const PC_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

export type ScaleType = 'major' | 'minor' | 'majorPentatonic' | 'minorPentatonic' | 'blues' | 'chromatic'

export interface Key {
  tonic: number // pitch class 0-11
  scale: ScaleType
}

/** Semitone offsets from the tonic. */
export const SCALES: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

/** MIDI notes below this are the left hand (middle C is 60; the split sits an octave above) */
export const LH_SPLIT = 72

/** Milliseconds per beat at a tempo. */
export const msPerBeat = (bpm: number) => 60000 / bpm

export const pc = (note: number) => ((note % 12) + 12) % 12

export function inKey(note: number, key: Key): boolean {
  return SCALES[key.scale].includes(pc(note - key.tonic))
}

/** Scale degree (0-based) of a note in a key, or -1 if not in the key. */
export function degree(note: number, key: Key): number {
  return SCALES[key.scale].indexOf(pc(note - key.tonic))
}
