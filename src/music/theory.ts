// Shared music-theory helpers. Pure functions, no state.
// STABLE API: other features import these. Add new exports freely; don't change existing signatures.

export const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export type ScaleType = 'major' | 'minor' | 'majorPentatonic' | 'minorPentatonic' | 'blues' | 'chromatic'

/** Semitone offsets from the tonic. */
export const SCALES: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

export const SCALE_LABEL: Record<ScaleType, string> = {
  major: 'major',
  minor: 'minor',
  majorPentatonic: 'major pentatonic',
  minorPentatonic: 'minor pentatonic',
  blues: 'blues',
  chromatic: 'chromatic',
}

export interface Key {
  tonic: number // pitch class 0-11
  scale: ScaleType
}

export const pc = (note: number) => ((note % 12) + 12) % 12
export const noteName = (note: number) => PC_NAMES[pc(note)] + (Math.floor(note / 12) - 1)
export const keyName = (k: Key) => `${PC_NAMES[k.tonic]} ${SCALE_LABEL[k.scale]}`

export function inKey(note: number, key: Key): boolean {
  return SCALES[key.scale].includes(pc(note - key.tonic))
}

/** Scale degree (0-based) of a note in a key, or -1 if not in the key. */
export function degree(note: number, key: Key): number {
  return SCALES[key.scale].indexOf(pc(note - key.tonic))
}

/** All MIDI notes of the key between lo and hi inclusive. */
export function scaleNotes(key: Key, lo: number, hi: number): number[] {
  const out: number[] = []
  for (let n = lo; n <= hi; n++) if (inKey(n, key)) out.push(n)
  return out
}

// Krumhansl-Kessler key profiles.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function corr(a: number[], b: number[]) {
  const ma = a.reduce((s, x) => s + x, 0) / 12
  const mb = b.reduce((s, x) => s + x, 0) / 12
  let num = 0, da = 0, db = 0
  for (let i = 0; i < 12; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? num / Math.sqrt(da * db) : 0
}

/** Best-guess major/minor key for a list of notes (optionally weighted, e.g. by duration). */
export function detectKey(notes: number[], weights?: number[]): { key: Key; confidence: number } {
  const hist = new Array(12).fill(0)
  notes.forEach((n, i) => (hist[pc(n)] += weights?.[i] ?? 1))
  let best: Key = { tonic: 0, scale: 'major' }
  let bestR = -Infinity
  for (let t = 0; t < 12; t++) {
    for (const [scale, prof] of [['major', MAJOR_PROFILE], ['minor', MINOR_PROFILE]] as const) {
      const rotated = prof.map((_, i) => prof[pc(i - t)])
      const r = corr(hist, rotated)
      if (r > bestR) { bestR = r; best = { tonic: t, scale } }
    }
  }
  return { key: best, confidence: Math.max(0, bestR) }
}
