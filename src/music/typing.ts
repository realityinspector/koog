// Musical typing: the computer keyboard as a two-row "tracker" piano. Mapped by e.code so it works on any layout.
//   lower row from C3 (48):  Z S X D C V G B H N J M , L . ; /
//   upper row from C4 (60):  Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P [ = ]
// ArrowLeft / ArrowRight shift the octave (all notes stay within 36..96). Notes go through playLocal,
// so the judge, visuals and games see them. Import this module once for its side effect.
import { create } from 'zustand'
import { playLocal } from './localNotes'

const LOWER = ['KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyH', 'KeyN', 'KeyJ', 'KeyM', 'Comma', 'KeyL', 'Period', 'Semicolon', 'Slash']
const UPPER = ['KeyQ', 'Digit2', 'KeyW', 'Digit3', 'KeyE', 'KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'Digit7', 'KeyU', 'KeyI', 'Digit9', 'KeyO', 'Digit0', 'KeyP', 'BracketLeft', 'Equal', 'BracketRight']
const LOWER_BASE = 48, UPPER_BASE = 60
const LO = 36, HI = 96
const SHIFTS = [-12, 0, 12] // octave offsets that keep every typing note inside LO..HI
const CAPS: Record<string, string> = { Comma: ',', Period: '.', Semicolon: ';', Slash: '/', BracketLeft: '[', BracketRight: ']', Equal: '=' }
export const capOf = (code: string) => CAPS[code] ?? code.replace(/^Key|^Digit/, '')

const MAP = new Map<string, number>()
LOWER.forEach((c, i) => MAP.set(c, LOWER_BASE + i))
UPPER.forEach((c, i) => MAP.set(c, UPPER_BASE + i))

const hot = import.meta.hot?.data as { typing?: { store: ReturnType<typeof makeStore>; held: Map<string, number>; off?: () => void } } | undefined
function makeStore() { return create<{ shift: number }>()(() => ({ shift: 0 })) }
const st = hot?.typing ?? { store: makeStore(), held: new Map<string, number>(), off: undefined as (() => void) | undefined }
export const useTyping = st.store

/** Key caps (e.g. "Z", "Q") that currently play a given note, following the octave shift. */
export function typingCaps(note: number, shift: number): string[] {
  const out: string[] = []
  const li = note - LOWER_BASE - shift, ui = note - UPPER_BASE - shift
  if (li >= 0 && li < LOWER.length) out.push(capOf(LOWER[li]))
  if (ui >= 0 && ui < UPPER.length) out.push(capOf(UPPER[ui]))
  return out
}

const blocked = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null
  return !!t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey || e.isComposing
}
function releaseAll() {
  for (const n of [...st.held.values()]) playLocal(n, 0, false)
  st.held.clear()
}

function onDown(e: KeyboardEvent) {
  if (blocked(e)) return
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    if (document.querySelector('.tour-card')) return // the tour uses the arrows to page
    e.preventDefault()
    const cur = st.store.getState().shift
    const i = SHIFTS.indexOf(cur) + (e.code === 'ArrowRight' ? 1 : -1)
    if (!e.repeat && i >= 0 && i < SHIFTS.length) st.store.setState({ shift: SHIFTS[i] })
    return
  }
  const base = MAP.get(e.code)
  if (base === undefined || e.repeat || st.held.has(e.code)) return
  const note = base + st.store.getState().shift
  if (note < LO || note > HI) return
  e.preventDefault()
  st.held.set(e.code, note)
  playLocal(note, 80 + Math.round(Math.random() * 20), true)
}
function onUp(e: KeyboardEvent) {
  const n = st.held.get(e.code)
  if (n === undefined) return
  st.held.delete(e.code)
  playLocal(n, 0, false)
}
const onVis = () => { if (document.hidden) releaseAll() }

st.off?.()
window.addEventListener('keydown', onDown)
window.addEventListener('keyup', onUp)
window.addEventListener('blur', releaseAll)
document.addEventListener('visibilitychange', onVis)
st.off = () => {
  window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp)
  window.removeEventListener('blur', releaseAll); document.removeEventListener('visibilitychange', onVis)
}

if (import.meta.hot) {
  import.meta.hot.data.typing = st
  import.meta.hot.dispose(() => { releaseAll(); st.off?.(); st.off = undefined })
  import.meta.hot.accept()
}
