import { useAppStore } from '../store/appStore'

const PREFERRED = 'USB MIDI'
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const noteName = (n: number) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`

// Everything long-lived is kept in hot.data so editing this file never reopens the port.
interface Persisted {
  access?: MIDIAccess
  requested?: boolean
  noteId?: number
  listeners?: Set<RawListener>
}
export type RawListener = (data: Uint8Array, timeStamp: number) => void
const hot = import.meta.hot
const keep: Persisted = hot ? (hot.data.midi ??= {}) : {}

let output: MIDIOutput | null = null

function pick<T extends { name: string | null; state: string }>(ports: Iterable<T>): T | null {
  const list = [...ports].filter((p) => p.state === 'connected')
  return list.find((p) => p.name === PREFERRED) ?? list[0] ?? null
}

/** Subscribe to every raw incoming message of the selected input. Returns unsubscribe. */
export function subscribeRaw(fn: RawListener) {
  const set = (keep.listeners ??= new Set())
  set.add(fn)
  return () => void set.delete(fn)
}

function onMessage(e: MIDIMessageEvent) {
  const d = e.data
  if (d && keep.listeners) for (const fn of [...keep.listeners]) { try { fn(d, e.timeStamp) } catch { /* isolate listeners */ } }
  if (!d || d.length < 3) return
  const status = d[0] & 0xf0
  if (status !== 0x90 && status !== 0x80) return
  const on = status === 0x90 && d[2] > 0
  const id = (keep.noteId = (keep.noteId ?? 0) + 1)
  const ev = { id, note: d[1], name: noteName(d[1]), velocity: d[2], on }
  useAppStore.setState((s) => ({ recentNotes: [ev, ...s.recentNotes].slice(0, 12) }))
}

function refresh(access: MIDIAccess) {
  const input = pick(access.inputs.values())
  output = pick(access.outputs.values())
  // (re)assign handlers on every input so code edits take effect and no stale handler remains
  for (const i of access.inputs.values()) i.onmidimessage = i === input ? onMessage : null
  useAppStore.setState({
    midiConnected: !!input,
    midiInputName: input?.name ?? null,
    midiOutputName: output?.name ?? null,
  })
}

function attach(access: MIDIAccess) {
  access.onstatechange = () => refresh(access)
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
  })
  import.meta.hot.accept()
}
