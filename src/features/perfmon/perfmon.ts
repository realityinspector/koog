// Performance monitor core. SAMPLES, never traces: fixed typed-array rings, no per-frame allocation, and nothing runs when it is off.
// Everything stays on this device: there is no network code in this folder.
//
// Per APP STATE (screen + game/synth + scene + open docks + helpers on) it keeps rolling windows (about 60 s) of:
//   frame time (rAF), event-loop lag (worker-timer heartbeat), input->sound latency, long tasks, audio glitches, JS heap.
// Input->sound (read-only): a MIDI NoteEvent carries t (the MIDI event's own timeStamp, performance.now() ms). The synth is started BEFORE the
//   note event reaches the store ("sound first"), so the first OscillatorNode / AudioBufferSourceNode start() at or after t is the sound.
//   We note start() times by wrapping those two prototype methods while the monitor is on (restored when off). No source file is edited.
//   Notes played on screen (playLocal) have no t; the sweep script times playLocal() -> start() itself and feeds addInput().
import { wClear, wInterval } from '../../audio/workerTimer'
import { onNote } from '../../music/notes'
import { useScreen } from '../../layout/screenStore'
import { useLinkOut } from '../../links/bus'
import { useProfile } from '../../profile/profile'
import { useDuoOpen } from '../dj/duoOpen'
import { useBoardOpen } from '../pedalboard/boardOpen'
import { useLoopsDock } from '../loopstation/LoopsDock'
import { useDrumPage } from '../drumpads/drumSurface'
import { useMentor } from '../mentor/mentorStore'
import * as mimic from '../mimic/engine'
import * as band from '../smartband/engine'
import { soundingCount, timerLag } from '../loopstation/loopEngine'

export const BUDGET = { frameP95: 20, inputP95: 10, lagP95: 15, glitches: 0 }
const FRAMES = 3600 // about 60 s at 60 fps
const SMALL = 256
const MAX_STATES = 40
const LS_FLAG = 'koog.perf', LS_SUM = 'koog.perf.v1', LS_HUD = 'koog.perf.hud'
const BEAT_MS = 50

export interface Stat { n: number; p50: number; p95: number; max: number }
export interface Row {
  key: string; label: string; screen: string; scene: string; docks: string; helpers: string
  secs: number; frames: Stat & { dropped: number }; input: Stat; lag: Stat; looperLag: number
  longTasks: { n: number; maxMs: number; totalMs: number }; glitches: number; heapMB: number; oscPerSec: number; live: boolean
}
export interface Report { app: string; when: string; ua: string; budgets: typeof BUDGET; audio: Record<string, unknown>; privacy: string; current: string; states: Row[] }

class Bucket {
  frames = new Float32Array(FRAMES); fi = 0; fn = 0; dropped = 0
  inp = new Float32Array(SMALL); ii = 0; inN = 0
  lag = new Float32Array(SMALL * 4); li = 0; ln = 0
  lagMax = 0; longN = 0; longMax = 0; longTotal = 0; glitches = 0; heap = 0; looperLag = 0; osc = 0
  secs = 0; last = 0
  constructor(public key: string, public screen: string, public scene: string, public docks: string, public helpers: string) {}
  get label() { return [this.screen, this.scene && 'scene:' + this.scene, this.docks && 'docks:' + this.docks, this.helpers && 'helpers:' + this.helpers].filter(Boolean).join(' · ') }
}

interface Hot { m?: M }
interface M {
  on: boolean; buckets: Map<string, Bucket>; cur: Bucket | null; raf: number; last: number; hb: number; beatAt: number; beats: number
  po: PerformanceObserver | null; offNote: (() => void) | null; poll: number; starts: Float64Array; si: number; oscCount: number; oscMark: number
  wall: number; ct: number; fallbackEv: number; sig: string; prev: Map<string, Partial<Row>>; lastKey: string
  orig: { osc?: (...a: unknown[]) => void; buf?: (...a: unknown[]) => void }; wrapOsc?: unknown; wrapBuf?: unknown
}
const hot = (import.meta.hot?.data ?? {}) as Hot
const M: M = hot.m ?? { on: false, buckets: new Map(), cur: null, raf: 0, last: 0, hb: 0, beatAt: 0, beats: 0, po: null, offNote: null, poll: 0, starts: new Float64Array(32), si: 0, oscCount: 0, oscMark: 0, wall: 0, ct: 0, fallbackEv: 0, sig: '', prev: new Map(), lastKey: '', orig: {} }
const scratch = new Float32Array(FRAMES)

function stat(a: Float32Array, n: number): Stat {
  if (!n) return { n: 0, p50: 0, p95: 0, max: 0 }
  const v = scratch.subarray(0, n); v.set(a.subarray(0, n)); v.sort()
  const q = (p: number) => Math.round(v[Math.min(n - 1, Math.floor(p * n))] * 100) / 100
  return { n, p50: q(0.5), p95: q(0.95), max: Math.round(v[n - 1] * 100) / 100 }
}
const lsGet = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }

// ---------- app state ----------
function readSig(): string {
  const sc = useScreen.getState(), lo = useLinkOut.getState(), boss = useProfile.getState().mode === 'dad'
  return [boss ? 1 : 0, sc.screen, sc.game ?? '', lo.emu ?? '', lo.visual ?? '', useLoopsDock.getState().open ? 1 : 0, useDrumPage.getState().on ? 1 : 0, useDuoOpen.getState().open ? 1 : 0, useBoardOpen.getState().open ? 1 : 0,
    useMentor.getState().on ? 1 : 0, mimic.getState().on ? 1 : 0, band.getState().on ? 1 : 0].join('|')
}
function bucketFor(sig: string): Bucket {
  let b = M.buckets.get(sig)
  if (b) return b
  const [boss, screen, game, emu, visual, loop, drum, duo, board, mentor, mim, bnd] = sig.split('|')
  let scr = (boss === '1' ? 'boss/' : '') + screen
  if (screen === 'games' && game) scr = 'games/' + game
  else if (screen === 'synth' && emu) scr = (boss === '1' ? 'boss/' : '') + 'synth/' + emu
  const docks = [loop === '1' && 'looper', drum === '1' && 'drums', duo === '1' && 'dj-strip', board === '1' && 'pedalboard'].filter(Boolean).join('+')
  const helpers = [mentor === '1' && 'mentor', bnd === '1' && 'band', mim === '1' && 'mimic'].filter(Boolean).join('+')
  b = new Bucket(sig, scr, screen === 'play' && boss !== '1' ? visual || 'default' : '', docks, helpers)
  if (M.buckets.size >= MAX_STATES) { // drop the least recently visited state
    let old: Bucket | null = null
    for (const x of M.buckets.values()) if (x !== M.cur && (!old || x.last < old.last)) old = x
    if (old) M.buckets.delete(old.key)
  }
  M.buckets.set(sig, b)
  return b
}
function pollState() {
  const s = readSig()
  if (s === M.sig && M.cur) return
  M.sig = s; M.cur = bucketFor(s); M.cur.last = performance.now()
}

// ---------- samplers ----------
function onFrame(ts: number) {
  if (!M.on) return
  M.raf = requestAnimationFrame(onFrame)
  const b = M.cur
  if (M.last > 0 && b && !document.hidden) {
    const dt = ts - M.last
    if (dt < 2000) {
      b.frames[b.fi] = dt; b.fi = b.fi + 1 === FRAMES ? 0 : b.fi + 1; if (b.fn < FRAMES) b.fn++
      if (dt > 25) b.dropped += Math.max(1, Math.round(dt / 16.7) - 1)
      b.secs += dt / 1000
    }
  }
  M.last = ts
}
function addInput(ms: number) {
  const b = M.cur; if (!b || !(ms >= 0) || ms > 500) return
  b.inp[b.ii] = ms; b.ii = b.ii + 1 === SMALL ? 0 : b.ii + 1; if (b.inN < SMALL) b.inN++
}
function noteStart() { const t = performance.now(); M.starts[M.si] = t; M.si = (M.si + 1) & 31; M.oscCount++ }
function lastStart(): number { return M.starts[(M.si + 31) & 31] }
function onNoteEv(e: { on: boolean; t?: number }) {
  if (!e.on || e.t === undefined) return
  let best = Infinity
  for (let i = 0; i < 32; i++) { const s = M.starts[i]; if (s >= e.t - 0.5 && s < best) best = s }
  if (best !== Infinity) addInput(best - e.t)
}
function beat() {
  const now = performance.now(), b = M.cur
  if (M.beatAt && b && !document.hidden) {
    const lag = Math.max(0, now - M.beatAt - BEAT_MS)
    b.lag[b.li] = lag; b.li = b.li + 1 === b.lag.length ? 0 : b.li + 1; if (b.ln < b.lag.length) b.ln++
    if (lag > b.lagMax) b.lagMax = lag
  }
  M.beatAt = now
  if (++M.beats % (1000 / BEAT_MS) === 0) second(now)
}
interface Ctxish { state: string; currentTime: number; baseLatency?: number; outputLatency?: number; playoutStats?: { fallbackFramesEvents?: number } }
const hostCtx = () => (globalThis as unknown as { __koogHost?: { ctx?: Ctxish } }).__koogHost?.ctx
function second(now: number) {
  pollState()
  const b = M.cur; if (!b || document.hidden) { M.wall = 0; return }
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
  if (mem) b.heap = Math.round(mem.usedJSHeapSize / 1048576 * 10) / 10
  b.osc = M.oscCount - M.oscMark; M.oscMark = M.oscCount
  const ll = timerLag(); if (ll > b.looperLag) b.looperLag = ll
  const c = hostCtx()
  if (c && c.state === 'running') {
    const ps = c.playoutStats?.fallbackFramesEvents
    if (typeof ps === 'number') { if (M.fallbackEv >= 0 && ps > M.fallbackEv) b.glitches += ps - M.fallbackEv; M.fallbackEv = ps }
    else if (M.wall) { // no playoutStats: the audio clock should advance as fast as the wall clock
      const dWall = now - M.wall, dCtx = (c.currentTime - M.ct) * 1000
      if (dWall < 3000 && dWall - dCtx > 60) b.glitches++
    }
    M.wall = now; M.ct = c.currentTime
  } else M.wall = 0
  if (M.beats % 200 === 0) save()
}

// ---------- start / stop ----------
function wrap(proto: { start: (...a: unknown[]) => void }, key: 'osc' | 'buf') {
  const orig = proto.start
  M.orig[key] = orig
  const w = function (this: unknown) { noteStart(); return orig.apply(this, arguments as unknown as unknown[]) }
  if (key === 'osc') M.wrapOsc = w; else M.wrapBuf = w
  proto.start = w as typeof orig
}
function install() {
  if (typeof OscillatorNode !== 'undefined' && !M.orig.osc) wrap(OscillatorNode.prototype as unknown as { start: (...a: unknown[]) => void }, 'osc')
  if (typeof AudioBufferSourceNode !== 'undefined' && !M.orig.buf) wrap(AudioBufferSourceNode.prototype as unknown as { start: (...a: unknown[]) => void }, 'buf')
}
function uninstall() {
  const o = OscillatorNode.prototype as unknown as { start: unknown }, a = AudioBufferSourceNode.prototype as unknown as { start: unknown }
  if (M.orig.osc && o.start === M.wrapOsc) o.start = M.orig.osc
  if (M.orig.buf && a.start === M.wrapBuf) a.start = M.orig.buf
  M.orig = {}
}
function start() {
  if (M.on) return
  M.on = true; M.last = 0; M.beatAt = 0; M.wall = 0; M.fallbackEv = -1
  loadPrev()
  install()
  pollState()
  M.raf = requestAnimationFrame(onFrame)
  M.hb = wInterval(beat, BEAT_MS)
  M.offNote = onNote(onNoteEv)
  try {
    M.po = new PerformanceObserver((l) => { const b = M.cur; if (!b) return; for (const e of l.getEntries()) { b.longN++; b.longTotal += e.duration; if (e.duration > b.longMax) b.longMax = e.duration } })
    M.po.observe({ type: 'longtask', buffered: false })
  } catch { M.po = null }
}
function stop() {
  if (!M.on) return
  M.on = false
  cancelAnimationFrame(M.raf); wClear(M.hb); M.hb = 0
  M.offNote?.(); M.offNote = null
  M.po?.disconnect(); M.po = null
  uninstall(); save()
}

// ---------- reporting ----------
function rowOf(b: Bucket): Row {
  return {
    key: b.key, label: b.label, screen: b.screen, scene: b.scene, docks: b.docks, helpers: b.helpers, secs: Math.round(b.secs),
    frames: { ...stat(b.frames, b.fn), dropped: b.dropped }, input: stat(b.inp, b.inN), lag: stat(b.lag, b.ln), looperLag: Math.round(b.looperLag * 10) / 10,
    longTasks: { n: b.longN, maxMs: Math.round(b.longMax), totalMs: Math.round(b.longTotal) }, glitches: b.glitches, heapMB: b.heap, oscPerSec: b.osc, live: true,
  }
}
const currentRow = (): Row | null => (M.cur ? rowOf(M.cur) : null)
function snapshot(): Report {
  const c = hostCtx()
  const rows: Row[] = [...M.buckets.values()].sort((a, b) => a.last - b.last).map(rowOf)
  for (const [k, p] of M.prev) if (!M.buckets.has(k)) rows.push({ ...(p as Row), key: k, live: false })
  return {
    app: 'Koog', when: new Date().toISOString(), ua: navigator.userAgent, budgets: BUDGET, privacy: 'Measured on this device only. Nothing is sent anywhere.',
    audio: { state: c?.state ?? 'no context yet', baseLatencyMs: c?.baseLatency != null ? Math.round(c.baseLatency * 1000 * 10) / 10 : null, outputLatencyMs: c?.outputLatency != null ? Math.round(c.outputLatency * 1000 * 10) / 10 : null, playoutStats: typeof c?.playoutStats?.fallbackFramesEvents === 'number', voicesLooper: soundingCount() },
    current: M.cur?.label ?? '', states: rows,
  }
}
function save() {
  const rows = snapshot().states.filter((r) => r.frames.n > 30).slice(-30).map((r) => ({ k: r.key, label: r.label, screen: r.screen, scene: r.scene, docks: r.docks, helpers: r.helpers, secs: r.secs, f: [r.frames.n, r.frames.p50, r.frames.p95, r.frames.dropped], i: [r.input.n, r.input.p95], l: [r.lag.n, r.lag.p95], g: r.glitches, lt: r.longTasks.n, h: r.heapMB }))
  lsSet(LS_SUM, JSON.stringify(rows))
}
function loadPrev() {
  if (M.prev.size) return
  try {
    for (const r of JSON.parse(lsGet(LS_SUM) || '[]').slice(-30)) {
      M.prev.set(r.k, { label: r.label, screen: r.screen, scene: r.scene, docks: r.docks, helpers: r.helpers, secs: r.secs, frames: { n: r.f[0], p50: r.f[1], p95: r.f[2], max: 0, dropped: r.f[3] }, input: { n: r.i[0], p50: 0, p95: r.i[1], max: 0 }, lag: { n: r.l[0], p50: 0, p95: r.l[1], max: 0 }, glitches: r.g, longTasks: { n: r.lt, maxMs: 0, totalMs: 0 }, heapMB: r.h, looperLag: 0, oscPerSec: 0 })
    }
  } catch { /* ignore a bad saved summary */ }
}
function reset() { M.buckets.clear(); M.cur = null; M.sig = ''; M.prev.clear(); lsSet(LS_SUM, '[]'); if (M.on) pollState() }

// ---------- switch ----------
const desired = (): boolean => {
  const f = lsGet(LS_FLAG)
  if (f === '0') return false
  if (f === '1') return import.meta.env.DEV || useProfile.getState().mode === 'dad'
  return import.meta.env.DEV // unset: on in dev, off in the shipped build until a grown-up flips it in Boss mode
}
function sync() { if (desired()) start(); else stop() }
export function setEnabled(on: boolean) { lsSet(LS_FLAG, on ? '1' : '0'); sync() }
export const isEnabled = () => M.on
export const hudWanted = () => lsGet(LS_HUD) === '1'
export const setHudWanted = (on: boolean) => lsSet(LS_HUD, on ? '1' : '0')

export const perfmon = {
  start, stop, reset, snapshot, currentRow, setEnabled, isEnabled, addInput, lastStart, BUDGET,
  report: () => JSON.stringify(snapshot(), null, 2),
  showHud: (on = true) => { setHudWanted(on); window.dispatchEvent(new Event('koog-perf-hud')) },
}
;(window as unknown as { __perfmon?: typeof perfmon }).__perfmon = perfmon

sync()
useProfile.subscribe((s, p) => { if (s.mode !== p.mode) sync() })
window.addEventListener('pagehide', () => { if (M.on) save() })
document.addEventListener('visibilitychange', () => { M.last = 0; M.beatAt = 0; M.wall = 0 })

if (import.meta.hot) { import.meta.hot.data.m = M; import.meta.hot.accept(() => { /* a new copy of this file re-runs sync() above */ }) }
