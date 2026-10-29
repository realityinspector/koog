// Juno-style: per voice a saw, a PWM pulse (saw minus a delayed copy, delay swept by an LFO), a square sub one octave
// down -> high-pass -> 24 dB lowpass with envelope -> amp. All voices feed a shared stereo chorus (two modulated delays).
import { adsr, clamp, hz, lp24, vel01 } from './core'
import type { EmuSpec } from './types'

const HPF = [20, 240, 520, 1100]
// chorus modes: Off, I, II, I+II -> LFO rate Hz, delay-time depth (s), wet level
const CHO = [{ r: 0.5, d: 0, w: 0 }, { r: 0.5, d: 0.0016, w: 0.7 }, { r: 0.8, d: 0.0016, w: 0.7 }, { r: 8, d: 0.0004, w: 0.7 }]
const VOICES = 6

interface V {
  note: number; t0: number; rel: boolean
  srcs: AudioScheduledSourceNode[]; nodes: AudioNode[]
  f: ReturnType<typeof lp24>; hpf: BiquadFilterNode; pwG: GainNode; kt: number; f0: number
  sawG: GainNode; pulG: GainNode; subG: GainNode
  relV: (rt: number, r: number) => void; relF: (rt: number, r: number) => void
}

export const juno: EmuSpec = {
  id: 'juno', name: 'Chorus polysynth (Juno-style)', year: '1982', skin: 'skin-juno',
  blurb: 'The Juno was cheap, light and easy: one knob for each job, so you could make a good sound in seconds. Its secret was a built-in chorus that doubles the sound with a gently wobbling copy in each ear, which makes it sound wide and lush.',
  songs: ['canon', 'air', 'minuet', 'jesu', 'prelude'], songWhy: 'A cheap, great-sounding, easy-to-program polysynth with lush chorus; it became a classic of 80s synth-pop, house and techno.',
  note: 'The chorus is a two-delay approximation of the original analog bucket-brigade circuit.',
  ctls: [
    { key: 'mix', label: 'Saw / Pulse', min: 0, max: 1, def: 0.4, step: 0.01, group: 'Oscillator' },
    { key: 'sub', label: 'Sub osc', min: 0, max: 1, def: 0.3, step: 0.01 },
    { key: 'pwmD', label: 'PWM depth', min: 0, max: 1, def: 0.5, step: 0.01 },
    { key: 'pwmR', label: 'PWM rate', min: 0.1, max: 8, def: 0.8, step: 0.05 },
    { key: 'hpf', label: 'HPF', min: 0, max: 3, def: 0, kind: 'pick', opts: ['0', '1', '2', '3'], group: 'Filter' },
    { key: 'cutoff', label: 'Cutoff', min: 80, max: 9000, def: 1800 },
    { key: 'reso', label: 'Resonance', min: 0, max: 12, def: 2, step: 0.1 },
    { key: 'env', label: 'Env amount', min: 0, max: 7000, def: 1800 },
    { key: 'a', label: 'Attack', min: 0.003, max: 2, def: 0.02, group: 'Envelope' },
    { key: 'd', label: 'Decay', min: 0.02, max: 2.5, def: 0.5 },
    { key: 's', label: 'Sustain', min: 0, max: 1, def: 0.7 },
    { key: 'r', label: 'Release', min: 0.02, max: 3, def: 0.4 },
    { key: 'chorus', label: 'Chorus', min: 0, max: 3, def: 2, kind: 'pick', opts: ['Off', 'I', 'II', 'I+II'], group: 'Chorus' },
  ],
  presets: [
    { name: 'Lush pad', values: { mix: 0.7, sub: 0.2, pwmD: 0.6, pwmR: 0.5, hpf: 0, cutoff: 1400, reso: 1.5, env: 1200, a: 0.35, d: 0.8, s: 0.8, r: 0.9, chorus: 3 } },
    { name: 'Pluck bass', values: { mix: 0.1, sub: 0.7, pwmD: 0.2, pwmR: 1, hpf: 0, cutoff: 450, reso: 4, env: 3500, a: 0.004, d: 0.25, s: 0.3, r: 0.15, chorus: 1 } },
    { name: 'Bright stab', values: { mix: 0.5, sub: 0.25, pwmD: 0.7, pwmR: 2, hpf: 1, cutoff: 1800, reso: 2, env: 3500, a: 0.005, d: 0.35, s: 0.4, r: 0.2, chorus: 2 } },
  ],
  make({ ctx, out }, P) {
    // ---- shared chorus bus
    const bus = ctx.createGain()
    const dry = ctx.createGain(), wet = ctx.createGain()
    const dL = ctx.createDelay(0.05), dR = ctx.createDelay(0.05)
    dL.delayTime.value = 0.0065; dR.delayTime.value = 0.0065
    const merger = ctx.createChannelMerger(2)
    const cLfo = ctx.createOscillator(); cLfo.type = 'sine'
    const gL = ctx.createGain(), gR = ctx.createGain()
    cLfo.connect(gL); cLfo.connect(gR); gL.connect(dL.delayTime); gR.connect(dR.delayTime)
    bus.connect(dry); dry.connect(out)
    bus.connect(dL); bus.connect(dR); dL.connect(merger, 0, 0); dR.connect(merger, 0, 1); merger.connect(wet); wet.connect(out)
    const applyChorus = (fast: boolean) => {
      const m = CHO[Math.round(clamp(P.chorus, 0, 3))], t = ctx.currentTime
      cLfo.frequency.setTargetAtTime(m.r, t, 0.05)
      gL.gain.setTargetAtTime(m.d, t, 0.05); gR.gain.setTargetAtTime(-m.d, t, 0.05)
      wet.gain.setTargetAtTime(m.w, t, fast ? 0.01 : 0.03)
      dry.gain.setTargetAtTime(m.w > 0 ? 0.55 : 1, t, fast ? 0.01 : 0.03)
    }
    dry.gain.value = 1; wet.gain.value = 0; gL.gain.value = 0; gR.gain.value = 0
    cLfo.start(); applyChorus(true)
    // ---- shared PWM LFO
    const pLfo = ctx.createOscillator(); pLfo.type = 'sine'; pLfo.frequency.value = P.pwmR; pLfo.start()

    let voices: V[] = []
    const cleanup = (v: V, ms: number) => {
      voices = voices.filter((x) => x !== v)
      setTimeout(() => {
        try { pLfo.disconnect(v.pwG) } catch { /* */ }
        v.srcs.forEach((s) => { try { s.stop() } catch { /* */ } })
        v.nodes.forEach((n) => { try { n.disconnect() } catch { /* */ } })
      }, ms)
    }
    const quick = (v: V) => { const t = ctx.currentTime; v.rel = true; v.relV(t, 0.04); v.relF(t, 0.04); cleanup(v, 160) }
    const mixLv = () => ({ saw: (1 - P.mix) * 0.55, pul: P.mix * 0.55, sub: P.sub * 0.45 })

    const start = (note: number, vel: number) => {
      const same = voices.find((x) => x.note === note && !x.rel); if (same) quick(same)
      if (voices.length >= VOICES) {
        const pool = voices.filter((x) => x.rel); const list = pool.length ? pool : voices
        quick(list.reduce((o, x) => (x.t0 < o.t0 ? x : o)))
      }
      const t = ctx.currentTime, f0 = hz(note)
      const oS = ctx.createOscillator(), oP = ctx.createOscillator(), oU = ctx.createOscillator()
      oS.type = 'sawtooth'; oP.type = 'sawtooth'; oU.type = 'square'
      oS.frequency.value = f0; oP.frequency.value = f0; oU.frequency.value = f0 / 2
      // PWM: pulse = saw - saw delayed by (width / f0). Width swept around 0.5 by the LFO.
      const dl = ctx.createDelay(0.1); dl.delayTime.value = 0.5 / f0
      const inv = ctx.createGain(); inv.gain.value = -1
      const pwG = ctx.createGain(); pwG.gain.value = P.pwmD * 0.4 / f0
      pLfo.connect(pwG); pwG.connect(dl.delayTime)
      const lv = mixLv()
      const sawG = ctx.createGain(); sawG.gain.value = lv.saw
      const pulG = ctx.createGain(); pulG.gain.value = lv.pul
      const subG = ctx.createGain(); subG.gain.value = lv.sub
      oS.connect(sawG); oP.connect(pulG); oP.connect(dl); dl.connect(inv); inv.connect(pulG); oU.connect(subG)
      const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.Q.value = 0.7; hpf.frequency.value = HPF[Math.round(P.hpf)] ?? 20
      const kt = Math.pow(2, (note - 60) / 24)
      const f = lp24(ctx, clamp(P.cutoff * kt, 30, 15000), P.reso)
      const cenv = ctx.createConstantSource(); cenv.offset.value = 0
      cenv.connect(f.a.frequency); cenv.connect(f.b.frequency)
      const vca = ctx.createGain(); vca.gain.value = 0
      sawG.connect(hpf); pulG.connect(hpf); subG.connect(hpf)
      hpf.connect(f.input); f.output.connect(vca); vca.connect(bus)
      const relV = adsr(vca.gain, t, vel01(vel) * 0.2, P.a, P.d, P.s)
      const relF = adsr(cenv.offset, t, P.env, P.a, P.d, P.s)
      oS.start(t); oP.start(t); oU.start(t); cenv.start(t)
      voices.push({
        note, t0: t, rel: false, srcs: [oS, oP, oU, cenv], f, hpf, pwG, kt, f0, sawG, pulG, subG, relV, relF,
        nodes: [oS, oP, oU, dl, inv, pwG, sawG, pulG, subG, hpf, f.a, f.b, cenv, vca],
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
        if (k === 'chorus') applyChorus(false)
        if (k === 'pwmR') pLfo.frequency.setTargetAtTime(clamp(P.pwmR, 0.05, 12), t, 0.03)
        voices.forEach((v) => {
          if (k === 'cutoff') { const c = clamp(P.cutoff * v.kt, 30, 15000); v.f.a.frequency.setTargetAtTime(c, t, 0.02); v.f.b.frequency.setTargetAtTime(c, t, 0.02) }
          if (k === 'reso') v.f.a.Q.setTargetAtTime(clamp(P.reso, 0, 14), t, 0.02)
          if (k === 'hpf') v.hpf.frequency.setTargetAtTime(HPF[Math.round(P.hpf)] ?? 20, t, 0.02)
          if (k === 'pwmD') v.pwG.gain.setTargetAtTime(P.pwmD * 0.4 / v.f0, t, 0.03)
          if (k === 'mix' || k === 'sub') {
            const lv = mixLv()
            v.sawG.gain.setTargetAtTime(lv.saw, t, 0.02); v.pulG.gain.setTargetAtTime(lv.pul, t, 0.02); v.subG.gain.setTargetAtTime(lv.sub, t, 0.02)
          }
        })
      },
      dispose() {
        voices.forEach((v) => {
          v.srcs.forEach((s) => { try { s.stop() } catch { /* */ } })
          v.nodes.forEach((n) => { try { n.disconnect() } catch { /* */ } })
        })
        voices = []
        try { cLfo.stop(); pLfo.stop() } catch { /* */ }
        ;[bus, dry, wet, dL, dR, merger, cLfo, pLfo, gL, gR].forEach((n) => { try { n.disconnect() } catch { /* */ } })
      },
    }
  },
}
