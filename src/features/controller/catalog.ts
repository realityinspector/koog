// Controller Mode: what each instrument's knobs MEAN. A "topology" is the list of parameters an instrument has
// (in its own vocabulary: cutoff, drawbars, operator ratios, 303 steps...), the real setters behind them, and the
// default layout that puts them on the DJ controller's physical controls. Pure data + closures: no state here.
// Every continuous param is normalised 0..1; safety caps (resonance, drive, gain) live in each engine and are clamped again here.
import { getSynth, setPitchBend, getPitchBend, setHold, getHold, setOctave, getOctave } from '../synth-history/engine'
import { type LfoShape, type LfoTarget, type SynthParams, type Wave } from '../synth-history/params'
import { EMULATORS, getEmu } from '../synth-history/emu'
import type { Engine } from '../synth-history/emu/core'
import type { Ctl, EmuSpec } from '../synth-history/emu/types'
import { emitSeqChange } from '../synth-history/emu/bus'
import { controlEngine } from '../../music/zones'
import type { Voice303 } from '../synth-history/emu/tb303'

// ---------- the physical (logical-surface) controls, as the calibrated DJ map names them ----------
export const KNOBS = ['hi.A', 'low.A', 'hi.B', 'low.B', 'cuegain', 'mid.A', 'mid.B']
export const FADERS = ['vol.A', 'tempo.A', 'vol.B', 'tempo.B']
export const JOGS = ['jog.A', 'jog.B']
export const PADS_A = ['pad1.A', 'pad2.A', 'pad3.A', 'pad4.A']
export const PADS_B = ['pad1.B', 'pad2.B', 'pad3.B', 'pad4.B']
export const BUTTONS = ['play.A', 'cue.A', 'sync.A', 'play.B', 'cue.B', 'sync.B', 'padmode.A', 'padmode.B']
export type Cls = 'knob' | 'fader' | 'xfade' | 'jog' | 'pad' | 'button'
export const CLASS_OF: Record<string, Cls> = {}
for (const k of KNOBS) CLASS_OF[k] = 'knob'
for (const k of FADERS) CLASS_OF[k] = 'fader'
CLASS_OF.xfade = 'xfade'
for (const k of JOGS) CLASS_OF[k] = 'jog'
for (const k of [...PADS_A, ...PADS_B]) CLASS_OF[k] = 'pad'
for (const k of BUTTONS) CLASS_OF[k] = 'button'
export const ALL_CONTROLS = Object.keys(CLASS_OF)
const NAMES: Record<string, string> = { 'hi.A': 'HI A', 'low.A': 'LOW A', 'hi.B': 'HI B', 'low.B': 'LOW B', cuegain: 'PHONES', 'mid.A': 'MID A', 'mid.B': 'MID B', xfade: 'CROSSFADER',
  'vol.A': 'VOL A', 'tempo.A': 'TEMPO A', 'vol.B': 'VOL B', 'tempo.B': 'TEMPO B', 'jog.A': 'JOG A', 'jog.B': 'JOG B',
  'play.A': 'PLAY A', 'cue.A': 'CUE A', 'sync.A': 'SYNC A', 'play.B': 'PLAY B', 'cue.B': 'CUE B', 'sync.B': 'SYNC B', 'padmode.A': 'MODE A', 'padmode.B': 'MODE B' }
export const physName = (id: string) => NAMES[id] ?? (/^pad(\d)\.([AB])$/.test(id) ? `PAD ${id.slice(-1)}${id[3]}` : id)

// ---------- parameter model ----------
export type PKind = 'cont' | 'pick' | 'action' | 'bend'
export interface Param {
  id: string; label: string; short: string; kind: PKind
  /** pick: number of choices */
  steps?: number
  /** current position 0..1 (bend: -1..1) */
  get?: () => number
  /** set by position 0..1 (bend: -1..1) */
  set?: (x: number) => void
  /** action: pressed */
  press?: () => void
  /** action: is it "on" (lights the pad / button) */
  lit?: () => boolean
  /** the value in words ("1.2 kHz", "Saw") */
  text?: () => string
  /** emulator control key to glow on the faceplate */
  touch?: string
}
export interface Stage { name: string; hint: string; params: string[] }
export interface Topology {
  id: string; name: string
  /** short Moog-style teaching line for this instrument */
  caption: string
  stages: Stage[]
  params: Param[]
  layout: Record<string, string>
}

const cl = (x: number, lo = 0, hi = 1) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo)
interface Scale { to(x: number): number; from(v: number): number }
const lin = (min: number, max: number): Scale => ({ to: (x) => min + (max - min) * x, from: (v) => (max === min ? 0 : (v - min) / (max - min)) })
const log = (min: number, max: number): Scale => ({ to: (x) => min * Math.pow(max / min, x), from: (v) => Math.log(Math.max(v, min) / min) / Math.log(max / min) })
const hzText = (v: number) => (v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz')
const secText = (v: number) => (v < 0.1 ? Math.round(v * 1000) + ' ms' : v.toFixed(2) + ' s')
const num = (v: number) => (Math.abs(v) >= 100 ? String(Math.round(v)) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2))
const pct = (v: number) => Math.round(v * 100) + '%'

// ---------- Koog synth (Moog-style) ----------
export const MOOG_PATCH: Partial<SynthParams> = {
  wave: 'sawtooth', detune: 7, cutoff: 700, resonance: 5, filterEnv: 3500, attack: 0.01, decay: 0.35, sustain: 0.5, release: 0.3,
  glide: 0.04, lfoRate: 5, lfoDepth: 0, lfoTarget: 'none',
}
const sp = () => getSynth().params
function kp(id: string, label: string, short: string, key: keyof SynthParams, sc: Scale, fmt: (v: number) => string, setter?: (v: number) => Partial<SynthParams>): Param {
  return {
    id, label, short, kind: 'cont',
    get: () => cl(sc.from(sp()[key] as number)),
    set: (x) => getSynth().setParams(setter ? setter(sc.to(cl(x))) : ({ [key]: sc.to(cl(x)) } as Partial<SynthParams>)),
    text: () => fmt(sp()[key] as number),
  }
}
const taps: number[] = []
const WAVES: [Wave, string, string][] = [['sawtooth', 'Saw', 'SAW'], ['square', 'Square', 'SQR'], ['triangle', 'Triangle', 'TRI'], ['sine', 'Sine', 'SIN']]
const LFO_TARGETS: LfoTarget[] = ['none', 'pitch', 'filter', 'amp']
const LFO_SHAPES: LfoShape[] = ['sine', 'triangle', 'square']
const koogParams = (): Param[] => [
  kp('cutoff', 'Filter cutoff', 'CUTOFF', 'cutoff', log(40, 12000), hzText),
  kp('resonance', 'Resonance', 'RESO', 'resonance', lin(0.5, 14), num),
  kp('filterEnv', 'Filter envelope amount', 'ENV AMT', 'filterEnv', lin(0, 8000), (v) => Math.round(v) + ' Hz'),
  kp('detune', 'Detune (fat)', 'DETUNE', 'detune', lin(0, 50), (v) => num(v) + ' cents'),
  kp('glide', 'Glide', 'GLIDE', 'glide', lin(0, 0.5), secText),
  kp('lfoRate', 'LFO rate', 'LFO HZ', 'lfoRate', log(0.1, 12), (v) => num(v) + ' Hz'),
  kp('lfoDepth', 'LFO depth', 'LFO AMT', 'lfoDepth', lin(0, 1), pct, (v) => (v > 0.01 && sp().lfoTarget === 'none' ? { lfoDepth: v, lfoTarget: 'pitch' } : { lfoDepth: v })),
  kp('attack', 'Attack', 'ATK', 'attack', log(0.002, 2), secText),
  kp('decay', 'Decay', 'DECAY', 'decay', log(0.01, 2), secText),
  kp('sustain', 'Sustain', 'SUS', 'sustain', lin(0, 1), pct),
  kp('release', 'Release', 'REL', 'release', log(0.01, 3), secText),
  kp('level', 'Volume (capped)', 'LEVEL', 'level', lin(0, 1), pct),
  { id: 'bend', label: 'Pitch bend', short: 'BEND', kind: 'bend', get: () => getPitchBend() / 200, set: (x) => setPitchBend(cl(x, -1, 1) * 200), text: () => Math.round(getPitchBend()) + ' cents' },
  ...WAVES.map(([w, name, short]): Param => ({ id: 'wave=' + w, label: 'Wave: ' + name, short, kind: 'action', press: () => getSynth().setParams({ wave: w }), lit: () => sp().wave === w, text: () => name })),
  ...[-1, 0, 1, 2].map((o): Param => ({ id: 'oct=' + o, label: 'Octave ' + (o > 0 ? '+' : '') + o, short: o > 0 ? '+' + o : String(o), kind: 'action', press: () => setOctave(o), lit: () => getOctave() === o })),
  { id: '@hold', label: 'Hold (latch notes)', short: 'HOLD', kind: 'action', press: () => setHold(!getHold()), lit: () => getHold() },
  { id: '@panic', label: 'Panic (all notes off)', short: 'PANIC', kind: 'action', press: () => { setHold(false); getSynth().panic() } },
  { id: '@tap', label: 'Tap tempo for the LFO', short: 'TAP', kind: 'action', press: () => {
    const now = performance.now()
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0
    taps.push(now); if (taps.length > 5) taps.shift()
    if (taps.length >= 2) { const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1) / 1000; getSynth().setParams({ lfoRate: cl(1 / iv, 0.1, 12) }) }
  } },
  { id: '@lfoTarget', label: 'LFO goes to (pitch / cutoff / volume)', short: 'LFO>', kind: 'action', press: () => getSynth().setParams({ lfoTarget: LFO_TARGETS[(LFO_TARGETS.indexOf(sp().lfoTarget) + 1) % 4] }), lit: () => sp().lfoTarget !== 'none', text: () => sp().lfoTarget },
  { id: '@lfoShape', label: 'LFO shape', short: 'SHAPE', kind: 'action', press: () => getSynth().setParams({ lfoShape: LFO_SHAPES[(LFO_SHAPES.indexOf(sp().lfoShape) + 1) % 3] }), text: () => sp().lfoShape },
  { id: '@moog', label: 'Reset to the Moog-style patch', short: 'MOOG', kind: 'action', press: () => { setHold(false); setOctave(0); getSynth().setParams(MOOG_PATCH) } },
]

// ---------- emulators: params come straight from the EmuSpec controls ----------
const pcache = new Map<string, number>()
const eng = (spec: EmuSpec): Engine | null => { const e = controlEngine(); return e && e.spec.id === spec.id ? e : null }
const quant = (c: Ctl, v: number) => { let q = c.step ? Math.round(v / c.step) * c.step : v; q = cl(q, c.min, c.max); return Number(q.toFixed(4)) }
function ctlScale(c: Ctl): Scale { return c.min > 0 && c.max / c.min > 20 ? log(c.min, c.max) : lin(c.min, c.max) }
const fmtVal = (c: Ctl, v: number) => {
  if (c.key === 'cutoff') return hzText(v)
  if (c.kind === 'pick') return c.opts?.[Math.round(v)] ?? String(v)
  if (/^(a|d|r|attack|rel|decay|mdecay|glide)$/.test(c.key) && c.max <= 4) return secText(v)
  return num(v)
}
const shortOf = (s: string) => s.replace(/[^A-Za-z0-9+\-½ ]/g, '').toUpperCase().slice(0, 6).trim()
/** field (theremin / ribbon) state: pitch across the field and the volume antenna */
const field = { x: 0.5, y: 0 }
function pushField(e: Engine | null) { if (e) e.field(field.y > 0.02 ? field.x : null, field.y) }

/** the hardware never reaches the loudest/harshest end of these (the engines clamp too) */
const SAFE_MAX: Record<string, number> = { drive: 0.8, reso: 12 }
function emuParams(spec: EmuSpec): Param[] {
  const out: Param[] = []
  for (const c0 of spec.ctls) {
    const c: Ctl = SAFE_MAX[c0.key] != null ? { ...c0, max: Math.min(c0.max, SAFE_MAX[c0.key]) } : c0
    const sc = ctlScale(c)
    if (c.kind === 'pick') {
      const n = c.opts?.length ?? 2
      out.push({ id: c.key, label: c.label, short: shortOf(c.label), kind: 'pick', steps: n, touch: c.key,
        get: () => { const e = eng(spec); return e ? cl(e.P[c.key] / Math.max(1, n - 1)) : 0 },
        set: (x) => eng(spec)?.set(c.key, cl(Math.round(cl(x) * (n - 1)), 0, n - 1)),
        text: () => { const e = eng(spec); return e ? fmtVal(c, e.P[c.key]) : '' } })
      ;(c.opts ?? []).forEach((o, i) => out.push({ id: `${c.key}=${i}`, label: `${c.label}: ${o}`, short: shortOf(o), kind: 'action', touch: c.key,
        press: () => eng(spec)?.set(c.key, i), lit: () => Math.round(eng(spec)?.P[c.key] ?? -1) === i, text: () => o }))
    } else {
      out.push({ id: c.key, label: c.label, short: shortOf(c.label), kind: 'cont', touch: c.key,
        get: () => { const e = eng(spec); return e ? cl(sc.from(e.P[c.key])) : 0 },
        set: (x) => eng(spec)?.set(c.key, quant(c, sc.to(cl(x)))),
        text: () => { const e = eng(spec); return e ? fmtVal(c, e.P[c.key]) : '' } })
    }
  }
  const idxKey = 'preset.' + spec.id
  const gotoPreset = (i: number) => {
    const e = eng(spec); const p = spec.presets[i]; if (!e || !p) return
    pcache.set(idxKey, i)
    for (const c of spec.ctls) e.set(c.key, p.values[c.key] ?? c.def)
  }
  const stepPreset = (d: number) => gotoPreset((((pcache.get(idxKey) ?? -1) + d) % spec.presets.length + spec.presets.length) % spec.presets.length)
  out.push({ id: '@preset+', label: 'Next preset', short: 'NEXT', kind: 'action', press: () => stepPreset(1) })
  out.push({ id: '@preset-', label: 'Previous preset', short: 'PREV', kind: 'action', press: () => stepPreset(-1) })
  spec.presets.forEach((p, i) => out.push({ id: '@preset.' + i, label: 'Preset: ' + p.name, short: String(i + 1), kind: 'action', press: () => gotoPreset(i), lit: () => pcache.get(idxKey) === i }))
  out.push({ id: '@panic', label: 'Panic (all notes off)', short: 'PANIC', kind: 'action', press: () => { eng(spec)?.allOff() } })
  if (spec.extra === 'field' && spec.fieldRange) {
    const [lo, hi] = spec.fieldRange
    out.push({ id: 'pitch', label: 'Pitch (hand position)', short: 'PITCH', kind: 'cont', touch: undefined,
      get: () => field.x, set: (x) => { field.x = cl(x); pushField(eng(spec)) },
      text: () => { const n = Math.round(lo + field.x * (hi - lo)); return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n % 12] + (Math.floor(n / 12) - 1) } })
    out.push({ id: 'vol', label: 'Volume (hand near the antenna)', short: 'VOLUME', kind: 'cont',
      get: () => field.y, set: (x) => { field.y = cl(x); pushField(eng(spec)) }, text: () => pct(field.y) })
  }
  if (spec.extra === 'seq303') {
    const seq = () => (eng(spec)?.voice() as Voice303 | null)?.seq
    for (let i = 1; i <= 8; i++) {
      out.push({ id: '@step.' + i, label: `Sequencer step ${i} (page-shifted)`, short: String(i), kind: 'action',
        press: () => { const s = seq(); if (!s) return; const k = (page.n * 8) + i - 1; s.steps[k].on = !s.steps[k].on; emitSeqChange() },
        lit: () => !!seq()?.steps[page.n * 8 + i - 1]?.on })
    }
    out.push({ id: '@run', label: 'Sequencer run / stop', short: 'RUN', kind: 'action',
      press: () => { const e = eng(spec); if (!e) return; void e.unlock().then(() => { const s = seq(); if (!s) return; if (s.playing()) s.stop(); else s.start(); emitSeqChange() }) },
      lit: () => !!seq()?.playing() })
    out.push({ id: '@page', label: 'Steps 1-8 / 9-16', short: 'PAGE', kind: 'action', press: () => { page.n = page.n ? 0 : 1; emitSeqChange() }, lit: () => page.n === 1 })
    out.push({ id: '@pat', label: 'Next built-in pattern', short: 'PATT', kind: 'action', press: () => { const s = seq(); if (!s) return; page.pat = (page.pat + 1) % s.patterns.length; s.load(page.pat); emitSeqChange() } })
    out.push({ id: '@clear', label: 'Clear the pattern', short: 'CLEAR', kind: 'action', press: () => { seq()?.clear(); emitSeqChange() } })
  }
  return out
}
const page = { n: 0, pat: 0 }

// ---------- layouts ----------
interface LayoutSpec { X?: string; K?: string[]; F?: string[]; J?: string[]; PA?: string[]; PB?: string[]; B?: string[] }
function layoutOf(l: LayoutSpec): Record<string, string> {
  const o: Record<string, string> = {}
  const put = (ids: string[], vals?: string[]) => (vals ?? []).forEach((v, i) => { if (v && ids[i]) o[ids[i]] = v })
  if (l.X) o.xfade = l.X
  put(KNOBS, l.K); put(FADERS, l.F); put(JOGS, l.J); put(PADS_A, l.PA); put(PADS_B, l.PB)
  put(['play.A', 'cue.A', 'sync.A', 'play.B', 'cue.B', 'sync.B', 'padmode.A', 'padmode.B'], l.B)
  return o
}
const PRESET_PADS = ['@preset.0', '@preset.1', '@preset.2', '@preset.3']
const GEN_B = ['@preset+', '@panic', '@preset-']
const EMU_LAYOUT: Record<string, LayoutSpec> = {
  moog: { X: 'cutoff', K: ['reso', 'env', 'glide', 'det2', 'det3'], F: ['a', 'd', 's', 'r'], J: ['det2', 'cutoff'], PA: ['wave=0', 'wave=1', 'wave=2'], PB: PRESET_PADS, B: GEN_B },
  hammond: { X: 'drive', K: ['d0', 'd5', 'd6', 'd7', 'd8', 'click'], F: ['d1', 'd2', 'd3', 'd4'], J: ['rotary', 'perc'], PA: ['rotary=0', 'rotary=1', 'rotary=2', 'perc=0'], PB: PRESET_PADS, B: GEN_B },
  tb303: { X: 'cutoff', K: ['cutoff', 'reso', 'envmod', 'decay', 'accent', 'root'], F: ['tempo'], J: ['cutoff', 'tempo'],
    PA: ['@step.1', '@step.2', '@step.3', '@step.4'], PB: ['@step.5', '@step.6', '@step.7', '@step.8'], B: ['@run', '@panic', '@pat', '', '', '', '@page', '@clear'] },
  dx: { X: 'depth', K: ['r2', 'r3', 'r4', 'mdecay', 'alg'], F: ['a', 'd', 's', 'r'], J: ['depth', 'mdecay'], PA: ['alg=0', 'alg=1', 'alg=2'], PB: PRESET_PADS, B: GEN_B },
  theremin: { X: 'vol', K: ['vrate', 'vdepth', 'bright', 'glide', 'attack'], J: ['pitch', 'vdepth'], PB: PRESET_PADS, B: GEN_B },
  ondes: { X: 'vol', K: ['skin', 'glide', 'vrate', 'vdepth', 'attack'], J: ['pitch', 'vdepth'], PA: ['timbre=0', 'timbre=1', 'timbre=2', 'timbre=3'], PB: PRESET_PADS, B: GEN_B },
  mellotron: { X: 'wobble', K: ['age'], F: ['attack', 'rel'], J: ['tape', 'age'], PA: ['tape=0', 'tape=1', 'tape=2'], PB: PRESET_PADS, B: GEN_B },
  arp: { X: 'cutoff', K: ['reso', 'env', 'rate', 'cPitch', 'cFilt', 'cAmp'], F: ['a', 'r', 'ring', 'det2'], J: ['src', 'cutoff'], PA: ['wave1=0', 'wave1=1', 'wave1=2'], PB: ['wave2=0', 'wave2=1', 'wave2=2'], B: GEN_B },
  prophet: { X: 'cutoff', K: ['reso', 'env', 'pm', 'bmod', 'bdet', 'drift'], F: ['a', 'd', 's', 'r'], J: ['int', 'cutoff'], PA: ['wA=0', 'wA=1', 'wB=0', 'wB=1'], PB: PRESET_PADS, B: GEN_B },
  juno: { X: 'cutoff', K: ['reso', 'env', 'mix', 'sub', 'pwmD', 'pwmR'], F: ['a', 'd', 's', 'r'], J: ['chorus', 'hpf'], PA: ['chorus=0', 'chorus=1', 'chorus=2', 'chorus=3'], PB: ['hpf=0', 'hpf=1', 'hpf=2', 'hpf=3'], B: GEN_B },
}
const KOOG_LAYOUT: LayoutSpec = {
  X: 'cutoff', K: ['resonance', 'filterEnv', 'detune', 'glide', 'lfoRate', 'lfoDepth'], F: ['attack', 'decay', 'sustain', 'release'], J: ['bend', 'lfoDepth'],
  PA: ['wave=sawtooth', 'wave=square', 'wave=triangle', 'wave=sine'], PB: ['oct=-1', 'oct=0', 'oct=1', 'oct=2'], B: ['@hold', '@panic', '@tap', '@lfoTarget', '@moog', '@lfoShape'],
}

const KOOG_STAGES: Stage[] = [
  { name: 'VCO', hint: 'the buzz', params: ['wave=sawtooth', 'detune', 'glide', 'bend', 'oct=0'] },
  { name: 'VCF', hint: 'the filter', params: ['cutoff', 'resonance', 'filterEnv'] },
  { name: 'VCA', hint: 'the volume (ADSR)', params: ['attack', 'decay', 'sustain', 'release'] },
  { name: 'LFO', hint: 'the wobble', params: ['lfoRate', 'lfoDepth', '@lfoTarget'] },
]
const KOOG: Topology = {
  id: 'koog', name: 'Koog synth (Moog-style)', caption: 'Sound flows VCO (buzz) → VCF (filter) → VCA (volume) → OUT. The crossfader sweeps the filter cutoff.',
  stages: KOOG_STAGES, params: koogParams(), layout: layoutOf(KOOG_LAYOUT),
}

const cache = new Map<string, Topology>()
function emuTopology(spec: EmuSpec): Topology {
  const hit = cache.get(spec.id); if (hit) return hit
  const stages: Stage[] = []
  for (const c of spec.ctls) {
    if (c.group || !stages.length) stages.push({ name: (c.group ?? 'Controls').toUpperCase(), hint: '', params: [] })
    stages[stages.length - 1].params.push(c.key)
  }
  const t: Topology = { id: spec.id, name: spec.name.split(' / ')[0], caption: `${spec.name}: the same idea as the Koog synth, in this instrument's own words.`, stages, params: emuParams(spec), layout: layoutOf(EMU_LAYOUT[spec.id] ?? { X: 'cutoff', B: GEN_B }) }
  cache.set(spec.id, t)
  return t
}

/** the topology for the instrument that is playing now: an open emulator (or the picked sound), else the Koog synth */
export function currentTopology(): Topology {
  const e = controlEngine() // the focused keyboard zone when split/layered, else the newest engine
  return e ? emuTopology(getEmu(e.spec.id) ?? EMULATORS[0]) : KOOG
}
export const topologyFor = (id: string): Topology => (id === 'koog' ? KOOG : emuTopology(getEmu(id) ?? EMULATORS[0]))
export const compatible = (cls: Cls, kind: PKind) => (kind === 'action' ? cls === 'pad' || cls === 'button' : kind === 'bend' ? cls === 'jog' : cls !== 'pad' && cls !== 'button')
