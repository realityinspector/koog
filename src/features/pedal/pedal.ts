// Foot pedal (optional). Two kinds work:
//   * a sustain pedal plugged into the MIDI keyboard: it sends CC 64 (no setup needed)
//   * a single-switch USB pedal, which shows up as a keyboard and "types" one key. The browser can't tell that key apart
//     from the computer keyboard, so we LEARN it: "Set up pedal", press the pedal, and that key (by e.code) becomes the pedal.
// Then the pedal does one job:
//   auto     the loop station's big button while the loop station is on screen, sustain everywhere else (the default)
//            (the Drums page: kick). 'loop' behaves the same unless "pedal always runs the looper" (loopAlways, off by default) is on.
//   sustain  hold = notes keep ringing on the piano / synth / emulators (like a piano's damper pedal), lift = they stop
//   loop     the loop station's big button, in one of two styles (loopStyle):
//              simple (default): tap = record / close the loop and keep it playing / add a layer, two quick taps = stop all, hold 2 s = clear all (5 s Undo clear)
//              classic: tap = record / close / add a layer, double-tap = stop, hold = undo / redo
//   beat     tap = start / stop the beat (master clock)
// The pedal key is swallowed (so it doesn't also play a note), except while typing in a text box.
// If pressing the pedal clicks the mouse instead of typing a key, set it to send a key with the pedal's own setup app.
import { isWebDemo } from '../../web/webDemo'
import { create } from 'zustand'
import { setHalfSustain, setSustain } from '../../music/localNotes'
import { setSoft, setSostenuto } from '../pedalboard/pianoPedals'
import { stompSelected } from '../pedalboard/boardEngine'
import { bigDown, bigUp, isLooperOpen } from '../loopstation/loopEngine'
import { LOOP_STYLES, type LoopStyle } from '../loopstation/loopCore'
import { subscribe as subscribeMidi } from '../../midi/router'
import { isRunning, startMaster, stopMaster } from '../../music/masterClock'
import { registerPanicTarget } from '../../music/panic'
import { drumPageActive, kickDown, kickUp } from '../drumpads/pedalKick'

export type PedalAction = 'auto' | 'sustain' | 'loop' | 'beat' | 'kick' | 'soft' | 'sostenuto' | 'stomp' | 'off'
export const PEDAL_ACTIONS: [PedalAction, string, string][] = [
  ['auto', 'Automatic', 'Plays the kick while the drum pads are open, runs the loop station while the looper is open, and holds your notes everywhere else, like a piano pedal.'],
  ['sustain', 'Sustain (piano / synth)', 'Hold it down and your notes keep ringing, like a piano pedal. Lift it and they stop.'],
  ['loop', 'Loop station', 'Tap: record, then tap again to loop it. Tap to add a layer. Two quick taps: stop. Hold 2 s: clear (see the looper style below). While the looper is closed, the pedal holds notes unless Pedal always runs the looper is on.'],
  ['beat', 'Beat', 'Tap to start or stop the beat.'],
  ['kick', 'Kick drum', 'Plays the KICK drum on the Drums page. Automatic does this by itself while the drum pads are open.'],
  ['soft', 'Soft pedal (quieter, mellower)', 'Hold it down and the piano plays quieter and softer, like the left pedal on a piano.'],
  ['sostenuto', 'Sostenuto (hold chosen notes)', 'Play some notes, press and hold the pedal, then let go of the keys: only those notes keep ringing, like the middle pedal on a piano.'],
  ['stomp', 'Pedalboard stomp', 'Each tap switches the selected effect pedal (Fuzz, Echo, Wobble...) on or off. Pick which one in the Pedalboard.'],
  ['off', 'Off', 'The pedal does nothing.'],
]
export { LOOP_STYLES }
export type { LoopStyle }
interface PedalState { /** 'loop' (and the MIDI sustain pedal) may run the looper even when no looper is on screen. OFF by default. */ loopAlways: boolean; code: string | null; action: PedalAction; /** how the looper reads the pedal */ loopStyle: LoopStyle; learning: boolean; down: boolean; /** a MIDI sustain pedal (CC 64) was seen */ midi: boolean }
const KEY = 'koog.pedal'
function load(): Pick<PedalState, 'code' | 'action' | 'loopStyle' | 'loopAlways'> {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || '{}')
    // version 1 saved 'sustain' as the default: move those to 'auto' once (a later pick is saved with v: 2 and kept)
    const action: PedalAction = PEDAL_ACTIONS.some(([a]) => a === j.action) ? (j.v !== 2 && j.action === 'sustain' ? 'auto' : j.action) : 'auto'
    return { code: typeof j.code === 'string' ? j.code : null, action, loopStyle: j.ls === 'classic' ? 'classic' : 'simple', loopAlways: j.la === true }
  } catch { return { code: null, action: 'auto', loopStyle: 'simple', loopAlways: false } }
}
const hot = import.meta.hot?.data as { pedal?: { store: ReturnType<typeof make>; off?: () => void } } | undefined
function make() { return create<PedalState>()(() => ({ ...load(), learning: false, down: false, midi: false })) }
const H = hot?.pedal ?? { store: make(), off: undefined as (() => void) | undefined }
export const usePedal = H.store
if (!H.store.getState().loopStyle) H.store.setState({ loopStyle: load().loopStyle })
if (H.store.getState().loopAlways === undefined) H.store.setState({ loopAlways: false }) // an HMR session keeps the old store
const save = () => { const { code, action, loopStyle, loopAlways } = usePedal.getState(); try { localStorage.setItem(KEY, JSON.stringify({ v: 2, code, action, ls: loopStyle, la: loopAlways })) } catch { /* ignore */ } }

export function learnPedal(on = true) { release(); usePedal.setState({ learning: on }) }
export function setPedalAction(a: PedalAction) { release(); usePedal.setState({ action: a }); save() }
export function setLoopStyle(l: LoopStyle) { release(); usePedal.setState({ loopStyle: l }); save() }
/** "pedal always runs the looper" (off by default): with it off, the looper only hears the pedal while it is on screen */
export function setLoopAlways(on: boolean) { release(); usePedal.setState({ loopAlways: on }); save() }
export function forgetPedal() { release(); usePedal.setState({ code: null, learning: false }); save() }
/** label for a key code, e.g. "KeyB" -> "B", "F13" -> "F13" */
export const pedalKeyLabel = (code: string) => code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ')

/** what the pedal does right now ('auto' resolved: the looper while it is on screen, otherwise sustain) */
export function pedalJob(a = usePedal.getState().action): Exclude<PedalAction, 'auto'> {
  const job = a === 'auto' ? (drumPageActive() ? 'kick' : isLooperOpen() ? 'loop' : 'sustain') : a
  // the looper acts ONLY while it is on screen (the dock or the Boss LOOPS screen), unless "pedal always runs the looper" is on
  return job === 'loop' && !isLooperOpen() && !usePedal.getState().loopAlways ? 'sustain' : job
}
let held: PedalAction | null = null
function press(at?: number) {
  if (held) return
  const a = pedalJob()
  if (a === 'off') return
  held = a
  // the action first, the LED / store update after it (the sound never waits for a React re-render)
  if (a === 'sustain') setSustain(true)
  else if (a === 'loop') bigDown(usePedal.getState().loopStyle, at, true)
  else if (a === 'kick') kickDown()
  else if (a === 'soft') setSoft(1)
  else if (a === 'sostenuto') setSostenuto(true)
  else if (a === 'stomp') stompSelected(usePedal.getState().loopStyle, isLooperOpen() || usePedal.getState().loopAlways)
  else if (a === 'beat') { if (isRunning()) stopMaster(); else startMaster() }
  usePedal.setState({ down: true })
}
function release() {
  const a = held
  held = null
  if (a === 'sustain') setSustain(false)
  else if (a === 'loop') bigUp()
  else if (a === 'kick') kickUp()
  else if (a === 'soft') setSoft(0)
  else if (a === 'sostenuto') setSostenuto(false)
  if (usePedal.getState().down) usePedal.setState({ down: false })
}
/** a sustain pedal on the MIDI keyboard: CC 64, down at >= 64 */
function onMidi(d: Uint8Array, ts = 0) {
  if (d.length < 3 || (d[0] & 0xf0) !== 0xb0 || d[1] !== 64) return
  if (!usePedal.getState().midi) usePedal.setState({ midi: true })
  if (d[2] >= 64) { setHalfSustain(0); press(ts > 0 ? ts : undefined) }
  else { release(); setHalfSustain(d[2] > 0 && pedalJob() === 'sustain' ? d[2] / 63 : 0) } // a continuous pedal pressed less than halfway = half pedal
}

const typingInField = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null
  return !!t && (t.isContentEditable || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes((t as HTMLInputElement).type)))
}
function onDown(e: KeyboardEvent) {
  const s = usePedal.getState()
  if (s.learning) {
    if (e.repeat) return
    e.preventDefault(); e.stopImmediatePropagation()
    if (e.code === 'Escape' || !e.code) { usePedal.setState({ learning: false }); return }
    usePedal.setState({ code: e.code, learning: false }); save(); return
  }
  if (!s.code || e.code !== s.code || typingInField(e)) return
  e.preventDefault(); e.stopImmediatePropagation()
  if (!e.repeat) press(e.timeStamp)
}
function onUp(e: KeyboardEvent) {
  const s = usePedal.getState()
  if (!s.code || e.code !== s.code || typingInField(e)) return
  e.preventDefault(); e.stopImmediatePropagation()
  release()
}
const onBlur = () => release()

H.off?.()
if (!isWebDemo()) {
// capture phase on window: runs before the musical-typing listener, so the pedal key never also plays a note
window.addEventListener('keydown', onDown, true)
window.addEventListener('keyup', onUp, true)
window.addEventListener('blur', onBlur)
const unPanic = registerPanicTarget('pedal', () => release())
const unMidi = subscribeMidi('piano', (d, ts) => onMidi(d, ts))
H.off = () => { window.removeEventListener('keydown', onDown, true); window.removeEventListener('keyup', onUp, true); window.removeEventListener('blur', onBlur); unPanic(); unMidi() }
}

if (import.meta.hot) {
  import.meta.hot.data.pedal = H
  import.meta.hot.dispose(() => { release(); H.off?.(); H.off = undefined })
  import.meta.hot.accept()
}
