// The Loop page of the DJ controller: 🎧 DJ <-> 🎛️ Synth <-> 🔁 Loop. Device role 'loop' routes the Mixtrack here (devices.ts onLoopMessage).
// With no hardware, the on-screen drawn controller (loopInput) does the same job. LEDs follow the track rings (blink <= 2 Hz, respects ledOff).
//
//   pads A1-A4, B1 = tracks 1-5 (PAD MODE flips to the second bank: A1-A3 = tracks 6-8). Same gestures as the screen buttons:
//       tap = REC -> PLAY/DUB -> DUB/PLAY     double-tap = STOP     hold 2 s = UNDO (again: REDO)     hold while stopped = CLEAR
//   pads B2 / B3 / B4 = REVERSE / SPEED (1x, 1/2, 2x) / ONE-SHOT of the selected track
//   PLAY = ALL START / STOP        CUE (either deck) = UNDO, hold = REDO        SYNC = tap tempo
//   VOL A = selected track level   VOL B = loop main volume   TEMPO A fader = bpm   CROSSFADER = blend tracks 1-4 / 5-8
//   JOG A = select track           JOG B = fine bpm
//   deck A knobs HI / MID / LOW = selected track TRANSPOSE (-12 / 0 / +12) / FILTER sweep / STUTTER (off, 1/8, 1/16)
//   deck B knobs HI / MID / LOW = loop BARS (1/2/4/8) / COUNT-IN (0/1/2 bars) / QUANTISE (off, 1/8, 1/16)
// Faders and knobs use soft takeover (the real control must reach the value first); the drawn picture shows a dotted marker.
import { useEffect } from 'react'
import { create } from 'zustand'
import { onLoopMessage, onRoleChange, sendToDj, setRole, useDevices } from '../../music/devices'
import { decode, ledBytes } from '../dj/map'
import { resyncLeds } from '../dj/engine'
import { setScreenMode } from '../controller/surface'
import { beatPos, getBpm, setBpm, tapTempo, useMaster } from '../../music/masterClock'
import { refreshDrumPage, setDrumScreen } from '../drumpads/drumSurface'
import { usePedal } from '../pedal/pedal'
import { LEN_CHOICES, isLooperOpen, buttonDown, buttonUp, getSel, redo, select, setLayerOpt, setLayerParam, setLayerVol, setLenBars, setOpt, togglePlay, undo, useLoop } from './loopEngine'

export type Page = 'dj' | 'synth' | 'loop' | 'drums'
interface PageState { screenOn: boolean; roleOn: boolean; on: boolean; bank: 0 | 1; lit: Record<string, boolean>; values: Record<string, number>; ghost: Record<string, number>; touched: Record<string, number>; last: string }
type Hot = { store?: ReturnType<typeof make>; led?: Record<string, boolean>; off?: () => void; timer?: number }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<PageState>()(() => ({ screenOn: false, roleOn: false, on: false, bank: 0, lit: {}, values: {}, ghost: {}, touched: {}, last: '' })) }
export const useLoopPage = hot.store ?? make()
const ledState: Record<string, boolean> = hot.led ?? {}
const get = () => useLoopPage.getState()

/** pad order: A1 A2 A3 A4 B1 B2 B3 B4 = 0..7 */
const PADS = ['pad1.A', 'pad2.A', 'pad3.A', 'pad4.A', 'pad1.B', 'pad2.B', 'pad3.B', 'pad4.B']
const LED_IDS = [...PADS, 'play.A', 'play.B', 'cue.A', 'cue.B', 'sync.A', 'sync.B', 'padmode.A', 'padmode.B']
/** the track a pad plays in this bank, or -1 (the specials and unused pads) */
export const padTrack = (id: string, bank = get().bank): number => {
  const k = PADS.indexOf(id)
  if (k < 0) return -1
  if (bank === 0) return k < 5 ? k : -1
  return k < 3 ? 5 + k : -1
}
const trackPad = (t: number, bank = get().bank) => (bank === 0 ? (t < 5 ? PADS[t] : null) : t >= 5 ? PADS[t - 5] : null)

export function loopLabels(): Record<string, string> {
  const b = get().bank
  const L: Record<string, string> = {
    'play.A': 'ALL', 'play.B': 'ALL', 'cue.A': 'UNDO', 'cue.B': 'UNDO', 'sync.A': 'TAP', 'sync.B': 'TAP', 'padmode.A': 'BANK ' + (b + 1), 'padmode.B': 'BANK ' + (b + 1),
    'vol.A': 'TRACK', 'vol.B': 'MAIN', 'tempo.A': 'BPM', xfade: '1-4 / 5-8', 'jog.A': 'SEL', 'jog.B': 'BPM',
    'hi.A': 'TRANS', 'mid.A': 'FILT', 'low.A': 'ROLL', 'hi.B': 'BARS', 'mid.B': 'COUNT', 'low.B': 'QUANT',
    'pad2.B': 'REV', 'pad3.B': 'SPD', 'pad4.B': '1SHOT',
  }
  for (const id of PADS) { const t = padTrack(id, b); if (t >= 0) L[id] = String(t + 1) }
  return L
}

// ---------- soft takeover ----------
const pick: Record<string, { engaged: boolean; last?: number }> = {}
let lastSel = -1
function absolute(id: string, v: number, cur: number, apply: (v: number) => void) {
  const st = (pick[id] ??= { engaged: false })
  if (!st.engaged && (Math.abs(v - cur) <= 0.05 || (st.last !== undefined && (st.last - cur) * (v - cur) <= 0))) st.engaged = true
  st.last = v
  if (st.engaged) { useLoopPage.setState((s) => { const g = { ...s.ghost }; delete g[id]; return { ghost: g } }); apply(v) }
  else useLoopPage.setState((s) => ({ ghost: { ...s.ghost, [id]: v } }))
}

// ---------- input ----------
const jogAcc = { A: 0, B: 0 }
const cueHold: Record<string, { t: number; fired: boolean }> = {} // eslint-disable-line
const CUE_HOLD_MS = 700
const STEP = [0, 0.5, 0.25] as const
/** One control moved (hardware or the picture). Buttons/pads: 1 down, 0 up. Sliders 0..1. Jogs: signed ticks. id like "pad1.A", "xfade". */
// A CC flood (jog wheel, faders: 200 messages a second) used to commit React once per message. The "touched" glow is only
// read at 600 ms resolution, so collect the ids and publish them once per animation frame (a timer covers a hidden tab).
const pendTouch: Record<string, number> = {}
let touchRaf = 0, touchTimer = 0
function flushTouch() {
  cancelAnimationFrame(touchRaf); clearTimeout(touchTimer); touchRaf = 0; touchTimer = 0
  const add = { ...pendTouch }
  for (const k of Object.keys(pendTouch)) delete pendTouch[k]
  if (Object.keys(add).length) useLoopPage.setState((s) => ({ touched: { ...s.touched, ...add } }))
}
function touchSoon(id: string, now: number) {
  pendTouch[id] = now
  if (!touchRaf) { touchRaf = requestAnimationFrame(flushTouch); touchTimer = window.setTimeout(flushTouch, 100) }
}

export function loopInput(id: string, value: number) {
  const now = performance.now()
  touchSoon(id, now)
  const [base, d] = id.split('.'), deck = (d === 'B' ? 'B' : 'A') as 'A' | 'B'
  const L = useLoop.getState()
  if (getSel() !== lastSel) { lastSel = getSel(); for (const k of Object.keys(pick)) delete pick[k] }
  const sel = getSel(), layer = L.layers[sel]
  switch (base) {
    case 'pad1': case 'pad2': case 'pad3': case 'pad4': {
      const t = padTrack(id)
      if (t >= 0) { if (value > 0) buttonDown(t); else buttonUp(t); break }
      if (value <= 0) break
      if (id === 'pad2.B') { setLayerOpt(sel, 'reverse', !layer.reverse); note(`Track ${sel + 1} reverse ${!layer.reverse ? 'on' : 'off'}`) }
      else if (id === 'pad3.B') { const sp = layer.speed === 1 ? 0.5 : layer.speed === 0.5 ? 2 : 1; setLayerOpt(sel, 'speed', sp); note(`Track ${sel + 1} speed ${sp === 1 ? '1x' : sp === 0.5 ? 'half' : 'double'}`) }
      else if (id === 'pad4.B') { setLayerOpt(sel, 'oneShot', !layer.oneShot); note(`Track ${sel + 1} one-shot ${!layer.oneShot ? 'on' : 'off'}`) }
      break
    }
    case 'cue': { // tap = undo, hold = redo
      const k = 'cue.' + deck
      if (value > 0) {
        const h: { t: number; fired: boolean } = (cueHold[k] = { t: now, fired: false })
        window.setTimeout(() => { if (cueHold[k] === h && !h.fired) { h.fired = true; redo(); note(`Redo track ${getSel() + 1}`) } }, CUE_HOLD_MS)
      } else { const h = cueHold[k]; delete cueHold[k]; if (h && !h.fired) { undo(); note(`Undo track ${sel + 1}`) } }
      break
    }
    case 'play': if (value > 0) togglePlay(); break
    case 'sync': if (value > 0) { tapTempo(); note(`Tap tempo ${Math.round(getBpm())} bpm`) } break
    case 'padmode': if (value > 0) { const b = get().bank === 0 ? 1 : 0; useLoopPage.setState({ bank: b }); note(b === 0 ? 'Pads: tracks 1-5' : 'Pads: tracks 6-8') } break
    case 'jog': {
      jogAcc[deck] += value
      if (deck === 'A') { if (Math.abs(jogAcc.A) >= 3) { select(Math.max(0, Math.min(7, sel + Math.sign(jogAcc.A)))); jogAcc.A = 0 } }
      else { setBpm(getBpm() + value * 0.5); jogAcc.B = 0 }
      break
    }
    case 'vol':
      if (deck === 'A') absolute(id, value, layer.vol, (v) => setLayerVol(sel, v))
      else absolute(id, value, L.master, (v) => setOpt('master', v))
      break
    case 'tempo': if (deck === 'A') absolute(id, value, (getBpm() - 60) / 120, (v) => setBpm(60 + v * 120)); break
    case 'xfade': absolute(id, value, L.xf, (v) => setOpt('xf', v)); break
    case 'hi': case 'mid': case 'low': {
      if (deck === 'A') {
        if (base === 'hi') absolute(id, value, (layer.transpose + 12) / 24, (v) => setLayerParam(sel, 'transpose', v < 0.33 ? -12 : v > 0.66 ? 12 : 0))
        else if (base === 'mid') absolute(id, value, layer.fxFilter, (v) => setLayerOpt(sel, 'fxFilter', v < 0.04 ? 0 : v))
        else absolute(id, value, layer.fxStutter / 2, (v) => setLayerOpt(sel, 'fxStutter', Math.round(v * 2) as 0 | 1 | 2))
      } else if (base === 'hi') absolute(id, value, Math.max(0, LEN_CHOICES.indexOf(L.lenBars)) / 3, (v) => setLenBars(LEN_CHOICES[Math.round(v * 3)]))
      else if (base === 'mid') absolute(id, value, L.countIn / 2, (v) => setOpt('countIn', Math.round(v * 2)))
      else absolute(id, value, STEP.indexOf(L.quant as 0) / 2, (v) => setOpt('quant', STEP[Math.round(v * 2)]))
      break
    }
  }
  schedView()
}
function note(s: string) { useLoopPage.setState({ last: s }) }

// ---------- view model + LEDs ----------
const blink = (now: number, periodMs: number, duty = 0.5) => (now % periodMs) / periodMs < duty
export function ledMap(now = performance.now()): Record<string, boolean> {
  const L = useLoop.getState(), out: Record<string, boolean> = {}
  const solo = L.layers.some((l) => l.solo)
  for (const id of PADS) out[id] = false
  L.layers.forEach((l, i) => {
    const id = trackPad(i); if (!id) return
    let on = false
    if (l.pend) on = blink(now, 500, 0.25) // waiting for the bar line: quick short flicker
    else if (l.state === 'rec') on = blink(now, 500) // 2 Hz
    else if (l.state === 'over') on = blink(now, 1000) // 1 Hz
    else if (l.state === 'play') on = l.mute || (solo && !l.solo) ? blink(now, 2000, 0.25) : true
    else if (l.state === 'stop') on = blink(now, 2000, 0.25)
    out[id] = on
  })
  const sel = L.layers[L.sel]
  if (sel) { out['pad2.B'] = sel.reverse; out['pad3.B'] = sel.speed !== 1; out['pad4.B'] = sel.oneShot }
  out['play.A'] = out['play.B'] = L.running
  out['cue.A'] = !!sel && (sel.takes.length > 0 || sel.state === 'rec' || sel.state === 'over')
  out['cue.B'] = !!sel && sel.redo.length > 0
  out['padmode.A'] = out['padmode.B'] = get().bank === 1
  const flash = L.running && ((beatPos() % 4) + 4) % 4 < 0.3
  out['sync.A'] = out['sync.B'] = flash
  return out
}
function values(): Record<string, number> {
  const L = useLoop.getState(), sel = L.layers[L.sel], v: Record<string, number> = {}
  const lit = ledMap()
  for (const id of LED_IDS) v[id] = lit[id] ? 1 : 0
  v['vol.A'] = sel.vol; v['vol.B'] = L.master; v['tempo.A'] = (getBpm() - 60) / 120; v.xfade = L.xf
  v['hi.A'] = (sel.transpose + 12) / 24; v['mid.A'] = sel.fxFilter; v['low.A'] = sel.fxStutter / 2
  v['hi.B'] = Math.max(0, LEN_CHOICES.indexOf(L.lenBars)) / 3; v['mid.B'] = L.countIn / 2; v['low.B'] = STEP.indexOf(L.quant as 0) / 2
  return v
}
let viewTimer = 0
function schedView() { if (!viewTimer) viewTimer = window.setTimeout(() => { viewTimer = 0; useLoopPage.setState({ values: values(), lit: ledMap() }) }, 40) }
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
function tickView() { useLoopPage.setState({ values: values(), lit: ledMap() }); syncLeds() }
function ensureTimer() {
  const need = get().on || users > 0
  if (need && !timer) timer = window.setInterval(tickView, 125)
  else if (!need && timer) { clearInterval(timer); timer = 0 }
}
/** the drawn controller (and anything else showing the loop page) calls this while mounted so the picture stays live */
export function useLoopView() {
  useEffect(() => { users++; ensureTimer(); schedView(); return () => { users--; ensureTimer() } }, [])
  return useLoopPage()
}

// ---------- page switching ----------
function apply() {
  const was = get().on, on = get().screenOn || get().roleOn
  if (on === was) return
  useLoopPage.setState({ on })
  if (on) { for (const id of LED_IDS) { const b = ledBytes(id, false); if (b) sendToDj(b) } tickView() }
  else { ledsDark(); resyncLeds() }
  ensureTimer()
}
const isCtl = (r: string) => r === 'dj' || r === 'surface' || r === 'loop' || r === 'drums' || r === 'gamepads'
export const currentPage = (surfaceOn: boolean, loopOn: boolean, drumsOn = false): Page => (drumsOn ? 'drums' : loopOn ? 'loop' : surfaceOn ? 'synth' : 'dj')
/** switch every connected DJ controller (or the on-screen picture, with no hardware) to a page. The pages are mutually exclusive. */
export function setControllerPage(p: Page) {
  const devs = useDevices.getState().devices.filter((d) => isCtl(d.role))
  useLoopPage.setState({ screenOn: false })
  setDrumScreen(false)
  if (!devs.length) {
    setScreenMode(p === 'synth')
    if (p === 'loop') useLoopPage.setState({ screenOn: true })
    if (p === 'drums') setDrumScreen(true)
    // the page being left goes dark first, then the new one lights up (so the DJ LED resync never lands on top of the new page)
    if (p === 'drums') { apply(); refreshDrumPage() } else { refreshDrumPage(); apply() }
    return
  }
  setScreenMode(false)
  const role = p === 'dj' ? 'dj' : p === 'synth' ? 'surface' : p === 'drums' ? 'drums' : 'loop'
  for (const d of devs) setRole(d.name, role)
  if (p === 'drums') { apply(); refreshDrumPage() } else { refreshDrumPage(); apply() }
}

function init() {
  hot.off?.()
  const offs = [
    onLoopMessage((data) => { const a = decode(data); if (!a || a.fine || a.id === 'jogtouch') return; if (!isLooperOpen() && !usePedal.getState().loopAlways) return /* a controller left on the Loop page must not run a looper nobody can see */; loopInput(a.deck ? `${a.id}.${a.deck}` : a.id, a.value) }),
    onRoleChange((_n, role) => { useLoopPage.setState({ roleOn: role === 'loop' ? true : useDevices.getState().devices.some((d) => d.connected && d.role === 'loop') }); apply() }),
    useDevices.subscribe((st) => { const r = st.devices.some((d) => d.connected && d.role === 'loop'); if (r !== get().roleOn) { useLoopPage.setState({ roleOn: r }); apply() } }),
    useLoop.subscribe(() => schedView()),
    useMaster.subscribe(() => schedView()),
  ]
  hot.off = () => { for (const f of offs) f() }
  if (useDevices.getState().devices.some((d) => d.connected && d.role === 'loop')) { useLoopPage.setState({ roleOn: true }); apply() }
  ensureTimer()
}
init()

if (import.meta.hot) {
  import.meta.hot.data.store = useLoopPage
  import.meta.hot.data.led = ledState
  import.meta.hot.data.off = hot.off
  import.meta.hot.dispose(() => { if (timer) clearInterval(timer); import.meta.hot!.data.timer = 0; if (viewTimer) clearTimeout(viewTimer) })
  import.meta.hot.accept()
}
