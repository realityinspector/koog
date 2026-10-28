// Shared contract for the synth-history module. Data + types only (no self-accept),
// so edits bubble up to the components that import it.

export type Wave = 'sawtooth' | 'square' | 'triangle' | 'sine'

/** One "patch": the settings of a simple Moog-style subtractive synth voice. */
export interface SynthParams {
  wave: Wave
  /** second oscillator detune in cents (0 = off/unison) */
  detune: number
  /** low-pass filter cutoff in Hz (40..12000) */
  cutoff: number
  /** filter resonance / Q (0.1..20) */
  resonance: number
  /** how much the envelope opens the filter, in Hz (0..8000) */
  filterEnv: number
  /** amp envelope, seconds (sustain is 0..1) */
  attack: number
  decay: number
  sustain: number
  release: number
  /** glide / portamento seconds (0..0.5) */
  glide: number
  /** output level 0..1, scaled under a hard safety cap inside the engine */
  level: number
}

export const DEFAULT_PARAMS: SynthParams = {
  wave: 'sawtooth', detune: 7, cutoff: 1800, resonance: 4, filterEnv: 2500,
  attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.3, glide: 0, level: 0.6,
}

/** The engine API that the playground and patch lab share (implemented in engine.ts). */
export interface SynthEngine {
  readonly params: SynthParams
  setParams(p: Partial<SynthParams>): void
  noteOn(note: number, velocity: number): void
  noteOff(note: number): void
  panic(): void
  /** true once an AudioContext exists (created only on a user gesture) */
  readonly ready: boolean
  /** call from a click handler to create/resume the AudioContext */
  unlock(): Promise<void>
  /** latest output samples for a scope, or null */
  analyser(): AnalyserNode | null
}
