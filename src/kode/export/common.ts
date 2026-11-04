// Shared bits of the code exporters (pure: no DOM, no audio, no store imports).
// Koog data in, readable text out. Nothing here runs kid code; the kid pastes the text into a free coding tool themselves.
export interface ExportNote { t: number; d: number; n: number; v: number } // beats; v is MIDI velocity 1..127
export interface ExportLayer { notes: ExportNote[]; name?: string }

/** 1/16 of a beat, the grid every export snaps to so the numbers stay readable */
export const GRID = 16
export const q16 = (beats: number): number => Math.round(beats * GRID) // beats -> whole sixteenths
/** sixteenths -> text with no float noise: 4 -> "0.25", 1 -> "0.0625", 16 -> "1" */
export function fmt16(sixteenths: number): string {
  const s = (sixteenths / GRID).toFixed(4)
  return s.replace(/\.?0+$/, '') || '0'
}
/** MIDI velocity 1..127 -> Sonic Pi amp 0.1..1.0 */
export const ampOf = (v: number): number => Math.round((0.1 + 0.9 * (Math.min(127, Math.max(1, v)) / 127)) * 100) / 100

/** one step in the timeline: everything that starts on the same sixteenth */
export interface Slot { at: number; notes: { n: number; len: number; v: number }[] } // at, len in sixteenths
/** snap notes to 1/16, wrap into the loop, merge duplicates of the same pitch+time, group by start time. Always at least a 1/16 long. */
export function slots(notes: ExportNote[], lenBeats: number): Slot[] {
  const total = Math.max(1, q16(lenBeats))
  const by = new Map<number, Slot>()
  for (const e of notes) {
    const at = ((q16(e.t) % total) + total) % total
    const len = Math.max(1, q16(e.d))
    const n = Math.max(0, Math.min(127, Math.round(e.n)))
    const s = by.get(at) ?? { at, notes: [] }
    if (!s.notes.some((x) => x.n === n)) s.notes.push({ n, len, v: e.v })
    by.set(at, s)
  }
  return [...by.values()].sort((a, b) => a.at - b.at).map((s) => ({ ...s, notes: s.notes.sort((a, b) => a.n - b.n) }))
}
export const loopSixteenths = (lenBeats: number): number => Math.max(1, q16(lenBeats))

const NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
/** MIDI 60 -> "c4" (middle C), the spelling Strudel reads */
export const noteName = (n: number): string => NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1)
