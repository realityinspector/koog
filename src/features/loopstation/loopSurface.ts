// The Loop page of the DJ controller: 🎧 DJ <-> 🎛️ Synth <-> 🔁 Loop. Device role 'loop' routes the Mixtrack here (devices.ts onLoopMessage).
// With no hardware, the on-screen drawn controller (loopInput) does the same job. LEDs follow the layers (blink <= 2 Hz, respects ledOff).
//
//   pads A1-A4 = layers 1-4, B1-B4 = layers 5-8   tap: record -> play -> overdub -> play (a stopped layer restarts)
//   PAD MODE (A or B)  cycles what the pads do: REC (the cycle) -> MUTE -> SOLO
//   hold a pad + CUE (or CUE then pad) = clear that layer          PLAY = start / stop everything
//   CUE A = undo (selected layer)      CUE B = redo        SYNC = tap tempo
//   VOL A = selected layer volume      VOL B = loop master volume       TEMPO A fader = bpm
//   CROSSFADER = blend layers 1-4 against 5-8 (centre: both full)
//   JOG A = select layer               JOG B = fine bpm
//   deck A knobs HI/MID/LOW = selected layer TRANSPOSE / GATE (note length) / NUDGE (timing)
//   deck B knobs HI/MID/LOW = loop BARS (1/2/4/8) / COUNT-IN (0/1/2 bars) / QUANTISE (off, 1/8, 1/16)
// Faders and knobs use soft takeover (the real control must reach the value first); the drawn picture shows a dotted marker.
import { useEffect } from 'react'
import { create } from 'zustand'
import { onLoopMessage, onRoleChange, sendToDj, setRole, useDevices } from '../../music/devices'
import { decode, ledBytes } from '../dj/map'
import { resyncLeds } from '../dj/engine'
import { setScreenMode } from '../controller/surface'
import { beatPos, getBpm, setBpm, tapTempo, useMaster } from '../../music/masterClock'
import { LAYERS, LEN_CHOICES, clearLayer, padAction, togglePlay, redo, select, setLayerParam, setLayerVol, setLenBars, setOpt, undo, useLoop, getSel } from './loopEngine'

export type Page = 'dj' | 'synth' | 'loop'
interface PageState { screenOn: boolean; roleOn: boolean; on: boolean; lit: Record<string, boolean>; values: Record<string, number>; ghost: Record<string, number>; touched: Record<string, number>; last: string }
type Hot = { store?: ReturnType<typeof make>; led?: Record<string, boolean>; off?: () => void; timer?: number }
const hot = (import.meta.hot?.data ?? {}) as Hot
function make() { return create<PageState>()(() => ({ screenOn: false, roleOn: false, on: false, lit: {}, values: {}, ghost: {}, touched: {}, last: '' })) }
export const useLoopPage = hot.store ?? make()
const ledState: Record<string, boolean> = hot.led ?? {}
const get = () => useLoopPage.getState()

const LED_IDS = [...Array.from({ length: LAYERS }, (_, i) => padId(i)), 'play.A', 'play.B', 'cue.A', 'cue.B', 'sync.A', 'sync.B', 'padmode.A', 'padmode.B']
function padId(i: number) { return `pad${(i % 4) + 1}.${i < 4 ? 'A' : 'B'}` }
export const padLayer = (id: string): number => { const m = /^pad([1-4])\.([AB])$/.exec(id); return m ? Number(m[1]) - 1 + (m[2] === 'B' ? 4 : 0) : -1 }

export const LOOP_LABELS: Record<string, string> = {
  'pad1.A': '1', 'pad2.A': '2', 'pad3.A': '3', 'pad4.A': '4', 'pad1.B': '5', 'pad2.B': '6', 'pad3.B': '7', 'pad4.B': '8',
  'play.A': 'ALL', 'play.B': 'ALL', 'cue.A': 'UNDO', 'cue.B': 'REDO', 'sync.A': 'TAP', 'sync.B': 'TAP',
  'vol.A': 'LAYER', 'vol.B': 'MAIN', 'tempo.A': 'BPM', xfade: '1-4 / 5-8', 'jog.A': 'SEL', 'jog.B': 'BPM',
  'hi.A': 'TRANS', 'mid.A': 'GATE', 'low.A': 'NUDGE', 'hi.B': 'BARS', 'mid.B': 'COUNT', 'low.B': 'QUANT',
}

// ---------- soft takeover ----------
const pick: Record<string, { engaged: boolean; last?: number }> = {}
let lastSel = -1
function absolute(id: string, v: number, cur: number, apply: (v: number) => void) {
  const st = (pick[id] ??= { engaged: false })
  if (!st.engaged && (Math.abs(v - cur) <= 0.05 || (st.last !== undefined && (st.last - cur) * (v - cur) <= 0))) st.engaged = true
  st.last = v
  useLoopPage.setState((s) => ({ ghost: { ...s.ghost, [id]: v }, touched: { ...s.touched } }))
  if (st.engaged) { useLoopPage.setState((s) => { const g = { ...s.ghost }; delete g[id]; return { ghost: g } }); apply(v) }
}

// ---------- input ----------
const held = new Set<number>()
const cueDown = { A: false, B: false }, cueUsed = { A: false, B: false }
const jogAcc = { A: 0, B: 0 }
const FN: ('rec' | 'mute' | 'solo')[] = ['rec', 'mute', 'solo']
/** One control moved (hardware or the picture). Buttons/pads: 1 down, 0 up. Sliders 0..1. Jogs: signed ticks. id like "pad1.A", "xfade". */
export function loopInput(id: string, value: number) {
  const now = performance.now()
  useLoopPage.setState((s) => ({ touched: { ...s.touched, [id]: now } }))
  const [base, d] = id.split('.'), deck = (d === 'B' ? 'B' : 'A') as 'A' | 'B'
  const L = useLoop.getState()
  if (getSel() !== lastSel) { lastSel = getSel(); for (const k of Object.keys(pick)) delete pick[k] }
  const sel = getSel(), layer = L.layers[sel]
  switch (base) {
    case 'pad1': case 'pad2': case 'pad3': case 'pad4': {
      const i = padLayer(id)
      if (value > 0) {
        held.add(i); select(i)
        if (cueDown.A || cueDown.B) { clearLayer(i); cueUsed.A = cueUsed.B = true; note(`Layer ${i + 1} cleared`) }
        else padAction(i)
      } else held.delete(i)
      break
    }
    case 'cue':
      if (value > 0) {
        cueDown[deck] = true; cueUsed[deck] = false
        if (held.size) { for (const i of held) { clearLayer(i); note(`Layer ${i + 1} cleared`) } cueUsed[deck] = true }
      } else {
        cueDown[deck] = false
        if (!cueUsed[deck]) { if (deck === 'A') { undo(); note(`Undo layer ${sel + 1}`) } else { redo(); note(`Redo layer ${sel + 1}`) } }
      }
      break
    case 'play': if (value > 0) togglePlay(); break
    case 'sync': if (value > 0) { tapTempo(); note(`Tap tempo ${Math.round(getBpm())} bpm`) } break
    case 'padmode': if (value > 0) { const f = FN[(FN.indexOf(L.fn) + 1) % FN.length]; setOpt('fn', f); note(`Pads: ${f.toUpperCase()}`) } break
    case 'jog': {
      jogAcc[deck] += value
      if (deck === 'A') { if (Math.abs(jogAcc.A) >= 3) { select(Math.max(0, Math.min(LAYERS - 1, sel + Math.sign(jogAcc.A)))); jogAcc.A = 0 } }
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
        if (base === 'hi') absolute(id, value, (layer.transpose + 12) / 24, (v) => setLayerParam(sel, 'transpose', v * 24 - 12))
        else if (base === 'mid') absolute(id, value, (layer.gate - 0.25) / 1.5, (v) => setLayerParam(sel, 'gate', 0.25 + v * 1.5))
        else absolute(id, value, layer.nudge + 0.5, (v) => setLayerParam(sel, 'nudge', Math.round((v - 0.5) * 32) / 32))
      } else if (base === 'hi') absolute(id, value, Math.max(0, LEN_CHOICES.indexOf(L.lenBars)) / 3, (v) => setLenBars(LEN_CHOICES[Math.round(v * 3)]))
      else if (base === 'mid') absolute(id, value, L.countIn / 2, (v) => setOpt('countIn', Math.round(v * 2)))
      else absolute(id, value, [0, 0.5, 0.25].indexOf(L.quant) / 2, (v) => setOpt('quant', [0, 0.5, 0.25][Math.round(v * 2)]))
      break
    }
  }
  schedView()
}
function note(s: string) { useLoopPage.setState({ last: s }) }

// ---------- view model + LEDs ----------
const blink = (now: number, periodMs: number) => Math.floor(now / (periodMs / 2)) % 2 === 0
export function ledMap(now = performance.now()): Record<string, boolean> {
  const L = useLoop.getState(), out: Record<string, boolean> = {}
  const solo = L.layers.some((l) => l.solo)
  L.layers.forEach((l, i) => {
    let on = false
    if (l.state === 'rec') on = blink(now, 500)
    else if (l.state === 'over') on = blink(now, 1000)
    else if (l.state === 'play') on = l.mute || (solo && !l.solo) ? blink(now, 2000) : true
    else if (l.state === 'stop') on = blink(now, 2000)
    out[padId(i)] = on
  })
  const sel = L.layers[L.sel]
  out['play.A'] = out['play.B'] = L.running
  out['cue.A'] = !!sel && (sel.takes.length > 0 || sel.state === 'rec' || sel.state === 'over')
  out['cue.B'] = !!sel && sel.redo.length > 0
  out['padmode.A'] = out['padmode.B'] = L.fn !== 'rec'
  const flash = L.running && ((beatPos() % 4) + 4) % 4 < 0.3
  out['sync.A'] = out['sync.B'] = flash
  return out
}
function values(): Record<string, number> {
  const L = useLoop.getState(), sel = L.layers[L.sel], v: Record<string, number> = {}
  const lit = ledMap()
  for (const id of LED_IDS) v[id] = lit[id] ? 1 : 0
  v['vol.A'] = sel.vol; v['vol.B'] = L.master; v['tempo.A'] = (getBpm() - 60) / 120; v.xfade = L.xf
  v['hi.A'] = (sel.transpose + 12) / 24; v['mid.A'] = (sel.gate - 0.25) / 1.5; v['low.A'] = sel.nudge + 0.5
  v['hi.B'] = Math.max(0, LEN_CHOICES.indexOf(L.lenBars)) / 3; v['mid.B'] = L.countIn / 2; v['low.B'] = [0, 0.5, 0.25].indexOf(L.quant) / 2
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
const isCtl = (r: string) => r === 'dj' || r === 'surface' || r === 'loop'
export const currentPage = (surfaceOn: boolean, loopOn: boolean): Page => (loopOn ? 'loop' : surfaceOn ? 'synth' : 'dj')
/** switch every connected DJ controller (or the on-screen picture, with no hardware) to a page */
export function setControllerPage(p: Page) {
  const devs = useDevices.getState().devices.filter((d) => isCtl(d.role))
  useLoopPage.setState({ screenOn: false })
  if (!devs.length) {
    setScreenMode(p === 'synth')
    if (p === 'loop') useLoopPage.setState({ screenOn: true })
    apply(); return
  }
  setScreenMode(false)
  const role = p === 'dj' ? 'dj' : p === 'synth' ? 'surface' : 'loop'
  for (const d of devs) setRole(d.name, role)
  apply()
}

function init() {
  hot.off?.()
  const offs = [
    onLoopMessage((data) => { const a = decode(data); if (!a || a.fine || a.id === 'jogtouch') return; loopInput(a.deck ? `${a.id}.${a.deck}` : a.id, a.value) }),
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
