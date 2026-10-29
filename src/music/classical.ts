// Public-domain classical pieces as data. Pure module, no state (data-only: it does not self-accept).
// Same format as songs.ts. Every piece is checked:false until a grown-up has verified it by ear.
// Only pieces whose melody is known with confidence are here; see the reply notes for what was skipped.
import type { Key } from './theory'
import type { Song, SongNote } from '../features/songs/songs'

const PCS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
/** "E4:1 D4 C4:2 R:1" -> duration sticks until changed. # and b allowed. (copy of songs.ts seq, avoids a circular import) */
export function seq(s: string, def = 1): SongNote[] {
  let d = def
  return s.trim().split(/\s+/).map((tok) => {
    const [n, b] = tok.split(':')
    if (b) d = parseFloat(b)
    if (n === 'R') return { note: null, beats: d }
    const m = /^([A-G])([#b]?)(\d)$/.exec(n)
    if (!m) throw new Error('bad note ' + tok)
    const midi = 12 * (parseInt(m[3]) + 1) + PCS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
    return { note: midi, beats: d }
  })
}
const maj = (tonic: number): Key => ({ tonic, scale: 'major' })
const min = (tonic: number): Key => ({ tonic, scale: 'minor' })
const T = '.3333333' // one triplet eighth

export const CLASSICAL: Song[] = [
  { id: 'invention1', title: 'Invention No. 1 (opening motif)', origin: 'J.S. Bach', year: '1723', key: maj(0), bpm: 84, tier: 'classical', checked: false,
    hook: 'Seven notes: up the stairs, back down a step, and home. Bach built a whole piece from it.',
    notes: seq('C4:.5 D4 E4 F4 D4 E4 C4:1.5') },
  { id: 'morning', title: 'Morning Mood (Peer Gynt)', origin: 'Edvard Grieg', year: '1875', key: maj(4), bpm: 92, tier: 'classical', checked: false,
    hook: 'The sun comes up over the mountains. The same little tune climbs a step higher, like sunrise.',
    notes: seq('B4:1 G#4 F#4 E4 F#4 G#4:2 B4:1 G#4 F#4 E4 F#4 G#4:2 C#5:1 A4 G#4 F#4 G#4 A4:2 C#5:1 A4 G#4 F#4 G#4 A4:2 B4:1 G#4 F#4 E4 F#4 G#4:2 B4:1 G#4 F#4 E4 F#4 G#4 E4:4') },
  { id: 'moonlight', title: 'Moonlight Sonata (opening)', origin: 'Beethoven', year: '1801', key: min(1), bpm: 56, tier: 'classical', checked: false,
    hook: 'Rolling triplets, like moonlight on a lake. Keep it slow, soft and steady: 1-2-3, 1-2-3.',
    notes: seq(`G#3:${T} C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4`) },
  { id: 'habanera', title: 'Habanera (Carmen)', origin: 'Georges Bizet', year: '1875', key: min(2), bpm: 66, tier: 'classical', checked: false,
    hook: 'A slinky chromatic slide: every step down is a half step, so use the black keys too.',
    notes: seq('D5:1.5 C#5:.5 C5:.5 B4:.5 Bb4:.5 A4:2 R:1 D5:1.5 C#5:.5 C5:.5 B4:.5 Bb4:.5 A4:2 R:1') },
  { id: 'newworld', title: 'Largo from the New World Symphony', origin: 'Antonín Dvořák', year: '1893', key: maj(0), bpm: 60, tier: 'classical', checked: false,
    hook: 'A slow, homesick song played by an English horn. Moved to C so it\'s all white keys. Make every note sing.',
    notes: seq('E4:1.5 G4:.5 G4:2 E4:1.5 D4:.5 C4:2 D4:1 E4 G4 E4 D4:4 E4:1.5 G4:.5 G4:2 E4:1.5 D4:.5 C4:2 D4:1 E4 D4 C4 C4:4') },
  { id: 'gymnopedie', title: 'Gymnopédie No. 1 (opening)', origin: 'Erik Satie', year: '1888', key: maj(2), bpm: 72, tier: 'classical', checked: false,
    hook: 'Slow and dreamy, like floating. Don\'t rush: let each note hang in the air.',
    notes: seq('R:1 F#5:1 A5 G5 F#5 C#5 B4 C#5 D5 A4:3 F#4:3 R:1 F#5:1 A5 G5 F#5 C#5 B4 C#5 D5 A4:3 F#4:3') },
  { id: 'jesu', title: 'Jesu, Joy of Man\'s Desiring (opening)', origin: 'J.S. Bach', year: '1723', key: maj(7), bpm: 72, tier: 'classical', checked: false,
    hook: 'A river of notes in threes: 1-2-3, 1-2-3. Keep them even and smooth, like flowing water.',
    notes: seq(`G4:${T} A4 B4 D5 C5 C5 E5 D5 D5 G5 F#5 G5 D5 B4 G4 A4 B4 C5 D5 E5 D5 C5 B4 A4 B4:1 G4:2`) },
  { id: 'spring', title: 'Spring (The Four Seasons, opening)', origin: 'Antonio Vivaldi', year: '1725', key: maj(4), bpm: 100, tier: 'classical', checked: false,
    hook: 'Birds chirping in springtime! The same bright call twice, then a little run down.',
    notes: seq('E5:.5 G#5 G#5 G#5 F#5:.25 E5 B5:1.5 B5:.5 G#5 G#5 G#5 F#5:.25 E5 B5:1.5 B5:.5 G#5:.25 F#5 G#5:.5 A5 G#5 F#5:1 D#5:.5 B4:1.5') },
  { id: 'bluedanube', title: 'The Blue Danube (waltz theme)', origin: 'Johann Strauss II', year: '1866', key: maj(2), bpm: 150, tier: 'classical', checked: false,
    hook: 'A waltz: ONE-two-three, ONE-two-three. Rhythm simplified so you can feel the swing.',
    notes: seq('D4:1 D4 F#4 A4 A4:3 A5:1 A5:2 F#5:1 F#5:2 D4:1 D4 F#4 A4 A4:3 A5:1 A5:2 G5:1 G5:2 C#4:1 C#4 E4 B4 B4:3 B5:1 B5:2 G5:1 G5:2 C#4:1 C#4 E4 B4 B4:3 B5:1 B5:2 F#5:1 F#5:2') },
]

/** chromatic or non-diatonic by design: the in-key sanity check only warns for these */
export const CHROMATIC_OK = new Set(['habanera'])
