// Live ear: the microphone becomes notes on the same path as a MIDI keyboard.
// The mic is analysed only. It is never connected to the speakers.
// Audio ON plays the heard note on Koog (same switch as a plugged-in keyboard). Headphones keep that from feeding back.
import { create } from 'zustand'
import { EAR_RANGE, detectPitch, frameRms, type EarKind } from '../../audio/ear/pitch'
import { createEarGate, type EarEvent } from '../../audio/ear/gate'
import { getCtx, unlockHost } from '../../audio/host'
import { midiSoundFirst } from '../../music/localNotes'
import { pushNote } from '../../music/notes'
import { noteName } from '../../music/theory'
import { registerPanicTarget } from '../../music/panic'

export type { EarKind }

interface EarState {
  on: boolean
  kind: EarKind
  /** MIDI note being held, or null */
  note: number | null
  /** 0..1 microphone level, for the meter */
  level: number
  error: string
}
const fresh = (): EarState => ({ on: false, kind: 'piano', note: null, level: 0, error: '' })
function make() { return create<EarState>()(() => fresh()) }
export const useEar = (import.meta.hot?.data.earStore as ReturnType<typeof make> | undefined) ?? make()

export function setEarKind(kind: EarKind) { useEar.setState({ kind }) }

let seq = 1
let generation = 0
let timer = 0
let stream: MediaStream | null = null
let source: MediaStreamAudioSourceNode | null = null
const gate = createEarGate()

function emit(ev: EarEvent) {
  const id = ++seq
  midiSoundFirst(id, ev.note, ev.velocity, ev.on)
  pushNote({ id, note: ev.note, name: noteName(ev.note), velocity: ev.velocity, on: ev.on, t: ev.t })
}

function silence(t = performance.now()) {
  for (const ev of gate.flush(t)) emit(ev)
  if (useEar.getState().note != null || useEar.getState().level !== 0) useEar.setState({ note: null, level: 0 })
}

function tearDown() {
  if (timer) { clearInterval(timer); timer = 0 }
  try { source?.disconnect() } catch { /* already gone */ }
  source = null
  stream?.getTracks().forEach((tr) => tr.stop())
  stream = null
  silence()
}

function pump(an: AnalyserNode, buf: Float32Array<ArrayBuffer>, sampleRate: number) {
  an.getFloatTimeDomainData(buf)
  const rms = frameRms(buf)
  const range = EAR_RANGE[useEar.getState().kind]
  const hit = detectPitch(buf, sampleRate, range.minHz, range.maxHz)
  const events = gate.step({ t: performance.now(), midi: hit?.midi ?? null, clarity: hit?.clarity ?? 0, rms })
  let note = gate.held()
  for (const ev of events) { emit(ev); note = ev.on ? ev.note : gate.held() }
  const level = Math.max(0, Math.min(1, rms * 8))
  const cur = useEar.getState()
  if (cur.note !== note || Math.abs(cur.level - level) > 0.04) useEar.setState({ note, level })
}

/** Start or stop the microphone. Call start from a click so the browser can allow the mic. */
export async function setEarOn(on: boolean) {
  const mine = ++generation
  tearDown()
  if (!on) { useEar.setState({ on: false, error: '' }); return }
  if (!navigator.mediaDevices?.getUserMedia) {
    useEar.setState({ on: false, error: 'This browser has no microphone.' })
    return
  }
  try {
    await unlockHost()
    if (mine !== generation) return
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      video: false,
    })
    if (mine !== generation) { mic.getTracks().forEach((tr) => tr.stop()); return }
    const ctx = getCtx()
    const src = ctx.createMediaStreamSource(mic)
    const an = ctx.createAnalyser()
    an.fftSize = 2048
    an.smoothingTimeConstant = 0
    src.connect(an)
    const buf = new Float32Array(an.fftSize)
    stream = mic
    source = src
    useEar.setState({ on: true, error: '', note: null, level: 0 })
    timer = window.setInterval(() => pump(an, buf, ctx.sampleRate), 32)
  } catch {
    if (mine !== generation) return
    tearDown()
    useEar.setState({ on: false, error: 'The microphone is blocked. Allow it, then press Hear again.' })
  }
}

registerPanicTarget('ear', () => silence())

if (import.meta.hot) {
  import.meta.hot.dispose(() => { generation++; tearDown() })
  import.meta.hot.data.earStore = useEar
  import.meta.hot.accept()
}
