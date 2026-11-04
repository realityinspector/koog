// Drum pads: eight synthesized drum voices in three kits. No samples, no DOM, no scheduling here: the engine tells playVoice
// WHEN (an AudioContext time) and HOW HARD (velocity 0..1) and where to send the sound. Each hit builds a few short-lived nodes.
//   kick, snare, closed hat, open hat (a closed hat chokes it), clap, low tom, high tom, rim / cowbell.
// Per-drum tweaks: pitch (+/- 7 semitones), decay (x0.5..x2) and tone (a low-pass: 1 = wide open).
// STABLE API: KITS, playVoice(ctx, dest, noise, kit, voice, when, vel, tweak).
import type { Tweak } from './drumCore'

export const KITS = [
  { id: 'boom', name: 'Boom', blurb: 'Deep electronic: big round kick, long snare tail.' },
  { id: 'punchy', name: 'Punchy', blurb: 'Tight and snappy: short kick, crisp snare.' },
  { id: 'tiny', name: 'Tiny', blurb: 'Chiptune-ish: little square-wave blips.' },
] as const

const mix = (c: BaseAudioContext, when: number, peak: number, attack: number, decay: number, to: AudioNode) => {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.linearRampToValueAtTime(peak, when + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay)
  g.connect(to)
  return g
}
const noiseAt = (c: BaseAudioContext, buf: AudioBuffer, when: number, dur: number) => {
  const s = c.createBufferSource(); s.buffer = buf
  s.start(when, Math.random() * (buf.duration - dur - 0.05)); s.stop(when + dur + 0.03)
  return s
}
const filt = (c: BaseAudioContext, type: BiquadFilterType, f: number, q = 0.7) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x }
const osc = (c: BaseAudioContext, type: OscillatorType, f: number, when: number, dur: number) => {
  const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(when); o.stop(when + dur + 0.03); return o
}

// the one open hat that may be ringing: its choke gain is closed by the next closed hat
let ringing: { choke: GainNode; ctx: BaseAudioContext } | null = null
function chokeOpen(when: number) {
  if (!ringing) return
  try { ringing.choke.gain.setTargetAtTime(0, when, 0.006) } catch { /* ignore */ }
  ringing = null
}
export function chokeAll(): void { ringing = null }

const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800]

export function playVoice(c: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, kit: number, voice: number, when: number, vel: number, tw: Tweak): void {
  const k = Math.min(2, Math.max(0, kit))
  const pm = Math.pow(2, (tw.pitch * 7) / 12) // pitch multiplier
  const dm = Math.pow(2, (tw.decay - 0.5) * 2) // decay multiplier
  const v = Math.min(1, Math.max(0.05, vel))
  let out: AudioNode = dest
  if (tw.tone < 0.98) { const lp = filt(c, 'lowpass', 250 * Math.pow(70, tw.tone), 0.8); lp.connect(dest); out = lp }
  const sq = k === 2 // the chiptune kit uses square/triangle waves
  switch (voice) {
    case 0: { // KICK
      const [f0, f1, dec, click] = [[125, 42, 0.55, 0.12], [210, 52, 0.26, 0.45], [170, 58, 0.17, 0.1]][k]
      const g = mix(c, when, 0.95 * v, 0.003, dec * dm, out)
      const o = osc(c, sq ? 'square' : 'sine', f0 * pm, when, dec * dm + 0.05)
      o.frequency.setValueAtTime(f0 * pm, when)
      o.frequency.exponentialRampToValueAtTime(f1 * pm, when + (k === 0 ? 0.14 : 0.07))
      if (sq) { const lp = filt(c, 'lowpass', 700); o.connect(lp); lp.connect(g) } else o.connect(g)
      if (click > 0.05) { const n = noiseAt(c, noise, when, 0.02), cg = mix(c, when, click * v, 0.001, 0.012, out); n.connect(filt(c, 'bandpass', 3200, 1)).connect(cg) }
      break
    }
    case 1: { // SNARE
      const [hp, nDec, bodyF, bodyDec, nAmt] = [[1100, 0.26, 190, 0.12, 0.55], [1800, 0.15, 230, 0.07, 0.6], [2600, 0.1, 280, 0.05, 0.5]][k]
      const ng = mix(c, when, nAmt * v, 0.002, nDec * dm, out)
      noiseAt(c, noise, when, nDec * dm).connect(filt(c, 'highpass', hp)).connect(ng)
      const bg = mix(c, when, 0.55 * v, 0.002, bodyDec * dm, out)
      const b = osc(c, sq ? 'square' : 'triangle', bodyF * pm, when, bodyDec * dm + 0.04)
      b.frequency.setValueAtTime(bodyF * 1.25 * pm, when); b.frequency.exponentialRampToValueAtTime(bodyF * pm, when + 0.05)
      b.connect(bg)
      break
    }
    case 2: case 3: { // CLOSED HAT, OPEN HAT
      const open = voice === 3
      if (!open) chokeOpen(when)
      const base = [1, 1.18, 1.5][k] * pm
      const dec = (open ? [0.4, 0.3, 0.2][k] : [0.07, 0.05, 0.035][k]) * dm
      const choke = c.createGain(); choke.gain.value = 1; choke.connect(out)
      const g = mix(c, when, (open ? 0.34 : 0.3) * v, 0.001, dec, choke)
      const hp = filt(c, 'highpass', 6800 + (k === 2 ? 1500 : 0)); hp.connect(g)
      if (k === 2) noiseAt(c, noise, when, dec).connect(hp)
      else { const bp = filt(c, 'bandpass', 10000, 0.8); bp.connect(hp); for (const f of METAL) osc(c, 'square', f * base * 1.0, when, dec).connect(bp) }
      if (open) ringing = { choke, ctx: c }
      break
    }
    case 4: { // CLAP
      const f = [1300, 1700, 2100][k]
      const bp = filt(c, 'bandpass', f * pm, 1.2); bp.connect(out)
      for (const d of [0, 0.012, 0.025]) { const g = mix(c, when + d, 0.5 * v, 0.001, 0.02, bp); noiseAt(c, noise, when + d, 0.03).connect(g) }
      const g = mix(c, when + 0.037, 0.45 * v, 0.001, [0.2, 0.12, 0.08][k] * dm, bp); noiseAt(c, noise, when + 0.037, 0.3).connect(g)
      break
    }
    case 5: case 6: { // LO TOM, HI TOM
      const hi = voice === 6
      const f0 = (hi ? [210, 280, 330] : [120, 170, 200])[k] * pm, f1 = f0 * 0.62
      const dec = [0.45, 0.25, 0.16][k] * dm
      const g = mix(c, when, 0.85 * v, 0.003, dec, out)
      const o = osc(c, sq ? 'square' : 'sine', f0, when, dec + 0.05)
      o.frequency.setValueAtTime(f0, when); o.frequency.exponentialRampToValueAtTime(f1, when + 0.12)
      if (sq) { const lp = filt(c, 'lowpass', 900); o.connect(lp); lp.connect(g) } else o.connect(g)
      break
    }
    default: { // RIM (Boom, Punchy) / cowbell-ish blip (Tiny)
      if (k === 2) {
        const g = mix(c, when, 0.32 * v, 0.002, 0.22 * dm, out)
        const bp = filt(c, 'bandpass', 900 * pm, 1.5); bp.connect(g)
        osc(c, 'square', 560 * pm, when, 0.25 * dm).connect(bp); osc(c, 'square', 845 * pm, when, 0.25 * dm).connect(bp)
      } else {
        const g = mix(c, when, 0.5 * v, 0.001, 0.05 * dm, out)
        const bp = filt(c, 'bandpass', (k === 0 ? 1700 : 2400) * pm, 1.8); bp.connect(g)
        osc(c, 'triangle', (k === 0 ? 480 : 620) * pm, when, 0.07 * dm).connect(bp)
        const ng = mix(c, when, 0.3 * v, 0.001, 0.012, out); noiseAt(c, noise, when, 0.02).connect(filt(c, 'highpass', 3000)).connect(ng)
      }
    }
  }
}

if (import.meta.hot) import.meta.hot.accept()
