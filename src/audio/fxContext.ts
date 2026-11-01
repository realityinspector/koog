// One lazily created AudioContext shared by the small UI sound sources (challenge beeps, SONGS listen,
// MySongs count-in). Each use gets its own "bus": gain = cap x outputScale() (live, follows volume/mute),
// then a shared DynamicsCompressor limiter. Disposing a bus silences it without closing the context.
import { useAudioSettings, outputScale } from '../music/audioSettings'
import { registerPanicTarget } from '../music/panic'

export interface FxBus { ctx: AudioContext; input: GainNode; dispose: () => void }
interface Shared { ctx: AudioContext; limiter: DynamicsCompressorNode; buses: Set<{ g: GainNode; cap: number }> }

const hot = import.meta.hot
let shared: Shared | null = (hot?.data.fx as Shared | undefined) ?? null
const MAX_CAP = 0.1

function ensure(): Shared | null {
  if (shared && shared.ctx.state !== 'closed') return shared
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -12; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.1
    // Chrome's compressor adds automatic makeup gain (~2.2x at these settings); trim it back so the bus cap is the true ceiling.
    const trim = ctx.createGain(); trim.gain.value = 0.46
    limiter.connect(trim); trim.connect(ctx.destination)
    shared = { ctx, limiter, buses: new Set() }
    return shared
  } catch { return null }
}

const applyScale = () => {
  if (!shared) return
  const s = outputScale()
  shared.buses.forEach((b) => { try { b.g.gain.setTargetAtTime(b.cap * s, shared!.ctx.currentTime, 0.01) } catch { /* ignore */ } })
}
const unsub = useAudioSettings.subscribe(applyScale)

/** Make a fresh output bus (cap <= 0.1). Connect your nodes to `input`; sound level = cap x app volume, 0 when muted. */
export function fxBus(cap = 0.08): FxBus | null {
  const sh = ensure(); if (!sh) return null
  void sh.ctx.resume().catch(() => { /* ignore */ })
  const g = sh.ctx.createGain(); const c = Math.min(MAX_CAP, Math.max(0, cap))
  g.gain.value = c * outputScale(); g.connect(sh.limiter)
  const rec = { g, cap: c }; sh.buses.add(rec)
  return { ctx: sh.ctx, input: g, dispose() { sh.buses.delete(rec); try { g.gain.cancelScheduledValues(0); g.gain.value = 0; g.disconnect() } catch { /* ignore */ } } }
}
/** Create + resume the shared context from a user gesture (so the first beep is not blocked). */
export function fxPrime() { const sh = ensure(); if (sh) void sh.ctx.resume().catch(() => { /* ignore */ }) }
/** Silence every live bus (panic). */
export function fxSilenceAll() {
  if (!shared) return
  shared.buses.forEach((b) => { try { b.g.gain.cancelScheduledValues(0); b.g.gain.value = 0; b.g.disconnect() } catch { /* ignore */ } })
  shared.buses.clear()
}
/** QA: current peak-ish state (bus count, context state). */
export function fxDebug() { return { state: shared?.ctx.state ?? 'none', buses: shared ? [...shared.buses].map((b) => b.g.gain.value) : [] } }

const offPanic = registerPanicTarget('fx', fxSilenceAll)

if (import.meta.hot) {
  import.meta.hot.dispose((d) => { unsub(); offPanic(); d.fx = shared })
  import.meta.hot.accept()
}
