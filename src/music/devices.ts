// Several MIDI devices at once, each with a ROLE. A piano (any keyboard) plays notes into Koog as before.
// A DJ controller (e.g. a Numark Mixtrack) drives the DJ decks instead of playing notes, so one kid can DJ while
// another plays piano. src/midi/connection.ts opens every input and routes by role; src/features/dj listens here.
// STABLE API: useDevices { devices }, setRole(id, role), onDjMessage(fn), sendToDj(bytes), guessRole(name).
import { create } from 'zustand'

export type DeviceRole = 'piano' | 'dj' | 'off'
export interface Device { id: string; name: string; role: DeviceRole; connected: boolean; hasOutput: boolean }
export type DjListener = (data: Uint8Array, timeStamp: number, deviceId: string) => void

const ROLES_KEY = 'koog.devices.roles'
const loadRoles = (): Record<string, DeviceRole> => { try { return JSON.parse(localStorage.getItem(ROLES_KEY) || '{}') } catch { return {} } }

/** default role from the port name: DJ controllers by name, everything else is a piano */
export const guessRole = (name: string): DeviceRole => (/mixtrack|numark|ddj|pioneer dj|traktor|hercules|dj ?control|inpulse/i.test(name) ? 'dj' : 'piano')
/** the saved role for a device name (users can override the guess) */
export const roleFor = (name: string): DeviceRole => loadRoles()[name] ?? guessRole(name)

interface DevState { devices: Device[] }
type Hot = { store?: ReturnType<typeof make>; dj?: Set<DjListener>; send?: { fn: ((b: number[]) => void) | null } }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<DevState>()(() => ({ devices: [] })) }
export const useDevices = hot.store ?? make()
const djListeners: Set<DjListener> = hot.dj ?? new Set()
const sender: { fn: ((b: number[]) => void) | null } = hot.send ?? { fn: null }

export function setRole(name: string, role: DeviceRole) {
  const r = loadRoles(); r[name] = role
  try { localStorage.setItem(ROLES_KEY, JSON.stringify(r)) } catch { /* ignore */ }
  useDevices.setState((s) => ({ devices: s.devices.map((d) => (d.name === name ? { ...d, role } : d)) }))
}
/** raw MIDI from any device whose role is 'dj' */
export function onDjMessage(fn: DjListener) { djListeners.add(fn); return () => { djListeners.delete(fn) } }
/** connection.ts calls this for dj-role input messages */
export function emitDj(data: Uint8Array, t: number, id: string) { for (const f of [...djListeners]) { try { f(data, t, id) } catch (e) { console.error('[dj]', e) } } }
/** LEDs etc.: send raw bytes to the DJ controller's output (no-op if none) */
export const sendToDj = (bytes: number[]) => sender.fn?.(bytes)
/** connection.ts registers the DJ output sender */
export const setDjSender = (fn: ((b: number[]) => void) | null) => { sender.fn = fn }

if (import.meta.hot) {
  import.meta.hot.data.store = useDevices
  import.meta.hot.data.dj = djListeners
  import.meta.hot.data.send = sender
  import.meta.hot.accept()
}
