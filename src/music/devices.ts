// Several MIDI devices at once, each with a ROLE. A piano (any keyboard) plays notes into Koog as before.
// A DJ controller (e.g. a Numark Mixtrack) drives the DJ decks instead of playing notes, so one kid can DJ while
// another plays piano. src/midi/connection.ts opens every input and routes by role; src/features/dj listens here.
// STABLE API: useDevices { devices }, setRole(id, role), onDjMessage(fn), sendToDj(bytes), guessRole(name).
import { create } from 'zustand'
import { subscribe, emit, send, setSenderOverride, type Role } from '../midi/router'

export type DeviceRole = Role
export interface Device { id: string; name: string; role: DeviceRole; connected: boolean; hasOutput: boolean }
export type DjListener = (data: Uint8Array, timeStamp: number, deviceId: string) => void

const ROLES_KEY = 'koog.devices.roles'
const loadRoles = (): Record<string, DeviceRole> => { try { return JSON.parse(localStorage.getItem(ROLES_KEY) || '{}') } catch { return {} } }

/** default role from the port name: DJ controllers by name, everything else is a piano */
export const guessRole = (name: string): DeviceRole => (/mixtrack|numark|ddj|pioneer dj|traktor|hercules|dj ?control|inpulse/i.test(name) ? 'dj' : 'piano')
/** the saved role for a device name (users can override the guess) */
export const roleFor = (name: string): DeviceRole => loadRoles()[name] ?? guessRole(name)

interface DevState { devices: Device[] }
type Hot = { store?: ReturnType<typeof make>; roles?: Set<(name: string, role: DeviceRole) => void> }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<DevState>()(() => ({ devices: [] })) }
export const useDevices = hot.store ?? make()
const roleListeners: Set<(name: string, role: DeviceRole) => void> = hot.roles ?? new Set()

export function setRole(name: string, role: DeviceRole) {
  const r = loadRoles(); r[name] = role
  try { localStorage.setItem(ROLES_KEY, JSON.stringify(r)) } catch { /* ignore */ }
  useDevices.setState((s) => ({ devices: s.devices.map((d) => (d.name === name ? { ...d, role } : d)) }))
  for (const f of [...roleListeners]) { try { f(name, role) } catch (e) { console.error('[role]', e) } }
}
/** a device's role was changed with setRole (Controller Mode listens: 'surface' means the controller is a synth control surface) */
export function onRoleChange(fn: (name: string, role: DeviceRole) => void) { roleListeners.add(fn); return () => { roleListeners.delete(fn) } }
// Thin wrappers over src/midi/router.ts (the one MIDI router); kept so every consumer works unchanged.
/** raw MIDI from any device whose role is 'surface' (a DJ controller used as knobs and faders for the synth; src/features/controller) */
export const onSurfaceMessage = (fn: DjListener) => subscribe('surface', fn)
export const emitSurface = (data: Uint8Array, t: number, id: string) => emit('surface', data, t, id)
/** raw MIDI from any device whose role is 'loop' (the controller runs the Loop Station; src/features/loopstation) */
export const onLoopMessage = (fn: DjListener) => subscribe('loop', fn)
export const emitLoop = (data: Uint8Array, t: number, id: string) => emit('loop', data, t, id)
/** raw MIDI from any device whose role is 'drums' (the controller's pads play the drum machine; src/features/drumpads) */
export const onDrumsMessage = (fn: DjListener) => subscribe('drums', fn)
export const emitDrums = (data: Uint8Array, t: number, id: string) => emit('drums', data, t, id)
/** raw MIDI from any device whose role is 'dj' */
export const onDjMessage = (fn: DjListener) => subscribe('dj', fn)
export const emitDj = (data: Uint8Array, t: number, id: string) => emit('dj', data, t, id)
/** LEDs etc.: send raw bytes to the DJ-style controller's output (dj, surface, loop or drums role; no-op if none) */
export const sendToDj = (bytes: number[]) => void send(['dj', 'surface', 'loop', 'drums'], bytes)
/** legacy: override the DJ output sender (null = look the output up by role) */
export const setDjSender = (fn: ((b: number[]) => void) | null) => setSenderOverride(fn)

if (import.meta.hot) {
  import.meta.hot.data.store = useDevices
  import.meta.hot.data.roles = roleListeners
  import.meta.hot.accept()
}
