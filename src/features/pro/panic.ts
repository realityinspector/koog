// PANIC: all notes off everywhere. The registry lives in music/panic.ts; this registers what Pro's panic always did.
import { setHold } from '../synth-history/engine'
import { getActiveInstrument } from '../../music/instrument'
import { registerPanicTarget } from '../../music/panic'

import { panicAll as panicShared } from '../../music/panic'
export { registerPanicTarget } from '../../music/panic'
export const panicAll = () => panicShared()

const off = registerPanicTarget('pro', () => { setHold(false); getActiveInstrument()?.allOff?.() })
if (import.meta.hot) { import.meta.hot.dispose(() => off()); import.meta.hot.accept() }
