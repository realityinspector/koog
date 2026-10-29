// Notes played ON the app (clicking the on-screen keys, or the computer keyboard)
// rather than on the MIDI keyboard.
//
// 1. One shared id counter. Local notes use negative ids, MIDI uses positive ones, and
//    onNote() tells events apart by id, so two separate counters could collide and drop notes.
// 2. They make sound, through ONE routing point (see "routing" below): the active emulator
//    instrument if one is open, otherwise the Koog synth. With 💻 Computer sound on, notes from the
//    MIDI keyboard (positive ids) are routed to the same target.
import { useAppStore, type NoteEvent } from '../store/appStore'
import { getSynth } from '../features/synth-history/engine'
import { getActiveInstrument, onInstrumentChange, type PlayableInstrument } from './instrument'
import { useAudioSettings } from './audioSettings'
import { onNote } from './notes'

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
interface St { id: number; held: Set<number>; sounding: Map<string, Target>; midiHeld: Set<number>; off?: () => void }
const st: St = (import.meta.hot?.data.localNotes as St | undefined) ?? { id: 0, held: new Set(), sounding: new Map(), midiHeld: new Set() }
st.sounding ??= new Map(); st.midiHeld ??= new Set()

// ---- routing: local notes (and MIDI-through) go to getActiveInstrument() ?? the Koog synth ----
interface Target { noteOn(n: number, v: number): void; noteOff(n: number): void; allOff(): void; unlock(): Promise<void>; ready(): boolean }
const synthTarget: Target = {
  noteOn: (n, v) => getSynth().noteOn(n, v),
  noteOff: (n) => getSynth().noteOff(n),
  allOff: () => getSynth().panic(),
  unlock: () => getSynth().unlock(),
  ready: () => getSynth().ready,
}
const instTargets = new WeakMap<PlayableInstrument, Target>()
function instTarget(i: PlayableInstrument): Target {
  let t = instTargets.get(i)
  if (!t) {
    let unlocked = !i.unlock
    t = {
      noteOn: (n, v) => i.noteOn(n, v), noteOff: (n) => i.noteOff(n), allOff: () => i.allOff?.(),
      unlock: async () => { if (!unlocked) { await i.unlock?.(); unlocked = true } },
      ready: () => unlocked,
    }
    instTargets.set(i, t)
  }
  return t
}
const currentTarget = (): Target => { const i = getActiveInstrument(); return i ? instTarget(i) : synthTarget }

/** Unlock audio for the synth and the active instrument. Call from a user gesture. */
export async function unlockAudio() {
  await Promise.all([getSynth().unlock(), currentTarget().unlock()])
}

function route(key: string, note: number, velocity: number, on: boolean, canUnlock: boolean) {
  if (on) {
    const t = currentTarget()
    st.sounding.get(key)?.noteOff(note)
    st.sounding.set(key, t)
    if (t.ready()) t.noteOn(note, velocity)
    else if (canUnlock) void t.unlock().then(() => { if (st.sounding.get(key) === t) t.noteOn(note, velocity) })
  } else {
    const t = st.sounding.get(key)
    st.sounding.delete(key)
    t?.noteOff(note)
  }
}

/** true for notes that came from the app itself (negative ids). */
export const isLocalNote = (e: Pick<NoteEvent, 'id'>) => e.id < 0

/** Play a note from the app. Call it from a pointer or key handler, which counts as a user gesture for audio. */
export function playLocal(note: number, velocity: number, on: boolean) {
  const ev: NoteEvent = { id: -(++st.id), note, velocity: on ? velocity : 0, on, name: NAMES[note % 12] + (Math.floor(note / 12) - 1) }
  useAppStore.setState((s) => ({ recentNotes: [ev, ...s.recentNotes].slice(0, 12) }))
  if (on) st.held.add(note); else st.held.delete(note)
  route('L' + note, note, velocity, on, true)
}

/** Release every sounding note that was routed to a target which is no longer current (instrument swapped). */
function releaseStale() {
  const cur = currentTarget()
  for (const [k, t] of [...st.sounding]) {
    if (t !== cur) { t.noteOff(Number(k.slice(1))); st.sounding.delete(k) }
  }
}
/** Silence all MIDI-through notes (computer sound switched off). */
function releaseMidi() {
  for (const n of [...st.midiHeld]) route('M' + n, n, 0, false, false)
  st.midiHeld.clear()
}

st.off?.()
const offNote = onNote((e) => {
  if (isLocalNote(e) || !useAudioSettings.getState().computerSound) return
  if (e.on) { st.midiHeld.add(e.note); route('M' + e.note, e.note, e.velocity, true, false) }
  else { st.midiHeld.delete(e.note); route('M' + e.note, e.note, 0, false, false) }
})
const offInst = onInstrumentChange(releaseStale)
const offSet = useAudioSettings.subscribe((s, prev) => { if (prev.computerSound && !s.computerSound) releaseMidi() })
st.off = () => { offNote(); offInst(); offSet() }

if (import.meta.hot) {
  import.meta.hot.data.localNotes = st
  import.meta.hot.dispose(() => { st.off?.(); st.off = undefined })
  import.meta.hot.accept()
}
