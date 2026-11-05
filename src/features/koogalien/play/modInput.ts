// Mod wheel (MIDI CC1) and pitch bend -> ModSample, plus the on-screen slider path (emitMod). One stream, additive wiring through the existing piano-role MIDI feed.
import type { ModSample } from '../../../koogalien/data/types'
import { subscribe } from '../../../midi/router'

type Listener = (s: ModSample) => void
const hot = import.meta.hot
const listeners: Set<Listener> = hot ? ((hot.data.koogalienModListeners ??= new Set<Listener>()) as Set<Listener>) : new Set<Listener>()

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** a sample from the on-screen slider or anything else that is not MIDI */
export function emitMod(s: ModSample): void {
  const v = s.kind === 'bend' ? clamp(Number(s.value) || 0, -1, 1) : clamp(Number(s.value) || 0, 0, 1)
  const out: ModSample = { kind: s.kind, value: v, t: Number.isFinite(s.t) ? s.t : nowMs() }
  for (const l of [...listeners]) { try { l(out) } catch (e) { console.error('[koogalien mod]', e) } }
}

/** raw MIDI bytes -> ModSample, or null when it is neither CC1 nor pitch bend */
export function modFromMidi(d: ArrayLike<number>, t = nowMs()): ModSample | null {
  if (!d || d.length < 3) return null
  const st = d[0] & 0xf0
  if (st === 0xb0 && d[1] === 1) return { kind: 'wheel', value: clamp(d[2] / 127, 0, 1), t }
  if (st === 0xe0) return { kind: 'bend', value: clamp((((d[2] & 0x7f) << 7) | (d[1] & 0x7f)) - 8192, -8192, 8191) / 8192, t }
  return null
}

/** start listening; returns stop */
export function startModInput(on: (s: ModSample) => void): () => void {
  listeners.add(on)
  let last = ''
  const unsub = subscribe('piano', (d) => {
    const s = modFromMidi(d)
    if (!s) return
    const key = s.kind + s.value.toFixed(4)
    if (key === last) return
    last = key
    emitMod(s)
  })
  return () => { listeners.delete(on); unsub() }
}
