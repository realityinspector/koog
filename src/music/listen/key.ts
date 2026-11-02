// Key finding (Krumhansl-Kessler profiles). Pure.
import { pc, type Key } from './pitch'

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
