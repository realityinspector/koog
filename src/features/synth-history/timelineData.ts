export interface SynthEvent {
  year: string
  title: string
  emoji: string
  body: string
  hook: string
  sort: number
}

const RAW: SynthEvent[] = [
  { year: '1920', sort: 1920, emoji: '👋', title: 'The theremin',
    body: 'Soviet inventor Leon Theremin built an instrument you play without touching it. Your hand moves near two antennas, one for pitch and one for volume, and eerie sound floats out of thin air.',
    hook: 'Electronic music started with waving your hands. Try sliding the Pitch control in the Playground and imagine doing it with no keys at all.' },
  { year: '1935', sort: 1935, emoji: '⛪', title: 'Hammond organ',
    body: 'The Hammond Company made an electric organ that used spinning tone wheels instead of pipes. Churches and jazz clubs both loved it because it was far smaller than a pipe organ.',
    hook: 'It mixed sounds by pulling "drawbars", like layering waves. Try stacking waveforms in the Playground.' },
  { year: '1939', sort: 1939, emoji: '🎹', title: 'The Novachord',
    body: 'Hammond showed off the Novachord at the 1939 World\'s Fair. It is often called one of the first polyphonic synthesizers, with lots of vacuum tubes inside and only a few built.',
    hook: 'Polyphony means many notes at once. Hold a chord on your keyboard and see how many voices play.' },
  { year: '1957', sort: 1957, emoji: '🗄️', title: 'RCA Mark II Sound Synthesizer',
    body: 'RCA\'s Mark II filled a room at the Columbia-Princeton Electronic Music Center in New York. You programmed it by punching holes in paper rolls, a bit like very slow, very serious coding.',
    hook: 'Synths used to be rooms of equipment. Your keyboard and a browser tab now do more. Wild.' },
  { year: '1954', sort: 1954, emoji: '🔧', title: 'Robert Moog builds theremins',
    body: 'Robert Moog started building theremins as a teenager and later sold them as kits. Working with circuits and musicians taught him what players actually wanted from electronic sound.',
    hook: 'Great instruments come from listening to players. Which Playground knob would you want within reach?' },
  { year: 'Early 1960s', sort: 1963, emoji: '🌉', title: 'Don Buchla on the West Coast',
    body: 'In California, Don Buchla built modular synthesizers on a different idea from Moog\'s. His used touch plates and sequencers instead of a piano-style keyboard, aimed at exploring new sounds rather than copying old instruments.',
    hook: 'Two designers, two philosophies. In Patch Lab, try making a sound no piano could make.' },
  { year: '1964', sort: 1964, emoji: '⚡', title: 'Moog\'s voltage-controlled modular',
    body: 'Moog showed his voltage-controlled synthesizer modules at the Audio Engineering Society convention in 1964. Oscillators, filters and envelopes were separate boxes you connected with cables, and one voltage could control another.',
    hook: 'Voltage control is the big idea: one part steers another. Try the LFO in the Playground, which is a wobble steering your pitch or filter.' },
  { year: 'Mid-1960s', sort: 1966, emoji: '🪜', title: 'The Moog ladder filter',
    body: 'Moog designed a filter built from a ladder of transistors and capacitors. It removes high frequencies smoothly and can ring at the cutoff point, which gives that famously fat, warm sound.',
    hook: 'Try the Filter knob in the Playground: sweep it down and the buzzy sound goes muffled, then back up.' },
  { year: '1968', sort: 1968, emoji: '🎻', title: 'Switched-On Bach',
    body: 'Wendy Carlos released an album of Bach played entirely on a Moog modular. It sold hugely and showed the public that a synthesizer was a real instrument and not just a sound-effects machine.',
    hook: 'Each note was recorded one layer at a time. Try the Patch Lab and build a lead sound that could play Bach.' },
  { year: '1970', sort: 1970, emoji: '🧳', title: 'The Minimoog',
    body: 'The Minimoog Model D packed oscillators, a filter and a keyboard into one wooden-cased box you could carry to a gig. It was the first portable, relatively affordable all-in-one synth, and bands everywhere started using it.',
    hook: 'Almost every synth you see today follows this layout: oscillator, then filter, then envelope. That is your Playground!' },
  { year: '1971', sort: 1971, emoji: '🟧', title: 'ARP 2600 and Odyssey',
    body: 'ARP made the 2600 in 1971 with sliders and built-in patching that was great for learning. The smaller Odyssey followed in 1972 and became a Moog rival.',
    hook: 'Moog and ARP competing pushed everything forward. Compare a Filter sweep on a saw wave with one on a square wave.' },
  { year: '1974', sort: 1974, emoji: '🚗', title: 'Kraftwerk and synth-pop',
    body: 'German band Kraftwerk released Autobahn in 1974, built around electronic sounds. Over the late 1970s and 1980s, synth-pop took electronics from the edge of music right into the charts.',
    hook: 'Pop music has been synth music for 50 years. Play a simple repeating pattern in the Playground and make it hypnotic.' },
  { year: '1978', sort: 1978, emoji: '🧠', title: 'Prophet-5: polyphony with memory',
    body: 'Sequential Circuits released the Prophet-5, a five-voice synth with a microprocessor that could save your sounds. Before this, many synths played one note at a time, and you rebuilt a sound by hand.',
    hook: 'Saving sounds is what Presets do in the Patch Lab. Make one you like and keep it.' },
  { year: '1983', sort: 1983, emoji: '🔌', title: 'MIDI is standardized',
    body: 'In 1983 makers agreed on MIDI, a shared language of note-on, note-off and more. Suddenly keyboards from different companies could talk to each other and to computers.',
    hook: 'This is why your USB keyboard works with this app. Press a key and watch the note appear.' },
  { year: '1983', sort: 1983.5, emoji: '💾', title: 'Yamaha DX7 goes digital',
    body: 'The DX7 used digital FM synthesis, not analog circuits, and became hugely popular in the 1980s. It sounded glassy and bell-like and was a big shift away from warm analog tones.',
    hook: 'Analog versus digital is still a debate. Listen to your Playground\'s sound and decide which side you hear.' },
  { year: '1995', sort: 1995, emoji: '🧱', title: 'Eurorack revival',
    body: 'Doepfer introduced the A-100 modular system in the mid-1990s, and its small module size grew into the Eurorack standard. Today hundreds of companies make modules you can mix and match.',
    hook: 'Modular is back, 60 years later. Patch Lab lets you wire up your own signal chain without buying a rack.' },
  { year: '2016', sort: 2016, emoji: '♻️', title: 'The Minimoog returns',
    body: 'Moog Music reissued the Minimoog Model D, bringing the classic design back to the shop. Musicians still reach for the same sounds today.',
    hook: 'Good design lasts. You now know why: oscillator, filter, envelope. Go make bass.' },
]

export interface QuizQ { a: string; b: string; yearA: number; yearB: number }

export const QUIZ: QuizQ[] = [
  { a: 'Switched-On Bach album', b: 'The Minimoog', yearA: 1968, yearB: 1970 },
  { a: 'MIDI standard', b: 'Prophet-5', yearA: 1983, yearB: 1978 },
  { a: 'The theremin', b: 'Moog\'s modular synth', yearA: 1920, yearB: 1964 },
]

/** In date order, whatever order they're written in above. */
export const EVENTS: SynthEvent[] = [...RAW].sort((a, b) => a.sort - b.sort)
