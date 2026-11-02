// Rhythm and density tests. Pure: durations and notes are passed in.

// simple duration ratios (log2): 1/4, 1/3, 1/2, 2/3, 1, 3/2, 2, 3, 4
const RATIOS = [-2, -1.585, -1, -0.585, 0, 0.585, 1, 1.585, 2]

/** 0..1: how close is this gap to a simple multiple/fraction of the previous gap? */
export function rhythmScore(ioi: number, prev: number) {
  const r = Math.log2(ioi / prev)
  let d = Infinity
  for (const x of RATIOS) d = Math.min(d, Math.abs(r - x))
  return Math.max(0, Math.min(1, 1 - d / 0.2))
}

function closePairs(ns: number[]) {
  const u = [...new Set(ns)].sort((a, b) => a - b)
  let c = 0
  for (let i = 1; i < u.length; i++) if (u[i] - u[i - 1] <= 2) c++
  return c
}
// Forearm test: 4+ notes at once, packed shoulder-to-shoulder (3+ neighbours a step apart), or 7+ notes at all.
// Real chords are spread out (C E G = gaps of 4 and 3), so they never trip it.
export const isCluster = (ns: number[]) => (ns.length >= 4 && closePairs(ns) >= 3) || ns.length >= 7

/** 0..1: do the note lengths of a window (onset times) rise and fall like the source's beat lengths? (ratios, so tempo does not matter) */
export function rhythmSim(times: number[], beats: number[]): number {
  const n = times.length - 1 // intervals between onsets
  if (n < 3 || beats.length < n) return 0.5
  let d = 0, c = 0
  for (let k = 1; k < n; k++) {
    const a = (times[k + 1] - times[k]) / Math.max(1, times[k] - times[k - 1])
    const b = beats[k] / Math.max(1e-6, beats[k - 1])
    d += Math.abs(Math.log2(a / b)); c++
  }
  return Math.max(0, 1 - d / c / 0.8)
}
