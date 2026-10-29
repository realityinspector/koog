// TB-303-style bass: saw/square, resonant lowpass with a decaying filter envelope, ACCENT and SLIDE, and a
// little 16-step pattern sequencer (lookahead scheduler) the kid can program. Mono.
import { clamp, hz, lp24 } from './core'
import type { EmuSpec, Voice } from './types'

export interface Step { on: boolean; deg: number; accent: boolean; slide: boolean }
/** semitone offsets above the root for the 8 rows of the step grid (a pentatonic-ish ladder) */
export const ROWS = [0, 3, 5, 7, 10, 12, 15, 17]
export interface SeqApi {
  steps: Step[]
  playing(): boolean
  start(): void
  stop(): void
  /** UI highlight callback with the step number as it sounds (-1 when stopped) */
  onStep(fn: (i: number) => void): () => void
  patterns: { name: string; steps: Step[] }[]
  load(i: number): void
  clear(): void
  /** tempo lives in P.tempo */
}
export type Voice303 = Voice & { seq: SeqApi }

const S = (deg: number, accent = false, slide = false): Step => ({ on: true, deg, accent, slide })
const R = (): Step => ({ on: false, deg: 0, accent: false, slide: false })
const PATTERNS = [
  { name: 'Acid walk', steps: [S(0, true), S(0), R(), S(3, false, true), S(5), R(), S(0, true), S(7), S(0), R(), S(3), S(5, true, true), S(7), R(), S(3), S(0)] },
  { name: 'Bounce', steps: [S(0, true), R(), S(0), S(5, false, true), S(0, true), R(), S(3), R(), S(0, true), R(), S(0), S(7, false, true), S(5), R(), S(3), R()] },
  { name: 'Mountain creep', steps: [S(0), S(2 + 1), S(5), S(3), S(5), R(), S(0), R(), S(1), S(4), S(7), S(4), S(7), R(), S(0), R()].map((s, i) => ({ ...s, deg: [0, 3, 5, 3, 5, 0, 0, 0, 0, 3, 7, 3, 7, 0, 0, 0][i] })) },
]
const clone = (a: Step[]) => a.map((s) => ({ ...s }))

export const tb303: EmuSpec = {
  id: 'tb303', name: 'TB-303-style bass', year: '1981', skin: 'skin-303',
  blurb: 'This little silver box was made to play bass lines for guitarists to practise with, and it flopped. Years later, kids in Chicago twisted its filter knob and invented "acid house", so a failure became one of the most copied sounds in dance music.',
  songs: ['king', 'toccata', 'elise'], songWhy: 'In the Hall of the Mountain King is a creeping bass line that gets faster, perfect for a squelchy 303 pattern.',
  extra: 'seq303',
  ctls: [
    { key: 'wave', label: 'Wave', min: 0, max: 1, def: 0, kind: 'pick', opts: ['Saw', 'Square'], group: 'Sound' },
    { key: 'cutoff', label: 'Cutoff', min: 60, max: 4000, def: 500 },
    { key: 'reso', label: 'Resonance', min: 0, max: 14, def: 8, step: 0.1 },
    { key: 'envmod', label: 'Env mod', min: 0, max: 5000, def: 2500 },
    { key: 'decay', label: 'Decay', min: 0.08, max: 1.5, def: 0.3 },
    { key: 'accent', label: 'Accent', min: 0, max: 1, def: 0.7, step: 0.01 },
    { key: 'root', label: 'Root', min: 0, max: 7, def: 0, kind: 'pick', opts: ['C', 'D', 'E', 'F', 'G', 'A', 'Bb', 'B'], group: 'Pattern' },
    { key: 'tempo', label: 'Tempo', min: 70, max: 170, def: 120, step: 1 },
  ],
  presets: [
    { name: 'Squelch', values: { wave: 0, cutoff: 350, reso: 11, envmod: 3800, decay: 0.28, accent: 0.8, root: 0, tempo: 125 } },
    { name: 'Round bass', values: { wave: 1, cutoff: 700, reso: 3, envmod: 1200, decay: 0.2, accent: 0.4, root: 0, tempo: 110 } },
    { name: 'Screamer', values: { wave: 0, cutoff: 900, reso: 13, envmod: 4500, decay: 0.55, accent: 1, root: 5, tempo: 135 } },
  ],
  make({ ctx, out }, P): Voice303 {
    const osc = ctx.createOscillator(); osc.frequency.value = 55
    const pre = ctx.createGain(); pre.gain.value = 0.55
    const f = lp24(ctx, P.cutoff, P.reso)
    const cenv = ctx.createConstantSource(); cenv.offset.value = 0
    cenv.connect(f.a.frequency); cenv.connect(f.b.frequency)
    const vca = ctx.createGain(); vca.gain.value = 0
    osc.connect(pre); pre.connect(f.input); f.output.connect(vca); vca.connect(out)
    osc.start(); cenv.start()
    const setWave = () => { osc.type = Math.round(P.wave) === 1 ? 'square' : 'sawtooth' }
    setWave()
    let gate = false
    const gateOn = (n: number, t: number, acc: boolean, slide: boolean, vel = 1) => {
      const f0 = hz(n)
      osc.frequency.cancelScheduledValues(t)
      if (slide && gate) osc.frequency.setTargetAtTime(f0, t, 0.045)
      else osc.frequency.setValueAtTime(f0, t)
      const a = acc ? 1 + P.accent * 0.9 : 1
      if (!(slide && gate)) {
        const e = P.envmod * a
        cenv.offset.cancelScheduledValues(t); cenv.offset.setValueAtTime(e, t); cenv.offset.setTargetAtTime(0, t, Math.max(0.03, P.decay * (acc ? 0.6 : 1)) / 3)
      }
      vca.gain.cancelScheduledValues(t)
      vca.gain.setTargetAtTime((acc ? 0.5 + P.accent * 0.5 : 0.55) * vel, t, 0.004)
      gate = true
    }
    const gateOff = (t: number) => { if (!gate) return; gate = false; vca.gain.cancelScheduledValues(t); vca.gain.setTargetAtTime(0, t, 0.012) }
    const steps = clone(PATTERNS[0].steps)
    // sequencer
    let timer = 0, playing = false, idx = 0, next = 0
    const subs = new Set<(i: number) => void>()
    const emit = (i: number, t: number) => window.setTimeout(() => subs.forEach((f) => f(i)), Math.max(0, (t - ctx.currentTime) * 1000))
    const rootMidi = () => 36 + [0, 2, 4, 5, 7, 9, 10, 11][Math.round(P.root)]
    const sched = () => {
      const dur = 60 / clamp(P.tempo, 40, 220) / 4
      while (next < ctx.currentTime + 0.12) {
        const s = steps[idx], prev = steps[(idx + 15) % 16]
        if (s.on) {
          gateOn(rootMidi() + s.deg, next, s.accent, prev.on && prev.slide)
          if (s.slide && steps[(idx + 1) % 16].on) { /* hold gate into next */ } else gateOff(next + dur * 0.62)
        } else if (!(prev.on && prev.slide)) gateOff(next)
        else gateOff(next + dur * 0.3)
        emit(idx, next)
        idx = (idx + 1) % 16; next += dur
      }
    }
    const seq: SeqApi = {
      steps, patterns: PATTERNS,
      playing: () => playing,
      start() { if (playing) return; playing = true; idx = 0; next = ctx.currentTime + 0.06; timer = window.setInterval(sched, 25) },
      stop() { if (!playing) return; playing = false; clearInterval(timer); gateOff(ctx.currentTime); subs.forEach((f) => f(-1)) },
      onStep(fn) { subs.add(fn); return () => { subs.delete(fn) } },
      load(i) { const p = PATTERNS[i]; if (!p) return; steps.splice(0, 16, ...clone(p.steps)) },
      clear() { steps.splice(0, 16, ...Array.from({ length: 16 }, R)) },
    }
    const stack: number[] = []
    return {
      seq,
      noteOn(n) {
        if (playing) return
        const slide = stack.length > 0
        stack.push(n); gateOn(n, ctx.currentTime, false, slide)
      },
      noteOff(n) {
        if (playing) return
        const i = stack.indexOf(n); if (i >= 0) stack.splice(i, 1)
        if (stack.length) { gateOn(stack[stack.length - 1], ctx.currentTime, false, true); return }
        gateOff(ctx.currentTime)
      },
      allOff() { stack.length = 0; seq.stop(); gateOff(ctx.currentTime) },
      param(k) {
        const t = ctx.currentTime
        if (k === 'wave') setWave()
        if (k === 'cutoff') { const c = clamp(P.cutoff, 40, 8000); f.a.frequency.setTargetAtTime(c, t, 0.02); f.b.frequency.setTargetAtTime(c, t, 0.02) }
        if (k === 'reso') f.a.Q.setTargetAtTime(clamp(P.reso, 0, 14), t, 0.02)
      },
      dispose() { clearInterval(timer); playing = false; osc.stop(); cenv.stop(); subs.clear() },
    }
  },
}
