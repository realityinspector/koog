// Pure: tone meanings. v1 ships loudness plus wobble = excited; the rest of ModName is reserved (LANGUAGE.md 7b). Tested by scripts/koogalien-fixtures.ts
import type { Loudness, ModName } from './types'
export const MOD_MEANINGS: readonly { name: ModName; sources: ('wheel' | 'bend' | 'knob' | 'slider')[]; en: string }[] = [
  { name: 'wobble', sources: ['wheel', 'knob', 'slider'], en: 'excited' },
]
/** velocity bands (0..1). Playback caps at 0.85 regardless. */
export const LOUD_BANDS = { softBelow: 0.35, loudAbove: 0.64 } as const
export const loudnessOfVel = (vel: number): Loudness => (vel < LOUD_BANDS.softBelow ? 'soft' : vel > LOUD_BANDS.loudAbove ? 'loud' : 'normal')
/** encoder velocity for each loudness (under the 0.85 cap) */
export const VEL_OF_LOUD: Record<Loudness, number> = { soft: 0.25, normal: 0.5, loud: 0.85 }
