// The app registry. State lives on import.meta.hot.data so a hot reload keeps registered apps.
import type { KodeApp, KodeConcept } from './types'

export const CONCEPT_IDS: KodeConcept[] = ['sequence', 'loop', 'function', 'parameter', 'event', 'condition', 'parallel', 'random', 'recursion', 'debug', 'variable']

const hot = (import.meta.hot?.data ?? {}) as { apps?: Map<string, KodeApp> }
const apps: Map<string, KodeApp> = hot.apps ?? new Map()

/** null when fine, else the problems (unique id, valid concepts, a route or a component) */
export function validateApp(a: KodeApp, taken: (id: string) => boolean = (id) => apps.has(id)): string[] {
  const p: string[] = []
  if (!a.id || !/^[a-z0-9-]+$/.test(a.id)) p.push(`bad id "${a.id}"`)
  if (taken(a.id)) p.push(`duplicate id "${a.id}"`)
  if (!a.name || !a.icon || !a.tagline) p.push('needs name, icon and tagline')
  for (const c of a.concepts) if (!CONCEPT_IDS.includes(c)) p.push(`unknown concept "${c}"`)
  if (!a.concepts.length) p.push('needs at least one concept')
  if (!a.route && !a.component) p.push('needs a route or a component')
  if (a.ages[0] > a.ages[1]) p.push('ages must be [min,max]')
  return p
}
export function registerApp(a: KodeApp): KodeApp {
  const bad = validateApp(a, (id) => id !== a.id && apps.has(id))
  if (bad.length) { console.warn('[kore] app rejected', a.id, bad); return a }
  apps.set(a.id, a) // re-registering the same id replaces it (hot reload)
  return a
}
export const listApps = (): KodeApp[] => [...apps.values()]
export const getApp = (id: string): KodeApp | undefined => apps.get(id)
export const unregisterApp = (id: string) => apps.delete(id)

if (import.meta.hot) { import.meta.hot.data.apps = apps; import.meta.hot.accept() }
