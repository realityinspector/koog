// Shared music-theory helpers. Pure functions, no state.
// STABLE API: other features import these. Add new exports freely; don't change existing signatures.
// The pitch basics and key finding now live in ./listen (pitch, key); they are re-exported here so imports keep working.
import { PC_NAMES, pc, type Key, type ScaleType } from './listen/pitch'

export { PC_NAMES, PC_FLAT, SCALES, LH_SPLIT, msPerBeat, pc, inKey, degree } from './listen/pitch'
export type { Key, ScaleType } from './listen/pitch'
export { detectKey } from './listen/key'

export const SCALE_LABEL: Record<ScaleType, string> = {
  major: 'major',
  minor: 'minor',
  majorPentatonic: 'major pentatonic',
  minorPentatonic: 'minor pentatonic',
  blues: 'blues',
  chromatic: 'chromatic',
}

export const noteName = (note: number) => PC_NAMES[pc(note)] + (Math.floor(note / 12) - 1)
export const keyName = (k: Key) => `${PC_NAMES[k.tonic]} ${SCALE_LABEL[k.scale]}`

