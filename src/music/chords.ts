import { analyseChord } from './listen/chord'

/** Name a chord from held MIDI notes (needs 3+ distinct pitch classes), or null. */
export const detectChord = (notes: number[]): string | null => analyseChord(notes)?.name ?? null
