// Public-domain melodies as data. Pure module, no state.
import type { Key } from '../../music/theory'

export interface SongNote { note: number | null; beats: number } // null = rest
export type Tier = 'pop' | 'bang' | 'easy' | 'medium' | 'flex'
export interface Song {
  id: string; title: string; origin: string; year: string
  key: Key; bpm: number; tier: Tier; notes: SongNote[]; hook?: string; mine?: boolean
}

const PCS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
// "E4:1 D4 C4:2 R:1" -> duration sticks until changed. # and b allowed.
function seq(s: string, def = 1): SongNote[] {
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

export const TIER_LABEL: Record<Tier, string> = { pop: '🎧 Koog Originals (pop)', bang: 'Bangers', easy: 'Warm-up: classics', medium: 'Warm-up: getting good', flex: 'Warm-up: flex' }

export const SONGS: Song[] = [
  { id: 'pop-static', title: 'Static in My Headphones', origin: 'Koog Original', year: '2026', key: min(4), bpm: 124, tier: 'pop', hook: 'Sad but loud. Smash the build, then scream the hook.',
    notes: seq('R:.5 E4:.5 G4:.5 B4:1 A4:.5 G4:.5 E4:.5 R:.5 E4:.5 G4:.5 B4:1 C5:.5 B4:1 C5:1 B4:.5 A4:.5 G4:1 E4:.5 D4:.5 E4:.5 E4 E4 E4 E4 E4 G4 G4 R:2 E5:1 B4:.5 B4:.5 G4:1 E4:1 D5:1 B4:.5 B4:.5 A4:1 G4:1 E5:1 B4:.5 B4:.5 G4:.5 A4:.5 B4:1 E4:3') },
  { id: 'pop-funk', title: 'Slap Bass Sundae', origin: 'Koog Original', year: '2026', key: min(9), bpm: 108, tier: 'pop', hook: 'Keep it bouncy. The rests are the groove.',
    notes: seq('A3:.5 R:.25 A3:.25 C4:.5 R:.5 D4:.5 E4:.5 R:.25 G4:.75 A4:.5 G4:.5 E4:.5 R:.5 D4:.5 E4:.5 C4:1 A3:.5 R:.25 A3:.25 C4:.5 R:.5 D4:.5 E4:.5 R:.25 A4:.75 G4:.5 E4:.5 D4:.5 C4:.5 A3:1 R:1 E4:.25 E4 E4 E4 E4 E4 E4 E4 G4:.5 A4:.5 R:1 A4:.5 A4:.5 R:.5 C5:.5 A4:.5 G4:.5 E4:1 D4:.5 E4:.5 C4:.5 D4:.5 A3:2') },
  { id: 'pop-edm', title: 'Neon Skyline Drop', origin: 'Koog Original', year: '2026', key: maj(0), bpm: 128, tier: 'pop', hook: 'Sounds like a stadium. Build it up, breathe, then hit the drop.',
    notes: seq('C4:.5 C4 C4 C4 E4:.25 E4 E4 E4 G4:.25 G4 G4 G4 R:1 E5:1 E5:.5 D5:.5 C5:1 G4:1 D5:1 D5:.5 C5:.5 B4:1 G4:1 C5:1 C5:.5 B4:.5 A4:1 E4:1 A4:1 C5:.5 A4:.5 G4:2 E5:.5 D5:.5 C5:3') },
  { id: 'pop-lofi', title: 'Rainy Window Homework', origin: 'Koog Original', year: '2026', key: maj(5), bpm: 96, tier: 'pop', hook: 'Slow, soft and cozy. Let the notes sit.',
    notes: seq('R:.5 A4:.5 C5:1 E5:.5 C5:.5 A4:1 R:.5 A4:.5 D5:1 C5:.5 A4:.5 F4:1 R:.5 G4:.5 Bb4:1 A4:.5 G4:.5 D4:1 R:.5 E4:.5 G4:1 A4:.5 G4:.5 E4:1 R:.5 A4:.5 C5:1 E5:.5 C5:.5 A4:1 R:.5 A4:.5 D5:1 E5:.5 D5:.5 C5:1 A4:1 G4:.5 A4:.5 C5:1 R:1 A4:.5 G4:.5 F4:3') },
  { id: 'pop-boss', title: 'Clockwork Dragon (Final Form)', origin: 'Koog Original', year: '2026', key: min(2), bpm: 120, tier: 'pop', hook: 'Boss fight! Hammer the low D, then roar.',
    notes: seq('D4:.5 D4 D4 F4 D4 D4 A4:1 D4:.5 D4 D4 F4 D4 D4 Bb4:1 A4:.5 G4 F4 E4 D4 E4 F4:1 E4:.5 F4 G4 A4 Bb4:1 A4:1 A4:.25 A4 A4 A4 A4 R:1 D5:1 C5:.5 Bb4:.5 A4:1 F4:1 G4:.5 A4:.5 Bb4:1 A4:1 G4:.5 E4:.5 D5:.5 A4:.5 F4:.5 D4:.5 D4:2') },
  { id: 'pop-dance', title: 'Glitterball Gravity', origin: 'Koog Original', year: '2026', key: maj(7), bpm: 120, tier: 'pop', hook: 'Dance-floor energy. Land the big high G.',
    notes: seq('R:.5 B4:.5 B4:.5 D5:1 B4:.5 G4:1 R:.5 C5:.5 C5:.5 E5:1 C5:.5 G4:1 R:.5 B4:.5 D5:.5 G5:1 D5:.5 B4:1 A4:.5 A4:.5 B4:.5 A4:.5 F#4:1 R:1 B4:.25 B4 B4 B4 B4 B4 B4 B4 R:1 G5:1 G5:.5 D5:.5 B4:1 D5:1 E5:1 D5:.5 C5:.5 B4:1 G4:1 A4:.5 B4:.5 A4:.5 F#4:.5 G4:2') },
  { id: 'pop-spooky', title: 'Haunted Hallway Hop', origin: 'Koog Original', year: '2026', key: min(9), bpm: 104, tier: 'pop', hook: 'Creepy fun. Tiptoe in, then shriek on the high notes.',
    notes: seq('A3:.5 R:.5 C4:.5 R:.5 E4:.5 R:.5 Eb4:1 A3:.5 R:.5 C4:.5 R:.5 E4:.5 R:.5 F4:1 A4:.25 G#4 A4 G#4 A4:1 E4:1 C4:1 B3:.5 C4:.5 B3:.5 A3:.5 A3:2 E4:.25 E4 E4 E4 E4 E4 R:1 A4:.5 R:.5 A4:.5 E4:.5 C5:.5 B4:.5 A4:.5 G#4:.5 A4:.5 E4:.5 C4:.5 A3:.5 A3:2') },
  { id: 'pop-hyper', title: 'Sugar Rush Hyperpop', origin: 'Koog Original', year: '2026', key: maj(5), bpm: 128, tier: 'pop', hook: 'Bouncy octave hops. Do not blink.',
    notes: seq('F4:.5 C5:.5 R:.5 C5:.5 F4:.5 C5:.5 A4:1 G4:.5 D5:.5 R:.5 D5:.5 G4:.5 D5:.5 Bb4:1 A4:.5 E5:.5 R:.5 E5:.5 A4:.5 E5:.5 C5:1 Bb4:.5 A4:.5 G4:.5 F4:.5 C4:2 C5:.25 C5 C5 C5 C5 C5 C5 C5 R:1.5 F5:1 F5:.5 C5:.5 D5:1 C5:1 Bb4:1 A4:.5 G4:.5 F4:2') },
  { id: 'buns', title: 'Hot Cross Buns', origin: 'Traditional', year: 'c. 1760', key: maj(0), bpm: 100, tier: 'easy',
    notes: seq('E4:1 D4 C4:2 E4:1 D4 C4:2 C4:.5 C4 C4 C4 D4 D4 D4 D4 E4:1 D4 C4:2') },
  { id: 'mary', title: 'Mary Had a Little Lamb', origin: 'Traditional', year: '1830', key: maj(0), bpm: 104, tier: 'easy',
    notes: seq('E4:1 D4 C4 D4 E4 E4 E4:2 D4:1 D4 D4:2 E4:1 G4 G4:2 E4:1 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4') },
  { id: 'twinkle', title: 'Twinkle, Twinkle, Little Star', origin: 'French folk tune', year: '1761', key: maj(0), bpm: 100, tier: 'easy',
    notes: seq('C4:1 C4 G4 G4 A4 A4 G4:2 F4:1 F4 E4 E4 D4 D4 C4:2 G4:1 G4 F4 F4 E4 E4 D4:2 G4:1 G4 F4 F4 E4 E4 D4:2 C4:1 C4 G4 G4 A4 A4 G4:2 F4:1 F4 E4 E4 D4 D4 C4:2') },
  { id: 'ode', title: 'Ode to Joy', origin: 'Beethoven', year: '1824', key: maj(0), bpm: 108, tier: 'easy',
    notes: seq('E4:1 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:.5 D4:2 E4:1 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:.5 C4:2') },
  { id: 'lune', title: 'Au Clair de la Lune', origin: 'French folk song', year: '18th c.', key: maj(0), bpm: 96, tier: 'easy',
    notes: seq('C4:1 C4 C4 D4 E4:2 D4:2 C4:1 E4 D4 D4 C4:4') },
  { id: 'jingle', title: 'Jingle Bells', origin: 'James Lord Pierpont', year: '1857', key: maj(0), bpm: 126, tier: 'medium',
    notes: seq('E4:1 E4 E4:2 E4:1 E4 E4:2 E4:1 G4 C4:1.5 D4:.5 E4:4 F4:1 F4 F4:1.5 F4:.5 F4:1 E4 E4 E4:.5 E4:.5 E4:1 D4 D4 E4 D4:2 G4:2') },
  { id: 'bday', title: 'Happy Birthday', origin: 'Hill sisters (public domain since 2016)', year: '1893', key: maj(0), bpm: 96, tier: 'medium',
    notes: seq('G3:.75 G3:.25 A3:1 G3 C4 B3:2 G3:.75 G3:.25 A3:1 G3 D4 C4:2 G3:.75 G3:.25 G4:1 E4 C4 B3 A3 F4:.75 F4:.25 E4:1 C4 D4 C4:3') },
  { id: 'saints', title: 'When the Saints Go Marching In', origin: 'American spiritual', year: 'c. 1896', key: maj(0), bpm: 112, tier: 'bang', hook: 'every marching band ever',
    notes: seq('C4:1 E4 F4 G4:3 R:1 C4:1 E4 F4 G4:3 R:1 C4:1 E4 F4 G4:2 E4:2 C4:2 E4:2 D4:4 E4:1 E4 D4 C4:2 C4:1 E4 G4 G4:2 F4:4 E4:1 F4 G4 G4:2 E4:2 C4:2 D4:2 C4:4') },
  { id: 'grace', title: 'Amazing Grace', origin: 'American folk hymn tune', year: '1835', key: maj(7), bpm: 84, tier: 'medium',
    notes: seq('D4:1 G4:2 B4:.5 G4:.5 B4:2 A4:1 G4:2 E4:1 D4:2 D4:1 G4:2 B4:.5 G4:.5 B4:2 A4:1 D5:3 D5:2 B4:.5 G4:.5 B4:2 A4:1 G4:3') },
  { id: 'brahms', title: "Brahms' Lullaby", origin: 'Johannes Brahms', year: '1868', key: maj(0), bpm: 80, tier: 'medium',
    notes: seq('E4:.5 E4:.5 G4:2 E4:.5 E4:.5 G4:2 E4:.5 G4:.5 C5:1 B4:1.5 A4:.5 A4:1 G4:3 D4:.5 E4:.5 F4:1 D4:.5 E4:.5 F4:2 D4:.5 F4:.5 B4:1 A4:1 G4:1 B4:3 C5:3') },
  { id: 'minuet', title: 'Minuet in G', origin: 'Christian Petzold (long credited to Bach)', year: 'c. 1725', key: maj(7), bpm: 108, tier: 'medium',
    notes: seq('D5:1 G4:.5 A4 B4 C5 D5:1 G4:1 G4:1 E5:1 C5:.5 D5 E5 F#5 G5:1 G4:1 G4:1 C5:1 D5:.5 C5 B4 A4 B4:1 C5:.5 B4 A4 G4 F#4:1 G4:.5 A4 B4 G4 B4:3') },
  { id: 'greensleeves', title: 'Greensleeves', origin: 'English folk song', year: '16th c.', key: min(9), bpm: 96, tier: 'flex',
    notes: seq('A4:1 C5:2 D5:1 E5:1.5 F5:.5 E5:1 D5:2 B4:1 G4:1.5 A4:.5 B4:1 C5:2 A4:1 A4:1.5 G#4:.5 A4:1 B4:2 G#4:1 E4:2 A4:1 C5:2 D5:1 E5:1.5 F5:.5 E5:1 D5:2 B4:1 G4:1.5 A4:.5 B4:1 C5:1.5 B4:.5 A4:1 G#4:1.5 F#4:.5 G#4:1 A4:3') },
  { id: 'elise', title: 'Für Elise (opening)', origin: 'Beethoven', year: '1810', key: min(9), bpm: 120, tier: 'bang', hook: 'the one everyone half-knows',
    notes: seq('E5:.5 D#5 E5 D#5 E5 B4 D5 C5 A4:1.5 C4:.5 E4 A4 B4:1.5 E4:.5 G#4 B4 C5:1.5 E4:.5 E5 D#5 E5 D#5 E5 B4 D5 C5 A4:1.5 C4:.5 E4 A4 B4:1.5 E4:.5 C5 B4 A4:3') },
  { id: 'king', title: 'In the Hall of the Mountain King', origin: 'Edvard Grieg', year: '1875', key: min(11), bpm: 120, tier: 'bang', hook: 'every sneaky-villain scene',
    notes: seq('B3:.5 C#4 D4 E4 F#4 D4 F#4:1 F4:.5 C#4 F4:1 B3:.5 C#4 D4 E4 F#4 D4 F#4:1 B4:.5 A4 F#4 D4 F#4 A4:1.5 R:.5 B3:.5 C#4 D4 E4 F#4 D4 F#4:1 F4:.5 C#4 F4:1 B4:.5 A4 F#4 D4 F#4 B4:1.5') },
  { id: 'canon', title: 'Canon in D (theme)', origin: 'Johann Pachelbel', year: 'c. 1680', key: maj(2), bpm: 76, tier: 'bang', hook: 'half of all wedding playlists',
    notes: seq('F#5:2 E5 D5 C#5 B4 A4 B4 C#5 D5 C#5 B4 A4 G4 F#4 G4 A4 F#4:1 D4 E4 F#4 G4 A4 G4 F#4 D4 D4 C#4 D4:4') },
  { id: 'korobeiniki', title: 'Korobeiniki', origin: 'Russian folk song', year: '1861', key: min(9), bpm: 132, tier: 'bang', hook: 'the Tetris theme',
    notes: seq('E5:1 B4:.5 C5:.5 D5:1 C5:.5 B4:.5 A4:1 A4:.5 C5:.5 E5:1 D5:.5 C5:.5 B4:1.5 C5:.5 D5:1 E5:1 C5:1 A4:1 A4:2 R:1 D5:1.5 F5:.5 A5:1 G5:.5 F5:.5 E5:1.5 C5:.5 E5:1 D5:.5 C5:.5 B4:1 B4:.5 C5:.5 D5:1 E5:1 C5:1 A4:1 A4:2') },
  { id: 'entertainer', title: 'The Entertainer (opening)', origin: 'Scott Joplin', year: '1902', key: maj(0), bpm: 100, tier: 'bang', hook: 'ice cream truck energy',
    notes: seq('D4:.5 D#4 E4 C5:1 E4:.5 C5:1 E4:.5 C5:2 C5:.5 D5 D#5 E5 C5 D5 E5:1 B4:.5 D5:1 C5:2') },
  { id: 'turkish', title: 'Turkish March (opening)', origin: 'Mozart', year: '1783', key: min(9), bpm: 120, tier: 'bang', hook: 'the piano-lesson flex everyone learns',
    notes: seq('B4:.5 A4 G#4 A4 C5:2 D5:.5 C5 B4 C5 E5:2 F5:.5 E5 D#5 E5 B4 A4 G#4 A4 B4 A4 G#4 A4 C5:2 A4:2') },
  { id: 'toccata', title: 'Toccata in D minor (opening)', origin: 'J.S. Bach', year: 'c. 1704', key: min(2), bpm: 76, tier: 'bang', hook: 'every haunted-house scene',
    notes: seq('A4:.25 G4:.25 A4:2 R:1 G4:.5 F4:.5 E4:.5 D4:.5 C#4:1 D4:3') },
  { id: 'beethoven5', title: 'Symphony No. 5 (opening)', origin: 'Beethoven', year: '1808', key: min(0), bpm: 108, tier: 'bang', hook: 'the most dramatic four notes ever',
    notes: seq('R:.5 G4:.5 G4:.5 G4:.5 D#4:3 R:.5 F4:.5 F4:.5 F4:.5 D4:3') },
  { id: 'nachtmusik', title: 'Eine kleine Nachtmusik (opening)', origin: 'Mozart', year: '1787', key: maj(7), bpm: 126, tier: 'bang', hook: 'fancy-party-scene music',
    notes: seq('G4:1 R:.5 D4:.5 G4:1 R:.5 D4:.5 G4:.5 D4:.5 G4:.5 B4:.5 D5:2 C5:1 R:.5 A4:.5 C5:1 R:.5 A4:.5 C5:.5 A4:.5 F#4:.5 A4:.5 D4:2') },
  { id: 'bumblebee', title: 'Flight of the Bumblebee (the run)', origin: 'Rimsky-Korsakov', year: '1900', key: min(9), bpm: 70, tier: 'bang', hook: 'speed-run music, chromatic chaos',
    notes: seq('E5:.25 D#5 D5 D#5 D5 C#5 D5 C#5 C5 C#5 C5 B4 C5 B4 A#4 B4 A#4 A4 A#4 A4 G#4 A4 G#4 G4 G#4 G4 F#4 G4 F#4 F4 F#4 F4 E4:2') },
  { id: 'susanna', title: 'Oh! Susanna', origin: 'Stephen Foster', year: '1848', key: maj(0), bpm: 120, tier: 'bang', hook: 'a banjo-on-the-knee classic',
    notes: seq('C4:.5 D4 E4:1 G4:1.5 G4:.5 A4:.5 G4:.5 E4:1 C4:.5 D4:.5 E4:1 E4:1 D4:1 C4:1 D4:2') },
  { id: 'cucaracha', title: 'La Cucaracha', origin: 'Mexican folk song', year: '1800s', key: maj(0), bpm: 138, tier: 'bang', hook: 'the cockroach that cannot walk',
    notes: seq('C4:.5 C4 C4 F4:1 A4:2 C4:.5 C4 C4 F4:1 A4:2 F4:.5 F4 E4 E4 D4 D4 C4:2') },
  { id: 'surprise', title: 'Surprise Symphony (theme)', origin: 'Joseph Haydn', year: '1791', key: maj(0), bpm: 112, tier: 'bang', hook: 'quiet, quiet... then BANG!',
    notes: seq('C4:.5 C4 E4 E4 G4 G4 E4:1 F4:.5 F4 D4 D4 B3 B3 G3:1 C4:.5 C4 E4 E4 G4 G4 E4:1 F4:.5 F4 D4 D4 B3 B3 G3:2') },
  { id: 'yankee', title: 'Yankee Doodle', origin: 'Traditional', year: 'c. 1755', key: maj(0), bpm: 132, tier: 'easy', hook: 'stuck a feather in his cap!',
    notes: seq('C4:.5 C4 D4 E4 C4 E4 D4 G3:1 C4:.5 C4 D4 E4 C4:1 B3:1 C4:.5 C4 D4 E4 F4 E4 D4 C4 B3 G3 A3 B3 C4:1 C4:1') },
  { id: 'deckhalls', title: 'Deck the Halls', origin: 'Welsh folk tune', year: '1700s', key: maj(0), bpm: 132, tier: 'medium', hook: 'fa la la la la, la la la la!',
    notes: seq('G5:1.5 F5:.5 E5:1 D5:1 C5:1 D5:1 E5:1 C5:1 D5:1.5 E5:.5 F5:1 D5:1 E5:1.5 D5:.5 C5:1 B4:1 C5:4') },
  { id: 'wewish', title: 'We Wish You a Merry Christmas', origin: 'English traditional carol', year: '1500s', key: maj(7), bpm: 132, tier: 'medium', hook: 'bring us some figgy pudding',
    notes: seq('D4:1 G4:1 G4:.5 A4:.5 G4:.5 F#4:.5 E4:1 E4:1 E4:1 A4:1 A4:.5 B4:.5 A4:.5 G4:.5 F#4:1 D4:1 D4:1 B4:1 B4:.5 C5:.5 B4:.5 A4:.5 G4:1 E4:1 D4:.5 D4:.5 E4:1 A4:1 F#4:1 G4:3') },
  { id: 'oldmac', title: 'Old MacDonald Had a Farm', origin: 'Traditional', year: '1917', key: maj(0), bpm: 120, tier: 'easy', hook: 'with a moo moo here',
    notes: seq('C4:1 C4 C4 G3 A3 A3 G3:2 E4:1 E4 D4 D4 C4:2 C4:1 C4 C4 G3 A3 A3 G3:2 E4:1 E4 D4 D4 C4:2') },
]
