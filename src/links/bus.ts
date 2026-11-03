// Link bus: the small shared state between the link layer (src/links/sync.ts) and the screens.
//   In   = "please open this" requests from a link. A screen applies its request when it sees one, then clears it.
//   Out  = what the screens report back, so the address bar can say exactly where you are.
// Screens that keep their position in local state (songs, games, synth, visuals) use both; the rest are read straight from their stores.
import { create } from 'zustand'

export interface SongReq { id: string | null; mode?: 'wait' | 'flow' | 'learn'; phrase?: number; rung?: number }
export interface LinkIn {
  song?: SongReq
  game?: { id: string | null; level?: string }
  emu?: string | null
  visual?: string
  palette?: string
  screen?: string
}
export interface LinkOut {
  song: { id: string; mode?: 'flow' | 'learn' } | null
  learn: { phrase?: number; rung?: number } | null
  game: string | null
  level: string | null
  emu: string | null
  visual: string | null
  palette: string | null
}

type Hot = { inn?: ReturnType<typeof makeIn>; out?: ReturnType<typeof makeOut>; note?: ReturnType<typeof makeNote> }
const hot = (import.meta.hot?.data ?? {}) as Hot
function makeIn() { return create<LinkIn>()(() => ({})) }
function makeOut() { return create<LinkOut>()(() => ({ song: null, learn: null, game: null, level: null, emu: null, visual: null, palette: null })) }
function makeNote() { return create<{ msg: string; n: number }>()(() => ({ msg: '', n: 0 })) }
export const useLinkIn = hot.inn ?? makeIn()
export const useLinkOut = hot.out ?? makeOut()
export const useLinkNote = hot.note ?? makeNote()
if (import.meta.hot) { Object.assign(import.meta.hot.data, { inn: useLinkIn, out: useLinkOut, note: useLinkNote }); import.meta.hot.accept() }

/** a request has been handled: clear it */
export const consume = <K extends keyof LinkIn>(k: K) => useLinkIn.setState({ [k]: undefined } as Partial<LinkIn>)
/** a screen tells the link layer where it is */
export const report = (p: Partial<LinkOut>) => useLinkOut.setState(p)

let noteTimer = 0
/** One small, calm, non-blocking note (fades by itself). */
export function linkNote(msg: string) {
  useLinkNote.setState((s) => ({ msg, n: s.n + 1 }))
  clearTimeout(noteTimer)
  noteTimer = window.setTimeout(() => useLinkNote.setState({ msg: '' }), 4600)
}

/** true while the self-playing gallery is running: it has had its click, so link-opened screens need not wait for a first key */
export const flags = { gallery: false }
