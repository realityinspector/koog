// Pure: gather notes pressed together into one chord (a "chord window"), with injected times. Tested by scripts/koogalien-learn-fixtures.ts
import type { Chord, Degree } from '../data/types'
import { degreeOf } from '../data/degrees'

export const CHORD_MS = 90
export interface Win { start: number | null; degrees: Degree[] }
export const emptyWin = (): Win => ({ start: null, degrees: [] })

/** a key or pad press joins the open window (or opens one) */
export function press(w: Win, d: Degree, t: number): Win {
  if (w.start === null) return { start: t, degrees: [d] }
  return w.degrees.includes(d) ? w : { start: w.start, degrees: [...w.degrees, d] }
}
/** if the window has been open long enough, close it and hand back the chord */
export function flush(w: Win, now: number, ms = CHORD_MS): { win: Win; chord: Chord | null } {
  if (w.start === null || now - w.start < ms) return { win: w, chord: null }
  return { win: emptyWin(), chord: [...w.degrees].sort((a, b) => a - b).slice(0, 4) as unknown as Chord }
}

/** the degree a Kode token means: piano keys fold to the white keys C..C', pads 0..7 are degrees 1..8, black keys and buttons are nothing */
export function degreeOfToken(tok: { src: string; pitch?: number; lane?: number; value: number }, homeC = 60): Degree | null {
  if (tok.src === 'drums' || tok.src === 'dj') {
    const lane = tok.lane ?? tok.value
    return lane >= 0 && lane <= 7 ? ((lane + 1) as Degree) : null
  }
  if (tok.src === 'keys' || tok.src === 'midi') return degreeOf(tok.pitch ?? tok.value, homeC)
  return null
}
