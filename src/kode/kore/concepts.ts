// Concept record: which coding ideas a player has actually USED (first date + count). Drives concept badges.
import { kvLoad, kvSave } from './kv'
import type { KodeConcept } from './types'

export interface ConceptRec { first: string; count: number }
export type ConceptRecord = Partial<Record<KodeConcept, ConceptRec>>
const KEY = 'kore.concepts'

export const loadConcepts = (): ConceptRecord => { const v = kvLoad<ConceptRecord>(KEY, {}); return v && typeof v === 'object' ? v : {} }
/** pure update: returns the new record and whether it is the first time */
export function bump(rec: ConceptRecord, id: KodeConcept, now = new Date()): { rec: ConceptRecord; first: boolean; count: number } {
  const have = rec[id]
  const next = { first: have?.first ?? now.toISOString().slice(0, 10), count: (have?.count ?? 0) + 1 }
  return { rec: { ...rec, [id]: next }, first: !have, count: next.count }
}
export function markConcept(id: KodeConcept, now = new Date()): { first: boolean; count: number } {
  const r = bump(loadConcepts(), id, now)
  kvSave(KEY, r.rec)
  return { first: r.first, count: r.count }
}
export const CONCEPT_INFO: Record<KodeConcept, { name: string; emoji: string; blurb: string }> = {
  sequence: { name: 'Sequence', emoji: '➡️', blurb: 'Steps happen one after another.' },
  loop: { name: 'Loop', emoji: '🔁', blurb: 'Repeat something again and again.' },
  function: { name: 'Function', emoji: '🧩', blurb: 'Give a pattern a name so you can use it later.' },
  parameter: { name: 'Parameter', emoji: '🎚️', blurb: 'Change how a function runs: higher, faster, louder.' },
  event: { name: 'Event', emoji: '⚡', blurb: 'Something you do makes something happen.' },
  condition: { name: 'Condition', emoji: '🔀', blurb: 'If this, then that.' },
  parallel: { name: 'Parallel', emoji: '🎼', blurb: 'Two things at the same time.' },
  random: { name: 'Random', emoji: '🎲', blurb: 'Let chance choose.' },
  recursion: { name: 'Recursion', emoji: '🌀', blurb: 'A function that calls itself, like a round.' },
  debug: { name: 'Debug', emoji: '🔍', blurb: 'Find what went wrong and fix it.' },
  variable: { name: 'Variable', emoji: '📦', blurb: 'A name that holds a value.' },
}
