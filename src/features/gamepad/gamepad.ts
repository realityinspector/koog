// A wireless game controller.
// The computer pairs it (System Settings on a Mac). This page cannot start Bluetooth.
// After a button press, Chrome exposes the pad through the Gamepad API. The event's
// gamepad object is a snapshot, so the live buttons are read from navigator.getGamepads()
// inside a frame loop. The loop runs only while a pad is connected.
// Notes go through playLocal, the same path as the computer keyboard. This is not a MIDI port.
// A press is not a user-activation gesture, so the first notes may be silent until the page
// has been clicked. They still reach the note feed.
// Play keeps the 8-note stepper (padMap.ts) and adds the controls that stepper ignores.
// Drums, Synth, and Pro run the full map in padAssign.ts and do not also run the note stepper.
// This pad never calls setSustain. Hold notes uses setHold. Sustain in the Pro list is the synth knob.

import { create } from 'zustand'
import { useAppStore } from '../../store/appStore'
import { playLocal, unlockAudio } from '../../music/localNotes'
import { useHarmonyStore } from '../../music/harmonyStore'
import { panicAll, registerPanicTarget } from '../../music/panic'
import { tapTempo } from '../../music/masterClock'
import { useLinkIn, useLinkOut } from '../../links/bus'
import { pressStart } from '../padplay/padplay'
import { scaleNotes } from '../padplay/padCore'
import { liveHit } from '../drumpads/drumEngine'
import { soundEngine } from '../devices/soundChoice'
import { getPitchBend, getSynth, setHold, setPitchBend } from '../synth-history/engine'
import type { SynthParams } from '../synth-history/params'
import { freshMem, isPlayPad, padLabel, stepPad, type BtnLike, type Mem } from './padMap'
import { activeMap, freshAssign, playSideMap, quietAssign, stepAssign, RANGES, type AssignMem, type Fire, type ParamKey } from './padAssign'
import { usePadRole } from './padRole'

/** Same ids as VISUALS in VizControls.tsx. Kept here so this file does not load the picture engine. */
const PICTURES = ['fireworks', 'ripples', 'rise', 'fire', 'ghost', 'mail', 'confetti', 'zombie', 'vibes', 'dancer'] as const

export interface WirelessPad { index: number; name: string; oct: number }
interface WirelessState { pads: WirelessPad[]; /** a controller is connected, and it is not one Koog can play */ other: boolean }
interface Inject { id: string; buttons: BtnLike[] }
interface Hot {
  mems: Map<number, Mem>
  assign: Map<number, AssignMem>
  names: Map<number, string>
  injected: Map<number, Inject>
  looping: boolean
  raf: number
  bound: boolean
  starts: number
  asked: boolean
  releasing: boolean
  panicking: boolean
  roleBound: boolean
  store?: ReturnType<typeof makeStore>
  tick?: () => void
  onConnect?: (e: GamepadEvent) => void
  onDisconnect?: (e: GamepadEvent) => void
  onSilence?: () => void
  onPoke?: () => void
}

const hot = import.meta.hot
const keep: Hot = (hot?.data.gp as Hot | undefined) ?? {
  mems: new Map(), assign: new Map(), names: new Map(), injected: new Map(),
  looping: false, raf: 0, bound: false, starts: 0, asked: false,
  releasing: false, panicking: false, roleBound: false,
}
keep.mems ??= new Map()
keep.assign ??= new Map()
keep.names ??= new Map()
keep.injected ??= new Map()

function makeStore() {
  return create<WirelessState>(() => ({ pads: [], other: false }))
}
export const useWireless = keep.store ?? makeStore()
keep.store = useWireless

function notesOf(mem: Mem): number[] {
  return [...new Set(mem.held.values())]
}

function publish() {
  const pads: WirelessPad[] = []
  for (const [index, mem] of keep.mems) pads.push({ index, name: keep.names.get(index) ?? 'Wireless controller', oct: mem.oct })
  pads.sort((a, b) => a.index - b.index)
  const cur = useWireless.getState().pads
  if (cur.length === pads.length && cur.every((p, i) => p.index === pads[i].index && p.name === pads[i].name && p.oct === pads[i].oct)) return
  useWireless.setState({ pads })
}

function wake() {
  if (keep.asked) return
  keep.asked = true
  void unlockAudio().catch(() => { keep.asked = false })
}

const EMU_ALIAS: Partial<Record<ParamKey, string[]>> = {
  resonance: ['reso'], filterEnv: ['env', 'fenv'], attack: ['a'], decay: ['d'], sustain: ['s'], release: ['r'],
}

function mapNow() {
  const s = usePadRole.getState()
  return s.role === 'play' ? playSideMap() : activeMap(s.role, s.map)
}

function readParam(key: ParamKey): number {
  if (key === 'bend') {
    const b = getPitchBend()
    return Number.isFinite(b) ? b : 0
  }
  const v = getSynth().params[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const r = RANGES[key]
  return (r.min + r.max) / 2
}

function applyParam(key: ParamKey, value: number) {
  if (key === 'bend') { setPitchBend(value); return }
  const synth = getSynth()
  const patch: Partial<SynthParams> = { [key]: value }
  if (key === 'lfoDepth' && value > 0.05 && synth.params.lfoTarget === 'none') patch.lfoTarget = 'pitch'
  synth.setParams(patch)
  const e = soundEngine()
  if (!e) return
  for (const k of [key, ...(EMU_ALIAS[key] ?? [])]) {
    if (Object.prototype.hasOwnProperty.call(e.P, k)) e.set(k, value)
  }
}

function nextPicture() {
  const cur = useLinkOut.getState().visual
  const i = PICTURES.indexOf(cur as typeof PICTURES[number])
  const base = i >= 0 ? i : 0
  useLinkIn.setState({ visual: PICTURES[(base + 1) % PICTURES.length] })
}

function emitFires(fires: Fire[]) {
  let panic = false
  for (const f of fires) {
    if (f.t === 'panic') { panic = true; continue }
    if (f.t === 'on') { wake(); playLocal(f.note, f.vel, true) }
    else if (f.t === 'off') playLocal(f.note, 0, false)
    else if (f.t === 'drum' && f.voice >= 0 && f.voice < 8) { wake(); liveHit(f.voice, f.vel) }
    else if (f.t === 'start') { keep.starts++; pressStart() }
    else if (f.t === 'tap') { wake(); tapTempo() }
    else if (f.t === 'picture') nextPicture()
    else if (f.t === 'wave') getSynth().setParams({ wave: f.wave })
    else if (f.t === 'hold') setHold(f.on)
    else if (f.t === 'param') applyParam(f.key, f.value)
  }
  if (panic && !keep.panicking) {
    keep.panicking = true
    try { panicAll() } finally { keep.panicking = false }
  }
}

/** The note stepper only. injectWireless stays on this path, so its on/off/start stay what the fixtures describe. */
function apply(index: number, id: string, buttons: ArrayLike<BtnLike | null>) {
  const mem = keep.mems.get(index) ?? freshMem()
  keep.names.set(index, padLabel(id))
  const out = stepPad(mem, buttons, (oct) => scaleNotes(useHarmonyStore.getState().key, oct))
  keep.mems.set(index, out.mem)
  if (out.off.length || out.on.length) {
    wake()
    for (const n of out.off) playLocal(n, 0, false)
    for (const e of out.on) playLocal(e.note, e.vel, true)
  }
  if (out.start) { keep.starts++; pressStart() }
  return out
}

function scaleAt(oct: number) {
  return scaleNotes(useHarmonyStore.getState().key, oct)
}

/** Live pad: Play runs the note stepper plus the controls it ignores. Every other job runs the full map once. */
function applyLive(index: number, id: string, buttons: ArrayLike<BtnLike | null>, axes: ArrayLike<number> | null) {
  keep.names.set(index, padLabel(id))
  const role = usePadRole.getState()
  const now = performance.now()
  if (role.role === 'play') {
    const mem = keep.mems.get(index) ?? freshMem()
    const out = stepPad(mem, buttons, scaleAt)
    keep.mems.set(index, out.mem)
    if (out.off.length || out.on.length) {
      wake()
      for (const n of out.off) playLocal(n, 0, false)
      for (const e of out.on) playLocal(e.note, e.vel, true)
    }
    if (out.start) { keep.starts++; pressStart() }
    const prevA = keep.assign.get(index) ?? freshAssign()
    prevA.oct = 0
    const side = stepAssign(prevA, buttons, axes, playSideMap(), (oct) => scaleAt(out.mem.oct + oct), now, readParam)
    keep.assign.set(index, side.mem)
    emitFires(side.fires)
    return
  }
  const old = keep.mems.get(index)
  if (old?.held.size) for (const n of notesOf(old)) playLocal(n, 0, false)
  const prevA = keep.assign.get(index) ?? freshAssign()
  if (prevA.oct === 0 && old && old.oct !== 0) prevA.oct = old.oct
  const out = stepAssign(prevA, buttons, axes, activeMap(role.role, role.map), scaleAt, now, readParam)
  keep.assign.set(index, out.mem)
  keep.mems.set(index, { down: Array.from({ length: 16 }, () => false), held: new Map(), oct: out.mem.oct })
  emitFires(out.fires)
}

function liveInput(index: number): { buttons: ArrayLike<BtnLike | null> | null; axes: ArrayLike<number> | null } {
  try {
    const g = navigator.getGamepads?.()?.[index]
    if (g) return { buttons: g.buttons, axes: g.axes }
  } catch { /* getGamepads can throw before a gesture */ }
  return { buttons: null, axes: null }
}

function drop(index: number) {
  const mem = keep.mems.get(index)
  const asg = keep.assign.get(index)
  keep.mems.delete(index)
  keep.assign.delete(index)
  keep.names.delete(index)
  if (mem) for (const n of notesOf(mem)) playLocal(n, 0, false)
  if (!asg) return
  const gone = stepAssign(asg, null, null, mapNow(), scaleAt, performance.now(), readParam)
  emitFires(gone.fires)
}

/** A connected pad that is not a play pad. Hidden while a play pad (or an injected one) is present. */
function noteOther(extra?: { id: string; mapping: string }) {
  let play = keep.mems.size > 0
  let other = false
  try {
    const list = navigator.getGamepads?.()
    if (list) for (const g of list) {
      if (!g) continue
      if (isPlayPad(g.id, g.mapping)) play = true
      else other = true
    }
  } catch { /* getGamepads can throw before a gesture */ }
  if (extra) {
    if (isPlayPad(extra.id, extra.mapping)) play = true
    else other = true
  }
  const next = !play && other
  if (!!useWireless.getState().other !== next) useWireless.setState({ other: next })
}

function realIndexes(): Set<number> {
  const s = new Set<number>()
  try {
    const list = navigator.getGamepads?.()
    if (!list) return s
    for (const g of list) if (g && isPlayPad(g.id, g.mapping)) s.add(g.index)
  } catch { /* getGamepads can throw before a gesture */ }
  return s
}

function tick() {
  const seen = new Set<number>()
  try {
    const list = navigator.getGamepads?.()
    if (list) {
      for (const g of list) {
        if (!g || !isPlayPad(g.id, g.mapping)) continue
        seen.add(g.index)
        applyLive(g.index, g.id, g.buttons, g.axes)
      }
    }
  } catch { /* ignore */ }
  for (const [index, fake] of keep.injected) {
    seen.add(index)
    apply(index, fake.id, fake.buttons)
  }
  for (const index of [...keep.mems.keys()]) if (!seen.has(index)) drop(index)
  publish()
  noteOther()
  if (keep.mems.size === 0) keep.looping = false
}

function ensureLoop() {
  if (keep.looping) return
  keep.looping = true
  const loop = () => {
    try { keep.tick?.() } catch { /* a bad frame must not kill the pad */ }
    if (keep.looping) keep.raf = requestAnimationFrame(loop)
    else keep.raf = 0
  }
  keep.raf = requestAnimationFrame(loop)
}

function scan(): boolean {
  try {
    const list = navigator.getGamepads?.()
    if (!list) return false
    for (const g of list) if (g && isPlayPad(g.id, g.mapping)) return true
  } catch { /* not allowed yet */ }
  return false
}

/** Let go of sounding notes. Buttons that are still down do not restrike until they are pressed again. */
function releaseHeld() {
  if (keep.releasing) return
  keep.releasing = true
  try {
    const map = mapNow()
    for (const [index, mem] of keep.mems) {
      for (const n of notesOf(mem)) playLocal(n, 0, false)
      const down = mem.down.slice()
      const input = liveInput(index)
      if (input.buttons) {
        for (let i = 0; i < down.length; i++) {
          const b = input.buttons[i]
          down[i] = !!(b && (b.pressed || b.value >= 0.5))
        }
      }
      keep.mems.set(index, { down, held: new Map(), oct: mem.oct })
      const asg = keep.assign.get(index)
      if (!asg) continue
      const q = quietAssign(asg, input.buttons, input.axes, map)
      keep.assign.set(index, q.mem)
      emitFires(q.fires)
    }
  } finally { keep.releasing = false }
}

export interface PadInject { id: string; mapping?: string; index?: number; buttons: BtnLike[] }
export interface PadView {
  ignored: boolean
  pads: WirelessPad[]
  on: { note: number; vel: number }[]
  off: number[]
  start: boolean
  starts: number
  notes: { note: number; on: boolean; v: number }[]
}

function view(ignored: boolean, on: { note: number; vel: number }[] = [], off: number[] = [], start = false): PadView {
  const notes = useAppStore.getState().recentNotes.slice(0, 8).map((n) => ({ note: n.note, on: n.on, v: n.velocity }))
  return { ignored, pads: useWireless.getState().pads, on, off, start, starts: keep.starts, notes }
}

/** Drive one pad without hardware. A later poll keeps the last buttons until injectWireless(null). */
export function injectWireless(snap: PadInject | null): PadView {
  if (snap === null) {
    const idxs = [...keep.injected.keys()]
    keep.injected.clear()
    const real = realIndexes()
    for (const idx of idxs) if (!real.has(idx)) drop(idx)
    publish()
    if (keep.mems.size === 0) keep.looping = false
    noteOther()
    return view(false)
  }
  const mapping = snap.mapping ?? ''
  if (!isPlayPad(snap.id, mapping)) return view(true)
  const index = snap.index ?? 0
  keep.injected.set(index, { id: snap.id, buttons: snap.buttons })
  const out = apply(index, snap.id, snap.buttons)
  publish()
  ensureLoop()
  return view(false, out.on, out.off, out.start)
}

keep.tick = tick
keep.onConnect = (e) => {
  if (isPlayPad(e.gamepad.id, e.gamepad.mapping)) ensureLoop()
  noteOther(e.gamepad)
}
keep.onDisconnect = (e) => {
  keep.injected.delete(e.gamepad.index)
  drop(e.gamepad.index)
  publish()
  noteOther()
  if (keep.mems.size === 0) keep.looping = false
}
keep.onSilence = releaseHeld
keep.onPoke = () => { noteOther(); if (scan()) ensureLoop() }

function bind() {
  if (keep.bound || typeof window === 'undefined') return
  keep.bound = true
  window.addEventListener('gamepadconnected', (e) => keep.onConnect?.(e))
  window.addEventListener('gamepaddisconnected', (e) => keep.onDisconnect?.(e))
  window.addEventListener('blur', () => keep.onSilence?.())
  window.addEventListener('pagehide', () => keep.onSilence?.())
  document.addEventListener('visibilitychange', () => { if (document.hidden) keep.onSilence?.() })
  const poke = () => keep.onPoke?.()
  window.addEventListener('pointerdown', poke)
  window.addEventListener('keydown', poke)
}

bind()
if (!keep.roleBound) {
  keep.roleBound = true
  usePadRole.subscribe((s, prev) => {
    if (s.role !== prev.role || s.map !== prev.map) keep.onSilence?.()
  })
}
registerPanicTarget('wireless', () => keep.onSilence?.())
if (scan()) ensureLoop()

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __koogGamepad?: typeof injectWireless }).__koogGamepad = injectWireless
}

if (hot) {
  hot.data.gp = keep
  hot.accept()
}
