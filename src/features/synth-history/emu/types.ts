// Shared types for the historical-synth emulators. Pure types: no runtime state.
export interface Ctl {
  key: string; label: string; min: number; max: number; def: number; step?: number
  /** knob (default) | slider (vertical, e.g. drawbars) | pick (stepped choice; opts = labels) */
  kind?: 'knob' | 'slider' | 'pick'
  opts?: string[]
  /** small group heading shown above a run of controls */
  group?: string
}
export interface Preset { name: string; values: Record<string, number> }
/** Live parameter values by control key. Voices read from it at note-on and react to param() calls. */
export type Params = Record<string, number>

export interface EmuAudio {
  ctx: AudioContext
  /** voices connect here (goes to a master gain with the 0.15 safety cap, then a limiter) */
  out: AudioNode
}
export interface Voice {
  noteOn(note: number, vel: number): void
  noteOff(note: number): void
  allOff(): void
  /** a control moved */
  param?(key: string, value: number): void
  /** continuous playing surface (theremin / ribbon): x 0..1 = pitch across the field, y 0..1 = loudness. null = hands away */
  field?(x: number | null, y?: number): void
  /** a 16-step bass pattern + running state (TB-303 style) */
  dispose(): void
}
export type Extra = 'field' | 'seq303' | 'tape'
export interface EmuSpec {
  id: string
  name: string
  year: string
  /** CSS theme class for the faceplate */
  skin: string
  blurb: string
  /** one honest line when the emulation is only an approximation */
  note?: string
  ctls: Ctl[]
  presets: Preset[]
  make(a: EmuAudio, P: Params): Voice
  /** candidate song ids; ones missing from SONGS are dropped */
  songs: string[]
  songWhy: string
  extra?: Extra
  /** lowest/highest note for the pitch field */
  fieldRange?: [number, number]
}
