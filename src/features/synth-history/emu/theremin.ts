// Theremin-style: one persistent near-sine oscillator, pitch glide, vibrato, and a slow-ish "volume antenna" attack.
// Plays through field(x,y) (hand position) or through ordinary notes (mono, last note wins).
import { clamp, hz, vel01 } from './core'
import type { EmuSpec } from './types'

const LO = 48, HI = 84

export const theremin: EmuSpec = {
  id: 'theremin', name: 'Theremin', year: '1920', skin: 'skin-theremin',
  blurb: 'Leon Theremin invented an instrument you play without touching it: your hand near one antenna changes the pitch, and your other hand near a second antenna changes the volume. It was one of the very first electronic instruments, and its eerie, singing slide gave old science-fiction movies their spooky sound.',
  songs: ['swan', 'gymnopedie', 'air', 'clairdelune', 'jesu'], songWhy: "Saint-Saens' The Swan suits the theremin's singing glide.",
  extra: 'field', fieldRange: [LO, HI],
  ctls: [
    { key: 'glide', label: 'Glide', min: 0, max: 1, def: 0.15, step: 0.01, group: 'Hand' },
    { key: 'attack', label: 'Volume attack', min: 0.02, max: 1, def: 0.15 },
    { key: 'vrate', label: 'Vibrato rate', min: 2, max: 9, def: 5.5, step: 0.1, group: 'Vibrato' },
    { key: 'vdepth', label: 'Vibrato depth', min: 0, max: 80, def: 18, step: 1 },
    { key: 'bright', label: 'Brightness', min: 0, max: 1, def: 0.3, step: 0.01, group: 'Tone' },
  ],
  presets: [
    { name: 'Spooky sweep', values: { glide: 0.6, attack: 0.3, vrate: 4.5, vdepth: 30, bright: 0.2 } },
    { name: 'Singing lady', values: { glide: 0.15, attack: 0.12, vrate: 5.8, vdepth: 22, bright: 0.4 } },
    { name: 'Steady beam', values: { glide: 0.03, attack: 0.05, vrate: 6, vdepth: 4, bright: 0.6 } },
  ],
  make({ ctx, out }, P) {
    const wave = ctx.createPeriodicWave(new Float32Array(4), new Float32Array([0, 1, 0.12, 0.04]))
    const osc = ctx.createOscillator(); osc.setPeriodicWave(wave); osc.frequency.value = 220
    const lfo = ctx.createOscillator(); lfo.type = 'sine'
    const lfoG = ctx.createGain()
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.5
    const vca = ctx.createGain(); vca.gain.value = 0
    const applyVib = () => { lfo.frequency.value = clamp(P.vrate, 0.5, 12); lfoG.gain.value = clamp(P.vdepth, 0, 200) }
    const applyTone = (tc = 0) => tone.frequency.setTargetAtTime(1200 + clamp(P.bright, 0, 1) * 5000, ctx.currentTime, tc || 0.001)
    applyVib(); applyTone()
    lfo.connect(lfoG); lfoG.connect(osc.detune)
    osc.connect(tone); tone.connect(vca); vca.connect(out)
    osc.start(); lfo.start()
    const stack: number[] = []
    let sounding = false, level = 0, dead = false
    const pitch = (f: number, tau: number) => {
      const t = ctx.currentTime, fr = clamp(f, 20, 4000)
      osc.frequency.cancelScheduledValues(t)
      if (!sounding) osc.frequency.setValueAtTime(fr, t)
      else osc.frequency.setTargetAtTime(fr, t, Math.max(0.004, tau))
    }
    const setLevel = (l: number, tau: number) => {
      const t = ctx.currentTime
      vca.gain.cancelScheduledValues(t)
      vca.gain.setTargetAtTime(clamp(l, 0, 0.5), t, Math.max(0.004, tau))
      level = l
    }
    const glideTau = () => 0.01 + clamp(P.glide, 0, 1) * 0.25
    const attackTau = () => clamp(P.attack, 0.02, 1) / 3
    return {
      noteOn(n, vel) {
        if (dead) return
        const i = stack.indexOf(n); if (i >= 0) stack.splice(i, 1)
        stack.push(n)
        pitch(hz(n), glideTau())
        const l = 0.15 + 0.35 * vel01(vel)
        setLevel(l, l >= level ? attackTau() : 0.05)
        sounding = true
      },
      noteOff(n) {
        const i = stack.indexOf(n); if (i >= 0) stack.splice(i, 1)
        if (stack.length) { pitch(hz(stack[stack.length - 1]), glideTau()); return }
        setLevel(0, 0.06); sounding = false
      },
      allOff() { stack.length = 0; setLevel(0, 0.012); sounding = false },
      field(x, y) {
        if (dead) return
        if (x == null) { setLevel(0, 0.1); sounding = false; return }
        const note = LO + clamp(x, 0, 1) * (HI - LO)
        pitch(hz(note), 0.012 + clamp(P.glide, 0, 1) * 0.15)
        const l = 0.5 * Math.pow(clamp(y ?? 0.7, 0, 1), 1.5)
        setLevel(l, l >= level ? attackTau() : 0.04)
        sounding = true
      },
      param(k) {
        if (k === 'vrate' || k === 'vdepth') applyVib()
        if (k === 'bright') applyTone(0.02)
      },
      dispose() {
        dead = true
        try { osc.stop(); lfo.stop() } catch { /* */ }
        try { vca.disconnect() } catch { /* */ }
      },
    }
  },
}
