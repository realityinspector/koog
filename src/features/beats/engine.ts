// Beat engine: Web Audio lookahead scheduler. No React in here.
// Long-lived state lives in import.meta.hot.data so HMR can stop sound cleanly.
import { inKey, SCALES, PC_NAMES, type Key, type ScaleType } from '../../music/theory'
import { useHarmonyStore } from '../../music/harmonyStore'
import { onNote } from '../../music/notes'
import { GROOVES, type Groove } from './grooves'

export const MAX_GAIN = 0.3
export const DEFAULT_GAIN = 0.15
const LOOKAHEAD = 0.12
const TICK_MS = 25
const POCKET_S = 0.08

interface StepMark { time: number; step: number }
interface State {
  version: number
  listeners: Set<() => void>
  ctx: AudioContext | null
  master: GainNode | null
  noise: AudioBuffer | null
  timer: ReturnType<typeof setTimeout> | null
  playing: boolean
  groove: Groove
  bpmAdj: number
  gain: number
  bass: boolean
  chords: boolean
  pent: boolean
  step: number // 0..63
  next: number
  marks: StepMark[]
  prevKey: { key: Key; auto: boolean } | null
  offNote: (() => void) | null
  recent: boolean[] // last in-key notes: true = in the pocket
  combo: number
  noteCount: number
}

const hot = import.meta.hot
const S: State = (hot?.data.beats as State | undefined) ?? {
  version: 0, listeners: new Set(), ctx: null, master: null, noise: null, timer: null,
  playing: false, groove: GROOVES[0], bpmAdj: 0, gain: DEFAULT_GAIN, bass: true, chords: true,
  pent: false, step: 0, next: 0, marks: [], prevKey: null, offNote: null, recent: [], combo: 0, noteCount: 0,
}
if (hot) hot.data.beats = S
// re-resolve groove object from fresh module (data may have changed)
S.groove = GROOVES.find((g) => g.id === S.groove.id) ?? GROOVES[0]

const emit = () => { S.version++; S.listeners.forEach((f) => f()) }
export const subscribe = (f: () => void) => { S.listeners.add(f); return () => { S.listeners.delete(f) } }
export const getVersion = () => S.version
export const getState = () => S

export const bpm = () => S.groove.bpm + S.bpmAdj
export const jamKey = (g: Groove = S.groove, pent = S.pent): Key => {
  if (!pent) return g.key
  const sc = g.key.scale
  const scale: ScaleType = sc === 'major' ? 'majorPentatonic' : sc === 'minor' ? 'minorPentatonic' : sc
  return { tonic: g.key.tonic, scale }
}
export const safeNotes = (k: Key) => SCALES[k.scale].map((o) => PC_NAMES[(k.tonic + o) % 12])

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

// ---- voices ----
function env(ctx: AudioContext, g: GainNode, t: number, peak: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(peak, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  void ctx
}
function noiseSrc(t: number, dur: number) {
  const src = S.ctx!.createBufferSource()
  src.buffer = S.noise
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
  return src
}
function kick(t: number, v: number) {
  const c = S.ctx!, o = c.createOscillator(), g = c.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12)
  env(c, g, t, 0.9 * v, 0.32)
  o.connect(g).connect(S.master!)
  o.start(t); o.stop(t + 0.35)
}
function snare(t: number, v: number) {
  const c = S.ctx!, n = noiseSrc(t, 0.2), f = c.createBiquadFilter(), g = c.createGain()
  f.type = 'highpass'; f.frequency.value = 1200
  env(c, g, t, 0.5 * v, 0.18)
  n.connect(f).connect(g).connect(S.master!)
  const o = c.createOscillator(), og = c.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(220, t)
  o.frequency.exponentialRampToValueAtTime(150, t + 0.08)
  env(c, og, t, 0.35 * v, 0.1)
  o.connect(og).connect(S.master!)
  o.start(t); o.stop(t + 0.12)
}
function hat(t: number, v: number, open: boolean) {
  const c = S.ctx!, dur = open ? 0.22 : 0.045
  const n = noiseSrc(t, dur), f = c.createBiquadFilter(), g = c.createGain()
  f.type = 'highpass'; f.frequency.value = 7500
  env(c, g, t, 0.22 * v, dur)
  n.connect(f).connect(g).connect(S.master!)
}
function clap(t: number, v: number) {
  const c = S.ctx!
  for (const d of [0, 0.011, 0.022]) {
    const n = noiseSrc(t + d, 0.03), f = c.createBiquadFilter(), g = c.createGain()
    f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8
    env(c, g, t + d, 0.4 * v, 0.03)
    n.connect(f).connect(g).connect(S.master!)
  }
  const n = noiseSrc(t + 0.03, 0.14), f = c.createBiquadFilter(), g = c.createGain()
  f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8
  env(c, g, t + 0.03, 0.35 * v, 0.14)
  n.connect(f).connect(g).connect(S.master!)
}
function bassNote(t: number, midi: number, dur: number, v: number) {
  const c = S.ctx!, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain()
  o.type = 'triangle'; o.frequency.value = mtof(midi)
  f.type = 'lowpass'; f.frequency.value = 600
  env(c, g, t, 0.6 * v, dur)
  o.connect(f).connect(g).connect(S.master!)
  o.start(t); o.stop(t + dur + 0.02)
}
function stab(t: number, midis: number[], dur: number, v: number) {
  const c = S.ctx!, f = c.createBiquadFilter(), g = c.createGain()
  f.type = 'lowpass'; f.frequency.value = 1800
  env(c, g, t, 0.12 * v, dur)
  f.connect(g).connect(S.master!)
  for (const m of midis) {
    const o = c.createOscillator()
    o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = (Math.random() - 0.5) * 10
    o.connect(f); o.start(t); o.stop(t + dur + 0.02)
  }
}

const hit = (p: string, i: number) => p[i] !== '.' && p[i] !== undefined

function scheduleStep(step: number, t0: number) {
  const g = S.groove, i = step % 16, bar = Math.floor(step / 16) % 4
  const sd = 60 / bpm() / 4
  const t = t0 + (i % 2 ? g.swing * sd : 0)
  const v = () => 0.85 + Math.random() * 0.15
  if (hit(g.kick, i)) kick(t, v())
  if (hit(g.snare, i)) snare(t, v())
  if (hit(g.clap, i)) clap(t, v())
  if (hit(g.hat, i)) hat(t, g.hat[i] === 'o' ? 0.8 : i % 4 === 0 ? 1 : 0.6 * v(), g.hat[i] === 'o')
  const ch = g.prog[bar]
  if (S.bass && hit(g.bass, i)) {
    let m = 36 + ((g.key.tonic + ch.off) % 12)
    if (g.bass[i] === 'o') m += 12
    if (g.bass[i] === '5') m += 7
    bassNote(t, m, sd * 1.8, v())
  }
  if (S.chords && hit(g.stab, i)) {
    const root = 60 + ((g.key.tonic + ch.off) % 12)
    const iv = ch.q === 'maj' ? [0, 4, 7] : ch.q === 'min' ? [0, 3, 7] : [0, 7, 12]
    stab(t, iv.map((x) => root + x), sd * 1.6, v())
  }
}

function tick() {
  if (!S.playing || !S.ctx) return
  const ctx = S.ctx
  while (S.next < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(S.step, S.next)
    S.marks.push({ time: S.next, step: S.step })
    if (S.marks.length > 48) S.marks.shift()
    S.next += 60 / bpm() / 4
    S.step = (S.step + 1) % 64
  }
  S.timer = setTimeout(tick, TICK_MS)
}

/** Current audible step (0..15 within the bar) or -1. Cheap; called from rAF. */
export function currentStep(): number {
  if (!S.ctx || !S.playing) return -1
  const now = S.ctx.currentTime
  for (let k = S.marks.length - 1; k >= 0; k--) if (S.marks[k].time <= now) return S.marks[k].step
  return -1
}

// ---- jam score ----
function onPlayed(e: { note: number; on: boolean }) {
  if (!e.on || !S.playing || !S.ctx || !S.marks.length) return
  if (!inKey(e.note, jamKey())) return
  const eighth = (60 / bpm()) / 2
  const ref = S.marks[S.marks.length - 1].time
  const ph = (((S.ctx.currentTime - ref) / eighth) % 1 + 1) % 1
  const dist = Math.min(ph, 1 - ph) * eighth
  const ok = dist <= POCKET_S
  S.recent.push(ok); if (S.recent.length > 16) S.recent.shift()
  S.combo = ok ? S.combo + 1 : 0
  S.noteCount++
}
export const pocketPct = () => (S.recent.length ? S.recent.filter(Boolean).length / S.recent.length : 0)

// ---- control ----
function applyKey() {
  useHarmonyStore.getState().setKey(jamKey())
}

export function start() {
  if (S.playing) return
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctor()
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 12
  comp.attack.value = 0.003; comp.release.value = 0.15
  const master = ctx.createGain()
  master.gain.value = 0
  master.gain.setTargetAtTime(Math.min(S.gain, MAX_GAIN), ctx.currentTime, 0.02)
  master.connect(comp).connect(ctx.destination)
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  S.ctx = ctx; S.master = master; S.noise = buf
  void ctx.resume()
  S.step = 0; S.marks = []; S.recent = []; S.combo = 0; S.noteCount = 0
  S.next = ctx.currentTime + 0.08
  const h = useHarmonyStore.getState()
  S.prevKey = { key: h.key, auto: h.autoDetect }
  h.setAutoDetect(false)
  applyKey()
  S.offNote = onNote(onPlayed)
  S.playing = true
  tick()
  emit()
}

export function stop() {
  const was = S.playing
  S.playing = false
  if (S.timer) { clearTimeout(S.timer); S.timer = null }
  S.offNote?.(); S.offNote = null
  const ctx = S.ctx, master = S.master
  S.ctx = null; S.master = null; S.marks = []
  if (ctx && master) {
    try {
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.01)
    } catch { /* ignore */ }
    setTimeout(() => { try { master.disconnect() } catch { /* ignore */ } void ctx.close().catch(() => {}) }, 120)
  }
  if (S.prevKey) {
    const h = useHarmonyStore.getState()
    h.setKey(S.prevKey.key); h.setAutoDetect(S.prevKey.auto)
    S.prevKey = null
  }
  if (was) emit()
}

export function setGroove(id: string) {
  const g = GROOVES.find((x) => x.id === id)
  if (!g) return
  S.groove = g; S.bpmAdj = 0; S.recent = []; S.combo = 0
  if (S.playing) applyKey()
  emit()
}
export function setBpmAdj(n: number) { S.bpmAdj = Math.max(-20, Math.min(20, n)); emit() }
export function setGain(v: number) {
  S.gain = Math.max(0, Math.min(MAX_GAIN, v))
  if (S.ctx && S.master) S.master.gain.setTargetAtTime(S.gain, S.ctx.currentTime, 0.03)
  emit()
}
export function setLayer(which: 'bass' | 'chords', on: boolean) { S[which] = on; emit() }
export function setPent(on: boolean) { S.pent = on; if (S.playing) applyKey(); S.recent = []; emit() }

// ---- lifecycle ----
const onHide = () => stop()
;(hot?.data.beatsOffHide as (() => void) | undefined)?.()
window.addEventListener('pagehide', onHide)
if (hot) {
  hot.data.beatsOffHide = () => window.removeEventListener('pagehide', onHide)
  hot.dispose(() => { stop(); window.removeEventListener('pagehide', onHide) })
  hot.accept()
}
