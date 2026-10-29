// DX-style 4-operator FM: sine operators whose frequencies are modulated by other operators through gain nodes.
// Op1 is the main carrier. Algorithms: 1 = stack 4>3>2>1, 2 = two pairs (4>3 + 2>1), 3 = ops 2,3,4 all > 1.
import { adsr, clamp, hz, vel01 } from './core'
import type { EmuSpec } from './types'

const RATIOS = [0.5, 1, 2, 3, 3.5, 4, 5, 7, 14]
const VOICES = 8

interface V {
  note: number; t0: number; rel: boolean
  srcs: OscillatorNode[]; nodes: AudioNode[]
  idx: GainNode[]
  relA: Array<(rt: number, r: number) => void>
}

export const dx: EmuSpec = {
  id: 'dx', name: 'Digital FM synth (DX-style)', year: '1983', skin: 'skin-dx',
  blurb: 'FM synthesis makes one sound wave wobble the pitch of another, super fast, until it turns glassy, bell-like or bright. The DX7 (1983) was digital, played softer or harder like a piano, and its electric-piano and bell sounds ended up in countless 80s songs.',
  songs: ['gymnopedie', 'clairdelune', 'air', 'canon'], songWhy: 'DX-style FM made glassy electric pianos and bells; it was digital, and its sounds were all over 80s pop.',
  ctls: [
    { key: 'alg', label: 'Algorithm', min: 0, max: 2, def: 1, kind: 'pick', opts: ['Stack', 'Pairs', 'Triple'], group: 'Operators' },
    { key: 'r2', label: 'Op 2 ratio', min: 0, max: 8, def: 1, kind: 'pick', opts: RATIOS.map(String) },
    { key: 'r3', label: 'Op 3 ratio', min: 0, max: 8, def: 1, kind: 'pick', opts: RATIOS.map(String) },
    { key: 'r4', label: 'Op 4 ratio', min: 0, max: 8, def: 1, kind: 'pick', opts: RATIOS.map(String) },
    { key: 'depth', label: 'Mod depth', min: 0, max: 10, def: 3, step: 0.1, group: 'Brightness' },
    { key: 'mdecay', label: 'Mod decay', min: 0.05, max: 4, def: 0.6 },
    { key: 'a', label: 'Attack', min: 0.003, max: 1.5, def: 0.005, group: 'Carrier' },
    { key: 'd', label: 'Decay', min: 0.05, max: 4, def: 1.2 },
    { key: 's', label: 'Sustain', min: 0, max: 1, def: 0.2 },
    { key: 'r', label: 'Release', min: 0.03, max: 3, def: 0.4 },
  ],
  presets: [
    { name: 'Glassy e-piano', values: { alg: 1, r2: 1, r3: 1, r4: 8, depth: 2.2, mdecay: 0.7, a: 0.004, d: 1.8, s: 0.12, r: 0.35 } },
    { name: 'Tubular bell', values: { alg: 1, r2: 4, r3: 2, r4: 6, depth: 5, mdecay: 2.8, a: 0.003, d: 3.5, s: 0.0, r: 1.8 } },
    { name: 'Brass / bass', values: { alg: 0, r2: 1, r3: 1, r4: 1, depth: 3.5, mdecay: 0.5, a: 0.04, d: 0.6, s: 0.8, r: 0.15 } },
  ],
  make({ ctx, out }, P) {
    let voices: V[] = []
    const cleanup = (v: V, ms: number) => {
      voices = voices.filter((x) => x !== v)
      setTimeout(() => {
        v.srcs.forEach((s) => { try { s.stop() } catch { /* */ } })
        v.nodes.forEach((n) => { try { n.disconnect() } catch { /* */ } })
      }, ms)
    }
    const quick = (v: V) => { const t = ctx.currentTime; v.rel = true; v.relA.forEach((r) => r(t, 0.04)); cleanup(v, 160) }

    const start = (note: number, vel: number) => {
      const same = voices.find((x) => x.note === note && !x.rel); if (same) quick(same)
      if (voices.length >= VOICES) {
        const pool = voices.filter((x) => x.rel); const list = pool.length ? pool : voices
        quick(list.reduce((o, x) => (x.t0 < o.t0 ? x : o)))
      }
      const t = ctx.currentTime, f0 = hz(note), vl = vel01(vel)
      const alg = Math.round(P.alg)
      const rat = [1, RATIOS[Math.round(P.r2)] ?? 1, RATIOS[Math.round(P.r3)] ?? 1, RATIOS[Math.round(P.r4)] ?? 1]
      // alg 2: op3 is a second (quiet) carrier at its own ratio; otherwise op3 is a modulator
      const fr = rat.map((r) => f0 * r)
      const ops = fr.map((f) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = clamp(f, 8, 16000); return o })
      // [source, target, relative strength]
      const links: Array<[number, number, number]> =
        alg === 0 ? [[3, 2, 1], [2, 1, 1], [1, 0, 1]]
        : alg === 1 ? [[3, 2, 1], [1, 0, 1]]
        : [[1, 0, 1], [2, 0, 0.7], [3, 0, 0.5]]
      const carriers: Array<[number, number]> = alg === 1 ? [[0, 1], [2, 0.3]] : [[0, 1]]
      const nodes: AudioNode[] = [...ops]
      const idx: GainNode[] = []
      const relA: Array<(rt: number, r: number) => void> = []
      // velocity scales modulation depth (touch-sensitive); keep sidebands below ~12 kHz to avoid aliasing
      const base = P.depth * (0.25 + 0.75 * vl) * 0.7
      for (const [s, d, k] of links) {
        const g = ctx.createGain(); g.gain.value = 0
        const index = clamp(Math.min(base * k, 12000 / fr[s] - 1), 0, 14)
        const peak = index * fr[s]
        g.gain.setValueAtTime(peak, t)
        g.gain.setTargetAtTime(peak * 0.15, t, Math.max(0.02, P.mdecay) / 3)
        ops[s].connect(g); g.connect(ops[d].frequency)
        idx.push(g); nodes.push(g)
        relA.push((rt, r) => { g.gain.cancelScheduledValues(rt); g.gain.setValueAtTime(g.gain.value, rt); g.gain.setTargetAtTime(0, rt, Math.max(0.01, r) / 4) })
      }
      for (const [o, lvl] of carriers) {
        const ca = ctx.createGain(); ca.gain.value = 0
        ops[o].connect(ca); ca.connect(out); nodes.push(ca)
        relA.push(adsr(ca.gain, t, vl * 0.17 * lvl, P.a, P.d, P.s))
      }
      ops.forEach((o) => o.start(t))
      voices.push({ note, t0: t, rel: false, srcs: ops, nodes, idx, relA })
    }

    return {
      noteOn: start,
      noteOff(n) {
        const v = voices.find((x) => x.note === n && !x.rel); if (!v) return
        const t = ctx.currentTime; v.rel = true
        v.relA.forEach((r) => r(t, P.r))
        cleanup(v, (P.r * 1.4 + 0.25) * 1000)
      },
      allOff() { [...voices].forEach(quick) },
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
