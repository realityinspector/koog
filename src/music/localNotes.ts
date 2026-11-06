// Notes played ON the app (clicking the on-screen keys, or the computer keyboard)
// rather than on the MIDI keyboard.
//
// 1. One shared id counter. Local notes use negative ids, MIDI uses positive ones, and
//    onNote() tells events apart by id, so two separate counters could collide and drop notes.
// 2. They make sound, through ONE routing point (see "routing" below): the active emulator
//    instrument if one is open, otherwise the Koog synth. With 💻 Computer sound on, notes from the
//    MIDI keyboard (positive ids) are routed to the same target.
import { registerPanicTarget } from './panic'
import { type NoteEvent } from '../store/appStore'
import { getSynth } from '../features/synth-history/engine'
import { getActiveInstrument, onInstrumentChange, type PlayableInstrument } from './instrument'
import { useAudioSettings } from './audioSettings'
import { onNote, pushNote } from './notes'
import { activeIdx, consumeLearn, onZonesRelease, routeZones, unlockZones, zoneTarget, zonesActive, zonesAllOff, useZones } from './zones'
import { PC_NAMES } from './theory'
import { unlockHost } from '../audio/host'

interface Voice { t: Target; n: number }
interface St { id: number; held: Set<number>; sounding: Map<string, Voice[]>; midiHeld: Set<number>; sus?: Map<string, Voice[]>; pedal?: boolean; sos?: Set<string>; sosV?: Map<string, Voice[]>; sosOn?: boolean; soft?: number; half?: number; oct?: number[]; octMix?: number; fast?: number; off?: () => void }
const st: St = (import.meta.hot?.data.localNotes as St | undefined) ?? { id: 0, held: new Set(), sounding: new Map(), midiHeld: new Set() }
st.sounding ??= new Map(); st.midiHeld ??= new Set(); st.sus ??= new Map(); st.sos ??= new Set(); st.sosV ??= new Map()
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
    for (const v of st.sus!.get(key) ?? []) v.t.noteOff(v.n) // re-striking a sustained key restarts it
    st.sus!.delete(key)
    for (const v of st.sosV!.get(key) ?? []) v.t.noteOff(v.n); st.sosV!.delete(key); st.sos!.delete(key) // re-striking a sostenuto-held key restarts it
    if (st.soft) velocity = Math.max(1, Math.round(velocity * (1 - 0.45 * st.soft))) // soft pedal: quieter (the Pedalboard also darkens the tone)
    // keyboard zones (split/layer) decide where the note goes; null = single mode or a panel is open
    const hits0 = routeZones(note, velocity) ?? [{ t: currentTarget(), note, vel: velocity }]
    const hits = st.oct?.length ? withOctaves(hits0) : hits0 // Octave pedal: the same note one octave down / up, a bit softer
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
    if (st.sos!.has(key) && vs?.length) { st.sosV!.set(key, vs); return } // sostenuto: this key was already down when the pedal went down, so it keeps ringing
    if (st.pedal && vs?.length) { st.sus!.set(key, vs); return } // sustain pedal down: the note rings until the pedal lifts
    if (st.half && vs?.length) { // half pedal: the damper only partly touches the string, so the note fades a little later
      st.sus!.set(key, vs)
      setTimeout(() => { if (st.sus!.get(key) === vs && !st.pedal) { for (const v of vs) v.t.noteOff(v.n); st.sus!.delete(key) } }, 120 + st.half * 1500)
      return
    }
    for (const v of vs ?? []) v.t.noteOff(v.n)
  }
}

function withOctaves(hits: { t: Target; note: number; vel: number }[]) {
  const out = hits.slice()
  for (const h of hits) for (const s of st.oct!) { const n = h.note + s; if (n >= 0 && n <= 127) out.push({ t: h.t, note: n, vel: Math.max(1, Math.round(h.vel * (st.octMix ?? 0.6))) }) }
  return out
}
/** Soft pedal (una corda), 0..1: quieter notes. The Pedalboard (features/pedalboard) darkens the tone to match. */
export function setSoftPedal(level: number) { st.soft = Math.min(1, Math.max(0, level)) }
/** Half pedal, 0..1 (a continuous sustain pedal pressed less than halfway): released notes ring a little longer. 0 = off. */
export function setHalfSustain(level: number) { st.half = Math.min(1, Math.max(0, level)) }
/** Sostenuto: while down, only the keys that are held RIGHT NOW keep ringing when released. */
export function setSostenuto(down: boolean) {
  if (down) { if (st.sosOn) return; st.sosOn = true; st.sos!.clear(); for (const k of st.sounding.keys()) st.sos!.add(k); return }
  st.sosOn = false; st.sos!.clear()
  for (const vs of st.sosV!.values()) for (const v of vs) v.t.noteOff(v.n)
  st.sosV!.clear()
}
/** Octave pedal: extra notes at these semitone offsets (e.g. [-12]); [] or null = off. mix = their loudness vs the played note (0..1). */
export function setOctavePedal(shifts: number[] | null, mix = 0.6) { st.oct = shifts && shifts.length ? shifts : undefined; st.octMix = mix }
/** true for notes that came from the app itself (negative ids). */
export const isLocalNote = (e: Pick<NoteEvent, 'id'>) => e.id < 0

/** Play a note from the app. Call it from a pointer or key handler, which counts as a user gesture for audio. */
export function playLocal(note: number, velocity: number, on: boolean) {
  const ev: NoteEvent = { id: -(++st.id), note, velocity: on ? velocity : 0, on, name: PC_NAMES[note % 12] + (Math.floor(note / 12) - 1) }
  if (on) st.held.add(note); else st.held.delete(note)
  // SOUND FIRST: the synth starts before the store update fans out to the judge, visuals, games and looper
  if (!(on && consumeLearn(note))) route('L' + note, note, velocity, on, true) // "Learn split: press a key" swallows this press
  pushNote(ev)
}

/** MIDI note from the keyboard, sounded BEFORE the note event reaches the store (see connection.ts). Returns the handled flag the onNote listener below uses to skip its own copy. */
export function midiSoundFirst(id: number, note: number, velocity: number, on: boolean) {
  st.fast = id
  if (on && consumeLearn(note)) return
  if (!on && st.midiHeld.has(note)) { st.midiHeld.delete(note); route('M' + note, note, 0, false, false); return }
  if (!midiThrough()) return
  if (on) { st.midiHeld.add(note); route('M' + note, note, velocity, true, hasActivation()) }
  else { st.midiHeld.delete(note); route('M' + note, note, 0, false, false) }
}

/** Release every sounding note that was routed to a target which is no longer current (instrument swapped). */
function releaseStale() {
  const ok = new Set<Target>(zonesActive() ? activeIdx(useZones.getState().mode).map(zoneTarget) : [currentTarget()])
  for (const [k, vs] of [...st.sounding]) {
    const keep = vs.filter((v) => ok.has(v.t))
    for (const v of vs) if (!ok.has(v.t)) v.t.noteOff(v.n)
    if (keep.length) st.sounding.set(k, keep); else st.sounding.delete(k)
  }
  for (const [k, vs] of [...st.sus!]) { for (const v of vs) if (!ok.has(v.t)) v.t.noteOff(v.n); const keep = vs.filter((v) => ok.has(v.t)); if (keep.length) st.sus!.set(k, keep); else st.sus!.delete(k) }
}
/** Release everything that is sounding (zone/mode change, blur, panic). */
/** Sustain pedal (the USB foot pedal, see features/pedal): while down, released keys keep ringing; lifting it lets them go. */
export function setSustain(down: boolean) {
  st.pedal = down
  if (down) return
  for (const vs of st.sus!.values()) for (const v of vs) v.t.noteOff(v.n)
  st.sus!.clear()
}
export const isSustainDown = () => !!st.pedal
export function releaseAllNotes() {
  for (const vs of st.sus!.values()) for (const v of vs) v.t.noteOff(v.n)
  st.sus!.clear(); st.pedal = false
  for (const vs of st.sosV!.values()) for (const v of vs) v.t.noteOff(v.n)
  st.sosV!.clear(); st.sos!.clear(); st.sosOn = false
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
// A plugged-in keyboard plays through the computer only while Computer sound is ON.
// On-screen keys and the computer keyboard use playLocal and ignore this switch.
const midiThrough = () => useAudioSettings.getState().computerSound
const offNote = onNote((e) => {
  if (isLocalNote(e)) return
  if (e.id === st.fast) return // connection.ts already sounded this one before the store update
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
const offSet = useAudioSettings.subscribe((s, prev) => { if (prev.computerSound && !s.computerSound) releaseMidi() })
const getSynthReadyNow = () => synthTarget.ready() && currentTarget().ready()
// Any click or key wakes the current instrument's audio, so the first MIDI note after it already sounds.
const wake = () => { if (getSynthReadyNow() && !zonesActive()) return; void unlockHost().catch(() => {}); void currentTarget().unlock().catch(() => {}); void unlockZones().catch(() => {}) }
/** Warm the audio graph (resume the context, build the synth voices) so the first note is not late. connection.ts calls this when a keyboard connects. */
export function warmAudio() { if (hasActivation()) wake() }
window.addEventListener('pointerdown', wake, true)
window.addEventListener('keydown', wake, true)
st.off = () => { offNote(); offInst(); offZones(); window.removeEventListener('blur', onBlur); offSet(); window.removeEventListener('pointerdown', wake, true); window.removeEventListener('keydown', wake, true) }

if (import.meta.hot) {
  import.meta.hot.data.localNotes = st
  import.meta.hot.dispose(() => { st.off?.(); st.off = undefined })
  import.meta.hot.accept()
}
registerPanicTarget('localNotes', releaseAllNotes)
