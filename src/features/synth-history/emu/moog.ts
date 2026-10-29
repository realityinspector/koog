// Moog / Minimoog-style: three detunable oscillators -> 24 dB/oct lowpass (two cascaded biquads) with a filter
// envelope, mono with glide. Reference implementation of the EmuSpec contract.
import { adsr, clamp, hz, lp24, vel01 } from './core'
import type { EmuSpec } from './types'

const WAVES: OscillatorType[] = ['sawtooth', 'square', 'triangle']

export const moog: EmuSpec = {
  id: 'moog', name: 'Voltage-controlled modular / Minimoog-style', year: '1964 / 1970', skin: 'skin-moog',
  blurb: 'In 1964 Robert Moog showed that one voltage could steer another: oscillators, a filter and an envelope wired together made an instrument. The Minimoog (1970) put that into one wooden box you could carry to a gig, and in 1968 Wendy Carlos proved a synth could play Bach.',
  songs: ['invention1', 'minuet', 'prelude', 'jesu'], songWhy: 'Wendy Carlos made Bach famous on a Moog in 1968 (Switched-On Bach).',
  ctls: [
    { key: 'wave', label: 'Wave', min: 0, max: 2, def: 0, kind: 'pick', opts: ['Saw', 'Square', 'Tri'], group: 'Oscillators' },
    { key: 'det2', label: 'Osc 2 tune', min: -50, max: 50, def: 7, step: 1 },
    { key: 'det3', label: 'Osc 3 tune', min: -50, max: 50, def: -7, step: 1 },
    { key: 'cutoff', label: 'Cutoff', min: 80, max: 9000, def: 1200, group: 'Filter' },
    { key: 'reso', label: 'Emphasis', min: 0, max: 12, def: 3, step: 0.1 },
    { key: 'env', label: 'Env amount', min: 0, max: 7000, def: 2500 },
    { key: 'a', label: 'Attack', min: 0.003, max: 2, def: 0.01, group: 'Envelope' },
    { key: 'd', label: 'Decay', min: 0.02, max: 2, def: 0.4 },
    { key: 's', label: 'Sustain', min: 0, max: 1, def: 0.5 },
    { key: 'r', label: 'Release', min: 0.02, max: 3, def: 0.25 },
    { key: 'glide', label: 'Glide', min: 0, max: 0.6, def: 0, step: 0.01, group: 'Play' },
  ],
  presets: [
    { name: 'Fat bass', values: { wave: 0, det2: 6, det3: -6, cutoff: 500, reso: 5, env: 2500, a: 0.005, d: 0.3, s: 0.35, r: 0.15, glide: 0.05 } },
    { name: 'Carlos-style lead', values: { wave: 1, det2: 4, det3: -4, cutoff: 1800, reso: 2, env: 1800, a: 0.01, d: 0.5, s: 0.6, r: 0.25, glide: 0 } },
    { name: 'Squelchy zap', values: { wave: 0, det2: 0, det3: 12, cutoff: 250, reso: 10, env: 6000, a: 0.003, d: 0.18, s: 0.1, r: 0.12, glide: 0.12 } },
  ],
  make({ ctx, out }, P) {
    const oscs = [0, 1, 2].map(() => ctx.createOscillator())
    const mix = ctx.createGain(); mix.gain.value = 0.3
    const f = lp24(ctx, P.cutoff, P.reso)
    const cenv = ctx.createConstantSource(); cenv.offset.value = 0
    cenv.connect(f.a.frequency); cenv.connect(f.b.frequency)
    const vca = ctx.createGain(); vca.gain.value = 0
    const sat = ctx.createWaveShaper(); sat.curve = new Float32Array([-1, -0.8, 0, 0.8, 1]) // gentle
    oscs.forEach((o) => { o.frequency.value = 220; o.connect(mix) })
    mix.connect(f.input); f.output.connect(vca); vca.connect(sat); sat.connect(out)
    oscs.forEach((o) => o.start()); cenv.start()
    const applyWave = () => oscs.forEach((o) => { o.type = WAVES[Math.round(P.wave)] ?? 'sawtooth' })
    const applyDet = () => { oscs[1].detune.value = P.det2; oscs[2].detune.value = P.det3 }
    applyWave(); applyDet()
    const stack: number[] = []
    let gate = false
    const pitch = (n: number, t: number) => oscs.forEach((o, i) => {
      const f0 = hz(n) * (i === 2 ? 0.5 : 1)
      if (P.glide > 0 && gate) o.frequency.setTargetAtTime(f0, t, P.glide / 3)
      else { o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(f0, t) }
    })
    let relV: ((rt: number, r: number) => void) | null = null
    let relF: ((rt: number, r: number) => void) | null = null
    const on = (n: number, vel: number) => {
      const t = ctx.currentTime
      pitch(n, t)
      if (!gate) {
        gate = true
        f.a.frequency.setValueAtTime(P.cutoff, t); f.b.frequency.setValueAtTime(P.cutoff, t)
        relV = adsr(vca.gain, t, vel01(vel), P.a, P.d, P.s)
        relF = adsr(cenv.offset, t, P.env, P.a, P.d, P.s)
      }
    }
    return {
      noteOn(n, vel) { const i = stack.indexOf(n); if (i >= 0) stack.splice(i, 1); stack.push(n); on(n, vel) },
      noteOff(n) {
        const i = stack.indexOf(n); if (i >= 0) stack.splice(i, 1)
        if (stack.length) { pitch(stack[stack.length - 1], ctx.currentTime); return }
        if (!gate) return
        gate = false; const t = ctx.currentTime
        relV?.(t, P.r); relF?.(t, P.r)
      },
      allOff() { stack.length = 0; if (gate) { gate = false; const t = ctx.currentTime; relV?.(t, 0.05); relF?.(t, 0.05) } },
      param(k) {
        const t = ctx.currentTime
        if (k === 'wave') applyWave()
        if (k === 'det2' || k === 'det3') applyDet()
        if (k === 'cutoff') { f.a.frequency.setTargetAtTime(clamp(P.cutoff, 40, 12000), t, 0.02); f.b.frequency.setTargetAtTime(clamp(P.cutoff, 40, 12000), t, 0.02) }
        if (k === 'reso') f.a.Q.setTargetAtTime(clamp(P.reso, 0, 14), t, 0.02)
      },
      dispose() { oscs.forEach((o) => o.stop()); cenv.stop(); try { vca.disconnect() } catch { /* */ } },
    }
  },
}
