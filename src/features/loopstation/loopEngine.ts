// Loop Station engine: a MIDI/event looper (NOT an audio looper), played like a loop pedal.
// It records note events (with held durations), parameter automation (Controller Mode knobs on the Koog synth or an emulator) and,
// optionally, DJ pad hits, all timestamped in BEATS of the shared master clock (src/music/masterClock.ts), and replays them through
// the instrument chosen per track.
//
// ONE BUTTON per track (buttonDown / buttonUp, used by the screen and the Mixtrack pads):
//   1st press REC -> 2nd press PLAY (or DUB: setting recNext) -> next presses toggle DUB / PLAY
//   double-tap = STOP    hold 2 s = UNDO (hold again = REDO)    hold while stopped = CLEAR
// LOOP SYNC: every track is locked to the first track's length (or a x1/x2/x4/x8 multiple of it). MEASURE: starts/stops of
// REC / DUB / PLAY wait for the next bar line (the ring blinks "waiting"). Per track: one-shot, reverse, half/double speed,
// start/stop mode (now / end of loop / fade), FX (filter sweep, stutter roll, transpose).
//
// Replay: the master clock's 20 ms tick schedules everything in the next 90 ms with setTimeout at the exact performance.now() target.
// The instruments take no start time, so this is timer-accurate (about 1-2 ms), not sample-accurate.
// Instruments per track: 'koog' (the shared Koog synth), 'sound:<id>' / 'emu:<id>' (a private emulator engine from a refcounted pool,
// created with createEngine, unlocked when the track is armed, disposed when no track uses it) or 'follow'.
// Volume: tracks only scale velocity (<= 1.0); every engine keeps its own cap x outputScale().
// Replayed notes do NOT go through playLocal, so they do not feed the judge, the visuals or the on-screen keys (fine in Boss mode).
import { create } from 'zustand'
import { onNote } from '../../music/notes'
import { getActiveInstrument } from '../../music/instrument'
import { getSynth } from '../synth-history/engine'
import { createEngine, type Engine } from '../synth-history/emu/core'
import { getEmu } from '../synth-history/emu'
import { liveEngines, onEmuSet } from '../synth-history/emu/bus'
import { SOUNDS } from '../devices/soundChoice'
import { dispatch, onPad } from '../dj/engine'
import { beatPos, getBpm, isRunning, msPerBeat, onBeat, onTick, resetPhase, setBpm, startMaster, stopMaster, timeOfBeat, useMaster } from '../../music/masterClock'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { clearScore, setScore } from '../../music/scoreStore'
import { writeMidi, type MidiTrack } from './midiFile'
import { playClick, unlockGuide, useGuide, guidePeak } from './guide'

export interface NoteEv { t: number; d: number; n: number; v: number }
export interface AutoPt { t: number; v: number }
export interface PadEv { t: number; deck: 'A' | 'B'; n: number }
export interface Take { notes: NoteEv[]; auto: Record<string, AutoPt[]>; pads: PadEv[] }
export type LState = 'empty' | 'rec' | 'over' | 'play' | 'stop'
export type Pend = { to: 'rec' | 'over' | 'play' | 'stop'; at: number } | null
export interface Layer {
  inst: string; vol: number; mute: boolean; solo: boolean; state: LState
  takes: Take[]; redo: Take[]
  /** knob params: semitones, note-length multiplier, timing nudge in beats */
  transpose: number; gate: number; nudge: number
  /** per-track pedal options */
  oneShot: boolean; reverse: boolean; speed: 0.5 | 1 | 2
  startMode: 'now' | 'end'; stopMode: 'now' | 'end' | 'fade'
  /** length as a multiple of the first track's loop (LOOP SYNC) */
  mult: 1 | 2 | 4 | 8
  /** FX: filter sweep amount 0..1 (0 off), stutter 0 off / 1 = 1/8 roll / 2 = 1/16 roll */
  fxFilter: number; fxStutter: 0 | 1 | 2
  /** a REC / DUB / PLAY / STOP that waits for the bar line (measure) or the end of the loop */
  pend: Pend
  playFrom: number; origin: number
  /** LOOP SYNC off: this track keeps its own start and length */
  free: boolean; ownStart: number; ownLen: number
  fade: { from: number; to: number } | null
  lastHold: 'undo' | 'redo' | null
  /** the person picked this sound on purpose (otherwise an empty track takes the current sound when it starts recording) */
  picked: boolean
  /** scheduled up to here (beats): each track keeps its own pointer so a track that starts mid-window loses no notes */
  sched: number
  /** emulator knob settings captured when the track was armed */
  patch?: Record<string, number>
}
export const LAYERS = 8
export const LEN_CHOICES = [1, 2, 4, 8]
interface LoopState {
  layers: Layer[]; sel: number; running: boolean
  /** loop length in beats (0 = not set yet: the first recording defines it) */
  lenBeats: number; lenBars: number
  countIn: number; quant: number; recPads: boolean; sheet: boolean
  /** REC -> PLAY or REC -> DUB on the second press */
  recNext: 'play' | 'dub'
  /** LOOP SYNC: tracks lock to the first track's length */
  sync: boolean
  /** MEASURE: REC / DUB / PLAY / STOP wait for the next bar line */
  measure: boolean
  master: number; xf: number; countLeft: number; rev: number
}
const newLayer = (): Layer => ({
  inst: 'auto', vol: 1, mute: false, solo: false, state: 'empty', takes: [], redo: [], transpose: 0, gate: 1, nudge: 0,
  oneShot: false, reverse: false, speed: 1, startMode: 'now', stopMode: 'now', mult: 1, fxFilter: 0, fxStutter: 0,
  pend: null, playFrom: 0, origin: 0, picked: false, sched: 0, free: false, ownStart: 0, ownLen: 0, fade: null, lastHold: null,
})

interface Rec { notes: NoteEv[]; auto: Record<string, AutoPt[]>; pads: PadEv[]; pend: Map<number, { t: number; abs: number; v: number }> }
interface Eng {
  layers: Layer[]; sel: number; running: boolean; loopStart: number; lenBeats: number; sched: number
  rec: Rec | null; recIdx: number; timers: Set<number>; sounding: Map<string, { inst: string; n: number; id: number }>
  pool: Map<string, { eng: Engine; spec: string }>; applying: boolean; debug: { on: boolean; log: { layer: number; n: number; expect: number; actual: number }[] }
  ownMaster: boolean; offs: (() => void)[]; paramSnap: Record<string, number>
  down: Record<number, { t: number; timer: number; fired: boolean; prev: LState; dbl: boolean }>
  lastDown: Record<number, number>; sid: number
}
interface Hot { store?: ReturnType<typeof make>; E?: Eng }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() {
  return create<LoopState>()(() => ({
    layers: Array.from({ length: LAYERS }, newLayer), sel: 0, running: false, lenBeats: 0, lenBars: 0,
    countIn: 1, quant: 0, recPads: false, sheet: false, recNext: 'play', sync: true, measure: false, master: 1, xf: 0.5, countLeft: 0, rev: 0,
  }))
}
export const useLoop = hot.store ?? make()
const E: Eng = hot.E ?? {
  layers: Array.from({ length: LAYERS }, newLayer), sel: 0, running: false, loopStart: 0, lenBeats: 0, sched: 0,
  rec: null, recIdx: -1, timers: new Set(), sounding: new Map(), pool: new Map(), applying: false, debug: { on: false, log: [] },
  ownMaster: false, offs: [], paramSnap: {}, down: {}, lastDown: {}, sid: 0,
}
// fields added after the first release (an HMR session keeps the old E object)
E.down ??= {}; E.lastDown ??= {}; E.sid ??= 0
E.layers = E.layers.map((l) => ({ ...newLayer(), ...l }))
{ const st = useLoop.getState() as unknown as Record<string, unknown>; if (st.sync === undefined) useLoop.setState({ recNext: 'play', sync: true, measure: false }) }
const LOOK_MS = 90, HOLD_MS = 2000, DOUBLE_MS = 340, PRE_ROLL = 0.15
const mod = (x: number, n: number) => ((x % n) + n) % n
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const S = () => useLoop.getState()

function commit() {
  useLoop.setState((s) => ({ layers: E.layers.map((l) => ({ ...l })), sel: E.sel, running: E.running, lenBeats: E.lenBeats, rev: s.rev + 1 }))
  gcPool(); publish()
}
type OptKey = 'countIn' | 'quant' | 'recPads' | 'sheet' | 'master' | 'xf' | 'recNext' | 'sync' | 'measure'
export const setOpt = <K extends OptKey>(k: K, v: LoopState[K]) => { useLoop.setState({ [k]: v } as Partial<LoopState>); if (k === 'sheet') publish() }
export const setDebug = (on: boolean) => { E.debug.on = on; if (on) E.debug.log.length = 0 }
export const debugLog = () => E.debug.log

// ---------- mixer hooks (Boss mixer finds these by name) ----------
export const getLoopLevel = () => S().master
export const setLoopLevel = (v: number) => setOpt('master', clamp(v, 0, 1))
/** how loud the loop tracks are right now (private emulator engines + the guide) */
export function loopPeak(): number {
  let m = guidePeak()
  for (const p of E.pool.values()) m = Math.max(m, p.eng.peak())
  return m
}

/** loudness of each private emulator engine by instrument id (proof that emulator tracks are audible) */
export function loopPeaks(): Record<string, number> { const o: Record<string, number> = {}; for (const [k, p] of E.pool) o[k] = p.eng.peak(); return o }
export const soundingCount = () => E.sounding.size

// ---------- instruments ----------
interface Target { on(n: number, v: number): void; off(n: number): void; allOff(): void; set(key: string, val: number): void; cutoff(frac: number): void }
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
  if (inst === 'follow') return '↪ Follow current sound'
  if (inst === 'auto') return '✨ Current sound'
  const s = SOUNDS.find((x) => 'sound:' + x.id === inst)
  if (s) return s.icon + ' ' + s.label
  return '🎛️ ' + (getEmu(emuIdOf(inst) ?? '')?.name ?? inst)
}
export const INSTRUMENTS = (): string[] => ['auto', 'koog', ...SOUNDS.filter((s) => s.emu).map((s) => 'sound:' + s.id), 'follow']
export const canFilter = (inst: string): boolean => inst === 'koog' || inst === 'auto' || !!getEmu(emuIdOf(inst) ?? '')?.ctls.some((c) => c.key === 'cutoff')
function synthOn(n: number, v: number) { const s = getSynth(); if (s.ready) s.noteOn(n, v); else void s.unlock().then(() => s.noteOn(n, v)) }
const synthTarget: Target = {
  on: synthOn, off: (n) => getSynth().noteOff(n), allOff: () => getSynth().panic(),
  set: (k, v) => { E.applying = true; try { getSynth().setParams({ [k]: v } as never) } finally { E.applying = false } },
  cutoff: (f) => synthTarget.set('cutoff', 250 * Math.pow(10000 / 250, f)),
}
/** the knob settings of the live emulator panel that matches `inst` (so a track plays what you heard, not the factory preset) */
function snapshotPatch(inst: string): Record<string, number> | undefined {
  const id = emuIdOf(inst); if (!id || inst.startsWith('sound:')) return undefined
  const mine = new Set([...E.pool.values()].map((p) => p.eng))
  const e = [...liveEngines()].reverse().find((x) => x.spec.id === id && !mine.has(x))
  return e ? { ...e.P } : undefined
}
function poolEngine(inst: string, patch?: Record<string, number>): Engine | null {
  const have = E.pool.get(inst); if (have) return have.eng
  const eid = emuIdOf(inst), spec = eid ? getEmu(eid) : undefined
  if (!spec) return null
  const eng = createEngine(spec)
  const ch = SOUNDS.find((s) => 'sound:' + s.id === inst)
  const p = spec.presets.find((x) => x.name === ch?.preset) ?? spec.presets[0]
  E.applying = true
  try { for (const c of spec.ctls) eng.set(c.key, patch?.[c.key] ?? p?.values[c.key] ?? c.def) } finally { E.applying = false }
  E.pool.set(inst, { eng, spec: spec.id })
  return eng
}
/** create + wake a track's instrument NOW (called from the press, so the browser allows the audio) */
function warm(L: Layer) { if (L.inst !== 'koog' && L.inst !== 'follow' && L.inst !== 'auto') void poolEngine(L.inst, L.patch)?.unlock().catch(() => {}); else void getSynth().unlock().catch(() => {}) }
function target(L: Layer): Target {
  const inst = L.inst
  if (inst === 'follow') {
    const a = getActiveInstrument()
    return a ? { on: (n, v) => a.noteOn(n, v), off: (n) => a.noteOff(n), allOff: () => a.allOff?.(), set: () => {}, cutoff: () => {} } : synthTarget
  }
  if (inst === 'koog' || inst === 'auto') return synthTarget
  const e = poolEngine(inst, L.patch)
  if (!e) return synthTarget
  const cut = e.spec.ctls.find((c) => c.key === 'cutoff')
  const set = (k: string, v: number) => { E.applying = true; try { e.set(k, v) } finally { E.applying = false } }
  return { on: (n, v) => e.noteOn(n, v), off: (n) => e.noteOff(n), allOff: () => e.allOff(), set, cutoff: (f) => { if (cut) set('cutoff', cut.min * Math.pow(cut.max / cut.min, f)) } }
}
function gcPool() {
  const used = new Set(E.layers.filter((l) => l.state !== 'empty' || l.takes.length || l.picked).map((l) => l.inst))
  for (const [k, p] of [...E.pool]) if (!used.has(k)) { try { p.eng.allOff(); p.eng.dispose() } catch { /* ignore */ } E.pool.delete(k) }
}
/** wake the audio of every instrument the tracks use (call from a click / key / pad press) */
export function unlockLoopAudio() { if (useGuide.getState().on || S().countIn > 0) unlockGuide(); for (const l of E.layers) if (l.state !== 'empty' || l.takes.length) warm(l) }

// ---------- geometry: every track has a grid start + length ----------
const lenOf = (L: Layer) => (L.free ? L.ownLen : E.lenBeats > 0 ? E.lenBeats * L.mult : 0)
const startOf = (L: Layer) => (L.free ? L.ownStart : E.loopStart)
const periodOf = (L: Layer) => lenOf(L) / L.speed
const baseOf = (L: Layer) => (L.oneShot ? L.origin : startOf(L))
/** next bar line (4 beats from the track's start) at or after `abs` */
const nextBar = (L: Layer, abs: number) => { const s = startOf(L); return s + Math.ceil((abs - s) / 4 - 1e-6) * 4 }
const nextCycle = (L: Layer, abs: number) => { const s = baseOf(L), P = periodOf(L); return s + Math.ceil((abs - s) / P - 1e-6) * P }
const active = (L: Layer) => L.state === 'play' || L.state === 'over'

/** position inside the loop in beats, or null while stopped / counting in */
export function loopPos(): { pos: number; counting: boolean; bar: number } | null {
  if (!E.running) return null
  const p = beatPos() - E.loopStart
  if (p < 0) return { pos: 0, counting: true, bar: Math.ceil(-p / 4) }
  return { pos: E.lenBeats > 0 ? mod(p, E.lenBeats) : p, counting: false, bar: Math.floor(p / 4) }
}
/** 0..1 through this track's loop, or -1 when it is not running */
export function layerProgress(i: number): number {
  const L = E.layers[i]; if (!E.running || L.state === 'empty') return -1
  const len = lenOf(L); if (len <= 0) return beatPos() < startOf(L) ? 0 : -2 // -2: recording a take whose length is not known yet
  const p = beatPos() - baseOf(L)
  if (p < 0) return 0
  return mod(p, periodOf(L)) / periodOf(L)
}
export function lcdInfo() {
  const p = loopPos()
  const b = p ? p.pos : 0
  return { bar: p ? Math.floor(b / 4) + 1 : 0, beat: p ? Math.floor(b % 4) + 1 : 0, bpm: getBpm(), counting: !!p?.counting, count: p?.counting ? p.bar : 0, running: E.running, bars: E.lenBeats / 4 }
}
/** how far the button has been held, 0..1 (the ring fills up to the 2 s UNDO / CLEAR) */
export function holdProgress(i: number): number { const d = E.down[i]; return d && !d.fired ? clamp((performance.now() - d.t) / HOLD_MS, 0, 1) : 0 }
export const getSel = () => E.sel
export const getLenBeats = () => E.lenBeats
export const getLoopStart = () => E.loopStart
export function select(i: number) { E.sel = clamp(i, 0, LAYERS - 1); commit() }

/** a track begins to sound from `at` (it was not playing): schedule everything from there on */
function startPlaying(L: Layer, at: number) {
  L.state = 'play'; L.pend = null; L.fade = null
  L.playFrom = at; L.sched = at; L.origin = L.oneShot ? at : startOf(L)
}

// ---------- transport ----------
function ensureTransport(countBars: number) {
  if (E.running) return
  const fresh = !isRunning()
  if (fresh) { startMaster(); E.ownMaster = true }
  const follow = useMaster.getState().following
  if (!follow) { resetPhase(); E.loopStart = countBars * 4 } // beat 0 is right now: the first take starts when you press
  else E.loopStart = Math.ceil((beatPos() + 0.02) / 4) * 4 + countBars * 4 // the DJ owns the grid: wait for his bar line
  E.sched = beatPos()
  E.running = true
  useLoop.setState({ countLeft: countBars })
}
function allQuiet() {
  for (const t of E.timers) clearTimeout(t)
  E.timers.clear()
  for (const l of E.layers) { try { target(l).allOff() } catch { /* ignore */ } }
  E.sounding.clear()
}
function quietLayer(i: number) {
  for (const [k, s] of [...E.sounding]) if (k.startsWith(i + ':')) { try { target({ ...E.layers[i], inst: s.inst }).off(s.n) } catch { /* ignore */ } E.sounding.delete(k) }
}
export function stopAll() {
  closeRec(true)
  allQuiet()
  for (const l of E.layers) { l.pend = null; l.fade = null; if (l.state !== 'empty') l.state = l.takes.length ? 'stop' : 'empty' }
  E.running = false
  if (E.ownMaster && !useMaster.getState().following) { stopMaster(); E.ownMaster = false }
  commit()
}
export function playAll() {
  if (!E.layers.some((l) => l.takes.length) || (E.lenBeats <= 0 && !E.layers.some((l) => l.ownLen))) return
  closeRec(true)
  const was = E.running
  if (!was) { ensureTransport(0); if (E.lenBeats <= 0) E.lenBeats = E.layers.find((l) => l.ownLen)?.ownLen ?? 4 }
  const at = was ? Math.ceil((beatPos() + 0.02) / 4) * 4 : E.loopStart
  for (const l of E.layers) {
    if (!l.takes.length || l.state === 'play' || l.state === 'over') continue
    if (l.free && !was) l.ownStart = E.loopStart
    startPlaying(l, was ? at : E.loopStart)
  }
  commit()
}
export function togglePlay() { if (E.running && E.layers.some((l) => active(l) || l.state === 'rec')) stopAll(); else playAll() }

// ---------- recording ----------
const defining = (L: Layer) => lenOf(L) <= 0
function startRec(i: number, over: boolean) {
  closeRec(true)
  E.rec = { notes: [], auto: {}, pads: [], pend: new Map() }
  E.recIdx = i
  const L = E.layers[i]
  L.state = over ? 'over' : 'rec'; L.pend = null
  if (L.free && !L.ownLen) L.ownStart = Math.max(beatPos(), E.loopStart) // an unsynced track times itself from now
  E.paramSnap = {}
  const p = getSynth().params as unknown as Record<string, number | string>
  for (const k of Object.keys(p)) if (typeof p[k] === 'number') E.paramSnap[k] = p[k] as number
}
/** finish the take in progress. quiet=true leaves the commit to the caller. */
function closeRec(quiet: boolean) {
  const r = E.rec, i = E.recIdx
  if (!r || i < 0) return
  const now = performance.now(), abs = beatPos(now)
  for (const [n, p] of r.pend) r.notes.push({ t: p.t, d: Math.max(0.1, abs - p.abs), n, v: p.v })
  r.pend.clear()
  const L = E.layers[i]
  if (defining(L)) {
    const st = startOf(L), el = abs - st
    if (!r.notes.length && !Object.keys(r.auto).length && !r.pads.length) { E.rec = null; E.recIdx = -1; L.state = 'empty'; abortTransportIfIdle(); if (!quiet) commit(); return }
    // a sloppy first take: with MEASURE on the loop snaps to whole bars, otherwise it is exactly as long as you played (to a 1/16 beat)
    const maxB = 32
    const len = S().measure ? clamp(Math.round(el / 4), 1, maxB / 4) * 4 : clamp(Math.round(el * 4) / 4, 1, maxB)
    if (L.free) { L.ownLen = len; if (E.lenBeats <= 0) E.lenBeats = len } else { E.lenBeats = len; useLoop.setState({ lenBars: LEN_CHOICES.includes(len / 4) ? len / 4 : 0 }) }
  }
  const len = lenOf(L)
  // notes that landed past the end (you were a little late closing it) wrap to the start instead of vanishing
  const notes = r.notes.map((n) => ({ ...n, t: n.t >= len ? n.t - len : n.t, d: Math.min(n.d, len) })).filter((n) => n.t >= 0 && n.t < len)
  const auto: Record<string, AutoPt[]> = {}
  for (const [k, pts] of Object.entries(r.auto)) { const f = pts.filter((p) => p.t < len); if (f.length) auto[k] = f }
  const take: Take = { notes, auto, pads: r.pads.filter((p) => p.t < len) }
  const has = notes.length || Object.keys(take.auto).length || take.pads.length
  if (has) { L.takes.push(take); L.redo = []; L.lastHold = null }
  const wasRec = L.state === 'rec'
  L.state = L.takes.length ? 'play' : 'empty'
  L.playFrom = abs; L.origin = startOf(L)
  if (wasRec) L.sched = abs // a freshly recorded take starts sounding from now (what you just played is in the past)
  E.rec = null; E.recIdx = -1
  if (!L.takes.length) abortTransportIfIdle()
}
function abortTransportIfIdle() {
  if (E.layers.some((l) => l.state !== 'empty')) return
  E.running = false; E.lenBeats = S().lenBars * 4
  for (const l of E.layers) { l.ownLen = 0 }
  if (E.ownMaster) { stopMaster(); E.ownMaster = false }
}
function quantise(pos: number, len: number): number {
  const g = S().quant
  if (!g) return pos
  let q = Math.round(pos / g) * g
  if (len > 0 && q >= len) q -= len
  return q
}
function recPos(L: Layer, abs: number): number | null {
  const p = abs - startOf(L)
  if (p < -PRE_ROLL) return null // still counting in
  const len = lenOf(L)
  if (p < 0) return 0 // a hair early on the "1": it belongs to the downbeat, not to the count-in
  return len > 0 ? mod(p, len) : p
}
function onPlayed(e: { note: number; on: boolean; velocity: number }) {
  const r = E.rec; if (!r || !E.running) return
  const L = E.layers[E.recIdx]; if (!L) return
  const now = performance.now(), abs = beatPos(now)
  if (e.on) {
    const pos = recPos(L, abs); if (pos == null) return
    const old = r.pend.get(e.note)
    if (old) r.notes.push({ t: old.t, d: Math.max(0.1, abs - old.abs), n: e.note, v: old.v })
    r.pend.set(e.note, { t: quantise(pos, lenOf(L)), abs, v: e.velocity || 90 })
  } else {
    const p = r.pend.get(e.note); if (!p) return
    r.pend.delete(e.note)
    r.notes.push({ t: p.t, d: Math.min(Math.max(0.1, abs - p.abs), lenOf(L) || 64), n: e.note, v: p.v })
  }
}
function autoPoint(lane: string, val: number) {
  const r = E.rec; if (!r || !E.running || E.applying) return
  const L = E.layers[E.recIdx]; if (!L) return
  const pos = recPos(L, beatPos()); if (pos == null) return
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

// ---------- state changes (immediate, or waiting for the bar line / loop end) ----------
function apply(i: number, to: 'rec' | 'over' | 'play' | 'stop') {
  const L = E.layers[i]; L.pend = null
  if (to === 'rec' || to === 'over') {
    if (E.recIdx === i) return
    if (L.state === 'empty' || to === 'rec') { if (!L.takes.length && !L.picked) L.inst = currentInstId(); L.patch = snapshotPatch(L.inst); warm(L) }
    startRec(i, to === 'over')
  } else if (to === 'play') {
    if (E.recIdx === i) closeRec(true)
    const was = L.state
    if (was === 'play' || was === 'over') { L.state = 'play'; L.fade = null } else startPlaying(L, beatPos())
  } else {
    if (E.recIdx === i) closeRec(true)
    quietLayer(i); L.state = L.takes.length ? 'stop' : 'empty'; L.fade = null
  }
  commit()
}
/** STOP for one track, honouring its stop mode */
export function stopLayer(i: number) {
  const L = E.layers[i]
  if (L.state === 'empty') return
  if (E.recIdx === i) closeRec(true)
  if (L.state !== 'play' && L.state !== 'over') { commit(); return }
  if (!E.running || L.stopMode === 'now') { apply(i, 'stop'); return }
  const end = nextCycle(L, beatPos() + 0.02)
  if (L.stopMode === 'fade') L.fade = { from: beatPos(), to: end }
  L.pend = { to: 'stop', at: end }
  commit()
}

// ---------- the one-button pedal ----------
/** the tap: REC -> PLAY/DUB -> DUB <-> PLAY */
function tap(i: number) {
  const L = E.layers[i]
  E.sel = i
  unlockLoopAudio()
  switch (L.state) {
    case 'empty': {
      if (!L.picked) L.inst = currentInstId()
      L.patch = snapshotPatch(L.inst); warm(L); L.free = !S().sync
      if (!E.running) { ensureTransport(S().countIn); if (E.lenBeats <= 0 && S().lenBars > 0) E.lenBeats = S().lenBars * 4 }
      else if (!defining(L) && !L.free && S().measure) { L.pend = { to: 'rec', at: nextBar(L, beatPos() + 0.02) }; break }
      else if (!L.free && E.lenBeats <= 0 && S().lenBars > 0) E.lenBeats = S().lenBars * 4
      for (const o of E.layers) if (o.state === 'stop' && o !== L && !o.pend) startPlaying(o, E.loopStart)
      startRec(i, false)
      break
    }
    case 'rec': {
      const first = defining(L)
      const next = S().recNext === 'dub' ? 'over' : 'play'
      if (!first && S().measure) { L.pend = { to: next, at: nextBar(L, beatPos() + 0.02) }; break }
      closeRec(true)
      if ((L.state as LState) === 'play' && next === 'over') startRec(i, true)
      break
    }
    case 'over':
      if (S().measure) L.pend = { to: 'play', at: nextBar(L, beatPos() + 0.02) }
      else closeRec(true)
      break
    case 'play':
      if (!E.running) { playAll(); return }
      if (L.pend) { L.pend = null; break }
      if (S().measure) L.pend = { to: 'over', at: nextBar(L, beatPos() + 0.02) }
      else { warm(L); startRec(i, true) }
      break
    case 'stop':
      if (L.oneShot || L.startMode === 'end') {
        if (!E.running) { playAll(); return }
        if (L.startMode === 'end') L.pend = { to: 'play', at: nextCycle(L, beatPos() + 0.02) }
        else startPlaying(L, beatPos())
      } else if (!E.running) playAll()
      else startPlaying(L, beatPos())
      break
  }
  commit()
}
/** hold 2 s: UNDO (again: REDO); held while the track is stopped: CLEAR */
function holdAction(i: number, prev: LState) {
  const L = E.layers[i]
  if (prev === 'stop' || (!E.running && L.takes.length)) { clearLayer(i); return }
  if (E.recIdx === i && (prev === 'play' || prev === 'empty')) { // the press that began this hold started a take: drop it first
    undoTake(i)
    if (prev === 'empty') return
  }
  if (L.lastHold === 'undo' && L.redo.length) { redo(i); L.lastHold = 'redo' } else { undo(i); L.lastHold = 'undo' }
  commit()
}
export function buttonDown(i: number) {
  i = clamp(i, 0, LAYERS - 1)
  const now = performance.now(), L = E.layers[i]
  const prev = L.state
  const dbl = now - (E.lastDown[i] ?? 0) < DOUBLE_MS
  E.lastDown[i] = dbl ? 0 : now
  const d: Eng['down'][number] = (E.down[i] = { t: now, timer: 0, fired: false, prev, dbl })
  E.sel = i
  if (dbl) { stopLayer(i); commit(); return }
  tap(i)
  d.timer = window.setTimeout(() => { d.fired = true; E.lastDown[i] = 0; holdAction(i, prev); useLoop.setState((s) => ({ rev: s.rev + 1 })) }, HOLD_MS)
}
export function buttonUp(i: number) {
  const d = E.down[i]; if (!d) return
  clearTimeout(d.timer)
  delete E.down[i]
}
/** one full click (tests and the compact row) */
export function pressLayer(i: number) { buttonDown(i); buttonUp(i); E.lastDown[i] = 0 }

export function toggleMute(i: number) { E.layers[i].mute = !E.layers[i].mute; if (E.layers[i].mute) quietLayer(i); commit() }
export function toggleSolo(i: number) { E.layers[i].solo = !E.layers[i].solo; for (let k = 0; k < LAYERS; k++) if (!audible(k)) quietLayer(k); commit() }
export function clearLayer(i: number) {
  if (E.recIdx === i) { E.rec = null; E.recIdx = -1 }
  quietLayer(i)
  const keep = E.layers[i]
  E.layers[i] = { ...newLayer(), inst: keep.picked ? keep.inst : 'auto', picked: keep.picked, vol: keep.vol, mult: keep.mult }
  if (!E.layers.some((l) => l.state !== 'empty')) { allQuiet(); abortTransportIfIdle() }
  commit()
}
export function clearAll() { for (let i = 0; i < LAYERS; i++) E.layers[i] = newLayer(); E.rec = null; E.recIdx = -1; allQuiet(); abortTransportIfIdle(); E.lenBeats = S().lenBars * 4; commit() }
function undoTake(i: number) {
  const L = E.layers[i], was = L.state
  E.rec = null; E.recIdx = -1
  L.state = was === 'over' ? 'play' : L.takes.length ? 'play' : 'empty'
  if (L.state === 'empty') abortTransportIfIdle()
}
export function undo(i = E.sel) {
  const L = E.layers[i]
  if ((L.state === 'rec' || L.state === 'over') && E.recIdx === i) { undoTake(i); commit(); return }
  const t = L.takes.pop(); if (!t) return
  L.redo.push(t); quietLayer(i)
  if (!L.takes.length) { L.state = 'empty'; if (!E.layers.some((l) => l.state !== 'empty')) { allQuiet(); abortTransportIfIdle() } }
  commit()
}
export function redo(i = E.sel) {
  const L = E.layers[i], t = L.redo.pop(); if (!t) return
  L.takes.push(t)
  if (L.state === 'empty') { if (E.running) startPlaying(L, beatPos()); else L.state = 'stop' }
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
/** pedal options + FX of one track */
export function setLayerOpt<K extends 'oneShot' | 'reverse' | 'speed' | 'startMode' | 'stopMode' | 'mult' | 'fxFilter' | 'fxStutter'>(i: number, k: K, v: Layer[K]) {
  const L = E.layers[i]
  ;(L as unknown as Record<string, unknown>)[k] = v
  if (k === 'oneShot' && v && L.state === 'play') { L.origin = nextCycle({ ...L, oneShot: false } as Layer, beatPos()) }
  if ((k === 'reverse' || k === 'speed' || k === 'oneShot') && (L.state === 'play' || L.state === 'over')) quietLayer(i)
  commit()
}
export function setLayerInst(i: number, inst: string) { quietLayer(i); const L = E.layers[i]; L.inst = inst; L.picked = inst !== 'auto'; L.patch = undefined; warm(L); commit() }
export function setLenBars(n: number) {
  useLoop.setState({ lenBars: n })
  if (n > 0 && (E.layers.some((l) => l.takes.length) || E.running)) E.lenBeats = n * 4
  else if (n > 0 && !E.running) E.lenBeats = 0
  commit()
}

// ---------- playback scheduler ----------
const soloActive = () => E.layers.some((l) => l.solo)
const audible = (i: number) => { const l = E.layers[i]; return !l.mute && (!soloActive() || l.solo) }
function gainOf(i: number, abs: number): number {
  const s = S(), L = E.layers[i], xf = i < 4 ? Math.min(1, 2 * (1 - s.xf)) : Math.min(1, 2 * s.xf)
  const fade = L.fade ? clamp(1 - (abs - L.fade.from) / Math.max(0.01, L.fade.to - L.fade.from), 0, 1) : 1
  return L.vol * s.master * xf * fade
}
function later(fn: () => void, ms: number) {
  const h = window.setTimeout(() => { E.timers.delete(h); fn() }, Math.max(0, ms))
  E.timers.add(h)
}
/** every time an event (at loop time t, lasting d beats) sounds inside [from, to): honours nudge, reverse, speed, one-shot */
function occurrences(L: Layer, t: number, d: number, from: number, to: number, isNote: boolean, cb: (abs: number, dur: number) => void) {
  const len = lenOf(L); if (len <= 0) return
  const sp = L.speed, P = len / sp, base = baseOf(L)
  const tt = mod(t + L.nudge, len)
  const r = L.reverse ? mod(len - tt - (isNote ? d : 0), len) : tt
  const off = r / sp
  const lo = Math.max(from, L.oneShot ? base : L.playFrom - 1e-6)
  for (let k = L.oneShot ? 0 : Math.ceil((lo - base - off) / P); ; k++) {
    if (L.oneShot && k > 0) break
    const abs = base + k * P + off
    if (abs >= to) break
    if (abs >= lo) cb(abs, (d * L.gate) / sp)
  }
}
function playNote(i: number, L: Layer, note: number, vel: number, at: number, durMs: number) {
  const tg = target(L)
  later(() => {
    if (E.debug.on && E.debug.log.length < 800) E.debug.log.push({ layer: i, n: note, expect: at, actual: performance.now() })
    const key = i + ':' + note
    if (E.sounding.has(key)) tg.off(note)
    const id = ++E.sid
    tg.on(note, vel); E.sounding.set(key, { inst: L.inst, n: note, id })
    later(() => { if (E.sounding.get(key)?.id === id) { tg.off(note); E.sounding.delete(key) } }, Math.max(30, durMs))
  }, at - performance.now())
}
function schedule(now: number) {
  if (!E.running) return
  // housekeeping: waiting transitions, finished one-shots and fades
  const pos = beatPos(now + 25)
  for (let i = 0; i < LAYERS; i++) {
    const L = E.layers[i]
    if (L.pend && pos >= L.pend.at) { const to = L.pend.to; L.pend = null; apply(i, to) }
    if (L.oneShot && L.state === 'play' && beatPos(now) > baseOf(L) + periodOf(L) + 0.05) { L.state = 'stop'; commit() }
  }
  const lenAny = E.layers.some((l) => lenOf(l) > 0)
  if (!lenAny) return
  const to = beatPos(now + LOOK_MS), nowB = beatPos(now)
  const mspb = msPerBeat()
  for (let i = 0; i < LAYERS; i++) {
    const L = E.layers[i]
    if (!active(L) || lenOf(L) <= 0) continue
    // each track's own pointer; if the tick stalled for a while, skip what is stale instead of bursting it out
    const from = L.sched < nowB - 0.25 ? nowB : L.sched
    if (!audible(i)) { L.sched = to; continue }
    if (to <= from) continue
    for (const take of L.takes) {
      for (const ev of take.notes) occurrences(L, ev.t, ev.d, from, to, true, (abs, dur) => {
        const at = timeOfBeat(abs), note = clamp(ev.n + L.transpose, 0, 127), g = gainOf(i, abs)
        const roll = L.fxStutter ? (L.fxStutter === 1 ? 0.5 : 0.25) : 0
        if (roll) { // stutter: re-hit the note every 1/8 or 1/16 beat for as long as it is held, a little softer each time
          const n = clamp(Math.floor(Math.max(dur, 1) / roll), 1, 12) // a roll lasts at least a beat, even on a short tap
          for (let j = 0; j < n; j++) { const v = Math.round(clamp(ev.v * g * Math.pow(0.88, j), 0, 127)); if (v >= 1) playNote(i, L, note, v, at + j * roll * mspb, roll * 0.8 * mspb) }
          return
        }
        const vel = Math.round(clamp(ev.v * g, 0, 127))
        if (vel >= 1) playNote(i, L, note, vel, at, dur * mspb)
      })
      for (const [lane, pts] of Object.entries(take.auto)) for (const pt of pts) occurrences(L, pt.t, 0, from, to, false, (abs) => {
        later(() => target(L).set(lane.slice(2), pt.v), timeOfBeat(abs) - performance.now())
      })
      if (S().recPads) for (const p of take.pads) occurrences(L, p.t, 0, from, to, false, (abs) => {
        later(() => { E.applying = true; try { dispatch({ id: ('pad' + (p.n + 1)) as 'pad1', deck: p.deck, value: 1 }); later(() => dispatch({ id: ('pad' + (p.n + 1)) as 'pad1', deck: p.deck, value: 0 }), 60) } finally { E.applying = false } }, timeOfBeat(abs) - performance.now())
      })
    }
    if (L.fxFilter > 0) { // filter sweep: a slow triangle over the track's loop, deeper with the knob
      const P = periodOf(L), base = baseOf(L), step = 0.25
      for (let b = Math.ceil((from - base) / step) * step + base; b < to; b += step) {
        const ph = mod(b - base, P) / P, tri = ph < 0.5 ? ph * 2 : 2 - ph * 2
        const f = clamp(1 - L.fxFilter * (1 - tri), 0.02, 1)
        later(() => target(L).cutoff(f), timeOfBeat(b) - performance.now())
      }
    }
    L.sched = to
  }
  E.sched = to
}

// ---------- count-in click ----------
function onClockBeat(b: { n: number; beat: number }) {
  if (!E.running) return
  const counting = b.n < E.loopStart
  if (counting) useLoop.setState({ countLeft: Math.max(0, Math.ceil((E.loopStart - b.n) / 4)) })
  else if (S().countLeft) useLoop.setState({ countLeft: 0 })
  if (counting && !useGuide.getState().on) playClick(b.beat === 0)
}

// ---------- sheet music (optional) ----------
let lastScoreKey = ''
function publish() {
  const s = S(), L = E.layers[E.sel]
  if (!s.sheet || !E.running || !L || !L.takes.length || lenOf(L) <= 0) { if (lastScoreKey) { clearScore('loop'); lastScoreKey = '' } return }
  const len = lenOf(L)
  const evs = L.takes.flatMap((t) => t.notes).map((n) => ({ ...n, t: mod(n.t + L.nudge, len), n: n.n + L.transpose })).sort((a, b) => a.t - b.t)
  const notes: { note: number | null; beats: number }[] = []
  let cur = 0
  for (let k = 0; k < evs.length; k++) {
    const e = evs[k]
    if (e.t < cur - 1e-6) continue
    if (e.t > cur + 1e-6) notes.push({ note: null, beats: e.t - cur })
    const next = evs.slice(k + 1).find((x) => x.t > e.t + 1e-6)
    const b = Math.max(0.25, Math.min(e.d, (next ? next.t : len) - e.t))
    notes.push({ note: e.n, beats: b }); cur = e.t + b
  }
  const key = JSON.stringify([E.sel, notes, useMaster.getState().bpm])
  if (key === lastScoreKey) return
  lastScoreKey = key
  setScore({ owner: 'loop', title: 'Loop track ' + (E.sel + 1), notes, bpm: useMaster.getState().bpm, beatsPerBar: 4 })
}

// ---------- export / sessions ----------
const GM: Record<string, number> = { koog: 81, 'sound:organ': 19, 'sound:moog': 80, 'sound:epiano': 4, 'sound:bell': 14, 'sound:strings': 48, 'sound:choir': 52, 'sound:pad': 89, 'sound:brass': 61,
  'emu:hammond': 16, 'emu:mellotron': 48, 'emu:juno': 89, 'emu:prophet': 90, 'emu:dx': 4, 'emu:moog': 80, 'emu:arp': 81, 'emu:theremin': 54, 'emu:ondes': 19, 'emu:tb303': 38 }
/** the loop as a Standard MIDI File (format 1): tempo track + one track per non-empty track (+ DJ pads on channel 10). Reverse / speed / transpose are baked in. */
export function exportMidi(passes = 1): Uint8Array {
  const len = E.lenBeats || 4
  const tracks: MidiTrack[] = []
  E.layers.forEach((L, i) => {
    const ll = lenOf(L); if (ll <= 0) return
    const notes: MidiTrack['notes'] = []
    const sp = L.speed
    for (const ev of L.takes.flatMap((t) => t.notes)) {
      const tt = mod(ev.t + L.nudge, ll), r = L.reverse ? mod(ll - tt - ev.d, ll) : tt
      for (let k = 0; ; k++) { const t = r / sp + k * (ll / sp); if (t >= len || (L.oneShot && k > 0)) break; notes.push({ t, d: Math.max(0.05, (ev.d * L.gate) / sp), n: clamp(ev.n + L.transpose, 0, 127), v: Math.round(clamp(ev.v * L.vol * S().master, 1, 127)) }) }
    }
    if (notes.length) tracks.push({ name: `Track ${i + 1} ${instLabel(L.inst).replace(/[^\x20-\x7e]/g, '').trim()}`, channel: i % 8, program: GM[L.inst] ?? 80, notes })
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
type SavedLayer = Pick<Layer, 'inst' | 'vol' | 'mute' | 'solo' | 'takes' | 'transpose' | 'gate' | 'nudge'> & Partial<Layer>
interface Saved { name: string; at: number; bpm: number; lenBars: number; lenBeats: number; layers: SavedLayer[]; countIn: number; quant: number }
const SKEY = 'loop.sessions.v1'
export const listSessions = (): Record<string, Saved> => pload<Record<string, Saved>>(SKEY, {})
export function saveSession(slot: string, name = 'Loop ' + slot) {
  const all = listSessions()
  all[slot] = { name, at: Date.now(), bpm: useMaster.getState().bpm, lenBars: S().lenBars, lenBeats: E.lenBeats, countIn: S().countIn, quant: S().quant,
    layers: E.layers.map((l) => ({ inst: l.inst, vol: l.vol, mute: l.mute, solo: l.solo, takes: l.takes, transpose: l.transpose, gate: l.gate, nudge: l.nudge,
      oneShot: l.oneShot, reverse: l.reverse, speed: l.speed, startMode: l.startMode, stopMode: l.stopMode, mult: l.mult, fxFilter: l.fxFilter, fxStutter: l.fxStutter, patch: l.patch, ownLen: l.ownLen })) }
  psave(SKEY, all)
}
export function loadSession(slot: string): boolean {
  const d = listSessions()[slot]; if (!d) return false
  stopAll()
  E.layers = Array.from({ length: LAYERS }, (_, i) => {
    const s = d.layers[i]
    return s ? { ...newLayer(), ...s, redo: [], pend: null, fade: null, state: s.takes.length ? 'stop' : 'empty' } as Layer : newLayer()
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
    onPad((p) => { if (E.rec && !E.applying && S().recPads && E.running) { const L = E.layers[E.recIdx]; const pos = L ? recPos(L, beatPos()) : null; if (pos != null) E.rec.pads.push({ t: pos, deck: p.deck, n: p.n }) } }),
    onTick((now) => schedule(now)),
    onBeat((b) => onClockBeat(b)),
    // somebody else stopped the master clock (the Boss transport): the loop cannot keep time without it, so stop cleanly (no stuck notes)
    useMaster.subscribe((s) => {
      if (!s.running && E.running) {
        closeRec(true); allQuiet()
        for (const l of E.layers) { l.pend = null; if (l.state !== 'empty') l.state = l.takes.length ? 'stop' : 'empty' }
        E.running = false; E.ownMaster = false; commit()
      }
    }),
    onProfileChange(() => { stopAll(); E.layers = Array.from({ length: LAYERS }, newLayer); E.lenBeats = 0; E.sel = 0; commit() }),
  ]
}
init()

if (import.meta.hot) {
  import.meta.hot.data.store = useLoop
  import.meta.hot.data.E = E
  // an edit must not leave notes ringing or timers firing into the old code
  import.meta.hot.dispose(() => { for (const f of E.offs) f(); E.offs = []; try { allQuiet() } catch { /* ignore */ } for (const d of Object.values(E.down)) clearTimeout(d.timer); E.down = {} })
  import.meta.hot.accept()
}
