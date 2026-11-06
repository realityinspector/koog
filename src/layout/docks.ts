// DOCK MANAGER: one source of truth for "which overlay / dock is open", and the rule that docks which share a place open ONE AT A TIME.
// Pure (no React, no DOM, no audio) so scripts/state-fixtures.ts can test it in node. The wiring to the real stores is in dockWiring.ts.
//
//   registerDock({ id, group?, isOpen, close, subscribe })   every dock registers itself once (dockWiring.ts does it for all of them)
//   Docks that share a `group` are exclusive: the moment one goes closed -> open, the others in its group are closed (last opened wins).
//   That holds no matter WHO opened it (the Modes launcher, a #/link, the pedal, a controller, the gallery, Boss mode).
//   openDocks() / dockSnapshot()   what is open now (window.__koogState)
//   closeDock(id) / closeAllDocks(group?)
// The registry lives on import.meta.hot.data (globalThis in node), so an edit never loses a registration or double-subscribes.

export interface DockDef {
  id: string
  /** docks in the same group are mutually exclusive */
  group?: string
  isOpen: () => boolean
  close: () => void
  subscribe: (cb: () => void) => () => void
}
interface Entry { def: DockDef; was: boolean; off: () => void }
type Reg = { docks: Map<string, Entry>; busy: boolean; log: string[] }

function R(): Reg {
  const d = (import.meta.hot?.data ?? (globalThis as Record<string, unknown>)) as { dockReg?: Reg }
  return (d.dockReg ??= { docks: new Map(), busy: false, log: [] })
}

function onChange(id: string) {
  const reg = R(), e = reg.docks.get(id)
  if (!e) return
  const now = e.def.isOpen()
  const opened = now && !e.was
  e.was = now
  if (!opened || !e.def.group || reg.busy) return
  reg.busy = true
  try {
    for (const o of reg.docks.values()) {
      if (o.def.id === id || o.def.group !== e.def.group || !o.def.isOpen()) continue
      reg.log.push(`${id} opened -> closed ${o.def.id}`); if (reg.log.length > 20) reg.log.shift()
      try { o.def.close() } catch (err) { console.error('[docks]', err) }
      o.was = o.def.isOpen()
    }
  } finally { reg.busy = false }
}

export function registerDock(def: DockDef): () => void {
  const reg = R()
  reg.docks.get(def.id)?.off() // a hot edit re-registers: replace, never stack
  const entry: Entry = { def, was: def.isOpen(), off: () => {} }
  entry.off = def.subscribe(() => onChange(def.id))
  reg.docks.set(def.id, entry)
  return () => { entry.off(); if (reg.docks.get(def.id) === entry) reg.docks.delete(def.id) }
}

export const openDocks = (group?: string): string[] => [...R().docks.values()].filter((e) => (!group || e.def.group === group) && e.def.isOpen()).map((e) => e.def.id)
export const dockIds = (): string[] => [...R().docks.keys()]
export function closeDock(id: string) { R().docks.get(id)?.def.close() }
export function closeAllDocks(group?: string) { for (const e of [...R().docks.values()]) if (!group || e.def.group === group) { if (e.def.isOpen()) e.def.close() } }
export const dockSnapshot = () => ({ open: openDocks(), registered: dockIds(), recent: [...R().log] })

if (import.meta.hot) { import.meta.hot.accept() }
