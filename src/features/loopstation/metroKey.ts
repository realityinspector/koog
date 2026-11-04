// "Press M anytime, anywhere": the M key flips the metronome (the looper's click on the master clock) from any screen, with a small toast.
//   * Not while typing in a text box, and never with Ctrl / Cmd / Alt.
//   * The computer-key piano plays the note B on M. So while "Keys play notes" is ON, Shift+M flips the metronome and plain M stays the B note;
//     with "Keys play notes" OFF, plain M (or Shift+M) flips it.
import { useTypingOn } from '../../music/typing'
import { toggleMetronome } from './loopEngine'
import { isMetronomeKey } from './loopCore'
export { isMetronomeKey }

type Hot = { off?: () => void }
const hot = (import.meta.hot?.data ?? {}) as Hot

const typingField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
  return el.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes((el as HTMLInputElement).type)
}
function onKey(e: KeyboardEvent) {
  if (e.defaultPrevented || typingField(e.target)) return
  if (!isMetronomeKey(e, useTypingOn.getState().on)) return
  e.preventDefault()
  toggleMetronome()
}

hot.off?.()
window.addEventListener('keydown', onKey)
const off = () => window.removeEventListener('keydown', onKey)
if (import.meta.hot) {
  import.meta.hot.data.off = off
  import.meta.hot.dispose(() => { off() })
  import.meta.hot.accept()
}
