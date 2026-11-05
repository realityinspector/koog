// Pure: spell mode. 26 letters as (row 1..7, col 1..4) hops, rows are the ABC-song chunks. Tested by scripts/koogalien-fixtures.ts
import type { Chord, Degree, Glyph } from './types'

export const SPELL_ROWS = ['abcd', 'efgh', 'ijkl', 'mnop', 'qrst', 'uvwx', 'yz'] as const
/** unit 6 teaches all of them; the ladder may introduce rows earlier */
export const ALPHABET: readonly Glyph[] = SPELL_ROWS.flatMap((r, ri) => [...r].map((ch, ci): Glyph => ({ ch, row: ri + 1, col: ci + 1, unit: 6 })))
/** row 7 holds two extras: apostrophe (7,3) and space (7,4), so names like "o'neil" and "mary ann" spell */
export const SPELL_EXTRAS: readonly Glyph[] = [{ ch: "'", row: 7, col: 3, unit: 6 }, { ch: ' ', row: 7, col: 4, unit: 6 }]
export const SPELL_ID = 'spell'
export const SPELL_END: Chord = [5, 8]
export const BACKSPACE: Degree = 8

const ALL = [...ALPHABET, ...SPELL_EXTRAS]
const byCh = new Map(ALL.map(g => [g.ch, g]))
const byPair = new Map(ALL.map(g => [g.row * 10 + g.col, g]))
export const glyphByChar = (ch: string): Glyph | undefined => byCh.get(ch.toLowerCase())
export const glyphByPair = (row: number, col: number): Glyph | undefined => byPair.get(row * 10 + col)
