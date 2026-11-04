// Stompbox effects for the Pedalboard. Each one is a small Web Audio graph: make(ctx) -> { input, output, set(knobs), dispose }.
// Knobs are always 0..1. Every effect keeps its own gain safe: feedback is capped below runaway, the fuzz is level-compensated,
// and the board's soft ceiling (boardEngine) stops anything from passing +-1 before the channel cap and the host limiter.
// Octave and Looper are not audio graphs: they act on notes / on the looper (see boardEngine).
export interface Knob { id: string; label: string; def: number }
export interface FxNode { input: AudioNode; output: AudioNode; set(k: number[], o: FxOpts): void; dispose(): void }
export interface FxOpts { bpm: number; sync: boolean }
export interface PedalDef {
  id: string; name: string; icon: string; color: string
  /** what it does / where you have heard it (no brand names) */
  blurb: string
  knobs: Knob[]
  kind: 'audio' | 'octave' | 'looper'
  make?: (ctx: BaseAudioContext) => FxNode
}

const T = 0.012 // setTargetAtTime constant: ~35 ms to settle, so knob moves never click
const ramp = (p: AudioParam, v: number, ctx: BaseAudioContext) => p.setTargetAtTime(v, ctx.currentTime, T)
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1)
const expo = (a: number, b: number, t: number) => a * Math.pow(b / a, clamp(t, 0, 1))
function lfo(ctx: BaseAudioContext, type: OscillatorType = 'sine') { const o = ctx.createOscillator(); o.type = type; o.start(); return o }

/** Soft ceiling: unity gain below 0.8, then rolls smoothly to 1.0. Output can never exceed +-1. */
export function ceilingCurve(): Float32Array<ArrayBuffer> {
  const n = 4097, c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x)
    const y = a <= 0.8 ? a : 0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2)
    c[i] = Math.sign(x) * y
  }
  return c
}

function fuzz(ctx: BaseAudioContext): FxNode {
  const input = ctx.createGain(), pre = ctx.createGain(), shp = ctx.createWaveShaper(), tone = ctx.createBiquadFilter(), post = ctx.createGain(), hp = ctx.createBiquadFilter()
  const n = 2049, c = new Float32Array(n)
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(3 * x) / Math.tanh(3) + 0.1 * Math.sin(5 * x) * (1 - Math.abs(x)) }
  shp.curve = c; shp.oversample = '4x'
  hp.type = 'highpass'; hp.frequency.value = 60; tone.type = 'lowpass'; tone.Q.value = 0.5
  input.connect(hp); hp.connect(pre); pre.connect(shp); shp.connect(tone); tone.connect(post)
  return {
    input, output: post,
    set([drive, toneK, level]) {
      ramp(pre.gain, lerp(1.5, 14, drive), ctx)
      ramp(tone.frequency, expo(700, 7000, toneK), ctx)
      // level compensation: more drive = louder clipping, so the output trim falls as drive rises (peak stays near 0.45 at any drive)
      ramp(post.gain, (0.16 + 0.22 * level) / (1 + drive * 0.5), ctx)
    },
    dispose() { try { input.disconnect(); post.disconnect() } catch { /* gone */ } },
  }
}

const SYNC_BEATS = [0.25, 0.5, 0.75, 1, 1.5, 2] // 1/16, 1/8, dotted 1/8, 1/4, dotted 1/4, 1/2
function echo(ctx: BaseAudioContext): FxNode {
  const input = ctx.createGain(), out = ctx.createGain(), dl = ctx.createDelay(2), fb = ctx.createGain(), damp = ctx.createBiquadFilter(), wet = ctx.createGain()
  damp.type = 'lowpass'; damp.frequency.value = 3200
  input.connect(out); input.connect(dl); dl.connect(damp); damp.connect(fb); fb.connect(dl); damp.connect(wet); wet.connect(out)
  return {
    input, output: out,
    set([time, rep, mix], o) {
      const t = o.sync ? (60 / clamp(o.bpm, 40, 240)) * SYNC_BEATS[Math.min(SYNC_BEATS.length - 1, Math.floor(time * SYNC_BEATS.length))] : lerp(0.08, 0.9, time)
      ramp(dl.delayTime, clamp(t, 0.02, 1.9), ctx)
      ramp(fb.gain, lerp(0.05, 0.6, rep), ctx) // feedback never reaches 0.6+: no runaway
      ramp(wet.gain, lerp(0.1, 0.5, mix), ctx)
    },
    dispose() { try { input.disconnect(); out.disconnect() } catch { /* gone */ } },
  }
}

function chorus(ctx: BaseAudioContext): FxNode {
  const input = ctx.createGain(), out = ctx.createGain(), wet = ctx.createGain(), dry = ctx.createGain()
  dry.gain.value = 0.75; input.connect(dry); dry.connect(out); wet.connect(out)
  const voices = [0, 1, 2].map((i) => {
    const d = ctx.createDelay(0.05), l = lfo(ctx), g = ctx.createGain()
    d.delayTime.value = 0.018 + i * 0.006; l.frequency.value = 0.6 + i * 0.23; l.connect(g); g.connect(d.delayTime)
    input.connect(d); d.connect(wet); return { d, l, g }
  })
  return {
    input, output: out,
    set([rate, depth, mix]) {
      voices.forEach((v, i) => { ramp(v.l.frequency, lerp(0.2, 4, rate) * (1 + i * 0.37), ctx); ramp(v.g.gain, lerp(0.0005, 0.005, depth), ctx) })
      ramp(wet.gain, lerp(0.2, 0.7, mix) / 1.9, ctx)
    },
    dispose() { voices.forEach((v) => { try { v.l.stop() } catch { /* ok */ } }); try { input.disconnect(); out.disconnect() } catch { /* gone */ } },
  }
}

function flanger(ctx: BaseAudioContext): FxNode {
  const input = ctx.createGain(), out = ctx.createGain(), d = ctx.createDelay(0.02), fb = ctx.createGain(), wet = ctx.createGain(), l = lfo(ctx), g = ctx.createGain()
  d.delayTime.value = 0.0035; l.connect(g); g.connect(d.delayTime)
  const dry = ctx.createGain(); dry.gain.value = 0.75
  input.connect(dry); dry.connect(out); input.connect(d); d.connect(wet); wet.connect(out); d.connect(fb); fb.connect(d)
  wet.gain.value = 0.5
  return {
    input, output: out,
    set([rate, depth, jet]) {
      ramp(l.frequency, expo(0.08, 3, rate), ctx); ramp(g.gain, lerp(0.0004, 0.0028, depth), ctx)
      ramp(fb.gain, lerp(0, 0.6, jet), ctx) // capped at 0.6
    },
    dispose() { try { l.stop(); input.disconnect(); out.disconnect() } catch { /* gone */ } },
  }
}

function phaser(ctx: BaseAudioContext): FxNode {
  const input = ctx.createGain(), out = ctx.createGain(), fb = ctx.createGain(), wet = ctx.createGain(), l = lfo(ctx)
  const stages = [0, 1, 2, 3].map(() => { const f = ctx.createBiquadFilter(); f.type = 'allpass'; f.frequency.value = 700; f.Q.value = 0.7; return f })
  const g = ctx.createGain()
  stages.forEach((f, i) => { (i ? stages[i - 1] : input).connect(f); l.connect(g) ; g.connect(f.detune) })
  const dry = ctx.createGain(); dry.gain.value = 0.75
  input.connect(dry); dry.connect(out); stages[3].connect(wet); wet.connect(out); stages[3].connect(fb); fb.connect(stages[0])
  wet.gain.value = 0.5
  return {
    input, output: out,
    set([rate, depth, fbk]) {
      ramp(l.frequency, expo(0.1, 4, rate), ctx)
      ramp(g.gain, lerp(300, 1500, depth), ctx) // detune in cents
      ramp(fb.gain, lerp(0, 0.55, fbk), ctx)
    },
    dispose() { try { l.stop(); input.disconnect(); out.disconnect() } catch { /* gone */ } },
  }
}

function tremolo(ctx: BaseAudioContext): FxNode {
  const input = ctx.createGain(), amp = ctx.createGain(), l = lfo(ctx), g = ctx.createGain()
  l.connect(g); g.connect(amp.gain); input.connect(amp)
  return {
    input, output: amp,
    set([rate, depth, shape]) {
      l.type = shape > 0.66 ? 'square' : shape > 0.33 ? 'triangle' : 'sine'
      ramp(l.frequency, expo(0.5, 12, rate), ctx)
      const d = lerp(0.1, 0.9, depth)
      ramp(amp.gain, 1 - d / 2, ctx); ramp(g.gain, d / 2, ctx) // gain swings 1-d .. 1: never louder than the input
    },
    dispose() { try { l.stop(); input.disconnect(); amp.disconnect() } catch { /* gone */ } },
  }
}

function autowah(ctx: BaseAudioContext): FxNode {
  const input = ctx.createGain(), bp = ctx.createBiquadFilter(), out = ctx.createGain(), wah = ctx.createGain(), dryw = ctx.createGain()
  const rect = ctx.createWaveShaper(), smooth = ctx.createBiquadFilter(), sens = ctx.createGain()
  rect.curve = new Float32Array([1, 0.5, 0, 0.5, 1]); smooth.type = 'lowpass'; smooth.frequency.value = 12
  bp.type = 'bandpass'; bp.frequency.value = 400
  input.connect(bp); bp.connect(wah); wah.connect(out); input.connect(dryw); dryw.connect(out) // a little dry sound keeps low notes audible
  input.connect(rect); rect.connect(smooth); smooth.connect(sens); sens.connect(bp.frequency) // the envelope sweeps the filter
  return {
    input, output: out,
    set([sensK, low, q]) {
      ramp(sens.gain, lerp(800, 5000, sensK), ctx)
      ramp(bp.frequency, expo(150, 900, low), ctx)
      ramp(wah.gain, lerp(1.2, 3.4, sensK), ctx); ramp(dryw.gain, lerp(0.3, 0.6, sensK), ctx)
      ramp(bp.Q, lerp(1.5, 6, q), ctx)
    },
    dispose() { try { input.disconnect(); out.disconnect() } catch { /* gone */ } },
  }
}

function compressor(ctx: BaseAudioContext): FxNode {
  const input = ctx.createGain(), c = ctx.createDynamicsCompressor(), mk = ctx.createGain()
  c.knee.value = 12; c.attack.value = 0.008; c.release.value = 0.2
  input.connect(c); c.connect(mk)
  return {
    input, output: mk,
    set([squeeze, level]) {
      c.threshold.value = lerp(-18, -42, squeeze); c.ratio.value = lerp(3, 12, squeeze)
      // the browser compressor adds automatic makeup gain; trim it (measured) and keep the max <= 1
      ramp(mk.gain, (0.65 + 0.75 * squeeze) * lerp(0.8, 1.1, level), ctx)
    },
    dispose() { try { input.disconnect(); mk.disconnect() } catch { /* gone */ } },
  }
}

/** Generated impulse: stereo exponentially fading noise. */
export function makeImpulse(ctx: BaseAudioContext, seconds: number, tone: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds)), b = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let lp = 0
    const a = lerp(0.05, 0.9, tone) // more tone = brighter tail
    for (let i = 0; i < len; i++) { const w = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); lp += a * (w - lp); d[i] = lp }
  }
  return b
}
function reverb(ctx: BaseAudioContext): FxNode {
  const input = ctx.createGain(), out = ctx.createGain(), conv = ctx.createConvolver(), wet = ctx.createGain(), dry = ctx.createGain()
  conv.normalize = true; conv.buffer = makeImpulse(ctx, 1.8, 0.5)
  input.connect(dry); dry.connect(out); input.connect(conv); conv.connect(wet); wet.connect(out)
  let size = -1, tone = -1, t: ReturnType<typeof setTimeout> | undefined
  return {
    input, output: out,
    set([sz, mix, tn]) {
      const s = Math.round(sz * 8), tt = Math.round(tn * 4)
      if (s !== size || tt !== tone) { size = s; tone = tt; clearTimeout(t); t = setTimeout(() => { conv.buffer = makeImpulse(ctx, lerp(0.6, 3.5, s / 8), tt / 4) }, 120) }
      ramp(wet.gain, lerp(0.15, 1.1, mix), ctx); ramp(dry.gain, 1 - lerp(0, 0.35, mix), ctx)
    },
    dispose() { clearTimeout(t); try { input.disconnect(); out.disconnect() } catch { /* gone */ } },
  }
}

export const PEDALS: PedalDef[] = [
  { id: 'fuzz', name: 'Fuzz', icon: '🔥', color: '#ff6b3d', kind: 'audio', make: fuzz,
    blurb: 'Fuzz squashes the sound into a thick, buzzy wall, like a rock guitar solo.',
    knobs: [{ id: 'drive', label: 'Drive', def: 0.5 }, { id: 'tone', label: 'Tone', def: 0.5 }, { id: 'level', label: 'Level', def: 0.5 }] },
  { id: 'echo', name: 'Echo', icon: '🏔️', color: '#3db9ff', kind: 'audio', make: echo,
    blurb: 'Echo repeats your notes like shouting in a canyon. Sync makes the repeats land on the beat.',
    knobs: [{ id: 'time', label: 'Time', def: 0.35 }, { id: 'rep', label: 'Repeats', def: 0.4 }, { id: 'mix', label: 'Mix', def: 0.4 }] },
  { id: 'chorus', name: 'Chorus', icon: '👯', color: '#6cffa8', kind: 'audio', make: chorus,
    blurb: 'Chorus doubles the sound with a slightly wobbly copy, like a whole choir playing at once.',
    knobs: [{ id: 'rate', label: 'Rate', def: 0.3 }, { id: 'depth', label: 'Depth', def: 0.5 }, { id: 'mix', label: 'Mix', def: 0.5 }] },
  { id: 'flanger', name: 'Jet', icon: '✈️', color: '#c58bff', kind: 'audio', make: flanger,
    blurb: 'Jet sweeps a whooshing comb through the sound, like a plane flying past.',
    knobs: [{ id: 'rate', label: 'Rate', def: 0.25 }, { id: 'depth', label: 'Depth', def: 0.6 }, { id: 'jet', label: 'Jet', def: 0.4 }] },
  { id: 'phaser', name: 'Swirl', icon: '🌀', color: '#ff7ad9', kind: 'audio', make: phaser,
    blurb: 'Swirl makes the sound spin and shimmer, like the sweeping keys in classic space-rock records.',
    knobs: [{ id: 'rate', label: 'Rate', def: 0.3 }, { id: 'depth', label: 'Depth', def: 0.5 }, { id: 'fb', label: 'Swirl', def: 0.3 }] },
  { id: 'tremolo', name: 'Wobble', icon: '〰️', color: '#ffd23d', kind: 'audio', make: tremolo,
    blurb: 'Wobble raises and lowers the volume fast, like the shimmering amp sound in old surf and soul songs.',
    knobs: [{ id: 'rate', label: 'Speed', def: 0.4 }, { id: 'depth', label: 'Depth', def: 0.6 }, { id: 'shape', label: 'Shape', def: 0 }] },
  { id: 'autowah', name: 'Quack', icon: '🦆', color: '#a3e635', kind: 'audio', make: autowah,
    blurb: 'Quack opens and closes a filter as you play harder or softer, the "wah-wah" sound of funky grooves.',
    knobs: [{ id: 'sens', label: 'Touch', def: 0.5 }, { id: 'low', label: 'Low', def: 0.4 }, { id: 'q', label: 'Voice', def: 0.5 }] },
  { id: 'octave', name: 'Octave', icon: '🪜', color: '#5eead4', kind: 'octave',
    blurb: 'Octave adds the same note an octave lower or higher, like a church organ with extra pipes. Choose Down, Up or Both.',
    knobs: [{ id: 'dir', label: 'Down/Up', def: 0 }, { id: 'mix', label: 'Mix', def: 0.6 }] },
  { id: 'comp', name: 'Squeeze', icon: '🗜️', color: '#94a3b8', kind: 'audio', make: compressor,
    blurb: 'Squeeze evens out loud and soft notes, which is how most recorded music gets its steady, polished feel.',
    knobs: [{ id: 'squeeze', label: 'Squeeze', def: 0.5 }, { id: 'level', label: 'Level', def: 0.6 }] },
  { id: 'reverb', name: 'Reverb', icon: '🏛️', color: '#818cf8', kind: 'audio', make: reverb,
    blurb: 'Reverb puts your sound in a room: a small studio, a big hall or an echoing cave.',
    knobs: [{ id: 'size', label: 'Size', def: 0.5 }, { id: 'mix', label: 'Mix', def: 0.4 }, { id: 'tone', label: 'Tone', def: 0.5 }] },
  { id: 'looper', name: 'Looper', icon: '🔁', color: '#f472b6', kind: 'looper',
    blurb: 'Looper is a footswitch for the Looper: tap to record a loop, tap again to play it back, tap to add more layers.',
    knobs: [] },
]
export const pedalDef = (id: string) => PEDALS.find((p) => p.id === id)
export const defaultKnobs = (id: string) => (pedalDef(id)?.knobs ?? []).map((k) => k.def)

export const PRESETS: { id: string; name: string; blurb: string; on: string[]; knobs?: Record<string, number[]>; sync?: boolean; order?: string[] }[] = [
  { id: 'clean', name: 'Clean', blurb: 'Everything off. Just your piano.', on: [] },
  { id: 'rock', name: 'Rock', blurb: 'Squeezed, fuzzy and a little echo.', on: ['comp', 'fuzz', 'echo'], order: ['comp', 'fuzz', 'echo'], knobs: { fuzz: [0.55, 0.5, 0.5], echo: [0.25, 0.25, 0.25], comp: [0.5, 0.6] } },
  { id: 'space', name: 'Space', blurb: 'Beat-synced echoes in a giant hall, with a swirl.', on: ['phaser', 'echo', 'reverb'], sync: true, order: ['phaser', 'echo', 'reverb'], knobs: { echo: [0.5, 0.5, 0.5], reverb: [0.9, 0.6, 0.4], phaser: [0.15, 0.6, 0.35] } },
  { id: 'underwater', name: 'Underwater', blurb: 'Slow wobble, deep chorus and a wet cave.', on: ['tremolo', 'chorus', 'reverb'], order: ['chorus', 'tremolo', 'reverb'], knobs: { tremolo: [0.15, 0.5, 0], chorus: [0.15, 0.9, 0.7], reverb: [0.7, 0.5, 0.15] } },
]
