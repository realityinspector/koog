// The one MIDI router. Port I/O (src/midi/connection.ts) calls emit(role, ...); everything that cares about a
// role calls subscribe(role, ...). send(role, bytes) goes the other way, to the output of a connected device
// with that role. src/music/devices.ts keeps the old onDjMessage/emitDj/sendToDj names as thin wrappers.
// Long-lived state is kept in import.meta.hot.data so editing this file never drops subscribers.
export type Role = 'piano' | 'dj' | 'surface' | 'loop' | 'drums' | 'gamepads' | 'off'
export type MidiListener = (data: Uint8Array, timeStamp: number, deviceId: string) => void
export interface PortInfo { name: string; role: Role; connected: boolean }

interface RouterState {
  subs: Map<Role, Set<MidiListener>>
  /** connected devices with their roles, and the connected output ports by name (set by connection.ts) */
  devices: PortInfo[]
  outputs: Map<string, { send: (b: number[]) => void }>
  /** legacy setDjSender override */
  override: ((b: number[]) => void) | null
  /** cached listener arrays so emit() copies nothing per message (rebuilt when someone subscribes or unsubscribes) */
  arr?: Map<Role, MidiListener[]>
}
const hot = import.meta.hot
const st: RouterState = hot ? ((hot.data.router ??= { subs: new Map(), devices: [], outputs: new Map(), override: null }) as RouterState) : { subs: new Map(), devices: [], outputs: new Map(), override: null }

/** listener count per role (window.__koogState) */
export const routerListenerCounts = () => Object.fromEntries([...st.subs].map(([r, s]) => [r, s.size]))
/** Listen to raw MIDI from every device whose role is `role`. Returns unsubscribe. */
export function subscribe(role: Role, fn: MidiListener) {
  let set = st.subs.get(role)
  if (!set) st.subs.set(role, (set = new Set()))
  set.add(fn)
  st.arr?.delete(role)
  return () => { st.subs.get(role)?.delete(fn); st.arr?.delete(role) }
}

/** Deliver a message to every listener of `role` (a throwing listener never blocks the others). 'off' is ignored. */
export function emit(role: Role, data: Uint8Array, t: number, deviceId: string) {
  if (role === 'off' || !data) return
  const arr = (st.arr ??= new Map()).get(role) ?? (st.subs.get(role) ? (st.arr.set(role, [...st.subs.get(role)!]), st.arr.get(role)!) : undefined)
  if (!arr) return
  for (let i = 0; i < arr.length; i++) { try { arr[i](data, t, deviceId) } catch (e) { console.error('[midi:' + role + ']', e) } }
}

/** connection.ts tells the router which devices are connected (with roles) and which output ports exist. */
export function setPorts(devices: PortInfo[], outputs: Iterable<{ name: string | null; send: (b: number[]) => void }>) {
  st.devices = devices
  st.outputs = new Map()
  for (const o of outputs) if (o.name) st.outputs.set(o.name, o)
}

function outputFor(roles: Role[]) {
  for (const d of st.devices) {
    if (!d.connected || !roles.includes(d.role)) continue
    const o = st.outputs.get(d.name)
    if (o) return o
  }
  return null
}

/** Send raw bytes to the output whose name matches the first connected device with this role. Returns whether one was found. */
export function send(role: Role | Role[], bytes: number[]) {
  const roles = Array.isArray(role) ? role : [role]
  if (roles.includes('dj') && st.override) { st.override(bytes); return true }
  const o = outputFor(roles)
  if (!o) return false
  try { o.send(bytes) } catch { /* port gone */ }
  return true
}

/** Legacy hook: replace the DJ output with a custom sender (null restores port lookup). */
export function setSenderOverride(fn: ((b: number[]) => void) | null) { st.override = fn }

if (import.meta.hot) {
  import.meta.hot.data.router = st
  import.meta.hot.accept()
}
