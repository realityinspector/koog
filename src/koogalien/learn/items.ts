// Pure: everything the Dictionary and the games can teach: lexicon words, the 8 digits, and the 26 letters. Tested by scripts/koogalien-learn-fixtures.ts
import { ALPHABET } from '../data/alphabet'
import { LEXICON } from '../data/lexicon'
import type { Chord, Degree, Glyph, LexEntry } from '../data/types'

const NUM_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣']
const SOLFEGE = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si', "do'"]
export const solfege = (d: Degree): string => SOLFEGE[d - 1]

/** a digit is a lone note. It is not in the lexicon, so the learn code makes entries for it (ids digit-1 .. digit-8) */
export const DIGITS: readonly LexEntry[] = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({
  id: `digit-${d}`, en: String(d), emoji: NUM_EMOJI[d - 1], kind: 'number' as const, chord: [d as Degree] as Chord, tier: 1 as const, unit: 1,
}))

/** words you can be taught (the three closers and the spell switch are shown in the Dictionary but are not echo words) */
export const isTeachable = (e: LexEntry): boolean => e.kind !== 'closer'

export const ALL_ITEMS: readonly LexEntry[] = [...DIGITS, ...LEXICON.filter(isTeachable)]
const byId = new Map<string, LexEntry>()
for (const e of [...DIGITS, ...LEXICON]) byId.set(e.id, e)
export const itemById = (id: string): LexEntry | undefined => byId.get(id)
export const itemsOfUnit = (unit: number): LexEntry[] => ALL_ITEMS.filter((e) => e.unit === unit)
export const UNITS: readonly number[] = [...new Set(ALL_ITEMS.map((e) => e.unit))].sort((a, b) => a - b)

export const UNIT_TITLES: Record<number, string> = {
  1: 'Eight notes', 2: 'First words', 3: 'Hello world', 4: 'Sentences', 5: 'Questions and feelings', 6: 'Spell any word', 7: 'Messages to a friend', 8: 'Koogalien + code', 9: 'Shaping the sound',
}
export const unitTitle = (u: number): string => UNIT_TITLES[u] ?? `Unit ${u}`

/** letters, grouped for the Dictionary: [row][col] */
export const GLYPHS: readonly Glyph[] = ALPHABET
