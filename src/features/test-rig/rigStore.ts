import { create } from 'zustand'
import { subscribeRaw, sendMidi, noteName } from '../../midi/connection'
import * as synth from '../../audio/synth'

export interface LogEntry { n: number; t: number; dt: number; lag: number; hex: string; text: string }
export interface Stats {
  total: number
  channels: Record<number, number>
  velMin: number | null; velMax: number | null
  noteOff80: number; noteOn0: number
  ccs: Record<number, number>
  other: Record<string, number>
  noteMin: number | null; noteMax: number | null
}
interface Rig {
  log: LogEntry[]; stats: Stats
  playback: boolean; muted: boolean; level: number
  sendEnabled: boolean; sendStatus: string
}
const emptyStats = (): Stats => ({ total: 0, channels: {}, velMin: null, velMax: null, noteOff80: 0, noteOn0: 0, ccs: {}, other: {}, noteMin: null, noteMax: null })
const hex = (d: Uint8Array) => [...d].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')

const hot = import.meta.hot
const init: Rig = { log: [], stats: emptyStats(), playback: false, muted: false, level: synth.DEFAULT_GAIN, sendEnabled: false, sendStatus: '' }
export const useRig = (hot?.data.rig as ReturnType<typeof make> | undefined) ?? make()
function make() { return create<Rig>()(() => init) }
const set = useRig.setState

interface Mem { last: number; n: number; lastSend: number[]; testTimer?: number; sentAny: boolean }
const mem: Mem = hot ? (hot.data.mem ??= { last: 0, n: 0, lastSend: [], sentAny: false }) : { last: 0, n: 0, lastSend: [], sentAny: false }

function decode(d: Uint8Array): string {
  const s = d[0]
  if (s >= 0xf0) return ({ 0xf0: 'SysEx', 0xf8: 'Clock', 0xfa: 'Start', 0xfb: 'Continue', 0xfc: 'Stop', 0xfe: 'ActiveSensing', 0xff: 'Reset' } as Record<number, string>)[s] ?? `System 0x${s.toString(16)}`
  const ch = (s & 15) + 1, a = d[1], b = d[2]
  switch (s & 0xf0) {
    case 0x80: return `NoteOff ch${ch} ${noteName(a)} vel ${b}`
    case 0x90: return `NoteOn ch${ch} ${noteName(a)} vel ${b}${b === 0 ? ' (=off)' : ''}`
    case 0xa0: return `PolyAT ch${ch} ${noteName(a)} ${b}`
    case 0xb0: return `CC ch${ch} #${a} = ${b}`
    case 0xc0: return `Program ch${ch} ${a}`
    case 0xd0: return `ChanAT ch${ch} ${a}`
    default: return `PitchBend ch${ch} ${((b << 7) | a) - 8192}`
  }
}

function onRaw(d: Uint8Array, ts: number) {
  const now = performance.now()
  const dt = mem.last ? now - mem.last : 0
  mem.last = now
  const st = d[0]
  const noisy = st === 0xf8 || st === 0xfe
  set((s) => {
    const k = { ...s.stats, channels: { ...s.stats.channels }, ccs: { ...s.stats.ccs }, other: { ...s.stats.other } }
    k.total++
    const type = st & 0xf0
    if (st < 0xf0) k.channels[(st & 15) + 1] = (k.channels[(st & 15) + 1] ?? 0) + 1
    if (type === 0x90 || type === 0x80) {
      const v = d[2], n = d[1]
      k.noteMin = k.noteMin === null ? n : Math.min(k.noteMin, n)
      k.noteMax = k.noteMax === null ? n : Math.max(k.noteMax, n)
      if (type === 0x80) k.noteOff80++
      else if (v === 0) k.noteOn0++
      if (type === 0x90 && v > 0) { k.velMin = k.velMin === null ? v : Math.min(k.velMin, v); k.velMax = k.velMax === null ? v : Math.max(k.velMax, v) }
    } else if (type === 0xb0) k.ccs[d[1]] = (k.ccs[d[1]] ?? 0) + 1
    else { const key = decode(d).split(' ')[0]; k.other[key] = (k.other[key] ?? 0) + 1 }
    if (noisy) return { stats: k }
    const e: LogEntry = { n: ++mem.n, t: ts, dt, lag: now - ts, hex: hex(d), text: decode(d) }
    return { stats: k, log: [e, ...s.log].slice(0, 120) }
  })
  if (useRig.getState().playback && st < 0xf0) {
    const type = st & 0xf0
    if (type === 0x90 && d[2] > 0) synth.noteOn(d[1], d[2])
    else if (type === 0x80 || type === 0x90) synth.noteOff(d[1])
    else if (type === 0xb0 && d[1] === 64) synth.setSustain(d[2] >= 64)
    else if (type === 0xb0 && (d[1] === 123 || d[1] === 120)) synth.panic()
  }
}

export const resetMonitor = () => set({ log: [], stats: emptyStats() })

export async function setPlayback(on: boolean) {
  if (on) { await synth.enableAudio(); synth.setLevel(useRig.getState().level); synth.setMuted(useRig.getState().muted) }
  else synth.disableAudio()
  set({ playback: on })
}
export function setLevel(v: number) { const l = Math.min(synth.MAX_GAIN, v); synth.setLevel(l); set({ level: l }) }
export function setMuted(m: boolean) { synth.setMuted(m); set({ muted: m }) }
export const panicSynth = () => synth.panic()

// ---- output (opt-in, whitelisted, rate limited) ----
function safeSend(bytes: number[], force = false): boolean {
  const s = bytes[0] & 0xf0, ok = s === 0x90 || s === 0x80 || (s === 0xb0 && (bytes[1] === 123 || bytes[1] === 120))
  if (!ok || bytes.length !== 3) return false
  if (!force && !useRig.getState().sendEnabled) return false
  const now = performance.now()
  mem.lastSend = mem.lastSend.filter((t) => now - t < 1000)
  if (!force && mem.lastSend.length >= 50) return false
  mem.lastSend.push(now)
  mem.sentAny = true
  sendMidi(bytes)
  return true
}
export function setSendEnabled(on: boolean) {
  if (!on) outputPanic()
  set({ sendEnabled: on, sendStatus: on ? 'armed' : '' })
}
export function sendTestNote() {
  if (mem.testTimer || !safeSend([0x90, 60, 64])) { if (!mem.testTimer) set({ sendStatus: 'blocked (rate limit or no output)' }); return }
  set({ sendStatus: 'sent C4 on ch1 vel 64' })
  mem.testTimer = window.setTimeout(() => { mem.testTimer = undefined; safeSend([0x80, 60, 0], true); set({ sendStatus: 'sent C4 off' }) }, 500)
}
export function outputPanic() {
  if (mem.testTimer) { clearTimeout(mem.testTimer); mem.testTimer = undefined; safeSend([0x80, 60, 0], true) }
  if (!mem.sentAny) return
  safeSend([0xb0, 123, 0], true); safeSend([0xb0, 120, 0], true)
  mem.sentAny = false
}
export function panicAll() { panicSynth(); outputPanic(); set({ sendStatus: 'panic sent' }) }

const onHide = () => { if (document.hidden) outputPanic() }
document.addEventListener('visibilitychange', onHide)
window.addEventListener('pagehide', outputPanic)
const unsub = subscribeRaw(onRaw)

if (import.meta.hot) {
  import.meta.hot.data.rig = useRig
  import.meta.hot.dispose(() => {
    unsub(); outputPanic()
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', outputPanic)
  })
  import.meta.hot.accept()
}
