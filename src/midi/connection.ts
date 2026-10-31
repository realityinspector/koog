import { useAppStore } from '../store/appStore'
import { useDevices, roleFor, emitDj, emitSurface, setDjSender, type Device, type DeviceRole } from '../music/devices'

const PREFERRED = 'USB MIDI'
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const noteName = (n: number) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`

// Everything long-lived is kept in hot.data so editing this file never reopens the port.
interface Persisted {
  access?: MIDIAccess
  requested?: boolean
  noteId?: number
  listeners?: Set<RawListener>
  djIds?: string[]
  timers?: Set<number>
  unsub?: () => void
}
export type RawListener = (data: Uint8Array, timeStamp: number) => void
const hot = import.meta.hot
const keep: Persisted = hot ? (hot.data.midi ??= {}) : {}

let output: MIDIOutput | null = null

/** Subscribe to every raw incoming message of every PIANO-role input. Returns unsubscribe. */
export function subscribeRaw(fn: RawListener) {
  const set = (keep.listeners ??= new Set())
  set.add(fn)
  return () => void set.delete(fn)
}

function pianoMessage(d: Uint8Array, timeStamp: number) {
  if (keep.listeners) for (const fn of [...keep.listeners]) { try { fn(d, timeStamp) } catch { /* isolate listeners */ } }
  if (d.length < 3) return
  const status = d[0] & 0xf0
  if (status !== 0x90 && status !== 0x80) return
  const on = status === 0x90 && d[2] > 0
  const id = (keep.noteId = (keep.noteId ?? 0) + 1)
  const ev = { id, note: d[1], name: noteName(d[1]), velocity: d[2], on }
  useAppStore.setState((s) => ({ recentNotes: [ev, ...s.recentNotes].slice(0, 12) }))
}

/** One routing point: piano makes notes, dj goes to the DJ listeners (never notes), off is ignored. */
function route(role: DeviceRole, d: Uint8Array, t: number, id: string) {
  if (!d) return
  if (role === 'piano') pianoMessage(d, t)
  else if (role === 'dj') emitDj(d, t, id)
  else if (role === 'surface') emitSurface(d, t, id)
}
const liveRole = (id: string, name: string): DeviceRole => useDevices.getState().devices.find((x) => x.id === id)?.role ?? roleFor(name)

/** Test hook: route bytes as if they came from an input with this port name (uses its saved/guessed role). */
export function __routeForTest(name: string, data: number[] | Uint8Array, id = 'test:' + name) {
  route(roleFor(name), data instanceof Uint8Array ? data : new Uint8Array(data), 0, id)
}

function sweepLeds(out: MIDIOutput) {
  for (let ch = 0; ch < 16; ch++) {
    const h = window.setTimeout(() => {
      try {
        for (let n = 0; n < 128; n++) out.send([0x80 | ch, n, 0])
        out.send([0xb0 | ch, 123, 0])
      } catch { /* port gone */ }
    }, ch * 15)
    ;(keep.timers ??= new Set()).add(h)
  }
}

/** Derive connected/hasOutput/role for every port, preserving live role changes. */
function refresh(access: MIDIAccess) {
  const outs = [...access.outputs.values()].filter((p) => p.state === 'connected')
  const devices: Device[] = []
  for (const i of access.inputs.values()) {
    const name = i.name ?? i.id
    const prev = useDevices.getState().devices.find((x) => x.id === i.id)
    devices.push({ id: i.id, name, role: prev?.role ?? roleFor(name), connected: i.state === 'connected', hasOutput: outs.some((o) => o.name === i.name) })
    i.onmidimessage = (e) => { if (e.data) route(liveRole(i.id, name), e.data, e.timeStamp, i.id) }
  }
  useDevices.setState({ devices })
  applyDevices(access)
}

/** Everything that follows from the device list + roles: app-store flags, DJ sender, LED sweep. */
function applyDevices(access: MIDIAccess) {
  const devs = useDevices.getState().devices
  const pianos = devs.filter((d) => d.connected && d.role === 'piano')
  const djs = devs.filter((d) => d.connected && (d.role === 'dj' || d.role === 'surface')) // a synth control surface is still a DJ-style controller: LEDs and output
  const outs = [...access.outputs.values()].filter((p) => p.state === 'connected')
  const cur = useAppStore.getState()
  const pn = pianos.find((d) => d.name === PREFERRED) ?? pianos[0]
  output = (pn && outs.find((o) => o.name === pn.name)) || outs.find((o) => !djs.some((d) => d.name === o.name)) || null
  if (cur.midiConnected !== !!pn || cur.midiInputName !== (pn?.name ?? null) || cur.midiOutputName !== (output?.name ?? null)) {
    useAppStore.setState({ midiConnected: !!pn, midiInputName: pn?.name ?? null, midiOutputName: output?.name ?? null })
  }
  const djOut = djs.map((d) => outs.find((o) => o.name === d.name)).find(Boolean) ?? null
  setDjSender(djOut ? (b) => { try { djOut.send(b) } catch { /* ignore */ } } : null)
  // DJ newly connected (or newly assigned the DJ role): turn the idle light show off
  const now = new Set(djs.map((d) => d.id))
  const before = (keep.djIds ??= [])
  for (const d of djs) {
    if (before.includes(d.id)) continue
    const o = outs.find((x) => x.name === d.name)
    if (o) sweepLeds(o)
  }
  keep.djIds = [...now]
}

function attach(access: MIDIAccess) {
  access.onstatechange = () => refresh(access)
  keep.unsub?.()
  // role changes via setRole re-route live (handlers read the role per message) and update flags/sender
  let prev = useDevices.getState().devices
  keep.unsub = useDevices.subscribe((st) => { if (st.devices !== prev) { prev = st.devices; applyDevices(access) } })
  refresh(access)
}

export function sendMidi(bytes: number[]) {
  output?.send(bytes)
}

async function start() {
  if (keep.access) return attach(keep.access)
  if (keep.requested) return
  keep.requested = true
  if (!navigator.requestMIDIAccess) {
    useAppStore.setState({ midiSupported: false })
    return
  }
  try {
    keep.access = await navigator.requestMIDIAccess({ sysex: false })
    attach(keep.access)
  } catch (err) {
    keep.requested = false
    useAppStore.setState({ midiError: String(err) })
  }
}

void start()

// Vite only detects the literal `import.meta.hot.accept(` text, so keep it spelled out.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (keep.access) {
      keep.access.onstatechange = null
      for (const i of keep.access.inputs.values()) i.onmidimessage = null
    }
    keep.unsub?.(); keep.unsub = undefined
    if (keep.timers) { for (const h of keep.timers) clearTimeout(h); keep.timers.clear() }
  })
  import.meta.hot.accept()
}
