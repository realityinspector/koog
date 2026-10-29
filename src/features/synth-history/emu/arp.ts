// ARP 2600-style: semi-modular. Two oscillators, a ring modulator, a lowpass and an envelope, plus a modulator
// (sine LFO / square LFO / random sample-and-hold) that you route with "patch cable" sliders to pitch, filter and loudness.
import { adsr, clamp, hz, lp24, vel01 } from './core'
import type { EmuSpec } from './types'

const WAVES: OscillatorType[] = ['sawtooth', 'square', 'triangle']

export const arp: EmuSpec = {
  id: 'arp', name: 'ARP 2600-style', year: '1971', skin: 'skin-arp',
  blurb: 'The 2600 was a "semi-modular" synth: it worked out of the box, but sliders and patch cables let you rewire it, so it was great for learning how sound is built. Its sounds were in sci-fi movies and on stage with big rock bands.',
  songs: ['toccata', 'king', 'invention1', 'prelude'], songWhy: 'Bold, buzzy and wobbly: try the Mountain King with some random sample-and-hold patching.',
  ctls: [
    { key: 'wave1', label: 'Osc 1', min: 0, max: 2, def: 0, kind: 'pick', opts: ['Saw', 'Square', 'Tri'], group: 'Sound' },
    { key: 'wave2', label: 'Osc 2', min: 0, max: 2, def: 1, kind: 'pick', opts: ['Saw', 'Square', 'Tri'] },
    { key: 'det2', label: 'Osc 2 tune', min: -700, max: 700, def: 7, step: 1 },
    { key: 'ring', label: 'Ring mod', min: 0, max: 1, def: 0, step: 0.01 },
    { key: 'cutoff', label: 'Cutoff', min: 80, max: 9000, def: 1500, group: 'Filter + env' },
    { key: 'reso', label: 'Emphasis', min: 0, max: 12, def: 3, step: 0.1 },
    { key: 'env', label: 'Env to filter', min: 0, max: 7000, def: 1500 },
    { key: 'a', label: 'Attack', min: 0.003, max: 2, def: 0.01 },
    { key: 'r', label: 'Release', min: 0.02, max: 3, def: 0.25 },
    { key: 'src', label: 'Mod source', min: 0, max: 2, def: 0, kind: 'pick', opts: ['Sine LFO', 'Square LFO', 'Random S&H'], group: 'Patch cables' },
    { key: 'rate', label: 'Mod rate', min: 0.2, max: 20, def: 5, step: 0.1 },
    { key: 'cPitch', label: 'to Pitch', min: 0, max: 1, def: 0, step: 0.01 },
    { key: 'cFilt', label: 'to Filter', min: 0, max: 1, def: 0, step: 0.01 },
    { key: 'cAmp', label: 'to Loudness', min: 0, max: 1, def: 0, step: 0.01 },
  ],
  presets: [
    { name: 'Laser zap', values: { wave1: 0, wave2: 1, det2: 700, ring: 0.4, cutoff: 2500, reso: 6, env: 4000, a: 0.003, r: 0.15, src: 1, rate: 12, cPitch: 0.5, cFilt: 0, cAmp: 0 } },
    { name: 'Robot S&H', values: { wave1: 1, wave2: 0, det2: 5, ring: 0, cutoff: 900, reso: 7, env: 1000, a: 0.005, r: 0.2, src: 2, rate: 8, cPitch: 0, cFilt: 0.8, cAmp: 0 } },
    { name: 'Wobble lead', values: { wave1: 0, wave2: 0, det2: 9, ring: 0, cutoff: 1800, reso: 3, env: 800, a: 0.02, r: 0.3, src: 0, rate: 5.5, cPitch: 0.15, cFilt: 0.3, cAmp: 0.1 } },
  ],
  make({ ctx, out }, P) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator()
    const mix = ctx.createGain(); mix.gain.value = 0.35
    const rm = ctx.createGain(); rm.gain.value = 0 // ring modulator: osc1 x osc2
    const rmOut = ctx.createGain(); rmOut.gain.value = 0
    o1.connect(rm); o2.connect(rm.gain); rm.connect(rmOut)
    o1.connect(mix); o2.connect(mix); rmOut.connect(mix)
    const f = lp24(ctx, P.cutoff, P.reso)
    const cenv = ctx.createConstantSource(); cenv.offset.value = 0
    cenv.connect(f.a.frequency); cenv.connect(f.b.frequency)
    const vca = ctx.createGain(); vca.gain.value = 0
    const tremG = ctx.createGain(); tremG.gain.value = 1 // amp mod: base 1, modulator adds
    mix.connect(f.input); f.output.connect(vca); vca.connect(tremG); tremG.connect(out)
    // modulator bus: -1..1 signal
    const lfo = ctx.createOscillator(); lfo.frequency.value = P.rate
    const rnd = ctx.createConstantSource(); rnd.offset.value = 0
    const bus = ctx.createGain()
    const pG = ctx.createGain(), fG = ctx.createGain(), aG = ctx.createGain()
    bus.connect(pG); bus.connect(fG); bus.connect(aG)
    pG.connect(o1.detune); pG.connect(o2.detune)
    fG.connect(f.a.frequency); fG.connect(f.b.frequency)
    aG.connect(tremG.gain)
    ;[o1, o2, lfo].forEach((o) => o.start()); cenv.start(); rnd.start()
    let timer = 0
    const setSrc = () => {
      try { lfo.disconnect() } catch { /* */ }
      try { rnd.disconnect() } catch { /* */ }
      clearInterval(timer)
      const s = Math.round(P.src)
      if (s === 2) {
        rnd.connect(bus)
        const tick = () => rnd.offset.setTargetAtTime(Math.random() * 2 - 1, ctx.currentTime, 0.004)
        timer = window.setInterval(tick, 1000 / clamp(P.rate, 0.2, 20))
      } else { lfo.type = s === 1 ? 'square' : 'sine'; lfo.connect(bus) }
    }
    const routes = () => {
      const t = ctx.currentTime
      pG.gain.setTargetAtTime(P.cPitch * 600, t, 0.02) // cents
      fG.gain.setTargetAtTime(P.cFilt * 2500, t, 0.02) // Hz
      aG.gain.setTargetAtTime(P.cAmp * 0.45, t, 0.02)
    }
    const waves = () => { o1.type = WAVES[Math.round(P.wave1)] ?? 'sawtooth'; o2.type = WAVES[Math.round(P.wave2)] ?? 'square' }
    const tune = () => { o2.detune.value = P.det2 }
    const ringMix = () => { const t = ctx.currentTime; rmOut.gain.setTargetAtTime(P.ring * 1.2, t, 0.02); mix.gain.setTargetAtTime(0.35 * (1 - 0.5 * P.ring), t, 0.02) }
    waves(); tune(); setSrc(); routes(); ringMix()
    const stack: number[] = []
    let gate = false
    let relV: ((rt: number, r: number) => void) | null = null, relF: ((rt: number, r: number) => void) | null = null
    const pitch = (n: number, t: number) => { const f0 = hz(n); o1.frequency.setValueAtTime(f0, t); o2.frequency.setValueAtTime(f0, t) }
    return {
      noteOn(n, vel) {
        const i = stack.indexOf(n); if (i >= 0) stack.splice(i, 1); stack.push(n)
        const t = ctx.currentTime; pitch(n, t)
        if (!gate) {
          gate = true
          relV = adsr(vca.gain, t, vel01(vel), P.a, 0.3, 0.8)
          relF = adsr(cenv.offset, t, P.env, P.a, 0.3, 0.4)
        }
      },
      noteOff(n) {
        const i = stack.indexOf(n); if (i >= 0) stack.splice(i, 1)
        if (stack.length) { pitch(stack[stack.length - 1], ctx.currentTime); return }
        if (!gate) return
        gate = false; relV?.(ctx.currentTime, P.r); relF?.(ctx.currentTime, P.r)
      },
      allOff() { stack.length = 0; if (gate) { gate = false; relV?.(ctx.currentTime, 0.05); relF?.(ctx.currentTime, 0.05) } },
      param(k) {
        const t = ctx.currentTime
        if (k === 'wave1' || k === 'wave2') waves()
        if (k === 'det2') tune()
        if (k === 'src') setSrc()
        if (k === 'rate') { lfo.frequency.setTargetAtTime(P.rate, t, 0.02); if (Math.round(P.src) === 2) setSrc() }
        if (k === 'cPitch' || k === 'cFilt' || k === 'cAmp') routes()
        if (k === 'ring') ringMix()
        if (k === 'cutoff') { const c = clamp(P.cutoff, 40, 12000); f.a.frequency.setTargetAtTime(c, t, 0.02); f.b.frequency.setTargetAtTime(c, t, 0.02) }
        if (k === 'reso') f.a.Q.setTargetAtTime(clamp(P.reso, 0, 14), t, 0.02)
      },
      dispose() { clearInterval(timer); ;[o1, o2, lfo].forEach((o) => o.stop()); cenv.stop(); rnd.stop() },
    }
  },
}
