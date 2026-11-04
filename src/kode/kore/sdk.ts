// The Kore SDK: createKore(appId, {exit}) wraps the token layer, master clock, audio-clock scheduling, capped 'kore' channel, guide, sheet,
// per-player storage, concepts, celebrate, ladder and motifs. Everything an app subscribes to is released by kore.dispose() (exit, unmount, HMR).
import { onToken, startKode } from '../tokens'
import { onNote } from '../../music/notes'
import { usePedal } from '../../features/pedal/pedal'
import { beatPos, getBpm, isRunning, msPerBeat, onBeat, timeOfBeat } from '../../music/masterClock'
import { createChannel, getCtx, getNoise } from '../../audio/host'
import { audioAt, sampleAudioOffset } from '../../features/loopstation/audioClock'
import { getSynth } from '../../features/synth-history/engine'
import { KITS, playVoice } from '../../features/drumpads/drumKit'
import { useDrums } from '../../features/drumpads/drumEngine'
import { defaultTweak } from '../../features/drumpads/drumCore'
import { registerPanicTarget } from '../../music/panic'
import { clearGuide, setGuide } from '../../music/guide'
import { clearScore, setScore } from '../../music/scoreStore'
import { celebrate as celebrateRaw } from '../../features/celebrate/celebrate'
import { wClear, wTimeout } from '../../audio/workerTimer'
import { appKey, kvLoad, kvSave } from './kv'
import { loadConcepts, markConcept } from './concepts'
import { CallDetector, nextBeatOf, type MotifEvent } from './motifCore'
import { callDetected, callMotif, defineMotif, findMotif, setMotifRuntime, useMotifs, userMotifs } from './motifs'
import { ladder } from './ladder'
import type { Kore, KodeConcept } from './types'

void KITS
export const KORE_CAP = 0.8
const hot = (import.meta.hot?.data ?? {}) as { live?: Set<Kore & { dispose: () => void }>; panic?: () => void }
const live: Set<Kore & { dispose: () => void }> = hot.live ?? new Set()

// ---- one shared sound path: events at absolute beats -> audio-clock times, on the capped 'kore' channel
const timers = new Set<number>()
const held = new Set<number>()
let ended = 0
function atTime(beat: number): number | null {
  const ctx = getCtx()
  const atMs = isRunning() ? timeOfBeat(beat) : performance.now() + Math.max(0, beat - beatPos()) * msPerBeat()
  sampleAudioOffset()
  const w = audioAt(atMs)
  if (w != null) return Math.max(w, ctx.currentTime)
  return ctx.state === 'running' ? ctx.currentTime + Math.max(0, atMs - performance.now()) / 1000 : null
}
function soundNote(n: number, vel: number, beat: number, beats: number) {
  const at = atTime(beat); if (at == null) return
  const syn = getSynth(); if (!syn.ready) { void syn.unlock().catch(() => {}); return }
  const v = Math.max(1, Math.min(127, Math.round(vel * 127)))
  syn.noteOn(n, v, at); syn.noteOff(n, at + Math.max(0.05, beats * msPerBeat() * 0.0009))
  held.add(n)
}
function soundDrum(voice: number, vel: number, beat: number) {
  const at = atTime(beat); if (at == null) return
  const ctx = getCtx(), ch = createChannel('kore', { cap: KORE_CAP, label: 'Kore apps' }), d = useDrums.getState()
  playVoice(ctx, ch.input, getNoise(ctx), d.kit, voice, at, vel, d.tweak[voice] ?? defaultTweak())
}
function playEvents(evs: MotifEvent[]) {
  const gen = ended
  for (const e of evs) {
    if (e.kind === 'drum') soundDrum(e.value, e.vel, e.beat); else soundNote(e.value, e.vel, e.beat, e.beats)
  }
  void gen
}
export function stopKoreSound() {
  ended++
  for (const t of timers) wClear(t); timers.clear()
  try { const s = getSynth(); for (const n of held) s.noteOff(n) } catch { /* ignore */ }
  held.clear()
}
if (import.meta.hot) hot.panic?.()
const offPanic = registerPanicTarget('kore', () => stopKoreSound())
void wTimeout

setMotifRuntime({ beat: () => beatPos(), bpm: () => getBpm(), sink: playEvents })

export function createKore(appId: string, opts: { exit?: () => void } = {}): Kore & { dispose: () => void } {
  const cleanups: (() => void)[] = []
  let disposed = false
  const keep = <T extends () => void>(f: T): T => { cleanups.push(f); return f }
  const kore: Kore & { dispose: () => void } = {
    appId,
    tokens: {
      on(fn) {
        const stop = startKode(), off = onToken(fn)
        return keep(() => { off(); stop() })
      },
    },
    clock: {
      bpm: () => getBpm(), beat: () => beatPos(), running: () => isRunning(), nextBeat: () => nextBeatOf(beatPos()),
      msOfBeat: (b) => (isRunning() ? timeOfBeat(b) : performance.now() + Math.max(0, b - beatPos()) * msPerBeat()),
      onBeat: (fn) => keep(onBeat((b) => fn(b.n))),
      atBeat(b, fn) {
        const t = wTimeout(() => { timers.delete(t); if (!disposed) fn() }, Math.max(0, kore.clock.msOfBeat(b) - performance.now()))
        timers.add(t)
        return keep(() => { wClear(t); timers.delete(t) })
      },
    },
    sound: {
      note: (n, vel = 0.7, whenBeat, beats = 0.5) => soundNote(n, vel, whenBeat ?? beatPos(), beats),
      drum: (v, vel = 0.8, whenBeat) => soundDrum(v, vel, whenBeat ?? beatPos()),
      events: playEvents,
      stop: stopKoreSound,
    },
    guide: { show: (notes, soon) => setGuide(notes, 'next', soon ?? []), clear: clearGuide },
    sheet: {
      show(phrase, title = 'Your turn') {
        setScore({ owner: `kore.${appId}`, title, notes: phrase.map((p) => ({ note: p.note, beat: p.beat, beats: p.beats })) as never })
      },
      clear: () => clearScore(`kore.${appId}`),
    },
    motifs: {
      list: () => userMotifs(),
      get: findMotif,
      define: (taps, o) => defineMotif(taps, o),
      call: (n, a) => callMotif(n, a),
      onChange: (fn) => keep(useMotifs.subscribe(fn)),
    },
    progress: { load: (k, f) => kvLoad(appKey(appId, k), f), save: (k, v) => kvSave(appKey(appId, k), v) },
    concepts: {
      mark(id: KodeConcept) {
        const r = markConcept(id)
        if (r.first) celebrateRaw({ title: `New idea: ${id}`, emoji: '🏅', kind: 'badge' })
        return r
      },
      record: () => loadConcepts() as Record<string, { first: string; count: number }>,
    },
    celebrate: (o) => celebrateRaw({ title: o.title, emoji: o.emoji, kind: o.kind }),
    ladder,
    onCleanup: (fn) => { cleanups.push(fn) },
    exit: () => { opts.exit?.() },
    dispose() {
      if (disposed) return
      disposed = true
      for (const f of cleanups.splice(0).reverse()) { try { f() } catch (e) { console.error('[kore]', e) } }
      try { kore.guide.clear(); kore.sheet.clear() } catch { /* ignore */ }
      live.delete(kore)
    },
  }
  live.add(kore)
  return kore
}

// ---- call signs: playing a motif's call sign RUNS it (always inside Kore apps; anywhere when free play is on)
const det = new CallDetector(userMotifs, () => usePedal.getState().down)
let routerUsers = 0
let routerOff: (() => void) | null = null
let holdTimer = 0
function arm() {
  if (holdTimer) wClear(holdTimer)
  holdTimer = wTimeout(() => { holdTimer = 0; const d = det.tick(performance.now()); if (d) callDetected(d) }, 380)
}
function startRouter() {
  const stopKode = startKode()
  const offTok = onToken((t) => {
    if (t.src === 'pedal' || t.src === 'screen') return
    const d = det.on({ src: t.src, pitch: t.pitch, lane: t.lane, vel: t.vel, t: t.t })
    if (d) callDetected(d); else if (t.pitch != null) arm()
  })
  const offNote = onNote((e) => { if (!e.on || e.velocity === 0) { const d = det.off({ pitch: e.note, t: performance.now() }); if (d) callDetected(d) } })
  return () => { offTok(); offNote(); stopKode(); if (holdTimer) wClear(holdTimer); holdTimer = 0; det.reset() }
}
/** Kore app hosts call this while an app is open (ref counted); free play uses it when the toggle is on. Returns release. */
export function acquireCallSigns(): () => void {
  if (routerUsers++ === 0) routerOff = startRouter()
  let done = false
  return () => { if (done) return; done = true; if (--routerUsers === 0) { routerOff?.(); routerOff = null } }
}
// free play: the router stays on while the toggle is set
let freeRelease: (() => void) | null = null
const syncFree = () => { const on = useMotifs.getState().free; if (on && !freeRelease) freeRelease = acquireCallSigns(); else if (!on && freeRelease) { freeRelease(); freeRelease = null } }
const offFree = useMotifs.subscribe(syncFree)
syncFree()

if (import.meta.hot) {
  import.meta.hot.data.live = live
  import.meta.hot.data.panic = () => { offPanic(); offFree(); freeRelease?.(); freeRelease = null; routerOff?.(); routerOff = null; routerUsers = 0 }
  import.meta.hot.dispose(() => { for (const k of [...live]) k.dispose(); stopKoreSound() })
  import.meta.hot.accept()
}
