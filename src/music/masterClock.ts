// ONE shared tempo + beat/bar clock for the whole app (the Loop Station is its first user).
//   useMaster          zustand { bpm, running, following, link }   (changes only on start/stop/tempo, never per beat)
//   beatPos(now?)      absolute beat position (float, counts up from 0 at start; bar = beatPos / 4)
//   timeOfBeat(b)      performance.now() ms at which absolute beat b sounds
//   startMaster()/stopMaster()/setBpm(n)/tapTempo()
//   onBeat(fn) / onBar(fn) / onTick(fn)   fn gets { n, beat, bar, bpm, time } at the moment the beat sounds (onTick: every 20 ms, with `now`)
// FOLLOWING: while the DJ decks play (features/dj/clock getBeat) the master adopts the DJ tempo and slides its grid onto the DJ's
// beat phase (only when it drifts by more than 8 ms); when the DJ stops, the master keeps free-running from where it was.
// BEAT MACHINE LINK: setLink(true) makes the beat machine (features/beats/engine) follow the master bpm through its own +-20 bpm
// adjust (setBpmAdj). Minimal on purpose: the master never reads the beat machine back, and the Pro workspace may wire more.
// State lives in import.meta.hot.data so editing this file never stops the clock.
import { bpmFromTaps, pushTap } from './tapTempo'
import { create } from 'zustand'
import { createHolds } from './owners'
import { wClear, wInterval, wTimeout } from '../audio/workerTimer' // the tick and the beat timers run in a worker: not throttled in a hidden tab
import { getBeat } from '../features/dj/clock'
import { bpm as beatsBpm, getState as beatsState, setBpmAdj, subscribe as beatsSubscribe } from '../features/beats/engine'

export interface ClockBeat { n: number; beat: number; bar: number; bpm: number; time: number }
type BeatFn = (b: ClockBeat) => void
interface Anchor { t0: number; b0: number; bpm: number; running: boolean; nextBeat: number; taps: number[]; epoch?: number }
interface Hot { store?: ReturnType<typeof make>; a?: Anchor; beat?: Set<BeatFn>; bar?: Set<BeatFn>; tick?: Set<(now: number) => void>; timer?: number; offBeats?: () => void }
const hot = (import.meta.hot?.data ?? {}) as Hot

function make() { return create<{ bpm: number; running: boolean; following: boolean; link: boolean }>()(() => ({ bpm: 100, running: false, following: false, link: false })) }
export const useMaster = hot.store ?? make()
const A: Anchor = hot.a ?? { t0: 0, b0: 0, bpm: 100, running: false, nextBeat: 0, taps: [] }
const beatFns: Set<BeatFn> = hot.beat ?? new Set()
const barFns: Set<BeatFn> = hot.bar ?? new Set()
const tickFns: Set<(now: number) => void> = hot.tick ?? new Set()
const LOOK_MS = 60
let timer = hot.timer ?? 0

export const BPM_MIN = 40, BPM_MAX = 240
const clampBpm = (b: number) => Math.min(BPM_MAX, Math.max(BPM_MIN, Number.isFinite(b) ? b : 100))
const now = () => performance.now()
export const msPerBeat = () => 60000 / A.bpm
/** absolute beat position at `t` (frozen while stopped) */
export const beatPos = (t = now()) => (A.running ? A.b0 + (t - A.t0) / msPerBeat() : A.b0)
export const timeOfBeat = (b: number) => A.t0 + (b - A.b0) * msPerBeat()
export const isRunning = () => A.running
/** bumps whenever the grid JUMPS (start, resetPhase, realign): schedulers that keep their own beat pointer resync on a change */
export const clockEpoch = () => A.epoch ?? 0
const bump = () => { A.epoch = (A.epoch ?? 0) + 1 }
export const getBpm = () => A.bpm
export const onBeat = (fn: BeatFn) => { beatFns.add(fn); return () => { beatFns.delete(fn) } }
export const onBar = (fn: BeatFn) => { barFns.add(fn); return () => { barFns.delete(fn) } }
export const clockListenerCounts = () => ({ beat: beatFns.size, bar: barFns.size, tick: tickFns.size })
export const onTick = (fn: (now: number) => void) => { tickFns.add(fn); return () => { tickFns.delete(fn) } }

function reanchor(bpm: number) { const t = now(), b = beatPos(t); A.t0 = t; A.b0 = b; A.bpm = clampBpm(bpm) }

export function setBpm(b: number) {
  const v = Math.round(clampBpm(b) * 10) / 10
  if (A.running) reanchor(v); else A.bpm = v
  useMaster.setState({ bpm: v })
  pushToBeats()
}

/** align to the DJ's beat phase + tempo while a deck plays */
function followDj(t: number, full = false) {
  const s = getBeat()
  if (!s.playing || !(s.bpm > 0)) { if (useMaster.getState().following) useMaster.setState({ following: false }); return }
  if (!useMaster.getState().following) useMaster.setState({ following: true })
  const djPos = s.bar * 4 + s.beat + s.phase // 0..16
  const cur = beatPos(t)
  const diff = ((((djPos - cur) % 16) + 24) % 16) - 8 // nearest shift on the 16-beat ring
  if (Math.abs(s.bpm - A.bpm) > 0.05) { reanchor(s.bpm); useMaster.setState({ bpm: Math.round(s.bpm * 10) / 10 }); pushToBeats() }
  // while running only the fractional beat is corrected (never a whole-beat jump that would scramble a playing loop)
  const shift = full ? diff : diff - Math.round(diff)
  if (Math.abs(shift) * msPerBeat() > 8) { A.b0 = cur + shift; A.t0 = t; A.nextBeat = Math.max(A.nextBeat, Math.ceil(A.b0)) }
}

function emit(set: Set<BeatFn>, b: ClockBeat) { for (const f of [...set]) { try { f(b) } catch (e) { console.error('[master clock]', e) } } }
function tick(full = false) {
  const t = now()
  followDj(t, full)
  const end = t + LOOK_MS
  if (A.nextBeat < Math.floor(beatPos(t)) - 1) A.nextBeat = Math.ceil(beatPos(t))
  while (timeOfBeat(A.nextBeat) <= end) {
    const n = A.nextBeat++
    const at = timeOfBeat(n)
    wTimeout(() => {
      const b: ClockBeat = { n, beat: ((n % 4) + 4) % 4, bar: Math.floor(n / 4), bpm: A.bpm, time: performance.now() }
      emit(beatFns, b)
      if (b.beat === 0) emit(barFns, b)
    }, Math.max(0, at - t))
  }
  for (const f of [...tickFns]) { try { f(t) } catch (e) { console.error('[master tick]', e) } }
}

export function startMaster() {
  if (A.running) return
  A.running = true; A.t0 = now(); A.b0 = 0; A.nextBeat = 0; bump()
  useMaster.setState({ running: true })
  tick(true) // join the DJ grid straight away (a whole-beat shift is fine before anything plays)
  if (!timer) timer = wInterval(() => tick(), 20)
}
export function stopMaster() {
  clockHolds.adopt() // stopped (by anyone): nobody has a "I started it, I stop it" duty any more
  if (!A.running) return
  const b = beatPos()
  A.running = false; A.b0 = b
  if (timer) { wClear(timer); timer = 0 }
  useMaster.setState({ running: false, following: false })
}
// ---------- who needs the clock ----------
// Games / the drum machine / Kode used to start it and stop it on their own ("startedClock" flags), so one closing could stop the clock
// another still needed. Now they HOLD it: it starts with the first holder and stops only when the last one lets go, and only if a holder
// (not the player's START button, the pedal or the looper) started it. See docs/STATE.md.
const clockHolds = createHolds('masterClock', () => startMaster(), () => stopMaster(), () => A.running)
export const acquireClock = (owner: string) => clockHolds.hold(owner)
/** keepOn: something outside the holder list (the looper, a DJ deck) still uses the beat, so leave it running */
export const releaseClock = (owner: string, keepOn = false) => clockHolds.release(owner, keepOn)
export const clockHolders = () => clockHolds.holders()
/** stop the clock for a caller that is not a holder, unless a holder still needs it. true = stopped */
export function stopMasterUnlessHeld(): boolean { if (clockHolds.holders().length) return false; stopMaster(); return true }

/** put beat 0 at this very moment (a free-running master only: with the DJ playing the grid belongs to the DJ) */
export function resetPhase() {
  if (!A.running || useMaster.getState().following) return
  A.t0 = now(); A.b0 = 0; A.nextBeat = 0; bump()
}
/**
 * Re-anchor the grid: beat `beat` sounds(/sounded) at performance.now() time `atMs`, at exactly `bpm` (not rounded, so a loop of
 * n bars stays n bars). The looper uses it in free time: the tempo is worked out from the first loop, and the loop start becomes a downbeat.
 * Ignored while following the DJ (the grid is his).
 */
export function realign(bpm: number, atMs: number, beat: number) {
  if (!A.running || useMaster.getState().following) return false
  A.bpm = clampBpm(bpm); A.t0 = atMs; A.b0 = beat
  A.nextBeat = Math.ceil(beatPos(now()) - 1e-6); bump()
  useMaster.setState({ bpm: Math.round(A.bpm * 10) / 10 })
  pushToBeats()
  return true
}
/** tap tempo: average of the last few gaps; a pause over 2 s starts a fresh count */
export function tapTempo(at = now()) {
  A.taps = pushTap(A.taps, at)
  const b = bpmFromTaps(A.taps)
  if (b != null) setBpm(b)
}

// ---------- beat machine link ----------
function pushToBeats() {
  if (!useMaster.getState().link) return
  try {
    const st = beatsState()
    const want = Math.max(-20, Math.min(20, st.bpmAdj + (A.bpm - beatsBpm())))
    if (Math.abs(want - st.bpmAdj) > 0.01) setBpmAdj(Math.round(want * 10) / 10)
  } catch { /* beat machine not ready */ }
}
export function setLink(on: boolean) { useMaster.setState({ link: on }); if (on) pushToBeats() }

hot.offBeats?.()
const offBeats = beatsSubscribe(() => pushToBeats())
if (A.running && !timer) timer = wInterval(() => tick(), 20)

if (import.meta.hot) {
  import.meta.hot.data.store = useMaster
  import.meta.hot.data.a = A
  import.meta.hot.data.beat = beatFns
  import.meta.hot.data.bar = barFns
  import.meta.hot.data.tick = tickFns
  import.meta.hot.data.offBeats = offBeats
  import.meta.hot.dispose(() => { if (timer) wClear(timer); import.meta.hot!.data.timer = 0 })
  import.meta.hot.accept()
}
