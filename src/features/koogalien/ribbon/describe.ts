// Pure: screen-reader text for a Koogalien sentence. Tested by scripts/koogalien-ui-fixtures.ts
import type { Chord, Sentence, WordSlot } from '../../../koogalien/data/types'

const DEGREE_NAMES = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si', 'high do']
const ENDINGS = { '.': 'a full stop', '?': 'a question mark', '!': 'an exclamation mark' } as const

export function describeChord(c: Chord): string {
  const names = c.map((d) => DEGREE_NAMES[d - 1] ?? String(d))
  if (names.length <= 1) return names[0] ?? 'nothing'
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} together`
}

export function describeWord(w: WordSlot, i: number): string {
  const head = `Word ${i + 1}: ${w.en || 'unknown'}`
  const notes = w.chords.length ? `, notes ${w.chords.map(describeChord).join(' then ')}` : ''
  const mods = w.tone.mods.map((m) => (m.name === 'wobble' ? 'wobbly, excited' : m.name)).join(', ')
  const tone = (w.tone.loud !== 'normal' ? `, ${w.tone.loud}` : '') + (mods ? `, ${mods}` : '')
  let state = ''
  if (w.status === 'maybe') state = `, not sure: could be ${[w.en, ...(w.alts ?? []).map((a) => a.id)].filter(Boolean).join(' or ')}`
  else if (w.status === 'unknown') state = ', not a Koogalien word I know'
  return head + notes + tone + state + '.'
}

export function describeSentence(s: Sentence | null): string {
  if (!s || s.words.length === 0) return 'No Koogalien sentence yet.'
  const n = s.words.length
  const parts = s.words.map(describeWord)
  const means = s.words.map((w) => w.en).join(' ')
  return `Koogalien sentence, ${n} ${n === 1 ? 'word' : 'words'}. ${parts.join(' ')} Ends with ${ENDINGS[s.end]}. Means: ${means}${s.end}`
}
