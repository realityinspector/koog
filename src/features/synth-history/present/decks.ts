// Slide decks for Presentation mode. A deck is plain data, so more can be loaded from a .json file (parseDeck checks it).
// Every slide has ONE short line for kids (`kid`) and, behind the 🔬 toggle (key T), grown-up detail lines (`tech`).
// Facts were checked against public sources (see `src` on a slide). Where a claim could not be confirmed, the slide says so.
import { PICS, type PicId } from './pics'

export interface Slide {
  title: string
  emoji: string
  year?: string
  /** the one simple line for kids */
  kid: string
  /** extra, technical lines shown when the technical view is on */
  tech: string[]
  pic?: PicId
  /** a second photo (shown smaller) */
  pic2?: PicId
  /** what the photo shows, one short line */
  caption?: string
  /** a script to read aloud (shown big), with a stage direction in `cue` */
  read?: string
  cue?: string
}
export interface Deck { id: string; title: string; blurb: string; slides: Slide[]; /** shown first, as the big button */ featured?: boolean }

export const KID_MAX = 120 // one line: keep kid text short

export const DECKS: Deck[] = [
  {
    id: 'serious', featured: true, title: 'The Very Serious Reading', blurb: 'Seven solemn, scientific, entirely unnecessary paragraphs. Read each with total sincerity.',
    slides: [
      { year: 'Part 1', emoji: '🎓', title: 'The Opening', kid: 'Take a very long breath. Then read this like a Nobel lecture.',
        cue: 'Stand tall. Speak slowly and clearly.',
        read: 'Early synthesizers, like Dr. Robert Moog’s, were built from many separate transistors. In 1982, Robert Yannes put a whole synthesizer on one chip, the SID, for the Commodore 64. It had three voices and one filter.',
        tech: ['Footnote 1: The 6581 SID did indeed have three voices, four waveforms (triangle, sawtooth, pulse, noise) and one filter.'] },
      { year: 'Part 2', emoji: '🗣️', title: 'A Note on Pronunciation', kid: 'Moog rhymes with vogue. It does not rhyme with “moo-g”.',
        cue: 'Hold up one finger. Deadpan.',
        read: 'Quick note: it’s “mohg.” Moog rhymes with vogue. It is NOT “moo-g,” like a cow.',
        tech: ['Footnote 2: Correct: “mohg” (rhymes with vogue). Incorrect: “moo-g” (rhymes with nothing, and with cows).'] },
      { year: 'Part 3', emoji: '🧬', title: 'The Cousins', kid: 'Moog Music makes synthesizers. Its cousin, Moog Inc., helps airplanes fly.',
        cue: 'Lean in. Whisper like it’s a secret.',
        read: 'There are two Moogs, and they are cousins. Moog Music makes synthesizers. Moog Inc. makes airplane parts. Both turn a voltage into movement. Neither is a cow.',
        tech: ['Footnote 3: Bill Moog applied for a patent on the electrohydraulic servo valve in 1950. The synthesizer people and the aircraft people share a surname and an obsession with smooth control.'] },
      { year: 'Part 4', emoji: '🪜', title: 'The Ladder', kid: 'A ladder that is not a ladder: Moog’s famous filter.',
        cue: 'Sigh. Push up invisible glasses.',
        read: 'In 1969, Dr. Moog patented the transistor ladder filter. It has four stages, each cutting more treble, like a ladder. It turns a “wee” sound into a “wow” sound.',
        tech: ['Footnote 4: The ladder is a chain of transistor and capacitor stages. Its sound is still copied in software.'] },
      { year: 'Part 5', emoji: '🧠', title: 'The Bridge to AI', kid: 'A synth mixer and an AI neuron do the same sum.',
        cue: 'Slow down. Enunciate every syllable.',
        read: 'A synth mixer multiplies each sound by a knob, then adds them up. An AI neuron multiplies each input by a weight, then adds them up. Similar math. Every knob you turn is like a weight.',
        tech: ['Footnote 5: Similar, not identical: a neuron does a weighted sum and then also applies a nonlinearity. A mixer does only the weighted sum, with knobs.'] },
      { year: 'Part 6', emoji: '🔔', title: 'The Wise Ones', kid: 'A bell from maths, and a piano from memory chips.',
        cue: 'Hushed, like a nature show.',
        read: 'In 1967, John Chowning found that one wave wobbling another makes a bell sound. Yamaha put it in the DX7 in 1983. In 1984, Ray Kurzweil asked Dr. Moog to help make his keys feel right.',
        tech: ['Footnote 6: Moog joined Kurzweil as a consultant in early 1984, on the feel of the K250 keyboard.'] },
      { year: 'Part 7', emoji: '🌊', title: 'The Closer', kid: 'An AI makes sound 16,000 times a second. Then say it: awesome!',
        cue: 'Build louder and louder. End in a whisper.',
        read: 'In 2016, an AI called WaveNet made sound 16,000 times every second, just to say “hello.” That is the 1920 theremin, still waving at us. (Whisper.) Synthesizers are awesome.',
        tech: ['Footnote 7: WaveNet (DeepMind, 2016) generated raw audio one sample at a time. Its speech used 16,000 samples per second.'] },
    ],
  },
  {
    id: 'history', title: 'A short history of synthesizers', blurb: '1920 to 2002 in ten slides, with the chips inside.',
    slides: [
      { year: '1920', emoji: '👋', title: 'The theremin', kid: 'You play it by waving your hands near an antenna. You never touch it!',
        tech: ['Invented by Léon Theremin. Your hand near the pitch antenna changes a circuit’s capacitance, which detunes one oscillator against a fixed one.', 'The two radio-frequency tones beat together, and the difference is a tone you can hear (heterodyning).'] },
      { year: '1939', emoji: '🔌', title: 'The Novachord', kid: 'A big keyboard that played many notes at once, built from glass tubes.', pic: 'novachord', pic2: 'tube', caption: 'Inside a Novachord: rows of vacuum tubes',
        tech: ['Hammond’s Novachord (shown at the 1939 World’s Fair) used about 163 vacuum tubes.', 'Twelve tube oscillators were divided down to cover every key, so all the notes could sound together: polyphony.', 'About a thousand were made.'] },
      { year: '1964', emoji: '🔧', title: 'The Moog modular', kid: 'Bob Moog made a synthesizer you build by plugging cables between knobs.', pic: 'moog', caption: 'Bob Moog',
        tech: ['Voltage control: a change of one volt moves the pitch by one octave, so every module can talk to every other.', 'Moog’s transistor ladder filter (patented 1969) became the most copied circuit in synthesis.', 'Built with composer Herb Deutsch, who told him what musicians needed.'] },
      { year: '1970', emoji: '🎹', title: 'The Minimoog', kid: 'A synthesizer small enough to carry on stage. It plays one note at a time.', pic: 'minimoog', caption: 'A Minimoog Model D',
        tech: ['Three oscillators, a mixer, a ladder filter and two envelopes, all in an analog signal path.', 'Discrete transistors. No processor, no memory: every sound is knob positions you set by hand.'] },
      { year: '1978', emoji: '🧠', title: 'A computer to remember sounds', kid: 'A little computer inside remembers your sounds. Press a button and they come back!', pic: 'z80', caption: 'A Zilog Z80 processor',
        tech: ['The Sequential Prophet-5 put a Zilog Z80 microprocessor in charge of the keys and of 40 stored sounds.', 'Later Prophet-5s used Curtis (CEM) chips, so a whole filter or oscillator fit on one small chip.', 'Before this, a player re-set the knobs by hand between songs.'] },
      { year: '1979', emoji: '🎙️', title: 'Record any sound, play it on keys', kid: 'It could record a real sound, then play it back on every key.', pic: 'fairlight', caption: 'A Fairlight CMI',
        tech: ['The Fairlight CMI was an early sampler: it stored short 8-bit recordings and replayed them at different speeds for different notes.', 'It used two Motorola 6800-family processors, a light pen and a screen.'] },
      { year: '1982', emoji: '👾', title: 'A synthesizer on one chip', kid: 'A whole synthesizer shrank onto one tiny chip in a home computer.', pic: 'sid', caption: 'The MOS 6581 “SID” chip',
        tech: ['The MOS Technology 6581 SID, designed by Bob Yannes, sat inside the Commodore 64.', 'Three voices, four waveforms (triangle, saw, pulse, noise), an ADSR envelope per voice and one filter, all analog circuits on silicon.'] },
      { year: '1983', emoji: '🔔', title: 'MIDI and the DX7', kid: 'MIDI let keyboards talk to each other. The DX7 made shiny bell sounds with maths.', pic: 'dx7', pic2: 'ym2612', caption: 'A Yamaha DX7, and a cousin FM chip (YM2612)',
        tech: ['MIDI 1.0 (1983) sends notes as tiny messages at 31,250 bits per second over a 5-pin cable.', 'The DX7 used FM synthesis, one wave bending another’s pitch, from John Chowning’s Stanford research, in custom Yamaha chips.', 'The YM2612 shown is a later FM chip from the same idea, used in the Sega Genesis.'] },
      { year: '1984', emoji: '🎼', title: 'Kurzweil K250', kid: 'It stored recordings of real instruments, and Bob Moog helped make the keys feel right.', pic: 'k250', pic2: 'm68000', caption: 'A Kurzweil K250, and a Motorola 68000 chip',
        tech: ['Ray Kurzweil’s company built the K250: 88 weighted keys and sampled sounds stored in ROM.', 'A Motorola 68000 processor ran the keys, panel and MIDI, while dedicated chips played the sounds back.', 'Moog consulted from early 1984 on making the keyboard feel better.'] },
      { year: '2002', emoji: '🏆', title: 'A Grammy for the tools', kid: 'Bob Moog won a Grammy for the tools that musicians use.',
        tech: ['The 2002 Technical Grammy went to Robert Moog and to Apple Computer, honoring technology that changed how music is made.', 'Steve Jobs himself was given a Special Merit Grammy in 2012, after he died.'] },
    ],
  },
  {
    id: 'moogkurzweil', title: 'Moog and Kurzweil: alone and together', blurb: 'Who built what, how their chips differed, and what they made together.',
    slides: [
      { year: '1964–1970', emoji: '🔧', title: 'Moog on his own', kid: 'Bob Moog’s own company built the modular synth and the Minimoog.', pic: 'minimoog', caption: 'A Minimoog Model D',
        tech: ['Pure analog: transistors, capacitors and resistors shape the sound. There is no computer to run.', 'Those instruments came from Moog’s own company, with a small team.'] },
      { year: '1976–1982', emoji: '📖', title: 'Kurzweil on his own', kid: 'Ray Kurzweil made a machine that reads books aloud, then started a keyboard company.',
        tech: ['His 1976 Reading Machine turned printed pages into speech. Stevie Wonder, one of its first owners, pushed him toward making a keyboard that sounded like real instruments.', 'Kurzweil Music Systems began in 1982.'] },
      { year: '1984', emoji: '🤝', title: 'Moog joins Kurzweil', kid: 'They worked together on a keyboard whose keys feel like a real piano.', pic: 'k250', caption: 'The Kurzweil K250',
        tech: ['Moog came to Kurzweil as a consultant in early 1984 and made recommendations to improve the keyboard feel of the K250.', 'The sounds were Kurzweil’s digital samples. The feel of the keys was where Moog’s hands-on experience mattered.'] },
      { year: 'Chips', emoji: '🔬', title: 'Two kinds of chips', kid: 'Moog’s machines shape electricity. Kurzweil’s play back recordings from memory chips.', pic: 'm68000', pic2: 'z80', caption: 'A 68000 and a Z80',
        tech: ['Analog path: oscillator, filter and amplifier built from transistors. Warm, but only as repeatable as the knobs.', 'Digital path: a processor (the K250 used a Motorola 68000) reads sound recordings stored in ROM and hands them to playback chips.', 'Analog needs no program. Digital can remember anything, which is why the 1978 Prophet-5 added a Z80.'] },
      { year: '1978–2002', emoji: '☝️', title: 'Moog and touch', kid: 'Moog made pads and keys that feel where your fingers are and how hard you press.', pic: 'voyager', caption: 'A Minimoog Voyager and its touch pad',
        tech: ['His company Big Briar sold touch plates in the early 1980s and built a multiple-touch-sensitive keyboard for composer John Eaton. Each key sensed position and pressure.', 'A touch pad of the same family later appeared on the Voyager (2002).', 'Careful: we found no source saying these designs led to laptop trackpads. The shared idea is real, many fingers and many controls, but the link is not proven.'] },
      { year: '2002', emoji: '🏆', title: 'The Technical Grammy', kid: 'Bob Moog won a Technical Grammy, the same year as Apple.',
        tech: ['The 2002 Technical Grammy went to Robert Moog and to Apple Computer.', 'Steve Jobs received his own Grammy, a Special Merit award, in 2012, after his death.'] },
    ],
  },
]

/** a deck that came from a file or the net: check every field before the app trusts it */
export function parseDeck(raw: unknown): { deck: Deck } | { error: string } {
  const o = raw as Record<string, unknown> | null
  if (!o || typeof o !== 'object') return { error: 'That file is not a deck.' }
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null)
  const title = str(o.title, 80)
  if (!title) return { error: 'The deck needs a title (up to 80 letters).' }
  if (!Array.isArray(o.slides) || o.slides.length < 1 || o.slides.length > 60) return { error: 'A deck needs 1 to 60 slides.' }
  const slides: Slide[] = []
  for (let i = 0; i < o.slides.length; i++) {
    const s = o.slides[i] as Record<string, unknown>, n = i + 1
    const st = str(s?.title, 80), kid = str(s?.kid, KID_MAX)
    if (!st) return { error: `Slide ${n} needs a title.` }
    if (!kid) return { error: `Slide ${n} needs a one-line kid sentence (up to ${KID_MAX} letters).` }
    const tech = s.tech === undefined ? [] : Array.isArray(s.tech) && s.tech.every((t) => typeof t === 'string' && t.length <= 400) && s.tech.length <= 8 ? (s.tech as string[]) : null
    if (!tech) return { error: `Slide ${n}: "tech" should be up to 8 short lines.` }
    const pic = typeof s.pic === 'string' && s.pic in PICS ? (s.pic as PicId) : undefined
    const pic2 = typeof s.pic2 === 'string' && s.pic2 in PICS ? (s.pic2 as PicId) : undefined
    const read = str(s.read, 1200) ?? undefined
    slides.push({ title: st, kid, tech, read, cue: str(s.cue, 120) ?? undefined, emoji: str(s.emoji, 8) ?? '🎹', year: str(s.year, 20) ?? undefined, pic, pic2, caption: str(s.caption, 100) ?? undefined })
  }
  return { deck: { id: 'file-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30), title, blurb: str(o.blurb, 140) ?? 'A deck you loaded.', slides } }
}
