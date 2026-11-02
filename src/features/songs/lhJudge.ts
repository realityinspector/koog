// Left-hand judging for SONGS (Easy chords / Full). Pure bookkeeping, no audio, no React.
// The melody is judged exactly as before. The left hand is a bonus layer with partial credit: each target
// ("play a chord tone of this chord around now") is hit or missed, and a miss never hurts the melody score.
import type { Arrangement } from '../../music/arrange'
import { LH_SPLIT, pc } from '../../music/listen/pitch'

export { LH_SPLIT }


export interface LhTarget { start: number; end: number; pcs: number[]; idxs: number[]; hit: boolean; done: boolean }
export interface LhState { targets: LhTarget[]; hits: number; total: number }
/** how early / late (in beats) a left-hand note may be and still count */
export const EARLY = 0.45, LATE = 0.3

export function makeLh(arr: Arrangement | null): LhState {
  const targets = (arr?.targets ?? []).map((t) => ({ ...t, hit: false, done: false }))
  return { targets, hits: 0, total: targets.length }
}
/** a key went down at beat position p (wait mode: the beat of the melody note we are waiting for). True if it earned left-hand credit. */
export function lhPress(st: LhState, midi: number, p: number): boolean {
  if (midi >= LH_SPLIT) return false
  for (const t of st.targets) {
    if (t.hit || t.done) continue
    if (p >= t.start - EARLY && p < t.end + LATE && t.pcs.includes(pc(midi))) { t.hit = true; st.hits++; return true }
  }
  return false
}
/** a low chord tone of a chord that is sounding now, even if its credit is already taken (extra left-hand notes are never "wrong") */
export function lhNear(st: LhState, midi: number, p: number): boolean {
  if (midi >= LH_SPLIT) return false
  return st.targets.some((t) => !t.done && p >= t.start - EARLY && p < t.end + LATE && t.pcs.includes(pc(midi)))
}
/** call as the song moves on: targets we have passed without a hit are finished (a miss, no penalty) */
export function lhAdvance(st: LhState, p: number, all = false) {
  for (const t of st.targets) if (!t.done && (all || p >= t.end + LATE)) t.done = true
}
/** left-hand event indexes that were hit (for green note heads) */
export const lhHitIdxs = (st: LhState) => st.targets.filter((t) => t.hit).flatMap((t) => t.idxs)
