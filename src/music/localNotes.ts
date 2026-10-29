// Notes played ON the app (clicking the on-screen keys, or the computer keyboard)
// rather than on the MIDI keyboard.
//
// 1. One shared id counter. Local notes use negative ids, MIDI uses positive ones, and
//    onNote() tells events apart by id, so two separate counters could collide and drop notes.
// 2. They make sound. The on-screen keys have no speaker, so they play through the
//    Koog synth (the same patch as the 🎛️ Patch drawer). Notes from the MIDI keyboard
//    don't sound here, because the keyboard may have its own speakers.
import { useAppStore, type NoteEvent } from '../store/appStore'
import { getSynth } from '../features/synth-history/engine'

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const st: { id: number; held: Set<number> } =
  (import.meta.hot?.data.localNotes as { id: number; held: Set<number> } | undefined) ?? { id: 0, held: new Set() }

/** true for notes that came from the app itself (negative ids). */
export const isLocalNote = (e: Pick<NoteEvent, 'id'>) => e.id < 0

/** Play a note from the app. Call it from a pointer or key handler, which counts as a user gesture for audio. */
export function playLocal(note: number, velocity: number, on: boolean) {
  const ev: NoteEvent = { id: -(++st.id), note, velocity: on ? velocity : 0, on, name: NAMES[note % 12] + (Math.floor(note / 12) - 1) }
  useAppStore.setState((s) => ({ recentNotes: [ev, ...s.recentNotes].slice(0, 12) }))
  const synth = getSynth()
  if (on) {
    st.held.add(note)
    if (synth.ready) synth.noteOn(note, velocity)
    else void synth.unlock().then(() => { if (st.held.has(note)) synth.noteOn(note, velocity) })
  } else {
    st.held.delete(note)
    if (synth.ready) synth.noteOff(note)
  }
}

if (import.meta.hot) {
  import.meta.hot.data.localNotes = st
  import.meta.hot.accept()
}
