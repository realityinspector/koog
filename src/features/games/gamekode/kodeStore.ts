// Game Kode powers: per-player saved data, and concept marking through the Koding Kore.
import { pload, psave } from '../../../profile/profile'
import { markConcept as koreMark } from '../../../kode/kore/concepts'
import type { KodeConcept } from './kodeLogic'

export const kload = <T,>(game: string, fallback: T): T => (pload<T>('gk.' + game, fallback) ?? fallback)
export const ksave = <T,>(game: string, value: T) => psave('gk.' + game, value)

/** record that the kid USED a concept (earns the Kore concept badge) */
export function markConcept(_game: string, id: KodeConcept) { try { koreMark(id) } catch { /* ignore */ } }

if (import.meta.hot) import.meta.hot.accept()
