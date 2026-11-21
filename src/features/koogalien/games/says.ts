// Pure: Alien Says. A Koogalien says a word; pick its meaning from 3 emoji cards, then play the word back. Streaks charge the UFO.
// Tested by scripts/koogalien-games-fixtures.ts
import type { Chord, LexEntry } from '../../../koogalien/data/types'
import { judgeWord } from '../../../koogalien/learn/checks'
import { itemById } from '../../../koogalien/learn/items'
import { poolOf, shuffle, starsFor } from './core'

export const SAYS_ROUND = 5
export const UFO_GOAL = 5
export const MAX_PLAY_MISSES = 3

export interface SaysItem { id: string; choices: string[]; stage: 'pick' | 'play'; pickMiss: number; playMiss: number; revealed: boolean }
export interface SaysResult { id: string; passed: boolean; stars: number }
export interface SaysState { items: SaysItem[]; i: number; streak: number; best: number; results: SaysResult[]; lastWrong: string | null }
export type SaysEvent = 'pick-right' | 'pick-wrong' | 'right' | 'wrong' | 'gave-up' | 'next' | 'round-done' | 'none'

/** the target plus two wrong cards: same chord length first, never the same picture, always different words */
export function buildChoices(target: LexEntry, seed: number, maxUnit = 3): string[] {
  const pool = shuffle(poolOf(maxUnit).filter((e) => e.id !== target.id && e.emoji !== target.emoji), seed)
  const same = pool.filter((e) => e.chord.length === target.chord.length), rest = pool.filter((e) => e.chord.length !== target.chord.length)
  const picks: LexEntry[] = []
  for (const e of [...same, ...rest]) if (picks.length < 2 && !picks.some((p) => p.emoji === e.emoji)) picks.push(e)
  return shuffle([target.id, ...picks.map((p) => p.id)], seed + 7)
}

export function newSays(entries: readonly LexEntry[], seed: number): SaysState {
  const items = entries.map((e, k): SaysItem => ({ id: e.id, choices: buildChoices(e, seed + k * 13), stage: 'pick', pickMiss: 0, playMiss: 0, revealed: false }))
  return { items, i: 0, streak: 0, best: 0, results: [], lastWrong: null }
}
export const saysDone = (s: SaysState): boolean => s.i >= s.items.length
export const saysItem = (s: SaysState): SaysItem | null => s.items[s.i] ?? null
export const ufoProgress = (streak: number): number => Math.min(1, streak / UFO_GOAL)

const upd = (s: SaysState, it: SaysItem): SaysState => ({ ...s, items: s.items.map((x, k) => (k === s.i ? it : x)) })

export function pickChoice(s: SaysState, id: string): { state: SaysState; event: SaysEvent } {
  const it = saysItem(s)
  if (!it || it.stage !== 'pick') return { state: s, event: 'none' }
  if (id === it.id) return { state: upd(s, { ...it, stage: 'play' }), event: 'pick-right' }
  return { state: { ...upd(s, { ...it, pickMiss: it.pickMiss + 1 }), lastWrong: id }, event: 'pick-wrong' }
}

function finish(s: SaysState, it: SaysItem, passed: boolean): { state: SaysState; event: SaysEvent } {
  const misses = it.pickMiss + it.playMiss
  const clean = passed && misses === 0
  const streak = clean ? s.streak + 1 : 0
  const results = [...s.results, { id: it.id, passed, stars: passed ? starsFor(misses) : 0 }]
  const n: SaysState = { ...s, results, streak, best: Math.max(s.best, streak), i: s.i + 1, lastWrong: null }
  return { state: n, event: saysDone(n) ? 'round-done' : 'next' }
}

/** the kid played a chord for the current word */
export function playChord(s: SaysState, chord: Chord): { state: SaysState; event: SaysEvent } {
  const it = saysItem(s)
  if (!it || it.stage !== 'play' || it.revealed) return { state: s, event: 'none' }
  const want = itemById(it.id)
  if (!want) return { state: s, event: 'none' }
  if (judgeWord(chord, want).ok) return finish(s, it, true)
  const n = { ...it, playMiss: it.playMiss + 1 }
  if (n.playMiss >= MAX_PLAY_MISSES) return { state: upd(s, { ...n, revealed: true }), event: 'gave-up' }
  return { state: upd(s, n), event: 'wrong' }
}

/** Next after the answer was shown (or the pedal): the word counts as a miss and comes back soon */
export function dismiss(s: SaysState): { state: SaysState; event: SaysEvent } {
  const it = saysItem(s)
  if (!it || !it.revealed) return { state: s, event: 'none' }
  return finish(s, it, false)
}
export const saysPerfect = (s: SaysState): boolean => saysDone(s) && s.results.every((r) => r.passed && r.stars === 3)
