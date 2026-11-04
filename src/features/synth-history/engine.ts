// classic subtractive synth engine. SAFETY: the host 'keys' channel hard cap 0.15, the host limiter, Q clamp, stuck-note guard.
// App volume/mute are applied only in src/audio/host.ts; params.level (the Boss KEYS fader) is this engine's own gain in front of the channel.
import { registerPanicTarget } from '../../music/panic'
import { createChannel, getCtx, unlockHost } from '../../audio/host'
// The old private limiter added ~2x makeup gain; keep the Koog synth about as loud as the family is used to
// (full chord ~0.16 vs 0.21 before, still under the shared limiter's threshold and the keys cap).
const KOOG_MAKEUP = 2
import { DEFAULT_PARAMS, type LfoShape, type LfoTarget, type SynthEngine, type SynthParams, type Wave } from './params'

export const MASTER_CAP = 0.15
export const MAX_VOICES = 8
export const MAX_Q = 20 // biquad Q is in dB: 20 dB = ~10x peak
const STUCK_MS = 8000
const WAVES: Wave[] = ['sawtooth', 'square', 'triangle', 'sine']
const LFO_SHAPES: LfoShape[] = ['sine', 'triangle', 'square']
const LFO_TARGETS: LfoTarget[] = ['none', 'pitch', 'filter', 'amp']

interface Voice {
  note: number; oscs: OscillatorNode[]; f1: BiquadFilterNode; f2: BiquadFilterNode; cut: ConstantSourceNode; vca: GainNode; trem?: GainNode
  t: number; released: boolean; timer: number; vel: number
  /** AudioContext time (s) this voice starts sounding (a timed noteOn: a little in the future) */
  at: number
}
interface Lfo { osc: OscillatorNode; pitchG: GainNode; filtG: GainNode; ampG: GainNode }
interface Shared { lfo?: Lfo; ctx?: AudioContext; master?: GainNode; analyser?: AnalyserNode; voices: Voice[]; stack: number[]; params: SynthParams; subs?: Set<(p: SynthParams) => void>
  /** Controller Mode extras: pitch-bend source (cents), sustain-pedal style hold, octave transpose */
  bend?: ConstantSourceNode; bendCents?: number; hold?: boolean; sustained?: Set<number>; trans?: number; tmap?: Map<number, number> }

const hot = import.meta.hot
const S: Shared = hot ? (hot.data.synth ??= { voices: [], stack: [], params: { ...DEFAULT_PARAMS } }) : { voices: [], stack: [], params: { ...DEFAULT_PARAMS } }

/** Timed notes (the looper): while a noteOn / noteOff with a start time runs, every "now" inside it is `shift` seconds later, so the envelope starts on the audio clock. 0 = exactly as before. */
let shift = 0
const tn = (c: AudioContext) => c.currentTime + shift
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
    lfoRate: clamp(p.lfoRate ?? DEFAULT_PARAMS.lfoRate, 0.1, 12),
    lfoShape: LFO_SHAPES.includes(p.lfoShape) ? p.lfoShape : 'sine',
    lfoDepth: clamp(p.lfoDepth ?? 0, 0, 1),
    lfoTarget: LFO_TARGETS.includes(p.lfoTarget) ? p.lfoTarget : 'none',
  }
}
S.params = sanitize(S.params)
S.subs ??= new Set()
S.sustained ??= new Set(); S.tmap ??= new Map(); S.trans ??= 0; S.bendCents ??= 0; S.hold ??= false

const applyLevel = () => {
  if (!S.ctx || !S.master) return
  S.master.gain.setTargetAtTime(S.params.level * KOOG_MAKEUP, S.ctx.currentTime, 0.02)
}

/** One shared LFO feeding three depth-scaled gains. Gains are 0 unless their target is patched. */
function ensureLfo() {
  const c = S.ctx
  if (!c || S.lfo) return
  const osc = c.createOscillator(); osc.frequency.value = S.params.lfoRate
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 30 // softens square edges: no clicks
  const pitchG = c.createGain(), filtG = c.createGain(), ampG = c.createGain()
  pitchG.gain.value = 0; filtG.gain.value = 0; ampG.gain.value = 0
  osc.connect(lp); lp.connect(pitchG); lp.connect(filtG); lp.connect(ampG)
  osc.start()
  S.lfo = { osc, pitchG, filtG, ampG }
  applyLfo()
}

/** one shared constant source summed into every oscillator's detune (cents): the pitch-bend wheel */
function ensureBend() {
  const c = S.ctx
  if (!c || S.bend) return
  const b = c.createConstantSource(); b.offset.value = S.bendCents ?? 0; b.start()
  S.bend = b
}

function applyLfo() {
  const c = S.ctx, l = S.lfo
  if (!c || !l) return
  const p = S.params, t = c.currentTime, on = p.lfoTarget
  l.osc.type = p.lfoShape
  l.osc.frequency.setTargetAtTime(p.lfoRate, t, 0.03)
  l.pitchG.gain.setTargetAtTime(on === 'pitch' ? 50 * p.lfoDepth : 0, t, 0.03) // cents
  l.filtG.gain.setTargetAtTime(on === 'filter' ? p.cutoff * 0.8 * p.lfoDepth : 0, t, 0.03) // Hz
  l.ampG.gain.setTargetAtTime(on === 'amp' ? 0.25 * p.lfoDepth : 0, t, 0.03)
  for (const v of S.voices) if (v.trem) v.trem.gain.setTargetAtTime(on === 'amp' ? 1 - 0.25 * p.lfoDepth : 1, t, 0.03)
}

function release(v: Voice, fast = false) {
  const c = S.ctx
  if (!c || (v.released && !fast)) return
  v.released = true
  clearTimeout(v.timer)
  const t = tn(c), r = fast ? 0.025 : S.params.release
  // a release in the future (timed noteOff) must hold the value the envelope will HAVE at t, not the value it has now
  const hold = (p: AudioParam) => { if (t > c.currentTime + 0.002 && 'cancelAndHoldAtTime' in p) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t) } }
  hold(v.vca.gain)
  v.vca.gain.linearRampToValueAtTime(0, t + r)
  hold(v.cut.offset)
  for (const o of v.oscs) { try { o.stop(t + r + 0.03) } catch { /* already stopped */ } }
  try { v.cut.stop(t + r + 0.03) } catch { /* already stopped */ }
  window.setTimeout(() => {
    S.voices = S.voices.filter(x => x !== v)
    try { v.vca.disconnect() } catch { /* noop */ }
    try { v.trem?.disconnect() } catch { /* noop */ }
    if (S.bend) for (const o of v.oscs) { try { S.bend.disconnect(o.detune) } catch { /* noop */ } }
    const l = S.lfo
    if (l) for (const o of v.oscs) { try { l.pitchG.disconnect(o.detune) } catch { /* noop */ } }
    if (l) for (const f of [v.f1, v.f2]) { try { l.filtG.disconnect(f.frequency) } catch { /* noop */ } }
    try { l?.ampG.disconnect(v.trem!.gain) } catch { /* noop */ }
  }, (r + 0.15 + shift) * 1000)
}

function ensureGraph() {
  const ctx = getCtx()
  if (S.ctx === ctx && S.master) return
  if (S.ctx && S.ctx !== ctx) { // left over from before the shared host (HMR): drop the old private context
    const old = S.ctx
    try { S.master?.gain.cancelScheduledValues(old.currentTime); S.master?.gain.setTargetAtTime(0, old.currentTime, 0.02) } catch { /* noop */ }
    S.voices = []; S.lfo = undefined; S.bend = undefined; S.stack = []
    setTimeout(() => { void old.close().catch(() => {}) }, 300)
  }
  const master = ctx.createGain(); master.gain.value = S.params.level * KOOG_MAKEUP
  const ch = createChannel('keys', { cap: MASTER_CAP, label: 'KEYS' })
  master.connect(ch.input)
  // scope/meter tap at the old post-cap scale (level x 0.15)
  const tap = ctx.createGain(); tap.gain.value = MASTER_CAP
  const an = ctx.createAnalyser(); an.fftSize = 1024
  master.connect(tap); tap.connect(an)
  S.ctx = ctx; S.master = master; S.analyser = an
}

function peakCutoff(p: SynthParams) { return clamp(p.cutoff + p.filterEnv, 40, 16000) }

function startEnv(v: Voice) {
  const c = S.ctx!, p = S.params, t = tn(c)
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
  const c = S.ctx!, p = S.params, t = tn(c)
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
  ensureLfo()
  const trem = c.createGain(); trem.gain.value = p.lfoTarget === 'amp' ? 1 - 0.25 * p.lfoDepth : 1 // can only reduce level
  o1.connect(m); o2.connect(m); m.connect(f1); f1.connect(f2); f2.connect(vca); vca.connect(trem); trem.connect(S.master!)
  const l = S.lfo
  if (l) { l.pitchG.connect(o1.detune); l.pitchG.connect(o2.detune); l.filtG.connect(f1.frequency); l.filtG.connect(f2.frequency); l.ampG.connect(trem.gain) }
  ensureBend()
  if (S.bend) { S.bend.connect(o1.detune); S.bend.connect(o2.detune) }
  o1.start(t); o2.start(t)
  const v: Voice = { note, oscs: [o1, o2], f1, f2, cut, vca, trem, t: performance.now(), released: false, timer: 0, vel, at: t }
  v.timer = window.setTimeout(() => release(v), STUCK_MS)
  return v
}

const synth: SynthEngine = {
  get params() { return S.params },
  get ready() { return !!S.ctx && S.ctx.state === 'running' },
  setParams(p) {
    S.params = sanitize({ ...S.params, ...p })
    applyLevel()
    applyLfo()
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
    if (S.ctx!.state !== 'running') await unlockHost()
    applyLevel()
  },
  analyser: () => S.analyser ?? null,
  onParams(fn) { S.subs!.add(fn); return () => { S.subs!.delete(fn) } },
  noteOn(played, velocity, when) {
    const c = S.ctx
    if (c && when != null && Number.isFinite(when)) shift = clamp(when - c.currentTime, 0, 0.5)
    try { noteOnNow(played, velocity) } finally { shift = 0 }
  },
  noteOff(played, when) {
    const c = S.ctx
    if (c && when != null && Number.isFinite(when)) shift = clamp(when - c.currentTime, 0, 2)
    try { noteOffNow(played) } finally { shift = 0 }
  },
  panic() {
    S.stack = []; S.sustained!.clear(); S.tmap!.clear()
    for (const v of [...S.voices]) release(v, true)
  },
}
function noteOnNow(played: number, velocity: number) {
  {
    const c = S.ctx
    if (!c || !S.master || c.state !== 'running' || played < 0 || played > 127) return
    const note = clamp(played + 12 * (S.trans ?? 0), 0, 127)
    S.tmap!.set(played, note); S.sustained!.delete(note)
    const vel = clamp(velocity, 1, 127) / 127
    const p = S.params
    S.stack = S.stack.filter(n => n !== note); S.stack.push(note)
    if (p.glide > 0) { // mono legato with portamento
      const cur = S.voices.find(v => !v.released)
      if (cur) {
        for (const v of S.voices) if (v !== cur) release(v, true)
        const t = tn(c)
        for (const o of cur.oscs) { o.frequency.cancelScheduledValues(t); o.frequency.setTargetAtTime(hz(note), t, p.glide / 3) }
        cur.note = note
        clearTimeout(cur.timer); cur.timer = window.setTimeout(() => release(cur), STUCK_MS)
        return
      }
    }
    const same = S.voices.find(v => v.note === note && !v.released && (shift === 0 || v.at < tn(c)))
    if (same) release(same, true)
    while (S.voices.filter(v => !v.released).length >= MAX_VOICES) {
      const oldest = S.voices.filter(v => !v.released).sort((a, b) => a.t - b.t)[0]
      release(oldest, true)
    }
    const v = makeVoice(note, vel)
    S.voices.push(v)
    startEnv(v)
  }
}
function noteOffNow(played: number) {
  const note = S.tmap!.get(played) ?? played
  S.tmap!.delete(played)
  if (S.hold) { S.sustained!.add(note); return } // latched: the key is up but the note rings until HOLD is released
  releaseNote(note)
}
/** Cancel every voice of this note right now, including ones scheduled to start a moment from now (the looper's stop / mute / clear / undo). */
export function silenceNote(played: number) {
  const note = clamp(played + 12 * (S.trans ?? 0), 0, 127)
  for (const v of [...S.voices]) if (v.note === note || v.note === played) release(v, true)
}

function releaseNote(note: number) {
  {
    S.stack = S.stack.filter(n => n !== note)
    const c = S.ctx; if (!c) return
    if (S.params.glide > 0) {
      const cur = S.voices.find(v => !v.released)
      if (!cur) return
      const back = S.stack[S.stack.length - 1]
      if (back !== undefined) {
        if (cur.note !== back) {
          const t = tn(c)
          for (const o of cur.oscs) { o.frequency.cancelScheduledValues(t); o.frequency.setTargetAtTime(hz(back), t, S.params.glide / 3) }
          cur.note = back
        }
      } else release(cur)
      return
    }
    for (const v of S.voices) if (v.note === note && !v.released && (shift === 0 || v.at < tn(c))) release(v)
  }
}

export function getSynth(): SynthEngine { return synth }

/** Controller Mode: pitch bend in cents (clamped to +-200). Smoothed, applies to sounding and future voices. */
export function setPitchBend(cents: number) {
  S.bendCents = clamp(cents, -200, 200)
  if (S.ctx && S.bend) S.bend.offset.setTargetAtTime(S.bendCents, S.ctx.currentTime, 0.015)
}
export const getPitchBend = () => S.bendCents ?? 0
/** Controller Mode: latch the notes (like a sustain pedal). Letting go releases everything that was held. */
export function setHold(on: boolean) {
  if (!!S.hold === on) return
  S.hold = on
  if (!on) { const n = [...S.sustained!]; S.sustained!.clear(); for (const note of n) releaseNote(note); if (!S.voices.length) S.stack = [] }
}
export const getHold = () => !!S.hold
/** Controller Mode: shift what the piano plays by whole octaves (-2..+2). Notes already sounding keep their pitch. */
export function setOctave(o: number) { S.trans = clamp(Math.round(o), -2, 2) }
export const getOctave = () => S.trans ?? 0

if (import.meta.hot) {
  import.meta.hot.dispose(() => { synth.panic() })
}
if (import.meta.hot) { import.meta.hot.accept() }
// HMR from the pre-host build: move a live private context onto the shared host right away (the page already has a gesture)
if (S.ctx && S.ctx.state !== 'closed' && S.ctx !== getCtx()) { synth.panic(); ensureGraph(); void unlockHost() }
registerPanicTarget('synth', () => { synth.panic(); setHold(false) })
