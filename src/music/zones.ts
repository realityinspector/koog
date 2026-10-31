// Keyboard split and layering (Pro/Dad feature; routing is generic). Up to 3 zones, each with a key range, a sound
// (the Koog synth or any emulator preset, via createEngine), a transpose, a volume and an on/off switch.
//   single : today's behaviour (zones off; localNotes uses the active instrument or the Koog synth)
//   split  : zone 0 below the split key, zone 1 from the split key up
//   layer  : zones 0 and 1 both cover the whole keyboard
//   both   : zone 0 low, zone 1 high, zone 2 layered over the high part
// An open emulator panel (setActiveInstrument with a non-"sound:" id) still wins for the whole keyboard; zones resume after.
// Each zone owns its own engine (created/disposed here). Layers scale velocity so stacked zones stay under the caps
// (2 zones -> 0.7 each, 3 -> 0.58), on top of each engine's own 0.15 master cap and limiter.
// STABLE API: useZones, routeZones, zonesActive, setZoneMode, setSplitPoint, setZone, learnSplit, getFocusedZone,
// setFocusedZone, onFocusedZoneChange, onZonesChange, onZonesRelease, controlEngine, unlockZones, zoneRange.
import { create } from 'zustand'
import { getSynth } from '../features/synth-history/engine'
import { createEngine, type Engine } from '../features/synth-history/emu/core'
import { getEmu } from '../features/synth-history/emu'
import { newestEngine } from '../features/synth-history/emu/bus'
import { SOUNDS, type SoundChoice } from '../features/devices/soundChoice'
import { onProfileChange, pload, psave } from '../profile/profile'
import { getActiveInstrument } from './instrument'

export type ZoneMode = 'single' | 'split' | 'layer' | 'both'
export interface ZoneCfg { sound: string; oct: number; semi: number; vol: number; on: boolean }
export interface ZoneState { mode: ZoneMode; split: number; zones: ZoneCfg[]; focused: number; touched: boolean; learning: boolean }
export interface ZoneTarget { noteOn(n: number, v: number): void; noteOff(n: number): void; allOff(): void; unlock(): Promise<void>; ready(): boolean }
export interface ZoneHit { t: ZoneTarget; note: number; vel: number; zone: number }

export const ZONE_COLORS = ['#ff9b54', '#4cc9f0', '#b388ff']
export const ZONE_SOUNDS: SoundChoice[] = [
  ...SOUNDS,
  { id: 'bass303', label: 'TB-303 bass', icon: '🐸', emu: 'tb303', preset: 'Round bass' },
  { id: 'acid', label: 'TB-303 acid', icon: '🧪', emu: 'tb303', preset: 'Squelch' },
]
const KEY = 'split.v1'
const LAYER_GAIN = [1, 1, 0.7, 0.58]

const defaults = (): ZoneState => ({
  mode: 'single', split: 60, focused: 0, touched: false, learning: false,
  zones: [
    { sound: 'organ', oct: 0, semi: 0, vol: 1, on: true },
    { sound: 'strings', oct: 0, semi: 0, vol: 1, on: true },
    { sound: 'pad', oct: 0, semi: 0, vol: 1, on: true },
  ],
})
type Fn = () => void
interface Slot { sound: string; e: Engine }
interface Hot { store?: ReturnType<typeof make>; slots?: (Slot | null)[]; chg?: Set<Fn>; rel?: Set<Fn>; foc?: Set<Fn>; off?: () => void }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<ZoneState>()(() => defaults()) }
export const useZones = hot.store ?? make()
const slots: (Slot | null)[] = hot.slots ?? [null, null, null]
const chg = hot.chg ?? new Set<Fn>(), rel = hot.rel ?? new Set<Fn>(), foc = hot.foc ?? new Set<Fn>()
const S = () => useZones.getState()
const fire = (set: Set<Fn>) => { for (const f of [...set]) { try { f() } catch { /* isolate */ } } }

export const onZonesChange = (f: Fn) => { chg.add(f); return () => { chg.delete(f) } }
/** structural change (mode, split, a sound, a mute): release every note that was routed through the zones */
export const onZonesRelease = (f: Fn) => { rel.add(f); return () => { rel.delete(f) } }
export const onFocusedZoneChange = (f: Fn) => { foc.add(f); return () => { foc.delete(f) } }

// ---------- geometry ----------
export const activeIdx = (m: ZoneMode): number[] => (m === 'single' ? [] : m === 'both' ? [0, 1, 2] : [0, 1])
/** [lo, hi] (inclusive MIDI notes) a zone listens to in a mode */
export function zoneRange(mode: ZoneMode, split: number, i: number): [number, number] {
  if (mode === 'split') return i === 0 ? [0, split - 1] : [split, 127]
  if (mode === 'both') return i === 0 ? [0, split - 1] : [split, 127]
  return [0, 127]
}

/** an emulator panel (or anything that is not the kid's picked "sound:") is overriding the keyboard */
export const panelOverride = () => { const i = getActiveInstrument(); return !!i && !i.id.startsWith('sound:') }
export const zonesActive = () => S().mode !== 'single' && !panelOverride()

// ---------- engines & targets ----------
const soundOf = (id: string) => ZONE_SOUNDS.find((s) => s.id === id) ?? ZONE_SOUNDS[0]
function build(id: string): Engine | null {
  const ch = soundOf(id)
  const spec = ch.emu ? getEmu(ch.emu) : undefined
  if (!spec) return null
  const e = createEngine(spec)
  const p = spec.presets.find((x) => x.name === ch.preset) ?? spec.presets[0]
  if (p) for (const c of spec.ctls) e.set(c.key, p.values[c.key] ?? c.def)
  return e
}
function sync() {
  const s = S(), act = activeIdx(s.mode)
  for (let i = 0; i < 3; i++) {
    const want = act.includes(i) && s.zones[i].sound !== 'koog' ? s.zones[i].sound : null
    const cur = slots[i]
    if (cur && cur.sound === want) continue
    if (cur) { try { cur.e.allOff(); cur.e.dispose() } catch { /* ignore */ } slots[i] = null }
    if (want) { const e = build(want); if (e) slots[i] = { sound: want, e } }
  }
}
export const getZoneEngine = (i: number): Engine | null => slots[i]?.e ?? null

const targets: ZoneTarget[] = [0, 1, 2].map((i) => ({
  noteOn: (n, v) => { const e = slots[i]?.e; if (e) e.noteOn(n, v); else if (S().zones[i].sound === 'koog') getSynth().noteOn(n, v) },
  noteOff: (n) => { const e = slots[i]?.e; if (e) e.noteOff(n); else getSynth().noteOff(n) },
  allOff: () => { const e = slots[i]?.e; if (e) e.allOff() },
  unlock: async () => { const e = slots[i]?.e; await Promise.all([e ? e.unlock() : Promise.resolve(), getSynth().unlock()]) },
  ready: () => { const e = slots[i]?.e; return e ? e.ctx()?.state === 'running' : getSynth().ready },
}))
export const zoneTarget = (i: number) => targets[i]
export async function unlockZones() { if (S().mode !== 'single') await Promise.all(activeIdx(S().mode).map((i) => targets[i].unlock())) }
/** silence every zone engine (panic) */
export function zonesAllOff() { for (const t of targets) t.allOff() }

// ---------- routing ----------
const clampN = (n: number) => Math.max(0, Math.min(127, n))
/** The zone hits for one key (physical note), or null when zones are not in charge (single mode / panel open). */
export function routeZones(note: number, vel: number): ZoneHit[] | null {
  if (!zonesActive()) return null
  const s = S()
  const hit = activeIdx(s.mode).filter((i) => {
    const z = s.zones[i], [lo, hi] = zoneRange(s.mode, s.split, i)
    return z.on && note >= lo && note <= hi
  })
  const scale = LAYER_GAIN[hit.length] ?? 0.5
  const out: ZoneHit[] = []
  const seenSynth = new Set<number>()
  for (const i of hit) {
    const z = s.zones[i], n = clampN(note + 12 * z.oct + z.semi)
    if (n !== note + 12 * z.oct + z.semi) continue // transposed off the end of the keyboard
    if (z.sound === 'koog') { if (seenSynth.has(n)) continue; seenSynth.add(n) } // the shared synth plays a pitch once
    out.push({ t: targets[i], note: n, vel: Math.max(1, Math.min(127, Math.round(vel * z.vol * scale))), zone: i })
  }
  return out
}
/** Press-a-key split learning: returns true when this note-on was swallowed to set the split point. */
export function consumeLearn(note: number): boolean {
  if (!S().learning) return false
  useZones.setState({ learning: false })
  setSplitPoint(note)
  return true
}

// ---------- focus (Controller Mode drives this zone's engine) ----------
export function getFocusedZone(): number {
  const a = activeIdx(S().mode); const f = S().focused
  return a.includes(f) ? f : (a[0] ?? 0)
}
export function setFocusedZone(i: number) {
  if (!activeIdx(S().mode).includes(i) || S().focused === i) return
  useZones.setState({ focused: i }); persist(); fire(foc); fire(chg)
}
/** The emulator engine a control surface should steer right now (null = the Koog synth). */
export function controlEngine(): Engine | null {
  if (zonesActive()) return getZoneEngine(getFocusedZone())
  return newestEngine()
}

// ---------- changes ----------
function persist() { const { mode, split, zones, focused, touched } = S(); psave(KEY, { mode, split, zones, focused, touched }) }
function commit(patch: Partial<ZoneState>, structural: boolean) {
  if (structural) fire(rel)
  useZones.setState(patch)
  if (structural) sync()
  persist(); fire(chg); if ('focused' in patch || structural) fire(foc)
}
const SEED: Partial<Record<ZoneMode, Partial<ZoneCfg>[]>> = {
  split: [{ sound: 'bass303', oct: -1 }, { sound: 'pad', oct: 0 }],
  layer: [{ sound: 'organ' }, { sound: 'strings' }],
  both: [{ sound: 'bass303', oct: -1 }, { sound: 'pad' }, { sound: 'strings' }],
}
export function setZoneMode(mode: ZoneMode) {
  const s = S(); if (s.mode === mode) return
  let zones = s.zones
  const seed = SEED[mode]
  if (!s.touched && seed) zones = zones.map((z, i) => ({ ...z, ...(seed[i] ?? {}) }))
  commit({ mode, zones, learning: false }, true)
}
export function setSplitPoint(note: number) { commit({ split: Math.max(24, Math.min(100, Math.round(note))) }, true) }
export function setZone(i: number, patch: Partial<ZoneCfg>) {
  const s = S(); if (!s.zones[i]) return
  const p = { ...patch }
  if (p.vol !== undefined) p.vol = Math.max(0, Math.min(1, p.vol))
  if (p.oct !== undefined) p.oct = Math.max(-3, Math.min(3, Math.round(p.oct)))
  if (p.semi !== undefined) p.semi = Math.max(-11, Math.min(11, Math.round(p.semi)))
  const structural = (p.sound !== undefined && p.sound !== s.zones[i].sound) || (p.on !== undefined && p.on !== s.zones[i].on)
  commit({ zones: s.zones.map((z, k) => (k === i ? { ...z, ...p } : z)), touched: true }, structural)
}
export function learnSplit(on = true) { useZones.setState({ learning: on }); fire(chg) }

function load() {
  const d = defaults(), sv = pload<Partial<ZoneState>>(KEY, {})
  const zones = d.zones.map((z, i) => ({ ...z, ...(sv.zones?.[i] ?? {}) }))
  const mode: ZoneMode = sv.mode === 'split' || sv.mode === 'layer' || sv.mode === 'both' ? sv.mode : 'single'
  fire(rel)
  useZones.setState({ ...d, mode, zones, split: Number.isFinite(sv.split) ? (sv.split as number) : d.split, focused: sv.focused ?? 0, touched: !!sv.touched })
  sync(); fire(chg); fire(foc)
}

hot.off?.()
const offProfile = onProfileChange(load)
load()

if (import.meta.hot) {
  import.meta.hot.data.store = useZones
  import.meta.hot.data.slots = slots
  import.meta.hot.data.chg = chg; import.meta.hot.data.rel = rel; import.meta.hot.data.foc = foc
  import.meta.hot.data.off = offProfile
  import.meta.hot.accept()
}
