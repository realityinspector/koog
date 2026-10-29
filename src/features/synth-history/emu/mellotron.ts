// Mellotron-style tape keyboard, SYNTHESIZED (no recordings): strings / flute / choir with tape wobble, age darkness,
// hiss, and the famous 8-second tape limit. Polyphonic, up to 8 voices (oldest stolen).
import { clamp, hz, noise, vel01 } from './core'
import type { EmuSpec } from './types'

const TAPE_SECS = 8, MAX_VOICES = 8

export const mellotron: EmuSpec = {
  id: 'mellotron', name: 'Tape Keyboard', year: '1963', skin: 'skin-mellotron',
  blurb: 'Each key on a Mellotron pressed a strip of recorded tape against a spinning roller, so one keyboard could sound like a whole orchestra. The tape only lasted about eight seconds before it ran out, so players learned to release the key and press again.',
  note: 'The real Mellotron played tape recordings, which we cannot use. This is a synthesized approximation of tape strings, flute and choir, with tape wobble and the 8-second tape limit.',
  extra: 'tape',
  songs: ['jesu', 'air', 'morning', 'swan', 'gymnopedie'], songWhy: 'Mellotron strings and flutes sound dreamy on slow melodies like Morning (Grieg); its fame came from 1960s-70s rock, but these old tunes are public domain.',
  ctls: [
    { key: 'tape', label: 'Tape', min: 0, max: 2, def: 0, step: 1, kind: 'pick', opts: ['Strings', 'Flute', 'Choir'], group: 'Tape' },
    { key: 'wobble', label: 'Wobble', min: 0, max: 1, def: 0.35, step: 0.01 },
    { key: 'age', label: 'Age', min: 0, max: 1, def: 0.4, step: 0.01 },
    { key: 'attack', label: 'Attack', min: 0.01, max: 1.2, def: 0.12, group: 'Feel' },
    { key: 'rel', label: 'Release', min: 0.05, max: 1.5, def: 0.25 },
  ],
  presets: [
    { name: 'Dreamy strings', values: { tape: 0, wobble: 0.35, age: 0.4, attack: 0.25, rel: 0.4 } },
    { name: 'Breathy flute', values: { tape: 1, wobble: 0.3, age: 0.3, attack: 0.08, rel: 0.2 } },
    { name: 'Old choir', values: { tape: 2, wobble: 0.6, age: 0.7, attack: 0.3, rel: 0.5 } },
  ],
  make({ ctx, out }, P) {
    // shared tape wobble: slow wow + two flutters, in cents, fed to every voice's detune
    const mk = (f: number) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); o.connect(g); o.start(); return { o, g } }
    const wow = mk(0.55), fl1 = mk(7.3), fl2 = mk(11.9)
    const applyWob = () => {
      const w = clamp(P.wobble, 0, 1), t = ctx.currentTime
      wow.g.gain.setTargetAtTime(w * 22, t, 0.03); fl1.g.gain.setTargetAtTime(w * 7, t, 0.03); fl2.g.gain.setTargetAtTime(w * 4, t, 0.03)
    }
    applyWob()
    const cutoff = () => 700 * Math.pow(13, 1 - clamp(P.age, 0, 1)) // age 0 ~9000 Hz, age 1 ~700 Hz
    interface V { srcs: AudioScheduledSourceNode[]; dets: AudioParam[]; tone: BiquadFilterNode; vca: GainNode; tapeG: GainNode; fin: AudioNode; timers: ReturnType<typeof setTimeout>[]; done: boolean }
    const voices = new Map<number, V>()
    const order: number[] = []
    const dying = new Set<V>()
    let dead = false
    const teardown = (v: V) => {
      if (v.done) return
      v.done = true; v.timers.forEach(clearTimeout)
      for (const d of v.dets) { for (const s of [wow, fl1, fl2]) { try { s.g.disconnect(d) } catch { /* */ } } }
      for (const s of v.srcs) { try { s.stop() } catch { /* */ } }
      try { v.fin.disconnect() } catch { /* */ }
      dying.delete(v)
    }
    const release = (v: V, rel: number) => {
      if (v.done || dying.has(v)) return
      dying.add(v)
      const t = ctx.currentTime
      v.vca.gain.cancelScheduledValues(t); v.vca.gain.setValueAtTime(v.vca.gain.value, t)
      v.vca.gain.setTargetAtTime(0, t, Math.max(0.005, rel) / 4)
      v.timers.forEach(clearTimeout)
      v.timers = [setTimeout(() => teardown(v), rel * 1000 + 200)]
    }
    const start = (n: number, vel: number) => {
      const old = voices.get(n); if (old) { release(old, 0.02); voices.delete(n); order.splice(order.indexOf(n), 1) }
      while (order.length >= MAX_VOICES) { const o = order.shift()!; const v = voices.get(o); if (v) { release(v, 0.03); voices.delete(o) } }
      const t = ctx.currentTime, f0 = hz(n), kind = Math.round(clamp(P.tape, 0, 2))
      const vca = ctx.createGain(); vca.gain.setValueAtTime(0, t)
      vca.gain.linearRampToValueAtTime(0.35 + 0.65 * vel01(vel), t + clamp(P.attack, 0.01, 1.2))
      const tapeG = ctx.createGain(); tapeG.gain.value = 1
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.6; tone.frequency.value = cutoff()
      const body = ctx.createGain(); body.gain.value = 1
      body.connect(tone); tone.connect(tapeG); tapeG.connect(vca); vca.connect(out)
      const srcs: AudioScheduledSourceNode[] = [], dets: AudioParam[] = []
      const osc = (type: OscillatorType, mult: number, cents: number, gain: number, dst: AudioNode) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = clamp(f0 * mult, 10, 12000); o.detune.value = cents
        const g = ctx.createGain(); g.gain.value = gain
        o.connect(g); g.connect(dst); o.start(t); srcs.push(o); dets.push(o.detune)
        for (const s of [wow, fl1, fl2]) s.g.connect(o.detune)
      }
      const noiseBand = (freq: number, q: number, gain: number, dst: AudioNode) => {
        const s = ctx.createBufferSource(); s.buffer = noise(ctx); s.loop = true
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = clamp(q, 0.1, 14)
        const g = ctx.createGain(); g.gain.value = gain
        s.connect(bp); bp.connect(g); g.connect(dst); s.start(t, Math.random() * 1.5); srcs.push(s)
      }
      if (kind === 0) {
        osc('sawtooth', 1, -9, 0.07, body); osc('sawtooth', 1, 0, 0.07, body); osc('sawtooth', 1, 9, 0.07, body)
      } else if (kind === 1) {
        osc('triangle', 1, 0, 0.22, body); osc('sine', 2, 3, 0.05, body)
        noiseBand(2600, 2, 0.12, body)
      } else {
        const sum = ctx.createGain(); sum.gain.value = 0.18; sum.connect(body)
        const pre = ctx.createGain(); pre.gain.value = 1
        osc('sawtooth', 1, -6, 0.25, pre); osc('sawtooth', 1, 6, 0.25, pre)
        for (const [fr, q, g] of [[800, 6, 1], [1150, 6, 0.55], [2800, 5, 0.3]] as const) {
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = clamp(q, 0.1, 14)
          const bg = ctx.createGain(); bg.gain.value = g
          pre.connect(bp); bp.connect(bg); bg.connect(sum)
        }
      }
      // tape hiss floor (slightly louder as it ages)
      const hs = ctx.createBufferSource(); hs.buffer = noise(ctx); hs.loop = true
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500
      const hg = ctx.createGain(); hg.gain.value = 0.004 + 0.012 * clamp(P.age, 0, 1)
      hs.connect(hp); hp.connect(hg); hg.connect(tapeG); hs.start(t, Math.random() * 1.5); srcs.push(hs)
      // THE 8-SECOND LIMIT: fade out + pitch droop over 0.4 s, then the tape is spent
      const te = t + TAPE_SECS
      tapeG.gain.setValueAtTime(1, te); tapeG.gain.linearRampToValueAtTime(0, te + 0.4)
      for (const d of dets) { d.setValueAtTime(d.value, te); d.linearRampToValueAtTime(d.value - 300, te + 0.4) }
      const v: V = { srcs, dets, tone, vca, tapeG, fin: vca, timers: [], done: false }
      v.timers.push(setTimeout(() => { teardown(v); if (voices.get(n) === v) { voices.delete(n); const i = order.indexOf(n); if (i >= 0) order.splice(i, 1) } }, (TAPE_SECS + 0.6) * 1000))
      voices.set(n, v); order.push(n)
    }
    return {
      noteOn(n, vel) { if (!dead) start(n, vel) },
      noteOff(n) {
        const v = voices.get(n); if (!v) return
        voices.delete(n); const i = order.indexOf(n); if (i >= 0) order.splice(i, 1)
        release(v, clamp(P.rel, 0.05, 1.5))
      },
      allOff() { for (const v of voices.values()) release(v, 0.04); voices.clear(); order.length = 0 },
      param(k) {
        if (k === 'wobble') applyWob()
        if (k === 'age') { const t = ctx.currentTime; for (const v of voices.values()) v.tone.frequency.setTargetAtTime(cutoff(), t, 0.05) }
      },
      dispose() {
        dead = true
        for (const v of [...voices.values(), ...dying]) teardown(v)
        voices.clear(); dying.clear(); order.length = 0
        for (const s of [wow, fl1, fl2]) { try { s.o.stop() } catch { /* */ } }
      },
    }
  },
}
