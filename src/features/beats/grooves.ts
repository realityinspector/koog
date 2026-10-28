import type { Key } from '../../music/theory'

export type Quality = 'maj' | 'min' | '5'
export interface Chord { off: number; q: Quality } // semitones above the tonic

export interface Groove {
  id: string
  name: string
  blurb: string
  bpm: number
  key: Key
  swing: number // 0..0.3, delays odd 16ths
  /** 16-char step patterns. x = hit, X = accent, o = open hat (hat track) */
  kick: string
  snare: string
  clap: string
  hat: string
  /** bass: x = root, o = octave, 5 = fifth */
  bass: string
  stab: string
  prog: Chord[] // 4 chords, one per bar
}

const AM = (o: number): Chord => ({ off: o, q: 'min' })
const M = (o: number): Chord => ({ off: o, q: 'maj' })
const P = (o: number): Chord => ({ off: o, q: '5' })

export const GROOVES: Groove[] = [
  {
    id: 'disco', name: 'Disco Night', blurb: 'Four on the floor, hats on the off-beat.', bpm: 118,
    key: { tonic: 9, scale: 'minor' }, swing: 0,
    kick: 'x...x...x...x...', snare: '................', clap: '....x.......x...',
    hat: 'x.o.x.o.x.o.x.o.', bass: 'x.o.x.o.x.o.x.o.', stab: '..x...x...x...x.',
    prog: [AM(0), M(8), M(3), M(10)], // i VI III VII
  },
  {
    id: 'pop', name: 'Pop Bounce', blurb: 'Bright, bouncy, radio-shaped.', bpm: 100,
    key: { tonic: 0, scale: 'major' }, swing: 0,
    kick: 'x.....x...x.....', snare: '....x.......x...', clap: '................',
    hat: 'x.x.x.x.x.x.x.xo', bass: 'x..x..x.x..x..x.', stab: 'x.....x.....x...',
    prog: [M(0), M(7), AM(9), M(5)], // I V vi IV
  },
  {
    id: 'funk', name: 'Funk Strut', blurb: 'Sixteenth hats, kick plays hide and seek.', bpm: 104,
    key: { tonic: 4, scale: 'minorPentatonic' }, swing: 0.08,
    kick: 'x..x..x...x..x..', snare: '....x.......x..x', clap: '................',
    hat: 'xxxxxxxxxxxxxxxx', bass: 'x.xx..x.x..xx.o.', stab: '..x..x....x..x..',
    prog: [P(0), P(5), P(0), P(10)], // i IV i bVII
  },
  {
    id: 'boombap', name: 'Boom Bap', blurb: 'Head-nod tempo. Chin up, shoulders loose.', bpm: 90,
    key: { tonic: 2, scale: 'minor' }, swing: 0.16,
    kick: 'x......xx.......', snare: '....x.......x...', clap: '................',
    hat: 'x.x.x.x.x.x.x.x.', bass: 'x......xx.....5.', stab: 'x.......x.......',
    prog: [AM(0), M(8), M(3), M(10)], // i VI III VII
  },
  {
    id: 'rock', name: 'Rock Anthem', blurb: 'Stadium energy, power chords, lighters up.', bpm: 120,
    key: { tonic: 7, scale: 'major' }, swing: 0,
    kick: 'x.....x.x.......', snare: '....x.......x...', clap: '................',
    hat: 'x.x.x.x.x.x.x.x.', bass: 'x.x.x.x.x.x.x.x.', stab: 'x.......x.......',
    prog: [P(0), P(7), P(9), P(5)], // I V vi IV
  },
  {
    id: 'dembow', name: 'Reggaeton-ish', blurb: 'Dembow bounce. Hips will be involved.', bpm: 95,
    key: { tonic: 9, scale: 'minor' }, swing: 0,
    kick: 'x...x...x...x...', snare: '...x..x....x..x.', clap: '................',
    hat: 'x.x.x.x.x.x.x.x.', bass: 'x..x..x.x..x..x.', stab: 'x..x..x.........',
    prog: [AM(0), M(10), M(8), M(10)], // i VII VI VII
  },
  {
    id: 'lofi', name: 'Lo-fi Chill', blurb: 'Homework playlist energy. Lazy swing.', bpm: 75,
    key: { tonic: 5, scale: 'major' }, swing: 0.24,
    kick: 'x.......x.x.....', snare: '....x.......x...', clap: '................',
    hat: 'x.x.x.x.x.x.x.x.', bass: 'x.......x.......', stab: 'x.....x.........',
    prog: [M(0), AM(9), M(5), M(7)], // I vi IV V
  },
  {
    id: 'sprint', name: 'Dance Floor Sprint', blurb: 'Fast, sparkly, slightly unhinged.', bpm: 128,
    key: { tonic: 2, scale: 'majorPentatonic' }, swing: 0,
    kick: 'x...x...x...x...', snare: '................', clap: '....x.......x..x',
    hat: '..o...o...o...o.', bass: '.x.x.x.x.x.x.x.x', stab: 'x..x..x...x..x..',
    prog: [M(0), M(7), AM(9), M(5)], // I V vi IV
  },
]
