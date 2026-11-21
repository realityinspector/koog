// Koogalien Racer engine: the round flow (LISTEN, YOUR TURN, RACE REPLAY, results), the shared beat, saved progress and the sounds.
// The pure rules are in racerCore.ts; the picture is drawn by draw.ts; the buttons are RacerGame.tsx. Devices come in as Kode tokens (src/kode).
// Long-lived state sits on import.meta.hot.data so an edit never resets a lap in progress.
import { create } from 'zustand'
import { onToken, startKode, type KodeToken } from '../../../kode/tokens'
import { isMusical, kindOf, repeatedKey } from '../../../kode/kodeCore'
import { recentTokens } from '../../../kode/tokens'
import { acquireClock, beatPos, getBpm, onBeat, releaseClock, setBpm, timeOfBeat } from '../../../music/masterClock'
import { playLocal } from '../../../music/localNotes'
import { previewVoice } from '../../drumpads/drumEngine'
import { clearGuideFor, setGuideFor, type GuideTone } from '../../../music/guide'
// the key glow is OWNED: a late timer from this game can never wipe a newer feature's glow (docs/STATE.md)
const setGuide = (t: number[], tone?: GuideTone, soon?: number[]) => setGuideFor('racer', t, tone, soon)
const clearGuide = () => clearGuideFor('racer')
import { clearScore, setScore } from '../../../music/scoreStore'
import { createChannel, getCtx, unlockHost } from '../../../audio/host'
import { registerPanicTarget } from '../../../music/panic'
import { wClear, wTimeout } from '../../../audio/workerTimer'
import { onProfileChange, pload, psave } from '../../../profile/profile'
import { noteName } from '../../../music/theory'
import { wrongNote } from '../phraseKit'
import type { SongNote } from '../../songs/songs'
import { LEAD_BEATS, SPB, ROAD_HALF, drive, type Drive, type Mode, type PhraseNote, type Play, type Track } from './racerCore'
import { FREE_REPLAY_UNTIL, TRACKS, WORLDS, phraseOf, trackFor, type TrackDef } from './tracks'
import { VEHICLES, vehicleById, vehicleForKey, type Vehicle } from './vehicles'

export type Phase = 'garage' | 'map' | 'listen' | 'turn' | 'race' | 'result'
export interface RacerSave { v: 1; stars: Record<string, number>; best: Record<string, number>; vehicle: string | null; mode: Mode; streak: number; bestStreak: number; laps: number }
export interface Result { track: string; stars: number; seconds: number; best: boolean; mishaps: number; clean: boolean; streak: number; passed: boolean; lines: string[] }
export interface RacerState {
  phase: Phase
  trackIx: number
  vehicle: string | null
  mode: Mode
  save: RacerSave
  /** 4..1 during the count-in before the phrase window, else 0 */
  count: number
  /** fraction of the start window left (YOUR TURN, before GO) */
  autoLeft: number
  coach: string
  /** the mishap note currently shown in the race */
  mishapNote: string
  mishapKind: string
  result: Result | null
  /** "Hear it again" presses this lap */
  peeks: number
  /** the vehicle just picked by a phrase-key (garage banner) */
  picked: string | null
}

export const AUTO_MS = 9000        // YOUR TURN: if nobody presses GO, it starts by itself after this long
const COUNT_BEATS = 4
const TAIL_BEATS = 1.2             // the window stays open this long after the last note
const EARLY_BEATS = 0.9            // a note up to this early still counts for the first gate

const fresh = (): RacerSave => ({ v: 1, stars: {}, best: {}, vehicle: null, mode: 'keys', streak: 0, bestStreak: 0, laps: 0 })
function loadSave(): RacerSave {
  const s = pload<Partial<RacerSave>>('racer', {}) ?? {}
  return { ...fresh(), ...s, stars: { ...(s.stars ?? {}) }, best: { ...(s.best ?? {}) }, mode: s.mode === 'pads' ? 'pads' : 'keys' }
}
const initial = (): RacerState => {
  const save = loadSave()
  return { phase: save.vehicle ? 'map' : 'garage', trackIx: 0, vehicle: save.vehicle, mode: save.mode, save, count: 0, autoLeft: 1, coach: '', mishapNote: '', mishapKind: '', result: null, peeks: 0, picked: null }
}
type Hot = { store?: ReturnType<typeof make>; run?: Run }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<RacerState>()(initial) }
export const useRacer = hot.store ?? make()
const get = () => useRacer.getState()
const set = (p: Partial<RacerState>) => useRacer.setState(p)

/** what the picture reads. Everything here is mutated in place, nothing is allocated per frame. */
export interface View {
  def: TrackDef | null
  track: Track | null
  dr: Drive | null
  vehicle: Vehicle
  /** race position in beats from the start line (negative before) */
  rb: number
  /** listen position in beats from the first note */
  lb: number
  /** phrase window beat (YOUR TURN) */
  tb: number
  nextGate: number
  played: number
  /** world position of every mishap (parallel to dr.mishaps) */
  mx: Float32Array; my: Float32Array
  /** world bounds of the road */
  minX: number; maxX: number; minY: number; maxY: number
  speed: number
  reduced: boolean
}
interface Run {
  token: number
  timers: number[]
  stopKode: (() => void) | null
  stopTok: (() => void) | null
  stopBeat: (() => void) | null
  startedClock: boolean
  raf: number
  b0: number              // listen: the beat of the first note
  listenEnd: number       // listen: beat when the lap's YOUR TURN begins
  startBeat: number       // turn: the beat of the first note of the player's phrase
  counting: boolean
  autoAt: number
  plays: Play[]
  raceB0: number          // race: the beat of the start line
  mishapSeen: number
  click: boolean
  hum: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode; stop(): void } | null
  view: View
  draw: ((v: View, st: RacerState, now: number) => void) | null
  lastCount: number
  lastAuto: number
  lastLb: number
  open: boolean
}
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
const R: Run = hot.run ?? {
  token: 0, timers: [], stopKode: null, stopTok: null, stopBeat: null, startedClock: false, raf: 0, b0: 0, listenEnd: 0, startBeat: 0, counting: false, autoAt: 0, plays: [],
  raceB0: 0, mishapSeen: 0, click: false, hum: null, draw: null, lastCount: 0, lastAuto: 1, lastLb: 0, open: false,
  view: { def: null, track: null, dr: null, vehicle: VEHICLES[1], rb: -LEAD_BEATS, lb: -9, tb: -9, nextGate: 0, played: 0, mx: new Float32Array(0), my: new Float32Array(0), minX: 0, maxX: 0, minY: 0, maxY: 0, speed: 0, reduced: false },
}
export const view = R.view

// ------------------------------------------------------------------ small helpers
const later = (fn: () => void, ms: number) => { const id = wTimeout(fn, Math.max(0, ms)); R.timers.push(id) }
const clearTimers = () => { for (const t of R.timers) wClear(t); R.timers.length = 0 }
const atBeat = (b: number, fn: () => void) => later(fn, timeOfBeat(b) - performance.now())
const trackDef = (): TrackDef => TRACKS[Math.min(TRACKS.length - 1, Math.max(0, get().trackIx))]
export const isUnlocked = (ix: number, save: RacerSave = get().save) => ix <= 0 || (save.stars[TRACKS[ix - 1]?.id] ?? 0) >= 1
export const totalStars = (save: RacerSave = get().save) => Object.values(save.stars).reduce((n, s) => n + s, 0)
const persist = () => psave('racer', get().save)
const saveWith = (p: Partial<RacerSave>) => { set({ save: { ...get().save, ...p } }); persist() }

/** the hint level of the current track decides the sheet, the glow and the note names */
export const hintsOf = (def: TrackDef = trackDef()) => def.hints
export const freeReplay = (ix: number = get().trackIx) => ix < FREE_REPLAY_UNTIL

// ------------------------------------------------------------------ sound: the click, the engine hum
function chan() { return createChannel('racer', { cap: 0.3, label: 'Koogalien Racer' }) }
export const racerChannel = () => chan()
function click(accent: boolean) {
  try {
    const ctx = getCtx(), t = ctx.currentTime + 0.005
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'square'; o.frequency.value = accent ? 1500 : 1000
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(accent ? 0.5 : 0.32, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    o.connect(g); g.connect(chan().input); o.start(t); o.stop(t + 0.07)
  } catch { /* audio not ready */ }
}
function startHum() {
  if (R.hum) return
  try {
    const ctx = getCtx(), v = R.view.vehicle, t = ctx.currentTime
    const osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), lp = ctx.createBiquadFilter(), gain = ctx.createGain()
    osc.type = v.hum.wave; osc.frequency.value = v.hum.base
    lfo.frequency.value = 7; lg.gain.value = v.hum.wobble
    lp.type = 'lowpass'; lp.frequency.value = 700
    gain.gain.setValueAtTime(0, t)
    lfo.connect(lg); lg.connect(osc.frequency); osc.connect(lp); lp.connect(gain); gain.connect(chan().input)
    osc.start(); lfo.start()
    R.hum = { osc, lfo, gain, stop() { const n = ctx.currentTime; gain.gain.cancelScheduledValues(n); gain.gain.setTargetAtTime(0, n, 0.04); osc.stop(n + 0.3); lfo.stop(n + 0.3); setTimeout(() => { try { gain.disconnect(); lp.disconnect() } catch { /* gone */ } }, 500) } }
  } catch { R.hum = null }
}
function stopHum() { R.hum?.stop(); R.hum = null }
function tuneHum(sp: number) {
  if (!R.hum) return
  try {
    const ctx = getCtx(), v = R.view.vehicle, n = ctx.currentTime
    R.hum.osc.frequency.setTargetAtTime(v.hum.base + v.hum.speed * sp, n, 0.05)
    R.hum.gain.gain.setTargetAtTime(v.hum.vol * (0.05 + 0.1 * sp), n, 0.05)
  } catch { /* ignore */ }
}
function silence() { clearTimers(); R.click = false; stopHum() }

// ------------------------------------------------------------------ the shared clock
function ensureClock(bpm: number) {
  acquireClock('racer') // a hold, not a flag: closing the racer can no longer stop a clock the drums or Kode still use
  if (Math.abs(getBpm() - bpm) > 0.01) setBpm(bpm)
}

// ------------------------------------------------------------------ the phrase as sheet music, glowing keys and demo
function sheetNotes(ph: PhraseNote[]): SongNote[] {
  const out: SongNote[] = []
  let at = 0
  for (const n of ph) {
    if (n.beat > at + 1e-6) out.push({ note: null, beats: n.beat - at })
    out.push({ note: n.note, beats: n.beats }); at = n.beat + n.beats
  }
  return out
}
function showHints(phase: 'listen' | 'turn') {
  const def = trackDef(), ph = phraseOf(def), h = def.hints
  if (h === 'none') { clearScore('racer'); clearGuide(); return }
  setScore({ owner: 'racer', title: def.name, notes: sheetNotes(ph), bpm: def.bpm })
  if (h === 'full' && phase === 'turn' && get().mode === 'keys') glowNext()
  else if (phase === 'turn') clearGuide()
}
/** the next note to play glows, the two after it a little dimmer (the "soon" keys) */
function glowNext() {
  if (get().mode !== 'keys') return
  const ph = phraseOf(trackDef()), i = Math.min(R.view.played, ph.length)
  if (i >= ph.length) { clearGuide(); return }
  setGuide([ph[i].note], 'next', ph.slice(i + 1, i + 3).map((n) => n.note))
}
/** sing the phrase to the player on the shared beat, lighting the gates (and the keys, on the tracks that allow it) */
function playDemo(b0: number) {
  const def = trackDef(), ph = phraseOf(def), mode = get().mode
  const lanes = R.view.track?.gates
  ph.forEach((n, i) => {
    atBeat(b0 + n.beat, () => {
      if (mode === 'pads') previewVoice(lanes?.[i]?.v ?? 0, 0.85)
      else {
        playLocal(n.note, 84, true)
        if (def.hints === 'full' || def.hints === 'glow') setGuide([n.note], 'gold')
      }
    })
    atBeat(b0 + n.beat + Math.min(n.beats, 1.2) * 0.85, () => { if (mode === 'keys') { playLocal(n.note, 0, false); clearGuide() } })
  })
}

// ------------------------------------------------------------------ the round
function prepare(ix: number) {
  const def = TRACKS[ix], mode = get().mode
  const tr = trackFor(def, mode)
  const v = R.view
  v.def = def; v.track = tr; v.dr = null; v.vehicle = vehicleById(get().vehicle); v.rb = -LEAD_BEATS; v.lb = -9; v.tb = -9; v.nextGate = 0; v.played = 0; v.speed = 0
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9
  for (let j = 0; j < tr.n; j++) { if (tr.x[j] < a) a = tr.x[j]; if (tr.x[j] > b) b = tr.x[j]; if (tr.y[j] < c) c = tr.y[j]; if (tr.y[j] > d) d = tr.y[j] }
  v.minX = a; v.maxX = b; v.minY = c; v.maxY = d
  v.mx = new Float32Array(0); v.my = new Float32Array(0)
  R.plays = []; R.counting = false; R.mishapSeen = 0
}

/** pick a track and start a lap: LISTEN first */
export function openTrack(ix: number) {
  if (ix < 0 || ix >= TRACKS.length || !isUnlocked(ix)) return
  silence(); R.token++
  set({ trackIx: ix, phase: 'listen', count: 0, result: null, peeks: 0, mishapNote: '', mishapKind: '', coach: '', autoLeft: 1 })
  prepare(ix)
  startListen(true)
}
function startListen(fromStart: boolean) {
  const def = trackDef()
  ensureClock(def.bpm)
  void unlockHost()
  if (fromStart) startHum()
  R.view.speed = 0.15
  R.click = true
  R.b0 = Math.ceil(beatPos()) + COUNT_BEATS
  const ph = phraseOf(def), last = ph[ph.length - 1]
  R.listenEnd = R.b0 + (last ? last.beat + Math.max(1, last.beats) : 1) + 0.5
  showHints('listen')
  set({ coach: 'Listen to the tune. Watch the gates light up.' })
  playDemo(R.b0)
}
/** hear the phrase again: free on the first tracks; later tracks mark it as a peek (it costs the third star) */
export function hearAgain() {
  const s = get()
  if (s.phase === 'turn' && !R.counting) {
    clearTimers(); R.click = true
    if (!freeReplay()) set({ peeks: s.peeks + 1 })
    ensureClock(trackDef().bpm)
    R.b0 = Math.ceil(beatPos()) + 2
    const ph = phraseOf(trackDef()), last = ph[ph.length - 1]
    R.listenEnd = R.b0 + (last ? last.beat + Math.max(1, last.beats) : 1) + 0.5
    R.view.lb = -9
    set({ phase: 'listen', coach: 'Listen again.' })
    showHints('listen'); playDemo(R.b0)
  } else if (s.phase === 'result') {
    clearTimers(); ensureClock(trackDef().bpm)
    const b = Math.ceil(beatPos()) + 2
    playDemo(b); R.click = false
  }
}
/** the pedal or the big GO button (or the timer): the countdown starts */
export function go() {
  if (get().phase !== 'turn' || R.counting) return
  clearGuide()
  R.counting = true; R.plays = []; R.view.played = 0
  R.startBeat = Math.ceil(beatPos()) + COUNT_BEATS
  R.click = true
  set({ coach: 'Play the tune on the beat!', autoLeft: 1 })
  showHints('turn')
  glowNext()
}
function finishTurn() {
  const def = trackDef(), tr = R.view.track!, v = vehicleById(get().vehicle)
  const dr = drive(tr, R.plays, def.bpm, { half: v.half })
  R.view.dr = dr
  // where each mishap happened, for the picture
  const n = dr.mishaps.length
  R.view.mx = new Float32Array(n); R.view.my = new Float32Array(n)
  dr.mishaps.forEach((m, k) => {
    const j = Math.min(tr.n - 1, m.j)
    R.view.mx[k] = tr.x[j] + Math.cos(tr.h[j]) * m.side * (ROAD_HALF + 20)
    R.view.my[k] = tr.y[j] + Math.sin(tr.h[j]) * m.side * (ROAD_HALF + 20)
  })
  R.counting = false; R.click = false
  clearGuide()
  ensureClock(def.bpm)
  R.raceB0 = Math.ceil(beatPos()) + 2
  R.mishapSeen = 0
  set({ phase: 'race', count: 0, mishapNote: '', mishapKind: '', coach: '' })
  // the player's own performance plays back as the car drives
  for (const p of R.plays) {
    atBeat(R.raceB0 + p.beat, () => { if (get().mode === 'pads') previewVoice(p.v, 0.6); else { playLocal(p.v, 70, true); later(() => playLocal(p.v, 0, false), 260) } })
  }
  R.click = false
  startHum()
}
function finishRace() {
  const s = get(), def = trackDef(), dr = R.view.dr!
  let stars = dr.stars
  const lines: string[] = []
  if (stars === 3 && s.peeks > 0 && !freeReplay()) { stars = 2; lines.push('You peeked with "Hear it again", so the third star waits for a clean lap without it.') }
  const prevBest = s.save.best[def.id]
  const best = dr.clean ? prevBest == null || dr.seconds < prevBest : false
  const streak = dr.clean ? s.save.streak + 1 : 0
  const save: RacerSave = {
    ...s.save,
    stars: { ...s.save.stars, [def.id]: Math.max(s.save.stars[def.id] ?? 0, stars) },
    best: best ? { ...s.save.best, [def.id]: dr.seconds } : s.save.best,
    streak, bestStreak: Math.max(s.save.bestStreak, streak), laps: s.save.laps + 1,
  }
  for (const m of dr.mishaps) lines.push(m.text)
  if (dr.mishaps.length === 0) lines.push(dr.stars === 3 ? 'A clean lap! Every note was right and on the beat.' : 'No mishaps, but a few notes were a little off the beat.')
  for (const r of dr.results) if (r.octave && r.v != null) lines.push(`Note ${r.i + 1}: right letter, wrong octave. Nice!`)
  set({ save, phase: 'result', result: { track: def.id, stars, seconds: dr.seconds, best, mishaps: dr.mishaps.length, clean: dr.clean, streak, passed: stars >= 1, lines }, coach: '' })
  persist()
  stopHum(); R.click = false
}

export function retry() { if (get().phase === 'result' || get().phase === 'race') { silence(); R.token++; prepare(get().trackIx); beginTurn() } }
export function nextTrack() { const ix = get().trackIx + 1; if (ix < TRACKS.length && isUnlocked(ix)) openTrack(ix) }
function beginTurn() {
  ensureClock(trackDef().bpm)
  R.view.dr = null; R.view.rb = -LEAD_BEATS
  R.autoAt = performance.now() + AUTO_MS; R.counting = false
  startHum(); R.view.speed = 0.15; R.click = true
  set({ phase: 'turn', count: 0, autoLeft: 1, result: null, coach: 'Press GO or the pedal, then play the tune.' })
  showHints('turn')
}
export function toMap() { silence(); R.token++; clearGuide(); clearScore('racer'); R.view.dr = null; set({ phase: 'map', result: null, count: 0 }) }
export function toGarage() { silence(); R.token++; clearGuide(); clearScore('racer'); set({ phase: 'garage', picked: null }) }
export function chooseVehicle(id: string) { saveWith({ vehicle: id }); set({ vehicle: id, picked: id }); R.view.vehicle = vehicleById(id) }
export function setMode(m: Mode) { saveWith({ mode: m }); set({ mode: m }) }

// ------------------------------------------------------------------ devices -> the game
function onTok(t: KodeToken) {
  const s = get(), ph = s.phase
  const button = t.src === 'pedal' || t.src === 'screen'
  if (isMusical(t) && (ph === 'garage' || ph === 'map')) {
    // a drum pad or DJ controller means pads, a piano means keys
    const want: Mode = kindOf(t) === 'lane' ? 'pads' : 'keys'
    if (s.mode !== want) setMode(want)
  }
  if (ph === 'garage' && isMusical(t)) {
    const v = vehicleForKey(repeatedKey(recentTokens()))
    if (v && v.id !== s.picked) { chooseVehicle(v.id); set({ coach: `${v.name}! ${v.blurb}.` }) }
    return
  }
  if (button) {
    if (ph === 'turn' && !R.counting) go()
    else if (ph === 'garage' && s.vehicle) toMap()
    else if (ph === 'map') { let ix = TRACKS.findIndex((x) => !(s.save.stars[x.id] > 0)); if (ix < 0) ix = 0; openTrack(Math.min(ix, TRACKS.length - 1)) }
    else if (ph === 'result') { if (s.result?.passed && isUnlocked(s.trackIx + 1) && s.trackIx + 1 < TRACKS.length) nextTrack(); else retry() }
    return
  }
  if (ph === 'turn' && R.counting && isMusical(t)) {
    const wantKind = s.mode === 'pads' ? 'lane' : 'pitch'
    if (kindOf(t) !== wantKind) return
    const beat = (t.t - timeOfBeat(R.startBeat)) / (60000 / getBpm())
    if (beat < -EARLY_BEATS) return
    R.plays.push({ beat, v: t.pitch ?? t.lane ?? 0 })
    R.view.played = Math.min(R.view.track!.gates.length, R.plays.length)
    glowNext()
  }
}

// ------------------------------------------------------------------ the frame loop (progress + picture)
function frame(now: number) {
  R.raf = requestAnimationFrame(frame)
  const s = get(), v = R.view
  v.reduced = reducedMotion()
  const bp = beatPos(performance.now())
  const gates = v.track?.gates
  if (s.phase === 'listen') {
    v.lb = bp - R.b0
    if (bp >= R.listenEnd) { beginTurn(); }
  } else if (s.phase === 'turn') {
    if (!R.counting) {
      v.tb = -9
      const left = Math.max(0, (R.autoAt - performance.now()) / AUTO_MS)
      if (Math.abs(left - R.lastAuto) > 0.04) { R.lastAuto = left; set({ autoLeft: left }) }
      if (left <= 0) go()
    } else {
      v.tb = bp - R.startBeat
      const c = Math.max(0, Math.ceil(R.startBeat - bp - 1e-6))
      if (c !== R.lastCount) { R.lastCount = c; set({ count: c > COUNT_BEATS ? COUNT_BEATS : c }) }
      const last = gates ? gates[gates.length - 1] : null
      if (last && bp >= R.startBeat + last.beat + Math.max(1, last.beats) + TAIL_BEATS) finishTurn()
    }
  } else if (s.phase === 'race' && v.dr && v.track) {
    v.rb = bp - R.raceB0 - LEAD_BEATS
    const sp = v.rb < -LEAD_BEATS + 0.2 ? 0.2 : v.rb > v.track.endBeat ? 0.1 : 1
    v.speed = sp
    // a new mishap: show what happened
    const ms = v.dr.mishaps
    while (R.mishapSeen < ms.length && ms[R.mishapSeen].beat <= v.rb) {
      const m = ms[R.mishapSeen++]
      set({ mishapNote: m.text, mishapKind: m.kind })
    }
    if (v.rb > v.track.endBeat + 0.6) finishRace()
  }
  tuneHum(s.phase === 'race' ? v.speed : s.phase === 'result' || s.phase === 'map' || s.phase === 'garage' ? 0 : 0.2)
  R.draw?.(v, get(), now)
}
/** the canvas component registers its drawing here; returns a function that removes it */
export function setDraw(fn: ((v: View, st: RacerState, now: number) => void) | null) { R.draw = fn }

// ------------------------------------------------------------------ open / close
function attach() {
  R.stopKode?.(); R.stopTok?.(); R.stopBeat?.()
  R.stopKode = startKode()
  R.stopTok = onToken(onTok)
  R.stopBeat = onBeat((b) => { if (R.click) click(b.beat === 0) })
  if (R.raf) cancelAnimationFrame(R.raf)
  R.raf = requestAnimationFrame(frame)
}
export function openGame() {
  closeGame(false)
  R.open = true
  set(initial())
  R.view.vehicle = vehicleById(get().vehicle)
  attach()
}
export function closeGame(restoreClock = true) {
  R.open = false
  silence(); R.token++
  if (R.raf) cancelAnimationFrame(R.raf)
  R.raf = 0
  R.stopTok?.(); R.stopTok = null
  R.stopBeat?.(); R.stopBeat = null
  R.stopKode?.(); R.stopKode = null
  clearGuide(); clearScore('racer')
  if (restoreClock) releaseClock('racer')
  R.counting = false
}

if (import.meta.env.DEV) {
  ;(globalThis as Record<string, unknown>).__racer = {
    store: useRacer, run: R, view, openTrack, go, retry, nextTrack, toMap, toGarage, chooseVehicle, setMode, hearAgain, TRACKS, WORLDS, VEHICLES, noteName, wrongNote, phraseOf,
    plays: () => R.plays, startBeat: () => R.startBeat, raceB0: () => R.raceB0, b0: () => R.b0,
  }
}
if (R.open && !R.raf) attach() // an edit of this file while the game is open: pick the loop up again where it was
// A different kid signed in: the lap in progress ends and THEIR stars / best times load (the old kid's save stayed in the store, and the next lap wrote it under the new kid).
const offProfile = onProfileChange(() => { const was = R.open; closeGame(false); if (was) R.open = true; set(initial()); R.view.vehicle = vehicleById(get().vehicle); if (was) attach() }, 'racer')
const unPanic = registerPanicTarget('racer', () => { stopHum(); R.click = false })
if (import.meta.hot) {
  import.meta.hot.data.store = useRacer
  import.meta.hot.data.run = R
  import.meta.hot.dispose(() => { offProfile(); unPanic(); if (R.raf) cancelAnimationFrame(R.raf); R.raf = 0; R.stopTok?.(); R.stopBeat?.(); R.stopKode?.(); R.stopTok = R.stopBeat = R.stopKode = null; clearTimers(); stopHum(); R.click = false })
  import.meta.hot.accept()
}
