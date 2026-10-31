// Calibration ("Teach Koog your controller") and the live knob check. No React in here.
//   Teach:  walks every control (both decks explicitly), learns the next note-on / the next CC that really moves (two moves),
//           warns about the same message on two controls, tests LEDs one button at a time, learns whether pad notes change by pad mode,
//           then saves ONE map per controller name (map.ts saveControllerMap) which the engine uses straight away.
//   Knob check: every control's live value, the raw last message, never-touched controls, and unknown messages with a one-click assign.
// While teaching, the controller is "deaf" to the decks (tap.ts) so pressing PLAY to teach it doesn't start the music.
import { create } from 'zustand'
import { onDjMessage, sendToDj, useDevices } from '../../music/devices'
import {
  activateControllerMap, currentMap, decode, describeKey, idsForKey, isFineControl, keyFor, loadControllerMaps, resetControllerMap, saveControllerMap,
  type ControllerMap,
} from './map'
import { onAction, setDeaf } from './tap'
import { resyncLeds } from './engine'

export type Kind = 'button' | 'jog' | 'slider' | 'knob'
export interface Step { id: string; base: string; deck: 'A' | 'B' | null; label: string; prompt: string; kind: Kind; optional: boolean }
export type Phase = 'intro' | 'learn' | 'padmode' | 'led' | 'review' | 'done'
export interface Raw { status: number; ch: number; num: number; val: number; text: string; id: string | null; t: number }
export interface Unknown { key: string; text: string; count: number; val: number; t: number }
export type Panel = 'none' | 'teach' | 'knob' | 'soundcheck'

const SIDE = { A: 'LEFT', B: 'RIGHT' } as const
const DECK_LIST: [string, string, Kind, boolean][] = [
  ['play', 'PLAY', 'button', false], ['cue', 'CUE', 'button', false], ['sync', 'SYNC', 'button', false], ['padmode', 'PAD MODE', 'button', false],
  ['pad1', 'PAD 1', 'button', false], ['pad2', 'PAD 2', 'button', false], ['pad3', 'PAD 3', 'button', false], ['pad4', 'PAD 4', 'button', false],
  ['jog', 'JOG WHEEL', 'jog', false], ['jogtouch', 'JOG TOUCH', 'button', true], ['vol', 'VOLUME', 'slider', false], ['tempo', 'TEMPO', 'slider', false],
  ['hi', 'HIGH (treble)', 'knob', true], ['mid', 'MID', 'knob', true], ['low', 'LOW (bass)', 'knob', true],
]
export const CTRL_LABEL: Record<string, string> = {}
function promptFor(kind: Kind, label: string, side: string | null, base: string) {
  const on = side ? ` on the ${side} deck` : ''
  if (base === 'jogtouch') return `Touch the top of the JOG WHEEL${on} (don't spin it)`
  if (kind === 'button') return `Press ${label}${on}`
  if (kind === 'jog') return `Spin the ${label}${on}`
  if (kind === 'slider') return `Slide the ${label} fader${on} up and down`
  return `Turn the ${label} knob${on}`
}
export function buildSteps(): Step[] {
  const out: Step[] = []
  for (const d of ['A', 'B'] as const) {
    for (const [base, label, kind, optional] of DECK_LIST) {
      const id = `${base}.${d}`
      const l = `${label} (${SIDE[d].toLowerCase()})`
      CTRL_LABEL[id] = l
      out.push({ id, base, deck: d, label: l, prompt: promptFor(kind, label, SIDE[d], base), kind, optional })
    }
  }
  CTRL_LABEL.xfade = 'CROSSFADER'; CTRL_LABEL.cuegain = 'HEADPHONE (cue gain)'
  out.push({ id: 'xfade', base: 'xfade', deck: null, label: 'CROSSFADER', prompt: 'Wiggle the CROSSFADER', kind: 'slider', optional: false })
  out.push({ id: 'cuegain', base: 'cuegain', deck: null, label: 'HEADPHONE (cue gain)', prompt: 'Turn the HEADPHONE (cue gain) knob', kind: 'knob', optional: true })
  return out
}
buildSteps()
export const labelOf = (id: string) => CTRL_LABEL[id] ?? id

interface CalState {
  panel: Panel
  device: string
  // teach
  phase: Phase; steps: Step[]; i: number; draft: Record<string, string>; skipped: string[]
  got: { key: string; text: string } | null; conflict: string | null; progress: number; heard: string
  ledQueue: string[]; ledI: number; ledAnswers: Record<string, boolean>
  padStage: 0 | 1 | 2; padStep: number | null; padNote: string
  savedMsg: string; exportText: string
  // knob check
  ctl: Record<string, { v: number; n: number; t: number }>; last: Raw | null; unknown: Unknown[]; checking: boolean
}
const initial = (): CalState => ({
  panel: 'none', device: '', phase: 'intro', steps: buildSteps(), i: 0, draft: {}, skipped: [], got: null, conflict: null, progress: 0, heard: '',
  ledQueue: [], ledI: 0, ledAnswers: {}, padStage: 0, padStep: null, padNote: '', savedMsg: '', exportText: '',
  ctl: {}, last: null, unknown: [], checking: false,
})
type Hot = { store?: ReturnType<typeof make>; det?: Det; timers?: Set<ReturnType<typeof setTimeout>>; blink?: { h: ReturnType<typeof setInterval> | null; cur: number[] | null }; seen?: Set<string> }
function make() { return create<CalState>()(() => initial()) }
const hot = (import.meta.hot?.data ?? {}) as Hot
export const useCal = hot.store ?? make()
const set = (p: Partial<CalState>) => useCal.setState(p)
const get = () => useCal.getState()

interface Det { key: string | null; count: number; anchor: number; settle: number; recent: Map<string, number> }
const det: Det = hot.det ?? { key: null, count: 0, anchor: 0, settle: 0, recent: new Map() }
const timers: Set<ReturnType<typeof setTimeout>> = hot.timers ?? new Set()
const blink = hot.blink ?? { h: null, cur: null }
const later = (fn: () => void, ms: number) => { const h = setTimeout(() => { timers.delete(h); fn() }, ms); timers.add(h); return h }
const resetDet = (settle = 350) => { det.key = null; det.count = 0; det.anchor = 0; det.settle = performance.now() + settle; det.recent.clear() }

// ---------- which controller ----------
export function deviceName(): string {
  const d = useDevices.getState().devices.find((x) => x.role === 'dj' && x.connected) ?? useDevices.getState().devices.find((x) => x.role === 'dj')
  return d?.name || get().device || 'Mixtrack Go'
}
export const hasSavedMap = (name = deviceName()) => !!loadControllerMaps()[name]
export const savedMap = (name = deviceName()): ControllerMap | undefined => loadControllerMaps()[name]

// ---------- panels ----------
export function openPanel(p: Panel) {
  closeLedBlink()
  if (p === 'teach') { setDeaf(true); set({ ...initial(), panel: 'teach', device: deviceName(), ctl: get().ctl }) }
  else {
    setDeaf(false)
    if (p === 'knob' || p === 'soundcheck') set({ panel: p, device: deviceName(), ctl: {}, last: null, unknown: [], checking: true, phase: 'intro' })
    else set({ panel: p, checking: false })
  }
}
export function closePanel() { closeLedBlink(); setDeaf(false); resyncLeds(); set({ panel: 'none', checking: false }) }

// ---------- teach: learning ----------
export function startLearn() {
  set({ phase: 'learn', i: 0, draft: {}, skipped: [], got: null, conflict: null, progress: 0, heard: '', ledAnswers: {}, padStep: null })
  resetDet()
}
export const currentStep = () => get().steps[get().i]
function conflictFor(step: Step, key: string): string | null {
  const draft = get().draft
  for (const [id, k] of Object.entries(draft)) {
    if (id !== step.id && k === key) return `${describeKey(key)} is already ${labelOf(id)}. Did you press the other deck's button?`
  }
  // the fine (LSB) twin of a learned fader, or this fader's own twin on another control
  const m = key.split(':')
  for (const [id, k] of Object.entries(draft)) {
    const b = id.split('.')[0]
    if (isFineControl(b) && k.startsWith('cc:') && `cc:${k.split(':')[1]}:${Number(k.split(':')[2]) + 32}` === key) return `${describeKey(key)} is the fine half of ${labelOf(id)}.`
  }
  if (isFineControl(step.base) && m[0] === 'cc') {
    const twin = `cc:${m[1]}:${Number(m[2]) + 32}`
    for (const [id, k] of Object.entries(draft)) if (id !== step.id && k === twin) return `${labelOf(id)} already uses ${describeKey(twin)}, the fine half of this fader.`
  }
  return null
}
function capture(step: Step, key: string) {
  const conflict = conflictFor(step, key)
  set({ got: { key, text: describeKey(key) }, conflict, progress: 1 })
  if (!conflict && step.kind === 'button') later(() => { const s = get(); if (s.phase === 'learn' && s.got?.key === key && s.steps[s.i] === step) commit() }, 900)
}
/** Feed one raw message to the learn detector. Exported so tests can drive it too. */
export function feedLearn(d: ArrayLike<number>) {
  const s = get()
  if (s.panel !== 'teach') return
  const st = d[0] ?? 0, a = d[1] ?? 0, v = d[2] ?? 0
  if (st >= 0xf0) return
  const type = st & 0xf0, ch = st & 0x0f
  const t = performance.now()
  if (s.phase === 'padmode') return feedPadMode(type, ch, a)
  if (s.phase !== 'learn' || t < det.settle) return
  const step = s.steps[s.i]
  if (!step || s.got) return
  if (type === 0x90 && v > 0) {
    if (step.kind === 'button') capture(step, `note:${ch}:${a}`)
    else set({ heard: `I heard a button (${describeKey(`note:${ch}:${a}`)}). Try the ${step.kind === 'jog' ? 'wheel' : 'control'} instead.` })
    return
  }
  if (type !== 0xb0 || step.kind === 'button') return
  const key = `cc:${ch}:${a}`
  // a CC that arrives right after CC-32 on the same channel is the fine half (LSB) of a 14-bit fader: ignore it
  const twin = det.recent.get(`cc:${ch}:${a - 32}`)
  det.recent.set(key, t)
  if (twin != null && t - twin < 150) return
  if (step.kind === 'jog') {
    const rel = v < 64 ? v : v - 128
    if (rel === 0 || Math.abs(rel) > 40) return
    if (det.key !== key) { det.key = key; det.count = 1 } else det.count++
    set({ progress: Math.min(1, det.count / 2), heard: `Heard ${describeKey(key)}…` })
    if (det.count >= 2) capture(step, key)
    return
  }
  if (det.key !== key) { det.key = key; det.anchor = v; det.count = 0; set({ progress: 0, heard: `Heard ${describeKey(key)}…` }); return }
  if (Math.abs(v - det.anchor) >= 3) { det.count++; det.anchor = v; set({ progress: Math.min(1, det.count / 2) }) }
  if (det.count >= 2) capture(step, key)
}
function advance() {
  const s = get()
  const next = s.i + 1
  if (next >= s.steps.length) { startPadMode(); return }
  set({ i: next, got: null, conflict: null, progress: 0, heard: '' })
  resetDet()
}
/** accept what was heard (also "use anyway" after a conflict warning) */
export function commit() {
  const s = get(), step = s.steps[s.i]
  if (!s.got || !step) return
  set({ draft: { ...s.draft, [step.id]: s.got.key } })
  advance()
}
export function redo() { set({ got: null, conflict: null, progress: 0, heard: '' }); resetDet(600) }
export function skip() {
  const s = get(), step = s.steps[s.i]
  if (step) set({ skipped: [...s.skipped, step.id] })
  advance()
}
export function goBack() { const s = get(); if (s.i > 0) { set({ i: s.i - 1, got: null, conflict: null, progress: 0, draft: Object.fromEntries(Object.entries(s.draft).filter(([k]) => k !== s.steps[s.i - 1].id)) }); resetDet() } }
export function finishLearning() { startPadMode() }

// ---------- teach: pad modes ----------
function startPadMode() {
  const pm = get().draft['padmode.A'] ?? keyFor('padmode.A')
  set({ phase: 'padmode', padStage: pm ? 1 : 1, padStep: null, padNote: '', got: null, conflict: null })
  resetDet()
}
function feedPadMode(type: number, ch: number, a: number) {
  const s = get()
  if (type !== 0x90 || s.padStage === 0) return
  const key = `note:${ch}:${a}`
  const pm = s.draft['padmode.A'] ?? keyFor('padmode.A')
  const pad1 = s.draft['pad1.A'] ?? keyFor('pad1.A')
  if (s.padStage === 1) { if (!pm || key === pm) set({ padStage: 2 }); else set({ padNote: 'Press PAD MODE first, then PAD 1.' }); return }
  if (!pad1) return set({ padStage: 0, padStep: 0, padNote: 'Pad 1 was skipped, so there is nothing to compare.' })
  const [, c1, n1] = pad1.split(':').map(Number)
  if (key === pad1) set({ padStage: 0, padStep: 0, padNote: 'Great: the pads send the same notes in every mode.' })
  else if (ch === c1) set({ padStage: 0, padStep: a - n1, padNote: `The pads move by ${a - n1} in each mode. Koog will follow them.` })
  else set({ padStage: 0, padStep: 0, padNote: `The pads change channel in other modes (${describeKey(key)}). Koog can't follow that yet.` })
}
export function finishPadMode() { startLed() }

// ---------- teach: LED test (one button at a time, slow: 1 blink a second) ----------
const LED_BASES = ['play', 'cue', 'sync', 'padmode', 'pad1', 'pad2', 'pad3', 'pad4']
export function ledMsgFor(id: string, on: boolean): number[] | null {
  const key = get().draft[id] ?? keyFor(id)
  if (!key || !key.startsWith('note:')) return null
  const [, ch, n] = key.split(':').map(Number)
  return [0x90 | ch, n, on ? 127 : 0]
}
function closeLedBlink() {
  if (blink.h) { clearInterval(blink.h); blink.h = null }
  if (blink.cur) { sendToDj([blink.cur[0], blink.cur[1], 0]); blink.cur = null }
}
function startLed() {
  closeLedBlink()
  const d = get().draft
  const ids = get().steps.map((s) => s.id).filter((id) => LED_BASES.includes(id.split('.')[0]) && (d[id] ?? keyFor(id)))
  set({ phase: 'led', ledQueue: ids, ledI: 0, ledAnswers: {} })
  blinkCurrent()
}
function blinkCurrent() {
  closeLedBlink()
  const s = get(), id = s.ledQueue[s.ledI]
  if (!id) return
  const on = ledMsgFor(id, true)
  if (!on) return
  blink.cur = on
  let lit = true
  sendToDj(on)
  blink.h = setInterval(() => { lit = !lit; sendToDj([on[0], on[1], lit ? 127 : 0]) }, 500) // 1 blink per second
}
export function answerLed(ok: boolean) {
  const s = get(), id = s.ledQueue[s.ledI]
  if (!id) return
  closeLedBlink()
  const ledAnswers = { ...s.ledAnswers, [id]: ok }
  if (s.ledI + 1 >= s.ledQueue.length) { set({ ledAnswers }); toReview() } else { set({ ledAnswers, ledI: s.ledI + 1 }); blinkCurrent() }
}
export function skipLedTest() { closeLedBlink(); toReview() }
export function replayLed() { blinkCurrent() }
function toReview() { closeLedBlink(); set({ phase: 'review' }) }

// ---------- teach: save / reset / export / import ----------
export function reviewSummary() {
  const s = get()
  const conflicts: string[] = []
  const seen = new Map<string, string>()
  for (const [id, k] of Object.entries(s.draft)) { const o = seen.get(k); if (o) conflicts.push(`${labelOf(o)} and ${labelOf(id)} share ${describeKey(k)}`); else seen.set(k, id) }
  return { learned: Object.keys(s.draft).length, skipped: s.skipped.length, conflicts, ledOff: Object.entries(s.ledAnswers).filter(([, ok]) => !ok).map(([id]) => id) }
}
export function save() {
  const s = get(), name = s.device || deviceName()
  const prev = loadControllerMaps()[name]
  const ledOff = [...new Set([...(prev?.ledOff ?? []).filter((id) => !(id in s.ledAnswers)), ...Object.entries(s.ledAnswers).filter(([, ok]) => !ok).map(([id]) => id)])]
  saveControllerMap(name, { learned: { ...(prev?.learned ?? {}), ...s.draft }, ledOff, padStep: s.padStep ?? prev?.padStep ?? 0, ledTested: Object.keys(s.ledAnswers).length > 0 || !!prev?.ledTested })
  resyncLeds()
  set({ phase: 'done', savedMsg: `Saved for ${name}!` })
}
export function resetDefaults() {
  const name = get().device || deviceName()
  resetControllerMap(name); resyncLeds()
  set({ savedMsg: 'Back to the built-in settings.', exportText: '' })
}
export function exportText(): string {
  const name = get().device || deviceName()
  const m = loadControllerMaps()[name] ?? { learned: currentMap() }
  return JSON.stringify({ koogController: name, learned: m.learned, ledOff: m.ledOff ?? [], padStep: m.padStep ?? 0 })
}
export function doExport() { set({ exportText: exportText() }) }
const KEY_RE = /^(note|cc):\d{1,2}:\d{1,3}$/
export function importText(text: string): string | null {
  try {
    const v = JSON.parse(text)
    if (!v || typeof v.learned !== 'object') return 'That text has no controller map in it.'
    const known = new Set(buildSteps().map((s) => s.id))
    const learned: Record<string, string> = {}
    for (const [id, k] of Object.entries(v.learned as Record<string, unknown>)) {
      if (!known.has(id) || typeof k !== 'string' || !KEY_RE.test(k)) return `I don't understand "${id}".`
      learned[id] = k
    }
    const name = get().device || deviceName()
    saveControllerMap(name, { learned, ledOff: Array.isArray(v.ledOff) ? v.ledOff.filter((x: unknown) => typeof x === 'string') : [], padStep: Number(v.padStep) || 0 })
    resyncLeds()
    set({ savedMsg: `Loaded ${Object.keys(learned).length} controls for ${name}.` })
    return null
  } catch { return 'That is not valid JSON text.' }
}

// ---------- knob check ----------
export function startKnobCheck() { openPanel('knob') }
export const testedCount = () => Object.keys(get().ctl).length
export function untested(): string[] {
  const ctl = get().ctl
  return Object.keys(currentMap()).filter((id) => !ctl[id])
}
/** assign an unknown message to a control: saved into this controller's map straight away */
export function assignUnknown(key: string, id: string) {
  const name = get().device || deviceName()
  const prev = loadControllerMaps()[name]
  const base = prev ?? { learned: { ...currentMap() } as Record<string, string> }
  saveControllerMap(name, { ...base, learned: { ...base.learned, [id]: key } })
  set({ unknown: get().unknown.filter((u) => u.key !== key) })
}
function rawFeed(data: Uint8Array) {
  const s = get()
  if (s.panel === 'none') return
  if (s.panel === 'teach') feedLearn(data)
  const st = data[0] ?? 0
  if (st >= 0xf0) return
  const type = st & 0xf0, ch = st & 0x0f, a = data[1] ?? 0, v = data[2] ?? 0
  if (type !== 0x90 && type !== 0x80 && type !== 0xb0) return
  const act = decode(data)
  const key = type === 0xb0 ? `cc:${ch}:${a}` : `note:${ch}:${a}`
  const ids = idsForKey(key)
  const kind = type === 0xb0 ? 'Control change' : type === 0x90 ? 'Note on' : 'Note off'
  const last: Raw = { status: st, ch, num: a, val: v, text: `${kind} · ch ${ch + 1} · #${a} · value ${v}`, id: ids[0] ?? null, t: performance.now() }
  if (s.panel === 'knob' || s.panel === 'soundcheck') {
    let unknown = s.unknown
    if (!act && !(type === 0x80 || (type === 0x90 && v === 0))) {
      const text = `${type === 0xb0 ? 'CC' : 'note'} ${a} ch ${ch + 1}`
      const f = unknown.find((u) => u.key === key)
      unknown = f ? unknown.map((u) => (u === f ? { ...u, count: u.count + 1, val: v, t: last.t } : u)) : [{ key, text, count: 1, val: v, t: last.t }, ...unknown].slice(0, 6)
    }
    set({ last, unknown })
  }
}
function actionFeed(a: { id: string; deck: 'A' | 'B' | null; value: number; fine?: boolean }, t: number) {
  const s = get()
  if (!s.checking || a.fine) return
  const id = a.deck ? `${a.id}.${a.deck}` : a.id
  const prev = s.ctl[id]
  const v = a.id === 'jog' ? (((prev?.v ?? 0) + a.value * 9) % 360 + 360) % 360 : a.value
  const next = { ...s.ctl, [id]: { v, n: (prev?.n ?? 0) + 1, t } }
  set({ ctl: next })
  if (!s.last || t - s.last.t > 250) set({ last: { status: 0, ch: 0, num: 0, val: Math.round(a.value * 127), text: `On-screen · ${labelOf(id)}`, id, t } })
}

// ---------- wiring ----------
const offMsg = onDjMessage((d) => rawFeed(d))
const offAct = onAction((a, t) => actionFeed(a, t))
// a controller shows up: use the map saved for its name
const seen: Set<string> = hot.seen ?? new Set()
const offDev = useDevices.subscribe((st) => {
  for (const d of st.devices) {
    if (d.role !== 'dj' || !d.connected || seen.has(d.id)) continue
    seen.add(d.id)
    if (activateControllerMap(d.name)) resyncLeds()
  }
})

if (import.meta.hot) {
  import.meta.hot.data.store = useCal
  import.meta.hot.data.det = det
  import.meta.hot.data.timers = timers
  import.meta.hot.data.blink = blink
  import.meta.hot.data.seen = seen
  import.meta.hot.dispose(() => { offMsg(); offAct(); offDev(); timers.forEach(clearTimeout); timers.clear() })
  import.meta.hot.accept()
}
