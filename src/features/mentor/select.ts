// Which pending move does the Mentor say next? Pure (no stores, no timers), so the balance can be simulated.
// Rules, in order:
//   - honest balance: a real critique competes with praise on score, so a sloppy stretch gets called out instead of
//     buried under "nice flow!". At most 2 critiques in a row while praise is waiting (no nagging).
//   - no praise twice in a row for the same thing (same kind, or the same quoted tune).
//   - no contradictions: right after a critique, praise that says the opposite is dropped for a while
//     (no "you rushed" followed by "steady beat!").
import type { MoveKind } from './lines'

export interface Cand { kind: MoveKind; topic: string; score: number; critique?: boolean }
export interface SelState {
  /** kinds this kid has ever heard / heard today (novelty bonus for praise) */
  everSeen: (k: MoveKind) => boolean
  seenToday: (k: MoveKind) => boolean
  /** recent spoken kinds, newest last */
  recentKinds: MoveKind[]
  lastPraise: { kind: MoveKind; topic: string } | null
  lastCritique: { kind: MoveKind; at: number } | null
  /** critiques said since the last praise */
  critStreak: number
}

const STYLE: MoveKind[] = ['style-bach', 'style-satie', 'style-beethoven', 'style-mozart', 'style-chopin', 'style-debussy', 'style-joplin']
const TIME: MoveKind[] = ['steady', 'walking-bass', 'rhythm-motif', 'flow']
const LANDING: MoveKind[] = ['cadence', 'cadence-authentic', 'call-response', 'flow']
/** praise that would contradict a critique we just said */
export const CONTRA: Partial<Record<MoveKind, MoveKind[]>> = {
  'c-rushing': TIME, 'c-wobbly': TIME,
  'c-nohome': LANDING, 'c-abrupt': LANDING, 'c-wrongnote': [...LANDING, 'tension'],
  'c-wandering': [...LANDING, 'tension'],
  'c-stuck': ['range', 'flow', 'repetition', 'motif'], 'c-hammered': ['range', 'flow', 'repetition', 'motif', 'rhythm-motif'],
  'c-mashing': ['flow', 'range', 'cluster', 'motif', 'space', 'rhythm-motif', 'sequence', 'arpeggio', 'variation', ...STYLE],
  'c-banging': ['crescendo', 'decrescendo', 'style-beethoven'],
  'c-nospace': ['space', 'flow'],
}
export const CONTRA_MS = 15000

export function contradicts(c: Cand, st: SelState, now: number): boolean {
  const lc = st.lastCritique
  return !c.critique && !!lc && now - lc.at < CONTRA_MS && !!CONTRA[lc.kind]?.includes(c.kind)
}

export function rankPraise(c: Cand, st: SelState): number {
  const novelty = st.everSeen(c.kind) ? (st.seenToday(c.kind) ? 0 : 1.5) : 3
  return c.score + novelty + (st.recentKinds.includes(c.kind) ? -2 : 0)
}
export function rankCritique(c: Cand, st: SelState): number {
  return c.score + 1 + (st.recentKinds.slice(-6).includes(c.kind) ? -3 : 0)
}

/** index of the candidate to say, or -1 for nothing (yet) */
export function choose(cands: Cand[], st: SelState, now: number): number {
  let bp = -1, bpr = -Infinity, bc = -1, bcr = -Infinity
  cands.forEach((c, i) => {
    if (c.critique) { const r = rankCritique(c, st); if (r > bcr) { bcr = r; bc = i } return }
    if (contradicts(c, st, now)) return
    if (st.lastPraise && (c.kind === st.lastPraise.kind || c.topic === st.lastPraise.topic)) return
    const r = rankPraise(c, st); if (r > bpr) { bpr = r; bp = i }
  })
  if (bc >= 0 && st.critStreak >= 2 && bp >= 0) bc = -1 // two in a row already: let something good through first
  if (bc >= 0 && st.critStreak >= 3) bc = -1 // and never a third in a row
  if (bp < 0) return bc
  if (bc < 0) return bp
  return bcr >= bpr ? bc : bp
}
