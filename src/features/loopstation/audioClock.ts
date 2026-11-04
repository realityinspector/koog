// Maps the page clock (performance.now ms, which the master clock and every beat use) onto the AudioContext clock (seconds), so the
// looper can hand notes to the instruments with an exact start time ("noteOn(n, v, when)") about 100 ms ahead instead of firing a timer.
// currentTime only moves in render-quantum chunks and is read a moment after performance.now, so a single pair is jittery. We read
// currentTime FIRST and then performance.now (any delay makes the offset smaller, never larger) and keep the LARGEST offset of the
// last ~1.3 s: that is the one least disturbed by chunking or a busy main thread. Audio and page clocks drift by less than 1 ms/min.
import { getCtx } from '../../audio/host'

type Hot = { ring?: number[]; ctx?: AudioContext | null }
const hot = (import.meta.hot?.data ?? {}) as Hot
const R: { ring: number[]; ctx: AudioContext | null } = { ring: hot.ring ?? [], ctx: hot.ctx ?? null }
const WINDOW = 64
const RESET_MS = 150 // a sample this far under the window's best means the context was suspended / restarted

/** call every scheduler tick (about every 20 ms) */
export function sampleAudioOffset(): void {
  const c = getCtx()
  if (c.state !== 'running') { R.ring.length = 0; return }
  if (R.ctx !== c) { R.ctx = c; R.ring.length = 0 }
  const ct = c.currentTime, off = ct - performance.now() / 1000
  const best = R.ring.length ? Math.max(...R.ring) : off
  if (off < best - RESET_MS / 1000) R.ring.length = 0
  R.ring.push(off)
  if (R.ring.length > WINDOW) R.ring.shift()
}
/** AudioContext seconds at which a performance.now() ms moment sounds, or null when there is no running context yet */
export function audioAt(perfMs: number): number | null {
  if (!R.ring.length || !R.ctx || R.ctx.state !== 'running') return null
  return Math.max(...R.ring) + perfMs / 1000
}
/** how far apart the offset samples are (ms): a measure of how trustworthy the mapping is */
export const offsetSpreadMs = () => (R.ring.length ? (Math.max(...R.ring) - Math.min(...R.ring)) * 1000 : 0)
export const audioNow = (): number => (R.ctx ?? getCtx()).currentTime

if (import.meta.hot) { Object.assign(import.meta.hot.data, { ring: R.ring, ctx: R.ctx }); import.meta.hot.accept() }
