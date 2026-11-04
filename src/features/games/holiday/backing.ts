// A gentle backing for Master level: a soft tick on every beat and a quiet root-and-fifth pad on each bar.
// Own capped channel (never loud), registered with panic. Pure scheduling: the engine tells it when beat 0 happens.
import { createChannel, getCtx } from '../../../audio/host'
import { registerPanicTarget } from '../../../music/panic'

interface Run { timer: number; next: number; stopAt: number }
const hot = import.meta.hot?.data as Record<string, unknown> | undefined
const rt: { run: Run | null; scheduled: number } = (hot?.holidayBacking as { run: Run | null; scheduled: number } | undefined) ?? { run: null, scheduled: 0 }
if (hot) hot.holidayBacking = rt

export interface BackingOpts {
  /** performance.now() time of the first beat of the song (after the count-in) */
  beat0Ms: number
  mpb: number
  beatsPerBar: number
  /** MIDI note of the key's tonic (any octave) */
  root: number
  totalBeats: number
  countIn: number
}

/** how many ticks have been scheduled since the last start (for tests) */
export const backingScheduled = () => rt.scheduled

function chan() { try { return { ctx: getCtx(), ch: createChannel('holiday-backing', { cap: 0.2, label: 'Holiday games backing' }) } } catch { return null } }
/** one soft count-in tick, right now */
export function tickNow(accent = false) { const c = chan(); if (c) tick(c.ctx.currentTime + 0.01, accent, c.ch.input, c.ctx) }
/** a small bell for "you nailed a phrase" (two quick notes up) */
export function chime() {
  const c = chan(); if (!c) return
  ;[[0, 79], [0.11, 84]].forEach(([dt, midi]) => {
    const o = c.ctx.createOscillator(), g = c.ctx.createGain(), t = c.ctx.currentTime + 0.02 + dt
    o.type = 'sine'; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
    o.connect(g); g.connect(c.ch.input); o.start(t); o.stop(t + 0.75)
  })
}

export function stopBacking() {
  if (rt.run) { window.clearInterval(rt.run.timer); rt.run = null }
}

function tick(t: number, accent: boolean, out: AudioNode, ctx: AudioContext) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = 'sine'; o.frequency.value = accent ? 1320 : 990
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.28, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.08)
}
function pad(t: number, midi: number, dur: number, out: AudioNode, ctx: AudioContext) {
  for (const [semi, lvl] of [[0, 0.5], [7, 0.35]] as const) {
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (midi + semi - 69) / 12)
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lvl * 0.5, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05)
  }
}

export function startBacking(o: BackingOpts) {
  stopBacking()
  let ctx: AudioContext, ch: ReturnType<typeof createChannel>
  try { ctx = getCtx(); ch = createChannel('holiday-backing', { cap: 0.2, label: 'Holiday games backing' }) } catch { return }
  const run: Run = { timer: 0, next: -o.countIn, stopAt: o.totalBeats }
  const root = 36 + (((o.root % 12) + 12) % 12)
  const pump = () => {
    const nowMs = performance.now()
    // schedule everything that falls in the next 200 ms
    while (run.next < run.stopAt && o.beat0Ms + run.next * o.mpb < nowMs + 200) {
      const beatMs = o.beat0Ms + run.next * o.mpb
      const at = ctx.currentTime + Math.max(0, (beatMs - nowMs) / 1000)
      const inBar = ((run.next % o.beatsPerBar) + o.beatsPerBar) % o.beatsPerBar
      tick(at, inBar === 0, ch.input, ctx)
      if (run.next >= 0 && inBar === 0) pad(at, root, (o.mpb * o.beatsPerBar) / 1000 * 0.95, ch.input, ctx)
      rt.scheduled++
      run.next++
    }
    if (run.next >= run.stopAt) stopBacking()
  }
  rt.scheduled = 0
  run.timer = window.setInterval(pump, 40)
  rt.run = run
  pump()
}

registerPanicTarget('holiday-backing', () => stopBacking())
if (import.meta.hot) { import.meta.hot.dispose(() => stopBacking()); import.meta.hot.accept() }
