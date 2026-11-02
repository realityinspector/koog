// Melodic contour: intervals and "is this too plain to identify a tune". Pure.

// "how surprising is this jump" in bits: steps and repeats are common, leaps are rare
const BITS: Record<number, number> = { 0: 2.4, 1: 2.8, 2: 2.4, 3: 3.2, 4: 3.2, 5: 3.6, 7: 4.2 }
export const intervalBits = (i: number) => BITS[Math.abs(i)] ?? 5
export const bitsOf = (iv: number[]) => iv.reduce((a, i) => a + intervalBits(i), 0)
export const intervalsOf = (ns: number[]) => ns.slice(1).map((n, i) => n - ns[i])

/** scales, runs of steps, repeated notes and trills say nothing about WHICH tune it is */
export function isTrivial(ns: number[]): boolean {
  if (ns.length < 3) return true
  const iv = intervalsOf(ns)
  const pcs = new Set(ns.map((n) => n % 12)).size
  const zeros = iv.filter((i) => i === 0).length
  if (pcs <= 1) return true
  // 4 notes may be "da da da DUM" (a repeat, then a leap); longer than that, mostly-repeats and trills are filler
  if (ns.length >= 5 && (pcs <= 2 || zeros * 2 > iv.length)) return true
  if (iv.every((i) => Math.abs(i) <= 2) && zeros === 0) {
    let turns = 0
    for (let k = 1; k < iv.length; k++) if (Math.sign(iv[k]) !== Math.sign(iv[k - 1])) turns++
    if (turns <= 1) return true // a scale, up, down, or up-and-down
  }
  return false
}
