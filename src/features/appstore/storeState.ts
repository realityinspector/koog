// The Store's small state: which page is showing (from the address bar) and which app is running in the frame.
// Recently opened apps are saved per player. Plain module, no React.
import { pload, psave } from '../../profile/profile'
import type { KodeApp } from '../../kode/kore'

export type View = { kind: 'home' } | { kind: 'badges' } | { kind: 'mine' } | { kind: 'app'; id: string }
export interface Recent { id: string; at: number; n: number }
interface S { open: boolean; view: View; frame: string | null; v: number }

const isStore = (h: string) => /^#\/apps(\/|\?|$)/.test(h)
export function parseView(h: string): View {
  const seg = h.replace(/^#/, '').replace(/\?.*$/, '').split('/').filter(Boolean).slice(1).map(decodeURIComponent)
  if (!seg[0]) return { kind: 'home' }
  if (seg[0] === 'badges') return { kind: 'badges' }
  if (seg[0] === 'mine') return { kind: 'mine' }
  return { kind: 'app', id: seg[0].toLowerCase() }
}
export const viewHash = (v: View) => '#/apps' + (v.kind === 'home' ? '' : v.kind === 'app' ? '/' + v.id : '/' + v.kind)

const hot = import.meta.hot?.data as { st?: S; prev?: string } | undefined
let prev: string = hot?.prev ?? ''
const initial = (): S => ({ open: isStore(location.hash), view: isStore(location.hash) ? parseView(location.hash) : { kind: 'home' }, frame: null, v: 0 })
let st: S = hot?.st ?? initial()
if (!isStore(location.hash)) prev = location.hash
const subs = new Set<() => void>()
const set = (p: Partial<S>) => { st = { ...st, ...p, v: st.v + 1 }; subs.forEach((f) => f()) }
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const getSnapshot = () => st

function onHash() {
  const h = location.hash
  if (isStore(h)) set({ open: true, view: parseView(h), frame: null })
  else { prev = h; if (st.open || st.frame) set({ open: false, frame: null }) }
}
window.addEventListener('hashchange', onHash)

/** go to a Store page (changes the address bar, so Back works) */
export const goView = (v: View) => { if (location.hash !== viewHash(v)) location.hash = viewHash(v); else onHash() }
/** leave the Store and return to where the player was */
export const closeStore = () => { set({ frame: null }); location.hash = prev && !isStore(prev) ? prev : '#/play' }
export const openStore = (v: View = { kind: 'home' }) => { if (!isStore(location.hash)) prev = location.hash; goView(v) }
export const closeFrame = () => set({ frame: null })

// ---- recently opened (per player) ----
export const recents = (): Recent[] => { const r = pload<Recent[]>('appstore.recent', []); return Array.isArray(r) ? r : [] }
export function markOpened(id: string) {
  const old = recents(); const hit = old.find((r) => r.id === id)
  psave('appstore.recent', [{ id, at: Date.now(), n: (hit?.n ?? 0) + 1 }, ...old.filter((r) => r.id !== id)].slice(0, 12))
  set({}) // refresh readers
}

/** Open an app: a route app navigates there; a component app runs in the Store's frame. */
export function launch(app: KodeApp) {
  if (app.status === 'soon') return
  markOpened(app.id)
  const inside = !!app.route && /^#?\/?apps\//.test(app.route)
  if (app.route && !(inside && app.component)) { const r = app.route; location.hash = r.startsWith('#') ? r : '#' + (r.startsWith('/') ? r : '/' + r); return }
  if (app.component) set({ frame: app.id })
}

if (import.meta.hot) {
  import.meta.hot.dispose((d) => { window.removeEventListener('hashchange', onHash); d.st = st; d.prev = prev })
  import.meta.hot.accept()
}
