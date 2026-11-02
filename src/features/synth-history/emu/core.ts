// Audio plumbing shared by every emulator: each engine plugs into the host's shared 'keys' channel (cap 0.15; app volume,
// mute and the limiter live in src/audio/host.ts), keeps its own mixer-trim gain, and a dev peak meter. One Engine per open panel.
import { createChannel, getCtx, getNoise, unlockHost, type Channel } from '../../../audio/host'
import { emitEmuSet, getTrim, onTrim, registerEngine, unregisterEngine } from './bus'
import type { EmuAudio, EmuSpec, Params, Voice } from './types'

export const EMU_CAP = 0.15
export const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12)
export const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo)
export const vel01 = (v: number) => clamp(v / 127, 0.05, 1)

export interface Engine {
  spec: EmuSpec
  P: Params
  noteOn(n: number, v: number): void
  noteOff(n: number): void
  allOff(): void
  unlock(): Promise<void>
  set(key: string, val: number): void
  field(x: number | null, y?: number): void
  voice(): Voice | null
  ctx(): AudioContext | null
  peak(): number
  /** copy the latest output waveform into out (read-only tap for the panel scope); false if no audio yet */
  wave(out: Float32Array<ArrayBuffer>): boolean
  dispose(): void
}

const CEIL = 0.75
let ceil: Float32Array<ArrayBuffer> | null = null
const ceilCurve = () => {
  if (ceil) return ceil
  const n = 2049; ceil = new Float32Array(n)
  for (let i = 0; i < n; i++) { const x = ((i / (n - 1)) * 2 - 1) * 2; ceil[i] = CEIL * Math.tanh(x / CEIL) } 
  return ceil
}
export function createEngine(spec: EmuSpec, opts?: { channel?: Channel }): Engine {
  const P: Params = {}
  for (const c of spec.ctls) P[c.key] = c.def
  let ctx: AudioContext | null = null
  let master: GainNode | null = null // per-engine mixer trim (bus.ts) in front of the channel
  let an: AnalyserNode | null = null // tapped after the trim, before the channel
  let inp: GainNode | null = null
  let voice: Voice | null = null
  let dead = false
  const held = new Set<number>()
  const buf = new Float32Array(1024)
  const applyGain = () => { if (ctx && master) master.gain.setTargetAtTime(getTrim(), ctx.currentTime, 0.03) }
  const unsub = onTrim(applyGain)
  const onBlur = () => eng.allOff()
  window.addEventListener('blur', onBlur)

  async function unlock() {
    if (dead) return
    if (!ctx) {
      const c = getCtx()
      const channel = opts?.channel ?? createChannel('keys', { cap: EMU_CAP, label: 'KEYS' })
      master = c.createGain(); master.gain.value = getTrim()
      an = c.createAnalyser(); an.fftSize = 1024
      inp = c.createGain(); inp.gain.value = 0.5 // the ceiling curve reads input -1..1 as voice level -2..2
      const tap = c.createGain(); tap.gain.value = EMU_CAP // meter/scope at the same scale as the capped output
      // static soft ceiling (replaces the old per-engine compressor): a full chord on any emulator cannot get louder than it was
      const ws = c.createWaveShaper(); ws.curve = ceilCurve(); inp.connect(ws); ws.connect(master)
      master.connect(channel.input); master.connect(tap); tap.connect(an)
      ctx = c
      voice = spec.make({ ctx: c, out: inp }, P)
    }
    if (ctx.state !== 'running') await unlockHost()
    applyGain()
  }
  const eng: Engine = {
    spec, P,
    noteOn(n, v) {
      held.add(n)
      if (voice && ctx?.state === 'running') voice.noteOn(n, v)
      else void unlock().then(() => { if (held.has(n) && !dead) voice?.noteOn(n, v) })
    },
    noteOff(n) { held.delete(n); voice?.noteOff(n) },
    allOff() { held.clear(); voice?.allOff() },
    unlock,
    set(key, val) { P[key] = val; voice?.param?.(key, val); emitEmuSet(eng, key, val) },
    field(x, y) { voice?.field?.(x, y) },
    voice: () => voice,
    ctx: () => ctx,
    peak() {
      if (!an) return 0
      an.getFloatTimeDomainData(buf)
      let m = 0
      for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]))
      return m
    },
    wave(out) { if (!an) return false; an.getFloatTimeDomainData(out); return true },
    dispose() {
      dead = true
      unregisterEngine(eng)
      held.clear()
      try { voice?.allOff(); voice?.dispose() } catch { /* ignore */ }
      unsub(); window.removeEventListener('blur', onBlur)
      const c = ctx; const m = master; const i = inp; const a = an
      if (c && m) { m.gain.cancelScheduledValues(c.currentTime); m.gain.setTargetAtTime(0, c.currentTime, 0.02) }
      // let the release tail fade, then cut every node loose (the shared context stays open)
      setTimeout(() => { for (const n of [i, m, a]) { try { n?.disconnect() } catch { /* noop */ } } }, 250)
      ctx = null; voice = null; master = null; inp = null; an = null
    },
  }
  registerEngine(eng)
  return eng
}

/** Short smooth-saturation curve (soft clip) for warmth. */
export function softClip(amount = 2): Float32Array<ArrayBuffer> {
  const n = 1024; const c = new Float32Array(n)
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * amount) / Math.tanh(amount) }
  return c
}
/** Cascade two lowpass biquads for a 24 dB/oct slope. Returns [input, output, setCutoff, setQ]. */
export function lp24(ctx: AudioContext, cutoff: number, q: number) {
  const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter()
  a.type = b.type = 'lowpass'
  a.frequency.value = b.frequency.value = cutoff
  a.Q.value = clamp(q, 0, 14); b.Q.value = 0.5
  a.connect(b)
  return { input: a as AudioNode, output: b as AudioNode, a, b }
}
/** Record a note envelope timing helper: smooth ADSR on an AudioParam. Returns a release fn. */
export function adsr(p: AudioParam, t: number, peak: number, a: number, d: number, s: number, floor = 0) {
  p.cancelScheduledValues(t); p.setValueAtTime(floor, t)
  p.linearRampToValueAtTime(peak, t + Math.max(0.003, a))
  p.setTargetAtTime(Math.max(floor, peak * s), t + Math.max(0.003, a), Math.max(0.01, d) / 3)
  return (rt: number, r: number) => { p.cancelScheduledValues(rt); p.setValueAtTime(p.value, rt); p.setTargetAtTime(floor, rt, Math.max(0.01, r) / 4) }
}
/** one white-noise buffer per context (shared with the host) */
export const noise = (ctx: AudioContext) => getNoise(ctx)
