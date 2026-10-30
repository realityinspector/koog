// The DJ's beat clock, published for everyone (the visualizer pulse, the piano judge, challenges).
//   getBeat()  -> { playing, bpm, phase (0..1 inside the beat), beat (0..3 in the bar), bar (0..3 in the loop), deck }
//   onBeat(fn) -> unsubscribe; fn gets { n, beat, bar, bpm, time } at the moment the beat sounds (time = performance.now()).
//   beatOffsetMs() -> signed ms from the nearest beat (negative = early). null when nothing plays.
// The engine feeds it: setClockSource(fn) gives the live position, emitBeat() fires from its lookahead scheduler.
// Listeners and the source live in import.meta.hot.data, so they survive edits to this file.
export interface BeatInfo { n: number; beat: number; bar: number; bpm: number; time: number }
export interface BeatNow { playing: boolean; bpm: number; phase: number; beat: number; bar: number; deck: 'A' | 'B' | null }
export type BeatSource = () => { bpm: number; beatPos: number; deck: 'A' | 'B' } | null
export type BeatListener = (b: BeatInfo) => void

type Hot = { listeners?: Set<BeatListener>; src?: { fn: BeatSource | null } }
const hot = (import.meta.hot?.data ?? {}) as Hot
const listeners: Set<BeatListener> = hot.listeners ?? new Set()
const src: { fn: BeatSource | null } = hot.src ?? { fn: null }

export const onBeat = (fn: BeatListener) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const setClockSource = (fn: BeatSource | null) => { src.fn = fn }
export function emitBeat(b: BeatInfo) { for (const f of [...listeners]) { try { f(b) } catch (e) { console.error('[dj clock]', e) } } }

const IDLE: BeatNow = { playing: false, bpm: 0, phase: 0, beat: 0, bar: 0, deck: null }
export function getBeat(): BeatNow {
  const s = src.fn?.()
  if (!s) return IDLE
  const p = ((s.beatPos % 16) + 16) % 16
  return { playing: true, bpm: s.bpm, phase: p % 1, beat: Math.floor(p) % 4, bar: Math.floor(p / 4) % 4, deck: s.deck }
}
/** signed ms to the nearest beat (negative = before it), or null when the DJ isn't playing */
export function beatOffsetMs(subdivide = 1): number | null {
  const b = getBeat()
  if (!b.playing) return null
  const ms = 60000 / b.bpm / subdivide
  const ph = (b.phase * subdivide) % 1
  return ph < 0.5 ? ph * ms : (ph - 1) * ms
}

if (import.meta.hot) {
  import.meta.hot.data.listeners = listeners
  import.meta.hot.data.src = src
  import.meta.hot.accept()
}
