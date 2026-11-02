// Tempo guessing from note onsets. Pure: times are passed in.
export const MIN_BPM = 70
export const MAX_BPM = 140
export const DEFAULT_BPM = 96

/**
 * Guess her tempo from when her notes start. Take the gaps between note starts, use the median
 * (so one stray gap doesn't matter), turn it into bpm, fold into 70-140 and ease toward it.
 * With too little to go on, keep the previous tempo.
 */
export function estimateBpm(onsetsMs: number[], prev: number = DEFAULT_BPM): number {
  const ons: number[] = []
  for (const t of onsetsMs) if (!ons.length || t - ons[ons.length - 1] >= 70) ons.push(t) // a chord = one onset
  const recent = ons.slice(-9)
  const iois: number[] = []
  for (let i = 1; i < recent.length; i++) {
    const d = recent[i] - recent[i - 1]
    if (d >= 150 && d <= 1500) iois.push(d)
  }
  if (iois.length < 3) return clampBpm(prev)
  iois.sort((a, b) => a - b)
  const mid = iois.length >> 1
  const med = iois.length % 2 ? iois[mid] : (iois[mid - 1] + iois[mid]) / 2
  let bpm = 60000 / med
  while (bpm > MAX_BPM) bpm /= 2
  while (bpm < MIN_BPM) bpm *= 2
  return clampBpm(prev + (bpm - prev) * 0.35)
}

export const clampBpm = (b: number) => Math.round(Math.max(MIN_BPM, Math.min(MAX_BPM, b)))
