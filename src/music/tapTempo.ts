// Pure tap-tempo maths (no clock, no stores), shared by masterClock.ts and scripts/loop-fixtures.ts.
// Hand taps jitter by 20-50 ms and one stray tap ruins a first-to-last average. We keep the last 8 taps, work from the gaps, throw away
// gaps that are not near the median (a missed or doubled tap) and average the rest. A pause over 2 s starts a fresh count.
export const TAP_RESET_MS = 2000
export const TAP_KEEP = 8
export function pushTap(taps: number[], at: number): number[] {
  const t = taps.length && at - taps[taps.length - 1] > TAP_RESET_MS ? [] : taps.slice()
  t.push(at)
  while (t.length > TAP_KEEP) t.shift()
  return t
}
/** bpm from tap times (ms), or null with fewer than 2 taps */
export function bpmFromTaps(taps: number[]): number | null {
  if (taps.length < 2) return null
  const gaps: number[] = []
  for (let i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1])
  const sorted = [...gaps].sort((a, b) => a - b)
  const med = sorted[Math.floor(sorted.length / 2)]
  const good = gaps.filter((g) => g > med * 0.65 && g < med * 1.5)
  const mean = good.reduce((a, b) => a + b, 0) / good.length
  return mean > 0 ? 60000 / mean : null
}
