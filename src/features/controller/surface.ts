// Controller Mode: the DJ controller as the synth's knob-and-fader surface (role 'surface').
// Hardware (or the on-screen picture) -> surfaceInput(control, value) -> the bound parameter of the playing instrument.
// Continuous controls use SOFT TAKEOVER (a knob does nothing until it crosses the parameter's current value) and a one-pole
// smoother (no zipper noise); jogs are relative; pads and buttons are actions. Layouts are saved per kid and can be re-learned.
// STABLE API: useSurface, surfaceInput, toggleControllerMode, startLearn/cancelLearn, resetLayout, setPickupMode, setScreenMode, surfaceActive().
import { create } from 'zustand'
import { onRoleChange, onSurfaceMessage, sendToDj, setRole, useDevices } from '../../music/devices'
import { onInstrumentChange } from '../../music/instrument'
import { onZonesChange } from '../../music/zones'
import { decode, ledBytes } from '../dj/map'
import { resyncLeds } from '../dj/engine'
import { getSynth, setHold, setOctave, setPitchBend } from '../synth-history/engine'
import { onEmuSet, touchKey } from '../synth-history/emu/bus'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { ALL_CONTROLS, CLASS_OF, compatible, currentTopology, MOOG_PATCH, physName, type Param, type Topology } from './catalog'

export interface Row { phys: string; param: string; label: string; short: string }
interface SurfState {
  screenOn: boolean; roleOn: boolean; on: boolean
  instId: string; instName: string; caption: string; stages: { name: string; hint: string; params: { id: string; short: string; phys: string }[] }[]
  /** control -> short label of what it drives (absent = unbound) */
  labels: Record<string, string>
  /** control -> parameter id */
  bound: Record<string, string>
  rows: Row[]
  /** control -> what to draw: the parameter's current position (jogs: a spinning angle) */
  values: Record<string, number>
  /** control -> where the physical knob really is, while it has not picked the parameter up yet */
  ghost: Record<string, number>
  locked: Record<string, boolean>
  lit: Record<string, boolean>
  touched: Record<string, number>
  last: { phys: string; text: string } | null
  learn: string | null; learnMsg: string
  pickupMode: 'pickup' | 'jump'
  params: { id: string; label: string; kind: string }[]
}
const blank = (): SurfState => ({ screenOn: false, roleOn: false, on: false, instId: 'koog', instName: '', caption: '', stages: [], labels: {}, bound: {}, rows: [], values: {}, ghost: {}, locked: {}, lit: {}, touched: {}, last: null, learn: null, learnMsg: '', pickupMode: 'pickup', params: [] })

interface Hot { store?: ReturnType<typeof make>; off?: () => void; applied?: boolean; ledState?: Record<string, boolean>; jog?: Record<string, number> }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<SurfState>()(() => blank()) }
export const useSurface = hot.store ?? make()
const set = (p: Partial<SurfState>) => useSurface.setState(p)
const get = () => useSurface.getState()
const ledState: Record<string, boolean> = hot.ledState ?? {}
const jogAngle: Record<string, number> = hot.jog ?? {}
const KEY = 'surface.v1'

// ---------- layout (per kid) ----------
type Saved = Record<string, Record<string, string>>
let saved: Saved = pload<Saved>(KEY, {})
let topo: Topology = currentTopology()
const layout = (): Record<string, string> => ({ ...topo.layout, ...(saved[topo.id] ?? {}) })
const paramOf = (id: string | undefined): Param | undefined => (id ? topo.params.find((p) => p.id === id) : undefined)

// ---------- soft takeover + smoothing ----------
const pick: Record<string, { engaged: boolean; last?: number }> = {}
const written = new Map<string, number>()
const glide = new Map<string, { p: Param; tgt: number; cur: number }>()
let timer = 0
const bendState = { v: 0, t: 0 }
function tick() {
  timer = 0
  let more = false
  for (const [id, g] of glide) {
    const d = g.tgt - g.cur
    g.cur = Math.abs(d) < 0.003 ? g.tgt : g.cur + d * 0.4
    g.p.set?.(g.cur); written.set(id, g.p.get?.() ?? g.cur)
    if (g.cur === g.tgt) glide.delete(id); else more = true
  }
  if (bendState.v !== 0 && performance.now() - bendState.t > 90) { // the bend wheel springs back to centre
    bendState.v = Math.abs(bendState.v) < 0.02 ? 0 : bendState.v * 0.78
    paramOf('bend')?.set?.(bendState.v); more = true
  } else if (bendState.v !== 0) more = true
  schedView()
  if (more) timer = window.setTimeout(tick, 16)
}
const kick = () => { if (!timer) timer = window.setTimeout(tick, 16) }

function absolute(phys: string, p: Param, v: number) {
  const st = (pick[phys] ??= { engaged: false })
  const cur = p.get?.() ?? 0
  const wr = written.get(p.id)
  if (st.engaged && wr !== undefined && Math.abs(cur - wr) > 0.06) st.engaged = false // somebody else moved it (the screen, a preset)
  if (!st.engaged && (get().pickupMode === 'jump' || Math.abs(v - cur) <= 0.04 || (st.last !== undefined && (st.last - cur) * (v - cur) <= 0))) st.engaged = true
  st.last = v
  useSurface.setState((s) => ({ ghost: { ...s.ghost, [phys]: v }, locked: { ...s.locked, [phys]: !st.engaged } }))
  if (!st.engaged) return
  if (p.kind === 'pick') { p.set?.(v); written.set(p.id, p.get?.() ?? v); return }
  const g = glide.get(p.id)
  glide.set(p.id, { p, tgt: v, cur: g ? g.cur : cur })
  kick()
}
const jogAcc: Record<string, number> = {}
function relative(phys: string, p: Param, ticks: number) {
  jogAngle[phys] = ((jogAngle[phys] ?? 0) + ticks * 6) % 360
  if (p.kind === 'bend') { bendState.v = Math.max(-1, Math.min(1, bendState.v + ticks * 0.06)); bendState.t = performance.now(); p.set?.(bendState.v); kick(); return }
  if (p.kind === 'pick') {
    jogAcc[phys] = (jogAcc[phys] ?? 0) + ticks
    if (Math.abs(jogAcc[phys]) >= 4) {
      const n = p.steps ?? 2, i = Math.round((p.get?.() ?? 0) * (n - 1)) + Math.sign(jogAcc[phys])
      jogAcc[phys] = 0
      p.set?.(Math.max(0, Math.min(n - 1, i)) / (n - 1)); written.set(p.id, p.get?.() ?? 0)
    }
    return
  }
  const cur = glide.get(p.id)?.tgt ?? p.get?.() ?? 0
  const next = Math.max(0, Math.min(1, cur + ticks * 0.008))
  glide.set(p.id, { p, tgt: next, cur: glide.get(p.id)?.cur ?? cur })
  kick()
}

// ---------- input ----------
/** One control moved (hardware or the picture). Buttons/pads: 1 down, 0 up. Sliders 0..1. Jogs: signed ticks. */
export function surfaceInput(phys: string, value: number) {
  const cls = CLASS_OF[phys]
  if (!cls) return
  const s0 = get()
  if (s0.learn) {
    const p = paramOf(s0.learn)
    const isDown = cls === 'pad' || cls === 'button' ? value > 0 : true
    if (p && isDown) {
      if (!compatible(cls, p.kind)) { set({ learnMsg: `${physName(phys)} can't drive ${p.label}. Try ${p.kind === 'action' ? 'a pad or button' : p.kind === 'bend' ? 'a jog wheel' : 'a knob, fader or jog'}.` }); return }
      assign(phys, p.id)
      return
    }
  }
  const p = paramOf(layout()[phys])
  useSurface.setState((s) => ({ touched: { ...s.touched, [phys]: performance.now() } }))
  if (!p) { schedView(); return }
  if (p.touch) touchKey(p.touch)
  if (cls === 'pad' || cls === 'button') { if (value > 0) { p.press?.(); useSurface.setState((s) => ({ values: { ...s.values, [phys]: 1 } })) } }
  else if (cls === 'jog') relative(phys, p, value)
  else absolute(phys, p, Math.max(0, Math.min(1, value)))
  set({ last: { phys, text: `${p.label}${p.text ? ': ' + p.text() : ''}` } })
  schedView()
}

// ---------- the view model the overlay draws ----------
let viewTimer = 0
function schedView() { if (!viewTimer) viewTimer = window.setTimeout(() => { viewTimer = 0; refreshView() }, 40) }
export function refreshView() {
  const lay = layout()
  const labels: Record<string, string> = {}, bound: Record<string, string> = {}, values: Record<string, number> = {}, lit: Record<string, boolean> = {}
  const rows: Row[] = []
  const prev = get()
  for (const phys of ALL_CONTROLS) {
    const p = paramOf(lay[phys]); if (!p) continue
    const cls = CLASS_OF[phys]
    labels[phys] = p.short; bound[phys] = p.id
    rows.push({ phys, param: p.id, label: p.label, short: p.short })
    if (cls === 'pad' || cls === 'button') { lit[phys] = !!p.lit?.(); values[phys] = lit[phys] ? 1 : 0 }
    else if (cls === 'jog') values[phys] = jogAngle[phys] ?? 0
    else values[phys] = p.get?.() ?? 0
  }
  const stages = topo.stages.map((st) => ({
    name: st.name, hint: st.hint,
    params: st.params.map((id) => ({ id, short: paramOf(id)?.short ?? id, phys: Object.entries(lay).filter(([, v]) => v === id).map(([k]) => physName(k))[0] ?? '' })).filter((x) => x.phys),
  })).filter((st) => st.params.length)
  set({ labels, bound, values, lit, rows, stages, instId: topo.id, instName: topo.name, caption: topo.caption, params: topo.params.map((p) => ({ id: p.id, label: p.label, kind: p.kind })), on: prev.screenOn || prev.roleOn })
  syncLeds(lit)
}

// ---------- LEDs on the hardware (pad of the selected wave / step) ----------
function syncLeds(lit: Record<string, boolean>) {
  if (!get().on) return
  for (const phys of ALL_CONTROLS) {
    if (CLASS_OF[phys] !== 'pad' && CLASS_OF[phys] !== 'button') continue
    const on = !!lit[phys]
    if ((ledState[phys] ?? false) === on) continue
    ledState[phys] = on
    const b = ledBytes(phys, on) // null when the button has no LED (ledOff) or no note
    if (b) sendToDj(b)
  }
}
function ledsDark() {
  for (const phys of Object.keys(ledState)) { if (ledState[phys]) { const b = ledBytes(phys, false); if (b) sendToDj(b) } delete ledState[phys] }
}

// ---------- learn / layout ----------
export function startLearn(paramId: string) {
  const p = paramOf(paramId); if (!p) return
  set({ learn: paramId, learnMsg: `Now move ${p.kind === 'action' ? 'a pad or button' : p.kind === 'bend' ? 'a jog wheel' : 'a knob, fader or jog'} to control ${p.label}.` })
}
export function cancelLearn() { set({ learn: null, learnMsg: '' }) }
/** bind a control to a parameter (replaces what it drove); saved for the active kid */
export function assign(phys: string, paramId: string) {
  const o = { ...(saved[topo.id] ?? {}), [phys]: paramId }
  saved = { ...saved, [topo.id]: o }; psave(KEY, saved)
  delete pick[phys]
  set({ learn: null, learnMsg: `${physName(phys)} now drives ${paramOf(paramId)?.label ?? paramId}.` })
  refreshView()
}
export function unassign(phys: string) {
  saved = { ...saved, [topo.id]: { ...(saved[topo.id] ?? {}), [phys]: '' } }; psave(KEY, saved)
  set({ learnMsg: `${physName(phys)} is free.` }); refreshView()
}
export function resetLayout() {
  const { [topo.id]: _gone, ...rest } = saved; void _gone
  saved = rest; psave(KEY, saved)
  for (const k of Object.keys(pick)) delete pick[k]
  set({ learn: null, learnMsg: 'Back to the default layout.' }); refreshView()
}
export function setPickupMode(m: 'pickup' | 'jump') { for (const k of Object.keys(pick)) delete pick[k]; set({ pickupMode: m }); refreshView() }
export const surfaceActive = () => get().on

// ---------- mode ----------
function enter() {
  topo = currentTopology()
  for (const k of Object.keys(pick)) delete pick[k]
  if (topo.id === 'koog' && !hot.applied) { hot.applied = true; getSynth().setParams(MOOG_PATCH) } // first time: a Moog-flavoured patch (saw, 24 dB filter, a little glide)
  refreshView()
}
function leave() {
  glide.clear(); bendState.v = 0; setPitchBend(0); setHold(false); setOctave(0)
  ledsDark(); cancelLearn()
  resyncLeds() // the decks' own lights come back
  set({ values: {}, lit: {}, ghost: {}, locked: {} })
}
function apply(on: boolean) {
  const was = get().on
  if (on && !was) { set({ on }); enter() }
  else if (!on && was) { set({ on }); leave() }
}
export function setScreenMode(v: boolean) { set({ screenOn: v }); apply(v || get().roleOn) }
function setRoleOn(v: boolean) { set({ roleOn: v }); apply(v || get().screenOn) }
const isController = (r: string) => r === 'dj' || r === 'surface'
/** The 🎧 DJ <-> 🎛️ Synth switch: flips every connected DJ controller between its two roles (no controller: just the on-screen surface) */
export function toggleControllerMode() {
  const devs = useDevices.getState().devices.filter((d) => isController(d.role))
  const target = get().on ? 'dj' : 'surface'
  if (target === 'dj') set({ screenOn: false })
  if (!devs.length) { setScreenMode(target === 'surface'); return }
  for (const d of devs) setRole(d.name, target)
  if (target === 'surface') setRoleOn(true)
}

const retopo = () => { queueMicrotask(() => { const t = currentTopology(); if (t.id !== topo.id) { topo = t; for (const k of Object.keys(pick)) delete pick[k]; glide.clear(); ledsDark(); refreshView() } }) }
function init() {
  hot.off?.()
  const offs = [
    onSurfaceMessage((data) => { const a = decode(data); if (!a || a.fine || a.id === 'jogtouch') return; surfaceInput(a.deck ? `${a.id}.${a.deck}` : a.id, a.value) }),
    onRoleChange((_n, role) => { if (role === 'surface') setRoleOn(true); else if (isController(role) || role === 'off' || role === 'piano') setRoleOn(false) }),
    useDevices.subscribe((st) => { if (st.devices.some((d) => d.connected && d.role === 'surface')) { if (!get().roleOn) setRoleOn(true) } }),
    onInstrumentChange(retopo),
    onZonesChange(retopo), // split/layer: the focused zone's instrument is what the knobs drive
    onEmuSet(() => schedView()),
    getSynth().onParams?.(() => schedView()) ?? (() => {}),
    onProfileChange(() => { saved = pload<Saved>(KEY, {}); for (const k of Object.keys(pick)) delete pick[k]; refreshView() }),
  ]
  hot.off = () => { for (const f of offs) f() }
  if (useDevices.getState().devices.some((d) => d.connected && d.role === 'surface')) setRoleOn(true)
  topo = currentTopology()
  if (get().on) refreshView()
}
init()

if (import.meta.hot) {
  import.meta.hot.data.store = useSurface
  import.meta.hot.data.off = hot.off
  import.meta.hot.data.applied = hot.applied
  import.meta.hot.data.ledState = ledState
  import.meta.hot.data.jog = jogAngle
  import.meta.hot.dispose(() => { if (timer) clearTimeout(timer); if (viewTimer) clearTimeout(viewTimer) })
  import.meta.hot.accept()
}
export type { Topology }
