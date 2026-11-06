// Shift+EASTER opens the cheat sheet. The word is read one letter at a time while Shift is held.
// A letter that continues the word is taken before the typing piano hears it. Anything else plays as usual.
// Pure matching is feedCode(); the listener is startEasterCode().
import { create } from 'zustand'
import { noteName } from '../../music/theory'
import { inTextField } from '../../ui/shortcuts'
import { INFO, TUNES, type EggId } from './eggs'

export const EASTER = 'EASTER'
export const EGG_PAGE = 5
const GAP_MS = 1400

const HOW: Partial<Record<EggId, string>> = {
  scales: 'Eight notes of a major or minor scale, up or down, at a steady pace.',
  surf: 'The same kind of scale, but very fast, like a slide.',
  chromatic: 'Eight steps in a row, one semitone each, black keys included.',
  woodpecker: 'The same note eight times, fast.',
  pogo: 'Jump up an octave and back down, five notes.',
  ghost: 'Two notes a tritone apart, back and forth, five notes.',
  quake: 'Four or more low notes at once. The highest one stays at G3 or below.',
  dizzy: 'Twelve or more loud notes within a second and a half, using at least five different notes.',
  sleepy: 'Three notes, very slow and very soft. A loud note wakes him.',
  crown: 'Four major chords: home, then up a fourth, then up a fifth, then home again.',
}

/** The notes or the pattern that fires this egg. Two lines, joined with "or", when either tune works. */
export function howTo(id: EggId): string {
  const written = HOW[id]
  if (written) return written
  const lines = TUNES.filter((t) => t.egg === id).map((t) => t.notes.map((n) => noteName(n)).join(' '))
  return lines[0] ? [...new Set(lines)].join('   or   ') : ''
}

export interface CodeFeed { buf: string; open: boolean }
/** One shifted letter. `dt` is milliseconds since the previous letter. Returns the next buffer and whether the sheet should open. */
export function feedCode(buf: string, letter: string, dt: number): CodeFeed {
  const b = dt > GAP_MS ? '' : buf
  const next = b + letter
  if (EASTER.startsWith(next)) return { buf: next === EASTER ? '' : next, open: next === EASTER }
  if (EASTER.startsWith(letter)) return { buf: letter, open: false }
  return { buf: '', open: false }
}

interface CheatState {
  open: boolean
  page: number
  openSheet: () => void
  close: () => void
  setPage: (page: number) => void
}
function makeCheat() {
  return create<CheatState>()((set) => ({
    open: false,
    page: 0,
    openSheet: () => set({ open: true, page: 0 }),
    close: () => set({ open: false }),
    setPage: (page) => set({ page }),
  }))
}
const cheatHot = import.meta.hot?.data as { eggCheat?: ReturnType<typeof makeCheat> } | undefined
export const useEggCheat = cheatHot?.eggCheat ?? makeCheat()
export const pageCount = () => Math.ceil(INFO.length / EGG_PAGE)

export function startEasterCode(): () => void {
  let buf = ''
  let at = 0
  const down = (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || inTextField(e.target)) return
    if (!e.shiftKey) { buf = ''; return }
    if (!e.code.startsWith('Key') || e.code.length !== 4) return
    const letter = e.code.slice(3)
    const now = performance.now()
    const next = feedCode(buf, letter, at ? now - at : 0)
    if (!next.open && next.buf === '') { buf = ''; at = now; return }
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    buf = next.buf
    at = now
    if (next.open) useEggCheat.getState().openSheet()
  }
  const up = (e: KeyboardEvent) => { if (e.key === 'Shift') { buf = ''; at = 0 } }
  window.addEventListener('keydown', down, true)
  window.addEventListener('keyup', up, true)
  return () => {
    window.removeEventListener('keydown', down, true)
    window.removeEventListener('keyup', up, true)
  }
}

if (import.meta.hot) {
  import.meta.hot.data.eggCheat = useEggCheat
  import.meta.hot.accept()
}
