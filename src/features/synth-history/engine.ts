// Moog-style subtractive synth engine. SAFETY: master hard cap 0.15, limiter, Q clamp, stuck-note guard.
import { DEFAULT_PARAMS, type SynthEngine, type SynthParams, type Wave } from './params'

export const MASTER_CAP = 0.15
export const MAX_VOICES = 8
export const MAX_Q = 20 // biquad Q is in dB: 20 dB = ~10x peak
const STUCK_MS = 8000
const WAVES: Wave[] = ['sawtooth', 'square', 'triangle', 'sine']

interface Voice {
  note: number; oscs: OscillatorNode[]; f1: BiquadFilterNode; f2: BiquadFilterNode; cut: ConstantSourceNode; vca: GainNode
  t: number; released: boolean; timer: number; vel: number
}
interface Shared { ctx?: AudioContext; master?: GainNode; analyser?: AnalyserNode; voices: Voice[]; stack: number[]; params: SynthParams; subs?: Set<(p: SynthParams) => void> }

const hot = import.meta.hot
const S: Shared = hot ? (hot.data.synth ??= { voices: [], stack: [], params: { ...DEFAULT_PARAMS } }) : { voices: [], stack: [], params: { ...DEFAULT_PARAMS } }

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo)
const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12)
/** Lower voice gain as Q rises so resonance can't get loud. */
const qComp = (q: number) => 1 / (1 + q / 4)

function sanitize(p: SynthParams): SynthParams {
  return {
    wave: WAVES.includes(p.wave) ? p.wave : 'sawtooth',
    detune: clamp(p.detune, -50, 50),
    cutoff: clamp(p.cutoff, 40, 12000),
    resonance: clamp(p.resonance, 0.1, MAX_Q),
    filterEnv: clamp(p.filterEnv, 0, 8000),
    attack: clamp(p.attack, 0.002, 4),
    decay: clamp(p.decay, 0.005, 4),
    sustain: clamp(p.sustain, 0, 1),
    release: clamp(p.release, 0.01, 4),
    glide: clamp(p.glide, 0, 0.5),
    level: clamp(p.level, 0, 1),
  }
}
S.params = sanitize(S.params)
S.subs ??= new Set()

const applyLevel = () => {
  if (!S.ctx || !S.master) return
  S.master.gain.setTargetAtTime(MASTER_CAP * S.params.level, S.ctx.currentTime, 0.02)
}

function release(v: Voice, fast = false) {
  const c = S.ctx
  if (!c || (v.released && !fast)) return
  v.released = true
  clearTimeout(v.timer)
  const t = c.currentTime, r = fast ? 0.025 : S.params.release
  v.vca.gain.cancelScheduledValues(t)
  v.vca.gain.setValueAtTime(v.vca.gain.value, t)
  v.vca.gain.linearRampToValueAtTime(0, t + r)
  v.cut.offset.cancelScheduledValues(t)
  v.cut.offset.setValueAtTime(v.cut.offset.value, t)
  for (const o of v.oscs) { try { o.stop(t + r + 0.03) } catch { /* already stopped */ } }
  try { v.cut.stop(t + r + 0.03) } catch { /* already stopped */ }
  window.setTimeout(() => {
    S.voices = S.voices.filter(x => x !== v)
    try { v.vca.disconnect() } catch { /* noop */ }
  }, (r + 0.15) * 1000)
}

function ensureGraph() {
  if (S.ctx) return
  const ctx = new AudioContext({ latencyHint: 'interactive' })
  const master = ctx.createGain(); master.gain.value = 0
  const lim = ctx.createDynamicsCompressor()
  lim.threshold.value = -18; lim.knee.value = 6; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.15
  const an = ctx.createAnalyser(); an.fftSize = 1024
  master.connect(lim); lim.connect(an); lim.connect(ctx.destination)
  S.ctx = ctx; S.master = master; S.analyser = an
}

function peakCutoff(p: SynthParams) { return clamp(p.cutoff + p.filterEnv, 40, 16000) }

function startEnv(v: Voice) {
  const c = S.ctx!, p = S.params, t = c.currentTime
  const amp = (0.25 + 0.75 * v.vel) * qComp(p.resonance) * 0.5
  const g = v.vca.gain
  g.cancelScheduledValues(t); g.setValueAtTime(0, t)
  g.linearRampToValueAtTime(amp, t + p.attack)
  g.setTargetAtTime(amp * p.sustain, t + p.attack, p.decay / 3)
  const f = v.cut.offset
  f.cancelScheduledValues(t); f.setValueAtTime(p.cutoff, t)
  f.linearRampToValueAtTime(peakCutoff(p), t + Math.max(0.003, p.attack))
  f.setTargetAtTime(p.cutoff, t + p.attack, p.decay / 3)
}

function makeVoice(note: number, vel: number): Voice {
  const c = S.ctx!, p = S.params, t = c.currentTime
  const o1 = c.createOscillator(), o2 = c.createOscillator()
  o1.type = o2.type = p.wave
  o1.frequency.value = hz(note); o2.frequency.value = hz(note); o2.detune.value = p.detune
  const m = c.createGain(); m.gain.value = 0.5 // two oscillators sum to <= 1.0
  const f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter()
  f1.type = f2.type = 'lowpass'
  f1.Q.value = p.resonance; f2.Q.value = 0.707 // second stage: no resonance, just 24 dB/oct slope
  f1.frequency.value = 0; f2.frequency.value = 0
  const cut = c.createConstantSource(); cut.offset.value = p.cutoff
  cut.connect(f1.frequency); cut.connect(f2.frequency); cut.start(t)
  const vca = c.createGain(); vca.gain.value = 0
  o1.connect(m); o2.connect(m); m.connect(f1); f1.connect(f2); f2.connect(vca); vca.connect(S.master!)
  o1.start(t); o2.start(t)
  const v: Voice = { note, oscs: [o1, o2], f1, f2, cut, vca, t: performance.now(), released: false, timer: 0, vel }
  v.timer = window.setTimeout(() => release(v), STUCK_MS)
  return v
}

const synth: SynthEngine = {
  get params() { return S.params },
  get ready() { return !!S.ctx && S.ctx.state === 'running' },
  setParams(p) {
    S.params = sanitize({ ...S.params, ...p })
    applyLevel()
    for (const fn of [...S.subs!]) { try { fn(S.params) } catch { /* listener error: ignore */ } }
    const c = S.ctx; if (!c) return
    const t = c.currentTime
    for (const v of S.voices) {
      v.oscs.forEach(o => { o.type = S.params.wave })
      v.oscs[1].detune.setTargetAtTime(S.params.detune, t, 0.02)
      v.f1.Q.setTargetAtTime(S.params.resonance, t, 0.02)
      if (v.released) continue
      v.cut.offset.cancelScheduledValues(t)
      v.cut.offset.setTargetAtTime(S.params.cutoff, t, 0.05)
    }
  },
  async unlock() {
    ensureGraph()
    if (S.ctx!.state !== 'running') await S.ctx!.resume()
    applyLevel()
  },
  analyser: () => S.analyser ?? null,
  onParams(fn) { S.subs!.add(fn); return () => { S.subs!.delete(fn) } },
  noteOn(note, velocity) {
    const c = S.ctx
    if (!c || !S.master || c.state !== 'running' || note < 0 || note > 127) return
    const vel = clamp(velocity, 1, 127) / 127
    const p = S.params
    S.stack = S.stack.filter(n => n !== note); S.stack.push(note)
    if (p.glide > 0) { // mono legato with portamento
      const cur = S.voices.find(v => !v.released)
      if (cur) {
        for (const v of S.voices) if (v !== cur) release(v, true)
        const t = c.currentTime
        for (const o of cur.oscs) { o.frequency.cancelScheduledValues(t); o.frequency.setTargetAtTime(hz(note), t, p.glide / 3) }
        cur.note = note
        clearTimeout(cur.timer); cur.timer = window.setTimeout(() => release(cur), STUCK_MS)
        return
      }
    }
    const same = S.voices.find(v => v.note === note && !v.released)
    if (same) release(same, true)
    while (S.voices.filter(v => !v.released).length >= MAX_VOICES) {
      const oldest = S.voices.filter(v => !v.released).sort((a, b) => a.t - b.t)[0]
      release(oldest, true)
    }
    const v = makeVoice(note, vel)
    S.voices.push(v)
    startEnv(v)
  },
  noteOff(note) {
    S.stack = S.stack.filter(n => n !== note)
    const c = S.ctx; if (!c) return
    if (S.params.glide > 0) {
      const cur = S.voices.find(v => !v.released)
      if (!cur) return
      const back = S.stack[S.stack.length - 1]
      if (back !== undefined) {
        if (cur.note !== back) {
          const t = c.currentTime
          for (const o of cur.oscs) { o.frequency.cancelScheduledValues(t); o.frequency.setTargetAtTime(hz(back), t, S.params.glide / 3) }
          cur.note = back
        }
      } else release(cur)
      return
    }
    for (const v of S.voices) if (v.note === note && !v.released) release(v)
  },
  panic() {
    S.stack = []
    for (const v of [...S.voices]) release(v, true)
  },
}

export function getSynth(): SynthEngine { return synth }

if (import.meta.hot) {
  import.meta.hot.dispose(() => synth.panic())
}
if (import.meta.hot) { import.meta.hot.accept() }
