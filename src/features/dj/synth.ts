// Synthesized DJ material (no samples, nothing copyrighted): two original 4-bar loops, each split into four stems
// (DRUMS / BASS / SYNTH / VOX), plus four sampler hits. Everything is rendered once in an OfflineAudioContext.
// Ported from mixtrack-academy/public/js/audio.js. Pure functions, no state.
import type { Key } from '../../music/theory'

export const BPM = 120
export const BEAT = 60 / BPM // 0.5 s
export const LEN = BEAT * 16 // 4 bars = 8 s loop
export const STEM_NAMES = ['DRUMS', 'BASS', 'SYNTH', 'VOX'] as const
export const SAMPLE_NAMES = ['BOOM', 'CLAP', 'CHORD', 'ZAP'] as const
const SR = 44100

type OC = OfflineAudioContext
const noiseCache = new WeakMap<OC, AudioBuffer>()
function noise(oc: OC) {
  let b = noiseCache.get(oc)
  if (!b) {
    b = oc.createBuffer(1, SR, SR)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noiseCache.set(oc, b)
  }
  return b
}
interface ToneOpts { det?: number; lp?: number; atk?: number; rel?: number }
function tone(oc: OC, type: OscillatorType, f: number, t: number, dur: number, peak: number, o: ToneOpts = {}) {
  const osc = oc.createOscillator(); osc.type = type; osc.frequency.value = f
  if (o.det) osc.detune.value = o.det
  const g = oc.createGain(); let n: AudioNode = osc
  if (o.lp) { const fl = oc.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; osc.connect(fl); n = fl }
  n.connect(g); g.connect(oc.destination)
  const atk = o.atk ?? 0.005, rel = o.rel ?? 0.06
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + atk)
  g.gain.setValueAtTime(peak, t + Math.max(atk, dur - 0.02))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel)
  osc.start(t); osc.stop(t + dur + rel + 0.02)
}
function hit(oc: OC, t: number, dur: number, peak: number, filt: { type: BiquadFilterType; f: number; q?: number }) {
  const s = oc.createBufferSource(); s.buffer = noise(oc)
  const fl = oc.createBiquadFilter(); fl.type = filt.type; fl.frequency.value = filt.f; if (filt.q) fl.Q.value = filt.q
  const g = oc.createGain()
  s.connect(fl); fl.connect(g); g.connect(oc.destination)
  g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02)
}
function kick(oc: OC, t: number, peak = 0.9, low = 45) {
  const o = oc.createOscillator(), g = oc.createGain()
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(low, t + 0.12)
  g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
  o.connect(g); g.connect(oc.destination); o.start(t); o.stop(t + 0.4)
}
const hat = (oc: OC, t: number, p = 0.18, len = 0.05) => hit(oc, t, len, p, { type: 'highpass', f: 7500 })
const snare = (oc: OC, t: number, p = 0.5) => { hit(oc, t, 0.16, p, { type: 'bandpass', f: 1900, q: 0.8 }); tone(oc, 'triangle', 190, t, 0.05, p * 0.5, { rel: 0.08 }) }
const clap = (oc: OC, t: number, p = 0.5) => {
  for (let i = 0; i < 3; i++) hit(oc, t + i * 0.011, 0.07, p, { type: 'bandpass', f: 1500, q: 1.2 })
  hit(oc, t + 0.033, 0.18, p, { type: 'bandpass', f: 1500, q: 1.2 })
}
function vox(oc: OC, t: number, f: number, dur: number, p = 0.2) {
  for (const [ff, q, gn] of [[700, 6, 1], [1200, 8, 0.7]]) {
    const o = oc.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f
    const fl = oc.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = ff; fl.Q.value = q
    const g = oc.createGain()
    o.connect(fl); fl.connect(g); g.connect(oc.destination)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p * gn * 3, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.start(t); o.stop(t + dur + 0.02)
  }
}

export interface TrackInfo { name: string; key: Key; chords: number[][]; roots: number[] }
/** Chords: A track = Am F C G (A minor). B track = Dm Bb F C (D minor). The DJ key follows the playing track. */
export const TRACKS: Record<'A' | 'B', TrackInfo> = {
  A: { name: 'Sunrise', key: { tonic: 9, scale: 'minor' }, chords: [[220, 261.63, 329.63], [174.61, 220, 261.63], [130.81, 164.81, 196], [196, 246.94, 293.66]], roots: [110, 87.31, 65.41, 98] },
  B: { name: 'Night Drive', key: { tonic: 2, scale: 'minor' }, chords: [[146.83, 174.61, 220], [116.54, 146.83, 174.61], [174.61, 220, 261.63], [130.81, 164.81, 196]], roots: [73.42, 58.27, 87.31, 65.41] },
}

type StemFn = (oc: OC) => void
const STEMS: Record<'A' | 'B', StemFn[]> = {
  A: [
    (oc) => { for (let b = 0; b < 16; b++) { const t = b * BEAT; kick(oc, t); hat(oc, t + BEAT / 2); if (b % 4 === 1 || b % 4 === 3) clap(oc, t, 0.35) } },
    (oc) => { for (let s = 0; s < 32; s++) { const bar = Math.floor(s / 8), t = (s * BEAT) / 2; tone(oc, 'sawtooth', TRACKS.A.roots[bar] * (s % 4 === 3 ? 2 : 1), t, BEAT * 0.4, 0.4, { lp: 420 }) } },
    (oc) => { for (let s = 0; s < 64; s++) { const bar = Math.floor(s / 16), c = TRACKS.A.chords[bar]; tone(oc, 'square', c[s % 3] * 2, (s * BEAT) / 4, (BEAT / 4) * 0.8, 0.09, { lp: 2800 }) } },
    (oc) => { for (let bar = 0; bar < 4; bar++) { const c = TRACKS.A.chords[bar]; vox(oc, (bar * 4 + 1.5) * BEAT, c[1] * 2, BEAT * 0.9); vox(oc, (bar * 4 + 3.5) * BEAT, c[2] * 2, BEAT * 0.9) } },
  ],
  B: [
    (oc) => { for (let bar = 0; bar < 4; bar++) { for (const k of [0, 1.75, 2.5]) kick(oc, (bar * 4 + k) * BEAT, 0.85, 50); snare(oc, (bar * 4 + 1) * BEAT); snare(oc, (bar * 4 + 3) * BEAT); for (let i = 0; i < 16; i++) hat(oc, (bar * 4 + i / 4) * BEAT, i % 2 ? 0.07 : 0.14, 0.03) } },
    (oc) => { for (let s = 0; s < 32; s++) { if (s % 2 === 1) tone(oc, 'sawtooth', TRACKS.B.roots[Math.floor(s / 8)], (s * BEAT) / 2, BEAT * 0.45, 0.45, { lp: 380 }) } },
    (oc) => { for (let bar = 0; bar < 4; bar++) for (const f of TRACKS.B.chords[bar]) for (const det of [-8, 8]) tone(oc, 'sawtooth', f, bar * 4 * BEAT, BEAT * 3.8, 0.07, { lp: 1300, det, atk: 0.25, rel: 0.3 }) },
    (oc) => { for (let bar = 0; bar < 4; bar++) { const c = TRACKS.B.chords[bar]; vox(oc, bar * 4 * BEAT, c[2] * 2, BEAT * 1.2); vox(oc, (bar * 4 + 1.5) * BEAT, c[1] * 2, BEAT * 0.8); vox(oc, (bar * 4 + 2.5) * BEAT, c[0] * 4, BEAT * 1.2) } },
  ],
}

const SAMPLES: StemFn[] = [
  (oc) => { kick(oc, 0, 1, 35); hit(oc, 0, 0.5, 0.4, { type: 'lowpass', f: 400 }) },
  (oc) => { clap(oc, 0, 0.8) },
  (oc) => { for (const f of [261.63, 329.63, 392]) tone(oc, 'sawtooth', f, 0, 0.5, 0.2, { lp: 1800, rel: 0.2 }) },
  (oc) => { const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(2400, 0); o.frequency.exponentialRampToValueAtTime(180, 0.5); g.gain.setValueAtTime(0.5, 0); g.gain.exponentialRampToValueAtTime(0.0001, 0.55); o.connect(g); g.connect(oc.destination); o.start(0); o.stop(0.6) },
]

async function renderBuf(len: number, fn: StemFn): Promise<AudioBuffer> {
  const oc = new OfflineAudioContext(1, Math.ceil(SR * len), SR)
  fn(oc)
  return oc.startRendering()
}
export async function renderAll() {
  const stems = (k: 'A' | 'B') => Promise.all(STEMS[k].map((fn) => renderBuf(LEN, fn)))
  const [A, B, samples] = await Promise.all([stems('A'), stems('B'), Promise.all(SAMPLES.map((fn) => renderBuf(0.8, fn)))])
  return { A, B, samples }
}
