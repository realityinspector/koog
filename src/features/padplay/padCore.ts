// Game pads, the pure part: which note each of the 8 pads plays. No DOM, no stores, so scripts/padplay-fixtures.ts can test it.
// The live wiring (controller MIDI, the note feed, LEDs) is padplay.ts.
//
//   Scale map          the 8 pads are the 8 notes of the key's scale, tonic to octave (pads A1-A4 = the low 4, B1-B4 = the high 4)
//   Follow the game    the notes the game wants next (guide targets, then the 'soon' notes) are always on pads. The layout is kept still
//                      while a phrase is in progress; it is only rebuilt between phrases. A note that is missing mid-phrase takes over
//                      the pad of a note nobody needs (the pad nearest in pitch), and no other pad moves.
//   Octave jog         JOG A turns the whole scale map up or down an octave (-2 .. +2)
import { PC_NAMES, SCALES, type Key } from '../../music/listen/pitch'

export const N_PADS = 8
export type PadMapKind = 'scale' | 'follow'
export const OCT_MIN = -2, OCT_MAX = 2
export const clampOct = (o: number) => Math.max(OCT_MIN, Math.min(OCT_MAX, Math.round(o)))
/** the pad ids in layout order: A1 A2 A3 A4 B1 B2 B3 B4 (left to right on the controller) */
export const PAD_IDS = ['pad1.A', 'pad2.A', 'pad3.A', 'pad4.A', 'pad1.B', 'pad2.B', 'pad3.B', 'pad4.B']
export const padIndex = (id: string) => PAD_IDS.indexOf(id)
export const padName = (i: number) => `${i < 4 ? 'A' : 'B'}${(i % 4) + 1}`

/** the tonic nearest middle C, from G3 (55) up to F#4 (66) */
export const baseOf = (tonic: number) => 60 + (tonic > 6 ? tonic - 12 : tonic)

const fit = (n: number) => { while (n > 127) n -= 12; while (n < 0) n += 12; return n }

/** Scale map: the 8 notes of the scale from the tonic (a 5-note scale keeps climbing into the next octave). */
export function scaleNotes(key: Key, oct = 0): number[] {
  const st = SCALES[key.scale] ?? SCALES.major, base = baseOf(key.tonic) + 12 * clampOct(oct)
  return Array.from({ length: N_PADS }, (_, i) => fit(base + st[i % st.length] + 12 * Math.floor(i / st.length)))
}

/** every scale note of the key between low and high (MIDI), ascending */
function scalePool(key: Key, low = 24, high = 108): number[] {
  const st = SCALES[key.scale] ?? SCALES.major, out: number[] = []
  for (let n = low; n <= high; n++) if (st.includes((((n - key.tonic) % 12) + 12) % 12)) out.push(n)
  return out
}
const uniq = (a: number[]) => [...new Set(a)]

export interface Want { targets: number[]; soon: number[] }
export const sameLayout = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i])

/** Build a fresh layout around the wanted notes: those notes, plus the scale notes nearest to them, low to high. */
export function windowLayout(want: Want, key: Key): number[] {
  const needed = uniq([...want.targets, ...want.soon]).slice(0, N_PADS)
  const ref = want.targets.length ? want.targets : needed
  const sorted = [...ref].sort((a, b) => a - b)
  const centre = sorted[Math.floor(sorted.length / 2)] ?? 60
  const chosen = new Set(needed)
  const pool = scalePool(key).filter((n) => !chosen.has(n)).sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre) || a - b)
  for (const n of pool) { if (chosen.size >= N_PADS) break; chosen.add(n) }
  return [...chosen].sort((a, b) => a - b)
}

/**
 * Follow the game. `prev` = the layout now (null = none yet), `midPhrase` = true while the player is in the middle of a phrase.
 *  - nothing wanted: between phrases (or no layout) the scale map; mid-phrase the layout stays.
 *  - every wanted note already on a pad: nothing moves (when between phrases, a missing 'soon' note triggers a rebuild).
 *  - between phrases: a fresh window around the wanted notes.
 *  - mid-phrase: each missing note takes the pad of the unneeded note nearest in pitch; nothing else moves.
 */
export function followLayout(prev: number[] | null, want: Want, key: Key, oct: number, midPhrase: boolean): number[] {
  const scale = scaleNotes(key, oct)
  if (!want.targets.length) return !prev || !midPhrase ? scale : prev
  const needed = uniq([...want.targets, ...want.soon])
  if (prev && want.targets.every((t) => prev.includes(t)) && (midPhrase || needed.every((n) => prev.includes(n)))) return prev
  if (!prev || !midPhrase) {
    if (!prev || !needed.every((n) => prev.includes(n))) return windowLayout(want, key)
    return prev
  }
  const out = prev.slice()
  for (const m of needed) {
    if (out.includes(m)) continue
    let best = -1, bd = Infinity
    for (let i = 0; i < out.length; i++) {
      if (needed.includes(out[i])) continue
      const d = Math.abs(out[i] - m)
      if (d < bd) { bd = d; best = i }
    }
    if (best < 0) { // every pad is wanted: only a 'soon' note may be bumped, never a target
      if (want.targets.includes(m)) { for (let i = out.length - 1; i >= 0; i--) if (!want.targets.includes(out[i])) { best = i; break } }
      if (best < 0) continue
    }
    out[best] = m
  }
  return out
}

/** which pads are lit steadily: the pad of every target note */
export function targetPads(layout: number[], targets: number[]): number[] {
  const out: number[] = []
  layout.forEach((n, i) => { if (targets.includes(n)) out.push(i) })
  return out
}

/** "C", "F#" ... and "C4" / "C5" when the same letter appears twice on the pads (so the two C's of a scale are told apart) */
export function padLabels(layout: number[]): string[] {
  const letter = (n: number) => PC_NAMES[((n % 12) + 12) % 12]
  const count = new Map<string, number>()
  for (const n of layout) count.set(letter(n), (count.get(letter(n)) ?? 0) + 1)
  return layout.map((n) => (count.get(letter(n))! > 1 ? letter(n) + (Math.floor(n / 12) - 1) : letter(n)))
}

/** Jog ticks -> octave steps. 4 ticks of the wheel = one octave. Returns the new leftover and the step (-1, 0, +1). */
export const JOG_TICKS = 4
export function octaveJog(acc: number, ticks: number): { acc: number; step: number } {
  const a = acc + ticks
  if (a >= JOG_TICKS) return { acc: 0, step: 1 }
  if (a <= -JOG_TICKS) return { acc: 0, step: -1 }
  return { acc: a, step: 0 }
}

// ---- LEDs: a pad's light may only switch ON again 334 ms after it last switched on (under 3 flashes a second, however fast the notes fly) ----
export const LED_MIN_GAP_MS = 334
export const FLASH_MS = 130
/** `cur` = what each LED shows now, `want` = what it should show, `onAt` = when each last switched on (mutated). Returns the new state. */
export function gateLeds(cur: boolean[], want: boolean[], onAt: number[], now: number): boolean[] {
  return want.map((w, i) => {
    const c = !!cur[i]
    if (!w) return false
    if (c) return true
    if (now - (onAt[i] ?? -1e9) < LED_MIN_GAP_MS) return false
    onAt[i] = now
    return true
  })
}

/** the labels the drawn controller shows while Game pads is on */
export function padLabelMap(labels: string[], oct: number, map: PadMapKind): Record<string, string> {
  const L: Record<string, string> = { 'jog.A': oct ? `OCT ${oct > 0 ? '+' : ''}${oct}` : 'OCT', 'jog.B': '', 'padmode.A': map === 'scale' ? 'SCALE' : 'FOLLOW', 'padmode.B': map === 'scale' ? 'SCALE' : 'FOLLOW' }
  for (const k of ['A', 'B']) { L[`play.${k}`] = 'GO'; L[`cue.${k}`] = 'HEAR'; L[`sync.${k}`] = 'BACK' }
  PAD_IDS.forEach((id, i) => { L[id] = labels[i] ?? '' })
  return L
}

export const HELP_MAP: { keys: string; does: string }[] = [
  { keys: 'Pads A1-A4, B1-B4', does: 'Play the 8 notes shown on the pads. A = the low four, B = the high four.' },
  { keys: 'JOG A', does: 'Turn the pads up or down an octave.' },
  { keys: 'PLAY', does: 'Start, or go on: the same as the big Start / GO button or the foot pedal.' },
  { keys: 'CUE', does: 'Hear it again, if the game has it.' },
  { keys: 'SYNC', does: 'Pause or back to the menu, if the game has it.' },
]
