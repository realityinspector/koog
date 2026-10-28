// Shared note feed. Every note-on/off from the MIDI keyboard AND the computer-keyboard fallback
// flows through useAppStore.recentNotes; this turns that into a simple event subscription.
// STABLE API: onNote(fn) -> unsubscribe.
import { useAppStore, type NoteEvent } from '../store/appStore'

export type NoteListener = (e: NoteEvent) => void

export function onNote(fn: NoteListener): () => void {
  let lastId = useAppStore.getState().recentNotes[0]?.id
  return useAppStore.subscribe((s) => {
    const fresh: NoteEvent[] = []
    for (const n of s.recentNotes) {
      if (n.id === lastId) break
      fresh.push(n)
    }
    lastId = s.recentNotes[0]?.id
    for (const n of fresh.reverse()) fn(n)
  })
}
