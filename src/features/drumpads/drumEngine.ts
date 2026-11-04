// Drum pads engine: eight pads, a 16-step pattern per drum (optionally 2 bars), played on the shared master clock.
// No React here. Rules live in drumCore.ts (pure, tested by scripts/drum-fixtures.ts); the voices are in drumKit.ts.
//   * A pad sounds the instant it is pressed (no quantise on the sound). With RECORD on and the pattern running, the hit is also written
//     to the nearest 16th (a hit just before the downbeat lands on step 1).
//   * Sound goes through the shared audio host channel 'drumpads' (cap below) and is silenced by panic.
//   * State lives in import.meta.hot.data.drums so editing this file never stops the beat or loses the pattern.
// STABLE API: useDrums, padDown/padUp, startPattern/stopPattern/togglePlay, toggleRec, undoPass, clearVoiceRow, clearPattern, loadStarter, setKit, setSwing,
//   setVol, setPatVol, setRepeat, setBars, setTweak, toggleStep, previewVoice, currentStep, onDrumHit, tapDrumTempo.
import { create } from 'zustand'
import { registerPanicTarget } from '../../music/panic'
import { createChannel, getCtx, getNoise, unlockHost } from '../../audio/host'
import { beatPos, clockEpoch, getBpm, isRunning, onTick, setBpm, startMaster, stopMaster, tapTempo, timeOfBeat, useMaster } from '../../music/masterClock'
import { getBeat } from '../dj/clock'
import { useLoop } from '../loopstation/loopEngine'
import { onProfileChange, pkey } from '../../profile/profile'
import { KITS, chokeAll, playVoice } from './drumKit'
import {
  REPEAT_RATES, ROW_CLEAR_MS, STARTERS, VOICES, clampSwing, clearAll, clearRow, clonePattern, defaultTweak, newPattern, newUndo, parsePattern, popUndo, pushUndo,
  recordHit, repeatPositions, reviveSaved, rowEmpty, setLength, stepBeats, toggleCell, type BarLen, type Pattern, type Saved, type Tweak, type UndoStack,
} from './drumCore'

/** channel cap on the shared host (the beat machine's drums sit near 1.0; this is a touch lower because pad hits stack) */
export const DRUM_CAP = 0.85
const LOOK_MS = 120
const SAVE_KEY = 'drumpads.v1'

export interface DrumView {
  running: boolean; rec: boolean; pat: Pattern; kit: number; swing: number; vol: number; patVol: number; repeat: number
  lastVoice: number; tweak: Tweak[]; canUndo: boolean; note: string; held: boolean[]
}
export interface DrumHit { voice: number; at: number; vel: number }

interface Eng {
  ctx: AudioContext | null; bus: GainNode | null; noise: AudioBuffer | null
  pat: Pattern; undo: UndoStack; passOpen: boolean
  next: number; epoch?: number; heard: Map<string, number>
  startedClock: boolean
  holds: Map<number, { t: number; vel: number; timer: number; cleared: boolean }>
  rep: Map<number, { anchor: number; lastPos: number; vel: number; clock: boolean }>
  repTimer: number
  saveTimer: number
  hitFns: Set<(h: DrumHit) => void>
  offTick?: () => void; offMaster?: () => void; offProfile?: () => void
  count: number
}
interface Hot { store?: ReturnType<typeof make>; eng?: Eng }
const hot = (import.meta.hot?.data ?? {}) as Hot

const blankView = (): DrumView => ({
  running: false, rec: false, pat: newPattern(), kit: 0, swing: 0, vol: 0.8, patVol: 1, repeat: 0,
  lastVoice: 0, tweak: VOICES.map(defaultTweak), canUndo: false, note: '', held: VOICES.map(() => false),
})
function make() { return create<DrumView>()(() => blankView()) }
export const useDrums = hot.store ?? make()
const get = () => useDrums.getState()
const set = (p: Partial<DrumView>) => useDrums.setState(p)

const E: Eng = hot.eng ?? {
  ctx: null, bus: null, noise: null, pat: newPattern(), undo: newUndo(), passOpen: false, next: 0, heard: new Map(), startedClock: false,
  holds: new Map(), rep: new Map(), repTimer: 0, saveTimer: 0, hitFns: new Set(), count: 0,
}

/** how many drum sounds were started (tests / the headless harness read this) */
export const soundCount = () => E.count

// ---------- audio ----------
function ensureAudio(): AudioContext | null {
  try {
    const ch = createChannel('drumpads', { cap: DRUM_CAP, label: 'Drum pads' })
    const c = getCtx()
    if (E.ctx !== c || !E.bus) {
      const bus = c.createGain(); bus.gain.value = get().vol
      bus.connect(ch.input)
      E.ctx = c; E.bus = bus; E.noise = getNoise(c)
    }
    if (c.state !== 'running') void unlockHost()
    return c
  } catch { return null }
}
/** call from a click / key / pad press so the browser lets the pads make sound */
export const unlockDrums = () => { ensureAudio() }

function sound(voice: number, vel: number, when: number) {
  const c = ensureAudio(); if (!c || !E.bus || !E.noise) return
  try { playVoice(c, E.bus, E.noise, get().kit, voice, when, vel, get().tweak[voice]); E.count++ } catch (e) { console.error('[drums]', e) }
}
function emitHit(voice: number, at: number, vel: number) {
  for (const f of [...E.hitFns]) { try { f({ voice, at, vel }) } catch { /* ignore */ } }
}
/** the pads' lights and the on-screen pads listen here; `at` is a performance.now() time (may be a few ms ahead for scheduled hits) */
export function onDrumHit(fn: (h: DrumHit) => void) { E.hitFns.add(fn); return () => { E.hitFns.delete(fn) } }

// ---------- state helpers ----------
function say(note: string) { set({ note }) }
function commit() {
  set({ pat: clonePattern(E.pat), canUndo: E.undo.snaps.length > 0 })
  scheduleSave()
}
function snapshot() { pushUndo(E.undo, E.pat) }

function scheduleSave() {
  if (E.saveTimer) clearTimeout(E.saveTimer)
  E.saveTimer = window.setTimeout(() => { E.saveTimer = 0; save() }, 400)
}
function save() {
  const v = get()
  const s: Saved = { len: E.pat.len, rows: E.pat.rows, kit: v.kit, swing: v.swing, vol: v.vol, patVol: v.patVol, repeat: v.repeat, tweak: v.tweak }
  try { localStorage.setItem(pkey(SAVE_KEY), JSON.stringify(s)) } catch { /* private mode / full: ignore */ }
}
function load() {
  let s: Saved | null = null
  try { const raw = localStorage.getItem(pkey(SAVE_KEY)); s = raw ? reviveSaved(JSON.parse(raw)) : null } catch { s = null }
  const b = blankView()
  if (!s) { E.pat = newPattern(); E.undo = newUndo(); set({ pat: clonePattern(E.pat), kit: b.kit, swing: 0, vol: b.vol, patVol: 1, repeat: 0, tweak: b.tweak, canUndo: false, note: '' }); return }
  E.pat = { len: s.len, rows: s.rows }; E.undo = newUndo()
  set({ pat: clonePattern(E.pat), kit: s.kit, swing: s.swing, vol: s.vol, patVol: s.patVol, repeat: s.repeat, tweak: s.tweak, canUndo: false, note: '' })
  if (E.bus) E.bus.gain.value = s.vol
}

// ---------- the pattern player ----------
const loopsRunning = () => { try { return useLoop.getState().running } catch { return false } }
function schedule(now: number) {
  if (!get().running) return
  const c = ensureAudio(); if (!c || c.state !== 'running') return
  const pos = beatPos(now) * 4
  if (E.epoch !== clockEpoch() || E.next < Math.floor(pos) - 2 || E.next > Math.ceil(pos) + 8) { E.next = Math.ceil(pos - 0.04); E.epoch = clockEpoch() }
  const { swing, patVol } = get(), len = E.pat.len
  const to = now + LOOK_MS
  while (timeOfBeat(stepBeats(E.next, swing)) < to) {
    const n = E.next, step = ((n % len) + len) % len, when = timeOfBeat(stepBeats(n, swing))
    if (when >= now - 5) {
      for (let v = 0; v < VOICES.length; v++) {
        const vel = E.pat.rows[v][step]
        if (vel <= 0 || E.heard.has(`${n}:${v}`)) continue
        sound(v, vel * patVol, c.currentTime + Math.max(0, (when - now) / 1000))
        emitHit(v, when, vel)
      }
    }
    E.next++
  }
  if (E.heard.size > 40) for (const k of [...E.heard.keys()]) if (E.heard.get(k)! < E.next - 8) E.heard.delete(k)
}

export function startPattern() {
  if (get().running) return
  void unlockHost(); ensureAudio()
  if (!isRunning()) { startMaster(); E.startedClock = true } else E.startedClock = false
  E.epoch = undefined
  set({ running: true })
  say('Playing')
  schedule(performance.now())
}
export function stopPattern() {
  if (!get().running) return
  set({ running: false, rec: get().rec })
  E.passOpen = false
  chokeAll()
  if (E.startedClock && !loopsRunning() && !getBeat().playing) stopMaster()
  E.startedClock = false
  say('Stopped')
}
export function togglePlay() { if (get().running) stopPattern(); else startPattern() }
export function toggleRec() {
  const rec = !get().rec
  E.passOpen = false
  set({ rec })
  say(rec ? (get().running ? 'Recording: tap the pads' : 'Record is armed: press PLAY') : 'Record off')
}
export const currentStep = (): number => (get().running && isRunning() ? ((Math.floor(beatPos() * 4 + 1e-6) % E.pat.len) + E.pat.len) % E.pat.len : -1)

// ---------- pads ----------
function writeHit(voice: number, nAbs: number, vel: number) {
  if (!E.passOpen) { snapshot(); E.passOpen = true }
  recordHit(E.pat, voice, nAbs, vel)
  E.heard.set(`${nAbs}:${voice}`, nAbs) // the player just heard it live: the scheduler must not play it again a few ms later
  commit()
}
/** one live hit: sounds now; written to the pattern when recording */
function hit(voice: number, vel: number) {
  const now = performance.now()
  const c = ensureAudio()
  if (c) sound(voice, vel, c.currentTime + 0.002)
  set({ lastVoice: voice })
  emitHit(voice, now, vel)
  if (get().rec && get().running && isRunning()) writeHit(voice, Math.round(beatPos(now) * 4), vel)
}
/** play a drum without touching the pattern (clicking a step, the kit preview) */
export function previewVoice(voice: number, vel = 0.8) {
  const c = ensureAudio(); if (c) sound(voice, vel, c.currentTime + 0.002)
  set({ lastVoice: voice }); emitHit(voice, performance.now(), vel)
}

function repTick() {
  const now = performance.now(), look = 40
  for (const [voice, r] of E.rep) {
    const stepMs = 60000 / getBpm() / 4, rate = REPEAT_RATES[get().repeat]
    if (!rate) continue
    const posOf = (t: number) => (r.clock ? beatPos(t) * 4 : (t - r.anchor) / stepMs)
    const to = posOf(now + look)
    for (const x of repeatPositions(r.lastPos, to, rate, r.clock ? 0.25 : 0)) {
      const at = r.clock ? timeOfBeat(x / 4) : r.anchor + x * stepMs
      const c = ensureAudio(); if (!c) break
      sound(voice, r.vel, c.currentTime + Math.max(0, (at - now) / 1000))
      emitHit(voice, at, r.vel)
      if (get().rec && get().running && isRunning()) writeHit(voice, Math.round(x), r.vel)
    }
    r.lastPos = Math.max(r.lastPos, to)
  }
  if (!E.rep.size) stopRepTimer()
}
function stopRepTimer() { if (E.repTimer) { clearInterval(E.repTimer); E.repTimer = 0 } }

/** a pad goes down. `clearNow` = CUE is held (hold CUE + pad clears that drum). Returns nothing; the sound is immediate. */
export function padDown(voice: number, vel = 1, clearNow = false) {
  if (voice < 0 || voice >= VOICES.length) return
  void unlockHost()
  const held = get().held.slice(); held[voice] = true; set({ held })
  if (clearNow) {
    snapshot(); clearRow(E.pat, voice); commit(); say(`Cleared ${VOICES[voice].label}`)
    hit(voice, vel); return
  }
  hit(voice, vel)
  const prev = E.holds.get(voice); if (prev) clearTimeout(prev.timer)
  const h = { t: performance.now(), vel, timer: 0, cleared: false }
  // hold a pad for 1 s while stopped (and not rolling) = clear that drum's row
  if (!get().running && !get().repeat) {
    h.timer = window.setTimeout(() => {
      if (E.holds.get(voice) !== h || get().running || get().repeat) return
      if (!rowEmpty(E.pat, voice)) { snapshot(); clearRow(E.pat, voice); commit(); say(`Cleared ${VOICES[voice].label}`) } else say(`${VOICES[voice].label} is already empty`)
      h.cleared = true
    }, ROW_CLEAR_MS)
  }
  E.holds.set(voice, h)
  // note repeat: keep hitting on the 1/8 or 1/16 grid while the pad is held
  const rate = REPEAT_RATES[get().repeat]
  if (rate) {
    const clock = isRunning(), now = performance.now()
    E.rep.set(voice, { anchor: now, lastPos: clock ? beatPos(now) * 4 : 0, vel, clock })
    if (!E.repTimer) E.repTimer = window.setInterval(repTick, 12)
  }
}
export function padUp(voice: number) {
  const held = get().held.slice(); held[voice] = false; set({ held })
  const h = E.holds.get(voice); if (h) { clearTimeout(h.timer); E.holds.delete(voice) }
  E.rep.delete(voice)
  if (!E.rep.size) stopRepTimer()
}
export function releaseAllPads() { for (let v = 0; v < VOICES.length; v++) padUp(v) }

// ---------- edits ----------
export function undoPass() {
  if (popUndo(E.undo, E.pat)) { E.passOpen = false; commit(); say('Undid the last change') } else say('Nothing to undo')
}
export function clearVoiceRow(voice: number) { snapshot(); clearRow(E.pat, voice); commit(); say(`Cleared ${VOICES[voice].label}`) }
export function clearPattern() { snapshot(); clearAll(E.pat); commit(); say('Cleared the whole pattern') }
export function loadStarter(id: string) {
  const s = STARTERS.find((x) => x.id === id); if (!s) return
  snapshot()
  E.pat = parsePattern(s.rows, 16); E.heard.clear()
  setBpm(s.bpm)
  commit(); say(`Loaded ${s.name} at ${s.bpm} bpm`)
}
export function toggleStep(voice: number, step: number) {
  const on = toggleCell(E.pat, voice, step); commit()
  if (on && !get().running) previewVoice(voice, 0.7)
}
export function setBars(bars: 1 | 2) { setLength(E.pat, (bars === 2 ? 32 : 16) as BarLen); commit(); say(bars === 2 ? 'Two bars' : 'One bar') }
export function setKit(k: number) {
  const kit = Math.min(KITS.length - 1, Math.max(0, Math.round(k)))
  if (kit === get().kit) return
  chokeAll(); set({ kit }); scheduleSave(); say(`Kit: ${KITS[kit].name}`)
}
export function setSwing(s: number) { set({ swing: Math.round(clampSwing(s) * 100) / 100 }); scheduleSave() }
export function setVol(v: number) { const vol = Math.min(1, Math.max(0, v)); set({ vol }); if (E.bus && E.ctx) E.bus.gain.setTargetAtTime(vol, E.ctx.currentTime, 0.02); scheduleSave() }
export function setPatVol(v: number) { set({ patVol: Math.min(1, Math.max(0, v)) }); scheduleSave() }
export function setRepeat(i: number) { const repeat = Math.min(2, Math.max(0, Math.round(i))); set({ repeat }); scheduleSave(); say(repeat ? `Note repeat ${['', '1/8', '1/16'][repeat]}: hold a pad` : 'Note repeat off') }
export function setTweak(voice: number, patch: Partial<Tweak>) {
  const tweak = get().tweak.map((t, i) => (i === voice ? { ...t, ...patch } : t)); set({ tweak }); scheduleSave()
}
export function tapDrumTempo() { tapTempo(); say(`Tap tempo ${Math.round(getBpm())} bpm`) }

// ---------- panic / lifecycle ----------
function silence() {
  releaseAllPads()
  if (get().running) { set({ running: false }); E.startedClock = false }
  chokeAll()
  try { E.bus?.disconnect() } catch { /* ignore */ }
  E.bus = null // rebuilt on the next hit
}
registerPanicTarget('drumpads', silence)

E.offTick?.(); E.offMaster?.(); E.offProfile?.()
E.offTick = onTick(schedule)
// someone else stopped the shared clock (the looper, say): the pattern stops with it
E.offMaster = useMaster.subscribe((s) => { if (!s.running && get().running) { set({ running: false }); E.startedClock = false; say('Stopped') } })
E.offProfile = onProfileChange(() => load())
if (!hot.eng) load()

if (import.meta.hot) {
  import.meta.hot.data.store = useDrums
  import.meta.hot.data.eng = E
  import.meta.hot.dispose(() => { stopRepTimer(); if (E.saveTimer) { clearTimeout(E.saveTimer); E.saveTimer = 0; save() } })
  import.meta.hot.accept()
}
