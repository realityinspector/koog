// Foot pedal (optional). Two kinds work:
//   * a sustain pedal plugged into the MIDI keyboard: it sends CC 64 (no setup needed)
//   * a single-switch USB pedal, which shows up as a keyboard and "types" one key. The browser can't tell that key apart
//     from the computer keyboard, so we LEARN it: "Set up pedal", press the pedal, and that key (by e.code) becomes the pedal.
// Then the pedal does one job:
//   auto     the loop station's big button while the loop station is on screen, sustain everywhere else (the default)
//   sustain  hold = notes keep ringing on the piano / synth / emulators (like a piano's damper pedal), lift = they stop
//   loop     the loop station's big button: tap = record / close the loop / add a layer, double-tap = stop, hold = undo
//   beat     tap = start / stop the beat (master clock)
// The pedal key is swallowed (so it doesn't also play a note), except while typing in a text box.
// If pressing the pedal clicks the mouse instead of typing a key, set it to send a key with the pedal's own setup app.
import { isWebDemo } from '../../web/webDemo'
import { create } from 'zustand'
import { setSustain } from '../../music/localNotes'
import { bigDown, bigUp, isLooperOpen } from '../loopstation/loopEngine'
import { subscribe as subscribeMidi } from '../../midi/router'
import { isRunning, startMaster, stopMaster } from '../../music/masterClock'
import { registerPanicTarget } from '../../music/panic'

export type PedalAction = 'auto' | 'sustain' | 'loop' | 'beat' | 'off'
export const PEDAL_ACTIONS: [PedalAction, string, string][] = [
  ['auto', 'Automatic', 'Runs the loop station while it is open. Everywhere else it holds your notes, like a piano pedal.'],
  ['sustain', 'Sustain (piano / synth)', 'Hold it down and your notes keep ringing, like a piano pedal. Lift it and they stop.'],
  ['loop', 'Loop station', 'Tap: record, then tap again to loop it. Tap to add a layer. Double-tap: stop. Hold: undo.'],
  ['beat', 'Beat', 'Tap to start or stop the beat.'],
  ['off', 'Off', 'The pedal does nothing.'],
]
interface PedalState { code: string | null; action: PedalAction; learning: boolean; down: boolean; /** a MIDI sustain pedal (CC 64) was seen */ midi: boolean }
const KEY = 'koog.pedal'
function load(): Pick<PedalState, 'code' | 'action'> {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || '{}')
    // version 1 saved 'sustain' as the default: move those to 'auto' once (a later pick is saved with v: 2 and kept)
    const action: PedalAction = PEDAL_ACTIONS.some(([a]) => a === j.action) ? (j.v !== 2 && j.action === 'sustain' ? 'auto' : j.action) : 'auto'
    return { code: typeof j.code === 'string' ? j.code : null, action }
  } catch { return { code: null, action: 'auto' } }
}
const hot = import.meta.hot?.data as { pedal?: { store: ReturnType<typeof make>; off?: () => void } } | undefined
function make() { return create<PedalState>()(() => ({ ...load(), learning: false, down: false, midi: false })) }
const H = hot?.pedal ?? { store: make(), off: undefined as (() => void) | undefined }
export const usePedal = H.store
const save = () => { const { code, action } = usePedal.getState(); try { localStorage.setItem(KEY, JSON.stringify({ v: 2, code, action })) } catch { /* ignore */ } }

export function learnPedal(on = true) { release(); usePedal.setState({ learning: on }) }
export function setPedalAction(a: PedalAction) { release(); usePedal.setState({ action: a }); save() }
export function forgetPedal() { release(); usePedal.setState({ code: null, learning: false }); save() }
/** label for a key code, e.g. "KeyB" -> "B", "F13" -> "F13" */
export const pedalKeyLabel = (code: string) => code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ')

/** what the pedal does right now ('auto' resolved: the looper while it is on screen, otherwise sustain) */
export function pedalJob(a = usePedal.getState().action): Exclude<PedalAction, 'auto'> { return a === 'auto' ? (isLooperOpen() ? 'loop' : 'sustain') : a }
let held: PedalAction | null = null
function press() {
  if (held) return
  const a = pedalJob()
  if (a === 'off') return
  held = a
  usePedal.setState({ down: true })
  if (a === 'sustain') setSustain(true)
  else if (a === 'loop') bigDown()
  else if (a === 'beat') { if (isRunning()) stopMaster(); else startMaster() }
}
function release() {
  const a = held
  held = null
  if (usePedal.getState().down) usePedal.setState({ down: false })
  if (a === 'sustain') setSustain(false)
  else if (a === 'loop') bigUp()
}
/** a sustain pedal on the MIDI keyboard: CC 64, down at >= 64 */
function onMidi(d: Uint8Array) {
  if (d.length < 3 || (d[0] & 0xf0) !== 0xb0 || d[1] !== 64) return
  if (!usePedal.getState().midi) usePedal.setState({ midi: true })
  if (d[2] >= 64) press(); else release()
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
  if (!e.repeat) press()
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
const unMidi = subscribeMidi('piano', (d) => onMidi(d))
H.off = () => { window.removeEventListener('keydown', onDown, true); window.removeEventListener('keyup', onUp, true); window.removeEventListener('blur', onBlur); unPanic(); unMidi() }
}

if (import.meta.hot) {
  import.meta.hot.data.pedal = H
  import.meta.hot.dispose(() => { release(); H.off?.(); H.off = undefined })
  import.meta.hot.accept()
}
