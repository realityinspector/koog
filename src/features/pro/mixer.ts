// Boss mixer: one channel per audio engine, using each engine's own gain setter. Nothing here can exceed an engine's safety cap:
// every fader is a 0..1 trim UNDER the cap, and the app volume/mute (audioSettings) stays the master.
// Mute / solo are applied as a zero trim and fully undone (and every fader put back where it was) when Boss mode closes.
import { create } from 'zustand'
import { getSynth } from '../synth-history/engine'
import { liveEngines, setTrim as setEmuTrim } from '../synth-history/emu/bus'
import { getTrim as djTrim, setTrim as setDjTrim, getView, peak as djPeak } from '../dj/engine'
import { MAX_GAIN, getState as beatsState, setGain as setBeatsGain } from '../beats/engine'
import { getState as bandState, setVolume as setBandVolume } from '../smartband/engine'

export interface Chan { id: string; label: string; icon: string; get(): number; set(v: number): void; peak?(): number; note?: string }
const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0))
const wavePeak = (an: AnalyserNode | null | undefined, buf: Float32Array<ArrayBuffer>) => { if (!an) return 0; an.getFloatTimeDomainData(buf); let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i])); return m }
const sbuf = new Float32Array(1024)

// the loop station is built by another module: use whatever level setter it exports, if any
const loopMods = import.meta.glob('../loopstation/*.ts', { eager: true }) as Record<string, Record<string, unknown>>
const loopFn = (names: string[]) => { for (const m of Object.values(loopMods)) for (const n of names) if (typeof m[n] === 'function') return m[n] as (...a: unknown[]) => unknown; return null }

export const CHANNELS: Chan[] = [
  { id: 'keys', label: 'KEYS', icon: '🎹', note: 'Koog synth level and every emulator',
    get: () => getSynth().params.level,
    set: (v) => { getSynth().setParams({ level: clamp01(v) }); setEmuTrim(clamp01(v)) },
    peak: () => Math.max(wavePeak(getSynth().analyser(), sbuf), ...liveEngines().map((e) => e.peak())) },
  { id: 'dj', label: 'DJ', icon: '🎧', note: 'both decks (master trim)', get: djTrim, set: setDjTrim, peak: () => (getView().ready ? djPeak() : 0) },
  { id: 'beats', label: 'DRUMS', icon: '🥁', note: 'beat machine', get: () => beatsState().gain / MAX_GAIN, set: (v) => setBeatsGain(clamp01(v) * MAX_GAIN) },
  { id: 'band', label: 'BAND', icon: '🤖', note: 'Smart Band', get: () => bandState().volume, set: (v) => setBandVolume(clamp01(v)) },
  { id: 'loops', label: 'LOOPS', icon: '🔁', note: 'loop station',
    get: () => { const g = loopFn(['getLoopLevel', 'getLevel', 'getVolume']); return g ? Number(g()) || 0 : 1 },
    set: (v) => { const s = loopFn(['setLoopLevel', 'setLevel', 'setVolume']); s?.(clamp01(v)) },
    peak: () => { const p = loopFn(['loopPeak', 'peak']); return p ? Number(p()) || 0 : 0 } },
]
export const hasLoopLevel = () => !!loopFn(['setLoopLevel', 'setLevel', 'setVolume'])

interface MixState { fader: Record<string, number>; muted: Record<string, boolean>; solo: string | null; orig: Record<string, number> | null }
const hot = import.meta.hot?.data as { mix?: ReturnType<typeof make> } | undefined
function make() { return create<MixState>()(() => ({ fader: {}, muted: {}, solo: null, orig: null })) }
export const useMixer = hot?.mix ?? make()

const eff = (id: string, s = useMixer.getState()) => (s.muted[id] || (s.solo && s.solo !== id) ? 0 : s.fader[id] ?? 1)
function applyAll() { const s = useMixer.getState(); for (const c of CHANNELS) c.set(eff(c.id, s)) }

/** remember where every fader was (first call only) so closing Boss mode can put it all back */
export function mixerOpen() {
  const s = useMixer.getState()
  if (s.orig) return
  const orig: Record<string, number> = {}, fader: Record<string, number> = {}
  for (const c of CHANNELS) { orig[c.id] = c.get(); fader[c.id] = orig[c.id] }
  useMixer.setState({ orig, fader })
}
export function mixerClose() {
  const s = useMixer.getState()
  if (!s.orig) return
  for (const c of CHANNELS) c.set(s.orig[c.id] ?? c.get())
  useMixer.setState({ orig: null, muted: {}, solo: null, fader: {} })
}
export function setFader(id: string, v: number) { useMixer.setState((s) => ({ fader: { ...s.fader, [id]: clamp01(v) } })); CHANNELS.find((c) => c.id === id)?.set(eff(id)) }
export function toggleMute(id: string) { useMixer.setState((s) => ({ muted: { ...s.muted, [id]: !s.muted[id] } })); applyAll() }
export function toggleSolo(id: string) { useMixer.setState((s) => ({ solo: s.solo === id ? null : id })); applyAll() }
/** fader values for scenes (the user's faders, not the muted zeros) */
export const faderValues = (): Record<string, number> => { const s = useMixer.getState(); return Object.fromEntries(CHANNELS.map((c) => [c.id, s.fader[c.id] ?? c.get()])) }
export function setFaderValues(v: Record<string, number> | undefined) { if (!v) return; for (const c of CHANNELS) if (typeof v[c.id] === 'number') setFader(c.id, v[c.id]) }

if (import.meta.hot) { import.meta.hot.data.mix = useMixer; import.meta.hot.accept() }
