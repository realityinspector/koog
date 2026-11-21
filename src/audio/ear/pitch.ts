// Pitch from a microphone buffer. Pure: a slice of samples in, a note out. No audio hardware.
// YIN (de Cheveigné): the first strong dip in the cumulative difference is the period.
// One note at a time. A chord is not split into separate notes.

export type EarKind = 'piano' | 'guitar' | 'voice'

export const EAR_RANGE: Record<EarKind, { minHz: number; maxHz: number; label: string }> = {
  piano: { minHz: 50, maxHz: 2100, label: 'Piano' },
  guitar: { minHz: 75, maxHz: 1400, label: 'Guitar' },
  voice: { minHz: 80, maxHz: 1100, label: 'Voice' },
}

export interface PitchHit { hz: number; midi: number; clarity: number }

const CLARITY = 0.85

/** Root-mean-square level of a buffer, 0..1 for a full-scale wave. */
export function frameRms(x: Float32Array): number {
  let s = 0
  for (let i = 0; i < x.length; i++) s += x[i] * x[i]
  return Math.sqrt(s / Math.max(1, x.length))
}

/**
 * Fundamental of `x` at `sampleRate`, inside minHz..maxHz.
 * Returns null when the buffer is quiet or the period is not clear enough to trust.
 */
export function detectPitch(x: Float32Array, sampleRate: number, minHz: number, maxHz: number): PitchHit | null {
  const n = x.length
  if (n < 64 || !(sampleRate > 0) || !(maxHz > minHz)) return null
  let energy = 0
  for (let i = 0; i < n; i++) energy += x[i] * x[i]
  if (energy < 1e-8 * n) return null

  const half = n >> 1
  // Search high enough that an out-of-range pitch is seen and rejected, instead of locking an octave lower.
  const minTau = Math.max(2, Math.floor(sampleRate / 4200))
  const maxTau = Math.min(half - 2, Math.ceil(sampleRate / minHz))
  if (maxTau <= minTau + 2) return null

  const d = new Float32Array(maxTau + 1)
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0
    const lim = n - tau
    for (let i = 0; i < lim; i++) {
      const diff = x[i] - x[i + tau]
      sum += diff * diff
    }
    d[tau] = sum
  }

  const cm = new Float32Array(maxTau + 1)
  cm[0] = 1
  let run = 0
  for (let tau = 1; tau <= maxTau; tau++) {
    run += d[tau]
    cm[tau] = run > 0 ? (d[tau] * tau) / run : 1
  }

  const TH = 0.15
  let tau = -1
  for (let t = minTau; t <= maxTau; t++) {
    if (cm[t] < TH) {
      while (t + 1 <= maxTau && cm[t + 1] < cm[t]) t++
      tau = t
      break
    }
  }
  if (tau < 0) return null

  let better = tau
  if (tau > 1 && tau < maxTau) {
    const s0 = cm[tau - 1], s1 = cm[tau], s2 = cm[tau + 1]
    const den = 2 * s1 - s2 - s0
    if (den !== 0) better = tau + (s2 - s0) / (2 * den)
  }
  if (!(better > 1)) return null
  const hz = sampleRate / better
  const clarity = 1 - cm[tau]
  if (clarity < CLARITY || hz < minHz * 0.98 || hz > maxHz * 1.02) return null
  return { hz, midi: 69 + 12 * Math.log2(hz / 440), clarity }
}
