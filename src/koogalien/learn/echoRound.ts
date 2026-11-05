// Pure: the rules of one Echo round (which rung each word is on, misses, peeks, stars). The screen only draws this state.
// Tested by scripts/koogalien-learn-fixtures.ts
import type { Chord, LexEntry } from '../data/types'
import { judgeWord } from './checks'
import { itemById } from './items'
import { isLearned, playRung, type Rung, type WordProg } from './ladder'

export interface Step { id: string; rung: Rung; /** item ids to play in order: one for a word, two or more for a short sentence */ want: string[]; sentence: boolean }
export interface StepResult { id: string; passed: boolean; stars: number; sentence: boolean }
export interface RoundState {
  steps: Step[]; i: number; k: number; misses: number; peeks: number; results: StepResult[]
  /** the id of the word the last wrong chord looked most like (for "that was X") */
  lastWrong: string | null
  /** the answer is being shown after too many misses */
  revealed: boolean
}
export type RoundEvent = 'right' | 'wrong' | 'word-done' | 'gave-up' | 'round-done' | 'none'

export const MAX_MISSES = 3

export function newRound(entries: readonly LexEntry[], prog: Record<string, WordProg>): RoundState {
  const steps: Step[] = entries.map((e) => ({ id: e.id, rung: playRung(prog[e.id]), want: [e.id], sentence: false }))
  const learned = entries.filter((e) => isLearned(prog[e.id]) && e.kind !== 'number')
  if (learned.length >= 2) steps.push({ id: `${learned[0].id}+${learned[1].id}`, rung: 'echo', want: [learned[0].id, learned[1].id], sentence: true })
  return { steps, i: 0, k: 0, misses: 0, peeks: 0, results: [], lastWrong: null, revealed: false }
}

export const isDone = (s: RoundState): boolean => s.i >= s.steps.length
export const current = (s: RoundState): Step | null => s.steps[s.i] ?? null
/** the entry the kid should play right now */
export function target(s: RoundState): LexEntry | null { const st = current(s); return st ? itemById(st.want[s.k]) ?? null : null }
export const starsFor = (misses: number, peeks: number): number => Math.max(1, 3 - misses - peeks)

function advance(s: RoundState, r: StepResult): RoundState {
  return { ...s, results: [...s.results, r], i: s.i + 1, k: 0, misses: 0, peeks: 0, lastWrong: null, revealed: false }
}

/** the kid played a chord. Hunt & Peck never gives up (no timer, any speed). */
export function onPlayed(s: RoundState, played: Chord, nearestId: string | null = null): { state: RoundState; event: RoundEvent } {
  const st = current(s), want = target(s)
  if (!st || !want) return { state: s, event: 'none' }
  if (s.revealed) return { state: s, event: 'none' }
  if (judgeWord(played, want).ok) {
    if (s.k + 1 < st.want.length) return { state: { ...s, k: s.k + 1, lastWrong: null }, event: 'right' }
    const n = advance(s, { id: st.id, passed: true, stars: starsFor(st.rung === 'hunt' ? 0 : s.misses, s.peeks), sentence: st.sentence })
    return { state: n, event: isDone(n) ? 'round-done' : 'word-done' }
  }
  const misses = s.misses + 1
  if (st.rung !== 'hunt' && misses >= MAX_MISSES) return { state: { ...s, misses, lastWrong: nearestId, revealed: true }, event: 'gave-up' }
  return { state: { ...s, misses, lastWrong: nearestId }, event: 'wrong' }
}

/** moving on after the answer was shown: the word counts as not yet passed */
export function dismissReveal(s: RoundState): { state: RoundState; event: RoundEvent } {
  const st = current(s)
  if (!st || !s.revealed) return { state: s, event: 'none' }
  const n = advance(s, { id: st.id, passed: false, stars: 0, sentence: st.sentence })
  return { state: n, event: isDone(n) ? 'round-done' : 'word-done' }
}

/** a peek (the guide lights the keys on Memory/Echo) costs a star */
export function onPeek(s: RoundState): RoundState { return s.peeks >= 2 ? s : { ...s, peeks: s.peeks + 1 } }

export const perfect = (s: RoundState): boolean => isDone(s) && s.results.length > 0 && s.results.every((r) => r.passed && r.stars === 3)
export const roundStars = (s: RoundState): number => s.results.reduce((n, r) => n + r.stars, 0)
