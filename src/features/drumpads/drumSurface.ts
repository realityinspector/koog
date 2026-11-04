// The Drums page of the DJ controller: 🎧 DJ <-> 🎛️ Synth <-> 🔁 Loop <-> 🥁 Drums. Device role 'drums' routes the Mixtrack here (devices.ts onDrumsMessage).
// With no hardware, the on-screen drawn controller (drumInput) does the same job. Modelled on loopSurface.ts.
//
//   the 8 pads (A1-A4, B1-B4) = KICK SNARE HAT OPEN / CLAP LO-TOM HI-TOM RIM. Tap = hear it now. Velocity follows how hard the pad is hit.
//       hold a pad 1 s while stopped = clear that drum's row     hold CUE + tap a pad = clear that drum's row
//       note repeat (knob LOW B) keeps hitting on the 1/8 or 1/16 grid while a pad is held
//   PLAY = start / stop the pattern (hold 2 s = clear the whole pattern)
//   CUE  = RECORD on / off (while playing, hits are written to the nearest 16th); hold CUE 0.7 s = undo the last recording pass
//   SYNC = tap tempo     PAD MODE = next drum kit     TEMPO fader = bpm
//   VOL A = drum volume   VOL B = pattern level (how loud the loop plays against your live hits)
//   JOG A = swing (0-60%)    JOG B = fine bpm
//   deck A knobs HI / MID / LOW = PITCH / DECAY / TONE of the drum you hit last
//   deck B knobs HI / MID / LOW = KIT / BARS (1 or 2) / ROLL (note repeat: off, 1/8, 1/16)
// Faders and knobs use soft takeover (the real control must reach the value first); the drawn picture shows a dotted marker.
// LEDs: a pad's light flashes when its drum sounds (at most ~3 times a second per pad, never a steady blink), PLAY = running, CUE = recording,
// SYNC = a short flash on the first beat of each bar. Respects ledOff from the map.
import { useEffect } from 'react'
import { create } from 'zustand'
import { onDrumsMessage, onRoleChange, sendToDj, useDevices } from '../../music/devices'
import { decode, ledBytes } from '../dj/map'
import { resyncLeds } from '../dj/engine'
import { beatPos, getBpm, setBpm, useMaster } from '../../music/masterClock'
import { CLEAR_ALL_MS, UNDO_HOLD_MS, VOICES, bpmOfFader, faderOfBpm, pick3, velocityOf } from './drumCore'
import {
  clearPattern, onDrumHit, padDown, padUp, releaseAllPads, setBars, setKit, setPatVol, setRepeat, setSwing, setTweak, setVol, tapDrumTempo, toggleRec, togglePlay, undoPass, useDrums,
} from './drumEngine'

interface PageState { screenOn: boolean; roleOn: boolean; on: boolean; lit: Record<string, boolean>; values: Record<string, number>; ghost: Record<string, number>; touched: Record<string, number> }
type Hot = { store?: ReturnType<typeof make>; led?: Record<string, boolean>; off?: () => void; timer?: number }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<PageState>()(() => ({ screenOn: false, roleOn: false, on: false, lit: {}, values: {}, ghost: {}, touched: {} })) }
export const useDrumPage = hot.store ?? make()
const ledState: Record<string, boolean> = hot.led ?? {}
const get = () => useDrumPage.getState()

/** pad order: A1 A2 A3 A4 B1 B2 B3 B4 = drums 0..7 */
const PADS = ['pad1.A', 'pad2.A', 'pad3.A', 'pad4.A', 'pad1.B', 'pad2.B', 'pad3.B', 'pad4.B']
const LED_IDS = [...PADS, 'play.A', 'play.B', 'cue.A', 'cue.B', 'sync.A', 'sync.B', 'padmode.A', 'padmode.B']
export const padVoice = (id: string) => PADS.indexOf(id)
export const voicePad = (v: number) => PADS[v]

export function drumLabels(): Record<string, string> {
  const L: Record<string, string> = {
    'play.A': 'PLAY', 'play.B': 'PLAY', 'cue.A': 'REC', 'cue.B': 'REC', 'sync.A': 'TAP', 'sync.B': 'TAP', 'padmode.A': 'KIT', 'padmode.B': 'KIT',
    'vol.A': 'VOL', 'vol.B': 'PATT', 'tempo.A': 'BPM', 'jog.A': 'SWING', 'jog.B': 'BPM',
    'hi.A': 'PITCH', 'mid.A': 'DECAY', 'low.A': 'TONE', 'hi.B': 'KIT', 'mid.B': 'BARS', 'low.B': 'ROLL',
  }
  PADS.forEach((id, i) => { L[id] = ['KICK', 'SNARE', 'HAT', 'OPEN', 'CLAP', 'LTOM', 'HTOM', 'RIM'][i] })
  return L
}

// ---------- soft takeover ----------
const pick: Record<string, { engaged: boolean; last?: number }> = {}
let lastVoiceSeen = -1
function absolute(id: string, v: number, cur: number, apply: (v: number) => void) {
  const st = (pick[id] ??= { engaged: false })
  if (!st.engaged && (Math.abs(v - cur) <= 0.05 || (st.last !== undefined && (st.last - cur) * (v - cur) <= 0))) st.engaged = true
  st.last = v
  if (st.engaged) { useDrumPage.setState((s) => { const g = { ...s.ghost }; delete g[id]; return { ghost: g } }); apply(v) }
  else useDrumPage.setState((s) => ({ ghost: { ...s.ghost, [id]: v } }))
}

// ---------- input ----------
const hold: Record<string, { fired: boolean; timer: number }> = {}
const cueHeld: Record<string, { used: boolean }> = {}
const anyCue = () => Object.keys(cueHeld).length > 0
const jogAcc = { A: 0, B: 0 }
/** One control moved (hardware or the picture). Buttons/pads: 1 down, 0 up. Sliders 0..1. Jogs: signed ticks. `vel` = MIDI velocity of a pad hit (0-127). id like "pad1.A". */
export function drumInput(id: string, value: number, vel?: number) {
  const now = performance.now()
  useDrumPage.setState((s) => ({ touched: { ...s.touched, [id]: now } }))
  const [base, d] = id.split('.'), deck = (d === 'B' ? 'B' : 'A') as 'A' | 'B'
  const D = useDrums.getState()
  if (D.lastVoice !== lastVoiceSeen) { lastVoiceSeen = D.lastVoice; for (const k of ['hi.A', 'mid.A', 'low.A']) delete pick[k] }
  const tw = D.tweak[D.lastVoice]
  switch (base) {
    case 'pad1': case 'pad2': case 'pad3': case 'pad4': {
      const v = padVoice(id); if (v < 0) break
      if (value > 0) { const c = Object.values(cueHeld)[0]; if (c) c.used = true; padDown(v, velocityOf(vel), !!c) } else padUp(v)
      break
    }
    case 'play': {
      const k = 'play.' + deck
      if (value > 0) {
        const h: { fired: boolean; timer: number } = (hold[k] = { fired: false, timer: 0 })
        h.timer = window.setTimeout(() => { if (hold[k] === h && !h.fired) { h.fired = true; clearPattern() } }, CLEAR_ALL_MS)
      } else { const h = hold[k]; delete hold[k]; if (h) { clearTimeout(h.timer); if (!h.fired) togglePlay() } }
      break
    }
    case 'cue': {
      const k = 'cue.' + deck
      if (value > 0) {
        const c: { used: boolean } = (cueHeld[k] = { used: false })
        const h: { fired: boolean; timer: number } = (hold[k] = { fired: false, timer: 0 })
        h.timer = window.setTimeout(() => { if (hold[k] === h && !h.fired && !c.used) { h.fired = true; c.used = true; undoPass() } }, UNDO_HOLD_MS)
      } else { const c = cueHeld[k], h = hold[k]; delete cueHeld[k]; delete hold[k]; if (h) clearTimeout(h.timer); if (c && !c.used) toggleRec() }
      break
    }
    case 'sync': if (value > 0) tapDrumTempo(); break
    case 'padmode': if (value > 0) setKit((D.kit + 1) % 3); break
    case 'jog': {
      jogAcc[deck] += value
      if (deck === 'A') setSwing(D.swing + value * 0.01)
      else setBpm(getBpm() + value * 0.5)
      break
    }
    case 'vol': if (deck === 'A') absolute(id, value, D.vol, setVol); else absolute(id, value, D.patVol, setPatVol); break
    case 'tempo': if (deck === 'A') absolute(id, value, faderOfBpm(getBpm()), (v) => setBpm(bpmOfFader(v))); break
    case 'hi': case 'mid': case 'low': {
      if (deck === 'A') {
        const vo = D.lastVoice
        if (base === 'hi') absolute(id, value, (tw.pitch + 1) / 2, (v) => setTweak(vo, { pitch: Math.abs(v - 0.5) < 0.03 ? 0 : v * 2 - 1 }))
        else if (base === 'mid') absolute(id, value, tw.decay, (v) => setTweak(vo, { decay: Math.abs(v - 0.5) < 0.03 ? 0.5 : v }))
        else absolute(id, value, tw.tone, (v) => setTweak(vo, { tone: v > 0.96 ? 1 : v }))
      } else if (base === 'hi') absolute(id, value, D.kit / 2, (v) => setKit(Math.round(v * 2)))
      else if (base === 'mid') absolute(id, value, D.pat.len === 32 ? 1 : 0, (v) => setBars(v > 0.5 ? 2 : 1))
      else absolute(id, value, D.repeat / 2, (v) => setRepeat(pick3(v)))
      break
    }
  }
  schedView()
}

// ---------- LEDs and the view model ----------
// A pad's light flashes 130 ms when its drum sounds, and only if its last flash began >= 340 ms ago: that caps every pad at < 3 flashes a second
// (photosensitivity) however fast the pattern plays. A pad that is held down stays steadily lit.
const FLASH_MS = 130, MIN_GAP_MS = 340
const flash: { on: number; off: number }[] = VOICES.map(() => ({ on: -1e9, off: -1e9 }))
function noteHit(voice: number, at: number) {
  const f = flash[voice]
  if (at - f.on < MIN_GAP_MS) return
  f.on = at; f.off = at + FLASH_MS
}
export function ledMap(now = performance.now()): Record<string, boolean> {
  const D = useDrums.getState(), out: Record<string, boolean> = {}
  PADS.forEach((id, i) => { out[id] = D.held[i] || (now >= flash[i].on && now < flash[i].off) })
  out['play.A'] = out['play.B'] = D.running
  out['cue.A'] = out['cue.B'] = D.rec
  out['padmode.A'] = out['padmode.B'] = false
  const bar = D.running && ((beatPos(now) % 4) + 4) % 4 < 0.25
  out['sync.A'] = out['sync.B'] = bar
  return out
}
function values(): Record<string, number> {
  const D = useDrums.getState(), tw = D.tweak[D.lastVoice], v: Record<string, number> = {}
  const lit = ledMap()
  for (const id of LED_IDS) v[id] = lit[id] ? 1 : 0
  v['vol.A'] = D.vol; v['vol.B'] = D.patVol; v['tempo.A'] = faderOfBpm(getBpm())
  v['hi.A'] = (tw.pitch + 1) / 2; v['mid.A'] = tw.decay; v['low.A'] = tw.tone
  v['hi.B'] = D.kit / 2; v['mid.B'] = D.pat.len === 32 ? 1 : 0; v['low.B'] = D.repeat / 2
  return v
}
let viewTimer = 0
function schedView() { if (!viewTimer) viewTimer = window.setTimeout(() => { viewTimer = 0; useDrumPage.setState({ values: values(), lit: ledMap() }) }, 40) }
function syncLeds() {
  if (!get().on) return
  const want = ledMap()
  for (const id of LED_IDS) {
    const on = !!want[id]
    if ((ledState[id] ?? false) === on) continue
    ledState[id] = on
    const b = ledBytes(id, on)
    if (b) sendToDj(b)
  }
}
function ledsDark() {
  for (const id of Object.keys(ledState)) { if (ledState[id]) { const b = ledBytes(id, false); if (b) sendToDj(b) } delete ledState[id] }
}
let users = 0
let timer = hot.timer ?? 0
function tickView() { useDrumPage.setState({ values: values(), lit: ledMap() }); syncLeds() }
function ensureTimer() {
  const need = get().on || users > 0
  if (need && !timer) timer = window.setInterval(tickView, 60)
  else if (!need && timer) { clearInterval(timer); timer = 0 }
}
/** the drawn controller (and anything else showing the drums page) calls this while mounted so the picture stays live */
export function useDrumView() {
  useEffect(() => { users++; ensureTimer(); schedView(); return () => { users--; ensureTimer() } }, [])
  return useDrumPage()
}

// ---------- page switching ----------
/** recompute whether the page is on (screen mode or a device with the drums role) and light / darken the controller. Called by setControllerPage too. */
export function refreshDrumPage() {
  const was = get().on, on = get().screenOn || get().roleOn
  if (on === was) return
  useDrumPage.setState({ on })
  if (on) { for (const id of LED_IDS) { const b = ledBytes(id, false); if (b) sendToDj(b) } tickView() }
  else { ledsDark(); resyncLeds(); releaseAllPads(); for (const k of Object.keys(hold)) { clearTimeout(hold[k].timer); delete hold[k] }; for (const k of Object.keys(cueHeld)) delete cueHeld[k] }
  ensureTimer()
}
/** the on-screen (no hardware) drums page */
export function setDrumScreen(on: boolean) { useDrumPage.setState({ screenOn: on }) }
const anyDrumsDevice = () => useDevices.getState().devices.some((d) => d.connected && d.role === 'drums')

function init() {
  hot.off?.()
  const offs = [
    onDrumsMessage((data) => {
      const a = decode(data); if (!a || a.fine || a.id === 'jogtouch') return
      const vel = (data[0] & 0xf0) === 0x90 ? data[2] : undefined
      drumInput(a.deck ? `${a.id}.${a.deck}` : a.id, a.value, vel)
    }),
    onRoleChange((_n, role) => { useDrumPage.setState({ roleOn: role === 'drums' ? true : anyDrumsDevice() }); refreshDrumPage() }),
    useDevices.subscribe(() => { const r = anyDrumsDevice(); if (r !== get().roleOn) { useDrumPage.setState({ roleOn: r }); refreshDrumPage() } }),
    onDrumHit((h) => { noteHit(h.voice, h.at) }),
    useDrums.subscribe(() => schedView()),
    useMaster.subscribe(() => schedView()),
  ]
  hot.off = () => { for (const f of offs) f() }
  if (anyDrumsDevice()) { useDrumPage.setState({ roleOn: true }); refreshDrumPage() }
  ensureTimer()
}
init()

if (import.meta.hot) {
  import.meta.hot.data.store = useDrumPage
  import.meta.hot.data.led = ledState
  import.meta.hot.data.off = hot.off
  import.meta.hot.dispose(() => { if (timer) clearInterval(timer); import.meta.hot!.data.timer = 0; if (viewTimer) clearTimeout(viewTimer) })
  import.meta.hot.accept()
}
