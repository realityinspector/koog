import type { SynthParams } from './params'

export interface Preset {
  id: string
  name: string
  emoji: string
  blurb: string
  params: Partial<SynthParams>
}

export const PRESETS: Preset[] = [
  { id: 'fat-bass', name: 'Fat 70s bass', emoji: '🎸', blurb: 'Sawtooth waves are buzzy and rich. Detune adds a second, slightly-off oscillator for thickness, and a low cutoff keeps it round and deep.',
    params: { wave: 'sawtooth', detune: 12, cutoff: 500, resonance: 5, filterEnv: 1500, attack: 0.005, decay: 0.25, sustain: 0.5, release: 0.15, glide: 0.03, level: 0.7 } },
  { id: 'acid-bass', name: 'Squelchy acid-style bass', emoji: '🧪', blurb: 'High resonance makes the filter whistle at its cutoff, and a big filter envelope sweeps it open on every note: wow-wow-squelch!',
    params: { wave: 'sawtooth', detune: 0, cutoff: 350, resonance: 16, filterEnv: 5000, attack: 0.003, decay: 0.2, sustain: 0.1, release: 0.1, glide: 0.08, level: 0.6 } },
  { id: 'space-pad', name: 'Spacey pad', emoji: '🌌', blurb: 'A slow attack fades notes in softly and a long release lets them float away. Detune gives that shimmery, wide feeling.',
    params: { wave: 'sawtooth', detune: 18, cutoff: 1400, resonance: 2, filterEnv: 1200, attack: 0.9, decay: 0.8, sustain: 0.8, release: 1.6, glide: 0, level: 0.5 } },
  { id: 'brass', name: 'Brassy lead', emoji: '🎺', blurb: 'Brass instruments swell in: a medium attack plus a filter envelope that opens up makes the sound get brighter as the note grows.',
    params: { wave: 'sawtooth', detune: 6, cutoff: 900, resonance: 3, filterEnv: 4000, attack: 0.08, decay: 0.3, sustain: 0.7, release: 0.2, glide: 0.02, level: 0.65 } },
  { id: 'laser', name: 'Laser zap', emoji: '🔫', blurb: 'A square wave, a very fast decay and a huge filter sweep make a quick "pew!". Short decay and zero sustain are the secret.',
    params: { wave: 'square', detune: 0, cutoff: 6000, resonance: 10, filterEnv: 7000, attack: 0.001, decay: 0.12, sustain: 0, release: 0.08, glide: 0.2, level: 0.5 } },
  { id: 'wobble', name: 'Wobbly sci-fi', emoji: '🛸', blurb: 'Big glide (portamento) slides between notes like a theremin, and high resonance with a moderate cutoff gives an alien, hollow tone.',
    params: { wave: 'triangle', detune: 25, cutoff: 1100, resonance: 12, filterEnv: 2000, attack: 0.15, decay: 0.5, sustain: 0.7, release: 0.5, glide: 0.4, level: 0.55 } },
  { id: 'bells', name: 'Plucky bells', emoji: '🔔', blurb: 'Sine waves are pure. A quick attack, medium decay and zero sustain make each note ring then fade like a struck bell.',
    params: { wave: 'sine', detune: 4, cutoff: 8000, resonance: 1, filterEnv: 2000, attack: 0.002, decay: 0.9, sustain: 0, release: 1.0, glide: 0, level: 0.55 } },
  { id: 'wind', name: 'Wind / ocean', emoji: '🌊', blurb: 'Very slow attack and release make swells like waves. A low, resonant filter that opens slowly makes the airy "whoosh".',
    params: { wave: 'sawtooth', detune: 40, cutoff: 700, resonance: 8, filterEnv: 2500, attack: 1.5, decay: 1.0, sustain: 0.6, release: 2.0, glide: 0.1, level: 0.4 } },
]
