// Pure: Spell Station. A name is spelled with the spell chord (do+re), then each letter as two lone notes (its row, then its column),
// then the end chord (sol+do') to dock. A lone do' (8) takes a note back. Tested by scripts/koogalien-games-fixtures.ts
import { SPELL_END, SPELL_ROWS, glyphByChar } from '../../../koogalien/data/alphabet'
import { lexById } from '../../../koogalien/data/lexicon'
import type { Chord } from '../../../koogalien/data/types'
import type { WordProg } from '../../../koogalien/learn/ladder'
import { helpFor, sameChord } from './core'

export const SPELL_CHORD: Chord = lexById('spell')?.chord ?? [1, 2]
export const KOOG_WORD = 'koog'
export const MISSES_BEFORE_SHOW = 2

export type SpellPhase = 'start' | 'row' | 'col' | 'end' | 'docked'
export interface SpellState { word: string; pos: number; phase: SpellPhase; row: number | null; misses: number[]; backspaced: boolean }
export type SpellEvent = 'started' | 'row-ok' | 'row-wrong' | 'letter-done' | 'col-wrong' | 'back' | 'docked' | 'early-end' | 'wrong-start' | 'none'

export const letterId = (ch: string): string => `letter-${ch}`
export const spellable = (w: string): boolean => w.length > 0 && [...w].every((c) => !!glyphByChar(c))

export function newSpell(word: string): SpellState {
  const w = word.toLowerCase()
  return { word: w, pos: 0, phase: 'start', row: null, misses: Array.from({ length: w.length }, () => 0), backspaced: false }
}
export const targetGlyph = (s: SpellState) => glyphByChar(s.word[s.pos] ?? '')
export const missesNow = (s: SpellState): number => s.misses[s.pos] ?? 0

export function spellPlay(s: SpellState, chord: Chord): { state: SpellState; event: SpellEvent } {
  if (s.phase === 'docked') return { state: s, event: 'none' }
  const isEnd = sameChord(chord, SPELL_END)
  if (s.phase === 'start') {
    if (sameChord(chord, SPELL_CHORD)) return { state: { ...s, phase: 'row' }, event: 'started' }
    return { state: s, event: 'wrong-start' }
  }
  if (isEnd) {
    if (s.phase === 'end') return { state: { ...s, phase: 'docked' }, event: 'docked' }
    return { state: s, event: 'early-end' }
  }
  if (chord.length !== 1) return { state: s, event: 'none' }
  const d = chord[0]
  if (d === 8) {
    if (s.phase === 'col') return { state: { ...s, phase: 'row', row: null, backspaced: true }, event: 'back' }
    if (s.pos > 0) return { state: { ...s, pos: s.pos - 1, phase: 'row', row: null, backspaced: true }, event: 'back' }
    return { state: s, event: 'none' }
  }
  const g = targetGlyph(s)
  if (s.phase === 'end') return { state: s, event: 'none' }
  if (!g) return { state: s, event: 'none' }
  const slip = (): number[] => s.misses.map((m, i) => (i === s.pos ? m + 1 : m))
  if (s.phase === 'row') {
    if (d === g.row) return { state: { ...s, phase: 'col', row: d }, event: 'row-ok' }
    return { state: { ...s, misses: slip() }, event: 'row-wrong' }
  }
  // col
  if (d === g.col) {
    const pos = s.pos + 1
    return { state: { ...s, pos, phase: pos >= s.word.length ? 'end' : 'row', row: null }, event: 'letter-done' }
  }
  return { state: { ...s, misses: slip() }, event: 'col-wrong' }
}

/** per distinct letter (no spaces): did it go clean? Used to credit `letter-x` cards in the shared progress. */
export function spellResults(s: SpellState): { ch: string; passed: boolean; stars: number }[] {
  const by = new Map<string, number>()
  for (let i = 0; i < s.word.length; i++) { const c = s.word[i]; if (c !== ' ') by.set(c, (by.get(c) ?? 0) + s.misses[i]) }
  return [...by].map(([ch, m]) => ({ ch, passed: m === 0, stars: m === 0 ? 3 : m === 1 ? 2 : 1 }))
}
export const spellClean = (s: SpellState): boolean => s.misses.every((m) => m === 0)

/** how much of the letter grid to show for the letter being spelled: the whole grid, only the row names, or none (it fades with mastery) */
export type GridMode = 'full' | 'rows' | 'hidden'
export function gridMode(p: WordProg | undefined, misses = 0): GridMode {
  const h = helpFor(p, misses)
  return h === 'glow' ? 'full' : h === 'fade' ? 'rows' : 'hidden'
}

/** which words are on offer, in order: KOOG, then the kid's names, pets and friends */
export function shipsFor(names: readonly string[]): string[] { return [KOOG_WORD, ...names.filter((n) => n !== KOOG_WORD && spellable(n))] }

export function rowName(row: number): string { return (SPELL_ROWS[row - 1] ?? '').toUpperCase() }

/** one plain sentence that tells the kid what to play next */
export function spellCoach(s: SpellState): string {
  const g = targetGlyph(s), L = (s.word[s.pos] ?? '').toUpperCase()
  if (s.phase === 'start') return 'First press do and re together. That chord says "spell".'
  if (s.phase === 'end') return 'All letters in! Press sol and high do together to dock.'
  if (s.phase === 'docked') return 'Docked!'
  if (!g) return ''
  const what = L === ' ' ? 'a space' : `the letter ${L}`
  if (s.phase === 'row') return `Next is ${what}. Its row is ${g.row} (${rowName(g.row)}). Play note ${g.row}.`
  return `Now the column: ${what} is number ${g.col} in that row. Play note ${g.col}.`
}
