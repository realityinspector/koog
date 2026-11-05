// Pure: the word ladder (the same six rungs and the same 80% pass rule as the holiday song ladder in src/features/games/holiday).
// Tested by scripts/koogalien-learn-fixtures.ts
import { itemsOfUnit, UNITS } from './items'

export type Rung = 'hunt' | 'follow' | 'echo' | 'memory' | 'full' | 'master'
export const RUNGS: readonly Rung[] = ['hunt', 'follow', 'echo', 'memory', 'full', 'master']
/** v1 plays the first four rungs on single words; Play full and Master are for whole sentences */
export const WORD_RUNGS: readonly Rung[] = ['hunt', 'follow', 'echo', 'memory']
export const PASS = 0.8

/** rung = the highest rung PASSED (null = none yet). stars = best stars on it (0..3). best = best accuracy 0..1 */
export interface WordProg { rung: Rung | null; stars: number; best: number }
export const newWordProg = (): WordProg => ({ rung: null, stars: 0, best: 0 })

const idx = (r: Rung | null) => (r === null ? -1 : RUNGS.indexOf(r))

/** the rung this word is played on next */
export function playRung(p: WordProg | undefined): Rung {
  const i = idx(p?.rung ?? null)
  return WORD_RUNGS[Math.min(WORD_RUNGS.length - 1, i + 1)]
}

/** record an attempt on the next rung; a pass moves the word up one, a fail changes nothing but `best` */
export function nextRung(p: WordProg, passed: boolean, stars: number): WordProg {
  const s = Math.max(0, Math.min(3, Math.round(stars)))
  if (!passed) return { rung: p.rung, stars: p.stars, best: p.best }
  const i = idx(p.rung)
  const rung = RUNGS[Math.min(RUNGS.length - 1, i + 1)]
  return { rung, stars: rung === p.rung ? Math.max(p.stars, s) : s, best: Math.max(p.best, 1) }
}

/** reached Echo: you can play it after hearing it */
export function isLearned(p: WordProg | undefined): boolean { return idx(p?.rung ?? null) >= idx('echo') }
/** passed Master */
export function isKnown(p: WordProg | undefined): boolean { return p?.rung === 'master' }
/** every word on a rung that v1 can play counts as done once Memory is passed */
export function isDoneInV1(p: WordProg | undefined): boolean { return idx(p?.rung ?? null) >= idx('memory') }

/** share of a unit's items that are learned */
export function unitLearned(unit: number, prog: Record<string, WordProg>): number {
  const items = itemsOfUnit(unit)
  if (!items.length) return 1
  return items.filter((e) => isLearned(prog[e.id])).length / items.length
}

/** unit 1 is always open; a unit opens when the nearest earlier unit that has items is 80% learned (and itself open) */
export function unitUnlocked(unit: number, prog: Record<string, WordProg>): boolean {
  if (unit <= 1) return true
  let u = unit - 1
  while (u >= 1 && itemsOfUnit(u).length === 0) u--
  if (u < 1) return true
  return unitLearned(u, prog) >= PASS && unitUnlocked(u, prog)
}

/** the highest unit the kid can work in right now */
export function currentUnit(prog: Record<string, WordProg>): number {
  let best = 1
  for (const u of UNITS) if (unitUnlocked(u, prog)) best = u
  return best
}
