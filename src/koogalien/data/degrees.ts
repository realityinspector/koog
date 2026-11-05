// Pure: degree helpers. Tested by scripts/koogalien-fixtures.ts
import type { Chord, Degree } from './types'
const WHITE = [0, 2, 4, 5, 7, 9, 11]   // C D E F G A B -> degrees 1..7
export function degreeOf(midi: number, homeC: number): Degree | null {
  const pc = ((midi % 12) + 12) % 12
  const i = WHITE.indexOf(pc)
  if (i < 0) return null
  if (i === 0) return midi >= homeC + 12 ? 8 : 1
  return (i + 1) as Degree
}
export function midiOfDegree(d: Degree, homeC: number): number { return d === 8 ? homeC + 12 : homeC + WHITE[d - 1] }
export const chordKey = (c: Chord): string => c.join('+')
