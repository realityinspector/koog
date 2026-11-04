// Game Kode powers: saved-per-player data and concept marking. The Koding Kore SDK owns the real badge book;
// until a game is wired to it, marks are kept here (per player) and announced on a window event.
import { pload, psave } from '../../../profile/profile'
import type { KodeConcept } from './kodeLogic'

export const kload = <T,>(game: string, fallback: T): T => (pload<T>('gk.' + game, fallback) ?? fallback)
export const ksave = <T,>(game: string, value: T) => psave('gk.' + game, value)

type Marks = Partial<Record<KodeConcept, string[]>>
type Sink = (game: string, id: KodeConcept) => void
let sink: Sink | null = null
/** the Kore wiring point: `setConceptSink((game, id) => kore.concepts.mark(id))` */
export function setConceptSink(fn: Sink | null) { sink = fn }

/** record that the kid USED a concept in a game (idempotent per player and game) */
export function markConcept(game: string, id: KodeConcept) {
  const m = pload<Marks>('gk.concepts', {}) ?? {}
  const list = m[id] ?? []
  if (!list.includes(game)) { m[id] = [...list, game]; psave('gk.concepts', m) }
  try { sink?.(game, id) } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('koog:concept', { detail: { game, id } })) } catch { /* ignore */ }
}
export const conceptsUsed = (): Marks => pload<Marks>('gk.concepts', {}) ?? {}

if (import.meta.hot) import.meta.hot.accept()
