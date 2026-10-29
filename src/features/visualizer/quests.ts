import type { SynthParams } from '../synth-history/params'

export interface Quest {
  id: string
  emoji: string
  name: string
  goal: string
  hint: string
  watch: string
  cheer: string
  /** free-form quests pass on a button press instead of a param check */
  free?: boolean
  check: (p: SynthParams) => boolean
}

export const QUESTS: Quest[] = [
  {
    id: 'dark', emoji: '🌑', name: 'Make it DARK',
    goal: 'Close the filter: cutoff under 400 Hz.',
    hint: 'The filter (VCF) is a bouncer for bright sounds. Turn Cutoff down and fewer high harmonics get in.',
    watch: 'See how the sparks go dim and blurry? Less treble means softer, fuzzier light.',
    cheer: 'Lights out! You just muffled a saw wave like a pillow over a speaker.',
    check: (p) => p.cutoff < 400,
  },
  {
    id: 'scream', emoji: '😱', name: 'Make it SCREAM',
    goal: 'Resonance above 14, cutoff between 1 and 3 kHz.',
    hint: 'Resonance boosts the frequencies right at the cutoff, like pushing a swing at just the right moment. Crank it, then park the cutoff in the middle.',
    watch: 'Watch for halo rings around the sparks. That is the resonant peak singing.',
    cheer: 'AAAH! That whistly squeal is a resonant peak. Acid-bass people live for this.',
    check: (p) => p.resonance > 14 && p.cutoff >= 1000 && p.cutoff <= 3000,
  },
  {
    id: 'pad', emoji: '🌫️', name: 'Slow fade-in pad',
    goal: 'Attack over 0.6 s and release over 1.5 s.',
    hint: 'Attack is how long a note takes to reach full volume. Release is how long it fades after you let go. Long both = a cloud.',
    watch: 'The sparks should bloom in slowly and linger after you lift your fingers.',
    cheer: 'Ooooh, dreamy. Strings, clouds and movie trailers all do this.',
    check: (p) => p.attack > 0.6 && p.release > 1.5,
  },
  {
    id: 'pluck', emoji: '🎸', name: 'Plucky bass',
    goal: 'Square or saw wave, cutoff under 900, decay under 0.25 s, sustain under 0.2.',
    hint: 'Pick a buzzy wave, then make the note drop fast: short Decay and low Sustain mean it dies away even while you hold the key.',
    watch: 'Each spark should pop and shrink right away, even if you keep holding the key.',
    cheer: 'Thwack! Pluck = fast decay + low sustain. Same trick as a real bass string.',
    check: (p) => (p.wave === 'square' || p.wave === 'sawtooth') && p.cutoff < 900 && p.decay < 0.25 && p.sustain < 0.2,
  },
  {
    id: 'fat', emoji: '🥞', name: 'Fat unison',
    goal: 'Detune between 10 and 25 cents.',
    hint: 'Two oscillators play the same note, but one is nudged slightly out of tune. The tiny mismatch makes the sound wide and chorus-y. 100 cents is a whole piano key, so go small.',
    watch: 'Look for a ghost copy of each spark sitting just beside the original.',
    cheer: 'So thick! That shimmer is two waves slowly drifting in and out of sync.',
    check: (p) => p.detune >= 10 && p.detune <= 25,
  },
  {
    id: 'theremin', emoji: '🛸', name: 'Slide like a theremin',
    goal: 'Glide over 0.15 s.',
    hint: 'Glide (portamento) makes the pitch slide from one note to the next instead of jumping. Play two different notes in a row.',
    watch: 'You should see streaks connecting one note to the next.',
    cheer: 'Wee-ooooo! Instant sci-fi movie from 1955.',
    check: (p) => p.glide > 0.15,
  },
  {
    id: 'flute', emoji: '🪈', name: 'Sine-wave flute',
    goal: 'Sine wave with a medium cutoff (600 to 3000 Hz).',
    hint: 'A sine wave is pure: only one harmonic, no buzz. That is why it sounds flute-like and soft. A filter has little to cut, so keep the cutoff in the middle.',
    watch: 'The sparks should look smooth and clean, with none of the jagged sharpness a saw makes.',
    cheer: 'Pure and breathy. A sine is the simplest sound there is, and it is gorgeous.',
    check: (p) => p.wave === 'sine' && p.cutoff >= 600 && p.cutoff <= 3000,
  },
  {
    id: 'wobble', emoji: '🌊', name: 'Wobble Bass',
    goal: 'Patch the LFO to the filter (VCF). Rate 2 to 6 Hz, depth over 50%, cutoff under 1200 Hz.',
    hint: 'In the Sound tab, click the LFO jack, then the jack on top of VCF. Then use the LFO knobs. The LFO opens and closes the filter over and over: wah-wah!',
    watch: 'Watch the sparks gently pulse bright and dim in time with the wobble.',
    cheer: 'WUB WUB! That slow filter wobble is the heart of dubstep and funk bass.',
    check: (p) => p.lfoTarget === 'filter' && p.lfoRate >= 2 && p.lfoRate <= 6 && p.lfoDepth > 0.5 && p.cutoff < 1200,
  },
  {
    id: 'opera', emoji: '🎭', name: 'Opera Singer',
    goal: 'Patch the LFO to the pitch (VCO). Rate 4.5 to 7 Hz, depth 20% to 60%.',
    hint: 'Real singers wobble their pitch about 5 or 6 times a second. That is vibrato! Click the LFO jack, then the jack on top of VCO.',
    watch: 'Watch the sparks shimmer a little from side to side.',
    cheer: 'Bravo! A touch of vibrato makes a plain buzz sound like a person singing.',
    check: (p) => p.lfoTarget === 'pitch' && p.lfoRate >= 4.5 && p.lfoRate <= 7 && p.lfoDepth >= 0.2 && p.lfoDepth <= 0.6,
  },
  {
    id: 'boss', emoji: '👑', name: 'Boss level: your own sound',
    goal: 'Build any sound you like, give it a name, then press the button.',
    hint: 'Mix everything you learned: wave shape, filter, envelope, detune, glide. There is no wrong answer.',
    watch: 'Play a few notes and notice how your patch paints its own look.',
    cheer: 'A real sound designer! Every synth preset in the world started exactly like this.',
    free: true,
    check: () => false,
  },
]
