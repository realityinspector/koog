// Smart Band engine: its own tiny Web Audio synth + lookahead scheduler. No React in here.
// Safety: hard master cap, limiter, short ramps, max 6 voices, every voice has a scheduled stop.
// Long-lived state lives in import.meta.hot.data so HMR can silence it cleanly.
import { useAudioSettings, outputScale } from '../../music/audioSettings'
import { useHarmonyStore } from '../../music/harmonyStore'
import { onNote } from '../../music/notes'
import {
  DEFAULT_BPM, estimateBpm, parseChordName, pickChord, sameChord, weighMelody,
  type Chord,
} from './harmonizer'

export type BandStyle = 'chill' | 'pop' | 'groove'
export const STYLES: { id: BandStyle; label: string; hint: string }[] = [
  { id: 'chill', label: 'Chill', hint: 'pad only' },
  { id: 'pop', label: 'Pop', hint: 'pad + bass' },
  { id: 'groove', label: 'Groove', hint: 'pad + bass + drums' },
]

export const MASTER_CAP = 0.12 // hard ceiling on the master gain, whatever the slider says
export const MAX_VOICES = 6
const LOOKAHEAD = 0.1 // seconds booked ahead
const TICK_MS = 25
const IDLE_MS = 4000
const RAMP = 0.012 // short ramp, no clicks

interface Voice { end: number }
interface State {
  version: number
  listeners: Set<() => void>
  on: boolean
  style: BandStyle
  volume: number // 0..1 of the cap
  ctx: AudioContext | null
  master: GainNode | null
  fade: GainNode | null
  noise: AudioBuffer | null
  timer: ReturnType<typeof setTimeout> | null
  offNote: (() => void) | null
  voices: Voice[]
  step: number // eighth note within the bar, 0..7
  next: number // ctx time of that step
  chord: Chord | null
  bpm: number
  onsets: number[] // performance.now() of note starts
  notes: { note: number; at: number }[]
  lastPlayed: number
  idle: boolean
}

const hot = import.meta.hot
const S: State = (hot?.data.smartband as State | undefined) ?? {
  version: 0, listeners: new Set(), on: false, style: 'pop', volume: 0.6, ctx: null, master: null, fade: null,
  noise: null, timer: null, offNote: null, voices: [], step: 0, next: 0, chord: null, bpm: DEFAULT_BPM,
  onsets: [], notes: [], lastPlayed: 0, idle: true,
}
if (hot) hot.data.smartband = S

const emit = () => { S.version++; S.listeners.forEach((f) => f()) }
export const subscribe = (f: () => void) => { S.listeners.add(f); return () => { S.listeners.delete(f) } }
export const getVersion = () => S.version
export const getState = () => S

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const masterLevel = () => Math.min(MASTER_CAP, Math.max(0, S.volume) * MASTER_CAP) * outputScale()

// ---- voice budget: a note only plays if there's room (stuck-note guard: every voice also has a hard stop) ----
function reserve(t: number, end: number, n = 1): boolean {
  S.voices = S.voices.filter((v) => v.end > t)
  if (S.voices.length + n > MAX_VOICES) return false
  for (let i = 0; i < n; i++) S.voices.push({ end })
  return true
}

// ---- voices ----
function pad(t: number, dur: number, chord: Chord) {
  const c = S.ctx!
  if (!reserve(t, t + dur + 0.05, 3)) return
  const base = 55 + ((chord.root - 55) % 12 + 12) % 12
  const mids = [base, base + (chord.quality === 'maj' ? 4 : 3), base + (chord.quality === 'dim' ? 6 : 7)]
  const f = c.createBiquadFilter(), g = c.createGain()
  f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.5
  const atk = Math.min(0.7, dur * 0.35), rel = Math.min(0.3, dur * 0.2)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.45, t + atk) // slow attack
  g.gain.setValueAtTime(0.45, t + dur - rel)
  g.gain.linearRampToValueAtTime(0, t + dur)
  f.connect(g).connect(S.fade!)
  mids.forEach((m, i) => {
    const o = c.createOscillator(), og = c.createGain()
    o.type = i === 1 ? 'triangle' : 'sawtooth'
    o.frequency.value = mtof(m); o.detune.value = (i - 1) * 6
    og.gain.value = 0.33
    o.connect(og).connect(f)
    o.start(t); o.stop(t + dur + 0.05)
  })
}
function bass(t: number, midi: number, dur: number, peak: number) {
  const c = S.ctx!
  if (!reserve(t, t + dur + 0.05)) return
  const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain()
  o.type = 'triangle'; o.frequency.value = mtof(midi)
  f.type = 'lowpass'; f.frequency.value = 500
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + 0.01)
  g.gain.linearRampToValueAtTime(0, t + dur)
  o.connect(f).connect(g).connect(S.fade!)
  o.start(t); o.stop(t + dur + 0.05)
}
function kick(t: number) {
  const c = S.ctx!
  if (!reserve(t, t + 0.25)) return
  const o = c.createOscillator(), g = c.createGain()
  o.frequency.setValueAtTime(130, t)
  o.frequency.exponentialRampToValueAtTime(48, t + 0.1)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.55, t + 0.006)
  g.gain.linearRampToValueAtTime(0, t + 0.22)
  o.connect(g).connect(S.fade!)
  o.start(t); o.stop(t + 0.25)
}
function hat(t: number) {
  const c = S.ctx!
  if (!S.noise || !reserve(t, t + 0.06)) return
  const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
  n.buffer = S.noise
  f.type = 'highpass'; f.frequency.value = 7000
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.12, t + 0.004)
  g.gain.linearRampToValueAtTime(0, t + 0.05)
  n.connect(f).connect(g).connect(S.fade!)
  n.start(t, Math.random() * 0.5); n.stop(t + 0.06)
}

// ---- brain glue ----
function decideChord(): Chord {
  const h = useHarmonyStore.getState()
  const held = h.chord ? parseChordName(h.chord) : null
  if (held) return held // she is playing a chord: follow it exactly
  const beat = 60000 / S.bpm, now = performance.now()
  let recent = S.notes.filter((n) => now - n.at <= 4 * beat) // fall back to a wider window if she is slow
  const near = recent.filter((n) => now - n.at <= 2 * beat)
  if (near.length >= 1) recent = near
  const melody = weighMelody(recent.map((n) => ({ note: n.note, ageBeats: (now - n.at) / beat })))
  return pickChord(melody, h.key, S.chord, true) // we only call this on a downbeat
}

function onPlayed(e: { note: number; on: boolean }) {
  if (!e.on || !S.on) return
  const now = performance.now()
  S.lastPlayed = now
  S.onsets.push(now); if (S.onsets.length > 24) S.onsets.shift()
  S.notes.push({ note: e.note, at: now }); if (S.notes.length > 32) S.notes.shift()
  const b = estimateBpm(S.onsets, S.bpm)
  if (b !== S.bpm) { S.bpm = b; emit() }
}

function setIdle(idle: boolean) {
  if (idle === S.idle || !S.ctx || !S.fade) return
  S.idle = idle
  const t = S.ctx.currentTime
  S.fade.gain.cancelScheduledValues(t)
  S.fade.gain.setValueAtTime(S.fade.gain.value, t)
  S.fade.gain.linearRampToValueAtTime(idle ? 0 : 1, t + (idle ? 1.6 : 0.5)) // polite fade out, quick fade in
  if (!idle) { S.step = 0; S.next = t + 0.08 } // come back in on a fresh downbeat
  emit()
}

function scheduleStep(step: number, t: number) {
  const eighth = 60 / S.bpm / 2
  if (step === 0) {
    const c = decideChord()
    if (!sameChord(c, S.chord) || !S.chord) { S.chord = c; emit() }
    pad(t, eighth * 8, c)
  }
  const c = S.chord
  if (!c) return
  if (S.style !== 'chill') {
    const root = 36 + c.root // C2..B2
    if (step === 0 || step === 4) bass(t, root, eighth * 3.4, 0.7)
    else if (step === 7) bass(t, root + 12, eighth * 0.9, 0.4) // octave pop on the "and" of 4
  }
  if (S.style === 'groove') {
    if (step === 0 || step === 4) kick(t)
    if (step % 2 === 1) hat(t)
  }
}

function tick() {
  if (!S.on || !S.ctx) return
  const ctx = S.ctx
  if (S.lastPlayed > 0 && performance.now() - S.lastPlayed >= IDLE_MS) setIdle(true)
  else if (S.lastPlayed > 0 && S.idle) setIdle(false)
  if (!S.idle) {
    if (S.next < ctx.currentTime - 0.25) { S.next = ctx.currentTime + 0.05; S.step = 0 } // timers were throttled: resync
    while (S.next < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(S.step, S.next)
      S.next += 60 / S.bpm / 2
      S.step = (S.step + 1) % 8
    }
  }
  S.timer = setTimeout(tick, TICK_MS)
}

// ---- control ----
/** Call from a user click. Creates the AudioContext. */
export function start() {
  if (S.on) return
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -18; limiter.knee.value = 6; limiter.ratio.value = 20
    limiter.attack.value = 0.003; limiter.release.value = 0.1
    const master = ctx.createGain()
    master.gain.value = 0
    master.gain.linearRampToValueAtTime(masterLevel(), ctx.currentTime + 0.05)
    const fade = ctx.createGain()
    fade.gain.value = 0
    fade.connect(master).connect(limiter).connect(ctx.destination)
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    Object.assign(S, { ctx, master, fade, noise: buf, voices: [], step: 0, chord: null, onsets: [], notes: [],
      lastPlayed: 0, idle: true, on: true, next: ctx.currentTime + 0.08 })
    void ctx.resume().catch(() => {})
    S.offNote = onNote(onPlayed)
    tick()
    emit()
  } catch { panic() }
}

/** Silence everything now and release the audio device. Safe to call any time. */
export function panic() {
  const was = S.on
  S.on = false
  if (S.timer) { clearTimeout(S.timer); S.timer = null }
  S.offNote?.(); S.offNote = null
  const ctx = S.ctx, master = S.master
  S.ctx = null; S.master = null; S.fade = null; S.noise = null; S.voices = []; S.chord = null; S.idle = true
  if (ctx && master) {
    try {
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03)
    } catch { /* ignore */ }
    setTimeout(() => { try { master.disconnect() } catch { /* ignore */ } void ctx.close().catch(() => {}) }, 120)
  }
  if (was) emit()
}

export function toggle() { if (S.on) panic(); else start() }
export function setStyle(s: BandStyle) { S.style = s; emit() }
export function setVolume(v: number) {
  S.volume = Math.max(0, Math.min(1, v))
  if (S.ctx && S.master) {
    const t = S.ctx.currentTime
    S.master.gain.cancelScheduledValues(t)
    S.master.gain.setValueAtTime(S.master.gain.value, t)
    S.master.gain.linearRampToValueAtTime(masterLevel(), t + 0.05)
  }
  emit()
}

// ---- lifecycle ----
const onHide = () => panic()
;(hot?.data.smartbandOffHide as (() => void) | undefined)?.()
window.addEventListener('pagehide', onHide)
if (hot) {
  hot.data.smartbandOffHide = () => window.removeEventListener('pagehide', onHide)
  const offSettings = useAudioSettings.subscribe(() => {
    if (S.ctx && S.master) S.master.gain.setTargetAtTime(masterLevel(), S.ctx.currentTime, 0.03)
  })
  hot.dispose(() => { offSettings(); panic(); window.removeEventListener('pagehide', onHide) })
}

if (import.meta.hot) { import.meta.hot.accept() }
