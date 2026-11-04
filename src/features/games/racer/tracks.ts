// Koogalien Racer track ladder: four worlds, three tracks each, every phrase cut from one of Koog's public-domain songs.
// Phrases get longer and harder: 3 notes, then 4-6, then wider intervals, then syncopation, then faster tempo. Hints fade as you go.
import { SONGS } from '../../songs/songs'
import { buildTrack, centered, type Mode, type PhraseNote, type Track } from './racerCore'

/** how much help a track gives. full = keys glow and the sheet shows the phrase with note names; glow = keys glow while it is played to you, sheet shows;
 *  sheet = the sheet only; none = ears and memory only. These match the rungs of the other phrase games (follow, echo, memory, blind). */
export type Hints = 'full' | 'glow' | 'sheet' | 'none'
export interface World { id: string; name: string; emoji: string; blurb: string; sky: string; ground: string; edge: string; road: string; prop: 'flower' | 'cactus' | 'pine' | 'star' }
export const WORLDS: World[] = [
  { id: 'meadow', name: 'Cozy Meadow', emoji: '🌼', blurb: 'Short tunes, gentle bends, and lots of help.', sky: '#bfe6ff', ground: '#8fd46a', edge: '#f4f1de', road: '#5b6370', prop: 'flower' },
  { id: 'canyon', name: 'Desert Canyon', emoji: '🌵', blurb: 'Longer tunes with more turns.', sky: '#ffd9a8', ground: '#e6b172', edge: '#fff3d6', road: '#6a5a55', prop: 'cactus' },
  { id: 'snow', name: 'Snowy Mountain', emoji: '🏔️', blurb: 'Big leaps make sharp hairpins.', sky: '#dff1ff', ground: '#f4f9ff', edge: '#9ec9ee', road: '#4a5566', prop: 'pine' },
  { id: 'space', name: 'Space Highway', emoji: '🪐', blurb: 'Off-beat rhythms and a faster tempo.', sky: '#0f0c29', ground: '#1b1740', edge: '#7cf3ff', road: '#2d2a55', prop: 'star' },
]
export interface TrackDef {
  id: string; world: number; name: string; song: string
  /** first and last note index (inclusive) in the song's note list */
  from: number; to: number
  bpm: number; hints: Hints; blurb: string
}
export const TRACKS: TrackDef[] = [
  { id: 'm1', world: 0, name: 'Bunny Hop', song: 'buns', from: 0, to: 2, bpm: 64, hints: 'full', blurb: 'Three notes, going down.' },
  { id: 'm2', world: 0, name: 'Daisy Lane', song: 'lune', from: 0, to: 3, bpm: 66, hints: 'full', blurb: 'Three the same, then up one.' },
  { id: 'm3', world: 0, name: 'Lamb Loop', song: 'mary', from: 0, to: 4, bpm: 68, hints: 'full', blurb: 'Down and back up, five notes.' },
  { id: 'c1', world: 1, name: 'Joy Gulch', song: 'ode', from: 0, to: 5, bpm: 72, hints: 'glow', blurb: 'Six notes up and over.' },
  { id: 'c2', world: 1, name: 'Farm Bend', song: 'oldmac', from: 0, to: 5, bpm: 72, hints: 'glow', blurb: 'A drop, then a wiggle.' },
  { id: 'c3', world: 1, name: 'Marching Mesa', song: 'saints', from: 0, to: 7, bpm: 76, hints: 'glow', blurb: 'A long note, a breath, and again.' },
  { id: 's1', world: 2, name: 'Starlight Pass', song: 'twinkle', from: 0, to: 5, bpm: 72, hints: 'sheet', blurb: 'Wide jumps, wide turns.' },
  { id: 's2', world: 2, name: 'Grace Summit', song: 'grace', from: 0, to: 5, bpm: 70, hints: 'sheet', blurb: 'Big leaps up the mountain.' },
  { id: 's3', world: 2, name: 'Bell Ridge', song: 'deckhalls', from: 0, to: 5, bpm: 80, hints: 'sheet', blurb: 'A long slide down.' },
  { id: 'x1', world: 3, name: 'Comet Swing', song: 'jingle', from: 6, to: 11, bpm: 80, hints: 'none', blurb: 'Long and short notes off the beat.' },
  { id: 'x2', world: 3, name: 'Ragtime Rings', song: 'entertainer', from: 0, to: 7, bpm: 90, hints: 'none', blurb: 'Syncopation: the notes dodge the beat.' },
  { id: 'x3', world: 3, name: 'Hyperdrive', song: 'cucaracha', from: 0, to: 8, bpm: 100, hints: 'none', blurb: 'Fast, with big jumps.' },
]
export const trackById = (id: string) => TRACKS.find((t) => t.id === id)

/** the phrase of a track: the song's notes, rests skipped but still taking time, beats counted from the first note, shifted to the middle of the keyboard */
export function phraseOf(t: TrackDef): PhraseNote[] {
  const s = SONGS.find((x) => x.id === t.song)
  if (!s) return []
  const out: PhraseNote[] = []
  let at = 0, start = -1
  s.notes.forEach((n, i) => {
    if (i >= t.from && i <= t.to && n.note != null) {
      if (start < 0) start = at
      out.push({ note: n.note, beat: at - start, beats: n.beats })
    }
    at += n.beats
  })
  return centered(out)
}
export const trackFor = (t: TrackDef, mode: Mode): Track => buildTrack(phraseOf(t), mode)

/** how many tracks a hint tier asks "Hear it again" to be free for */
export const FREE_REPLAY_UNTIL = 6
