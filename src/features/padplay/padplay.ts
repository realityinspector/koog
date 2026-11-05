// 🎮 Game pads: the DJ controller's 8 pads (or the 8 big pads on screen) play real notes into the shared note feed, so every game and song hears them.
// Device role 'gamepads' routes the controller here (devices.ts onGamepadsMessage). With no hardware, the on-screen dock (GamePadsDock.tsx) does the same job.
//
//   pads A1-A4 (deck A, left) and B1-B4 (deck B, right) = 8 notes, low to high, through playLocal (so they sound and onNote / the judge / the games see them). Velocity follows the hit.
//   map SCALE   the 8 notes of the key's scale (src/music/harmonyStore.ts), tonic to octave        map FOLLOW   the notes the game wants next are always on pads (padCore.ts)
//   JOG A = octave down / up     PLAY = Start / go on (the foot pedal's path: usePedal.down, which Phrase Racer and the holiday games already read)
//   CUE = hear it again     SYNC = pause / back     PAD MODE = Scale <-> Follow the game
// LEDs: the pad of each target note is lit steadily, a pad you hit flashes 130 ms; a light can only switch on again 334 ms after it last did (under 3 a second).
// Dark again, and the DJ lights resynced, when the page or role changes.
import { create } from 'zustand'
import { onGamepadsMessage, onRoleChange, sendToDj, setRole, useDevices } from '../../music/devices'
import { decode, ledBytes } from '../dj/map'
import { resyncLeds } from '../dj/engine'
import { playLocal } from '../../music/localNotes'
import { useGuide } from '../../music/guide'
import { useScore } from '../../music/scoreStore'
import { useHarmonyStore } from '../../music/harmonyStore'
import { registerPanicTarget } from '../../music/panic'
import { usePedal } from '../pedal/pedal'
import { useScreen } from '../../layout/screenStore'
import { setControllerPage, useLoopPage } from '../loopstation/loopSurface'
import { useDrumPage } from '../drumpads/drumSurface'
import { useSurface } from '../controller/surface'
import { FLASH_MS, N_PADS, PAD_IDS, clampOct, followLayout, gateLeds, octaveJog, padIndex, padLabels, scaleNotes, sameLayout, targetPads, type PadMapKind, type Want } from './padCore'

export interface PadPlayState {
  screenOn: boolean; roleOn: boolean; on: boolean
  map: PadMapKind; oct: number
  layout: number[]; labels: string[]
  /** notes the game wants next (what the lit pads play) */
  targets: number[]; targetPads: number[]
  /** pads held right now */
  down: boolean[]
  /** pad index -> time of the last hit (for the picture) */
  touched: Record<string, number>
  note: string
}
type Hot = { store?: ReturnType<typeof make>; led?: boolean[]; off?: () => void; timer?: number; st?: Live }
interface Live { sounding: (number | null)[]; flashUntil: number[]; onAt: number[]; lastHitAt: number; emptySince: number; jog: number; ledOn: boolean[] }
const hot = (import.meta.hot?.data ?? {}) as Hot
const MAP_KEY = 'koog.padplay.map'
const loadMap = (): PadMapKind => { try { return localStorage.getItem(MAP_KEY) === 'follow' ? 'follow' : 'scale' } catch { return 'scale' } }
function make() {
  const layout = scaleNotes(useHarmonyStore.getState().key, 0)
  return create<PadPlayState>()(() => ({ screenOn: false, roleOn: false, on: false, map: loadMap(), oct: 0, layout, labels: padLabels(layout), targets: [], targetPads: [], down: Array(N_PADS).fill(false), touched: {}, note: '' }))
}
export const usePadPlay = hot.store ?? make()
const get = () => usePadPlay.getState()
const L: Live = hot.st ?? { sounding: Array(N_PADS).fill(null), flashUntil: Array(N_PADS).fill(-1e9), onAt: Array(N_PADS).fill(-1e9), lastHitAt: -1e9, emptySince: -1e9, jog: 0, ledOn: hot.led ?? Array(N_PADS).fill(false) }

// ---------- what the game wants next ----------
/** the guide's glowing keys; if a game publishes only a score (Songs), the next notes of the score */
export function wantNow(): Want {
  const g = useGuide.getState()
  if (g.targets.length) return { targets: g.targets, soon: g.soon }
  const sc = useScore.getState()
  if (sc.score) {
    const ahead: number[] = []
    for (let i = sc.pos; i < sc.score.notes.length && ahead.length < 3; i++) { const n = sc.score.notes[i].note; if (n != null) ahead.push(n) }
    if (ahead.length) return { targets: [ahead[0]], soon: ahead.slice(1) }
  }
  return { targets: [], soon: [] }
}
const MID_MS = 1500, GAP_MS = 600
/** recompute the pad -> note layout (and which pads are targets). Cheap; called on every guide / score / key change. */
export function refresh(now = performance.now()) {
  const s = get(), key = useHarmonyStore.getState().key, want = wantNow()
  if (!want.targets.length && L.emptySince < 0) L.emptySince = now
  const newPhrase = L.emptySince >= 0 && want.targets.length > 0 && now - L.emptySince > GAP_MS
  const mid = !newPhrase && now - L.lastHitAt < MID_MS
  const layout = s.map === 'follow' ? followLayout(s.layout, want, key, s.oct, mid) : scaleNotes(key, s.oct)
  if (want.targets.length) L.emptySince = -1
  const tp = targetPads(layout, want.targets)
  const same = sameLayout(layout, s.layout)
  if (same && sameLayout(tp, s.targetPads) && sameLayout(want.targets, s.targets)) return
  usePadPlay.setState({ layout: same ? s.layout : layout, labels: same ? s.labels : padLabels(layout), targets: want.targets, targetPads: tp })
}

// ---------- input ----------
export function padHit(i: number, vel = 100) {
  if (!get().on || i < 0 || i >= N_PADS || L.sounding[i] != null) return
  const note = get().layout[i], now = performance.now()
  L.sounding[i] = note; L.lastHitAt = now; L.flashUntil[i] = now + FLASH_MS
  usePadPlay.setState((s) => ({ down: s.down.map((d, k) => (k === i ? true : d)), touched: { ...s.touched, [PAD_IDS[i]]: now } }))
  playLocal(note, Math.max(1, Math.min(127, Math.round(vel))), true)
}
export function padLift(i: number) {
  const note = L.sounding[i]
  if (note == null) return
  L.sounding[i] = null
  usePadPlay.setState((s) => ({ down: s.down.map((d, k) => (k === i ? false : d)) }))
  playLocal(note, 0, false)
}
function releaseAll() { for (let i = 0; i < N_PADS; i++) padLift(i) }

export function setMap(m: PadMapKind) { try { localStorage.setItem(MAP_KEY, m) } catch { /* ignore */ } usePadPlay.setState({ map: m, note: m === 'follow' ? 'Follow the game: the lit pad is always the next note.' : 'Scale: the pads are the notes of the key, low to high.' }); refresh() }
export function setOctave(o: number) { usePadPlay.setState({ oct: clampOct(o) }); refresh() }

const visible = (el: Element) => { const r = (el as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.height > 0 }
function clickFirst(sel: string, text?: RegExp): boolean {
  for (const el of document.querySelectorAll<HTMLButtonElement>(sel)) {
    if (el.disabled || !visible(el)) continue
    if (text && !text.test((el.textContent ?? '').trim())) continue
    el.click(); return true
  }
  return false
}
// the big Start / GO buttons of the games that do not read the foot pedal (Songs, Zombie Lanes, BachDoom, Jiu-Jitsu, Runway); a game can opt in with data-padplay="start"
const START_BUTTONS = '[data-padplay="start"], .zl-btn.go, .bd-start, .bj-btn.go, .fr-btn.go'
/** PLAY: the same press the foot pedal makes (Phrase Racer and the holiday games listen to it), plus the Play button of Songs */
export function pressStart() {
  usePedal.setState({ down: true })
  window.setTimeout(() => usePedal.setState({ down: false }), 90)
  if (useScreen.getState().screen === 'songs') clickFirst('button.btn', /^(Play|Restart)$/)
  clickFirst(START_BUTTONS)
}
/** CUE: hear it again (holiday games' Hear button, the Songs Listen button) */
export function pressHear(): boolean { return clickFirst('[data-act="hear"], [data-padplay="hear"]') || clickFirst('button.btn-ghost', /^👂/) }
/** SYNC: pause / back to the menu */
export function pressBack(): boolean { return clickFirst('[data-padplay="back"], .hg-top > button.ghost') }

function onButton(id: string, value: number) {
  if (value <= 0) return
  if (id === 'play') pressStart()
  else if (id === 'cue') pressHear()
  else if (id === 'sync') pressBack()
  else if (id === 'padmode') setMap(get().map === 'scale' ? 'follow' : 'scale')
}
export function gameInput(id: string, value: number, vel?: number) {
  const [base, d] = id.split('.')
  const m = /^pad([1-4])$/.exec(base)
  if (m) { const i = padIndex(id); if (value > 0) padHit(i, vel ?? 100); else padLift(i); return }
  if (base === 'jog') {
    if (d !== 'A') return
    const r = octaveJog(L.jog, value); L.jog = r.acc
    if (r.step) setOctave(get().oct + r.step)
    return
  }
  onButton(base, value)
}

// ---------- LEDs ----------
const LED_IDS = PAD_IDS
const flashing = (now: number) => L.flashUntil.map((t) => now < t)
function syncLeds(now = performance.now()) {
  if (!get().on) return
  const s = get(), fl = flashing(now)
  const want = PAD_IDS.map((_, i) => s.targetPads.includes(i) || fl[i] || s.down[i])
  const next = gateLeds(L.ledOn, want, L.onAt, now)
  next.forEach((on, i) => {
    if (on === !!L.ledOn[i]) return
    L.ledOn[i] = on
    const b = ledBytes(LED_IDS[i], on); if (b) sendToDj(b)
  })
}
function ledsDark() { LED_IDS.forEach((id, i) => { if (L.ledOn[i]) { const b = ledBytes(id, false); if (b) sendToDj(b) } L.ledOn[i] = false }) }
let timer = hot.timer ?? 0
const ensureTimer = () => {
  if (get().on && !timer) timer = window.setInterval(() => syncLeds(), 60) // the layout only changes on events (a hit, a new guide), never on a timer: pads must not move under a hovering finger
  else if (!get().on && timer) { clearInterval(timer); timer = 0 }
}

// ---------- on / off ----------
const anyDevice = () => useDevices.getState().devices.some((d) => d.connected && d.role === 'gamepads')
function apply() {
  const s = get(), on = s.screenOn || s.roleOn
  if (on === s.on) return
  usePadPlay.setState({ on })
  if (on) { for (const id of LED_IDS) { const b = ledBytes(id, false); if (b) sendToDj(b) } L.ledOn.fill(false); L.onAt.fill(-1e9); refresh(); syncLeds() }
  else { releaseAll(); ledsDark(); resyncLeds(); L.jog = 0 }
  ensureTimer()
}
const hardware = () => useDevices.getState().devices.filter((d) => d.connected && ['dj', 'surface', 'loop', 'drums', 'gamepads'].includes(d.role))
/** Turn Game pads on or off for the DJ controller (or the on-screen pads when there is none). Turning it on takes the controller off its other page. */
export function setGamePads(on: boolean) {
  if (on === get().on && (on ? true : !get().screenOn && !get().roleOn)) return
  const devs = hardware()
  if (on) {
    setControllerPage('dj') // every other page goes dark first (this also clears the on-screen drums / loop / synth pages)
    if (devs.length) { for (const d of devs) setRole(d.name, 'gamepads'); usePadPlay.setState({ roleOn: true, screenOn: false }) }
    else usePadPlay.setState({ screenOn: true })
  } else {
    usePadPlay.setState({ screenOn: false })
    if (devs.some((d) => d.role === 'gamepads')) setControllerPage('dj') // role 'dj' again: onRoleChange turns roleOn off
    else usePadPlay.setState({ roleOn: anyDevice() })
  }
  apply()
}
export const toggleGamePads = () => setGamePads(!get().on)

function init() {
  hot.off?.()
  const offs = [
    onGamepadsMessage((data) => {
      const a = decode(data); if (!a || a.fine || a.id === 'jogtouch') return
      const vel = (data[0] & 0xf0) === 0x90 ? data[2] : undefined
      gameInput(a.deck ? `${a.id}.${a.deck}` : a.id, a.value, vel)
    }),
    onRoleChange((_n, role) => { usePadPlay.setState({ roleOn: role === 'gamepads' ? true : anyDevice() }); apply() }),
    useDevices.subscribe(() => { const r = anyDevice(); if (r !== get().roleOn) { usePadPlay.setState({ roleOn: r }); apply() } }),
    useGuide.subscribe(() => refresh()),
    useScore.subscribe(() => refresh()),
    useHarmonyStore.subscribe((s, p) => { if (s.key !== p.key) refresh() }),
    // another controller page (or the on-screen synth surface) taking over turns the on-screen game pads off
    useDrumPage.subscribe((s, p) => { if (s.on && !p.on && get().screenOn) { usePadPlay.setState({ screenOn: false }); apply() } }),
    useLoopPage.subscribe((s, p) => { if (s.on && !p.on && get().screenOn) { usePadPlay.setState({ screenOn: false }); apply() } }),
    useSurface.subscribe((s, p) => { if (s.on && !p.on && get().screenOn) { usePadPlay.setState({ screenOn: false }); apply() } }),
    registerPanicTarget('padplay', releaseAll),
  ]
  hot.off = () => { for (const f of offs) f() }
  if (anyDevice()) { usePadPlay.setState({ roleOn: true }); apply() }
  ensureTimer()
}
init()

if (import.meta.hot) {
  import.meta.hot.data.store = usePadPlay
  import.meta.hot.data.led = L.ledOn
  import.meta.hot.data.st = L
  import.meta.hot.data.off = hot.off
  import.meta.hot.dispose(() => { if (timer) clearInterval(timer); import.meta.hot!.data.timer = 0 })
  import.meta.hot.accept()
}
