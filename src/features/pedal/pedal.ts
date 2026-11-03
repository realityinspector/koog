// USB foot pedal (optional). Single-switch USB pedals show up as a keyboard: pressing the pedal "types" one key.
// The browser can't tell that key apart from the computer keyboard, so we LEARN it: "Set up pedal", press the pedal,
// and that key (by e.code) becomes the pedal. Then the pedal does one job:
//   sustain  hold = notes keep ringing (like a piano's damper pedal)
//   loop     the loop station's one-button pedal: tap = record / play / overdub the selected track, hold = clear
//   beat     tap = start / stop the beat (master clock)
// The pedal key is swallowed (so it doesn't also play a note), except while typing in a text box.
// If pressing the pedal clicks the mouse instead of typing a key, set it to send a key with the pedal's own setup app.
import { create } from 'zustand'
import { setSustain } from '../../music/localNotes'
import { buttonDown, buttonUp, getSel } from '../loopstation/loopEngine'
import { isRunning, startMaster, stopMaster } from '../../music/masterClock'
import { registerPanicTarget } from '../../music/panic'

export type PedalAction = 'sustain' | 'loop' | 'beat' | 'off'
export const PEDAL_ACTIONS: [PedalAction, string, string][] = [
  ['sustain', 'Sustain', 'Hold it down and your notes keep ringing, like a piano pedal.'],
  ['loop', 'Loop', 'Tap to record, play or add to the loop. Hold to clear it.'],
  ['beat', 'Beat', 'Tap to start or stop the beat.'],
  ['off', 'Off', 'The pedal does nothing.'],
]
interface PedalState { code: string | null; action: PedalAction; learning: boolean; down: boolean }
const KEY = 'koog.pedal'
function load(): Pick<PedalState, 'code' | 'action'> {
  try { const j = JSON.parse(localStorage.getItem(KEY) || '{}'); return { code: typeof j.code === 'string' ? j.code : null, action: PEDAL_ACTIONS.some(([a]) => a === j.action) ? j.action : 'sustain' } } catch { return { code: null, action: 'sustain' } }
}
const hot = import.meta.hot?.data as { pedal?: { store: ReturnType<typeof make>; off?: () => void } } | undefined
function make() { return create<PedalState>()(() => ({ ...load(), learning: false, down: false })) }
const H = hot?.pedal ?? { store: make(), off: undefined as (() => void) | undefined }
export const usePedal = H.store
const save = () => { const { code, action } = usePedal.getState(); try { localStorage.setItem(KEY, JSON.stringify({ code, action })) } catch { /* ignore */ } }

export function learnPedal(on = true) { release(); usePedal.setState({ learning: on }) }
export function setPedalAction(a: PedalAction) { release(); usePedal.setState({ action: a }); save() }
export function forgetPedal() { release(); usePedal.setState({ code: null, learning: false }); save() }
/** label for a key code, e.g. "KeyB" -> "B", "F13" -> "F13" */
export const pedalKeyLabel = (code: string) => code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ')

let held: PedalAction | null = null
function press() {
  const a = usePedal.getState().action
  if (a === 'off') return
  held = a
  usePedal.setState({ down: true })
  if (a === 'sustain') setSustain(true)
  else if (a === 'loop') buttonDown(getSel())
  else if (a === 'beat') { if (isRunning()) stopMaster(); else startMaster() }
}
function release() {
  const a = held
  held = null
  if (usePedal.getState().down) usePedal.setState({ down: false })
  if (a === 'sustain') setSustain(false)
  else if (a === 'loop') buttonUp(getSel())
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
// capture phase on window: runs before the musical-typing listener, so the pedal key never also plays a note
window.addEventListener('keydown', onDown, true)
window.addEventListener('keyup', onUp, true)
window.addEventListener('blur', onBlur)
const unPanic = registerPanicTarget('pedal', () => release())
H.off = () => { window.removeEventListener('keydown', onDown, true); window.removeEventListener('keyup', onUp, true); window.removeEventListener('blur', onBlur); unPanic() }

if (import.meta.hot) {
  import.meta.hot.data.pedal = H
  import.meta.hot.dispose(() => { release(); H.off?.(); H.off = undefined })
  import.meta.hot.accept()
}
