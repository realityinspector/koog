// Multiple-choice quizzes for Presentation mode. Each question has a one-line kid answer and, behind the 🔬 toggle, a technical note.
// Facts match the decks (see decks.ts). `a` is the index of the right option.
import type { PicId } from './pics'

export interface Q { q: string; o: string[]; a: number; kid: string; tech: string; pic?: PicId }
export interface Quiz { id: string; title: string; emoji: string; blurb: string; qs: Q[] }

export const QUIZZES: Quiz[] = [
  {
    id: 'chips', title: 'Chips and processors', emoji: '🔬', blurb: 'What was inside the machines?',
    qs: [
      { q: 'Which processor was the brain of the Kurzweil K250?', o: ['Motorola 68000', 'Zilog Z80', 'Intel 8080', 'It had no processor'], a: 0, pic: 'm68000',
        kid: 'A 68000 chip ran its keys, panel and MIDI.', tech: 'The 68000 handled front-panel, keyboard scanning and MIDI; dedicated hardware played the stored sounds.' },
      { q: 'Which chip made the sound in the Commodore 64?', o: ['YM2612', 'SID 6581', 'Z80', 'DX7'], a: 1, pic: 'sid',
        kid: 'The SID chip: a whole synthesizer on one chip!', tech: 'MOS Technology 6581: three voices, four waveforms, ADSR per voice and one filter.' },
      { q: 'What did the Z80 chip let the Prophet-5 do?', o: ['Play movies', 'Remember your sounds', 'Print sheet music', 'Nothing at all'], a: 1, pic: 'z80',
        kid: 'It remembered sounds so you could bring them back with a button.', tech: 'The Z80 scanned the keys and stored 40 programs, which was new for a polyphonic synth in 1978.' },
      { q: 'What was inside the Novachord that made it work?', o: ['Vacuum tubes', 'Tiny computer chips', 'Batteries', 'Magnets only'], a: 0, pic: 'novachord',
        kid: 'Glass vacuum tubes, about 163 of them!', tech: 'Twelve tube oscillators divided down to cover every key, so all the notes could play at once.' },
      { q: 'How does the DX7 make its bell-like sounds?', o: ['Playing recordings', 'FM: one wave bends another', 'A big ladder filter', 'Real bells inside'], a: 1, pic: 'dx7',
        kid: 'Maths: one wave wobbles the pitch of another.', tech: 'Frequency modulation, from John Chowning’s Stanford research, in custom Yamaha chips.' },
      { q: 'Which is true of the 1970 Minimoog?', o: ['It had a Z80', 'It stored samples in ROM', 'No processor: only analog circuits', 'It used a SID chip'], a: 2, pic: 'minimoog',
        kid: 'It had no computer, only analog parts.', tech: 'Discrete transistors, a ladder filter and no memory: a sound is the knob settings.' },
    ],
  },
  {
    id: 'moogk', title: 'Moog: own company or Kurzweil team-up?', emoji: '🤝', blurb: 'Who built what, and what they built together.',
    qs: [
      { q: 'The Minimoog came from…', o: ['Moog’s own company', 'Kurzweil Music Systems', 'Yamaha', 'Commodore'], a: 0, pic: 'minimoog',
        kid: 'Moog’s own company made it.', tech: 'A small analog team at Moog’s company built the Model D in 1970.' },
      { q: 'What did Bob Moog help improve on the Kurzweil K250?', o: ['The sounds in ROM', 'How the keys feel', 'The MIDI cable', 'The screen'], a: 1, pic: 'k250',
        kid: 'He helped the keys feel more like a real piano.', tech: 'He joined as a consultant in early 1984 with recommendations on keyboard feel.' },
      { q: 'Who made the K250?', o: ['Moog Music', 'Fairlight', 'Kurzweil Music Systems', 'Sequential'], a: 2,
        kid: 'Ray Kurzweil’s company.', tech: 'Kurzweil Music Systems was founded in 1982.' },
      { q: 'Which kind of sound does the K250 play?', o: ['Recordings stored in memory', 'Hand-patched cables only', 'Air waves from a hand', 'Tubes'], a: 0,
        kid: 'Recordings of real instruments.', tech: 'Samples in ROM, played back by dedicated chips under a 68000 processor.' },
      { q: 'Moog’s multiple-touch-sensitive keyboard was built for which composer?', o: ['Wendy Carlos', 'Herb Deutsch', 'Stevie Wonder', 'John Eaton'], a: 3, pic: 'voyager',
        kid: 'John Eaton wanted keys that feel your fingers.', tech: 'Each key sensed where your finger was and how hard you pressed. Early touch sensing for music.' },
      { q: 'Moog won a Technical Grammy in 2002. Which company won it too?', o: ['Yamaha', 'Apple Computer', 'Commodore', 'Hammond'], a: 1,
        kid: 'Apple won one the same year.', tech: 'Steve Jobs himself received a Special Merit Grammy in 2012, after he died.' },
    ],
  },
  {
    id: 'order', title: 'Who came first? Who made it?', emoji: '🕰️', blurb: 'Dates, firsts and inventors.',
    qs: [
      { q: 'Which came first?', o: ['The theremin (1920)', 'The Minimoog (1970)'], a: 0,
        kid: 'The theremin, 50 years earlier.', tech: 'The theremin is one of the oldest electronic instruments still played.' },
      { q: 'Which came first?', o: ['The Prophet-5 (1978)', 'The Novachord (1939)'], a: 1, pic: 'novachord',
        kid: 'The Novachord, with tubes.', tech: 'Tubes in 1939, microprocessors in 1978: forty years of shrinking.' },
      { q: 'Which came first?', o: ['The SID chip (1982)', 'The DX7 (1983)'], a: 0, pic: 'sid',
        kid: 'The SID chip, by a year.', tech: 'The Commodore 64 with SID arrived in 1982; the DX7 and MIDI in 1983.' },
      { q: 'A machine that records real sounds and plays them on keys is a…', o: ['Theremin', 'Sampler', 'Ladder filter', 'Vocoder'], a: 1, pic: 'fairlight',
        kid: 'A sampler!', tech: 'The Fairlight CMI (1979) was an early one, using 8-bit samples.' },
      { q: 'Whose research gave the DX7 its FM sound?', o: ['Bob Moog', 'John Chowning', 'Ray Kurzweil', 'Léon Theremin'], a: 1, pic: 'dx7',
        kid: 'John Chowning, at Stanford.', tech: 'Chowning discovered FM synthesis for music in 1967; Stanford licensed it to Yamaha.' },
      { q: 'Which is a Moog invention?', o: ['The MIDI cable', 'The transistor ladder filter', 'The SID chip', 'FM synthesis'], a: 1, pic: 'moog',
        kid: 'The ladder filter that shapes tone.', tech: 'Patented 1969; its resonant low-pass sound is still copied in software.' },
    ],
  },
]
