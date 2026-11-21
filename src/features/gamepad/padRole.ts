// Which job the wireless controller is doing, saved per kid.
// Play, Drums, and Synth are built-in maps. Pro (custom) is the kid's own list.
// Switching back to a built-in map keeps the Pro list for the next time.

import { create } from 'zustand'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { activeMap, knownFn, sanitizeMap, CONTROLS, type ControlId, type Fn, type PadMap, type PadRole } from './padAssign'

const ROLE_KEY = 'pad.role'
const MAP_KEY = 'pad.map'
const ROLES: PadRole[] = ['play', 'drums', 'synth', 'custom']

interface PadRoleState { role: PadRole; map: PadMap }

function cleanRole(v: unknown): PadRole {
  return ROLES.includes(v as PadRole) ? v as PadRole : 'play'
}

function load(): PadRoleState {
  return { role: cleanRole(pload<unknown>(ROLE_KEY, 'play')), map: sanitizeMap(pload<unknown>(MAP_KEY, null)) }
}

function make() { return create<PadRoleState>()(() => load()) }
export const usePadRole = (import.meta.hot?.data.padRole as ReturnType<typeof make> | undefined) ?? make()
if (import.meta.hot) import.meta.hot.data.padRole = usePadRole

onProfileChange(() => usePadRole.setState(load()), 'padRole')

export function setPadRole(role: PadRole) {
  if (!ROLES.includes(role)) return
  const cur = usePadRole.getState()
  if (cur.role === role) return
  psave(ROLE_KEY, role)
  usePadRole.setState({ role })
}

/** One dropdown changed. The Pro list starts as whatever job was active, then this one control changes. */
export function setPadBinding(id: ControlId, fn: Fn) {
  if (!knownFn(fn) || !CONTROLS.some((c) => c.id === id)) return
  const cur = usePadRole.getState()
  const base = cur.role === 'custom' ? cur.map : activeMap(cur.role, cur.map)
  if (cur.role === 'custom' && base[id] === fn) return
  const map: PadMap = { ...base, [id]: fn }
  psave(MAP_KEY, map)
  psave(ROLE_KEY, 'custom')
  usePadRole.setState({ role: 'custom', map })
}
