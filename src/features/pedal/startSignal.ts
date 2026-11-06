// "Start / go on" as its OWN signal. The Game pads PLAY button (src/features/padplay) used to fake a foot-pedal press by
// flipping usePedal.down, so everything that listens to the pedal (the looper's pedal rules, Kode tokens, MIDI-sustain UI)
// saw a pedal that was never pressed. Now PLAY says "start" here; games that want "pedal or PLAY" listen to both.
type Fn = () => void
type Hot = { subs?: Set<Fn> }
const hot = (import.meta.hot?.data ?? {}) as Hot
const subs: Set<Fn> = hot.subs ?? new Set()
/** somebody pressed a start button (a game pad's PLAY). Never touches the looper or the pedal state. */
export function emitStart() { for (const f of [...subs]) { try { f() } catch { /* ignore */ } } }
export function onStart(fn: Fn): () => void { subs.add(fn); return () => { subs.delete(fn) } }
if (import.meta.hot) {
  import.meta.hot.data.subs = subs
  import.meta.hot.accept()
}
