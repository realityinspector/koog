// Hammond-style tonewheel organ: nine drawbars of additive sines, key click, percussion, drive, and a rotary speaker.
// Polyphonic, no envelope decay: fast attack, sustain at full, ~40 ms release.
import { clamp, hz, noise, softClip, vel01 } from './core'
import type { EmuSpec } from './types'

const RATIOS = [0.5, 1.5, 1, 2, 3, 4, 5, 6, 8]
const FOOT = ["16'", "5 1/3'", "8'", "4'", "2 2/3'", "2'", "1 3/5'", "1 1/3'", "1'"]
const BARS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8']

export const hammond: EmuSpec = {
  id: 'hammond', name: 'Tonewheel Organ', year: '1935', skin: 'skin-hammond',
  blurb: 'Laurens Hammond made an organ without pipes: spinning metal wheels made tiny electric hums, and sliding drawbars mixed them together like a recipe. It gave churches, clubs and living rooms an organ sound in a box small enough to fit through a door.',
  songs: ['toccata', 'jesu', 'prelude', 'canon'], songWhy: 'Toccata in D minor is the classic organ blockbuster; Hammond put organ sound in small spaces.',
  ctls: [
    ...BARS.map((k, i) => ({ key: k, label: FOOT[i], min: 0, max: 8, def: 0, step: 1, kind: 'slider' as const, group: i === 0 ? 'Drawbars' : undefined })),
    { key: 'perc', label: 'Percussion', min: 0, max: 2, def: 0, step: 1, kind: 'pick', opts: ['Off', '2nd', '3rd'], group: 'Extras' },
    { key: 'click', label: 'Key click', min: 0, max: 1, def: 0.3, step: 0.01 },
    { key: 'rotary', label: 'Rotary speaker', min: 0, max: 2, def: 0, step: 1, kind: 'pick', opts: ['Off', 'Slow', 'Fast'] },
    { key: 'drive', label: 'Drive', min: 0, max: 1, def: 0.15, step: 0.01 },
  ],
  presets: [
    { name: 'Smoky lounge', values: { d0: 8, d1: 8, d2: 8, d3: 0, d4: 0, d5: 0, d6: 0, d7: 0, d8: 0, perc: 2, click: 0.35, rotary: 1, drive: 0.25 } },
    { name: 'Cathedral full', values: { d0: 8, d1: 8, d2: 8, d3: 8, d4: 8, d5: 8, d6: 8, d7: 8, d8: 8, perc: 0, click: 0.15, rotary: 0, drive: 0.1 } },
    { name: 'Soft flutes', values: { d0: 0, d1: 0, d2: 6, d3: 3, d4: 0, d5: 2, d6: 0, d7: 0, d8: 0, perc: 0, click: 0.1, rotary: 1, drive: 0 } },
  ],
  make({ ctx, out }, P) {
    // shared effects bus: voices -> drive -> (dry + rotary) -> out
    const bus = ctx.createGain(); bus.gain.value = 1
    const shaper = ctx.createWaveShaper()
    const dry = ctx.createGain(); dry.gain.value = 1
    const rotAmp = ctx.createGain(); rotAmp.gain.value = 0.7
    const dl = ctx.createDelay(0.05); dl.delayTime.value = 0.003
    const wet = ctx.createGain(); wet.gain.value = 0
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.8
    const ampDepth = ctx.createGain(); ampDepth.gain.value = 0.3
    const dlDepth = ctx.createGain(); dlDepth.gain.value = 0.0012
    lfo.connect(ampDepth); ampDepth.connect(rotAmp.gain)
    lfo.connect(dlDepth); dlDepth.connect(dl.delayTime)
    bus.connect(shaper); shaper.connect(dry); dry.connect(out)
    shaper.connect(rotAmp); rotAmp.connect(dl); dl.connect(wet); wet.connect(out)
    lfo.start()
    const applyDrive = () => { shaper.curve = softClip(0.3 + clamp(P.drive, 0, 1) * 3) }
    const applyRotary = (first = false) => {
      const m = Math.round(clamp(P.rotary, 0, 2)), t = ctx.currentTime
      const speed = m === 2 ? 6.5 : 0.8
      if (first) lfo.frequency.setValueAtTime(speed, t)
      else lfo.frequency.setTargetAtTime(speed, t, m === 2 ? 0.7 : 1.5)
      dry.gain.setTargetAtTime(m === 0 ? 1 : 0.35, t, 0.05)
      wet.gain.setTargetAtTime(m === 0 ? 0 : 0.85, t, 0.05)
    }
    applyDrive(); applyRotary(true)

    interface V { oscs: OscillatorNode[]; bars: GainNode[]; env: GainNode; extra: AudioScheduledSourceNode[]; timer?: ReturnType<typeof setTimeout> }
    const voices = new Map<number, V>()
    const dying = new Set<V>()
    let dead = false
    const norm = () => {
      let total = 0
      for (const k of BARS) total += clamp(P[k], 0, 8) / 8
      return 0.12 / Math.pow(Math.max(1, total), 0.75)
    }
    const kill = (v: V, rel: number) => {
      if (dying.has(v)) return
      dying.add(v)
      const t = ctx.currentTime
      v.env.gain.cancelScheduledValues(t); v.env.gain.setValueAtTime(v.env.gain.value, t)
      v.env.gain.setTargetAtTime(0, t, Math.max(0.005, rel) / 4)
      v.timer = setTimeout(() => {
        for (const s of [...v.oscs, ...v.extra]) { try { s.stop() } catch { /* */ } }
        try { v.env.disconnect() } catch { /* */ }
        dying.delete(v)
      }, rel * 1000 + 200)
    }
    const start = (n: number, vel: number) => {
      const old = voices.get(n); if (old) { kill(old, 0.015); voices.delete(n) }
      const t = ctx.currentTime, f0 = hz(n)
      const env = ctx.createGain(); env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(0.4 + 0.6 * vel01(vel), t + 0.006)
      env.connect(bus)
      const oscs: OscillatorNode[] = [], bars: GainNode[] = [], extra: AudioScheduledSourceNode[] = []
      const nm = norm()
      RATIOS.forEach((r, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = clamp(f0 * r, 10, 12000)
        const g = ctx.createGain(); g.gain.value = (clamp(P[BARS[i]], 0, 8) / 8) * nm
        o.connect(g); g.connect(env); o.start(t); oscs.push(o); bars.push(g)
      })
      const pm = Math.round(clamp(P.perc, 0, 2))
      if (pm > 0) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = clamp(f0 * (pm === 1 ? 2 : 3), 10, 12000)
        const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.setTargetAtTime(0, t + 0.002, 0.08)
        o.connect(g); g.connect(env); o.start(t); oscs.push(o)
      }
      const ck = clamp(P.click, 0, 1)
      if (ck > 0.01) {
        const s = ctx.createBufferSource(); s.buffer = noise(ctx)
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500
        const g = ctx.createGain(); g.gain.setValueAtTime(0.05 * ck, t); g.gain.setTargetAtTime(0, t + 0.001, 0.004)
        s.connect(hp); hp.connect(g); g.connect(env); s.start(t, Math.random() * 1.5, 0.05); extra.push(s)
      }
      voices.set(n, { oscs, bars, env, extra })
    }
    return {
      noteOn(n, vel) { if (!dead) start(n, vel) },
      noteOff(n) { const v = voices.get(n); if (v) { voices.delete(n); kill(v, 0.04) } },
      allOff() { for (const v of voices.values()) kill(v, 0.04); voices.clear() },
      param(k) {
        const t = ctx.currentTime
        if (BARS.includes(k)) {
          const nm = norm()
          for (const v of voices.values()) v.bars.forEach((g, i) => g.gain.setTargetAtTime((clamp(P[BARS[i]], 0, 8) / 8) * nm, t, 0.02))
        }
        if (k === 'drive') applyDrive()
        if (k === 'rotary') applyRotary()
      },
      dispose() {
        dead = true
        for (const v of [...voices.values(), ...dying]) {
          if (v.timer) clearTimeout(v.timer)
          for (const s of [...v.oscs, ...v.extra]) { try { s.stop() } catch { /* */ } }
          try { v.env.disconnect() } catch { /* */ }
        }
        voices.clear(); dying.clear()
        try { lfo.stop() } catch { /* */ }
        try { bus.disconnect(); wet.disconnect(); dry.disconnect() } catch { /* */ }
      },
    }
  },
}
