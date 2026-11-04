// The Koding Kore contract: what a Koog Kode app is (KodeApp) and what it is handed (Kore). Types only; docs/KODING_KORE.md explains them.
import type { ComponentType } from 'react'
import type { KodeToken } from '../kodeCore'
import type { Motif, MotifCall, MotifEvent } from './motifCore'

export type KodeConcept = 'sequence' | 'loop' | 'function' | 'parameter' | 'event' | 'condition' | 'parallel' | 'random' | 'recursion' | 'debug' | 'variable'
export type KodeInput = 'keys' | 'drums' | 'dj' | 'pedal' | 'screen'
export type KodeStatus = 'ready' | 'beta' | 'soon'

export interface KodeApp {
  id: string
  name: string
  icon: string
  tagline: string
  concepts: KodeConcept[]
  inputs: KodeInput[]
  /** [min, max] age */
  ages: [number, number]
  minutes: number
  /** hash route that opens it, e.g. '#/games/memory' (learning apps) or '#/apps/<id>' (Kore apps) */
  route: string
  status: KodeStatus
  /** lazy-loaded Kore app. Omit when `route` opens an existing screen instead. */
  component?: () => Promise<{ default: ComponentType<KoreAppProps> }>
  /** 'learning' apps are existing games that link to their own route; 'kode' apps run on the Kore */
  kind?: 'kode' | 'learning'
}

export interface KoreAppProps { kore: Kore }

export interface KoreClock {
  bpm(): number
  /** absolute beat position now (float) */
  beat(): number
  running(): boolean
  /** the next whole beat (or the grid when stopped) */
  nextBeat(): number
  /** performance.now() ms when absolute beat b sounds */
  msOfBeat(b: number): number
  /** call fn on every beat; returns unsubscribe */
  onBeat(fn: (beat: number) => void): () => void
  /** run fn when absolute beat b arrives (cancelled on exit) */
  atBeat(b: number, fn: () => void): () => void
}

export interface KoreMotifs {
  list(): Motif[]
  get(nameOrId: string): Motif | undefined
  /** save a played phrase as a motif (trims and quantises); marks the 'function' concept */
  define(taps: { pitch?: number; lane?: number; t: number; vel: number }[], opts?: { name?: string; emoji?: string }): Motif | null
  /** run a motif on the next beat; marks 'parameter' when an argument was used */
  call(nameOrId: string, args?: { transpose?: number; speed?: number; vel?: number }): MotifCall | null
  onChange(fn: () => void): () => void
}

export interface Kore {
  appId: string
  tokens: { on(fn: (t: KodeToken) => void): () => void }
  clock: KoreClock
  sound: {
    note(n: number, vel?: number, whenBeat?: number, beats?: number): void
    drum(voice: number, vel?: number, whenBeat?: number): void
    /** play planned motif events (absolute beats) */
    events(evs: MotifEvent[]): void
    stop(): void
  }
  guide: { show(notes: number[], soon?: number[]): void; clear(): void }
  sheet: { show(phrase: { note: number; beat: number; beats: number }[], title?: string): void; clear(): void }
  motifs: KoreMotifs
  progress: { load<T>(key: string, fallback: T): T; save(key: string, value: unknown): void }
  concepts: { mark(id: KodeConcept): { first: boolean; count: number }; record(): Record<string, { first: string; count: number }> }
  celebrate(opts: { title: string; emoji?: string; kind?: 'badge' | 'gold' | 'best' }): void
  /** the phrase-ladder helpers reused from the holiday engine */
  ladder: typeof import('./ladder').ladder
  /** register a cleanup that runs on exit and on hot reload */
  onCleanup(fn: () => void): void
  exit(): void
}
