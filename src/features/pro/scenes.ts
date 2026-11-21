// Boss scenes: save and recall a whole setup by name (8 slots, per kid via pload/psave).
// Captured: picked sound + its emulator params, Koog patch, controller layout + on/off, keyboard split/layers, mixer faders,
// master bpm, key (+ auto-detect), sheet level, visual mode. DJ deck state is NOT captured (decks are live audio, not a setup).
import { create } from 'zustand'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { chooseSound, soundEngine, useSound } from '../devices/soundChoice'
import { getSynth } from '../synth-history/engine'
import type { SynthParams } from '../synth-history/params'
import { getSavedLayout, setSavedLayout, setScreenMode, useSurface } from '../controller/surface'
import { setSplitPoint, setZone, setZoneMode, useZones, type ZoneCfg, type ZoneMode } from '../../music/zones'
import { getBpm, setBpm } from '../../music/masterClock'
import { useHarmonyStore } from '../../music/harmonyStore'
import type { Key } from '../../music/theory'
import { getSheetLevel, setSheetLevel, type SheetLevel } from '../../music/sheetLevel'
import { faderValues, setFaderValues } from './mixer'

export interface Scene {
  name: string; at: number
  sound: string; emu?: Record<string, number>; koog: SynthParams
  ctl: { on: boolean; layout: Record<string, Record<string, string>> }
  split?: { mode: ZoneMode; split: number; zones: ZoneCfg[] }
  mix: Record<string, number>
  bpm: number; key: Key; auto: boolean; sheet: SheetLevel; viz: string | null
}
export const SLOTS = 8
const NAME = 'pro.scenes.v1'
const load = (): (Scene | null)[] => { const v = pload<(Scene | null)[]>(NAME, []); return Array.from({ length: SLOTS }, (_, i) => v[i] ?? null) }
const hot = import.meta.hot?.data as { store?: ReturnType<typeof make>; off?: () => void } | undefined
function make() { return create<{ scenes: (Scene | null)[]; last: number | null }>()(() => ({ scenes: load(), last: null })) }
export const useScenes = hot?.store ?? make()
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

export function saveScene(i: number, name?: string) {
  const emu = soundEngine()
  const z = useZones.getState()
  let viz: string | null = null
  try { viz = localStorage.getItem('koog.viz.mode') } catch { /* ignore */ }
  const h = useHarmonyStore.getState()
  const sc: Scene = {
    name: (name || useScenes.getState().scenes[i]?.name || 'Scene ' + (i + 1)).slice(0, 18), at: Date.now(),
    sound: useSound.getState().id, emu: emu ? { ...emu.P } : undefined, koog: clone(getSynth().params),
    ctl: { on: useSurface.getState().on, layout: getSavedLayout() },
    split: { mode: z.mode, split: z.split, zones: clone(z.zones) },
    mix: faderValues(), bpm: getBpm(), key: clone(h.key), auto: h.autoDetect, sheet: getSheetLevel(), viz,
  }
  const scenes = useScenes.getState().scenes.map((s, k) => (k === i ? sc : s))
  psave(NAME, scenes); useScenes.setState({ scenes, last: i })
}
export function deleteScene(i: number) { const scenes = useScenes.getState().scenes.map((s, k) => (k === i ? null : s)); psave(NAME, scenes); useScenes.setState({ scenes }) }
export function renameScene(i: number, name: string) { const scenes = useScenes.getState().scenes.map((s, k) => (k === i && s ? { ...s, name: name.slice(0, 18) } : s)); psave(NAME, scenes); useScenes.setState({ scenes }) }

export function recallScene(i: number) {
  const s = useScenes.getState().scenes[i]; if (!s) return false
  chooseSound(s.sound)
  const e = soundEngine(); if (e && s.emu) for (const [k, v] of Object.entries(s.emu)) e.set(k, v)
  getSynth().setParams(clone(s.koog))
  setSavedLayout(clone(s.ctl.layout))
  if (useSurface.getState().on !== s.ctl.on) setScreenMode(s.ctl.on)
  if (s.split) { setZoneMode(s.split.mode); setSplitPoint(s.split.split); s.split.zones.forEach((z, k) => setZone(k, z)) }
  setFaderValues(s.mix)
  setBpm(s.bpm)
  const h = useHarmonyStore.getState(); h.setAutoDetect(false); h.setKey(clone(s.key)); if (s.auto) h.setAutoDetect(true)
  setSheetLevel(s.sheet)
  try { if (s.viz) localStorage.setItem('koog.viz.mode', s.viz) } catch { /* ignore */ }
  useScenes.setState({ last: i })
  return true
}

hot?.off?.()
// outside the hot block: registered only under HMR before, so a production build never reloaded scenes for the next player
const off = onProfileChange(() => useScenes.setState({ scenes: load(), last: null }), 'scenes')
if (import.meta.hot) {
  import.meta.hot.data.store = useScenes; import.meta.hot.data.off = off
  import.meta.hot.accept()
}
