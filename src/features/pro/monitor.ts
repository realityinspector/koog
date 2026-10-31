// MIDI monitor: raw messages from every device, whatever its role. Piano role via connection.subscribeRaw; DJ and surface roles via devices.
import { create } from 'zustand'
import { subscribeRaw } from '../../midi/connection'
import { onDjMessage, onSurfaceMessage } from '../../music/devices'

export interface MonMsg { n: number; src: 'piano' | 'dj' | 'surface'; hex: string; text: string; ch: number; kind: string }
const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const noteName = (n: number) => NN[n % 12] + (Math.floor(n / 12) - 1)
export function describe(d: ArrayLike<number>): { text: string; ch: number; kind: string } {
  const s = d[0] ?? 0, k = s & 0xf0, ch = (s & 0x0f) + 1
  if (s >= 0xf0) return { text: s === 0xf8 ? 'clock' : s === 0xfe ? 'active sense' : s === 0xf0 ? `sysex (${d.length} B)` : 'system 0x' + s.toString(16), ch: 0, kind: 'sys' }
  if (k === 0x90) return d[2] ? { text: `note on ${noteName(d[1])} vel ${d[2]}`, ch, kind: 'note' } : { text: `note off ${noteName(d[1])}`, ch, kind: 'note' }
  if (k === 0x80) return { text: `note off ${noteName(d[1])}`, ch, kind: 'note' }
  if (k === 0xb0) return { text: `CC ${d[1]} = ${d[2]}`, ch, kind: 'cc' }
  if (k === 0xe0) return { text: `bend ${((d[2] << 7) | d[1]) - 8192}`, ch, kind: 'bend' }
  if (k === 0xc0) return { text: `program ${d[1]}`, ch, kind: 'pc' }
  if (k === 0xa0 || k === 0xd0) return { text: 'aftertouch ' + (k === 0xa0 ? d[2] : d[1]), ch, kind: 'at' }
  return { text: 'status 0x' + s.toString(16), ch, kind: 'other' }
}
const MAX = 200
interface Hot { store?: ReturnType<typeof make>; buf?: MonMsg[]; seq?: { n: number }; off?: () => void; refs?: { count: number } }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<{ rev: number; paused: boolean; filter: string; kinds: Record<string, boolean>; count: number }>()(() => ({ rev: 0, paused: false, filter: '', kinds: {}, count: 0 })) }
export const useMonitor = hot.store ?? make()
const buf: MonMsg[] = hot.buf ?? []
const seq = hot.seq ?? { n: 0 }
export const monitorMessages = () => buf
let dirty = false
function flush() { if (dirty) return; dirty = true; setTimeout(() => { dirty = false; useMonitor.setState((s) => ({ rev: s.rev + 1, count: seq.n })) }, 80) }
function push(src: MonMsg['src'], d: Uint8Array) {
  if (useMonitor.getState().paused || d[0] === 0xf8 || d[0] === 0xfe) return
  const x = describe(d)
  buf.unshift({ n: ++seq.n, src, hex: Array.from(d).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join(' '), ...x })
  if (buf.length > MAX) buf.length = MAX
  flush()
}
export function clearMonitor() { buf.length = 0; useMonitor.setState((s) => ({ rev: s.rev + 1 })) }
export const setMonitor = (p: Partial<{ paused: boolean; filter: string; kinds: Record<string, boolean> }>) => useMonitor.setState(p)

/** refcounted: the workspace starts it on mount and stops on unmount, so kid mode never pays for it */
export function startMonitor() {
  const r = (hot.refs ??= { count: 0 })
  if (r.count++ > 0) return
  const offs = [subscribeRaw((d) => push('piano', d)), onDjMessage((d) => push('dj', d)), onSurfaceMessage((d) => push('surface', d))]
  hot.off = () => offs.forEach((f) => f())
}
export function stopMonitor() { const r = hot.refs; if (!r || --r.count > 0) return; r.count = 0; hot.off?.(); hot.off = undefined }

if (import.meta.hot) {
  import.meta.hot.data.store = useMonitor; import.meta.hot.data.buf = buf; import.meta.hot.data.seq = seq; import.meta.hot.data.refs = hot.refs
  import.meta.hot.dispose((d) => { d.off = hot.off; d.refs = hot.refs })
  import.meta.hot.accept()
}
