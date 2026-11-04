// Names the language knows: notes, drums, sounds. PURE.
import { KodeError } from './types'

export const DRUM_NAMES = ['kick', 'snare', 'hat', 'open', 'clap', 'lotom', 'hitom', 'rim'] as const
/** the drum pad voice order of src/features/drumpads/drumCore.ts VOICES */
const DRUM_ALIAS: Record<string, number> = { bd: 0, sd: 1, hh: 2, oh: 3, cp: 4, lt: 5, ht: 6, rs: 7 }
export const drumVoice = (w: string): number => {
  const i = (DRUM_NAMES as readonly string[]).indexOf(w)
  return i >= 0 ? i : (DRUM_ALIAS[w] ?? -1)
}

/** sound ids: piano / koog = the Koog synth; the rest are Koog instruments */
export const SOUND_NAMES = ['piano', 'organ', 'ladder', 'epiano', 'bell', 'strings', 'choir', 'pad', 'brass', 'patchbay', 'squelch', 'shimmer', 'bellfm', 'five', 'wheelhouse', 'tapechoir', 'ribbon', 'airhands'] as const
export const isSound = (w: string) => w === 'koog' || (SOUND_NAMES as readonly string[]).includes(w)

export const KEYWORDS = ['notes', 'drums', 'tempo', 'sound', 'loud'] as const

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
const NOTE_RE = /^([a-g])(#|b)?(\d)?$/

export function isNoteWord(w: string): boolean { return NOTE_RE.test(w.toLowerCase()) }
/** "c", "f#3", "bb" -> MIDI note (octave defaults to 4: c = 60), or null */
export function noteMidi(word: string): number | null {
  const m = NOTE_RE.exec(word.toLowerCase())
  if (!m) return null
  const oct = m[3] === undefined ? 4 : Number(m[3])
  return (oct + 1) * 12 + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}
const NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
/** MIDI note -> the shortest name that reads back to it: octave 4 is left off */
export function midiName(n: number): string {
  const m = Math.max(12, Math.min(131, Math.round(n)))
  const oct = Math.floor(m / 12) - 1
  return NAMES[m % 12] + (oct === 4 ? '' : String(oct))
}

export function editDistance(a: string, b: string): number {
  const d: number[] = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const t = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = t
    }
  }
  return d[b.length]
}
/** the closest of `list` to `w` when it is close enough to be a typo, else null */
export function didYouMean(w: string, list: readonly string[]): string | null {
  let best: string | null = null, bd = 99
  for (const x of list) { const d = editDistance(w, x); if (d < bd) { bd = d; best = x } }
  return best !== null && bd <= Math.max(1, Math.floor(best.length / 3)) ? best : null
}

/** a word in a notes pattern -> MIDI, or a friendly KodeError pointing at [s, e) */
export function readNote(word: string, s: number, e: number): number {
  const w = word.toLowerCase()
  const midi = noteMidi(w)
  if (midi !== null) return midi
  if (drumVoice(w) >= 0) throw new KodeError(`'${word}' is a drum, not a note. Put it on a drums line, like drums "${w} ~ ${w} ~".`, s, e)
  const c = w[0]
  if (c >= 'a' && c <= 'z' && !(c >= 'a' && c <= 'g')) throw new KodeError(`I don't know the note '${word}'. Notes are a to g.`, s, e)
  if (c >= 'a' && c <= 'g') throw new KodeError(`I can't read '${word}' as a note. After the letter you can add # (sharp) or b (flat), then an octave number 0 to 8, like c#3 or e5.`, s, e)
  throw new KodeError(`I can't read '${word}' as a note. Use the letters a to g, like c or e4. Use ~ for a rest.`, s, e)
}
export function readDrum(word: string, s: number, e: number): number {
  const w = word.toLowerCase()
  const v = drumVoice(w)
  if (v >= 0) return v
  const near = didYouMean(w, DRUM_NAMES)
  throw new KodeError(`I don't know the drum '${word}'.${near ? ` Did you mean '${near}'?` : ''} Drums are ${DRUM_NAMES.join(', ')}.`, s, e)
}
