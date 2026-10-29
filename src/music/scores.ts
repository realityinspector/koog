// Longer public-domain pieces as data, for SONGS and the games. Pure module, no state.
// J.S. Bach, Prelude in C major, BWV 846 (Well-Tempered Clavier, Book I, 1722). Public domain.
// Every bar is one 5-note chord broken the same way: notes 1 2 3 4 5 3 4 5, played twice (16 sixteenths).
// Bars 1–19 are here. Bar 18's low G is moved up an octave so everything fits a C3–C6 keyboard.

const PCS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const midi = (n: string) => {
  const m = /^([A-G])([#b]?)(\d)$/.exec(n)
  if (!m) throw new Error('bad note ' + n)
  return 12 * (parseInt(m[3]) + 1) + PCS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}
const bar = (s: string) => s.split(' ').map(midi)

export interface PreludeBar { chord: string; notes: number[] }
export const PRELUDE_C: PreludeBar[] = [
  { chord: 'C', notes: bar('C4 E4 G4 C5 E5') },
  { chord: 'Dm7/C', notes: bar('C4 D4 A4 D5 F5') },
  { chord: 'G7/B', notes: bar('B3 D4 G4 D5 F5') },
  { chord: 'C', notes: bar('C4 E4 G4 C5 E5') },
  { chord: 'Am/C', notes: bar('C4 E4 A4 E5 A5') },
  { chord: 'D7/C', notes: bar('C4 D4 F#4 A4 D5') },
  { chord: 'G/B', notes: bar('B3 D4 G4 D5 G5') },
  { chord: 'Cmaj7/B', notes: bar('B3 C4 E4 G4 C5') },
  { chord: 'Am7', notes: bar('A3 C4 E4 G4 C5') },
  { chord: 'D7', notes: bar('D3 A3 D4 F#4 C5') },
  { chord: 'G', notes: bar('G3 B3 D4 G4 B4') },
  { chord: 'C#dim7/G', notes: bar('G3 Bb3 E4 G4 C#5') },
  { chord: 'Dm/F', notes: bar('F3 A3 D4 A4 D5') },
  { chord: 'Bdim7/F', notes: bar('F3 Ab3 D4 F4 B4') },
  { chord: 'C/E', notes: bar('E3 G3 C4 G4 C5') },
  { chord: 'Fmaj7/E', notes: bar('E3 F3 A3 C4 F4') },
  { chord: 'Dm7', notes: bar('D3 F3 A3 C4 F4') },
  { chord: 'G7', notes: bar('G3 D4 G4 B4 F5') },
  { chord: 'C', notes: bar('C3 E3 G3 C4 E4') },
]
/** the 16 notes of one bar, in order */
export const preludeFigure = (b: PreludeBar) => {
  const [a, b2, c, d, e] = b.notes
  const half = [a, b2, c, d, e, c, d, e]
  return [...half, ...half]
}
/** boss phases: bar ranges that each end on a strong chord (a cadence) */
export const PRELUDE_PHASES: [number, number][] = [[0, 4], [4, 8], [8, 11], [11, 15], [15, 19]]
