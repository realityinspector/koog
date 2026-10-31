// A tiny tap on the DJ controls: every logical action (from a Numark, from the on-screen deck, or from a test) is announced here,
// whether or not the audio exists yet. The knob check, Soundcheck and the co-op challenges listen; nothing in the engine depends on it.
import type { DjAction } from './map'

export type ActionListener = (a: DjAction, t: number) => void
const hot = (import.meta.hot?.data ?? {}) as { listeners?: Set<ActionListener> }
const listeners: Set<ActionListener> = hot.listeners ?? new Set()

export const onAction = (fn: ActionListener) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export function emitAction(a: DjAction) {
  const t = performance.now()
  for (const f of [...listeners]) { try { f(a, t) } catch (e) { console.error('[dj tap]', e) } }
}

/** While calibrating, the controller must not play the decks (pressing PLAY to teach it shouldn't start the music). */
const flags = (hot as { flags?: { deaf: boolean } }).flags ?? { deaf: false }
export const setDeaf = (v: boolean) => { flags.deaf = v }
export const isDeaf = () => flags.deaf

if (import.meta.hot) {
  import.meta.hot.data.flags = flags
  import.meta.hot.data.listeners = listeners
  import.meta.hot.accept()
}
