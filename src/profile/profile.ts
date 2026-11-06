// Kid profiles + Kid/Dad mode.
//
// Each kid types a short code word ("tiger", "m", "zoe") and their progress lives in
// localStorage under koog.p.<code>.<name>. This keeps siblings apart on one computer.
// It is NOT security: anyone at the keyboard can switch, and that's on purpose.
import { create } from 'zustand'

export type Mode = 'kid' | 'dad'
const GUEST = 'guest'
const K_ACTIVE = 'koog.active'
const K_PROFILES = 'koog.profiles'
const K_MODE = 'koog.mode'
const RESERVED = new Set([GUEST, 'dad', 'dev', 'admin', 'koog'])

const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }
const json = <T,>(k: string, d: T): T => { try { const s = read(k); return s ? (JSON.parse(s) as T) : d } catch { return d } }

export const normalizeCode = (s: string) => s.trim().toLowerCase()

/** Open on a plain launch for a guest. A link, or a kid who is already signed in, starts on the instrument. */
function gateOnLaunch(active: string): boolean {
  if (active !== GUEST) return false
  try { return !location.hash.startsWith('#/') } catch { return true }
}

/** null if OK, otherwise a kid-friendly reason. */
export function checkCode(raw: string, existing: string[]): string | null {
  const c = normalizeCode(raw)
  if (!c) return 'Type a code word first.'
  if (!/^[a-z][a-z0-9]*$/.test(c)) return 'One word: letters (and numbers after the first letter). No spaces.'
  if (c.length > 12) return 'Keep it short: 12 letters max.'
  if (RESERVED.has(c)) return `"${c}" is taken by the app. Pick another.`
  if (existing.includes(c)) return `"${c}" already exists. Tap it to sign in.`
  return null
}

// ---- legacy (pre-profile) data: matched by suffix so it can be claimed once ----
const LEGACY: [RegExp, string][] = [
  [/^[a-z]+\.harmony$/, 'harmony'],
  [/^[a-z]+\.songs\.best\.v1$/, 'songs.best.v1'],
  [/^[a-z]+\.mysongs\.v1$/, 'mysongs.v1'],
  [/^sl\.challenges\.(badges|bests)$/, 'challenges.$1'],
]
function legacyKeys(): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (k.startsWith('koog.')) continue
      for (const [re, to] of LEGACY) if (re.test(k)) { out.push({ from: k, to: k.replace(re, to) }); break }
    }
  } catch { /* ignore */ }
  return out
}

interface ProfileState {
  active: string
  profiles: string[]
  mode: Mode
  /** progress saved before profiles existed, waiting for someone to claim it */
  hasLegacy: boolean
  /** Who's playing is open. Signing out is separate: the signed-in kid stays until they pick someone else. */
  gate: boolean
  showGate: () => void
  hideGate: () => void
  signIn: (code: string) => void
  create: (code: string, claimLegacy: boolean) => string | null
  signOut: () => void
  remove: (code: string) => void
  setMode: (m: Mode) => void
}

type Listener = (code: string) => void
const listeners: Set<Listener> = (import.meta.hot?.data.listeners as Set<Listener> | undefined) ?? new Set()
/** named listeners: registering the same name again REPLACES the old one, so a hot edit can never leave two copies reloading the same data */
const named: Map<string, Listener> = (import.meta.hot?.data.namedListeners as Map<string, Listener> | undefined) ?? new Map()

function make() {
  const profiles = json<string[]>(K_PROFILES, [])
  const active = read(K_ACTIVE)
  return create<ProfileState>()((set, get) => {
    const switchTo = (code: string) => {
      write(K_ACTIVE, code)
      set({ active: code, gate: code === GUEST })
      listeners.forEach((fn) => { try { fn(code) } catch (e) { console.error(e) } })
    }
    const activeCode = active && profiles.includes(active) ? active : GUEST
    return {
      active: activeCode,
      profiles,
      mode: read(K_MODE) === 'dad' ? 'dad' : 'kid',
      hasLegacy: legacyKeys().length > 0,
      gate: gateOnLaunch(activeCode),
      showGate: () => set({ gate: true }),
      hideGate: () => set({ gate: false }),
      signIn: (code) => { const c = normalizeCode(code); if (get().profiles.includes(c)) switchTo(c) },
      create: (code, claimLegacy) => {
        const c = normalizeCode(code)
        const err = checkCode(c, get().profiles)
        if (err) return err
        if (claimLegacy) {
          for (const { from, to } of legacyKeys()) {
            const v = read(from)
            if (v != null) { write(`koog.p.${c}.${to}`, v); try { localStorage.removeItem(from) } catch { /* ignore */ } }
          }
        }
        const next = [...get().profiles, c]
        write(K_PROFILES, JSON.stringify(next))
        set({ profiles: next, hasLegacy: legacyKeys().length > 0 })
        switchTo(c)
        return null
      },
      signOut: () => switchTo(GUEST),
      remove: (code) => {
        const next = get().profiles.filter((p) => p !== code)
        write(K_PROFILES, JSON.stringify(next))
        set({ profiles: next })
        if (get().active === code) switchTo(GUEST)
      },
      setMode: (mode) => { write(K_MODE, mode); set({ mode }) },
    }
  })
}

export const useProfile = (import.meta.hot?.data.profile as ReturnType<typeof make> | undefined) ?? make()

/** BOSS mode IS Dad mode: a lean studio for the grown-up. A view-time unlock only: never write kid progress because of it. */
export const isPro = () => useProfile.getState().mode === 'dad'
export const usePro = () => useProfile((s) => s.mode === 'dad')

export const isGuest = (code = useProfile.getState().active) => code === GUEST

/** Storage key for the active kid. */
export const pkey = (name: string) => `koog.p.${useProfile.getState().active}.${name}`
export function pload<T>(name: string, fallback: T): T { return json(pkey(name), fallback) }
export function psave(name: string, value: unknown) { write(pkey(name), JSON.stringify(value)) }

/**
 * A per-player value that used to live under ONE shared key for the whole computer (so siblings overwrote each other).
 * The first read for a player copies the old shared value into their own koog.p.<code>.<name> (the shared key stays for the others to adopt).
 */
export function ploadShared<T>(name: string, legacyKey: string, fallback: T): T {
  const k = pkey(name)
  if (read(k) == null) { const old = read(legacyKey); if (old != null) write(k, old) }
  return json(k, fallback)
}

/**
 * Called after the active kid changes, so stores can reload their saved data. This is THE registry for per-player modules.
 * Pass a `name` (the module's own) and a hot edit replaces the old listener instead of stacking another one.
 */
export function onProfileChange(fn: Listener, name?: string): () => void {
  if (name) { const old = named.get(name); if (old) listeners.delete(old); named.set(name, fn) }
  listeners.add(fn)
  return () => { listeners.delete(fn); if (name && named.get(name) === fn) named.delete(name) }
}
/** for window.__koogState() and scripts/state-fixtures.ts */
export const profileListenerInfo = () => ({ count: listeners.size, names: [...named.keys()].sort() })

if (import.meta.hot) {
  import.meta.hot.data.profile = useProfile
  import.meta.hot.data.listeners = listeners
  import.meta.hot.data.namedListeners = named
  import.meta.hot.accept()
}
