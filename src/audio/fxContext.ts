// Small UI sound sources (challenge beeps, SONGS listen, MySongs count-in) share the 'fx' channel on the audio host
// (one AudioContext, app volume x mute and the single limiter applied there). Each use gets its own "bus": a gain node
// into the channel. Disposing a bus silences it without touching the context.
import { createChannel, getCtx, unlockHost } from './host'
import { registerPanicTarget } from '../music/panic'

export interface FxBus { ctx: AudioContext; input: GainNode; dispose: () => void }

const hot = import.meta.hot
const buses: Set<{ g: GainNode }> = (hot?.data.fxBuses as Set<{ g: GainNode }> | undefined) ?? new Set()
const MAX_CAP = 0.1
// The channel cap is the ceiling; a bus's own gain is cap/MAX_CAP (0..1) of it. Old private limiter makeup is folded into FX_MAKEUP.
const FX_MAKEUP = 1
const chan = () => createChannel('fx', { cap: MAX_CAP * FX_MAKEUP, label: 'FX' })

/** Make a fresh output bus (cap <= 0.1). Connect your nodes to `input`; sound level = cap x app volume, 0 when muted. */
export function fxBus(cap = 0.08): FxBus | null {
  try {
    const ctx = getCtx()
    void unlockHost()
    const g = ctx.createGain(); const c = Math.min(MAX_CAP, Math.max(0, cap))
    g.gain.value = c / MAX_CAP; g.connect(chan().input)
    const rec = { g }; buses.add(rec)
    return { ctx, input: g, dispose() { buses.delete(rec); try { g.gain.cancelScheduledValues(0); g.gain.value = 0; g.disconnect() } catch { /* ignore */ } } }
  } catch { return null }
}
/** Create + resume the shared context from a user gesture (so the first beep is not blocked). */
export function fxPrime() { try { chan(); void unlockHost() } catch { /* ignore */ } }
/** Silence every live bus (panic). */
export function fxSilenceAll() {
  buses.forEach((b) => { try { b.g.gain.cancelScheduledValues(0); b.g.gain.value = 0; b.g.disconnect() } catch { /* ignore */ } })
  buses.clear()
}
/** QA: current state (bus count, context state). */
export function fxDebug() { return { state: getCtx().state, buses: [...buses].map((b) => b.g.gain.value) } }

const offPanic = registerPanicTarget('fx', fxSilenceAll)

if (import.meta.hot) {
  import.meta.hot.dispose((d) => { offPanic(); d.fxBuses = buses })
  import.meta.hot.accept()
}
