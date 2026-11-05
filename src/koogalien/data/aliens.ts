// Pure: the three speaking Koogaliens. A patch is a partial SynthParams (src/features/synth-history/engine.ts) applied while the voice speaks.
// Pip: round, bubbly, bright. Dro: slow, deep, wobbly. Zee: quick, glassy. Tested by scripts/koogalien-fixtures.ts
import type { Koogalien } from './types'
export const ALIENS: readonly Koogalien[] = [
  { id: 'pip', name: 'Pip', emoji: '👾', centre: 72, greeting: 'say hello.',
    patch: { wave: 'triangle', cutoff: 5200, resonance: 1.2, attack: 0.01, decay: 0.25, sustain: 0.5, release: 0.25, detune: 4, lfoTarget: 'none' } },
  { id: 'dro', name: 'Dro', emoji: '🛸', centre: 48, greeting: 'say hello friend.',
    patch: { wave: 'sawtooth', cutoff: 1100, resonance: 2.5, attack: 0.08, decay: 0.5, sustain: 0.6, release: 0.5, detune: 10, lfoTarget: 'pitch', lfoRate: 3, lfoDepth: 0.12, lfoShape: 'sine' } },
  { id: 'zee', name: 'Zee', emoji: '👽', centre: 84, greeting: 'say hello world.',
    patch: { wave: 'square', cutoff: 9000, resonance: 3.5, attack: 0.003, decay: 0.12, sustain: 0.25, release: 0.12, detune: 0, lfoTarget: 'none' } },
]
const byId = new Map(ALIENS.map(a => [a.id, a]))
export const alienById = (id: string): Koogalien | undefined => byId.get(id)
