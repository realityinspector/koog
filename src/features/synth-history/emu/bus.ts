// A small bus between the emulator engines and anything that wants to watch or steer them from outside a panel
// (Controller Mode: src/features/controller). It tracks the live engines, announces every set(), and lets a panel
// glow the control the hardware just touched. State lives in import.meta.hot.data so editing never drops an engine.
import type { Engine } from './core'

type SetFn = (e: Engine, key: string, val: number) => void
interface Bus { engines: Engine[]; sets: Set<SetFn>; seq: Set<() => void>; glow: { key: string; t: number }; glowFns: Set<() => void> }
const hot = import.meta.hot?.data as { bus?: Bus } | undefined
const B: Bus = hot?.bus ?? { engines: [], sets: new Set(), seq: new Set(), glow: { key: '', t: 0 }, glowFns: new Set() }

export const registerEngine = (e: Engine) => { if (!B.engines.includes(e)) B.engines.push(e) }
export const unregisterEngine = (e: Engine) => { B.engines = B.engines.filter((x) => x !== e) }
/** the most recently created live engine (a panel opened later wins over the headless "sound" engine) */
export const newestEngine = (): Engine | null => B.engines[B.engines.length - 1] ?? null
export const onEmuSet = (fn: SetFn) => { B.sets.add(fn); return () => { B.sets.delete(fn) } }
export const emitEmuSet = (e: Engine, key: string, val: number) => { for (const f of [...B.sets]) { try { f(e, key, val) } catch { /* isolate */ } } }
/** the 303 pattern changed from outside the panel */
export const onSeqChange = (fn: () => void) => { B.seq.add(fn); return () => { B.seq.delete(fn) } }
export const emitSeqChange = () => { for (const f of [...B.seq]) { try { f() } catch { /* isolate */ } } }
/** which control key the hardware touched last (for the panel glow) */
export const touchKey = (key: string) => { B.glow = { key, t: performance.now() }; for (const f of [...B.glowFns]) f() }
export const onGlow = (fn: () => void) => { B.glowFns.add(fn); return () => { B.glowFns.delete(fn) } }
export const glowState = () => B.glow

if (import.meta.hot) {
  import.meta.hot.data.bus = B
  import.meta.hot.accept()
}
