// Loop Station engine: a MIDI/event looper (NOT an audio looper). It records note events (with held durations), parameter
// automation (Controller Mode knobs on the Koog synth or an emulator) and, optionally, DJ pad hits, all timestamped in BEATS of the
// shared master clock (src/music/masterClock.ts) and replays them through the instrument chosen per layer.
// Replay: a 20 ms tick (the master clock's) schedules everything that falls in the next 90 ms with setTimeout at the exact
// performance.now() target. The instruments take no start time, so this is timer-accurate (~1-2 ms typical), not sample-accurate.
// Instruments per layer: 'koog' (the shared Koog synth), 'sound:<id>' / 'emu:<id>' (a private emulator engine from a refcounted pool,
// created with createEngine and disposed when no layer uses it), or 'follow' (whatever is the active instrument at play time).
// Volume: layers only scale velocity (<= 1.0) and every engine keeps its own cap x outputScale().
// STABLE API for the UI / controller page: useLoop, pressLayer, playAll/stopAll/togglePlay, undo/redo/clearLayer, setLayerVol, ...
import { create } from 'zustand'
import { onNote } from '../../music/notes'
import { getActiveInstrument } from '../../music/instrument'
import { getSynth } from '../synth-history/engine'
import { createEngine, type Engine } from '../synth-history/emu/core'
import { getEmu } from '../synth-history/emu'
import { onEmuSet } from '../synth-history/emu/bus'
import { SOUNDS } from '../devices/soundChoice'
import { dispatch, onPad } from '../dj/engine'
import { beatPos, isRunning, msPerBeat, onBeat, onTick, setBpm, startMaster, stopMaster, timeOfBeat, useMaster } from '../../music/masterClock'
import { outputScale } from '../../music/audioSettings'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { clearScore, setScore } from '../../music/scoreStore'
import { writeMidi, type MidiTrack } from './midiFile'

export interface NoteEv { t: number; d: number; n: number; v: number }
export interface AutoPt { t: number; v: number }
export interface PadEv { t: number; deck: 'A' | 'B'; n: number }
export interface Take { notes: NoteEv[]; auto: Record<string, AutoPt[]>; pads: PadEv[] }
export type LState = 'empty' | 'rec' | 'over' | 'play' | 'stop'
export interface Layer {
  inst: string; vol: number; mute: boolean; solo: boolean; state: LState
  takes: Take[]; redo: Take[]
  /** per-layer params the controller knobs drive: semitones, note-length multiplier, timing nudge in beats */
  transpose: number; gate: number; nudge: number
  playFrom: number
}
export const LAYERS = 8
export const LEN_CHOICES = [1, 2, 4, 8]
export type PadFn = 'rec' | 'mute' | 'solo'
interface LoopState {
  layers: Layer[]; sel: number; running: boolean
  /** loop length in beats (0 = not set yet: the first recording defines it) */
  lenBeats: number; lenBars: number
  countIn: number; quant: number; metro: boolean; recPads: boolean; sheet: boolean
  master: number; xf: number; fn: PadFn; countLeft: number; rev: number
}
const newLayer = (): Layer => ({ inst: 'koog', vol: 1, mute: false, solo: false, state: 'empty', takes: [], redo: [], transpose: 0, gate: 1, nudge: 0, playFrom: 0 })

interface Rec { notes: NoteEv[]; auto: Record<string, AutoPt[]>; pads: PadEv[]; pend: Map<number, { t: number; abs: number; v: number }> }
interface Eng {
  layers: Layer[]; sel: number; running: boolean; loopStart: number; lenBeats: number; sched: number
  rec: Rec | null; recIdx: number; timers: Set<number>; sounding: Map<string, { inst: string; n: number }>
  pool: Map<string, { eng: Engine; spec: string }>; applying: boolean; debug: { on: boolean; log: { layer: number; n: number; expect: number; actual: number }[] }
  ownMaster: boolean; offs: (() => void)[]; click?: AudioContext | null; paramSnap: Record<string, number>
}
interface Hot { store?: ReturnType<typeof make>; E?: Eng }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() {
  return create<LoopState>()(() => ({
    layers: Array.from({ length: LAYERS }, newLayer), sel: 0, running: false, lenBeats: 0, lenBars: 0,
    countIn: 1, quant: 0, metro: false, recPads: false, sheet: false, master: 1, xf: 0.5, fn: 'rec', countLeft: 0, rev: 0,
  }))
}
export const useLoop = hot.store ?? make()
const E: Eng = hot.E ?? {
  layers: Array.from({ length: LAYERS }, newLayer), sel: 0, running: false, loopStart: 0, lenBeats: 0, sched: 0,
  rec: null, recIdx: -1, timers: new Set(), sounding: new Map(), pool: new Map(), applying: false, debug: { on: false, log: [] },
  ownMaster: false, offs: [], click: null, paramSnap: {},
}
const LOOK_MS = 90
const mod = (x: number, n: number) => ((x % n) + n) % n
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const S = () => useLoop.getState()

function commit() {
  useLoop.setState((s) => ({ layers: E.layers.map((l) => ({ ...l })), sel: E.sel, running: E.running, lenBeats: E.lenBeats, rev: s.rev + 1 }))
  gcPool(); publish()
}
export const setOpt = <K extends 'countIn' | 'quant' | 'metro' | 'recPads' | 'sheet' | 'master' | 'xf' | 'fn'>(k: K, v: LoopState[K]) => { useLoop.setState({ [k]: v } as Partial<LoopState>); if (k === 'sheet') publish() }
export const setDebug = (on: boolean) => { E.debug.on = on; if (on) E.debug.log.length = 0 }
export const debugLog = () => E.debug.log

// ---------- instruments ----------
interface Target { on(n: number, v: number): void; off(n: number): void; allOff(): void; set(key: string, val: number): void }
export function currentInstId(): string {
  const i = getActiveInstrument()
  if (!i) return 'koog'
  return i.id.startsWith('sound:') ? i.id : 'emu:' + i.id
}
export function emuIdOf(inst: string): string | null {
  if (inst.startsWith('sound:')) return SOUNDS.find((s) => 'sound:' + s.id === inst)?.emu ?? null
  if (inst.startsWith('emu:')) return inst.slice(4)
  return null
}
export const instLabel = (inst: string): string => {
  if (inst === 'koog') return '🎹 Koog synth'
  if (inst === 'follow') return '↪ Current sound'
  const s = SOUNDS.find((x) => 'sound:' + x.id === inst)
  if (s) return s.icon + ' ' + s.label
  return '🎛️ ' + (getEmu(emuIdOf(inst) ?? '')?.name ?? inst)
}
export const INSTRUMENTS = (): string[] => ['koog', ...SOUNDS.filter((s) => s.emu).map((s) => 'sound:' + s.id), 'follow']
function synthOn(n: number, v: number) { const s = getSynth(); if (s.ready) s.noteOn(n, v); else void s.unlock().then(() => s.noteOn(n, v)) }
const synthTarget: Target = {
  on: synthOn, off: (n) => getSynth().noteOff(n), allOff: () => getSynth().panic(),
  set: (k, v) => { E.applying = true; try { getSynth().setParams({ [k]: v } as never) } finally { E.applying = false } },
}
function poolEngine(inst: string): Engine | null {
  const have = E.pool.get(inst); if (have) return have.eng
  const eid = emuIdOf(inst), spec = eid ? getEmu(eid) : undefined
  if (!spec) return null
  const eng = createEngine(spec)
  const ch = SOUNDS.find((s) => 'sound:' + s.id === inst)
  const p = spec.presets.find((x) => x.name === ch?.preset) ?? spec.presets[0]
  E.applying = true
  try { if (p) for (const c of spec.ctls) eng.set(c.key, p.values[c.key] ?? c.def) } finally { E.applying = false }
  E.pool.set(inst, { eng, spec: spec.id })
  return eng
}
function target(inst: string): Target {
  if (inst === 'follow') {
    const a = getActiveInstrument()
    return a ? { on: (n, v) => a.noteOn(n, v), off: (n) => a.noteOff(n), allOff: () => a.allOff?.(), set: () => {} } : synthTarget
  }
  if (inst === 'koog') return synthTarget
  const e = poolEngine(inst)
  if (!e) return synthTarget
  return { on: (n, v) => e.noteOn(n, v), off: (n) => e.noteOff(n), allOff: () => e.allOff(), set: (k, v) => { E.applying = true; try { e.set(k, v) } finally { E.applying = false } } }
}
function gcPool() {
  const used = new Set(E.layers.filter((l) => l.state !== 'empty').map((l) => l.inst))
  for (const [k, p] of [...E.pool]) if (!used.has(k)) { try { p.eng.allOff(); p.eng.dispose() } catch { /* ignore */ } E.pool.delete(k) }
}
/** wake the audio of every instrument the layers use (call from a click / pad press) */
export function unlockLoopAudio() { for (const l of E.layers) if (l.state !== 'empty') { const e = l.inst === 'koog' || l.inst === 'follow' ? null : poolEngine(l.inst); void e?.unlock().catch(() => {}) } }

// ---------- transport ----------
const loopLen = () => E.lenBeats
/** position inside the loop in beats, or null while stopped / counting in; countIn=true while the count-in runs */
export function loopPos(): { pos: number; counting: boolean; bar: number } | null {
  if (!E.running) return null
  const p = beatPos() - E.loopStart
  if (p < 0) return { pos: 0, counting: true, bar: Math.ceil(-p / 4) }
  return { pos: E.lenBeats > 0 ? mod(p, E.lenBeats) : p, counting: false, bar: Math.floor(p / 4) }
}
function ensureTransport(countBars: number) {
  if (E.running) return
  const fresh = !isRunning()
  if (fresh) { startMaster(); E.ownMaster = true }
  // a freshly started master has its beat 0 right now; otherwise wait for the next bar line
  E.loopStart = (fresh ? 0 : Math.ceil((beatPos() + 0.02) / 4) * 4) + countBars * 4
  E.sched = beatPos()
  E.running = true
  useLoop.setState({ countLeft: countBars })
}
function allQuiet() {
  for (const t of E.timers) clearTimeout(t)
  E.timers.clear()
  const seen = new Set<string>()
  for (const l of E.layers) { if (seen.has(l.inst)) continue; seen.add(l.inst); try { target(l.inst).allOff() } catch { /* ignore */ } }
  E.sounding.clear()
}
export function stopAll() {
  closeRec(true)
  allQuiet()
  for (const l of E.layers) if (l.state === 'play' || l.state === 'over' || l.state === 'rec') l.state = l.takes.length ? 'stop' : 'empty'
  E.running = false
  if (E.ownMaster && !useMaster.getState().following) { stopMaster(); E.ownMaster = false }
  commit()
}
export function playAll() {
  if (!E.layers.some((l) => l.takes.length) || E.lenBeats <= 0) return
  closeRec(true)
  ensureTransport(0)
  for (const l of E.layers) if (l.takes.length && l.state !== 'play') { l.state = 'play'; l.playFrom = E.loopStart }
  commit()
}
export function togglePlay() { if (E.running && E.layers.some((l) => l.state === 'play' || l.state === 'over' || l.state === 'rec')) stopAll(); else playAll() }

// ---------- recording ----------
const defining = () => E.lenBeats <= 0
function startRec(i: number, over: boolean) {
  closeRec(true)
  E.rec = { notes: [], auto: {}, pads: [], pend: new Map() }
  E.recIdx = i
  E.layers[i].state = over ? 'over' : 'rec'
  E.paramSnap = {}
  const p = getSynth().params as unknown as Record<string, number | string>
  for (const k of Object.keys(p)) if (typeof p[k] === 'number') E.paramSnap[k] = p[k] as number
}
/** finish the take in progress. quiet=true keeps the layer state as it is. */
function closeRec(quiet: boolean) {
  const r = E.rec, i = E.recIdx
  if (!r || i < 0) return
  const now = performance.now()
  for (const [n, p] of r.pend) { r.notes.push({ t: p.t, d: Math.max(0.1, beatPos(now) - p.abs), n, v: p.v }) }
  r.pend.clear()
  const L = E.layers[i]
  if (defining()) {
    const el = beatPos(now) - E.loopStart
    if (el < 0.05 && !r.notes.length) { E.rec = null; E.recIdx = -1; L.state = 'empty'; abortTransportIfIdle(); if (!quiet) commit(); return }
    const bars = Math.max(1, el / 4)
    const bl = LEN_CHOICES.find((c) => c >= bars - 0.35) ?? 8
    E.lenBeats = bl * 4; useLoop.setState({ lenBars: bl })
  }
  const len = E.lenBeats
  const notes = r.notes.filter((n) => n.t < len).map((n) => ({ ...n, d: Math.min(n.d, len) }))
  const take: Take = { notes, auto: r.auto, pads: r.pads.filter((p) => p.t < len) }
  const has = notes.length || Object.keys(take.auto).length || take.pads.length
  if (has) { L.takes.push(take); L.redo = [] }
  L.state = L.takes.length ? 'play' : 'empty'
  L.playFrom = beatPos(now)
  E.rec = null; E.recIdx = -1
  if (!L.takes.length) abortTransportIfIdle()
}
function abortTransportIfIdle() {
  if (E.layers.some((l) => l.state !== 'empty')) return
  E.running = false; E.lenBeats = S().lenBars * 4
  if (E.ownMaster) { stopMaster(); E.ownMaster = false }
}
function quantise(pos: number): number {
  const g = S().quant
  if (!g) return pos
  let q = Math.round(pos / g) * g
  if (E.lenBeats > 0 && q >= E.lenBeats) q -= E.lenBeats
  return q
}
function recPos(abs: number): number | null {
  const p = abs - E.loopStart
  if (p < 0) return null
  return E.lenBeats > 0 ? mod(p, E.lenBeats) : p
}
function onPlayed(e: { note: number; on: boolean; velocity: number }) {
  const r = E.rec; if (!r || !E.running) return
  const now = performance.now(), abs = beatPos(now)
  if (e.on) {
    const pos = recPos(abs); if (pos == null) return
    const old = r.pend.get(e.note)
    if (old) r.notes.push({ t: old.t, d: Math.max(0.1, abs - old.abs), n: e.note, v: old.v })
    r.pend.set(e.note, { t: quantise(pos), abs, v: e.velocity || 90 })
  } else {
    const p = r.pend.get(e.note); if (!p) return
    r.pend.delete(e.note)
    r.notes.push({ t: p.t, d: Math.max(0.1, abs - p.abs), n: e.note, v: p.v })
  }
}
function autoPoint(lane: string, val: number) {
  const r = E.rec; if (!r || !E.running || E.applying) return
  const pos = recPos(beatPos()); if (pos == null) return
  const pts = (r.auto[lane] ??= [])
  const last = pts[pts.length - 1]
  if (last && last.v === val) return
  if (last && pos - last.t < 0.03 && pos >= last.t) { last.v = val; return }
  pts.push({ t: pos, v: val })
}
function onEmuParam(e: Engine, key: string, val: number) {
  if (!E.rec || E.applying) return
  for (const p of E.pool.values()) if (p.eng === e) return
  const L = E.layers[E.recIdx]
  if (L && emuIdOf(L.inst) === e.spec.id) autoPoint('e:' + key, val)
}
function onSynthParams(p: unknown) {
  if (!E.rec || E.applying) return
  const L = E.layers[E.recIdx]; if (!L || L.inst !== 'koog') return
  const q = p as Record<string, unknown>
  for (const k of Object.keys(q)) {
    const v = q[k]
    if (typeof v !== 'number') continue
    if (E.paramSnap[k] !== v) { E.paramSnap[k] = v; autoPoint('k:' + k, v) }
  }
}

// ---------- the layer pad cycle ----------
export function select(i: number) { E.sel = clamp(i, 0, LAYERS - 1); commit() }
/** the classic cycle: empty -> record -> play -> overdub -> play ; a stopped layer starts again */
export function pressLayer(i: number) {
  i = clamp(i, 0, LAYERS - 1); E.sel = i
  const L = E.layers[i]
  unlockLoopAudio()
  switch (L.state) {
    case 'empty':
      L.inst = currentInstId()
      ensureTransport(S().countIn)
      if (E.lenBeats <= 0 && S().lenBars > 0) E.lenBeats = S().lenBars * 4
      for (const o of E.layers) if (o.state === 'stop') { o.state = 'play'; o.playFrom = E.loopStart }
      startRec(i, false)
      break
    case 'rec': closeRec(false); break
    case 'play': if (!E.running) { playAll(); return } startRec(i, true); break
    case 'over': closeRec(false); break
    case 'stop': if (E.running) { L.state = 'play'; L.playFrom = beatPos() } else playAll(); break
  }
  commit()
}
export function toggleMute(i: number) { E.layers[i].mute = !E.layers[i].mute; if (E.layers[i].mute) quietLayer(i); commit() }
export function toggleSolo(i: number) { E.layers[i].solo = !E.layers[i].solo; for (let k = 0; k < LAYERS; k++) if (!audible(k)) quietLayer(k); commit() }
export function padAction(i: number) {
  const fn = S().fn
  if (fn === 'mute') toggleMute(i); else if (fn === 'solo') toggleSolo(i); else pressLayer(i)
}
function quietLayer(i: number) {
  const L = E.layers[i]
  for (const [k, s] of [...E.sounding]) if (k.startsWith(i + ':')) { try { target(s.inst).off(s.n) } catch { /* ignore */ } E.sounding.delete(k) }
  void L
}
export function clearLayer(i: number) {
  if (E.recIdx === i) { E.rec = null; E.recIdx = -1 }
  quietLayer(i)
  const keep = E.layers[i]
  E.layers[i] = { ...newLayer(), inst: keep.inst, vol: keep.vol }
  E.layers[i].state = 'empty'
  if (!E.layers.some((l) => l.state !== 'empty')) { allQuiet(); abortTransportIfIdle() }
  commit()
}
export function clearAll() { for (let i = 0; i < LAYERS; i++) E.layers[i] = newLayer(); E.rec = null; E.recIdx = -1; allQuiet(); abortTransportIfIdle(); E.lenBeats = S().lenBars * 4; commit() }
export function undo(i = E.sel) {
  const L = E.layers[i]
  if ((L.state === 'rec' || L.state === 'over') && E.recIdx === i) { // discard the take in progress
    const was = L.state; E.rec = null; E.recIdx = -1
    L.state = was === 'over' ? 'play' : 'empty'
    if (L.state === 'empty') abortTransportIfIdle()
    commit(); return
  }
  const t = L.takes.pop(); if (!t) return
  L.redo.push(t); quietLayer(i)
  if (!L.takes.length) { L.state = 'empty'; if (!E.layers.some((l) => l.state !== 'empty')) { allQuiet(); abortTransportIfIdle() } }
  commit()
}
export function redo(i = E.sel) {
  const L = E.layers[i], t = L.redo.pop(); if (!t) return
  L.takes.push(t)
  if (L.state === 'empty') { L.state = E.running ? 'play' : 'stop'; L.playFrom = beatPos() }
  commit()
}
export function setLayerVol(i: number, v: number) { E.layers[i].vol = clamp(v, 0, 1); useLoop.setState((s) => ({ layers: E.layers.map((l) => ({ ...l })), rev: s.rev + 1 })) }
export function setLayerParam(i: number, k: 'transpose' | 'gate' | 'nudge', v: number) {
  const L = E.layers[i]
  if (k === 'transpose') L.transpose = clamp(Math.round(v), -24, 24)
  else if (k === 'gate') L.gate = clamp(v, 0.2, 2)
  else L.nudge = clamp(v, -1, 1)
  commit()
}
export function setLayerInst(i: number, inst: string) { quietLayer(i); E.layers[i].inst = inst; commit() }
export function setLenBars(n: number) {
  useLoop.setState({ lenBars: n })
  if (n > 0 && (E.layers.some((l) => l.takes.length) || E.running)) E.lenBeats = n * 4
  else if (n > 0 && !E.running) E.lenBeats = 0
  commit()
}
export const getSel = () => E.sel
export const getLenBeats = () => E.lenBeats
export const getLoopStart = () => E.loopStart

// ---------- playback scheduler ----------
const soloActive = () => E.layers.some((l) => l.solo)
const audible = (i: number) => { const l = E.layers[i]; return !l.mute && (!soloActive() || l.solo) }
function gainOf(i: number): number {
  const s = S(), xf = i < 4 ? Math.min(1, 2 * (1 - s.xf)) : Math.min(1, 2 * s.xf)
  return E.layers[i].vol * s.master * xf
}
function later(fn: () => void, ms: number) {
  const h = window.setTimeout(() => { E.timers.delete(h); fn() }, Math.max(0, ms))
  E.timers.add(h)
}
function schedule(now: number) {
  if (!E.running || E.lenBeats <= 0) return
  const to = beatPos(now + LOOK_MS), from = Math.max(E.sched, beatPos(now))
  if (to <= from) return
  const len = E.lenBeats, mspb = msPerBeat()
  for (let i = 0; i < LAYERS; i++) {
    const L = E.layers[i]
    if (L.state !== 'play' && L.state !== 'over') continue
    if (!audible(i)) continue
    const g = gainOf(i)
    const each = (t: number, fn: (abs: number) => void) => {
      const tt = mod(t + L.nudge, len)
      for (let k = Math.ceil((from - E.loopStart - tt) / len); ; k++) {
        const abs = E.loopStart + k * len + tt
        if (abs >= to) break
        if (abs >= from && abs >= L.playFrom - 1e-6) fn(abs)
      }
    }
    for (const take of L.takes) {
      for (const ev of take.notes) each(ev.t, (abs) => {
        const at = timeOfBeat(abs), note = clamp(ev.n + L.transpose, 0, 127), vel = Math.round(clamp(ev.v * g, 0, 127))
        if (vel < 1) return
        later(() => {
          if (E.debug.on && E.debug.log.length < 800) E.debug.log.push({ layer: i, n: note, expect: at, actual: performance.now() })
          const key = i + ':' + note, tg = target(L.inst)
          if (E.sounding.has(key)) tg.off(note)
          tg.on(note, vel); E.sounding.set(key, { inst: L.inst, n: note })
          later(() => { if (E.sounding.get(key)) { tg.off(note); E.sounding.delete(key) } }, Math.max(30, ev.d * L.gate * mspb))
        }, at - now)
      })
      for (const [lane, pts] of Object.entries(take.auto)) for (const pt of pts) each(pt.t, (abs) => {
        later(() => target(L.inst).set(lane.slice(2), pt.v), timeOfBeat(abs) - now)
      })
      if (S().recPads) for (const p of take.pads) each(p.t, (abs) => {
        later(() => { E.applying = true; try { dispatch({ id: ('pad' + (p.n + 1)) as 'pad1', deck: p.deck, value: 1 }); later(() => dispatch({ id: ('pad' + (p.n + 1)) as 'pad1', deck: p.deck, value: 0 }), 60) } finally { E.applying = false } }, timeOfBeat(abs) - now)
      })
    }
  }
  E.sched = to
}

// ---------- click (count-in / metronome) ----------
function clickAt(accent: boolean) {
  try {
    if (!E.click) { const AC = window.AudioContext; E.click = new AC({ latencyHint: 'interactive' }) }
    const c = E.click, t = c.currentTime
    if (c.state !== 'running') void c.resume().catch(() => {})
    const o = c.createOscillator(), g = c.createGain()
    o.frequency.value = accent ? 1500 : 1000
    const peak = 0.06 * outputScale()
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.06)
  } catch { /* no audio yet */ }
}
function onClockBeat(b: { n: number; beat: number }) {
  if (!E.running) return
  const counting = b.n < E.loopStart
  if (counting) useLoop.setState({ countLeft: Math.max(0, Math.ceil((E.loopStart - b.n) / 4)) })
  else if (S().countLeft) useLoop.setState({ countLeft: 0 })
  if (counting || S().metro) clickAt(b.beat === 0)
}

// ---------- sheet music (optional) ----------
let lastScoreKey = ''
function publish() {
  const s = S(), L = E.layers[E.sel]
  if (!s.sheet || !E.running || !L || !L.takes.length) { if (lastScoreKey) { clearScore('loop'); lastScoreKey = '' } return }
  const evs = L.takes.flatMap((t) => t.notes).map((n) => ({ ...n, t: mod(n.t + L.nudge, E.lenBeats), n: n.n + L.transpose })).sort((a, b) => a.t - b.t)
  const notes: { note: number | null; beats: number }[] = []
  let cur = 0
  for (let k = 0; k < evs.length; k++) {
    const e = evs[k]
    if (e.t < cur - 1e-6) continue
    if (e.t > cur + 1e-6) notes.push({ note: null, beats: e.t - cur })
    const next = evs.slice(k + 1).find((x) => x.t > e.t + 1e-6)
    const b = Math.max(0.25, Math.min(e.d, (next ? next.t : E.lenBeats) - e.t))
    notes.push({ note: e.n, beats: b }); cur = e.t + b
  }
  const key = JSON.stringify([E.sel, notes, useMaster.getState().bpm])
  if (key === lastScoreKey) return
  lastScoreKey = key
  setScore({ owner: 'loop', title: 'Loop layer ' + (E.sel + 1), notes, bpm: useMaster.getState().bpm, beatsPerBar: 4 })
}

// ---------- export / sessions ----------
const GM: Record<string, number> = { koog: 81, 'sound:organ': 19, 'sound:moog': 80, 'sound:epiano': 4, 'sound:bell': 14, 'sound:strings': 48, 'sound:choir': 52, 'sound:pad': 89, 'sound:brass': 61,
  'emu:hammond': 16, 'emu:mellotron': 48, 'emu:juno': 89, 'emu:prophet': 90, 'emu:dx': 4, 'emu:moog': 80, 'emu:arp': 81, 'emu:theremin': 54, 'emu:ondes': 19, 'emu:tb303': 38 }
/** the loop as a Standard MIDI File (format 1): tempo track + one track per non-empty layer (+ DJ pads on channel 10) */
export function exportMidi(passes = 1): Uint8Array {
  const len = E.lenBeats || 4
  const tracks: MidiTrack[] = []
  E.layers.forEach((L, i) => {
    const notes = L.takes.flatMap((t) => t.notes).map((n) => ({ t: mod(n.t + L.nudge, len), d: Math.max(0.05, n.d * L.gate), n: clamp(n.n + L.transpose, 0, 127), v: Math.round(clamp(n.v * L.vol * S().master, 1, 127)) }))
    if (notes.length) tracks.push({ name: `Layer ${i + 1} ${instLabel(L.inst).replace(/[^\x20-\x7e]/g, '').trim()}`, channel: i % 8, program: GM[L.inst] ?? 80, notes })
  })
  const pads = E.layers.flatMap((L) => L.takes.flatMap((t) => t.pads)).map((p) => ({ t: p.t, d: 0.1, n: 36 + (p.deck === 'B' ? 4 : 0) + p.n, v: 100 }))
  if (pads.length) tracks.push({ name: 'DJ pads', channel: 9, notes: pads })
  return writeMidi(tracks, useMaster.getState().bpm, len, passes)
}
export function downloadMidi(passes = 1) {
  const blob = new Blob([exportMidi(passes) as BlobPart], { type: 'audio/midi' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'koog-loop.mid'
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
interface Saved { name: string; at: number; bpm: number; lenBars: number; lenBeats: number; layers: Pick<Layer, 'inst' | 'vol' | 'mute' | 'solo' | 'takes' | 'transpose' | 'gate' | 'nudge'>[]; countIn: number; quant: number }
const SKEY = 'loop.sessions.v1'
export const listSessions = (): Record<string, Saved> => pload<Record<string, Saved>>(SKEY, {})
export function saveSession(slot: string, name = 'Loop ' + slot) {
  const all = listSessions()
  all[slot] = { name, at: Date.now(), bpm: useMaster.getState().bpm, lenBars: S().lenBars, lenBeats: E.lenBeats, countIn: S().countIn, quant: S().quant,
    layers: E.layers.map((l) => ({ inst: l.inst, vol: l.vol, mute: l.mute, solo: l.solo, takes: l.takes, transpose: l.transpose, gate: l.gate, nudge: l.nudge })) }
  psave(SKEY, all)
}
export function loadSession(slot: string): boolean {
  const d = listSessions()[slot]; if (!d) return false
  stopAll()
  E.layers = Array.from({ length: LAYERS }, (_, i) => {
    const s = d.layers[i]
    return s ? { ...newLayer(), ...s, redo: [], state: s.takes.length ? 'stop' : 'empty' } as Layer : newLayer()
  })
  E.lenBeats = d.lenBeats; E.sel = 0
  useLoop.setState({ lenBars: d.lenBars, countIn: d.countIn, quant: d.quant })
  setBpm(d.bpm); commit()
  return true
}

// ---------- wiring ----------
function init() {
  for (const f of E.offs) f()
  E.offs = [
    onNote((e) => onPlayed(e)),
    onEmuSet(onEmuParam),
    getSynth().onParams?.(onSynthParams) ?? (() => {}),
    onPad((p) => { if (E.rec && !E.applying && S().recPads && E.running) { const pos = recPos(beatPos()); if (pos != null) E.rec.pads.push({ t: pos, deck: p.deck, n: p.n }) } }),
    onTick((now) => schedule(now)),
    onBeat((b) => onClockBeat(b)),
    onProfileChange(() => { stopAll(); E.layers = Array.from({ length: LAYERS }, newLayer); E.lenBeats = 0; E.sel = 0; commit() }),
  ]
}
init()

if (import.meta.hot) {
  import.meta.hot.data.store = useLoop
  import.meta.hot.data.E = E
  import.meta.hot.dispose(() => { for (const f of E.offs) f(); E.offs = []; for (const t of E.timers) clearTimeout(t); E.timers.clear(); try { void E.click?.close() } catch { /* ignore */ } E.click = null })
  import.meta.hot.accept()
}
