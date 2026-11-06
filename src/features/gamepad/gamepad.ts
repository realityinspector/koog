// A wireless game controller plays the 8 notes of the current key.
// The computer pairs it (System Settings on a Mac). This page cannot start Bluetooth.
// After a button press, Chrome exposes the pad through the Gamepad API. The event's
// gamepad object is a snapshot, so the live buttons are read from navigator.getGamepads()
// inside a frame loop. The loop runs only while a pad is connected.
// Notes go through playLocal, the same path as the computer keyboard. This is not a MIDI port.
// A press is not a user-activation gesture, so the first notes may be silent until the page
// has been clicked. They still reach the note feed. L2/R2 only change velocity: the sustain
// pedal is the foot pedal's job, and this pad never calls setSustain.

import { create } from 'zustand'
import { useAppStore } from '../../store/appStore'
import { playLocal, unlockAudio } from '../../music/localNotes'
import { useHarmonyStore } from '../../music/harmonyStore'
import { registerPanicTarget } from '../../music/panic'
import { pressStart } from '../padplay/padplay'
import { scaleNotes } from '../padplay/padCore'
import { freshMem, isPlayPad, padLabel, stepPad, type BtnLike, type Mem } from './padMap'

export interface WirelessPad { index: number; name: string; oct: number }
interface WirelessState { pads: WirelessPad[]; /** a controller is connected, and it is not one Koog can play */ other: boolean }
interface Inject { id: string; buttons: BtnLike[] }
interface Hot {
  mems: Map<number, Mem>
  names: Map<number, string>
  injected: Map<number, Inject>
  looping: boolean
  raf: number
  bound: boolean
  starts: number
  asked: boolean
  store?: ReturnType<typeof makeStore>
  tick?: () => void
  onConnect?: (e: GamepadEvent) => void
  onDisconnect?: (e: GamepadEvent) => void
  onSilence?: () => void
  onPoke?: () => void
}

const hot = import.meta.hot
const keep: Hot = (hot?.data.gp as Hot | undefined) ?? {
  mems: new Map(), names: new Map(), injected: new Map(),
  looping: false, raf: 0, bound: false, starts: 0, asked: false,
}
keep.mems ??= new Map()
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

function drop(index: number) {
  const mem = keep.mems.get(index)
  if (!mem) return
  const notes = notesOf(mem)
  keep.mems.delete(index)
  keep.names.delete(index)
  for (const n of notes) playLocal(n, 0, false)
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
        apply(g.index, g.id, g.buttons)
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
  for (const [index, mem] of keep.mems) {
    for (const n of notesOf(mem)) playLocal(n, 0, false)
    const down = mem.down.slice()
    try {
      const g = navigator.getGamepads?.()?.[index]
      if (g) {
        for (let i = 0; i < down.length; i++) {
          const b = g.buttons[i]
          down[i] = !!(b && (b.pressed || b.value >= 0.5))
        }
      }
    } catch { /* keep the flags from the last poll */ }
    keep.mems.set(index, { down, held: new Map(), oct: mem.oct })
  }
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
registerPanicTarget('wireless', () => keep.onSilence?.())
if (scan()) ensureLoop()

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __koogGamepad?: typeof injectWireless }).__koogGamepad = injectWireless
}

if (hot) {
  hot.data.gp = keep
  hot.accept()
}
