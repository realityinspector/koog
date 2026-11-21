// Koog Kode engine: runs the code box on the master clock. No React here.
//   run(text)        parse; if it is fine, the new code starts at the NEXT bar line (nothing cuts, nothing clicks). Problems keep the old music going.
//   stop()           silence now. Registered with panic, so the global stop button works too.
//   writeForMe()     listen to the next phrase played on ANY instrument (Kode tokens) and write it as notes / drums lines.
//   useMyLoop()      turn the looper layers and the drum pattern into Kode lines.
// State lives in import.meta.hot.data so editing this file never stops the music.
import { create } from 'zustand'
import { acquireClock, beatPos, getBpm, onTick, releaseClock, setBpm, timeOfBeat, useMaster } from '../../music/masterClock'
import { registerPanicTarget } from '../../music/panic'
import { unlockHost } from '../../audio/host'
import { getBeat } from '../dj/clock'
import { useLoop, exportTracks } from '../loopstation/loopEngine'
import { useDrums } from '../drumpads/drumEngine'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { startKode, onToken } from '../../kode/tokens'
import { Runner, type Clock } from '../../kode/lang/scheduler'
import { parseProgram } from '../../kode/lang/parse'
import { drumRowsToLine, loopNotesToLine, writeFromPlayed, type Played } from '../../kode/lang/write'
import { CYCLE_BEATS, describe, type Diag, type Program } from '../../kode/lang/types'
import { EXAMPLES } from '../../kode/lang/examples'
import { createKodeSink, type KodeSink } from './kodeAudio'
import { resolveMotif } from '../../kode/kore/motifs'
import { markConcept } from '../../kode/kore/concepts'

/** `play <name>` asks the Koding Kore for the motif (looked up again every bar, so editing My Motifs is live) */
const knownMotif = (name: string) => { try { return resolveMotif(name) !== null } catch { return false } }
const motifs = (name: string, shift: number, speed: number) => { try { return resolveMotif(name, shift, speed) } catch { return null } }

export interface KodeView {
  text: string
  running: boolean
  /** the text that is playing (or waiting for its bar line) */
  playingText: string | null
  /** problems in the text as typed (live) */
  errors: Diag[]
  /** the bar line the new code waits for (absolute bar number), or null */
  waitingBar: number | null
  note: string
  listening: boolean
  heard: number
  layers: number
}

const KEY = 'kode.v1'
const loadText = (): string => { const t = pload<string>(KEY, ''); return typeof t === 'string' && t.trim() ? t : EXAMPLES[0].code }

type Hot = { store?: ReturnType<typeof make>; E?: Eng; off?: () => void }
interface Eng { runner: Runner; sink: KodeSink; startedClock: boolean; offTick?: () => void; stopKode?: () => void; offTok?: () => void; played: Played[]; lastHeard: number; doneTimer: number; saveTimer: number; unPanic?: () => void; poll?: number }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<KodeView>()(() => ({ text: loadText(), running: false, playingText: null, errors: [], waitingBar: null, note: '', listening: false, heard: 0, layers: 0 })) }
export const useKode = hot.store ?? make()
const get = () => useKode.getState()
const set = (p: Partial<KodeView>) => useKode.setState(p)

const clock: Clock = { beatPos: (t) => beatPos(t), timeOfBeat: (b) => timeOfBeat(b), bpm: () => getBpm(), setBpm: (b) => setBpm(b) }
function newEng(): Eng {
  const sink = createKodeSink()
  return { runner: new Runner(clock, sink, 100, (n, sh, sp) => motifs(n, sh, sp)), sink, startedClock: false, played: [], lastHeard: 0, doneTimer: 0, saveTimer: 0 }
}
const E: Eng = hot.E ?? newEng()
// an engine kept from before an edit of this file keeps its runner and sink; only the wiring is renewed below

/** the runner and sink (the test harness reads these) */
export const runner = () => E.runner
export const sink = () => E.sink
export const debugLog = () => E.sink.log
export function debugOn(on: boolean) { E.sink.logOn = on; if (on) E.sink.log.length = 0 }

// ---------- editing ----------
export function setText(text: string) {
  set({ text, errors: parseProgram(text, knownMotif).errors })
  window.clearTimeout(E.saveTimer)
  E.saveTimer = window.setTimeout(() => psave(KEY, get().text), 500)
}
export function appendLines(lines: string[]) {
  if (!lines.length) return
  const cur = get().text.replace(/\s+$/, '')
  setText((cur ? cur + '\n' : '') + lines.join('\n') + '\n')
}

// ---------- running ----------
function tickOnce() {
  const now = performance.now()
  E.runner.tick(now)
  const w = E.runner.pendingCycle()
  const playing = E.runner.activeSource()
  const s = get()
  if (s.waitingBar !== w) set({ waitingBar: w })
  if (playing && s.playingText !== playing) set({ playingText: playing })
  if (!E.runner.isPlaying() && s.running) endRun()
}
function endRun() {
  releaseClock('kode', loopsRunning() || getBeat().playing || drumsRunning())
  E.startedClock = false
  set({ running: false, waitingBar: null, playingText: null, layers: 0 })
}
const loopsRunning = () => { try { return useLoop.getState().running } catch { return false } }
const drumsRunning = () => { try { return useDrums.getState().running } catch { return false } }

function wire() {
  E.offTick?.()
  E.offTick = onTick(tickOnce)
}

/** run the text. Returns the bar the new code starts on, or null when the code has a problem. */
export function run(text = get().text): number | null {
  const prog: Program = parseProgram(text, knownMotif)
  if (text !== get().text) set({ text })
  set({ errors: prog.errors })
  if (prog.errors.length) { set({ note: describe(prog.errors[0]) }); return null }
  const plays = prog.layers.filter((l) => l.motif)
  if (plays.length) { markConcept('function'); if (plays.some((l) => l.motif!.shift !== 0 || l.motif!.speed !== 1)) markConcept('parameter') }
  void unlockHost()
  E.sink.warm(prog.layers.map((l) => l.sound))
  acquireClock('kode')
  wire()
  const wasPlaying = E.runner.isPlaying()
  const bar = E.runner.run(prog, performance.now())
  set({ running: true, playingText: wasPlaying ? get().playingText : text, waitingBar: bar, layers: prog.layers.length,
    note: wasPlaying ? `Got it. The change lands at the next bar line (${Math.max(0, Math.round((timeOfBeat(bar * CYCLE_BEATS) - performance.now()) / 100) / 10)} s).` : 'Playing.' })
  psave(KEY, text)
  tickOnce()
  return bar
}

export function stop() {
  E.runner.stop()
  if (get().running || get().waitingBar !== null) set({ note: 'Stopped.' })
  endRun()
}

// ---------- music -> code ----------
const IDLE_MS = 1600, MAX_HEARD = 48
export function writeForMe() {
  if (get().listening) return finishListening()
  E.played = []; E.lastHeard = 0
  E.stopKode?.(); E.offTok?.()
  E.stopKode = startKode()
  E.offTok = onToken((t) => {
    if (t.src === 'screen') return
    if (E.played.length >= MAX_HEARD) { finishListening(); return }
    E.played.push({ src: t.src, pitch: t.pitch, lane: t.lane, vel: t.vel, t: t.t })
    E.lastHeard = performance.now()
    set({ heard: E.played.length })
  })
  window.clearInterval(E.doneTimer)
  E.doneTimer = window.setInterval(() => { if (E.lastHeard && performance.now() - E.lastHeard > IDLE_MS) finishListening() }, 150)
  set({ listening: true, heard: 0, note: 'Listening... play a phrase on any instrument. I stop when you pause.' })
}
export function finishListening() {
  window.clearInterval(E.doneTimer); E.doneTimer = 0
  E.offTok?.(); E.offTok = undefined
  E.stopKode?.(); E.stopKode = undefined
  const w = writeFromPlayed(E.played, getBpm())
  E.played = []
  set({ listening: false, heard: 0 })
  if (!w.lines.length) { set({ note: 'I did not hear anything to write. Try again.' }); return w }
  appendLines(w.lines)
  set({ note: `Wrote ${w.lines.length === 2 ? 'a notes line and a drums line' : w.lines[0].startsWith('notes') ? 'a notes line' : 'a drums line'} for you` + (w.dropped ? ` (it only keeps ${4} bars; ${w.dropped} sounds were left out)` : '') + '. Press Run to hear it.' })
  return w
}
export function cancelListening() {
  window.clearInterval(E.doneTimer); E.doneTimer = 0
  E.offTok?.(); E.offTok = undefined; E.stopKode?.(); E.stopKode = undefined; E.played = []
  set({ listening: false, heard: 0, note: 'Okay, not listening.' })
}

/** the looper layers and the drum pattern as Kode lines */
export function useMyLoop(): string[] {
  const lines: string[] = []
  try {
    const { tracks } = exportTracks()
    for (const t of tracks.slice(0, 6)) {
      const l = loopNotesToLine(t.notes.map((n) => ({ t: n.t, n: n.n })))
      if (l) lines.push(l)
    }
  } catch { /* looper not ready */ }
  try {
    const d = useDrums.getState().pat
    const l = drumRowsToLine(d.rows, d.len)
    if (l) lines.push(l)
  } catch { /* drums not ready */ }
  if (!lines.length) { set({ note: 'There is no loop yet. Record one in the Looper, or build a beat in Drum pads.' }); return lines }
  appendLines(lines)
  set({ note: `Turned your loop into ${lines.length} line${lines.length > 1 ? 's' : ''} of code. Press Run to hear it.` })
  return lines
}

// ---------- life cycle ----------
E.unPanic?.()
E.unPanic = registerPanicTarget('kode', () => { if (get().listening) cancelListening(); stop() })
const offProfile = onProfileChange(() => { stop(); const t = loadText(); set({ text: t, errors: parseProgram(t, knownMotif).errors }) })
if (E.runner.isPlaying()) wire()

if (import.meta.hot) {
  import.meta.hot.data.store = useKode
  import.meta.hot.data.E = E
  import.meta.hot.dispose(() => { offProfile(); E.offTick?.(); E.offTick = undefined })
  import.meta.hot.accept()
}
void useMaster
