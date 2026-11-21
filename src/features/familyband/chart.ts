// Family Band chart: which songs, the lyric line, the real-piano letters, and the real-guitar chord.
// Pure. The analog seats do not invent a MIDI device. They show what to play on an instrument in the room.
import { SONGS, hasLyrics, type Song } from '../songs/songs'
import { HOLIDAY_ORDER, type Season } from '../songs/holidaySongs'
import { PC_NAMES, keyName, noteName, pc } from '../../music/theory'

export interface Syl { i: number; text: string; join: boolean }
export interface LyricChart { lines: Syl[][]; lineOf: number[] }

/** Classics are the easy-tier warm-ups. Holiday songs are anything with a season, including the three that also sit in the warm-ups. */
export function isFamilySong(s: Song): boolean {
  return s.tier === 'easy' || s.tier === 'holiday' || s.season != null
}

export function familyRepertoire(list: Song[] = SONGS) {
  const classics = list.filter((s) => s.tier === 'easy' && !s.season)
  const take = (season: Season) => {
    const ordered = HOLIDAY_ORDER[season]
      .map((id) => list.find((s) => s.id === id))
      .filter((s): s is Song => !!s && (s.season === season || s.tier === 'holiday'))
    const ids = new Set(ordered.map((s) => s.id))
    return [...ordered, ...list.filter((s) => s.season === season && !ids.has(s.id))]
  }
  return { classics, thanksgiving: take('thanksgiving'), christmas: take('christmas') }
}

export const familySong = (id: string, list: Song[] = SONGS) => list.find((s) => s.id === id && isFamilySong(s)) ?? null

/** Sounding notes only, same syllable rules as the Songs screen. Trailing "-" joins. Trailing "/" ends a line. */
export function lyricLines(song: Song): LyricChart | null {
  if (!hasLyrics(song)) return null
  const lines: Syl[][] = [[]]
  const lineOf: number[] = []
  let i = 0
  for (const n of song.notes) {
    if (n.note == null) continue
    const raw = n.lyric ?? ''
    lines[lines.length - 1].push({ i, text: raw.replace(/\/+$/, '').replace(/-$/, ''), join: /-$/.test(raw.replace(/\/+$/, '')) })
    lineOf.push(lines.length - 1)
    if (raw.endsWith('/')) lines.push([])
    i++
  }
  if (!lines[lines.length - 1].length) lines.pop()
  return lines.length ? { lines, lineOf } : null
}

/** Join a lyric line the way a singer reads it. A joined syllable has no space before the next one. */
export function lineText(row: Syl[]): string {
  let out = ''
  for (const s of row) out += s.text + (s.join ? '' : ' ')
  return out.trim()
}

export interface NoteSpot { idx: number; midi: number | null; next: number[]; endBeat: number }

/** `idx` counts sounding notes, so it matches lyricLines. Negative beats (the count-in) sit before the first note. */
export function noteAt(song: Song, beat: number): NoteSpot {
  let t = 0
  let idx = -1
  let midi: number | null = null
  let i = 0
  const next: number[] = []
  for (const n of song.notes) {
    if (n.note != null) {
      if (beat >= 0 && beat + 0.02 >= t) { idx = i; midi = n.note }
      else if (next.length < 4) next.push(n.note)
      i++
    }
    t += n.beats
  }
  return { idx, midi, next, endBeat: t }
}

export function pianoLetters(song: Song, beat: number): { now: string; next: string[] } {
  const at = noteAt(song, beat)
  const nowMidi = at.midi ?? at.next[0] ?? null
  const rest = at.midi == null ? at.next.slice(1) : at.next
  return { now: nowMidi == null ? '' : noteName(nowMidi), next: rest.map(noteName) }
}

const STEPS = [0, 5, 7] as const // I, IV, V, in semitones
const ROMAN_MAJ = ['I', 'IV', 'V'] as const
const ROMAN_MIN = ['i', 'iv', 'V'] as const

/** The chord a real guitar plays for this beat. A written harmony wins. Otherwise the bar cycles I, IV, V, I. */
export function guitarChord(song: Song, beat: number): { roman: string; name: string } {
  const b = Math.max(0, beat)
  const written = song.harmony?.find((h) => b >= h.start && b < h.start + h.beats)
  if (written) return { roman: written.name, name: written.name }
  const bpb = song.beatsPerBar && song.beatsPerBar > 0 ? song.beatsPerBar : 4
  const slot = Math.floor(b / bpb) % 4
  const which = slot === 1 ? 1 : slot === 2 ? 2 : 0
  const root = pc(song.key.tonic + STEPS[which])
  const minorKey = song.key.scale === 'minor' || song.key.scale === 'minorPentatonic' || song.key.scale === 'blues'
  const minor = minorKey && which !== 2
  const roman = (minor ? ROMAN_MIN : ROMAN_MAJ)[which]
  return { roman, name: PC_NAMES[root] + (minor ? 'm' : '') }
}

export const songKeyLine = (song: Song) => `${keyName(song.key)} · ${song.bpm}`
