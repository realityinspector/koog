// Prophet-5-spirit: 5 voices, each with two oscillators -> 24 dB lowpass -> amp, plus POLY-MOD: the filter envelope
// (and Osc B) steer Osc A's pitch and the filter cutoff. Filter and amp share the A/D/S/R knobs for simplicity.
import { adsr, clamp, hz, lp24, vel01 } from './core'
import type { EmuSpec } from './types'

const INTERVALS = [-12, -7, 0, 5, 7, 12]
const VOICES = 5

interface V {
  note: number; t0: number; rel: boolean
  srcs: AudioScheduledSourceNode[]; nodes: AudioNode[]
  vca: GainNode; f: ReturnType<typeof lp24>; pmG: GainNode; envG: GainNode; bmG: GainNode
  oA: OscillatorNode; oB: OscillatorNode
  kt: number; f0: number
  relV: (rt: number, r: number) => void; relF: (rt: number, r: number) => void
}

export const prophet: EmuSpec = {
  id: 'prophet', name: 'Programmable polyphonic synth (Prophet-5 spirit)', year: '1978', skin: 'skin-prophet',
  blurb: 'The Prophet-5 was the first synth that could play five notes at once AND remember your sounds with a tiny computer chip. Before it, you had to write knob positions on paper! Its "poly-mod" section lets one part of the synth wobble another, which makes bells and metallic tones.',
  songs: ['canon', 'air', 'jesu', 'prelude', 'minuet'], songWhy: 'The first fully programmable polyphonic synth with memory, so sounds could be saved and recalled on stage.',
  ctls: [
    { key: 'wA', label: 'Wave A', min: 0, max: 1, def: 0, kind: 'pick', opts: ['Saw', 'Pulse'], group: 'Oscillators' },
    { key: 'wB', label: 'Wave B', min: 0, max: 1, def: 0, kind: 'pick', opts: ['Saw', 'Pulse'] },
    { key: 'bdet', label: 'B detune', min: -50, max: 50, def: 7, step: 1 },
    { key: 'int', label: 'B interval', min: 0, max: 5, def: 2, kind: 'pick', opts: ['-1 oct', '-5th', 'Unison', '+4th', '+5th', '+1 oct'] },
    { key: 'drift', label: 'Unison drift', min: 0, max: 20, def: 5, step: 0.5 },
    { key: 'cutoff', label: 'Cutoff', min: 80, max: 9000, def: 1200, group: 'Filter' },
    { key: 'reso', label: 'Resonance', min: 0, max: 12, def: 2, step: 0.1 },
    { key: 'env', label: 'Env amount', min: 0, max: 7000, def: 2500 },
    { key: 'pm', label: 'Poly-mod amount', min: 0, max: 1, def: 0, step: 0.01, group: 'Poly-mod' },
    { key: 'bmod', label: 'Mod: Osc B > cutoff', min: 0, max: 1, def: 0, step: 0.01 },
    { key: 'a', label: 'Attack', min: 0.003, max: 2, def: 0.02, group: 'Envelope' },
    { key: 'd', label: 'Decay', min: 0.02, max: 2.5, def: 0.6 },
    { key: 's', label: 'Sustain', min: 0, max: 1, def: 0.6 },
    { key: 'r', label: 'Release', min: 0.02, max: 3, def: 0.4 },
  ],
  presets: [
    { name: 'Warm pad', values: { wA: 0, wB: 0, bdet: 8, int: 2, drift: 6, cutoff: 900, reso: 2, env: 2500, pm: 0, bmod: 0, a: 0.25, d: 0.8, s: 0.7, r: 0.8 } },
    { name: 'Poly-mod bell', values: { wA: 0, wB: 1, bdet: 0, int: 4, drift: 3, cutoff: 2500, reso: 3, env: 3000, pm: 0.45, bmod: 0.3, a: 0.005, d: 1.0, s: 0.15, r: 1.0 } },
    { name: 'Brass stab', values: { wA: 0, wB: 0, bdet: 5, int: 2, drift: 4, cutoff: 700, reso: 1, env: 4500, pm: 0.05, bmod: 0, a: 0.04, d: 0.35, s: 0.6, r: 0.2 } },
  ],
  make({ ctx, out }, P) {
    // pulse (about 30% width) as a custom periodic wave
    const N = 64, real = new Float32Array(N), imag = new Float32Array(N), w = 0.3
    for (let n = 1; n < N; n++) { real[n] = Math.sin(2 * Math.PI * n * w) / (Math.PI * n); imag[n] = (1 - Math.cos(2 * Math.PI * n * w)) / (Math.PI * n) }
    const pulse = ctx.createPeriodicWave(real, imag)
    const setW = (o: OscillatorNode, k: number) => { if (k >= 1) o.setPeriodicWave(pulse); else o.type = 'sawtooth' }
    let voices: V[] = []

    const cleanup = (v: V, ms: number) => {
      voices = voices.filter((x) => x !== v)
      setTimeout(() => {
        v.srcs.forEach((s) => { try { s.stop() } catch { /* */ } })
        v.nodes.forEach((n) => { try { n.disconnect() } catch { /* */ } })
      }, ms)
    }
    const quick = (v: V) => { const t = ctx.currentTime; v.rel = true; v.relV(t, 0.04); v.relF(t, 0.04); cleanup(v, 160) }

    const start = (note: number, vel: number) => {
      const same = voices.find((x) => x.note === note && !x.rel); if (same) quick(same)
      if (voices.length >= VOICES) {
        const pool = voices.filter((x) => x.rel); const list = pool.length ? pool : voices
        quick(list.reduce((o, x) => (x.t0 < o.t0 ? x : o)))
      }
      const t = ctx.currentTime, f0 = hz(note)
      const oA = ctx.createOscillator(), oB = ctx.createOscillator()
      setW(oA, P.wA); setW(oB, P.wB)
      oA.frequency.value = f0
      oB.frequency.value = f0 * Math.pow(2, (INTERVALS[Math.round(P.int)] ?? 0) / 12)
      oA.detune.value = (Math.random() * 2 - 1) * P.drift
      oB.detune.value = P.bdet + (Math.random() * 2 - 1) * P.drift
      const gA = ctx.createGain(), gB = ctx.createGain(); gA.gain.value = 0.5; gB.gain.value = 0.5
      const kt = Math.pow(2, ((note - 60) / 12) * 0.5)
      const f = lp24(ctx, clamp(P.cutoff * kt, 30, 15000), P.reso)
      const vca = ctx.createGain(); vca.gain.value = 0
      const fenv = ctx.createConstantSource(); fenv.offset.value = 0
      const envG = ctx.createGain(); envG.gain.value = P.env
      const pmG = ctx.createGain(); pmG.gain.value = P.pm * f0 * 2
      const bmG = ctx.createGain(); bmG.gain.value = P.bmod * 4000
      oA.connect(gA); oB.connect(gB); gA.connect(f.input); gB.connect(f.input)
      f.output.connect(vca); vca.connect(out)
      fenv.connect(envG); envG.connect(f.a.frequency); envG.connect(f.b.frequency)
      fenv.connect(pmG); pmG.connect(oA.frequency)
      oB.connect(bmG); bmG.connect(f.a.frequency); bmG.connect(f.b.frequency)
      const relV = adsr(vca.gain, t, vel01(vel) * 0.2, P.a, P.d, P.s)
      const relF = adsr(fenv.offset, t, 1, P.a, P.d, P.s)
      oA.start(t); oB.start(t); fenv.start(t)
      voices.push({
        note, t0: t, rel: false, srcs: [oA, oB, fenv], vca, f, pmG, envG, bmG, oA, oB, kt, f0, relV, relF,
        nodes: [oA, oB, gA, gB, f.a, f.b, vca, fenv, envG, pmG, bmG],
      })
    }

    return {
      noteOn: start,
      noteOff(n) {
        const v = voices.find((x) => x.note === n && !x.rel); if (!v) return
        const t = ctx.currentTime; v.rel = true
        v.relV(t, P.r); v.relF(t, P.r)
        cleanup(v, (P.r * 1.4 + 0.25) * 1000)
      },
      allOff() { [...voices].forEach(quick) },
      param(k) {
        const t = ctx.currentTime
        voices.forEach((v) => {
          if (k === 'cutoff') { const c = clamp(P.cutoff * v.kt, 30, 15000); v.f.a.frequency.setTargetAtTime(c, t, 0.02); v.f.b.frequency.setTargetAtTime(c, t, 0.02) }
          if (k === 'reso') v.f.a.Q.setTargetAtTime(clamp(P.reso, 0, 14), t, 0.02)
          if (k === 'env') v.envG.gain.setTargetAtTime(P.env, t, 0.02)
          if (k === 'pm') v.pmG.gain.setTargetAtTime(P.pm * v.f0 * 2, t, 0.02)
          if (k === 'bmod') v.bmG.gain.setTargetAtTime(P.bmod * 4000, t, 0.02)
          if (k === 'bdet') v.oB.detune.setTargetAtTime(P.bdet, t, 0.02)
        })
      },
      dispose() {
        voices.forEach((v) => {
          v.srcs.forEach((s) => { try { s.stop() } catch { /* */ } })
          v.nodes.forEach((n) => { try { n.disconnect() } catch { /* */ } })
        })
        voices = []
      },
    }
  },
}
