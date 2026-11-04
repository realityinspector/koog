// Motif functions: the saved list (per player), define / call / rename / delete+undo, and the resolver the Kode language imports.
// Pure of audio: sound and clock come in through setMotifRuntime (wired by sdk.ts), so scripts/kore-fixtures.ts can drive it.
import { create } from 'zustand'
import { onProfileChange } from '../../profile/profile'
import { markConcept } from './concepts'
import { kvLoad, kvSave } from './kv'
import { ROUND_EXAMPLE, autoName, callSignOf, nextBeatOf, normName, planCall, trimQuantise, type Detected, type Motif, type MotifCall, type MotifEvent, type Tap } from './motifCore'

export type { Motif, MotifCall, MotifEvent } from './motifCore'
const KEY = 'kore.motifs.list'
const FREE_KEY = 'kore.motifs.freePlay'

interface MS { list: Motif[]; trash: Motif | null; free: boolean; v: number }
const hot = (import.meta.hot?.data ?? {}) as { store?: ReturnType<typeof make>; off?: () => void }
function make() {
  return create<MS>()(() => ({ list: sane(kvLoad<Motif[]>(KEY, [])), trash: null, free: kvLoad<boolean>(FREE_KEY, false) === true, v: 0 }))
}
const sane = (l: unknown): Motif[] => (Array.isArray(l) ? l.filter((m): m is Motif => !!m && typeof m.id === 'string' && Array.isArray(m.notes) && m.notes.length > 0 && !!m.sign) : [])
export const useMotifs = hot.store ?? make()
const get = () => useMotifs.getState()
const persist = (list: Motif[]) => { kvSave(KEY, list); useMotifs.setState((s) => ({ list, v: s.v + 1 })) }
export const reloadMotifs = () => useMotifs.setState((s) => ({ list: sane(kvLoad<Motif[]>(KEY, [])), trash: null, free: kvLoad<boolean>(FREE_KEY, false) === true, v: s.v + 1 }))
hot.off?.()
const offProfile = onProfileChange(reloadMotifs)

// ---- runtime wiring (clock + sound), set by sdk.ts
interface Runtime { beat: () => number; bpm: () => number; sink: (evs: MotifEvent[]) => void }
let rt: Runtime = { beat: () => 0, bpm: () => 100, sink: () => {} }
export const setMotifRuntime = (r: Partial<Runtime> | null) => { rt = { beat: () => 0, bpm: () => 100, sink: () => {}, ...(r ?? {}) } }

/** the player's own motifs (what call signs listen for) */
export const userMotifs = (): Motif[] => get().list
/** own motifs, then the built-in examples */
export const allMotifs = (): Motif[] => [...get().list, ROUND_EXAMPLE]
export function findMotif(nameOrId: string): Motif | undefined {
  const k = normName(nameOrId)
  return allMotifs().find((m) => m.id === nameOrId || normName(m.name) === k)
}

export function defineMotif(taps: Tap[], opts: { name?: string; emoji?: string } = {}): Motif | null {
  const r = trimQuantise(taps, rt.bpm())
  if (!r) return null
  return saveMotif(r.kind, r.notes, opts)
}
export function saveMotif(kind: Motif['kind'], notes: Motif['notes'], opts: { name?: string; emoji?: string } = {}): Motif | null {
  const sign = callSignOf(kind, notes, kind === 'lane' ? firstFreeLane(get().list) : undefined)
  if (!sign) return null
  const auto = autoName(get().list)
  let name = (opts.name ?? '').trim().slice(0, 16) || auto.name
  const taken = (n: string) => get().list.some((m) => normName(m.name) === normName(n))
  for (let i = 2; taken(name); i++) name = `${name.replace(/\d+$/, '')}${i}`
  const m: Motif = { id: `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, name, emoji: opts.emoji || auto.emoji, kind, notes, sign, transpose: 0, speed: 1, created: Date.now() }
  persist([...get().list, m])
  markConcept('function')
  return m
}
const firstFreeLane = (l: Motif[]) => { const used = new Set(l.filter((m) => m.kind === 'lane').map((m) => m.sign.lane)); for (let i = 0; i < 8; i++) if (!used.has(i)) return i; return 0 }

export function updateMotif(id: string, patch: Partial<Pick<Motif, 'name' | 'emoji' | 'transpose' | 'speed'>> & { lane?: number }): void {
  persist(get().list.map((m) => {
    if (m.id !== id) return m
    const n = { ...m }
    if (patch.name != null) { const t = patch.name.trim().slice(0, 16); if (t && !get().list.some((o) => o.id !== id && normName(o.name) === normName(t))) n.name = t }
    if (patch.emoji) n.emoji = patch.emoji
    if (patch.transpose != null) n.transpose = Math.max(-24, Math.min(24, Math.round(patch.transpose)))
    if (patch.speed != null) n.speed = [0.5, 1, 2].includes(patch.speed) ? patch.speed : 1
    if (patch.lane != null && n.kind === 'lane') n.sign = { ...n.sign, lane: Math.max(0, Math.min(7, Math.round(patch.lane))) }
    return n
  }))
}
/** delete (remembers the last one so undoRemove can bring it back) */
export function removeMotif(id: string): Motif | null {
  const m = get().list.find((x) => x.id === id) ?? null
  if (!m) return null
  useMotifs.setState({ trash: m })
  persist(get().list.filter((x) => x.id !== id))
  return m
}
export function undoRemove(): Motif | null {
  const m = get().trash
  if (!m) return null
  useMotifs.setState({ trash: null })
  if (!get().list.some((x) => x.id === m.id)) persist([...get().list, m].sort((a, b) => a.created - b.created))
  return m
}
export function copyExample(m: Motif): Motif | null {
  return saveMotif(m.kind, m.notes.map((n) => ({ ...n })), { name: m.name, emoji: m.emoji })
}
export function setFreePlay(on: boolean) { kvSave(FREE_KEY, on); useMotifs.setState({ free: on }) }

/** Run a motif on the next beat. args: transpose (semitones), speed (x1/x2), vel (0..1 loudness). */
export function callMotif(nameOrId: string, args: { transpose?: number; speed?: number; vel?: number } = {}): MotifCall | null {
  const m = findMotif(nameOrId)
  if (!m) return null
  const call = planCall(m, { ...args, startBeat: nextBeatOf(rt.beat()) })
  rt.sink(call.events)
  if ((args.transpose ?? 0) !== 0 || (args.speed ?? 1) !== 1 || args.vel != null) markConcept('parameter')
  if (m.recurse) markConcept('recursion')
  return call
}
export const callDetected = (d: Detected) => callMotif(d.motif.id, { transpose: d.transpose, speed: d.speed, vel: d.vel })

/**
 * For the Koog Kode language (`play buzz +2`): the notes of a motif by name, ready to schedule.
 * `shift` = semitones, `speed` = 1 or 2 (or 0.5). Returns null for an unknown name. Pitched notes are MIDI numbers; pad motifs give lane 0..7 in `note`.
 */
export function resolveMotif(name: string, shift = 0, speed = 1): { name: string; kind: 'pitch' | 'lane'; notes: { note: number; beat: number; beats: number; vel: number }[] } | null {
  const m = findMotif(name)
  if (!m) return null
  const p = planCall(m, { transpose: shift, speed, startBeat: 0 })
  const seen = p.events.filter((e) => e.depth === 0)
  return { name: m.name, kind: m.kind, notes: seen.map((e) => ({ note: e.value, beat: e.beat, beats: e.beats, vel: e.vel })) }
}
/** the line "Use in Koog Kode" copies */
export const kodeLine = (m: Motif) => `play ${normName(m.name)}${m.transpose ? ` ${m.transpose > 0 ? '+' : ''}${m.transpose}` : ' +0'}`

if (import.meta.hot) {
  import.meta.hot.data.store = useMotifs
  import.meta.hot.dispose((d) => { d.store = useMotifs; d.off = offProfile })
  import.meta.hot.accept()
}
