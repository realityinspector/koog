// OWNERSHIP of shared singletons (the key-glow guide, the sheet score, the master clock, docks).
// Two small tools, both pure (no DOM, no audio) so scripts/state-fixtures.ts can test them in node:
//   createSlot(name, clear)     "last owner wins". set(owner, ...) records who wrote it; release(owner) only clears when that owner
//                               is STILL the current one, so a stale timer from a screen that already closed can never wipe the
//                               glow / sheet a newer screen is showing.
//   createHolds(name, start, stop, isOn)
//                               "reference counted". hold(owner) starts the thing if it is off (and remembers WE started it),
//                               release(owner) stops it only when the last holder is gone AND we were the one who started it. A thing
//                               someone else switched on (the kid pressed START) is never stopped behind their back.
// Every slot / hold registers itself, so releaseAll(owner) frees everything one owner holds (use it on unmount and in
// import.meta.hot.dispose), and ownerSnapshot() feeds window.__koogState().
// The registry lives on import.meta.hot.data (globalThis in node), so an edit never forgets who owns what.

type Reg = { slots: Map<string, SlotApi>; holds: Map<string, HoldsApi> }
export interface SlotApi { name: string; owner(): string | null; release(owner: string): boolean; force(): void }
export interface HoldsApi { name: string; holders(): string[]; release(owner: string, keepOn?: boolean): void; weStarted(): boolean; adopt(): void }

function R(): Reg {
  const d = (import.meta.hot?.data ?? (globalThis as Record<string, unknown>)) as { ownerReg?: Reg }
  return (d.ownerReg ??= { slots: new Map(), holds: new Map() })
}

export interface Slot extends SlotApi {
  /** record `owner` as the writer (call it right next to the real write) */
  claim(owner: string): void
  /** release if `owner` is still the current owner; returns true if it cleared */
  release(owner: string): boolean
}
/** last-owner-wins slot. `clear` empties the real state (setGuide([]), setScore(null)...). */
export function createSlot(name: string, clear: () => void): Slot {
  let cur: string | null = null
  const old = R().slots.get(name)
  if (old) cur = old.owner() // survive a hot edit of the module that created us
  const s: Slot = {
    name,
    owner: () => cur,
    claim: (o) => { cur = o },
    release: (o) => { if (cur !== o) return false; cur = null; clear(); return true },
    force: () => { cur = null; clear() },
  }
  R().slots.set(name, s)
  return s
}

export interface Holds extends HoldsApi {
  /** take a hold; starts the thing if it was off. Holding twice with the same owner counts once. */
  hold(owner: string): void
  /** drop a hold. Stops the thing when nobody else holds it and we started it, unless keepOn (someone not registered still needs it). */
  release(owner: string, keepOn?: boolean): void
  /** the player started / stopped it by hand (a START button, the pedal): what started it before no longer matters */
  adopt(): void
}
export function createHolds(name: string, start: () => void, stop: () => void, isOn: () => boolean): Holds {
  const prev = R().holds.get(name)
  const set = new Set<string>(prev?.holders() ?? [])
  let ws = prev?.weStarted() ?? false
  const h: Holds = {
    name,
    holders: () => [...set],
    weStarted: () => ws,
    hold: (o) => {
      set.add(o)
      if (!isOn()) { start(); ws = true }
    },
    adopt: () => { ws = false },
    release: (o, keepOn = false) => {
      set.delete(o)
      if (keepOn) { if (set.size === 0) ws = false; return } // someone outside the registry carries on with it: it is theirs now
      if (set.size === 0 && ws) { ws = false; if (isOn()) stop() }
    },
  }
  R().holds.set(name, h)
  return h
}

/** free everything `owner` holds, in every slot and hold */
export function releaseAll(owner: string) {
  R().slots.forEach((s) => { s.release(owner) })
  R().holds.forEach((h) => { if (h.holders().includes(owner)) h.release(owner) })
}

export function ownerSnapshot(): { slots: Record<string, string | null>; holds: Record<string, { holders: string[]; weStarted: boolean }> } {
  const slots: Record<string, string | null> = {}
  const holds: Record<string, { holders: string[]; weStarted: boolean }> = {}
  R().slots.forEach((s, k) => { slots[k] = s.owner() })
  R().holds.forEach((h, k) => { holds[k] = { holders: h.holders(), weStarted: h.weStarted() } })
  return { slots, holds }
}

if (import.meta.hot) { import.meta.hot.accept() }
