// CO-OP: things the DJ and the pianist do TOGETHER. No React.
//   Soundcheck  the DJ checks the controls (knob check) while the pianist plays a C major scale and a chord. A shared "Band ready" list; when it is full the band goes live.
//   Challenges  3 rounds each, one shared star per round won:
//     cadence  the pianist ends a phrase on the home note (judge 'cadence'), the DJ moves the crossfader within 1 beat.
//     drop     the DJ cuts the bass (LOW EQ down, or the BASS stem off) for a bar, then brings it back on the downbeat as the pianist plays the BOOM or the home note.
//     call     a DJ pad hit plays a short riff, the pianist answers within 2 beats.
// Progress: per kid (psave 'coop') and a shared band record (localStorage 'koog.band').
import { create } from 'zustand'
import { onJudge, type JudgeEvent } from '../../music/judge'
import { onNote } from '../../music/notes'
import { useHarmonyStore } from '../../music/harmonyStore'
import { setGuide, clearGuide } from '../../music/guide'
import { getSynth } from '../synth-history/engine'
import { SCALES, pc, PC_NAMES } from '../../music/theory'
import { pload, psave, onProfileChange } from '../../profile/profile'
import { holdKey } from './duo'
import { dispatch, ensure, getView, onPad, subscribe, type PadEvent } from './engine'
import { TRACKS } from './synth'
import { getBeat, onBeat } from './clock'
import { onAction } from './tap'

export type CoopKind = 'cadence' | 'drop' | 'call'
export const KINDS: CoopKind[] = ['cadence', 'drop', 'call']
export const KIND_INFO: Record<CoopKind, { title: string; emoji: string; dj: string; piano: string }> = {
  cadence: { title: 'Crossfade on the cadence', emoji: '🎚️', dj: 'Move the crossfader when the tune ends', piano: 'Play a tune and end on the home note' },
  drop: { title: 'Drop it', emoji: '💥', dj: 'Cut the bass for a bar, then bring it back on 1', piano: 'Play the BOOM or the home note on 1' },
  call: { title: 'Call and response', emoji: '📣', dj: 'Hit a pad to play a riff', piano: 'Answer the riff within 2 beats' },
}
const ROUNDS = 3
const ROUND_MS = 40000

export interface Active { kind: CoopKind; round: number; stars: number; phase: string; dj: string; piano: string; msg: string; win: number; done: boolean; beats: number }
export interface SCItem { id: string; who: 'dj' | 'piano'; label: string; needs: string[]; done: boolean; sub: string }
export interface Band { stars: Record<CoopKind, number>; soundchecks: number; plays: number }
interface CoopState { active: Active | null; sc: { on: boolean; items: SCItem[]; live: boolean; scaleI: number; chordHint: boolean } | null; band: Band; mine: Band }

const emptyBand = (): Band => ({ stars: { cadence: 0, drop: 0, call: 0 }, soundchecks: 0, plays: 0 })
const BAND_KEY = 'koog.band'
function loadBand(): Band {
  try { const v = JSON.parse(localStorage.getItem(BAND_KEY) || 'null'); return v && v.stars ? { ...emptyBand(), ...v, stars: { ...emptyBand().stars, ...v.stars } } : emptyBand() } catch { return emptyBand() }
}
const loadMine = (): Band => { const v = pload<Band | null>('coop', null); return v && v.stars ? { ...emptyBand(), ...v, stars: { ...emptyBand().stars, ...v.stars } } : emptyBand() }

type Hot = { store?: ReturnType<typeof make>; M?: Mem }
interface Mem {
  xf: { t: number; v: number }[]; timers: Set<ReturnType<typeof setTimeout>>; roundTimer: ReturnType<typeof setTimeout> | null
  restore: { t: number; off: number | null } | null; hit: { t: number; off: number | null } | null; cutBeats: number; wasCut: boolean
  riffEnd: number; riffMs: number; answers: number; scale: number; chord: { pc: number; t: number }[]; riffNotes: number[]; seenLog: number; lastNote?: number
}
function make() { return create<CoopState>()(() => ({ active: null, sc: null, band: loadBand(), mine: loadMine() })) }
const hot = (import.meta.hot?.data ?? {}) as Hot
export const useCoop = hot.store ?? make()
const M: Mem = hot.M ?? { xf: [], timers: new Set(), roundTimer: null, restore: null, hit: null, cutBeats: 0, wasCut: false, riffEnd: 0, riffMs: 0, answers: 0, scale: 0, chord: [], riffNotes: [], seenLog: 0 }
const st = () => useCoop.getState()
const patchActive = (p: Partial<Active>) => { const a = st().active; if (a) useCoop.setState({ active: { ...a, ...p } }) }
const later = (fn: () => void, ms: number) => { const h = setTimeout(() => { M.timers.delete(h); fn() }, ms); M.timers.add(h); return h }
const beatMs = () => { const b = getBeat(); return b.playing && b.bpm ? 60000 / b.bpm : 500 }
const homeName = () => PC_NAMES[useHarmonyStore.getState().key.tonic]

function saveProgress(kind: CoopKind | null, stars: number, soundcheck: boolean) {
  const upd = (b: Band): Band => ({ ...b, stars: kind ? { ...b.stars, [kind]: Math.max(b.stars[kind], stars) } : b.stars, soundchecks: b.soundchecks + (soundcheck ? 1 : 0), plays: b.plays + (kind ? 1 : 0) })
  const band = upd(st().band), mine = upd(st().mine)
  useCoop.setState({ band, mine })
  psave('coop', mine)
  try { localStorage.setItem(BAND_KEY, JSON.stringify(band)) } catch { /* ignore */ }
}

// ---------- beat helpers ----------
/** signed ms to the nearest DOWNBEAT (beat 1 of the bar), or null when the nearest beat isn't a downbeat / nothing plays */
export function downbeatOffsetMs(): number | null {
  const b = getBeat()
  if (!b.playing) return null
  const ms = 60000 / b.bpm
  const nearest = b.phase < 0.5 ? b.beat : (b.beat + 1) % 4
  if (nearest !== 0) return null
  return b.phase < 0.5 ? b.phase * ms : (b.phase - 1) * ms
}
function bassCut(): boolean {
  const v = getView()
  return (['A', 'B'] as const).some((d) => v[d].playing && (v[d].low < 0.15 || !v[d].mask[1]))
}

// ---------- challenges ----------
function clearRound() { if (M.roundTimer) { clearTimeout(M.roundTimer); M.roundTimer = null } M.restore = null; M.hit = null; M.cutBeats = 0; clearGuide() }
export async function startCoop(kind: CoopKind) {
  cancelCoop()
  await ensure()
  if (!getView().anyPlaying) dispatch({ id: 'play', deck: 'A', value: 1 })
  M.xf = [{ t: performance.now(), v: getView().xf }]
  M.wasCut = bassCut()
  if (kind === 'cadence') holdKey(true)
  useCoop.setState({ active: { kind, round: 1, stars: 0, phase: 'go', dj: '', piano: '', msg: '', win: 0, done: false, beats: 0 } })
  beginRound()
}
export function cancelCoop() {
  holdKey(false)
  clearRound(); M.timers.forEach(clearTimeout); M.timers.clear()
  if (st().active) useCoop.setState({ active: null })
}
function beginRound() {
  const a = st().active
  if (!a) return
  clearRound()
  const info = KIND_INFO[a.kind]
  M.cutBeats = 0; M.restore = null; M.hit = null; M.answers = 0
  if (a.kind === 'cadence') patchActive({ phase: 'go', dj: 'Hand on the crossfader!', piano: `Play a tune, end on ${homeName()}`, msg: '' })
  else if (a.kind === 'drop') patchActive({ phase: 'cut', dj: 'Cut the BASS (LOW all the way down)', piano: 'Keep a groove going', msg: '' })
  else patchActive({ phase: 'call', dj: 'Hit a PAD to play a riff', piano: 'Listen to the riff…', msg: '' })
  void info
  M.roundTimer = setTimeout(() => endRound(false, 'Time is up for this one!'), ROUND_MS)
}
function endRound(win: boolean, msg?: string) {
  const a = st().active
  if (!a || a.phase === 'between') return
  clearRound()
  const stars = a.stars + (win ? 1 : 0)
  patchActive({ stars, win: win ? a.win + 1 : a.win, phase: 'between', msg: win ? '🎉 Nice, you did it together!' : (msg ?? 'Next one!'), dj: '', piano: '' })
  later(() => {
    const cur = st().active
    if (!cur) return
    if (cur.round >= ROUNDS) {
      patchActive({ done: true, phase: 'done', msg: `Band score ${'★'.repeat(cur.stars)}${'☆'.repeat(ROUNDS - cur.stars)}` })
      saveProgress(cur.kind, cur.stars, false)
      holdKey(false)
      later(() => { if (st().active?.done) useCoop.setState({ active: null }) }, 9000)
    } else { patchActive({ round: cur.round + 1 }); beginRound() }
  }, 1800)
}
const win = () => endRound(true)

// cadence: the phrase ended ~700ms before the judge said so; the DJ has 1 beat either side of that moment
const evals: unknown[] = []
let lastEval: unknown = null
function xfMoved(t0: number, t1: number) {
  evals.push({ t0: Math.round(t0), t1: Math.round(t1), n: M.xf.filter((x) => x.t >= t0 && x.t <= t1).length, nxf: M.xf.length })
  lastEval = { t0: Math.round(t0), t1: Math.round(t1), n: M.xf.filter((x) => x.t >= t0 && x.t <= t1).length }
  const inWin = M.xf.filter((x) => x.t >= t0 && x.t <= t1)
  if (!inWin.length) return false
  const before = [...M.xf].reverse().find((x) => x.t < t0)
  const vals = inWin.map((x) => x.v).concat(before ? [before.v] : [])
  return Math.max(...vals) - Math.min(...vals) >= 0.12
}
function onCadence() {
  const a = st().active
  if (!a || a.kind !== 'cadence' || a.phase !== 'go') return
  evals.push({ cadenceAt: Math.round(performance.now()), phase: a.phase })
  const now = performance.now(), T = M.lastNote ?? now - 700, bm = beatMs()
  patchActive({ phase: 'check', msg: 'Nice ending! DJ, now!' })
  const finish = () => {
    const cur = st().active
    if (!cur || cur.phase !== 'check') return
    if (xfMoved(T - bm, T + bm)) win()
    else { patchActive({ phase: 'go', msg: 'So close! Move the crossfader right as the tune ends.' }) }
  }
  const wait = T + bm - performance.now()
  if (wait > 0) later(finish, wait + 20); else finish()
}

// drop
function onEngineChange() {
  const a = st().active
  const cut = bassCut()
  const was = M.wasCut
  M.wasCut = cut
  if (!a || a.kind !== 'drop') return
  if (a.phase === 'cut' && cut) { M.cutBeats = 0; patchActive({ phase: 'hold', beats: 0, dj: 'Hold it for one whole bar…', piano: 'Keep playing!', msg: '' }) }
  else if (a.phase === 'hold' && !cut && was) patchActive({ phase: 'cut', dj: 'Cut the BASS (LOW all the way down)', msg: 'Hold the bass off for a whole bar first.' })
  else if (a.phase === 'ready' && was && !cut) {
    M.restore = { t: performance.now(), off: downbeatOffsetMs() }
    later(evalDrop, 450)
    evalDrop()
  }
}
function onDropBeat(b: { beat: number }) {
  const a = st().active
  if (!a || a.kind !== 'drop' || a.phase !== 'hold') return
  if (!bassCut()) return
  M.cutBeats++
  patchActive({ beats: M.cutBeats })
  if (M.cutBeats >= 4) patchActive({ phase: 'ready', dj: 'Bring the bass back on beat 1!', piano: `BOOM or ${homeName()} on beat 1!`, msg: '' })
  void b
}
function evalDrop() {
  const a = st().active
  if (!a || a.kind !== 'drop' || a.phase !== 'ready' || !M.restore) return
  const r = M.restore, h = M.hit
  if (r.off != null && Math.abs(r.off) <= 250 && h && h.off != null && Math.abs(h.off) <= 250 && Math.abs(h.t - r.t) <= 300) { win(); return }
  if (performance.now() - r.t >= 440) {
    M.restore = null; M.hit = null; M.cutBeats = 0
    patchActive({ phase: 'cut', dj: 'Cut the BASS again', piano: 'Keep a groove going', msg: r.off == null || Math.abs(r.off) > 250 ? 'The bass came back off the beat. Try on beat 1!' : "The piano wasn't there. BOOM or the home note together!" })
  }
}
function pianoHit(e: JudgeEvent) {
  const a = st().active
  if (!a || a.kind !== 'drop' || a.phase !== 'ready') return
  const boom = e.type === 'cluster' && e.boom
  const tonic = e.type === 'note' && e.g.kind === 'tonic' && !e.g.cluster
  if (!boom && !tonic) return
  M.hit = { t: performance.now(), off: downbeatOffsetMs() }
  if (M.restore) evalDrop()
}

// call and response
function riffFor(deck: 'A' | 'B', pad: number): number[] {
  const v = getView()
  const key = v[deck].playing ? TRACKS[deck].key : useHarmonyStore.getState().key
  const sc = SCALES[key.scale], n = sc.length, root = 60 + key.tonic
  const one = (d: number) => root + sc[d % n] + 12 * Math.floor(d / n)
  const d0 = [0, 2, 4, 1][pad] ?? 0
  return [d0, d0 + 2, d0 + 1].map(one)
}
function onPadHit(e: PadEvent) {
  const a = st().active
  if (!a || a.kind !== 'call' || a.phase !== 'call') return
  const bm = beatMs(), gap = bm / 2
  const riff = riffFor(e.deck, e.n)
  M.riffNotes = riff; M.answers = 0
  try { const s = getSynth(); riff.forEach((n, i) => { later(() => { try { s.noteOn(n, 70) } catch { /* ignore */ } later(() => { try { s.noteOff(n) } catch { /* ignore */ } }, gap * 0.8) }, i * gap) }) } catch { /* ignore */ }
  M.riffEnd = performance.now() + riff.length * gap
  M.riffMs = bm * 2
  patchActive({ phase: 'riff', dj: 'Nice riff!', piano: 'Your turn: answer it!', msg: '' })
  later(() => {
    const c = st().active
    if (!c || c.phase !== 'riff') return
    patchActive({ phase: 'answer' })
    setTimeout(() => setGuide(riff, 'next'), 0)
    later(() => {
      const d = st().active
      if (!d || d.phase !== 'answer') return
      clearGuide()
      if (M.answers >= 2) win()
      else patchActive({ phase: 'call', dj: 'Hit a PAD to play a riff', piano: 'Listen to the riff…', msg: 'Answer within 2 beats, with two notes!' })
    }, M.riffMs + 40)
  }, riff.length * gap)
}
function onAnswer(e: JudgeEvent) {
  const a = st().active
  if (!a || a.kind !== 'call' || (a.phase !== 'answer' && a.phase !== 'riff') || e.type !== 'note') return
  if (e.g.chordMember || e.g.cluster || e.g.kind === 'spicy') return
  if (performance.now() < M.riffEnd - 250) return
  M.answers++
  if (a.phase === 'answer' && M.answers >= 2) { clearGuide(); win() }
}

// ---------- Soundcheck ----------
const SCALE_PCS = [0, 2, 4, 5, 7, 9, 11, 0]
const mk = (id: string, who: 'dj' | 'piano', label: string, needs: string[]): SCItem => ({ id, who, label, needs, done: false, sub: '' })
export function startSoundcheck() {
  cancelCoop()
  M.scale = 0; M.chord = []
  for (const k of Object.keys(scTouch)) delete scTouch[k]
  useCoop.setState({ sc: { on: true, live: false, scaleI: 0, chordHint: false, items: [
    mk('play', 'dj', 'both play buttons', ['play.A', 'play.B']),
    mk('xfade', 'dj', 'crossfader', ['xfade']),
    mk('vol', 'dj', 'both volume faders', ['vol.A', 'vol.B']),
    mk('pad', 'dj', 'a pad on each deck', ['pad1.A', 'pad1.B']),
    mk('scale', 'piano', 'C major scale', []),
    mk('chord', 'piano', 'a chord (C E G)', []),
  ] } })
  showScaleGuide()
}
export function stopSoundcheck() { clearGuide(); useCoop.setState({ sc: null }) }
const scTouch: Record<string, { min: number; max: number; n: number }> = {}
const MID_OF = (n: number) => 60 + n
function showScaleGuide() {
  const sc = st().sc
  if (!sc || !sc.on) return
  const sI = sc.items.find((i) => i.id === 'scale')
  if (sI && !sI.done) { const p = SCALE_PCS[M.scale]; setGuide([MID_OF(M.scale === 7 ? 12 : p)], 'next') }
  else if (sc.items.find((i) => i.id === 'chord' && !i.done)) setGuide([60, 64, 67], 'gold')
  else clearGuide()
}
function scMark(id: string, sub?: string) {
  const sc = st().sc
  if (!sc || !sc.on) return
  const items = sc.items.map((i) => (i.id === id ? { ...i, done: true, sub: sub ?? i.sub } : i))
  useCoop.setState({ sc: { ...sc, items } })
  showScaleGuide()
  if (items.every((i) => i.done) && !sc.live) goLive()
}
function goLive() {
  const sc = st().sc
  if (!sc) return
  useCoop.setState({ sc: { ...sc, live: true } })
  saveProgress(null, 0, true)
  void ensure().then(() => { if (!getView().anyPlaying) dispatch({ id: 'play', deck: 'A', value: 1 }) })
  later(() => { const c = st().sc; if (c?.live) useCoop.setState({ sc: { ...c, on: false } }) }, 6000)
}
function scAction(a: { id: string; deck: 'A' | 'B' | null; value: number }) {
  const sc = st().sc
  if (!sc || !sc.on) return
  const id = a.deck ? `${a.id}.${a.deck}` : a.id
  const t = (scTouch[id] ??= { min: a.value, max: a.value, n: 0 })
  t.min = Math.min(t.min, a.value); t.max = Math.max(t.max, a.value); t.n++
  const done = (key: string) => sc.items.find((i) => i.id === key)?.done
  const moved = (i: string) => scTouch[i] && scTouch[i].max - scTouch[i].min >= 0.2
  if (a.id === 'play' && a.value === 1) { scTouch['p' + id] = t; if (scTouch['play.A'] && scTouch['play.B'] && !done('play')) scMark('play') }
  if (a.id === 'xfade' && moved('xfade') && !done('xfade')) scMark('xfade')
  if (a.id === 'vol' && moved('vol.A') && moved('vol.B') && !done('vol')) scMark('vol')
  if (/^pad[1-4]$/.test(a.id) && a.value === 1) { scTouch['padhit.' + a.deck] = t; if (scTouch['padhit.A'] && scTouch['padhit.B'] && !done('pad')) scMark('pad') }
}
function scNote(e: { on: boolean; note: number }) {
  const sc = st().sc
  if (!sc || !sc.on || !e.on) return
  const now = performance.now()
  const sI = sc.items.find((i) => i.id === 'scale')
  if (sI && !sI.done) {
    if (pc(e.note) === SCALE_PCS[M.scale]) { M.scale++; if (M.scale >= SCALE_PCS.length) { scMark('scale') } else { scMark2(M.scale); showScaleGuide() } }
    else if (pc(e.note) === 0) { M.scale = 1; scMark2(1); showScaleGuide() }
  }
  M.chord = M.chord.filter((c) => now - c.t < 600); M.chord.push({ pc: pc(e.note), t: now })
  const ps = new Set(M.chord.map((c) => c.pc))
  if (ps.has(0) && ps.has(4) && ps.has(7) && !sc.items.find((i) => i.id === 'chord')?.done) scMark('chord')
}
function scMark2(n: number) {
  const sc = st().sc
  if (!sc) return
  useCoop.setState({ sc: { ...sc, scaleI: n, items: sc.items.map((i) => (i.id === 'scale' ? { ...i, sub: `${n}/8` } : i)) } })
}

// ---------- wiring ----------
const offs = [
  onAction((a, t) => {
    if (a.id === 'xfade') { M.xf.push({ t, v: a.value }); if (M.xf.length > 60) M.xf.shift() }
    scAction(a)
  }),
  onJudge((e) => {
    if (e.type === 'note' && !e.g.chordMember) M.lastNote = performance.now()
    if (e.type === 'cadence') onCadence()
    pianoHit(e)
    onAnswer(e)
  }),
  onNote((e) => scNote(e)),
  subscribe(onEngineChange),
  onBeat(onDropBeat),
  onPad(onPadHit),
  onProfileChange(() => useCoop.setState({ mine: loadMine() })),
]
void later

if (import.meta.hot) {
  import.meta.hot.data.store = useCoop
  import.meta.hot.data.M = M
  import.meta.hot.dispose(() => { offs.forEach((f) => f()) })
  import.meta.hot.accept()
}
/** for tests */
export const __coopDebug = () => ({ evals, lastEval, lastNote: M.lastNote, xf: M.xf.map((x) => [Math.round(x.t), +x.v.toFixed(2)]), now: Math.round(performance.now()) })
