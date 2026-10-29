// Ondes-Martenot-style: a ribbon/ring glide, finger-wobble vibrato, and four "diffuser" timbres. Mono, with field().
import { clamp, hz, noise, vel01 } from './core'
import type { EmuSpec } from './types'

const LO = 48, HI = 84
// per-timbre branch gains: [sine, reed, gamba, gong-sine, gong-noise]
const MIX: number[][] = [
  [1, 0, 0, 0, 0],
  [0.15, 0.9, 0, 0, 0],
  [0.1, 0, 0.9, 0, 0],
  [0, 0, 0, 0.8, 1],
]

export const ondes: EmuSpec = {
  id: 'ondes', name: 'Ondes Martenot', year: '1928', skin: 'skin-ondes',
  blurb: 'Maurice Martenot built this instrument so you could slide your finger on a ring and make a voice-like electronic note. Special speakers called diffusers (one even had strings that buzzed along) gave it different colours. Composers such as Olivier Messiaen wrote music for it, and it was one of the first electronic instruments to get real concert use.',
  songs: ['swan', 'gymnopedie', 'air', 'jesu', 'clairdelune'], songWhy: 'Slow, singing tunes show off the ribbon glide and the wobbly finger vibrato.',
  extra: 'field', fieldRange: [LO, HI],
  ctls: [
    { key: 'timbre', label: 'Timbre', min: 0, max: 3, def: 0, step: 1, kind: 'pick', opts: ['Sine', 'Reed', 'Gamba', 'Gong'], group: 'Diffuser' },
    { key: 'skin', label: 'Drum-skin', min: 0, max: 1, def: 0.25, step: 0.01 },
    { key: 'glide', label: 'Glide', min: 0, max: 1, def: 0.2, step: 0.01, group: 'Ribbon' },
    { key: 'vrate', label: 'Wobble rate', min: 2, max: 9, def: 5.5, step: 0.1 },
    { key: 'vdepth', label: 'Wobble depth', min: 0, max: 80, def: 15, step: 1 },
    { key: 'attack', label: 'Attack', min: 0.01, max: 0.6, def: 0.05 },
  ],
  presets: [
    { name: 'Pure ribbon', values: { timbre: 0, skin: 0.1, glide: 0.25, vrate: 5.5, vdepth: 12, attack: 0.06 } },
    { name: 'Reedy voice', values: { timbre: 1, skin: 0.3, glide: 0.12, vrate: 6, vdepth: 22, attack: 0.04 } },
    { name: 'Gong shimmer', values: { timbre: 3, skin: 0.7, glide: 0.1, vrate: 4.8, vdepth: 18, attack: 0.03 } },
  ],
  make({ ctx, out }, P) {
    const fq = ctx.createConstantSource(); fq.offset.value = 220
    const types: OscillatorType[] = ['sine', 'square', 'sawtooth']
    const oscs = types.map((ty) => { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = 0; fq.connect(o.frequency); return o })
    const lfo = ctx.createOscillator(); lfo.type = 'sine'
    const lfoG = ctx.createGain()
    oscs.forEach((o) => lfoG.connect(o.detune)); lfo.connect(lfoG)
    // branches
    const br = [0, 1, 2, 3, 4].map(() => { const g = ctx.createGain(); g.gain.value = 0; return g })
    const pre = ctx.createGain(); pre.gain.value = 0.7
    const reed = ctx.createBiquadFilter(); reed.type = 'bandpass'; reed.frequency.value = 1500; reed.Q.value = 1.2
    const gamba = ctx.createBiquadFilter(); gamba.type = 'bandpass'; gamba.frequency.value = 2400; gamba.Q.value = 2.5
    oscs[0].connect(br[0]); oscs[1].connect(reed); reed.connect(br[1]); oscs[2].connect(gamba); gamba.connect(br[2])
    oscs[0].connect(br[3])
    const nz = ctx.createBufferSource(); nz.buffer = noise(ctx); nz.loop = true
    const nzBp = ctx.createBiquadFilter(); nzBp.type = 'bandpass'; nzBp.frequency.value = 900; nzBp.Q.value = 12
    nz.connect(nzBp); nzBp.connect(br[4])
    br.forEach((g) => g.connect(pre))
    // sympathetic "drum-skin" resonance
    const send = ctx.createGain(); send.gain.value = 0
    const res = ctx.createBiquadFilter(); res.type = 'bandpass'; res.frequency.value = 260; res.Q.value = 9
    const resG = ctx.createGain(); resG.gain.value = 1.2
    pre.connect(send); send.connect(res); res.connect(resG)
    const vca = ctx.createGain(); vca.gain.value = 0
    pre.connect(vca); resG.connect(vca); vca.connect(out)
    oscs.forEach((o) => o.start()); fq.start(); lfo.start(); nz.start(0, Math.random() * 1.5)
    const applyVib = () => { lfo.frequency.value = clamp(P.vrate, 0.5, 12); lfoG.gain.value = clamp(P.vdepth, 0, 200) }
    const applyTimbre = () => {
      const m = MIX[Math.round(clamp(P.timbre, 0, 3))] ?? MIX[0]; const t = ctx.currentTime
      br.forEach((g, i) => g.gain.setTargetAtTime(m[i], t, 0.02))
    }
    const applySkin = () => {
      const s = clamp(P.skin, 0, 1), t = ctx.currentTime
      send.gain.setTargetAtTime(s * 0.5, t, 0.03)
    }
    applyVib(); applyTimbre(); applySkin()
    const stack: number[] = []
    let sounding = false, level = 0, dead = false
    const pitch = (f: number, tau: number) => {
      const t = ctx.currentTime, fr = clamp(f, 20, 4000)
      fq.offset.cancelScheduledValues(t)
      if (!sounding) fq.offset.setValueAtTime(fr, t)
      else fq.offset.setTargetAtTime(fr, t, Math.max(0.004, tau))
    }
    const setLevel = (l: number, tau: number) => {
      const t = ctx.currentTime
      vca.gain.cancelScheduledValues(t)
      vca.gain.setTargetAtTime(clamp(l, 0, 0.5), t, Math.max(0.004, tau))
      level = l
    }
    const glideTau = () => 0.005 + clamp(P.glide, 0, 1) * 0.2
    const attackTau = () => clamp(P.attack, 0.01, 0.6) / 3
    return {
      noteOn(n, vel) {
        if (dead) return
        const i = stack.indexOf(n); if (i >= 0) stack.splice(i, 1)
        stack.push(n)
        pitch(hz(n), glideTau())
        const l = 0.15 + 0.3 * vel01(vel)
        setLevel(l, l >= level ? attackTau() : 0.04)
        sounding = true
      },
      noteOff(n) {
        const i = stack.indexOf(n); if (i >= 0) stack.splice(i, 1)
        if (stack.length) { pitch(hz(stack[stack.length - 1]), glideTau()); return }
        setLevel(0, 0.05); sounding = false
      },
      allOff() { stack.length = 0; setLevel(0, 0.012); sounding = false },
      field(x, y) {
        if (dead) return
        if (x == null) { setLevel(0, 0.08); sounding = false; return }
        const note = LO + clamp(x, 0, 1) * (HI - LO)
        pitch(hz(note), 0.01 + clamp(P.glide, 0, 1) * 0.12)
        const l = 0.45 * Math.pow(clamp(y ?? 0.7, 0, 1), 1.5)
        setLevel(l, l >= level ? attackTau() : 0.04)
        sounding = true
      },
      param(k) {
        if (k === 'vrate' || k === 'vdepth') applyVib()
        if (k === 'timbre') applyTimbre()
        if (k === 'skin') applySkin()
      },
      dispose() {
        dead = true
        try { oscs.forEach((o) => o.stop()); fq.stop(); lfo.stop(); nz.stop() } catch { /* */ }
        try { vca.disconnect() } catch { /* */ }
      },
    }
  },
}
