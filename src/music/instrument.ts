// The instrument that app notes play through. Default: the Koog synth (null here). An emulator panel
// (e.g. a theremin or a classic polysynth) registers itself while it's open, and on-screen keys, typed keys
// and (with 💻 Computer sound on) the MIDI keyboard then play IT instead.
// STABLE API: setActiveInstrument(inst|null), getActiveInstrument(), onInstrumentChange(fn).
export interface PlayableInstrument {
  id: string
  name: string
  /** velocity 0..127 */
  noteOn(note: number, velocity: number): void
  noteOff(note: number): void
  allOff?(): void
  /** call from a user gesture before the first note, if it needs to start audio */
  unlock?(): Promise<void>
}
type Fn = (i: PlayableInstrument | null) => void
const hot = import.meta.hot?.data as { inst?: { active: PlayableInstrument | null; fns: Set<Fn> } } | undefined
const st = hot?.inst ?? { active: null as PlayableInstrument | null, fns: new Set<Fn>() }

export const getActiveInstrument = () => st.active
export function setActiveInstrument(i: PlayableInstrument | null) {
  if (st.active === i) return
  st.active?.allOff?.()
  st.active = i
  for (const f of [...st.fns]) f(i)
}
export function onInstrumentChange(fn: Fn) { st.fns.add(fn); return () => { st.fns.delete(fn) } }

if (import.meta.hot) {
  import.meta.hot.data.inst = st
  import.meta.hot.accept()
}
