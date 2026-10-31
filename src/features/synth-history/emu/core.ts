// Audio plumbing shared by every emulator: lazy AudioContext (only inside a user gesture), a master gain with the
// 0.15 peak cap x the app volume/mute, a limiter, and a dev peak meter. One Engine per open panel.
import { outputScale, useAudioSettings } from '../../../music/audioSettings'
import { emitEmuSet, registerEngine, unregisterEngine } from './bus'
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
  dispose(): void
}

export function createEngine(spec: EmuSpec): Engine {
  const P: Params = {}
  for (const c of spec.ctls) P[c.key] = c.def
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let an: AnalyserNode | null = null
  let voice: Voice | null = null
  let dead = false
  const held = new Set<number>()
  const buf = new Float32Array(1024)
  const applyGain = () => { if (ctx && master) master.gain.setTargetAtTime(EMU_CAP * outputScale(), ctx.currentTime, 0.03) }
  const unsub = useAudioSettings.subscribe(applyGain)
  const onBlur = () => eng.allOff()
  window.addEventListener('blur', onBlur)

  async function unlock() {
    if (dead) return
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC({ latencyHint: 'interactive' })
      master = ctx.createGain(); master.gain.value = 0
      const lim = ctx.createDynamicsCompressor()
      lim.threshold.value = -14; lim.knee.value = 6; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.15
      an = ctx.createAnalyser(); an.fftSize = 1024
      const inp = ctx.createGain(); inp.gain.value = 1
      inp.connect(lim); lim.connect(master); master.connect(ctx.destination); master.connect(an)
      voice = spec.make({ ctx, out: inp }, P)
      applyGain()
    }
    if (ctx.state !== 'running') await ctx.resume()
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
    dispose() {
      dead = true
      unregisterEngine(eng)
      held.clear()
      try { voice?.allOff(); voice?.dispose() } catch { /* ignore */ }
      unsub(); window.removeEventListener('blur', onBlur)
      const c = ctx; const m = master
      if (c && m) { m.gain.cancelScheduledValues(c.currentTime); m.gain.setTargetAtTime(0, c.currentTime, 0.02); setTimeout(() => { void c.close().catch(() => {}) }, 250) }
      ctx = null; voice = null
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
let noiseBuf: AudioBuffer | null = null
let noiseCtx: AudioContext | null = null
export function noise(ctx: AudioContext) {
  if (noiseBuf && noiseCtx === ctx) return noiseBuf
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  noiseCtx = ctx
  return noiseBuf
}
