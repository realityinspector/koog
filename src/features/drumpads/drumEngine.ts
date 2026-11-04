// Drum pads engine: eight pads, a 16-step pattern per drum (optionally 2 bars), played on the shared master clock.
// No React here. Rules live in drumCore.ts (pure, tested by scripts/drum-fixtures.ts); the voices are in drumKit.ts.
//   * A pad sounds the instant it is pressed (no quantise on the sound). With RECORD on and the pattern running, the hit is also written
//     to the nearest 16th (a hit just before the downbeat lands on step 1).
//   * Sound goes through the shared audio host channel 'drumpads' (cap below) and is silenced by panic.
//   * State lives in import.meta.hot.data.drums so editing this file never stops the beat or loses the pattern.
// Round 2: four pattern banks A-D (a change while playing waits for the bar line, or chains on its own), an accent track, per-drum mute and solo,
//   copy bar 1 to bar 2, and a hold-to-roll fill that is never recorded. Save format 'drumpads.v1' is unchanged for pattern A (see drumCore Saved).
// STABLE API: selectBank, setChain, toggleMute, toggleSolo, clearMuteSolo, toggleAccentStep, copyBar12, startFill/stopFill, useDrums, padDown/padUp, startPattern/stopPattern/togglePlay, toggleRec, undoPass, clearVoiceRow, clearPattern, loadStarter, setKit, setSwing,
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
  BANK_NAMES, N_BANKS, REPEAT_RATES, ROW_CLEAR_MS, STARTERS, VOICES, atBarLine, audible, clampSwing, clearAll, clearRow, clonePattern, copyBar, defaultTweak, effVel, fillVel, isEmpty, newPattern, newUndo, nextBank,
  parsePattern, popUndo, pushUndo, recordHit, repeatPositions, reviveSaved, rowEmpty, setLength, stepBeats, toggleAccent, toggleCell, type BarLen, type Pattern, type Saved, type Tweak, type UndoStack,
} from './drumCore'

/** channel cap on the shared host (the beat machine's drums sit near 1.0; this is a touch lower because pad hits stack) */
export const DRUM_CAP = 0.85
const LOOK_MS = 120
const SAVE_KEY = 'drumpads.v1'

export interface DrumView {
  running: boolean; rec: boolean; pat: Pattern; kit: number; swing: number; vol: number; patVol: number; repeat: number
  lastVoice: number; tweak: Tweak[]; canUndo: boolean; note: string; held: boolean[]
  /** pattern banks: which one plays / is edited, which one is queued for the next bar line (-1 = none), chain on, which banks hold something */
  bank: number; queued: number; chain: boolean; banksUsed: boolean[]
  mute: boolean[]; solo: boolean[]; fill: boolean
}
/** `src`: 'pad' = a live hit (a controller pad or an on-screen pad), 'seq' = the pattern playing, 'fill' = the roll fill */
export interface DrumHit { voice: number; at: number; vel: number; src?: 'pad' | 'seq' | 'fill' }

interface Eng {
  ctx: AudioContext | null; bus: GainNode | null; noise: AudioBuffer | null
  pat: Pattern; undo: UndoStack; passOpen: boolean
  banks: Pattern[]; bank: number; queued: number; patStart: number; firstN: number
  fillSt: { anchor: number; lastPos: number; clock: boolean; t0: number; fresh: boolean } | null; fillTimer: number
  next: number; epoch?: number; heard: Map<string, number>
  startedClock: boolean
  holds: Map<number, { t: number; vel: number; timer: number; cleared: boolean }>
  rep: Map<number, { anchor: number; lastPos: number; vel: number; clock: boolean; fresh?: boolean }>
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
  bank: 0, queued: -1, chain: false, banksUsed: [false, false, false, false], mute: VOICES.map(() => false), solo: VOICES.map(() => false), fill: false,
})
function make() { return create<DrumView>()(() => blankView()) }
export const useDrums = hot.store ?? make()
const get = () => useDrums.getState()
const set = (p: Partial<DrumView>) => useDrums.setState(p)

const E: Eng = hot.eng ?? {
  ctx: null, bus: null, noise: null, pat: newPattern(), undo: newUndo(), passOpen: false, next: 0, heard: new Map(), startedClock: false,
  holds: new Map(), rep: new Map(), repTimer: 0, saveTimer: 0, hitFns: new Set(), count: 0,
  banks: [], bank: 0, queued: -1, patStart: 0, firstN: -1, fillSt: null, fillTimer: 0,
}
// an engine kept alive by hot reload from before the banks existed: adopt its pattern as bank A
if (!E.banks || E.banks.length !== N_BANKS) { E.banks = Array.from({ length: N_BANKS }, (_, i) => (i === 0 ? E.pat : newPattern())); E.bank = 0; E.queued = -1; E.patStart = 0; E.firstN = -1; E.fillSt = null; E.fillTimer = 0 }
if (!E.pat.acc) E.pat.acc = new Array<number>(32).fill(0)

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
function emitHit(voice: number, at: number, vel: number, src: DrumHit['src'] = 'pad') {
  for (const f of [...E.hitFns]) { try { f({ voice, at, vel, src }) } catch { /* ignore */ } }
}
/** the pads' lights and the on-screen pads listen here; `at` is a performance.now() time (may be a few ms ahead for scheduled hits) */
export function onDrumHit(fn: (h: DrumHit) => void) { E.hitFns.add(fn); return () => { E.hitFns.delete(fn) } }

// ---------- state helpers ----------
function say(note: string) { set({ note }) }
const usedBanks = () => E.banks.map((b, i) => (i === E.bank ? !isEmpty(E.pat) : !isEmpty(b)))
function commit() {
  set({ pat: clonePattern(E.pat), canUndo: E.undo.snaps.length > 0, banksUsed: usedBanks() })
  scheduleSave()
}
function snapshot() { pushUndo(E.undo, E.pat) }

function scheduleSave() {
  if (E.saveTimer) clearTimeout(E.saveTimer)
  E.saveTimer = window.setTimeout(() => { E.saveTimer = 0; save() }, 400)
}
function save() {
  const v = get(), a = E.banks[0]
  const s: Saved = {
    len: a.len, rows: a.rows, acc: a.acc, kit: v.kit, swing: v.swing, vol: v.vol, patVol: v.patVol, repeat: v.repeat, tweak: v.tweak,
    more: E.banks.slice(1).map((b) => ({ len: b.len, rows: b.rows, acc: b.acc })), bank: E.bank, chain: v.chain, mute: v.mute, solo: v.solo,
  }
  try { localStorage.setItem(pkey(SAVE_KEY), JSON.stringify(s)) } catch { /* private mode / full: ignore */ }
}
function load() {
  let s: Saved | null = null
  try { const raw = localStorage.getItem(pkey(SAVE_KEY)); s = raw ? reviveSaved(JSON.parse(raw)) : null } catch { s = null }
  const b = blankView()
  E.undo = newUndo(); E.queued = -1; E.patStart = 0
  if (!s) {
    E.banks = Array.from({ length: N_BANKS }, () => newPattern()); E.bank = 0; E.pat = E.banks[0]
    set({ pat: clonePattern(E.pat), kit: b.kit, swing: 0, vol: b.vol, patVol: 1, repeat: 0, tweak: b.tweak, canUndo: false, note: '', bank: 0, queued: -1, chain: false, banksUsed: b.banksUsed, mute: b.mute, solo: b.solo })
    return
  }
  const more = (s.more ?? []).map((m) => ({ len: m.len, rows: m.rows, acc: m.acc ?? new Array<number>(32).fill(0) }))
  E.banks = [{ len: s.len, rows: s.rows, acc: s.acc ?? new Array<number>(32).fill(0) }, ...more]
  while (E.banks.length < N_BANKS) E.banks.push(newPattern())
  E.bank = Math.min(N_BANKS - 1, Math.max(0, s.bank ?? 0)); E.pat = E.banks[E.bank]
  set({ pat: clonePattern(E.pat), kit: s.kit, swing: s.swing, vol: s.vol, patVol: s.patVol, repeat: s.repeat, tweak: s.tweak, canUndo: false, note: '',
    bank: E.bank, queued: -1, chain: !!s.chain, banksUsed: usedBanks(), mute: s.mute ?? b.mute, solo: s.solo ?? b.solo })
  if (E.bus) E.bus.gain.value = s.vol
}

// ---------- the pattern player ----------
const loopsRunning = () => { try { return useLoop.getState().running } catch { return false } }
/** swap to another bank right now (the engine's own pattern pointer; the view follows) */
function swapTo(b: number, n: number) {
  E.bank = b; E.pat = E.banks[b]; E.queued = -1; E.patStart = n; E.undo = newUndo(); E.passOpen = false
  set({ pat: clonePattern(E.pat), bank: b, queued: -1, canUndo: false, banksUsed: usedBanks(), note: `Pattern ${BANK_NAMES[b]}` })
}
function schedule(now: number) {
  if (!get().running) return
  const c = ensureAudio(); if (!c || c.state !== 'running') return
  const pos = beatPos(now) * 4
  if (E.epoch !== clockEpoch() || E.next < Math.floor(pos) - 2 || E.next > Math.ceil(pos) + 8) { E.next = Math.ceil(pos - 0.04); E.epoch = clockEpoch(); E.firstN = -1 }
  const { swing, patVol, mute, solo, chain } = get()
  const to = now + LOOK_MS
  while (timeOfBeat(stepBeats(E.next, swing)) < to) {
    const n = E.next
    if (E.firstN < 0) E.firstN = n
    // the bar line: a queued pattern (or the chain) takes over on the first step of a cycle
    if (atBarLine(n, E.patStart, E.pat.len)) {
      if (E.queued >= 0 && E.queued !== E.bank) swapTo(E.queued, n)
      else if (chain && n !== E.firstN) { const nb = nextBank(E.bank, usedBanks()); if (nb !== E.bank) swapTo(nb, n) }
    }
    const len = E.pat.len, step = (((n - E.patStart) % len) + len) % len, when = timeOfBeat(stepBeats(n, swing))
    if (when >= now - 5) {
      const accent = E.pat.acc[step] > 0
      for (let v = 0; v < VOICES.length; v++) {
        const vel = E.pat.rows[v][step]
        if (vel <= 0 || E.heard.has(`${n}:${v}`) || !audible(v, mute, solo)) continue
        const lv = effVel(vel, accent)
        sound(v, lv * patVol, c.currentTime + Math.max(0, (when - now) / 1000))
        emitHit(v, when, lv, 'seq')
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
  E.epoch = undefined; E.patStart = 0; E.firstN = -1
  set({ running: true })
  say('Playing')
  schedule(performance.now())
}
export function stopPattern() {
  if (!get().running) return
  set({ running: false, rec: get().rec })
  E.passOpen = false
  if (E.queued >= 0 && E.queued !== E.bank) swapTo(E.queued, 0)
  chokeAll(); stopFill()
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
export const currentStep = (): number => (get().running && isRunning() ? (((Math.floor(beatPos() * 4 + 1e-6) - E.patStart) % E.pat.len) + E.pat.len) % E.pat.len : -1)

// ---------- pads ----------
function writeHit(voice: number, nAbs: number, vel: number) {
  if (!E.passOpen) { snapshot(); E.passOpen = true }
  recordHit(E.pat, voice, nAbs - E.patStart, vel)
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
/** a live hit that is not a held pad (the foot pedal): sounds now, records when REC is on, no hold-to-clear */
export function liveHit(voice: number, vel = 1) { void unlockHost(); hit(voice, vel) }
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
    for (const x of repeatPositions(r.lastPos, to, rate, r.clock && r.fresh ? 0.25 : 0)) {
      const at = r.clock ? timeOfBeat(x / 4) : r.anchor + x * stepMs
      const c = ensureAudio(); if (!c) break
      sound(voice, r.vel, c.currentTime + Math.max(0, (at - now) / 1000))
      emitHit(voice, at, r.vel)
      if (get().rec && get().running && isRunning()) writeHit(voice, Math.round(x), r.vel)
    }
    r.lastPos = Math.max(r.lastPos, to); r.fresh = false // the no-flam skip only applies to the first window after the pad goes down
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
    E.rep.set(voice, { anchor: now, lastPos: clock ? beatPos(now) * 4 : 0, vel, clock, fresh: true })
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
  E.pat = parsePattern(s.rows, 16); E.banks[E.bank] = E.pat; E.heard.clear()
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

// ---------- round 2: banks, mute / solo, accent, copy, fill ----------
/** pick pattern A-D. Stopped: switches now. Playing: waits for the bar line (the end of the pattern's cycle); picking the playing one cancels the wait. */
export function selectBank(b: number) {
  const bank = Math.min(N_BANKS - 1, Math.max(0, Math.round(b)))
  if (!get().running) { if (bank !== E.bank) swapTo(bank, 0); E.queued = -1; set({ queued: -1, note: `Pattern ${BANK_NAMES[bank]}` }); scheduleSave(); return }
  if (bank === E.bank) { E.queued = -1; set({ queued: -1, note: `Pattern ${BANK_NAMES[bank]} stays` }); return }
  E.queued = bank; set({ queued: bank, note: `Pattern ${BANK_NAMES[bank]} starts at the bar line` })
}
export function setChain(on: boolean) { set({ chain: on, note: on ? 'Chain on: the patterns that have beats play one after another' : 'Chain off' }); scheduleSave() }
export function toggleMute(voice: number) {
  if (voice < 0 || voice >= VOICES.length) return
  const mute = get().mute.slice(); mute[voice] = !mute[voice]; set({ mute, note: `${VOICES[voice].label} ${mute[voice] ? 'muted' : 'back on'}` }); scheduleSave()
}
export function toggleSolo(voice: number) {
  if (voice < 0 || voice >= VOICES.length) return
  const solo = get().solo.slice(); solo[voice] = !solo[voice]; set({ solo, note: solo[voice] ? `${VOICES[voice].label} solo: only soloed drums play` : `${VOICES[voice].label} solo off` }); scheduleSave()
}
export function clearMuteSolo() { set({ mute: VOICES.map(() => false), solo: VOICES.map(() => false), note: 'All drums back on' }); scheduleSave() }
export function toggleAccentStep(step: number) {
  if (step < 0 || step >= E.pat.len) return
  snapshot(); const on = toggleAccent(E.pat, step); commit(); say(on ? `Step ${step + 1} is an accent (louder)` : `Step ${step + 1} accent off`)
}
export function copyBar12() { snapshot(); copyBar(E.pat); commit(); say('Copied bar 1 to bar 2') }

function fillTick() {
  const F = E.fillSt; if (!F) return
  const now = performance.now(), look = 40, stepMs = 60000 / getBpm() / 4
  const posOf = (t: number) => (F.clock ? beatPos(t) * 4 : (t - F.anchor) / stepMs)
  const to = posOf(now + look)
  for (const x of repeatPositions(F.lastPos, to, 1, F.clock && F.fresh ? 0.25 : 0)) {
    const at = F.clock ? timeOfBeat(x / 4) : F.anchor + x * stepMs
    const c = ensureAudio(); if (!c) break
    const vel = fillVel((at - F.t0) / (60000 / getBpm()))
    sound(1, vel, c.currentTime + Math.max(0, (at - now) / 1000))
    emitHit(1, at, vel, 'fill') // a fill is never written to the pattern, even with REC on
  }
  F.lastPos = Math.max(F.lastPos, to); F.fresh = false
}
/** hold-to-roll fill: 16th-note snare hits, swelling in loudness, on top of the beat. Not recorded. */
export function startFill() {
  if (E.fillSt) return
  void unlockHost(); ensureAudio()
  const clock = isRunning(), now = performance.now()
  E.fillSt = { anchor: now, lastPos: clock ? beatPos(now) * 4 : 0, clock, t0: now, fresh: true }
  set({ fill: true, note: 'Fill!' })
  if (!E.fillTimer) E.fillTimer = window.setInterval(fillTick, 12)
}
export function stopFill() {
  if (E.fillTimer) { clearInterval(E.fillTimer); E.fillTimer = 0 }
  E.fillSt = null
  if (get().fill) set({ fill: false })
}

// ---------- panic / lifecycle ----------
function silence() {
  releaseAllPads(); stopFill()
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
  import.meta.hot.dispose(() => { stopRepTimer(); if (E.fillTimer) { clearInterval(E.fillTimer); E.fillTimer = 0 }; if (E.saveTimer) { clearTimeout(E.saveTimer); E.saveTimer = 0; save() } })
  import.meta.hot.accept()
}
