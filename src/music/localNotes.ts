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
import { activeIdx, consumeLearn, onZonesRelease, routeZones, unlockZones, zoneTarget, zonesActive, zonesAllOff, useZones } from './zones'

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
interface Voice { t: Target; n: number }
interface St { id: number; held: Set<number>; sounding: Map<string, Voice[]>; midiHeld: Set<number>; off?: () => void }
const st: St = (import.meta.hot?.data.localNotes as St | undefined) ?? { id: 0, held: new Set(), sounding: new Map(), midiHeld: new Set() }
st.sounding ??= new Map(); st.midiHeld ??= new Set()
// an older version of this module kept one Target per key: let those go quietly before using the new shape
for (const [k, v] of [...st.sounding]) { if (!Array.isArray(v)) { try { (v as unknown as Target).noteOff(Number(k.slice(1))) } catch { /* ignore */ } st.sounding.delete(k) } }

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
  await Promise.all([getSynth().unlock(), currentTarget().unlock(), unlockZones()])
}

function route(key: string, note: number, velocity: number, on: boolean, canUnlock: boolean) {
  if (on) {
    for (const v of st.sounding.get(key) ?? []) v.t.noteOff(v.n)
    // keyboard zones (split/layer) decide where the note goes; null = single mode or a panel is open
    const hits = routeZones(note, velocity) ?? [{ t: currentTarget(), note, vel: velocity }]
    const voices: Voice[] = hits.map((h) => ({ t: h.t, n: h.note }))
    st.sounding.set(key, voices)
    hits.forEach((h, i) => {
      const v = voices[i]
      if (h.t.ready()) h.t.noteOn(h.note, h.vel)
      else if (canUnlock) void h.t.unlock().then(() => { if (st.sounding.get(key)?.includes(v)) h.t.noteOn(h.note, h.vel) })
    })
  } else {
    const vs = st.sounding.get(key)
    st.sounding.delete(key)
    for (const v of vs ?? []) v.t.noteOff(v.n)
  }
}

/** true for notes that came from the app itself (negative ids). */
export const isLocalNote = (e: Pick<NoteEvent, 'id'>) => e.id < 0

/** Play a note from the app. Call it from a pointer or key handler, which counts as a user gesture for audio. */
export function playLocal(note: number, velocity: number, on: boolean) {
  const ev: NoteEvent = { id: -(++st.id), note, velocity: on ? velocity : 0, on, name: NAMES[note % 12] + (Math.floor(note / 12) - 1) }
  useAppStore.setState((s) => ({ recentNotes: [ev, ...s.recentNotes].slice(0, 12) }))
  if (on) st.held.add(note); else st.held.delete(note)
  if (on && consumeLearn(note)) return // "Learn split: press a key" swallows this press
  route('L' + note, note, velocity, on, true)
}

/** Release every sounding note that was routed to a target which is no longer current (instrument swapped). */
function releaseStale() {
  const ok = new Set<Target>(zonesActive() ? activeIdx(useZones.getState().mode).map(zoneTarget) : [currentTarget()])
  for (const [k, vs] of [...st.sounding]) {
    const keep = vs.filter((v) => ok.has(v.t))
    for (const v of vs) if (!ok.has(v.t)) v.t.noteOff(v.n)
    if (keep.length) st.sounding.set(k, keep); else st.sounding.delete(k)
  }
}
/** Release everything that is sounding (zone/mode change, blur, panic). */
export function releaseAllNotes() {
  for (const vs of st.sounding.values()) for (const v of vs) v.t.noteOff(v.n)
  st.sounding.clear(); st.midiHeld.clear(); zonesAllOff()
}
/** Silence all MIDI-through notes (computer sound switched off). */
function releaseMidi() {
  for (const n of [...st.midiHeld]) route('M' + n, n, 0, false, false)
  st.midiHeld.clear()
}

st.off?.()
// Sticky user activation (any click/key on the page so far) lets MIDI notes start audio too.
const hasActivation = () => (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive === true
// MIDI plays through the computer when SYNTHESIZER is ON, or whenever an instrument was picked on purpose
// (an emulator panel is open, or a 🎹 Sound was chosen): picking one means "I want to hear THIS".
const midiThrough = () => useAudioSettings.getState().computerSound || getActiveInstrument() != null || useZones.getState().mode !== 'single'
const offNote = onNote((e) => {
  if (isLocalNote(e)) return
  if (e.on && consumeLearn(e.note)) return
  if (!e.on && st.midiHeld.has(e.note)) { st.midiHeld.delete(e.note); route('M' + e.note, e.note, 0, false, false); return }
  if (!midiThrough()) return
  if (e.on) { st.midiHeld.add(e.note); route('M' + e.note, e.note, e.velocity, true, hasActivation()) }
  else { st.midiHeld.delete(e.note); route('M' + e.note, e.note, 0, false, false) }
})
const offInst = onInstrumentChange(releaseStale)
const offZones = onZonesRelease(releaseAllNotes)
const onBlur = () => releaseAllNotes()
window.addEventListener('blur', onBlur)
const offSet = useAudioSettings.subscribe((s, prev) => { if (prev.computerSound && !s.computerSound && !getActiveInstrument() && useZones.getState().mode === 'single') releaseMidi() })
// Any click or key wakes the current instrument's audio, so the first MIDI note after it already sounds.
const wake = () => { void currentTarget().unlock().catch(() => {}); void unlockZones().catch(() => {}) }
window.addEventListener('pointerdown', wake, true)
window.addEventListener('keydown', wake, true)
st.off = () => { offNote(); offInst(); offZones(); window.removeEventListener('blur', onBlur); offSet(); window.removeEventListener('pointerdown', wake, true); window.removeEventListener('keydown', wake, true) }

if (import.meta.hot) {
  import.meta.hot.data.localNotes = st
  import.meta.hot.dispose(() => { st.off?.(); st.off = undefined })
  import.meta.hot.accept()
}
