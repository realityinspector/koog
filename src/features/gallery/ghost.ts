// The ghost pianist: plays through playLocal(), the same path as the computer keys, so the judge, visuals, key detection,
// Vibes, Mentor, bands, games and challenges all react for real. Gentle velocities, legato, a few ms of human timing.
import { playLocal, releaseAllNotes } from '../../music/localNotes'
import { useGuide } from '../../music/guide'
import { useChallengeStore } from '../challenges/store'
import { useLinkOut } from '../../links/bus'
import { SONGS } from '../songs/songs'
import { findSong } from './holiday'
import { ladderOf } from '../../music/phraseEngine'
import type { Perf } from './stops.data'

const PCS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
export interface Ev { notes: number[]; beats: number }

/** `C4:.5 E4 [C4,E4,G4]:2 R:1` -> events (the beat count sticks until changed; R = rest) */
export function parsePhrase(s: string): Ev[] {
  let d = 1
  return s.trim().split(/\s+/).map((tok) => {
    const [n, b] = tok.split(':')
    if (b) d = parseFloat(b)
    if (n === 'R') return { notes: [], beats: d }
    const names = n.startsWith('[') ? n.slice(1, -1).split(',') : [n]
    return { notes: names.map((x) => { const m = /^([A-G])([#b]?)(\d)$/.exec(x); if (!m) throw new Error('bad note ' + x); return 12 * (+m[3] + 1) + PCS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) }), beats: d }
  })
}

/** True while the ghost itself is calling playLocal, so listeners can tell the gallery's notes from a child's. */
let ghostCalls = 0
export const inGhost = () => ghostCalls > 0
const gp = (n: number, v: number, on: boolean) => { ghostCalls++; try { playLocal(n, v, on) } finally { ghostCalls-- } }
/** Art Gallery mode: the gallery's own music ducks (plays softer) while a child plays over it. 1 = full, lower = ducked. */
export const duck = { level: 1 }

export const everyNoteOff = (held: Set<number>) => { ghostCalls++; try { for (const n of held) playLocal(n, 0, false); held.clear(); releaseAllNotes() } finally { ghostCalls-- } }

/** one cancellable performance */
export class Run {
  dead = false
  readonly held = new Set<number>()
  private timers = new Set<number>()
  private wake = new Set<() => void>()
  constructor(readonly deadline: number) {}
  sleep(ms: number) { return new Promise<void>((res) => { const t = window.setTimeout(() => { this.timers.delete(t); this.wake.delete(res); res() }, Math.max(0, ms)); this.timers.add(t); this.wake.add(res) }) }
  until(at: number) { return this.sleep(at - performance.now()) }
  on(n: number, v: number) { if (this.dead) return; this.held.add(n); gp(n, Math.max(1, Math.min(100, Math.round(v * duck.level))), true) }
  off(n: number) { if (this.held.delete(n)) gp(n, 0, false) }
  kill() {
    if (this.dead) return
    this.dead = true
    this.timers.forEach((t) => clearTimeout(t)); this.timers.clear()
    everyNoteOff(this.held)
    this.wake.forEach((w) => w()); this.wake.clear()
  }
  get over() { return this.dead || performance.now() >= this.deadline }
}

const jit = () => Math.random() * 7
const hum = (v: number) => v + (Math.random() - 0.5) * 10

/** play events starting at `t0` (ms, performance clock). Returns when the last note has been released. */
export async function playEvents(run: Run, evs: Ev[], bpm: number, vel: number, t0 = performance.now(), legato = 0.96): Promise<void> {
  const beatMs = 60000 / bpm
  let beat = 0
  for (const e of evs) {
    if (run.dead) return
    const at = t0 + beat * beatMs
    await run.until(at + jit())
    if (run.dead) return
    const hold = Math.max(60, e.beats * beatMs * legato)
    e.notes.forEach((n, i) => {
      const go = () => { if (run.dead) return; run.on(n, hum(vel) - (i > 0 ? 4 : 0)); window.setTimeout(() => run.off(n), hold) }
      if (i === 0) go(); else window.setTimeout(go, i * 6)
    })
    beat += e.beats
  }
  await run.until(t0 + beat * beatMs)
}

/** follow whatever a game or lesson lights up next (the keybed guide), like a patient, gentle player */
async function followGuide(run: Run, fallback: Ev[], bpm: number) {
  let last: number[] | null = null, since = performance.now(), fb = 0
  while (!run.over) {
    const g = useGuide.getState().targets
    const ch = useChallengeStore.getState().active
    const now = performance.now()
    if (g.length && (g !== last || now - since > 3200)) {
      last = g; since = now
      const want = [...g]
      await run.sleep(380 + Math.random() * 200)
      if (run.dead) return
      want.forEach((n, i) => window.setTimeout(() => { if (!run.dead) { run.on(n, hum(74)); window.setTimeout(() => run.off(n), 260) } }, i * 6))
      void ch
    } else if (!g.length && now - since > 4200) {
      // nothing lit: a calm phrase, so the screen still has music
      since = now
      void playEvents(run, fallback.slice(fb % Math.max(1, fallback.length - 3), (fb % Math.max(1, fallback.length - 3)) + 4), bpm, 64)
      fb += 4
    }
    await run.sleep(120)
  }
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const midiOf = (name: string) => { const m = /^([A-G]#?)(-?\d)$/.exec(name); return m ? 12 * (+m[2] + 1) + NAMES.indexOf(m[1]) : null }
const MAJ = [0, 2, 4, 5, 7, 9, 11]
const hooked = new WeakSet<object>()
interface Spy { beeps: number[]; chord: number[] | null }
const spies = new WeakMap<object, Spy>()
/** Watch what an engine asks the app to beep (a melody to echo, a chord to name). Read-only: the engine is not changed. */
function spyOn(engine: object): Spy {
  let sp = spies.get(engine)
  if (sp) return sp
  sp = { beeps: [], chord: null }
  const spy = sp
  const e = engine as { beep: number | null; beepChord?: number[] }
  let beep = e.beep, chord = e.beepChord
  if (chord) spy.chord = chord
  Object.defineProperty(engine, 'beep', { configurable: true, get: () => beep, set: (v: number | null) => { beep = v; if (v != null) spy.beeps.push(v) } })
  Object.defineProperty(engine, 'beepChord', { configurable: true, get: () => chord, set: (v: number[] | undefined) => { chord = v; if (v) spy.chord = v } })
  spies.set(engine, spy); hooked.add(engine)
  return sp
}

/** drive the active challenge from what it shows on screen, the way a patient player would */
async function driveChallenge(run: Run, fallback: Ev[], bpm: number) {
  let n = 0
  const tap = (ns: number[], v = 74, hold = 260, human = true) => ns.forEach((x, i) => window.setTimeout(() => { if (!run.dead) { run.on(x, human ? hum(v) : v); window.setTimeout(() => run.off(x), hold) } }, i * 6))
  while (!run.over) {
    const a = useChallengeStore.getState().active
    if (!a) { await run.sleep(300); continue }
    const sp = spyOn(a.engine)
    await run.sleep(480 + Math.random() * 200)
    if (run.dead) return
    const v = a.engine.view(performance.now())
    const st = v.status
    const id = a.def.id
    const prompt = st + ' ' + (v.sub ?? '')
    let m: RegExpExecArray | null
    if (st.startsWith('Watch')) continue // the demo is playing: listen
    if ((m = /Your turn: (\d+)\/(\d+)/.exec(st))) { const len = +m[2], mel = sp.beeps.slice(-len); if (mel.length === len) tap([mel[+m[1]]], 74, 300) }
    else if (id === 'majmin' || /Major \(play C\)/.test(st)) { const c = sp.chord; tap([c ? (c[1] - c[0] === 4 ? 60 : 69) : (Math.random() < 0.5 ? 60 : 69)], 72, 300) }
    else if ((m = /^Find ([A-G]#?)/.exec(st))) tap([60 + NAMES.indexOf(m[1])], 72, 260)
    else if ((m = /^A (3rd|5th|octave) above ([A-G]#?-?\d)/.exec(st))) { const base = midiOf(m[2]); if (base != null) { const idx = MAJ.indexOf(base - 60); tap([60 + 12 * Math.floor((idx + { '3rd': 2, '5th': 4, octave: 7 }[m[1] as '3rd']) / 7) + MAJ[(idx + { '3rd': 2, '5th': 4, octave: 7 }[m[1] as '3rd']) % 7]], 72, 300) } }
    else if ((m = /^Mirror ([A-G]#?-?\d)/.exec(st))) { const x = midiOf(m[1]); if (x != null) tap([124 - x], 72, 300) }
    else if (/LOUD/.test(st)) tap([60 + (n++ % 5) * 2], 100, 220, false)
    else if (/soft/.test(st)) tap([60 + (n++ % 5) * 2], 30, 220, false)
    else if (id === 'gliss' || /^Next:/.test(st) && v.targetMidi.length === 1 && id === 'gliss') { for (let k = 48; k <= 72 && !run.dead; k++) { if ([1, 3, 6, 8, 10].includes(k % 12)) continue; tap([k], 68, 90); await run.sleep(70) } }
    else if (v.targetMidi.length) tap(v.targetMidi)
    else if (/Hold /.test(st) && v.targets.length) tap(v.targets.map((p) => 60 + ((p % 12) + 12) % 12), 72, 600)
    else if (/^Black keys/.test(st)) tap([[61, 63, 66, 68, 70, 73][n++ % 6]], 72, 200)
    else if (/^Play [A-G]#?$/.test(st)) { const nm = st.slice(5); tap([60 + NAMES.indexOf(nm)], 72, 300) }
    else if (/●/.test(st)) { // Rhythm Copy: tap the dots on the grid
      const pat = [...st.replace(/\s+/g, '')].map((c, i) => (c === '●' ? i : -1)).filter((i) => i >= 0)
      const step = v.stats.some((x) => x[1] === 'quick') ? 330 : 450
      const t0 = performance.now() + 100
      for (const i of pat) { await run.until(t0 + (i - pat[0]) * step); if (run.dead) return; tap([64], 72, 80) }
      await run.sleep(900)
    }
    else if (/^\d+ notes|Play a note to start/.test(st)) tap([[60, 62, 64, 67, 69, 72][n++ % 6]], 72, 150)
    else if (/^Stay in/.test(st)) tap([[60, 64, 67, 72, 69, 65, 62][n++ % 7]], 72, 220)
    else { const f = fallback[n++ % fallback.length]; if (f.notes.length) tap(f.notes, 70, 220) }
    void prompt; void bpm
  }
}

/** Learn it: replay the phrase the trainer is on (the trainer shows and judges it) */
async function learnPhrase(run: Run) {
  await run.sleep(3200) // the trainer "hears" it first
  while (!run.over) {
    const out = useLinkOut.getState()
    const sid = out.song?.id, ph = out.learn?.phrase ?? 1, rung = out.learn?.rung ?? 1
    const song = sid ? SONGS.find((s) => s.id === sid) : null
    if (song && rung > 1) {
      const tiny = ladderOf(song.id, song.notes, song.beatsPerBar).filter((p) => p.size === 1)
      const p = tiny[ph - 1]
      if (p) await playEvents(run, p.notes.map((n) => ({ notes: [n.note], beats: n.beats })), song.bpm * 0.75, 72)
    }
    await run.sleep(2400)
  }
}

export interface PerfOpts { t0?: number; speed?: number; lead?: number }

/** run one stop's performance. Resolves when it is done (looping ones stop at the run's deadline). */
export async function perform(run: Run, p: Perf, o: PerfOpts = {}): Promise<void> {
  if (p.k === 'none') return
  if (p.k === 'notes') {
    const evs = parsePhrase(p.seq)
    do {
      await playEvents(run, evs, p.bpm, p.vel ?? 70)
      if (!p.loop) return
      await run.sleep((p.gap ?? 1) * 60000 / p.bpm)
    } while (!run.over)
    return
  }
  if (p.k === 'song') {
    const s = findSong(p.id); if (!s) return
    const sp = o.speed ?? 1
    const evs: Ev[] = s.notes.map((n) => ({ notes: n.note == null ? [] : [n.note], beats: n.beats }))
    const lead = o.lead ?? 0
    await playEvents(run, [{ notes: [], beats: lead }, ...evs], s.bpm * sp, p.vel ?? 72, o.t0 ?? performance.now() + 200)
    return
  }
  if (p.k === 'guide') return followGuide(run, parsePhrase(p.seq), p.bpm)
  if (p.k === 'challenge') return driveChallenge(run, parsePhrase(p.seq), p.bpm)
  if (p.k === 'learn') return learnPhrase(run)
}
