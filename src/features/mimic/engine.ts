// Mimic engine: listens to the player's notes, answers in a chosen style, restyles live, and can play a small backing.
// Its own tiny Web Audio voices (patch-driven; the Patch type mirrors the Koog synth params in synth-history/params.ts plus vibrato/FM).
// SAFETY: hard master cap, limiter, every voice has a scheduled stop, max MAX_VOICES lead + MAX_BACK backing at once,
// the player playing again cancels the answer (nothing ever stacks). Non-component: state lives in import.meta.hot.data.
// NOTE: backing is bass + comping only (no drums) - the planned "Band" engine will merge this with beats/smartband.
import { registerPanicTarget } from '../../music/panic'
import { outputScale, useAudioSettings } from '../../music/audioSettings'
import { useHarmonyStore } from '../../music/harmonyStore'
import { onNote } from '../../music/notes'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { say } from '../../coach/coachBus'
import { pc } from '../../music/theory'
import { NOTICE, STYLES, backingBar, detectTraits, filterExtras, makeAnswer, quoteFor, styleById, type Ev, type Patch, type PlayedNote, type TraitResult } from '../../music/styles'

export { NOTICE }
export const MASTER_CAP = 0.12
export const MAX_VOICES = 8
export const MAX_BACK = 8
const LOOKAHEAD = 0.15, TICK_MS = 25, CALL_GAP_MS = 1100, MAX_CALL = 12, TRIAL_MS = 16000
const BASS: Patch = { wave: 'triangle', detune: 0, cutoff: 700, res: 1, fenv: 500, a: 0.01, d: 0.25, s: 0.5, r: 0.15, level: 0.8 }

export interface Shown { events: Ev[]; beats: number; label: string; startMs: number; bpm: number; call: number[]; credit?: string }
interface Trial { active: boolean; startMs: number; notes: PlayedNote[]; result: TraitResult[] | null; held: Map<number, number> }
interface Voice { end: number; gain: GainNode; stop: () => void }
interface State {
  version: number; listeners: Set<() => void>
  on: boolean; styleId: string; filter: boolean; backing: boolean; volume: number
  ctx: AudioContext | null; master: GainNode | null; analyser: AnalyserNode | null
  voices: Voice[]; back: Voice[]
  listening: boolean; callNotes: { note: number; t: number; dur: number }[]; held: Map<number, number>; callTimer: ReturnType<typeof setTimeout> | null
  answer: Shown | null; answerTimer: ReturnType<typeof setTimeout> | null; ansCount: number; seed: number
  timer: ReturnType<typeof setTimeout> | null; bar: number; nextBar: number; barSec: number; clockStart: number
  trial: Trial; snapped: { from: number; to: number; at: number } | null
  offNote: (() => void) | null; offProf: (() => void) | null; offVol: (() => void) | null
}
const hot = import.meta.hot
const S: State = (hot?.data.mimic as State | undefined) ?? {
  version: 0, listeners: new Set(), on: false, styleId: 'cooljazz', filter: false, backing: false, volume: 0.7,
  ctx: null, master: null, analyser: null, voices: [], back: [], listening: false, callNotes: [], held: new Map(), callTimer: null,
  answer: null, answerTimer: null, ansCount: 0, seed: 1, timer: null, bar: 0, nextBar: 0, barSec: 2, clockStart: 0,
  trial: { active: false, startMs: 0, notes: [], result: null, held: new Map() }, snapped: null, offNote: null, offProf: null, offVol: null,
}
if (hot) hot.data.mimic = S

const emit = () => { S.version++; S.listeners.forEach((f) => f()) }
export const subscribe = (f: () => void) => { S.listeners.add(f); return () => { S.listeners.delete(f) } }
export const getVersion = () => S.version
export const getState = () => S
export const currentStyle = () => styleById(S.styleId)
const key = () => useHarmonyStore.getState().key
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const nowMs = () => performance.now()

// ---------------- audio ----------------
async function ensureCtx(): Promise<boolean> {
  try {
    if (!S.ctx) {
      const c = new AudioContext()
      const master = c.createGain(); master.gain.value = 0
      const lim = c.createDynamicsCompressor(); lim.threshold.value = -14; lim.knee.value = 8; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.15
      const an = c.createAnalyser(); an.fftSize = 512
      master.connect(lim); lim.connect(an); an.connect(c.destination)
      S.ctx = c; S.master = master; S.analyser = an
    }
    if (S.ctx.state === 'suspended') await S.ctx.resume()
    applyMaster()
    return S.ctx.state === 'running'
  } catch { return false }
}
function applyMaster() {
  if (S.ctx && S.master) S.master.gain.setTargetAtTime(MASTER_CAP * S.volume * outputScale(), S.ctx.currentTime, 0.02)
}
/** dev/test: peak level (0..1) of Mimic's output right now */
export function mimicPeak(): number {
  if (!S.analyser) return 0
  const b = new Float32Array(S.analyser.fftSize); S.analyser.getFloatTimeDomainData(b)
  let p = 0; for (const x of b) p = Math.max(p, Math.abs(x)); return p
}

function reserve(list: Voice[], cap: number, t: number): boolean {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].end < t - 0.05) list.splice(i, 1)
  return list.length < cap
}
/** schedule one voice at audio time `t` */
function voice(patch: Patch, t: number, dur: number, note: number, vel: number, group: 'lead' | 'back', bend?: number) {
  const c = S.ctx, m = S.master
  if (!c || !m) return
  const list = group === 'lead' ? S.voices : S.back
  if (!reserve(list, group === 'lead' ? MAX_VOICES : MAX_BACK, t)) return
  const p = patch, f = mtof(note)
  const peak = Math.max(0.02, (vel / 127)) * p.level * 0.5
  const dd = Math.max(0.04, dur)
  const end = t + dd + p.r + 0.06
  const g = c.createGain(); g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + Math.max(0.002, p.a))
  g.gain.setTargetAtTime(peak * p.s, t + p.a, Math.max(0.02, p.d / 3))
  g.gain.setValueAtTime(Math.max(0.0001, peak * Math.max(p.s, 0.0001)), Math.max(t + p.a + 0.01, t + dd))
  g.gain.setTargetAtTime(0, t + dd, Math.max(0.01, p.r / 3))
  const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = Math.min(12, p.res)
  const vf = 0.6 + vel / 127
  flt.frequency.setValueAtTime(Math.min(12000, p.cutoff * vf + p.fenv), t)
  flt.frequency.setTargetAtTime(Math.min(12000, p.cutoff * vf), t, Math.max(0.03, p.d / 2))
  flt.connect(g); g.connect(m)
  const oscs: OscillatorNode[] = []
  const mk = (w: OscillatorType, det: number) => {
    const o = c.createOscillator(); o.type = w; o.frequency.value = f; o.detune.value = det
    if (bend) { o.detune.setValueAtTime(det + bend, t); o.detune.linearRampToValueAtTime(det, t + 0.09) }
    o.connect(flt); oscs.push(o); return o
  }
  mk(p.wave, 0); if (p.wave2) mk(p.wave2, p.detune)
  else if (p.detune) mk(p.wave, p.detune)
  const extra: (OscillatorNode)[] = []
  if (p.vib) {
    const l = c.createOscillator(); l.frequency.value = p.vib.rate
    const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(p.vib.depth, t + p.vib.delay + 0.2)
    l.connect(lg); for (const o of oscs) lg.connect(o.detune); extra.push(l)
  }
  if (p.fm) {
    const mo = c.createOscillator(); mo.frequency.value = f * p.fm.ratio
    const mg = c.createGain(); mg.gain.setValueAtTime(f * p.fm.index * 0.5, t); mg.gain.setTargetAtTime(f * 0.02, t, p.fm.decay / 3)
    mo.connect(mg); mg.connect(oscs[0].frequency); extra.push(mo)
  }
  const all = [...oscs, ...extra]
  for (const o of all) { o.start(t); o.stop(end) }
  const v: Voice = { end, gain: g, stop: () => { try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(0, c.currentTime, 0.015); for (const o of all) o.stop(c.currentTime + 0.1) } catch { /* ignore */ } } }
  list.push(v)
  oscs[0].onended = () => { try { g.disconnect(); flt.disconnect() } catch { /* ignore */ } const i = list.indexOf(v); if (i >= 0) list.splice(i, 1) }
}

function silenceLead() { for (const v of S.voices.splice(0)) v.stop() }
function silenceBack() { for (const v of S.back.splice(0)) v.stop() }

// ---------------- scheduling an answer ----------------
function play(evs: Ev[], t0: number, bpm: number, patch: Patch) {
  const sec = 60 / bpm
  for (const e of evs) voice(e.kind === 'bass' ? BASS : patch, t0 + e.t * sec, e.dur * sec, e.note, e.vel, e.kind === 'bass' || e.kind === 'chord' ? 'back' : 'lead', e.bend)
}
function beatSec() { return 60 / currentStyle().bpm }
/** next time (audio clock) the answer should start: the next beat of the backing, otherwise a short breath after the call */
function answerStart(): number {
  const c = S.ctx!, now = c.currentTime + 0.05
  if (S.backing && S.timer) {
    const b = beatSec(), rel = (now - S.clockStart) / b
    return S.clockStart + Math.ceil(rel) * b
  }
  return now + 0.2
}
function showAnswer(a: Omit<Shown, 'startMs'>, startAudio: number) {
  const c = S.ctx!
  S.answer = { ...a, startMs: nowMs() + (startAudio - c.currentTime) * 1000 }
  if (S.answerTimer) clearTimeout(S.answerTimer)
  S.answerTimer = setTimeout(() => { S.answer = null; S.answerTimer = null; emit() }, (a.beats * 60 / a.bpm + 2.5) * 1000 + (startAudio - c.currentTime) * 1000)
  emit()
}
function cancelAnswer() {
  silenceLead()
  if (S.answerTimer) { clearTimeout(S.answerTimer); S.answerTimer = null }
  if (S.answer) { S.answer = null; emit() }
}

async function finishCall() {
  S.callTimer = null
  const notes = S.callNotes.splice(0)
  S.held.clear()
  if (!S.on || notes.length < 2 || !(await ensureCtx())) { S.listening = false; emit(); return }
  S.listening = false
  const st = currentStyle()
  S.ansCount++
  const bar = S.backing && S.timer ? S.bar + 1 : S.ansCount * 2
  const ans = makeAnswer(st, notes.map((n) => ({ note: n.note })), { seed: S.seed++ * 977 + notes[0].note, key: key(), bar, index: S.ansCount })
  const t0 = answerStart()
  play(ans.events, t0, st.bpm, st.patch)
  showAnswer({ events: ans.events, beats: ans.beats, label: ans.label, bpm: st.bpm, call: notes.map((n) => n.note) }, t0)
  const dv = ans.devs.filter((d) => d !== 'restate')[0]
  say({ source: 'mimic', topic: 'answer:' + st.id, text: `${st.emoji} Koog answered in ${st.name}${dv ? ' (' + dv + ')' : ''}`, priority: 1, ms: 2600, tone: 'info' })
}

// ---------------- note listener ----------------
function onPlayerNote(e: { id: number; note: number; on: boolean; velocity: number }) {
  if (e.on) {
    if (S.on && S.listening) { /* already collecting */ }
    if (S.on) {
      if (S.answer) cancelAnswer() // the player plays again: Koog stops talking
      S.listening = true
      S.callNotes.push({ note: e.note, t: nowMs(), dur: 0.3 }); S.held.set(e.note, nowMs())
      if (S.callNotes.length > MAX_CALL) S.callNotes.shift()
      if (S.callTimer) clearTimeout(S.callTimer)
      S.callTimer = setTimeout(() => { void finishCall() }, CALL_GAP_MS)
      emit()
    }
    if (S.filter) void restyle(e.note, e.velocity)
    if (S.trial.active) { S.trial.held.set(e.note, nowMs()); S.trial.notes.push({ note: e.note, t: (nowMs() - S.trial.startMs) / 1000, dur: 0.3 }) }
  } else {
    const t = S.held.get(e.note)
    if (t != null) { const n = [...S.callNotes].reverse().find((x) => x.note === e.note); if (n) n.dur = (nowMs() - t) / 1000; S.held.delete(e.note) }
    const tt = S.trial.held.get(e.note)
    if (tt != null && S.trial.active) { const n = [...S.trial.notes].reverse().find((x) => x.note === e.note); if (n) n.dur = (nowMs() - tt) / 1000; S.trial.held.delete(e.note) }
  }
}

async function restyle(note: number, velocity: number) {
  if (!(await ensureCtx())) return
  const st = currentStyle()
  const bar = S.timer ? S.bar : Math.floor((nowMs() - S.clockStart * 0) / (st.bpb * beatSec() * 1000)) % 4
  const { snapped, extras } = filterExtras(st, key(), note, velocity, bar, S.seed++)
  if (snapped !== note) { S.snapped = { from: note, to: snapped, at: nowMs() }; emit() }
  const c = S.ctx!
  for (const x of extras.slice(0, 3)) voice(st.patch, c.currentTime + 0.005 + x.after, x.dur, x.note, x.vel, 'lead')
}

// ---------------- backing clock ----------------
function tick() {
  S.timer = null
  const c = S.ctx
  if (!c || !S.backing) return
  const st = currentStyle(), k = key()
  while (S.nextBar < c.currentTime + LOOKAHEAD + 0.02) {
    const sec = beatSec()
    const evs = backingBar(st, k, S.bar, S.seed)
    for (const e of evs) {
      if (e.t >= st.bpb) continue
      voice(e.kind === 'bass' ? BASS : { ...st.patch, level: st.patch.level * 0.7, cutoff: Math.min(st.patch.cutoff, 2600) }, S.nextBar + e.t * sec, e.dur * sec, e.note, Math.round(e.vel * 0.8), 'back')
    }
    S.bar++; S.nextBar += st.bpb * sec
  }
  S.timer = setTimeout(tick, TICK_MS)
}
async function startBacking() {
  if (!(await ensureCtx())) return
  S.backing = true; S.bar = 0
  S.clockStart = S.ctx!.currentTime + 0.1; S.nextBar = S.clockStart
  if (!S.timer) S.timer = setTimeout(tick, 0)
  save(); emit()
}
function stopBacking() {
  S.backing = false
  if (S.timer) { clearTimeout(S.timer); S.timer = null }
  silenceBack(); save(); emit()
}

// ---------------- public actions ----------------
export async function setOn(on: boolean) {
  S.on = on
  if (on) { await ensureCtx(); say({ source: 'mimic', topic: 'on', text: `${currentStyle().emoji} Mimic on: play a short phrase and Koog answers in ${currentStyle().name}`, priority: 1, ms: 3200, tone: 'tip' }) }
  else { panic() }
  save(); emit()
}
export const toggle = () => setOn(!S.on)
export function setStyle(id: string) {
  if (!STYLES.some((s) => s.id === id)) return
  S.styleId = id; cancelAnswer(); silenceBack()
  if (S.backing) { S.bar = 0; if (S.ctx) { S.clockStart = S.ctx.currentTime + 0.1; S.nextBar = S.clockStart } }
  S.trial = { active: false, startMs: 0, notes: [], result: null, held: new Map() }
  save(); emit()
}
export async function setFilter(on: boolean) { S.filter = on; if (on) await ensureCtx(); save(); emit() }
export async function setBacking(on: boolean) { if (on) await startBacking(); else stopBacking() }
export function setVolume(v: number) { S.volume = Math.max(0, Math.min(1, v)); applyMaster(); save(); emit() }
/** play a PD quote on purpose (pd styles only), with its credit */
export async function playQuote(): Promise<string | null> {
  const st = currentStyle()
  if (!(await ensureCtx())) return null
  const q = quoteFor(st, key(), S.ansCount++)
  if (!q) return null
  cancelAnswer()
  const t0 = S.ctx!.currentTime + 0.1
  play(q.events, t0, st.bpm, st.patch)
  showAnswer({ events: q.events, beats: q.beats, label: 'Quote: ' + q.credit, bpm: st.bpm, call: [], credit: q.credit }, t0)
  say({ source: 'mimic', topic: 'quote:' + st.id, text: `${st.emoji} A real phrase: ${q.credit}`, priority: 2, ms: 3500, tone: 'info' })
  return q.credit
}
/** play one generated answer to a built-in demo call (so the picker can preview a style) */
export async function demo() {
  const st = currentStyle()
  if (!(await ensureCtx())) return
  cancelAnswer(); S.ansCount++
  const k = key()
  const base = 60 + pc(k.tonic)
  const call = [base, base + 2, base + 4, base + 2]
  const ans = makeAnswer(st, call.map((n) => ({ note: n })), { seed: S.seed++, key: k, bar: 0, index: S.ansCount })
  const t0 = S.ctx!.currentTime + 0.1
  play(ans.events, t0, st.bpm, st.patch)
  showAnswer({ events: ans.events, beats: ans.beats, label: ans.label, bpm: st.bpm, call }, t0)
}
export function startTrial() {
  S.trial = { active: true, startMs: nowMs(), notes: [], result: null, held: new Map() }
  setTimeout(() => { if (S.trial.active && nowMs() - S.trial.startMs >= TRIAL_MS - 50) finishTrial() }, TRIAL_MS)
  emit()
}
export function finishTrial() {
  if (!S.trial.active) return
  const res = detectTraits(currentStyle(), S.trial.notes, key())
  S.trial = { ...S.trial, active: false, result: res }
  const got = res.filter((r) => r.ok)
  const st = currentStyle()
  if (S.trial.notes.length === 0) say({ source: 'mimic', topic: 'trial:none', text: 'Play some notes while the challenge is on!', priority: 1, tone: 'tip' })
  else if (got.length === res.length) say({ source: 'mimic', topic: 'trial:' + st.id, text: `${st.emoji} All 3 traits! That is real ${st.name}`, priority: 2, ms: 3200, tone: 'praise' })
  else if (got.length > 0) say({ source: 'mimic', topic: 'trial:' + st.id, text: `${st.emoji} Nice: ${got[0].label.toLowerCase()}! Try: ${res.find((r) => !r.ok)!.hint}`, priority: 1, ms: 3600, tone: 'praise' })
  else say({ source: 'mimic', topic: 'trial:' + st.id, text: `${st.emoji} Try: ${res[0].hint}`, priority: 1, ms: 3600, tone: 'tip' })
  emit()
}
export function panic() {
  cancelAnswer(); silenceBack()
  if (S.callTimer) { clearTimeout(S.callTimer); S.callTimer = null }
  if (S.timer) { clearTimeout(S.timer); S.timer = null }
  S.backing = false; S.listening = false; S.callNotes = []; S.held.clear()
  S.trial = { active: false, startMs: 0, notes: [], result: null, held: new Map() }
  emit()
}

// ---------------- saved prefs (per kid) ----------------
interface Saved { on?: boolean; styleId?: string; filter?: boolean; volume?: number }
function save() { psave('mimic', { styleId: S.styleId, filter: S.filter, volume: S.volume } satisfies Saved) }
function load() {
  const s = pload<Saved>('mimic', {})
  if (s.styleId && STYLES.some((x) => x.id === s.styleId)) S.styleId = s.styleId
  if (typeof s.filter === 'boolean') S.filter = s.filter
  if (typeof s.volume === 'number') S.volume = Math.max(0, Math.min(1, s.volume))
  emit()
}

S.offNote?.(); S.offProf?.(); S.offVol?.()
S.offNote = onNote(onPlayerNote)
S.offProf = onProfileChange(() => { panic(); S.on = false; load() })
S.offVol = useAudioSettings.subscribe(applyMaster)
load()

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    S.offNote?.(); S.offProf?.(); S.offVol?.(); S.offNote = S.offProf = S.offVol = null
    cancelAnswer(); silenceBack(); if (S.callTimer) clearTimeout(S.callTimer); if (S.timer) { clearTimeout(S.timer); S.timer = null }
  })
  import.meta.hot.accept()
}
registerPanicTarget('mimic', panic)
