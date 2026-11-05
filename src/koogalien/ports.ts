// Pure: the only doors the Koogalien engine and play code use to reach the outside world. Builder C implements them in host.ts.
import type { ModSpec } from './data/types'
export interface SoundPort {
  bpm(): number
  /** current clock beat (the same timeline whenBeat uses) */
  nowBeat(): number
  note(midi: number, vel: number, whenBeat: number, durBeats: number): void
  drum(lane: number, vel: number, whenBeat: number): void
  /** stop everything this port scheduled; idempotent */
  stopAll(): void
}
export interface ModPort {
  apply(mod: ModSpec, whenBeat: number): void
  release(mod: ModSpec, whenBeat: number): void
  patch(alienId: string | null): void   // apply (or restore, null) a Koogalien voice patch
}
export interface ProgressPort { load<T>(key: string, fallback: T): T; save<T>(key: string, value: T): void }
export interface ConceptPort { mark(id: 'sequence' | 'function' | 'parameter' | 'event' | 'condition' | 'variable' | 'debug' | 'loop'): void }
export interface KoogalienHost {
  sound: SoundPort; mods: ModPort; progress: ProgressPort; concepts: ConceptPort
  guide: { show(notes: number[]): void; clear(): void }
  celebrate(kind?: string): void
  now(): number            // ms, injectable for tests
  exit(): void
}
