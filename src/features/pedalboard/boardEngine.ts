// The Pedalboard engine. A chain of stompbox effects sits on the 'keys' channel (the Koog synth AND every emulator), BEFORE the channel cap
// and the host limiter:   channel.input -> [expression + soft tone] -> pedal 1 -> ... -> pedal N -> soft ceiling (|x| <= 1) -> capGain -> master -> limiter
// Each pedal is a dry/wet crossfade (20 ms ramp) so toggling never clicks; reordering mutes for 25 ms while it re-wires.
// The chain is only wired into the channel once something needs it (a pedal on, expression/volume down, soft pedal), so a plain piano takes the straight path.
// State is saved per player (pload/psave 'pedalboard'). Long-lived state is kept on import.meta.hot.data.
import { create } from 'zustand'
import { getCtx, setChannelInsert } from '../../audio/host'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { registerPanicTarget } from '../../music/panic'
import { setOctavePedal } from '../../music/localNotes'
import { getBpm, useMaster } from '../../music/masterClock'
import { bigDown, bigUp } from '../loopstation/loopEngine'
import type { LoopStyle } from '../loopstation/loopCore'
import { PEDALS, PRESETS, ceilingCurve, defaultKnobs, pedalDef, type FxNode } from './effects'
import { swell, usePianoPedals } from './pianoPedals'

export interface BoardState { order: string[]; on: Record<string, boolean>; knobs: Record<string, number[]>; sync: boolean; selected: string; preset: string }
const fresh = (): BoardState => ({ order: PEDALS.map((p) => p.id), on: {}, knobs: Object.fromEntries(PEDALS.map((p) => [p.id, defaultKnobs(p.id)])), sync: false, selected: 'fuzz', preset: 'clean' })
function sane(j: Partial<BoardState> | null): BoardState {
  const f = fresh(); if (!j || typeof j !== 'object') return f
  const ids = new Set(PEDALS.map((p) => p.id))
  const order = Array.isArray(j.order) ? j.order.filter((i): i is string => ids.has(i)) : []
  for (const p of PEDALS) if (!order.includes(p.id)) order.push(p.id)
  const on: Record<string, boolean> = {}, knobs = f.knobs
  for (const p of PEDALS) {
    on[p.id] = !!j.on?.[p.id] && p.kind !== 'looper'
    const k = j.knobs?.[p.id]
    if (Array.isArray(k)) knobs[p.id] = p.knobs.map((kb, i) => (typeof k[i] === 'number' && Number.isFinite(k[i]) ? Math.min(1, Math.max(0, k[i])) : kb.def))
  }
  return { order: [...new Set(order)], on, knobs, sync: !!j.sync, selected: ids.has(j.selected ?? '') ? j.selected! : 'fuzz', preset: typeof j.preset === 'string' ? j.preset : 'clean' }
}
const load = () => sane(pload<Partial<BoardState> | null>('pedalboard', null))

interface Slot { id: string; fx: FxNode; inN: GainNode; dry: GainNode; wetIn: GainNode; out: GainNode }
interface Rig { ctx: BaseAudioContext; pre: GainNode; expr: GainNode; tone: BiquadFilterNode; slots: Map<string, Slot>; ceil: WaveShaperNode; mute: GainNode; tail: GainNode; attached: boolean; wired: string }
interface Hot { store?: ReturnType<typeof make>; rig?: Rig | null; offs?: (() => void)[] }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<BoardState>()(() => load()) }
export const useBoard = hot.store ?? make()
let rig: Rig | null = hot.rig ?? null
let offs: (() => void)[] = hot.offs ?? []
const TC = 0.007 // ~20 ms to settle
const T = (ctx: BaseAudioContext) => ctx.currentTime

function build(): Rig | null {
  try {
    const ctx = getCtx()
    const pre = ctx.createGain(), expr = ctx.createGain(), tone = ctx.createBiquadFilter(), ceil = ctx.createWaveShaper(), mute = ctx.createGain(), tail = ctx.createGain()
    tone.type = 'lowpass'; tone.frequency.value = 20000; tone.Q.value = 0.4
    ceil.curve = ceilingCurve(); ceil.oversample = '2x'
    pre.connect(expr); expr.connect(tone)
    ceil.connect(mute); mute.connect(tail)
    const r: Rig = { ctx, pre, expr, tone, slots: new Map(), ceil, mute, tail, attached: false, wired: '' }
    for (const p of PEDALS) {
      if (p.kind !== 'audio' || !p.make) continue
      const fx = p.make(ctx), inN = ctx.createGain(), dry = ctx.createGain(), wetIn = ctx.createGain(), out = ctx.createGain()
      dry.gain.value = 1; wetIn.gain.value = 0
      inN.connect(dry); dry.connect(out); inN.connect(wetIn); wetIn.connect(fx.input); fx.output.connect(out)
      r.slots.set(p.id, { id: p.id, fx, inN, dry, wetIn, out })
    }
    rewire(r)
    return r
  } catch { return null }
}

/** (re)connect the chain in the current order. Callers mute first when sound is flowing. */
function rewire(r: Rig) {
  const order = useBoard.getState().order.filter((id) => r.slots.has(id))
  const key = order.join(',')
  if (key === r.wired) return
  r.tone.disconnect(); for (const s of r.slots.values()) s.out.disconnect()
  let prev: AudioNode = r.tone
  for (const id of order) { const s = r.slots.get(id)!; prev.connect(s.inN); prev = s.out }
  prev.connect(r.ceil)
  r.wired = key
}

function ensure(): Rig | null {
  let ctx: AudioContext | null = null
  try { ctx = getCtx() } catch { /* no audio */ }
  if (rig && rig.ctx === ctx) return rig
  if (rig) { try { setChannelInsert('keys', null) } catch { /* ok */ } }
  rig = build(); if (rig) applyAll()
  return rig
}
function attach(r: Rig, yes: boolean) {
  if (r.attached === yes) return
  r.attached = yes
  setChannelInsert('keys', yes ? { ctx: r.ctx, input: r.pre, output: r.tail } : null)
}

/** push every knob, switch and piano-pedal value into the audio graph */
function applyAll() {
  const r = rig; if (!r) return
  const s = useBoard.getState(), pp = usePianoPedals.getState(), t = T(r.ctx)
  const bpm = getBpm()
  for (const [id, slot] of r.slots) {
    const on = !!s.on[id]
    slot.dry.gain.setTargetAtTime(on ? 0 : 1, t, TC); slot.wetIn.gain.setTargetAtTime(on ? 1 : 0, t, TC)
    slot.fx.set(s.knobs[id] ?? defaultKnobs(id), { bpm, sync: s.sync })
  }
  r.expr.gain.setTargetAtTime(Math.min(1, swell(pp.expr) * swell(pp.vol)), t, 0.02)
  r.tone.frequency.setTargetAtTime(20000 * Math.pow(2200 / 20000, pp.soft), t, 0.03)
  const oct = s.on.octave ? octShifts(s.knobs.octave?.[0] ?? 0) : null
  setOctavePedal(oct, 0.25 + 0.6 * (s.knobs.octave?.[1] ?? 0.6))
  rewire(r)
  const needed = PEDALS.some((p) => p.kind === 'audio' && s.on[p.id]) || pp.expr < 0.999 || pp.vol < 0.999 || pp.soft > 0.001
  if (needed) attach(r, true)
}
const octShifts = (d: number) => (d < 0.34 ? [-12] : d < 0.67 ? [12] : [-12, 12])
/** a short label for the octave knob position */
export const octLabel = (d: number) => (d < 0.34 ? 'Down' : d < 0.67 ? 'Up' : 'Both')

function persist() {
  const s = useBoard.getState()
  psave('pedalboard', { order: s.order, on: s.on, knobs: s.knobs, sync: s.sync, selected: s.selected, preset: s.preset })
}
let pt: ReturnType<typeof setTimeout> | undefined
const persistSoon = () => { clearTimeout(pt); pt = setTimeout(persist, 250) }

/** Make the audio match the saved state (starts the chain only when a pedal needs it). Safe to call any time. */
export function boardSync() {
  const s = useBoard.getState()
  const need = PEDALS.some((p) => s.on[p.id]) || usePianoPedals.getState().expr < 0.999 || usePianoPedals.getState().vol < 0.999 || usePianoPedals.getState().soft > 0.001
  if (!rig && !need) { setOctavePedal(null); return }
  if (ensure()) applyAll()
}

export function togglePedal(id: string, on?: boolean) {
  const def = pedalDef(id); if (!def || def.kind === 'looper') return
  const s = useBoard.getState(), next = on ?? !s.on[id]
  useBoard.setState({ on: { ...s.on, [id]: next }, selected: id, preset: 'custom' })
  boardSync(); persistSoon()
}
export function setKnob(id: string, i: number, v: number) {
  const s = useBoard.getState(), cur = (s.knobs[id] ?? defaultKnobs(id)).slice()
  cur[i] = Math.min(1, Math.max(0, v))
  useBoard.setState({ knobs: { ...s.knobs, [id]: cur }, preset: 'custom' })
  if (rig) applyAll(); else if (s.on[id]) boardSync()
  persistSoon()
}
export function setSync(on: boolean) { useBoard.setState({ sync: on }); if (rig) applyAll(); persistSoon() }
export function selectPedal(id: string) { if (useBoard.getState().selected !== id) { useBoard.setState({ selected: id }); persistSoon() } }
export function movePedal(id: string, to: number) {
  const o = useBoard.getState().order.slice(), from = o.indexOf(id)
  if (from < 0) return
  const dest = Math.min(o.length - 1, Math.max(0, to))
  if (dest === from) return
  o.splice(from, 1); o.splice(dest, 0, id)
  useBoard.setState({ order: o, preset: 'custom' }); persistSoon()
  const r = rig
  if (!r || !r.attached) { if (r) rewire(r); return }
  // mute for 25 ms while the wires move, so re-ordering never clicks
  const t = T(r.ctx); r.mute.gain.cancelScheduledValues(t); r.mute.gain.setTargetAtTime(0, t, 0.004)
  setTimeout(() => { rewire(r); const t2 = T(r.ctx); r.mute.gain.setTargetAtTime(1, t2, 0.006) }, 28)
}
export function applyPreset(id: string) {
  const p = PRESETS.find((x) => x.id === id); if (!p) return
  const f = fresh(), s = useBoard.getState()
  const on: Record<string, boolean> = {}; for (const k of PEDALS) on[k.id] = p.on.includes(k.id)
  const order = p.order ? [...p.order, ...f.order.filter((i) => !p.order!.includes(i))] : s.order
  useBoard.setState({ on, order, knobs: { ...f.knobs, ...(p.knobs ?? {}) }, sync: !!p.sync, preset: id })
  if (rig) { applyAll() } else boardSync()
  persistSoon()
}

/** The foot pedal / footswitch: stomp the selected pedal. Effects toggle; the Looper stomp taps the looper's big button. */
/** `looperOk` false (the looper is not on screen): a selected Looper stomp does nothing, so a foot tap never records a loop nobody can see */
export function stompSelected(loopStyle: LoopStyle = 'simple', looperOk = true) {
  const id = useBoard.getState().selected
  if (!looperOk && pedalDef(id)?.kind === 'looper') return
  stomp(id, loopStyle)
}
export function stomp(id: string, loopStyle: LoopStyle = 'simple') {
  if (pedalDef(id)?.kind === 'looper') { bigDown(loopStyle); setTimeout(bigUp, 60); useBoard.setState({ selected: id }); return }
  togglePedal(id)
}

/** QA: the wires. */
export function boardDebug() {
  const r = rig
  return { built: !!r, attached: !!r?.attached, wired: r?.wired ?? '', on: Object.keys(useBoard.getState().on).filter((k) => useBoard.getState().on[k]), ctx: r?.ctx as AudioContext | undefined, rig: r }
}

function setup() {
  offs.forEach((f) => f()); offs = []
  offs.push(onProfileChange(() => { useBoard.setState(load()); boardSync() }))
  offs.push(usePianoPedals.subscribe(() => { if (rig || usePianoPedals.getState().soft > 0 || usePianoPedals.getState().expr < 1 || usePianoPedals.getState().vol < 1) boardSync() }))
  offs.push(useMaster.subscribe((s, p) => { if (s.bpm !== p.bpm && rig && useBoard.getState().sync) applyAll() }))
  // panic: every pedal off for a moment is NOT wanted (the kid's setup stays), but tails and notes are cut by the host / engines; just release the octave helper
  offs.push(registerPanicTarget('pedalboard', () => { const r = rig; if (!r) return; r.tail.gain.cancelScheduledValues(T(r.ctx)); r.tail.gain.setTargetAtTime(0, T(r.ctx), 0.01); setTimeout(() => { if (rig === r) r.tail.gain.setTargetAtTime(1, T(r.ctx), 0.03) }, 350) }))
}
setup()
boardSync()

if (import.meta.hot) {
  import.meta.hot.data.store = useBoard
  import.meta.hot.dispose((d) => { d.rig = rig; d.offs = []; offs.forEach((f) => f()); offs = [] })
  import.meta.hot.accept()
}
