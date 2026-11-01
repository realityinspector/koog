// Panic registry: every sound module registers a "silence me" function; panicAll runs them all, then
// sends All Notes Off (CC123) and All Sound Off (CC120) on every MIDI channel. Volume and mute stay as they are.
// STABLE API: registerPanicTarget(name, fn) -> unregister, panicAll({hard?}), panicTargets().
// The map lives in import.meta.hot.data (survives edits). It is read through a function, never a module-level
// const, so a module that registers during an import cycle (panic -> midi -> localNotes -> panic) cannot hit a TDZ error.
import { sendMidi } from '../midi/connection'

type Fn = (hard: boolean) => void
function T(): Map<string, Fn> {
  const d = (import.meta.hot?.data ?? (globalThis as Record<string, unknown>)) as { panicTargets?: Map<string, Fn> }
  return (d.panicTargets ??= new Map())
}

export function registerPanicTarget(name: string, fn: (hard?: boolean) => void): () => void {
  const f: Fn = fn
  T().set(name, f)
  return () => { if (T().get(name) === f) T().delete(name) }
}
export const panicTargets = () => [...T().keys()]

export function panicAll(opts?: { hard?: boolean }) {
  const hard = !!opts?.hard
  T().forEach((fn) => { try { fn(hard) } catch { /* keep going */ } })
  try { for (let ch = 0; ch < 16; ch++) { sendMidi([0xb0 | ch, 123, 0]); sendMidi([0xb0 | ch, 120, 0]) } } catch { /* ignore */ }
}

if (import.meta.hot) { import.meta.hot.accept() }
