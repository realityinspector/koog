// Latency tools for the Devices menu: what we can measure from inside a web page.
//   output   AudioContext baseLatency + outputLatency (speakers vs wired USB vs Bluetooth headphones)
//   lag      how long each MIDI message waited in the browser before our handler ran: performance.now() - event.timeStamp (the input "jitter")
//   offset   a per-device timing offset (ms) applied to the TIMESTAMPS of notes used for scoring and recording. It never delays or changes the sound.
//   tap test click along with a metronome and measure your average tap-vs-click offset
// Allocation-free on the hot path: recordLag writes into a preallocated ring.
import { create } from 'zustand'
import { getCtx, unlockHost } from '../../audio/host'
import { fxBus } from '../../audio/fxContext'
import { subscribe as subscribeMidi } from '../../midi/router'

const RING = 64
interface Ring { buf: Float32Array; n: number }
const hot = import.meta.hot?.data as { rings?: Map<string, Ring>; names?: Map<string, string>; store?: ReturnType<typeof makeStore> } | undefined
function makeStore() { return create<{ v: number }>()(() => ({ v: 0 })) }
/** bumps when an offset or the output guess changes (so panels re-render) */
export const useLatency = hot?.store ?? makeStore()
const rings: Map<string, Ring> = hot?.rings ?? new Map()
const names: Map<string, string> = hot?.names ?? new Map()
let lastId = ''

/** Called by connection.ts for every incoming message (cheap: one subtraction and one store into a ring). */
export function recordLag(id: string, ts: number) {
  if (!(ts > 0)) return
  let r = rings.get(id)
  if (!r) rings.set(id, (r = { buf: new Float32Array(RING), n: 0 }))
  r.buf[r.n++ % RING] = performance.now() - ts
  lastId = id
}
export function registerPort(id: string, name: string) { names.set(id, name) }

export interface LagStats { count: number; median: number; p95: number; max: number }
export function lagStats(id?: string): LagStats {
  const r = rings.get(id ?? lastId)
  if (!r) return { count: 0, median: 0, p95: 0, max: 0 }
  const n = Math.min(r.n, RING), a = Array.from(r.buf.subarray(0, n)).sort((x, y) => x - y)
  if (!n) return { count: 0, median: 0, p95: 0, max: 0 }
  return { count: n, median: a[Math.floor(n / 2)], p95: a[Math.min(n - 1, Math.floor(n * 0.95))], max: a[n - 1] }
}
export const lagIds = () => [...rings.keys()]

// ---- connection guess from the port name (all a web page can see) ----
export type ConnKind = 'bluetooth' | 'network' | 'virtual' | 'usb'
export function connectionGuess(name: string): { kind: ConnKind; label: string } {
  if (/bluetooth|\bble\b|\bbt\b|widi|wireless/i.test(name)) return { kind: 'bluetooth', label: 'Bluetooth (wireless)' }
  if (/network|session ?\d|rtp|wifi|wi-fi/i.test(name)) return { kind: 'network', label: 'network MIDI' }
  if (/\biac\b|virtual|loopback|bus \d|software/i.test(name)) return { kind: 'virtual', label: 'software port' }
  return { kind: 'usb', label: 'USB or a MIDI cable (probably)' }
}
/** typical extra delay for a connection type, ms (a hint, not a measurement) */
export const connDelayHint = (k: ConnKind) => (k === 'bluetooth' ? '7 to 50 ms and wobbly' : k === 'network' ? '2 to 30 ms' : k === 'virtual' ? 'about 0' : 'about 1 ms')

// ---- per-device timing offset ----
const OKEY = 'koog.timingOffsets'
function loadOffsets(): Record<string, number> { try { return JSON.parse(localStorage.getItem(OKEY) || '{}') || {} } catch { return {} } }
let offsets = loadOffsets()
export const OFFSET_MIN = -150, OFFSET_MAX = 300
export const getOffset = (name: string) => offsets[name] ?? 0
export function setOffset(name: string, ms: number) {
  const v = Math.round(Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, Number.isFinite(ms) ? ms : 0)))
  offsets = { ...offsets }; if (v) offsets[name] = v; else delete offsets[name]
  try { localStorage.setItem(OKEY, JSON.stringify(offsets)) } catch { /* private mode */ }
  useLatency.setState({ v: useLatency.getState().v + 1 })
}
/** ms to subtract from a note's timestamp (scoring + recording only) */
export const offsetForId = (id: string) => { const n = names.get(id); return n ? offsets[n] ?? 0 : 0 }

// ---- output ----
export interface OutInfo { out: number; base: number; total: number; bluetooth: boolean; why: string; state: string }
let btLabel = false
async function probeLabels() {
  try {
    const list = await navigator.mediaDevices?.enumerateDevices?.()
    const outs = (list ?? []).filter((d) => d.kind === 'audiooutput')
    const sink = (getCtx() as AudioContext & { sinkId?: string | { type: string } }).sinkId
    const id = typeof sink === 'string' && sink ? sink : 'default'
    const cur = outs.find((d) => d.deviceId === id) ?? outs.find((d) => d.deviceId === 'default')
    const next = !!cur?.label && /bluetooth|airpods|buds|headset|hands-?free|wireless/i.test(cur.label)
    if (next !== btLabel) { btLabel = next; useLatency.setState({ v: useLatency.getState().v + 1 }) }
  } catch { /* no permission or no API */ }
}
export function outputInfo(): OutInfo {
  const ctx = getCtx()
  const out = Math.max(0, (ctx.outputLatency || 0) * 1000), base = Math.max(0, (ctx.baseLatency || 0) * 1000)
  const bigLatency = out >= 100
  return { out, base, total: out + base, bluetooth: btLabel, why: btLabel ? 'the output is a wireless device' : bigLatency ? 'the sound card reports ' + Math.round(out) + ' ms' : '', state: ctx.state }
}


// ---- tap test ----
export interface TapState { running: boolean; clicks: number; taps: number[]; result: number | null; /** finished with fewer than 4 taps */ miss: boolean }
export const useTap = create<TapState>()(() => ({ running: false, clicks: 0, taps: [], result: null, miss: false }))
let clickHeard: number[] = []
let tapTimer: ReturnType<typeof setTimeout>[] = []
export async function startTapTest() {
  stopTapTest(false)
  await unlockHost()
  const ctx = getCtx(), bus = fxBus(0.08); if (!bus) return
  const info = outputInfo(), t0 = ctx.currentTime + 0.5, gap = 0.6, N = 10
  clickHeard = []
  for (let i = 0; i < N; i++) {
    const at = t0 + i * gap, o = ctx.createOscillator(), g = ctx.createGain()
    o.frequency.value = i % 4 === 0 ? 1400 : 1000; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.9, at + 0.003); g.gain.exponentialRampToValueAtTime(0.001, at + 0.06)
    o.connect(g); g.connect(bus.input); o.start(at); o.stop(at + 0.08)
    clickHeard.push(performance.now() + (at - ctx.currentTime) * 1000 + info.total)
  }
  useTap.setState({ running: true, clicks: N, taps: [], result: null, miss: false })
  tapTimer.push(setTimeout(() => { bus.dispose(); finishTapTest() }, (0.5 + N * gap + 0.6) * 1000))
}
/** a tap at performance-clock time t (ms) */
export function tapNow(t = performance.now()) {
  const s = useTap.getState(); if (!s.running) return
  let best = Infinity
  for (const h of clickHeard) { const d = t - h; if (Math.abs(d) < Math.abs(best)) best = d }
  if (Math.abs(best) <= 300) useTap.setState({ taps: [...s.taps, best] })
}
function finishTapTest() {
  const taps = useTap.getState().taps.slice().sort((a, b) => a - b)
  const result = taps.length >= 4 ? Math.round(taps[Math.floor(taps.length / 2)]) : null
  useTap.setState({ running: false, result, miss: result === null })
}
export function stopTapTest(finish = true) { tapTimer.forEach(clearTimeout); tapTimer = []; if (finish && useTap.getState().running) finishTapTest(); else if (!finish) useTap.setState({ running: false, taps: [], result: null, miss: false }) }

const offTap = subscribeMidi('piano', (d, ts) => { if (d.length >= 3 && (d[0] & 0xf0) === 0x90 && d[2] > 0) tapNow(ts > 0 ? ts : undefined) })
void probeLabels()
const onDev = () => void probeLabels()
try { navigator.mediaDevices?.addEventListener?.('devicechange', onDev) } catch { /* ignore */ }

if (import.meta.hot) {
  import.meta.hot.data.rings = rings; import.meta.hot.data.names = names
  import.meta.hot.data.store = useLatency
  import.meta.hot.dispose(() => { offTap(); try { navigator.mediaDevices?.removeEventListener?.('devicechange', onDev) } catch { /* ignore */ } })
  import.meta.hot.accept()
}
