// While Koogalien is open, the letter keys play the pads they are named after.
// The pads read C D E F G A B C'. The tracker layout (Z S X D C V G B…) is a different piano,
// so B played G, D and G were black keys, and A and F did nothing. These letters are taken
// on the way down, before that layout hears them. Every other key, including Shift+M, stays as it was.
// The ' key (Quote) plays high C, the pad labeled C'.
import { midiOfDegree } from '../../koogalien/data/degrees'
import type { Degree } from '../../koogalien/data/types'
import { playLocal } from '../../music/localNotes'
import { useTypingOn } from '../../music/typing'
import { useKoogalien } from './store'

const DEGREE: Record<string, Degree> = {
  KeyC: 1, KeyD: 2, KeyE: 3, KeyF: 4, KeyG: 5, KeyA: 6, KeyB: 7, Quote: 8,
}

/** a text box, a slider, or a menu has the keys. Same skip list as musical typing. */
function typingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return !!t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role=slider], [role=spinbutton], [role=tab], [role=menuitem], [role=listbox], [role=option]')
}

const held = new Map<string, number>()

function onDown(e: KeyboardEvent) {
  const d = DEGREE[e.code]
  if (d == null || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
  if (typingTarget(e) || !useTypingOn.getState().on) return
  e.preventDefault()
  e.stopPropagation()
  if (e.repeat || held.has(e.code)) return
  const note = midiOfDegree(d, useKoogalien.getState().homeC)
  held.set(e.code, note)
  playLocal(note, 84, true)
}

function onUp(e: KeyboardEvent) {
  const note = held.get(e.code)
  if (note === undefined) return
  held.delete(e.code)
  e.preventDefault()
  e.stopPropagation()
  playLocal(note, 0, false)
}

function releaseAll() {
  for (const note of held.values()) playLocal(note, 0, false)
  held.clear()
}

/** Listen while Koogalien is on screen. Call the returned function when it closes. */
export function startLetterKeys(): () => void {
  window.addEventListener('keydown', onDown, true)
  window.addEventListener('keyup', onUp, true)
  window.addEventListener('blur', releaseAll)
  return () => {
    window.removeEventListener('keydown', onDown, true)
    window.removeEventListener('keyup', onUp, true)
    window.removeEventListener('blur', releaseAll)
    releaseAll()
  }
}
