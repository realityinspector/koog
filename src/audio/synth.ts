// Safe Web Audio synth: low gain, hard cap, limiter, short envelopes, voice cap, stuck-note guard.
export const MAX_GAIN = 0.4
export const DEFAULT_GAIN = 0.15
export const MAX_VOICES = 16
const STUCK_MS = 8000
const ATTACK = 0.012
const RELEASE = 0.12

interface Voice { osc: OscillatorNode[]; env: GainNode; note: number; t: number; timer: number; released: boolean }
interface Shared { ctx?: AudioContext; master?: GainNode; voices: Map<number, Voice>; sustain: boolean; sustained: Set<number>; level: number; muted: boolean }

import { useAudioSettings, outputScale } from '../music/audioSettings'
const hot = import.meta.hot
const S: Shared = hot ? (hot.data.synth ??= { voices: new Map(), sustain: false, sustained: new Set(), level: DEFAULT_GAIN, muted: false }) : { voices: new Map(), sustain: false, sustained: new Set(), level: DEFAULT_GAIN, muted: false }

const applyGain = () => {
  if (!S.ctx || !S.master) return
  const g = S.muted ? 0 : Math.min(MAX_GAIN, Math.max(0, S.level)) * outputScale()
  S.master.gain.cancelScheduledValues(S.ctx.currentTime)
  S.master.gain.setTargetAtTime(g, S.ctx.currentTime, 0.02)
}

/** Must be called from a user gesture. */
export async function enableAudio() {
  if (!S.ctx) {
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    const master = ctx.createGain()
    master.gain.value = 0
    const lim = ctx.createDynamicsCompressor()
    lim.threshold.value = -18; lim.knee.value = 6; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.15
    master.connect(lim).connect(ctx.destination)
    S.ctx = ctx; S.master = master
  }
  if (S.ctx.state !== 'running') await S.ctx.resume()
  applyGain()
}

export function disableAudio() {
  panic()
  void S.ctx?.suspend()
}

export const audioReady = () => !!S.ctx && S.ctx.state === 'running'
export function setLevel(v: number) { S.level = Math.min(MAX_GAIN, Math.max(0, v)); applyGain() }
export function setMuted(m: boolean) { S.muted = m; applyGain() }
export function latencyInfo() {
  const c = S.ctx
  if (!c) return null
  const ctx = c as AudioContext & { outputLatency?: number }
  return { state: c.state, sampleRate: c.sampleRate, base: c.baseLatency, output: ctx.outputLatency ?? null }
}

function kill(v: Voice, fast = false) {
  const c = S.ctx!
  if (v.released && !fast) return
  v.released = true
  clearTimeout(v.timer)
  const t = c.currentTime, r = fast ? 0.02 : RELEASE
  v.env.gain.cancelScheduledValues(t)
  v.env.gain.setValueAtTime(v.env.gain.value, t)
  v.env.gain.linearRampToValueAtTime(0, t + r)
  for (const o of v.osc) o.stop(t + r + 0.02)
  o_cleanup(v, r)
}
function o_cleanup(v: Voice, r: number) {
  window.setTimeout(() => { if (S.voices.get(v.note) === v) S.voices.delete(v.note); v.env.disconnect() }, (r + 0.1) * 1000)
}

export function noteOn(note: number, velocity: number) {
  const c = S.ctx
  if (!c || !S.master || c.state !== 'running' || note < 0 || note > 127) return
  const old = S.voices.get(note)
  if (old) { kill(old, true); S.voices.delete(note) }
  S.sustained.delete(note)
  if (S.voices.size >= MAX_VOICES) {
    const oldest = [...S.voices.values()].sort((a, b) => a.t - b.t)[0]
    if (oldest) { kill(oldest, true); S.voices.delete(oldest.note) }
  }
  const f = 440 * Math.pow(2, (note - 69) / 12)
  const amp = 0.04 + 0.2 * Math.pow(Math.min(127, Math.max(1, velocity)) / 127, 1.5)
  const env = c.createGain()
  const filt = c.createBiquadFilter()
  filt.type = 'lowpass'; filt.frequency.value = Math.min(3000, f * 6); filt.Q.value = 0.5
  const t = c.currentTime
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(amp, t + ATTACK)
  const o1 = c.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f
  const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2
  const g2 = c.createGain(); g2.gain.value = 0.3
  o1.connect(filt); o2.connect(g2).connect(filt)
  filt.connect(env).connect(S.master)
  o1.start(t); o2.start(t)
  const v: Voice = { osc: [o1, o2], env, note, t: performance.now(), released: false, timer: 0 }
  v.timer = window.setTimeout(() => kill(v), STUCK_MS)
  S.voices.set(note, v)
}

export function noteOff(note: number) {
  const v = S.voices.get(note)
  if (!v) return
  if (S.sustain) S.sustained.add(note)
  else kill(v)
}

export function setSustain(on: boolean) {
  S.sustain = on
  if (!on) { for (const n of S.sustained) { const v = S.voices.get(n); if (v) kill(v) } S.sustained.clear() }
}

export function panic() {
  S.sustain = false; S.sustained.clear()
  if (!S.ctx) return
  for (const v of S.voices.values()) kill(v, true)
}
export const voiceCount = () => S.voices.size

if (import.meta.hot) {
  const offSettings = useAudioSettings.subscribe(() => applyGain())
  import.meta.hot.dispose(() => { offSettings(); panic() })
  import.meta.hot.accept()
}
