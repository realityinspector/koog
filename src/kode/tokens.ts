// Koog Kode input layer: turns ANY musical device into one stream of Kode tokens (see kodeCore.ts and docs/KOOG_KODE.md).
//   piano notes (MIDI, computer keys, on-screen keys)   <- src/music/notes.ts onNote (read-only)
//   drum pads (hardware pads and the on-screen pads)    <- src/features/drumpads/drumEngine.ts onDrumHit (pad hits only, never the playing pattern)
//   DJ controller pads and buttons                      <- src/music/devices.ts onDjMessage (decoded by src/features/dj/map.ts)
//   foot pedal                                          <- src/features/pedal/pedal.ts usePedal (a press, the same way the holiday games start a level)
//   screen buttons                                      <- emitScreen() from any on-screen control
// STABLE API: onToken(fn) -> unsubscribe, emitToken(t), emitScreen(vel?), startKode() -> stop (reference counted; sources are only listened to while someone uses them),
//             recentTokens(), kodeActive().
// Nothing here makes a sound or changes any other feature: it only listens.
import { onNote } from '../music/notes'
import { isLocalNote } from '../music/localNotes'
import { onDrumHit } from '../features/drumpads/drumEngine'
import { onDjMessage } from '../music/devices'
import { decode } from '../features/dj/map'
import { usePedal } from '../features/pedal/pedal'
import { onStart } from '../features/pedal/startSignal'
import { buttonToken, djLane, keyToken, laneOfVoice, padToken, type KodeToken } from './kodeCore'

export type { KodeToken, KodeSrc } from './kodeCore'

type Fn = (t: KodeToken) => void
interface Hot { fns?: Set<Fn>; recent?: KodeToken[]; users?: number; off?: () => void }
const hot = (import.meta.hot?.data ?? {}) as Hot
const fns: Set<Fn> = hot.fns ?? new Set()
const recent: KodeToken[] = hot.recent ?? []
let users = hot.users ?? 0
let off: (() => void) | undefined = hot.off
const KEEP = 12

/** listen to every Kode token. Returns unsubscribe. */
export const tokenListenerCount = () => fns.size
export function onToken(fn: Fn) { fns.add(fn); return () => { fns.delete(fn) } }
/** the last few tokens, oldest first (do not modify) */
export const recentTokens = (): readonly KodeToken[] => recent
export const kodeActive = () => users > 0

/** put a token on the stream (the device listeners call this; tests and on-screen controls may too) */
export function emitToken(t: KodeToken) {
  recent.push(t)
  if (recent.length > KEEP) recent.shift()
  for (const f of [...fns]) { try { f(t) } catch (e) { console.error('[kode]', e) } }
}
/** an on-screen button (the big GO button) */
export const emitScreen = (vel = 1) => emitToken(buttonToken('screen', vel, performance.now()))

function listen() {
  const offs: (() => void)[] = [
    onNote((e) => { if (e.on && e.velocity > 0) emitToken(keyToken(isLocalNote(e) ? 'keys' : 'midi', e.note, e.velocity / 127, e.t ?? performance.now())) }),
    onDrumHit((h) => { if ((h.src ?? 'pad') === 'pad') emitToken(padToken('drums', laneOfVoice(h.voice), h.vel, h.at)) }),
    onDjMessage((data) => {
      const a = decode(data)
      if (!a || a.fine || a.value <= 0) return
      const base = String(a.id), lane = djLane(base, a.deck)
      if (lane == null || (data[0] & 0xf0) !== 0x90) return
      emitToken(padToken('dj', lane, data[2] > 0 ? data[2] / 127 : 1, performance.now()))
    }),
    usePedal.subscribe((p, prev) => { if (p.down && !prev.down) emitToken(buttonToken('pedal', 1, performance.now())) }),
    onStart(() => emitToken(buttonToken('pedal', 1, performance.now()))), // Game pads PLAY: a start press, not a pedal press
  ]
  return () => { for (const o of offs) o() }
}

/** start listening to the devices; call the returned function when your app closes */
export function startKode(): () => void {
  if (users === 0) off = listen()
  users++
  let done = false
  return () => { if (done) return; done = true; users = Math.max(0, users - 1); if (users === 0) { off?.(); off = undefined; recent.length = 0 } }
}

if (import.meta.hot) {
  import.meta.hot.data.fns = fns
  import.meta.hot.data.recent = recent
  import.meta.hot.dispose((d) => { d.users = users; d.off = off; d.fns = fns; d.recent = recent })
  import.meta.hot.accept()
}
