export interface SynthEvent {
  year: string
  title: string
  emoji: string
  body: string
  hook: string
  sort: number
  /** id of a playable emulator (see emu/index.ts) */
  emu?: string
  /** which preset to open the emulator with */
  emuPreset?: number
}

const RAW: SynthEvent[] = [
  { year: '1920', sort: 1920, emoji: '👋', title: 'An instrument you play without touching it: hands near two antennas change pitch and volume', emu: 'airhands',
    body: 'An inventor built an instrument with two antennas. Your hand moves near one to change the pitch and near the other to change the volume, and eerie sound floats out of thin air.',
    hook: 'Electronic music started with waving your hands. Try sliding the Pitch control in the Playground and imagine doing it with no keys at all.' },
  { year: '1928', sort: 1928, emoji: '🎀', title: 'A ring-and-ribbon instrument with a keyboard that can wobble like a violin', emu: 'ribbon',
    body: 'An electronic instrument you play with a ring on your finger that slides along a ribbon, plus a keyboard that can wobble like a violin. Composers wrote real orchestra music for it.',
    hook: 'Slide your pointer across the pitch strip to glide like the ribbon does.' },
  { year: '1935', sort: 1935, emoji: '⛪', title: 'An electric organ with spinning tone wheels and sliding drawbars', emu: 'wheelhouse',
    body: 'A company made an electric organ that used spinning tone wheels instead of pipes. Churches and jazz clubs both loved it because it was far smaller than a pipe organ.',
    hook: 'It mixed sounds by pulling "drawbars", like layering waves. Try stacking waveforms in the Playground.' },
  { year: '1939', sort: 1939, emoji: '🎹', title: 'A giant tube-powered keyboard that plays many notes at once',
    body: "Shown at the 1939 World's Fair, it is often called one of the first polyphonic synthesizers, with lots of vacuum tubes inside and only a few built.",
    hook: 'Polyphony means many notes at once. Hold a chord on your keyboard and see how many voices play.' },
  { year: '1954', sort: 1954, emoji: '🔧', title: 'A teenager builds antenna instruments and sells them as kits',
    body: 'A young engineer started building antenna instruments as a teenager and later sold them as kits. Working with circuits and musicians taught him what players actually wanted from electronic sound.',
    hook: 'Great instruments come from listening to players. Which Playground knob would you want within reach?' },
  { year: '1957', sort: 1957, emoji: '🗄️', title: 'A room-sized synthesizer programmed with punched paper rolls',
    body: 'A university music lab in New York had a synthesizer that filled a room. You programmed it by punching holes in paper rolls, a bit like very slow, very serious coding.',
    hook: 'Synths used to be rooms of equipment. Your keyboard and a browser tab now do more. Wild.' },
  { year: '1963', sort: 1963.5, emoji: '📼', title: 'A keyboard where every key plays a strip of recorded tape', emu: 'tapechoir',
    body: 'Each key played a strip of recorded tape, so one key gave you a real flute or string section. Tapes ran out after about eight seconds, so players learned to lift and press again.',
    hook: 'Hold a key down and watch the tape run out. (Our version is synthesized, not recorded.)' },
  { year: 'Early 1960s', sort: 1963, emoji: '🌉', title: 'West Coast modular synths with touch plates and sequencers',
    body: 'In California, a designer built modular synthesizers on a different idea from the East Coast ones. They used touch plates and sequencers instead of a piano-style keyboard, aimed at exploring new sounds rather than copying old instruments.',
    hook: 'Two designers, two philosophies. In Patch Lab, try making a sound no piano could make.' },
  { year: '1964', sort: 1964, emoji: '⚡', title: 'Voltage-controlled modular synthesizers: patch cables connect oscillators, filters and amplifiers', emu: 'ladder',
    body: 'Voltage-controlled synthesizer modules were shown at an audio engineering convention in 1964. Oscillators, filters and envelopes were separate boxes you connected with cables, and one voltage could control another.',
    hook: 'Voltage control is the big idea: one part steers another. Try the LFO in the Playground, which is a wobble steering your pitch or filter.' },
  { year: 'Mid-1960s', sort: 1966, emoji: '🪜', title: 'A ladder-shaped filter with a fat, warm sound', emu: 'ladder',
    body: 'A filter built from a ladder of transistors and capacitors removes high frequencies smoothly and can ring at the cutoff point, which gives that famously fat, warm sound.',
    hook: 'Try the Filter knob in the Playground: sweep it down and the buzzy sound goes muffled, then back up.' },
  { year: '1968', sort: 1968, emoji: '🎻', title: 'An album of Baroque keyboard music played entirely on a modular synth', emu: 'ladder', emuPreset: 1,
    body: 'An album of Bach played entirely on a modular synthesizer sold hugely and showed the public that a synthesizer was a real instrument and not just a sound-effects machine.',
    hook: 'Each note was recorded one layer at a time. Try the Patch Lab and build a lead sound that could play Bach.' },
  { year: '1970', sort: 1970, emoji: '🧳', title: 'A portable, all-in-one analog synth in a wooden box', emu: 'ladder',
    body: 'Oscillators, a filter and a keyboard packed into one wooden-cased box you could carry to a gig. It was the first portable, relatively affordable all-in-one synth, and bands everywhere started using it.',
    hook: 'Almost every synth you see today follows this layout: oscillator, then filter, then envelope. That is your Playground!' },
  { year: '1971', sort: 1971, emoji: '🟧', title: 'Semi-modular synths: play right away, or rewire with sliders and patch cords', emu: 'patchbay',
    body: 'Semi-modular synths arrived in 1971 with sliders and built-in patching that was great for learning. Smaller, cheaper models followed within a year and gave the big modular systems some friendly competition.',
    hook: 'Competition pushed everything forward. Compare a Filter sweep on a saw wave with one on a square wave.' },
  { year: '1974', sort: 1974, emoji: '🚗', title: 'Electronic pop bands bring synthesizers into the charts',
    body: 'In 1974 a German band released an album built around electronic sounds. Over the late 1970s and 1980s, synth-pop took electronics from the edge of music right into the charts.',
    hook: 'Pop music has been synth music for 50 years. Play a simple repeating pattern in the Playground and make it hypnotic.' },
  { year: '1978', sort: 1978, emoji: '🧠', title: 'Five-voice polyphonic synths that can remember your sounds', emu: 'five',
    body: 'A programmable synth with a microprocessor could play five notes at once and save your sounds. Before this, many synths played one note at a time, and you rebuilt a sound by hand.',
    hook: 'Saving sounds is what Presets do in the Patch Lab. Make one you like and keep it.' },
  { year: '1980s', sort: 1980, emoji: '🥁', title: 'Drum machines with programmable steps',
    body: 'Drum machines let you fill in a grid of steps, one per beat, and then played the pattern perfectly in time, over and over. Producers who could not hire a drummer built whole songs on them.',
    hook: 'Try the Drum pads and fill in a 16-step pattern, then change just one step.' },
  { year: '1981', sort: 1981, emoji: '🧪', title: 'A small bass machine with a squelchy filter and a step sequencer, meant for practice, that flopped before it became famous', emu: 'squelch',
    body: 'A small silver bass machine was meant to back up guitar players, and almost nobody bought it. A few years later, kids in Chicago cranked its squelchy filter and made acid house, and it became famous.',
    hook: 'Program 16 steps and turn the Cutoff knob while it loops.' },
  { year: '1982', sort: 1982, emoji: '🌈', title: 'Affordable chorus synths with one knob for each job', emu: 'shimmer',
    body: 'Affordable polysynths with one knob for each job and a lush chorus effect became the sound of 80s pop and, later, house and techno. Warm, wide and easy to learn.',
    hook: 'Switch the Chorus on and hear one sound turn into two.' },
  { year: '1983', sort: 1983, emoji: '🔌', title: 'A shared language lets keyboards from different makers talk to each other',
    body: 'In 1983 makers agreed on MIDI, a shared language of note-on, note-off and more. Suddenly keyboards from different companies could talk to each other and to computers.',
    hook: 'This is why your USB keyboard works with this app. Press a key and watch the note appear.' },
  { year: '1983', sort: 1983.5, emoji: '💾', title: 'Digital FM synthesis in an affordable keyboard: bright bells and electric pianos', emu: 'bellfm',
    body: 'This keyboard used digital FM synthesis, not analog circuits, and became hugely popular in the 1980s. It sounded glassy and bell-like and was a big shift away from warm analog tones.',
    hook: "Analog versus digital is still a debate. Listen to your Playground's sound and decide which side you hear." },
  { year: '1995', sort: 1995, emoji: '🧱', title: 'Small-format modular systems bring patch cables back',
    body: 'A small-format modular system appeared in the mid-1990s, and its small module size grew into a shared standard. Today hundreds of companies make modules you can mix and match.',
    hook: 'Modular is back, 60 years later. Patch Lab lets you wire up your own signal chain without buying a rack.' },
  { year: '2016', sort: 2016, emoji: '♻️', title: 'The classic portable analog synth comes back in the shop', emu: 'ladder', emuPreset: 1,
    body: 'The company that made the classic portable analog synth reissued it, bringing the design back to the shop. Musicians still reach for the same sounds today.',
    hook: 'Good design lasts. You now know why: oscillator, filter, envelope. Go make bass.' },
]

export interface QuizQ { a: string; b: string; yearA: number; yearB: number }

export const QUIZ: QuizQ[] = [
  { a: 'An album of Baroque music on a modular synth', b: 'The portable all-in-one analog synth', yearA: 1968, yearB: 1970 },
  { a: 'The MIDI standard', b: 'Five-voice synths that remember sounds', yearA: 1983, yearB: 1978 },
  { a: 'The antenna instrument', b: 'Voltage-controlled modular synths', yearA: 1920, yearB: 1964 },
  { a: 'Digital FM keyboards', b: 'Semi-modular synths with patch cords', yearA: 1983, yearB: 1971 },
  { a: 'Tape-strip keyboards', b: 'The ring-and-ribbon instrument', yearA: 1963, yearB: 1928 },
]

/** In date order, whatever order they're written in above. */
export const EVENTS: SynthEvent[] = [...RAW].sort((a, b) => a.sort - b.sort)
