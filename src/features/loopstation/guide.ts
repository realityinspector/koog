// The Loop Station's rhythm guide + count-in click: tiny synthesized voices (click, kick, snare, hat) on the shared audio host's 'guide' channel,
// scheduled on the 16th-note grid of the master clock with the Web Audio clock (so it is sample-accurate against itself).
// Quiet by design: channel cap 0.2 (the app volume and the one limiter are in the host). STABLE API: useGuide, setGuide, playClick, guidePeak.
import { registerPanicTarget } from '../../music/panic'
import { create } from 'zustand'
import { beatPos, isRunning, onTick, timeOfBeat } from '../../music/masterClock'
import { createChannel, getChannel, getCtx, getNoise, unlockHost } from '../../audio/host'

const GUIDE_CAP = 0.2
const MAKEUP = 1.12 // fixed makeup: the old per-engine limiter was ~1.2 dB louder than the shared one (measured 0.108 vs 0.094)

export type GuidePat = 'click' | 'rock' | 'funk'
export const GUIDE_PATS: [GuidePat, string][] = [['click', 'Click'], ['rock', 'Rock'], ['funk', 'Funk']]
// 16 steps per bar: K kick, S snare, h hat, H accented hat, c click, C accented click
const PAT: Record<GuidePat, string> = {
  click: 'C...c...c...c...',
  rock: 'K.h.S.h.K.hKS.h.',
  funk: 'Kh.hS.hhh.KhSh.h',
}
interface St { on: boolean; pat: GuidePat; vol: number }
type Hot = { store?: ReturnType<typeof make>; g?: G; off?: () => void }
interface G { ctx: AudioContext | null; out: GainNode | null; an: AnalyserNode | null; noise: AudioBuffer | null; next: number; hits: { expect: number; at: number; ch: string }[]; count: number }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<St>()(() => ({ on: false, pat: 'rock', vol: 0.8 })) }
export const useGuide = hot.store ?? make()
const G: G = hot.g ?? { ctx: null, out: null, an: null, noise: null, next: 0, hits: [], count: 0 }
export const setGuide = (p: Partial<St>) => useGuide.setState(p)

function ensureCtx(): AudioContext | null {
  try {
    const ch = createChannel('guide', { cap: GUIDE_CAP, label: 'GUIDE' })
    const c = getCtx()
    if (G.ctx !== c || !G.out) {
      const out = c.createGain()
      out.connect(ch.input)
      G.ctx = c; G.out = out; G.an = null; G.noise = getNoise(c)
    }
    if (c.state !== 'running') void unlockHost()
    G.out!.gain.value = MAKEUP * useGuide.getState().vol
    return c
  } catch { return null }
}
/** call from a click / key / pad press so the browser lets the guide make sound */
export const unlockGuide = () => { ensureCtx() }
export function guidePeak(): number {
  return getChannel('guide')?.peak() ?? 0
}

function voice(ch: string, at: number) {
  const c = G.ctx!, o = G.out!
  const env = (peak: number, dur: number) => { const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(peak, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); g.connect(o); return g }
  if (ch === 'K') { const x = c.createOscillator(); x.frequency.setValueAtTime(130, at); x.frequency.exponentialRampToValueAtTime(42, at + 0.12); x.connect(env(0.9, 0.18)); x.start(at); x.stop(at + 0.2) }
  else if (ch === 'S') {
    const n = c.createBufferSource(); n.buffer = G.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800
    n.connect(f); f.connect(env(0.5, 0.14)); n.start(at); n.stop(at + 0.16)
    const t = c.createOscillator(); t.type = 'triangle'; t.frequency.value = 190; t.connect(env(0.35, 0.09)); t.start(at); t.stop(at + 0.1)
  } else if (ch === 'h' || ch === 'H') {
    const n = c.createBufferSource(); n.buffer = G.noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000
    n.connect(f); f.connect(env(ch === 'H' ? 0.28 : 0.16, 0.035)); n.start(at); n.stop(at + 0.05)
  } else {
    const x = c.createOscillator(); x.frequency.value = ch === 'C' ? 1500 : 1000; x.connect(env(ch === 'C' ? 0.6 : 0.4, 0.05)); x.start(at); x.stop(at + 0.06)
  }
}
/** one count-in / metronome click now */
export function playClick(accent: boolean) { const c = ensureCtx(); if (c) voice(accent ? 'C' : 'c', c.currentTime) }

function schedule(now: number) {
  const st = useGuide.getState()
  if (!st.on || !isRunning()) return
  const c = ensureCtx(); if (!c || c.state !== 'running') return
  const to = now + 120
  if (G.next < Math.floor(beatPos(now) * 4) - 2) G.next = Math.ceil(beatPos(now) * 4)
  const pat = PAT[st.pat]
  while (timeOfBeat(G.next / 4) < to) {
    const ch = pat[((G.next % 16) + 16) % 16], when = timeOfBeat(G.next / 4)
    if (ch !== '.' && when >= now - 5) {
      voice(ch, c.currentTime + Math.max(0, (when - now) / 1000))
      G.count++
      G.hits.push({ expect: when, at: performance.now() + Math.max(0, when - now), ch }); if (G.hits.length > 200) G.hits.shift()
    }
    G.next++
  }
}

hot.off?.()
const off = onTick(schedule)
if (import.meta.hot) {
  import.meta.hot.data.store = useGuide
  import.meta.hot.data.g = G
  import.meta.hot.data.off = off
  import.meta.hot.accept()
}
registerPanicTarget('guide', () => setGuide({ on: false }))
