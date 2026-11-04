// Shared note feed. Every note-on/off from the MIDI keyboard AND the computer-keyboard fallback
// flows through useAppStore.recentNotes; this turns that into a simple event subscription.
// STABLE API: onNote(fn) -> unsubscribe.
// One store subscription fans out to every onNote listener (was one zustand subscription per listener, each
// re-scanning recentNotes on every unrelated store change). Non-note store updates now return after one compare.
import { useAppStore, type NoteEvent } from '../store/appStore'

export type NoteListener = (e: NoteEvent) => void

interface Feed { fns: Set<NoteListener>; lastId: number | undefined; unsub?: () => void }
const hot = import.meta.hot
const feed: Feed = hot ? (hot.data.noteFeed ??= { fns: new Set(), lastId: useAppStore.getState().recentNotes[0]?.id } as Feed) : { fns: new Set(), lastId: useAppStore.getState().recentNotes[0]?.id }

/** Push a note event onto the recent-notes feed (newest first, capped at 12) with a single array allocation. */
export function pushNote(ev: NoteEvent) {
  useAppStore.setState((s) => {
    const r = s.recentNotes
    const n = r.slice(0, r.length >= 12 ? 11 : r.length)
    n.unshift(ev)
    return { recentNotes: n }
  })
}

const call = (f: NoteListener, e: NoteEvent) => { try { f(e) } catch (err) { console.error('[onNote]', err) } }
function dispatch(recent: NoteEvent[]) {
  const head = recent[0]
  if (!head || head.id === feed.lastId) return // not a note update: nothing to do, nothing allocated
  const last = feed.lastId
  feed.lastId = head.id
  if (recent[1] === undefined || recent[1].id === last) { // the usual case: exactly one new event
    for (const f of [...feed.fns]) call(f, head)
    return
  }
  const fresh: NoteEvent[] = []
  for (const n of recent) { if (n.id === last) break; fresh.push(n) }
  for (const n of fresh.reverse()) for (const f of [...feed.fns]) call(f, n)
}
feed.unsub?.()
feed.unsub = useAppStore.subscribe((s) => dispatch(s.recentNotes))

export function onNote(fn: NoteListener): () => void {
  feed.fns.add(fn)
  return () => void feed.fns.delete(fn)
}

if (hot) {
  hot.data.noteFeed = feed
  hot.dispose(() => { feed.unsub?.(); feed.unsub = undefined })
  hot.accept()
}
