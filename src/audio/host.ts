// The one shared audio host. One AudioContext, one master bus, per-source channels.
//   channel.input -> capGain (cap x trim) -> master (app volume x mute x Boost, applied ONLY here) -> limiter -> makeup trim -> analyser -> destination
// STABLE API: getCtx(), unlockHost(), createChannel(id, {cap, label}) / getChannel(id), masterBus, getNoise(ctx), listChannels().
// State lives in import.meta.hot.data so editing this file never drops the context or a connected engine.
// Legacy engines (DJ, beats, band, guide, loops, mimic, fx) still own their own contexts until they migrate.
import { boostGain, outputScale, setBoost, useAudioSettings } from '../music/audioSettings'
import { registerPanicTarget } from '../music/panic'

export interface Channel {
  id: string
  label: string
  cap: number
  /** connect sources here */
  input: GainNode
  setTrim(v: number): void
  getTrim(): number
  /** latest absolute peak (0..1) of this channel after its cap x trim */
  peak(): number
  dispose(): void
}
interface ChanState { ch: Channel; capGain: GainNode; an: AnalyserNode; trim: number; buf: Float32Array<ArrayBuffer> }
interface Host {
  ctx: AudioContext
  master: GainNode
  limiter: DynamicsCompressorNode
  an: AnalyserNode
  buf: Float32Array<ArrayBuffer>
  chans: Map<string, ChanState>
  unsub?: () => void
  duck?: number
}

// One host per page, even if this file is loaded under two URLs (Vite versions edited modules with ?t=): keep it on globalThis.
const G = globalThis as unknown as { __koogHost?: Host; __koogInserts?: Map<string, { ctx: BaseAudioContext; input: AudioNode; output: AudioNode }> }
const cur = (): Host | null => G.__koogHost ?? null

/** Chrome's DynamicsCompressor adds automatic makeup gain (~2.2x at -12 dB / ratio 20); this trims it so quiet signals pass at 1x. */
const MAKEUP_TRIM = 0.46

function build(): Host {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AC({ latencyHint: 'interactive' })
  const master = ctx.createGain()
  master.gain.value = outputScale() * boostGain()
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -12; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.1
  const trim = ctx.createGain(); trim.gain.value = MAKEUP_TRIM
  const an = ctx.createAnalyser(); an.fftSize = 1024
  master.connect(limiter); limiter.connect(trim); trim.connect(an); trim.connect(ctx.destination)
  return { ctx, master, limiter, an, buf: new Float32Array(1024), chans: new Map() }
}
function host(): Host {
  let h = cur()
  if (!h || h.ctx.state === 'closed') { h = build(); G.__koogHost = h }
  if (!h.unsub) h.unsub = useAudioSettings.subscribe(applyMaster)
  return h
}

function applyMaster() {
  const h = cur(); if (!h) return
  // Boost (x2) is applied here, BEFORE the limiter. Start from the value it has right now so a quick change never leaves an old ramp behind.
  const g = h.master.gain, t = h.ctx.currentTime
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t)
  g.setTargetAtTime(outputScale() * boostGain(), t, 0.02)
}

/** The shared AudioContext (created lazily; it may be suspended until a gesture calls unlockHost). */
export const getCtx = (): AudioContext => host().ctx

/** Resume the shared context. Call it from a user gesture. Safe to call as often as you like. */
export async function unlockHost(): Promise<void> {
  const h = host()
  if (h.ctx.state !== 'running') { try { await h.ctx.resume() } catch { /* needs a gesture */ } }
  applyMaster()
}

const peakOf = (an: AnalyserNode, buf: Float32Array<ArrayBuffer>) => {
  an.getFloatTimeDomainData(buf)
  let m = 0
  for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > m) m = a }
  return m
}

/**
 * Get or create the channel for an id. Calling it again with the same id returns the same channel (so the Koog synth and
 * every emulator share 'keys'). cap = the channel's hard ceiling gain (0..1); trim (0..1) can only lower it.
 */
export function createChannel(id: string, opts: { cap: number; label?: string }): Channel {
  const h = host()
  const have = h.chans.get(id)
  if (have) return have.ch
  const ctx = h.ctx
  const input = ctx.createGain(); input.gain.value = 1
  const capGain = ctx.createGain(); capGain.gain.value = opts.cap
  const an = ctx.createAnalyser(); an.fftSize = 1024
  const ins = G.__koogInserts?.get(id) // Pedalboard insert (setChannelInsert): input -> insert -> capGain, so the cap still bounds the result
  if (ins && ins.ctx === ctx) { input.connect(ins.input); ins.output.connect(capGain) } else input.connect(capGain)
  capGain.connect(h.master); capGain.connect(an)
  const st = { trim: 1, buf: new Float32Array(1024) } as ChanState
  const cap = Math.max(0, Math.min(1, opts.cap))
  capGain.gain.value = cap
  const ch: Channel = {
    id, label: opts.label ?? id, cap, input,
    setTrim(v) { st.trim = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 1)); capGain.gain.setTargetAtTime(cap * st.trim, ctx.currentTime, 0.03) },
    getTrim: () => st.trim,
    peak: () => peakOf(an, st.buf),
    dispose() {
      h.chans.delete(id)
      try { input.disconnect(); capGain.disconnect(); an.disconnect() } catch { /* noop */ }
    },
  }
  st.ch = ch; st.capGain = capGain; st.an = an
  h.chans.set(id, st)
  return ch
}
export const getChannel = (id: string): Channel | null => cur()?.chans.get(id)?.ch ?? null
/** Put an effect chain between a channel's input and its cap (null removes it). Used by the Pedalboard on 'keys'. */
export function setChannelInsert(id: string, ins: { ctx: BaseAudioContext; input: AudioNode; output: AudioNode } | null) {
  const m = ((G.__koogInserts ??= new Map()) as Map<string, { ctx: BaseAudioContext; input: AudioNode; output: AudioNode }>)
  const old = m.get(id); const st = cur()?.chans.get(id)
  if (ins) m.set(id, ins); else m.delete(id)
  if (!st) return // the channel is not built yet: createChannel picks the insert up
  const input = st.ch.input
  try { input.disconnect(); old?.output.disconnect(st.capGain) } catch { /* not connected */ }
  if (ins) { input.connect(ins.input); ins.output.connect(st.capGain) } else input.connect(st.capGain)
}
export const listChannels = (): { id: string; label: string; cap: number; trim: number; peak: number }[] =>
  [...(cur()?.chans.values() ?? [])].map((s) => ({ id: s.ch.id, label: s.ch.label, cap: s.ch.cap, trim: s.trim, peak: s.ch.peak() }))

export const masterBus = {
  /** latest absolute peak (0..1) at the speakers' input */
  peak: (): number => ((h) => (h ? peakOf(h.an, h.buf) : 0))(cur()),
  /** how many dB the limiter is pulling down right now (<= 0) */
  reduction: (): number => cur()?.limiter.reduction ?? 0,
  /** current master gain (volume x mute x Boost) */
  gain: (): number => cur()?.master.gain.value ?? 0,
  /** the node every channel feeds (for the analyser/scope) */
  analyser: (): AnalyserNode => host().an,
}

const noiseBufs = new WeakMap<BaseAudioContext, AudioBuffer>()
/** One 2 s white-noise buffer per context (cached). */
export function getNoise(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBufs.get(ctx)
  if (b) return b
  b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  noiseBufs.set(ctx, b)
  return b
}

// Panic also turns Boost off.
registerPanicTarget('boost', () => setBoost(false))
// Panic: duck the master for a moment (engines silence themselves through their own panic targets), then restore.
registerPanicTarget('audio-host', () => {
  const h = cur(); if (!h) return
  const { ctx, master } = h
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.01)
  clearTimeout(h.duck)
  h.duck = window.setTimeout(applyMaster, 350)
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => { const h = cur(); if (h) { h.unsub?.(); h.unsub = undefined } })
  import.meta.hot.accept()
}
